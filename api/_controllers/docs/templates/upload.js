import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../../_utils/auth.js'
import { logAudit } from '../../../_utils/audit.js'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { PDFDocument } from 'pdf-lib'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper to extract variables from DOCX content
function extractVariables(content) {
    try {
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        
        // Inspect the document to find variables
        const text = zip.files['word/document.xml'].asText();
        // Strict Regex: Only {{UPPERCASE_WITH_UNDERSCORES}}
        // e.g. {{BORROWER_NAME}} - OK
        // e.g. {{BorrowerName}} - REJECT
        const regex = /\{\{([^}]+)\}\}/g;
        const variables = new Set();
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const rawVar = match[1].trim();
            // Validate Naming Convention
            if (!/^[A-Z0-9_]+$/.test(rawVar)) {
                throw new Error(`Invalid variable format: "${rawVar}". Only uppercase letters, numbers, and underscores allowed (e.g. {{BORROWER_NAME}}).`);
            }
            variables.add(rawVar);
        }
        
        return Array.from(variables);
    } catch (e) {
        if (e.message.startsWith('Invalid variable')) throw e;
        console.error("Error parsing DOCX:", e);
        return [];
    }
}

// Helper to parse PDF Fields
async function extractPdfFields(buffer) {
    try {
        const pdfDoc = await PDFDocument.load(buffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        return fields.map(f => {
            let maxLength = null;
            if (f.constructor.name === 'PDFTextField') {
                maxLength = f.getMaxLength() || null;
            }

            return {
                name: f.getName(),
                type: f.constructor.name,
                maxLength: maxLength
            };
        });
    } catch (e) {
        console.error("Error parsing PDF:", e);
        return [];
    }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const { user, firmId, userId, profile } = await verifyUser(req)
    const userRole = profile.role ? profile.role.toLowerCase() : ''

    const { name, folder_name, file_url, file_type, source, parent_template_id } = req.body

    if (!name || !file_url || !source) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    // 1. Fetch file content to extract variables / fields
    let docxVariables = [];
    let pdfFields = [];
    let renderEngine = 'docx_templater';
    
    // Fetch file buffer
    let buffer;
    try {
        const fileRes = await fetch(file_url);
        const arrayBuffer = await fileRes.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
    } catch (err) {
        return res.status(400).json({ error: "Failed to fetch template file." });
    }

    if (file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file_type === 'docx' || file_url.endsWith('.docx')) {
        renderEngine = 'docx_templater';
        try {
            docxVariables = extractVariables(buffer);
        } catch (err) {
            if (err.message.startsWith('Invalid variable')) {
                return res.status(400).json({ error: err.message });
            }
            return res.status(400).json({ error: "Failed to parse template variables. Ensure valid DOCX." });
        }
    } else if (file_type === 'application/pdf' || file_type === 'pdf' || file_url.endsWith('.pdf')) {
        renderEngine = 'pdf_acroform';
        pdfFields = await extractPdfFields(buffer);
        
        if (pdfFields.length === 0) {
            // Reject non-interactive PDFs
            return res.status(400).json({ error: "This PDF does not contain AcroForm fields. Please use a professional PDF editor to add fields first." });
        }
    } else {
        return res.status(400).json({ error: "Unsupported file type. Only .docx and .pdf (AcroForm) are supported." });
    }

    // 2. Determine Version & Inheritance
    let version = 1;
    let is_latest = true;
    let parentVars = [];
    let parentMappings = [];
    
    if (parent_template_id) {
        // Fetch parent info
        const table = source === 'global' ? 'global_templates' : 'firm_templates';
        const { data: parentData, error: parentError } = await supabaseAdmin
            .from(table)
            .select('version')
            .eq('id', parent_template_id)
            .single();
            
        if (!parentError && parentData) {
            version = (parentData.version || 1) + 1;
        }

        // Fetch Parent Variables/Mappings for Inheritance
        if (renderEngine === 'docx_templater') {
            const { data: pVars } = await supabaseAdmin
                .from('template_variables')
                .select('*')
                .eq('template_id', parent_template_id);
            if (pVars) parentVars = pVars;
        } else {
            const { data: pMaps } = await supabaseAdmin
                .from('pdf_field_mappings')
                .select('*')
                .eq('template_id', parent_template_id);
            if (pMaps) parentMappings = pMaps;
        }
    }

    // Permission Check & Insert Template Record
    let data;
    let initialStatus = 'draft'; 
    if (renderEngine === 'pdf_acroform') initialStatus = 'mapping'; // PDF starts in mapping phase

    if (source === 'global') {
        if (!['founder', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Only Founder can upload Global Templates' })
        }
        
        if (parent_template_id) {
             await supabaseAdmin
                .from('global_templates')
                .update({ is_latest: false, status: 'archived' })
                .eq('id', parent_template_id);
        }

        const insertRes = await supabaseAdmin
            .from('global_templates')
            .insert({ 
                name, 
                folder_name, 
                file_url, 
                file_type: renderEngine === 'pdf_acroform' ? 'pdf' : 'docx',
                version,
                parent_template_id,
                is_latest,
                status: initialStatus,
                render_engine: renderEngine
            })
            .select()
            .single()

        if (insertRes.error) throw insertRes.error
        data = insertRes.data

    } else if (source === 'firm') {
        if (!['partner', 'lawyer', 'founder', 'admin'].includes(userRole)) {
             return res.status(403).json({ error: 'Clerks cannot upload templates' })
        }

        if (parent_template_id) {
             await supabaseAdmin
                .from('firm_templates')
                .update({ is_latest: false, status: 'archived' })
                .eq('id', parent_template_id);
        }

        const insertRes = await supabaseAdmin
            .from('firm_templates')
            .insert({ 
                firm_id: firmId,
                name, 
                folder_name, 
                file_url, 
                file_type: renderEngine === 'pdf_acroform' ? 'pdf' : 'docx',
                created_by: userId,
                version,
                parent_template_id,
                is_latest,
                status: initialStatus,
                render_engine: renderEngine
            })
            .select()
            .single()

        if (insertRes.error) throw insertRes.error
        data = insertRes.data

    } else {
        return res.status(400).json({ error: 'Invalid source' })
    }

    // 3. Save Variables / Mappings
    if (renderEngine === 'docx_templater') {
        // ... (Existing DOCX Logic) ...
        if (docxVariables.length > 0) {
            const varsToInsert = docxVariables.map(v => {
                const parentVar = parentVars.find(pv => pv.variable_key === v);
                let is_confirmed = false;
                let case_field = null;
                let is_auto_mapped = false;

                if (parentVar && parentVar.is_confirmed) {
                    is_confirmed = true;
                    case_field = parentVar.case_field;
                } else {
                    const normalized = v.toLowerCase();
                    case_field = normalized;
                    is_auto_mapped = true; 
                }

                return {
                    template_id: data.id,
                    template_source: source,
                    variable_key: v,
                    case_field: case_field,
                    is_confirmed: is_confirmed,
                    is_auto_mapped: is_auto_mapped
                };
            });

            const { error: varError } = await supabaseAdmin.from('template_variables').insert(varsToInsert);
            if (varError) console.error("Error inserting variables:", varError);
            
            const allConfirmed = varsToInsert.every(v => v.is_confirmed);
            if (allConfirmed && varsToInsert.length > 0) {
                 await supabaseAdmin.from(source === 'global' ? 'global_templates' : 'firm_templates')
                    .update({ status: 'ready' }).eq('id', data.id);
                 data.status = 'ready';
            }
        } else {
            // No vars -> Ready
            await supabaseAdmin.from(source === 'global' ? 'global_templates' : 'firm_templates')
                .update({ status: 'ready' }).eq('id', data.id);
            data.status = 'ready';
        }
    } else {
        // PDF AcroForm Logic
        // Fetch Variable Dictionary for Auto-Match
        const { data: dictionary } = await supabaseAdmin.from('variable_dictionary').select('variable_key');
        const validKeys = new Set(dictionary?.map(d => d.variable_key) || []);

        const mappingsToInsert = pdfFields.map(f => {
            // Inheritance
            const parentMap = parentMappings.find(pm => pm.pdf_field_name === f.name);
            let variable_key = null;

            if (parentMap && parentMap.variable_key) {
                variable_key = parentMap.variable_key;
            } else {
                // Auto-Match: Check if field name matches a dictionary key (case-insensitive)
                const upperName = f.name.toUpperCase().replace(/\s+/g, '_'); // Normalize PDF field name
                // Also try direct match or normalized match
                if (validKeys.has(upperName)) {
                    variable_key = upperName;
                }
            }

            return {
                template_id: data.id,
                pdf_field_name: f.name,
                variable_key: variable_key,
                is_required: false, // Default to false, user sets it in UI
                max_length: f.maxLength
            };
        });

        if (mappingsToInsert.length > 0) {
            const { error: mapError } = await supabaseAdmin.from('pdf_field_mappings').insert(mappingsToInsert);
            if (mapError) console.error("Error inserting PDF mappings:", mapError);
        }
        
        // Status remains 'mapping' until manually confirmed via API
    }

    await logAudit({
        action: source === 'global' ? 'UPLOAD_GLOBAL_TEMPLATE' : 'UPLOAD_FIRM_TEMPLATE',
        tableName: source === 'global' ? 'global_templates' : 'firm_templates',
        recordId: data.id,
        newData: { 
            name, 
            version, 
            engine: renderEngine,
            field_count: renderEngine === 'pdf_acroform' ? pdfFields.length : docxVariables.length, 
            status: data.status 
        },
        userId, firmId, ipAddress: req.headers['x-forwarded-for']
    })

    return res.status(200).json({ success: true, data, variables: renderEngine === 'pdf_acroform' ? pdfFields : docxVariables })

  } catch (error) {
    console.error('Upload Template Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
