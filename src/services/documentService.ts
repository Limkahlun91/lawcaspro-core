import { supabase } from '../lib/supabaseClient';
import Handlebars from 'handlebars';
import { jsPDF } from 'jspdf';
// import { PDFDocument } from 'pdf-lib'; // Keep for future PDF manipulation if needed

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  type: 'editor' | 'word' | 'pdf';
  content_html?: string;
  content_json?: any;
  file_url?: string;
  version: number;
  current_version_id?: string; // Enterprise Refinement
}

export interface SystemVariable {
  variable_key: string;
  label: string;
  category: string;
  source_table?: string;
  source_column?: string;
  data_type: string;
}

class DocumentService {
  
  // --- Template Management ---

  async getTemplates(firmId: string) {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as DocumentTemplate[];
  }

  async getTemplate(id: string) {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as DocumentTemplate;
  }

  async saveTemplate(template: Partial<DocumentTemplate>, firmId: string, userId: string) {
    // Enterprise Versioning Logic:
    // 1. If new, insert into document_templates -> get ID -> insert version 1 -> update document_templates with version_id
    // 2. If update, insert new version -> update document_templates current_version_id + version number
    
    try {
      if (!template.id) {
        // Create New
        // 1. Insert Template Shell
        const { data: newTemplate, error: createError } = await supabase
          .from('document_templates')
          .insert({
            name: template.name,
            category: template.category,
            type: template.type,
            firm_id: firmId,
            created_by: userId,
            is_active: true,
            version: 1
          })
          .select()
          .single();
        
        if (createError) throw createError;

        // 2. Insert Version 1
        const { data: version, error: versionError } = await supabase
          .from('template_versions')
          .insert({
            template_id: newTemplate.id,
            version_number: 1,
            content_html: template.content_html,
            content_json: template.content_json,
            created_by: userId
          })
          .select()
          .single();

        if (versionError) throw versionError;

        // 3. Update Current Version Link
        await supabase
          .from('document_templates')
          .update({ current_version_id: version.id })
          .eq('id', newTemplate.id);

        return newTemplate;

      } else {
        // Update Existing
        // 1. Get current version number
        const { data: current, error: fetchError } = await supabase
          .from('document_templates')
          .select('version')
          .eq('id', template.id)
          .single();
        
        if (fetchError) throw fetchError;
        const nextVersion = (current.version || 0) + 1;

        // 2. Insert New Version
        const { data: version, error: versionError } = await supabase
          .from('template_versions')
          .insert({
            template_id: template.id,
            version_number: nextVersion,
            content_html: template.content_html,
            content_json: template.content_json,
            created_by: userId
          })
          .select()
          .single();

        if (versionError) throw versionError;

        // 3. Update Template Pointer
        const { data: updated, error: updateError } = await supabase
          .from('document_templates')
          .update({ 
            current_version_id: version.id,
            version: nextVersion,
            name: template.name, // Allow renaming
            category: template.category,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updated;
      }
    } catch (error) {
      console.error('Save Template Error:', error);
      throw error;
    }
  }

  // --- Variable Management ---

  async getVariables() {
    const { data, error } = await supabase
      .from('system_variables')
      .select('*')
      .eq('is_active', true) // Added is_active check
      .order('category');
    
    if (error) throw error;
    return data as SystemVariable[];
  }

  // --- Generation Engine (Client-Side Implementation of Backend Logic) ---

  async generateDocument(templateId: string, caseId: string, firmId: string, userId: string) {
    try {
      // 1. Fetch Template
      const template = await this.getTemplate(templateId);
      if (!template) throw new Error('Template not found');

      // 2. Fetch Case Data (and related entities)
      // Ideally this fetches a deep object: Case + Purchasers + Vendor + Property
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*') // In real app, join tables
        .eq('id', caseId)
        .single();
      
      if (caseError) throw caseError;

      // 3. Build Variable Context
      // Transform caseData into standard variable keys (e.g. purchaser_name -> PURCHASER_NAME)
      const context = this.buildContext(caseData);

      // 4. Compile & Replace
      let content = '';
      let versionId = template.current_version_id;

      if (template.type === 'editor') {
        // Fetch specific version content if needed, but for now we use what might be in the main table or join
        // With enterprise schema, content is in template_versions. 
        // We need to fetch the content from the version if not joined.
        // Let's assume we need to fetch it now.
        const { data: versionData } = await supabase
            .from('template_versions')
            .select('id, content_html')
            .eq('id', template.current_version_id)
            .single();
            
        const htmlContent = versionData?.content_html || template.content_html; // Fallback
        if (!htmlContent) throw new Error('Empty template content');

        const compiled = Handlebars.compile(htmlContent);
        content = compiled(context);
      } else {
        throw new Error('Word/PDF generation not implemented in client-side prototype yet');
      }

      // 5. Generate PDF Blob (Client-side)
      // Using simple HTML -> PDF approach for now. 
      // In production, send HTML to Puppeteer service.
      const pdfBlob = await this.htmlToPdf(content);
      
      // Calculate Hash (Simple client-side SHA-256 simulation)
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Enhanced Hash: sha256(fileHash + versionId + timestamp)
      // This is what goes into the ledger
      const generatedAt = new Date().toISOString();
      const enhancedInput = new TextEncoder().encode(fileHash + versionId + generatedAt);
      const enhancedHashBuffer = await crypto.subtle.digest('SHA-256', enhancedInput);
      const enhancedHashArray = Array.from(new Uint8Array(enhancedHashBuffer));
      const integrityHash = enhancedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // 6. Upload to Storage
      const fileName = `${template.name}_${caseId}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents') // Ensure this bucket exists!
        .upload(`${firmId}/${fileName}`, pdfBlob);

      if (uploadError) throw uploadError;

      const fileUrl = supabase.storage.from('documents').getPublicUrl(`${firmId}/${fileName}`).data.publicUrl;

      // 7. Save Record (Generated Document)
      const { data: docRecord, error: docError } = await supabase.from('generated_documents').insert({
        firm_id: firmId,
        case_id: caseId,
        template_id: templateId,
        template_version_id: versionId, // Enterprise tracking
        file_url: fileUrl,
        output_format: 'pdf', // Enterprise schema
        generated_by: userId,
        status: 'completed',
        file_hash: fileHash, // Base file hash
        integrity_hash: integrityHash // Enhanced hash
      }).select().single();

      if (docError) throw docError;

      // 8. Update Integrity Ledger (Hash Chain)
      // Fetch previous hash
      const { data: lastLedger } = await supabase.rpc('get_last_ledger_hash', { p_firm_id: firmId });
      const previousHash = lastLedger || 'GENESIS_HASH';
      
      // Get next sequence
      const { data: nextSeq } = await supabase.rpc('get_next_ledger_sequence', { p_firm_id: firmId });

      await supabase.from('document_integrity_ledger').insert({
          firm_id: firmId,
          document_id: docRecord.id,
          previous_hash: previousHash,
          current_hash: integrityHash,
          sequence_index: nextSeq
      });

      return { fileUrl, content }; // Return content for preview if needed
    } catch (error) {
      console.error('Generation Failed:', error);
      throw error;
    }
  }

  // --- Helpers ---

  private buildContext(caseData: any) {
    // Map DB columns to Variable Keys
    // e.g. caseData.purchaser_name -> context.PURCHASER_NAME
    const context: any = {};
    for (const [key, value] of Object.entries(caseData)) {
      context[key.toUpperCase()] = value;
    }
    // Add helpers/calculated fields
    context.CURRENT_DATE = new Date().toLocaleDateString();
    return context;
  }

  private async htmlToPdf(html: string): Promise<Blob> {
    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.width = '210mm'; // A4
    container.style.padding = '20mm';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    // Use html2pdf or similar if available, or just return dummy blob for now if libs missing
    // Since we installed jspdf, we can use it
    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4'
    });

    // Simple text extraction for now, or use .html() method
    // doc.html is async and complex in some versions.
    // For prototype, we'll just put the HTML text content
    // Better: use html2canvas if possible, or just raw text for now
    try {
        await doc.html(container, {
            callback: (doc) => {
                // done
            },
            x: 10,
            y: 10,
            width: 500, // max width
            windowWidth: 800
        });
    } catch (e) {
        // Fallback if html method fails or context issues
        doc.text(container.innerText, 40, 40);
    }
    
    document.body.removeChild(container);
    return doc.output('blob');
  }
}

export const documentService = new DocumentService();
