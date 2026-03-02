import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../../_utils/auth.js'
import { logAudit } from '../../../_utils/audit.js'
import { calculateHash } from '../../../_utils/crypto.js'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { PDFDocument } from 'pdf-lib'
import { buildCaseData } from '../../../_utils/case-data-aggregator.js'
import { ProductionValidator } from '../../../_utils/production-validator.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const validator = new ProductionValidator();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { user, firmId, userId } = await verifyUser(req)

    const { caseId, templateId, source } = req.body
    if (!caseId || !templateId || !source) return res.status(400).json({ error: 'Missing required fields' })

    // 1. Fetch Template Info with Strict Checks
    let templateTable = source === 'global' ? 'global_templates' : 'firm_templates'
    let query = supabaseAdmin.from(templateTable)
        .select('*')
        .eq('id', templateId)
        .eq('status', 'ready') // Enforce READY status
        .single()
    
    if (source === 'firm') query = query.eq('firm_id', firmId)
    
    const { data: template, error: tmplError } = await query
    
    if (tmplError || !template) {
        // Detailed error check
        if (!template && !tmplError) {
             return res.status(404).json({ error: 'Template not found or not in READY status.' })
        }
        return res.status(404).json({ error: 'Template not found or not in READY status.' })
    }

    // Enforce Latest
    if (!template.is_latest) {
         return res.status(400).json({ error: 'Cannot generate from an archived version. Please use the latest version.' })
    }

    // 3. Build Case Data (Aggregator)
    // Use the Aggregator as the Single Source of Truth
    const aggregatorData = await buildCaseData(caseId, supabaseAdmin);

    let generatedFileUrl = null;
    let finalDataMap = {};
    let mappingSnapshot = {}; // Store Resolved Mappings
    let fileHash = null;      // Store SHA-256 Hash

    // 4. Branch by Render Engine
    if (template.render_engine === 'pdf_acroform') {
        // PDF Logic
        // 4a. Fetch Mappings
        const { data: mappings, error: mapError } = await supabaseAdmin
            .from('pdf_field_mappings')
            .select('*')
            .eq('template_id', templateId);
        
        if (mapError) throw mapError;

        // 4b. Production Safety Layer
        // Step 1: Configuration Check
        const configCheck = validator.validateConfiguration(mappings);
        if (!configCheck.isValid) {
            return res.status(400).json({ error: configCheck.error });
        }

        // Step 2 & 3: Runtime Data Check & Length Check
        const runtimeCheck = validator.validateRuntimeData(mappings, aggregatorData);
        if (!runtimeCheck.isValid) {
            return res.status(400).json({ error: runtimeCheck.error });
        }

        // 4c. Prepare Data for PDF (Flatten or Fill)
        finalDataMap = {};
        mappings.forEach(m => {
            let val = m.static_value;
            // Record Snapshot Logic: Field -> Variable/Static
            mappingSnapshot[m.pdf_field_name] = m.variable_key || `STATIC: ${m.static_value}`;

            if (m.variable_key && aggregatorData[m.variable_key]) {
                val = aggregatorData[m.variable_key];
            }
            if (val !== undefined && val !== null) {
                finalDataMap[m.pdf_field_name] = String(val);
            }
        });

        // 4d. Render PDF
        try {
            const fileRes = await fetch(template.file_url);
            const arrayBuffer = await fileRes.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const form = pdfDoc.getForm();

            // Fill Fields
            for (const [fieldName, value] of Object.entries(finalDataMap)) {
                try {
                    const field = form.getTextField(fieldName);
                    if (field) {
                        field.setText(value);
                    }
                } catch (e) {
                    // Ignore if field not found (or checkbox) - enhance later for checkboxes
                    console.warn(`Field ${fieldName} not found or not text:`, e.message);
                }
            }

            // Flatten Form (Bank Requirement: Immutable)
            form.flatten();

            const pdfBytes = await pdfDoc.save();
            const buffer = Buffer.from(pdfBytes);

            // Calculate Hash
            fileHash = calculateHash(buffer);

            // Upload
            const fileName = `generated_${caseId}_${Date.now()}.pdf`;
            const filePath = `generated/${caseId}/${fileName}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('legal-docs')
                .upload(filePath, buffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseAdmin.storage
                .from('legal-docs')
                .getPublicUrl(filePath);

            generatedFileUrl = publicUrlData.publicUrl;

        } catch (pdfError) {
            console.error("PDF Generation Error:", pdfError);
            return res.status(500).json({ error: 'Failed to generate PDF: ' + pdfError.message });
        }

    } else {
        // DOCX Logic (Existing)
        // 2. Fetch Variables Mapping
        const { data: variables, error: varError } = await supabaseAdmin
            .from('template_variables')
            .select('*')
            .eq('template_id', templateId)
        
        if (variables && variables.some(v => !v.is_confirmed)) {
             return res.status(400).json({ error: 'Template has unconfirmed variables. Please map them first.' })
        }
        
        // 4. Map Data (Aggregator -> Template Variables)
        const dataMap = {}
        Object.assign(dataMap, aggregatorData);
        
        if (variables && variables.length > 0) {
            variables.forEach(v => {
                if (v.case_field) {
                    // Record Snapshot
                    mappingSnapshot[v.variable_key] = v.case_field;

                    if (aggregatorData[v.case_field] !== undefined) {
                        dataMap[v.variable_key] = aggregatorData[v.case_field];
                    }
                } else {
                     mappingSnapshot[v.variable_key] = 'AUTO_MAPPED';
                }
            })
        }
        finalDataMap = dataMap;

        // 5. Generate Document
        generatedFileUrl = template.file_url // Fallback
        
        if (template.file_type === 'docx' || template.file_url.endsWith('.docx')) {
            try {
                // Fetch template content
                const fileRes = await fetch(template.file_url)
                const arrayBuffer = await fileRes.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                
                // Render
                const zip = new PizZip(buffer)
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                })
                
                // Render with Aggregator Data
                doc.render(dataMap)
                
                const generatedBuf = doc.getZip().generate({
                    type: 'nodebuffer',
                    compression: 'DEFLATE',
                })

                // Calculate Hash
                fileHash = calculateHash(generatedBuf);
                
                // Upload Generated File
                const fileName = `generated_${caseId}_${Date.now()}.docx`
                const filePath = `generated/${caseId}/${fileName}`
                
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('legal-docs')
                    .upload(filePath, generatedBuf, {
                        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        upsert: true
                    })
                    
                if (uploadError) throw uploadError
                
                // Get Public URL
                const { data: publicUrlData } = supabaseAdmin.storage
                    .from('legal-docs')
                    .getPublicUrl(filePath)
                    
                generatedFileUrl = publicUrlData.publicUrl
                
            } catch (genError) {
                console.error("Generation Error:", genError)
                return res.status(500).json({ error: 'Failed to generate document: ' + genError.message })
            }
        }
    }

    // 6. Create Record with Snapshot
    const { data: doc, error: insertError } = await supabaseAdmin
        .from('generated_documents')
        .insert({
            case_id: caseId,
            template_id: templateId,
            template_source: source,
            generated_by: userId,
            file_url: generatedFileUrl,
            template_version: template.version || 1,
            template_name_snapshot: template.name, // Store immutable snapshot
            data_snapshot: finalDataMap, // Store EXACT data used for audit (Flattened or Mapped)
            mapping_snapshot: mappingSnapshot, // Level 4: Logic Snapshot
            file_hash: fileHash // Level 4: Tamper Proof Hash
        })
        .select()
        .single()

    if (insertError) throw insertError

    await logAudit({
        action: 'GENERATE_DOCUMENT',
        tableName: 'generated_documents',
        recordId: doc.id,
        newData: { template_name: template.name, case_id: caseId, version: template.version, snapshot: true, engine: template.render_engine },
        userId, firmId, ipAddress: req.headers['x-forwarded-for']
    })

    return res.status(200).json({ success: true, file_url: generatedFileUrl, doc_id: doc.id })

  } catch (error) {
    console.error('Generate Doc Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
