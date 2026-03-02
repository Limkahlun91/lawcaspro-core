import { supabase } from '../../../lib/supabaseClient';
import { auditService } from '../../audit/audit.service';
import { usageService } from '../../billing/usage.service';

export class LhdnSubmitService {
  
  /**
   * Submit Invoice to LHDN (MyInvois)
   */
  async submitInvoice(invoiceId: string, firmId: string, userId: string) {
    // 0. Quota Check (Phase 3 Requirement)
    if (!(await usageService.checkQuota(firmId, 'lhdn_submission'))) {
      throw new Error('LHDN Submission Quota Exceeded. Please upgrade your plan.');
    }

    // 1. Fetch Invoice Data
    const { data: invoice } = await supabase
      .from('financial_documents')
      .select('*, financial_document_items(*), client:clients(*), firm:firms(*)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) throw new Error('Invoice not found');

    // 2. Build JSON Payload (UBL 2.1 Standard)
    // This is a simplified representation. Real LHDN payload is complex XML/JSON.
    const payload = {
      _comment: "LHDN MyInvois Payload",
      invoiceTypeCode: "01",
      id: invoice.document_no,
      issueDate: new Date().toISOString().split('T')[0],
      supplier: {
        tin: invoice.firm.tin_no,
        msic: invoice.firm.msic_code,
        name: invoice.firm.name
      },
      buyer: {
        tin: invoice.client?.tin_no || 'EI00000000010', // Default generic TIN if B2C
        name: invoice.client?.name
      },
      items: invoice.financial_document_items.map((item: any) => ({
        description: item.description,
        classificationCode: "022", // Professional Services
        unitPrice: item.unit_price,
        taxType: "06", // SST
        taxAmount: 0 // Calc logic
      })),
      totalExcludingTax: invoice.subtotal,
      totalTax: invoice.sst_amount,
      totalPayable: invoice.total_amount
    };

    // 3. Create Submission Record (Pending)
    const { data: submission } = await supabase
      .from('lhdn_submissions')
      .insert({
        firm_id: firmId,
        document_id: invoiceId,
        status: 'processing',
        request_payload: payload,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    try {
      // 4. Call LHDN API (Simulated)
      // await axios.post('https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions', payload, { headers: { Authorization: `Bearer ${token}` } });
      
      const mockLhdnResponse = {
        submissionUid: `LHDN-${Date.now()}`,
        acceptedDocuments: [{ uuid: `UUID-${Date.now()}`, invoiceCode: invoice.document_no }],
        rejectedDocuments: []
      };

      // 5. Update Submission Record
      await supabase
        .from('lhdn_submissions')
        .update({
          status: 'submitted', // Or 'validated' if instant
          submission_uid: mockLhdnResponse.submissionUid,
          response_payload: mockLhdnResponse
        })
        .eq('id', submission.id);

      // 6. Update Invoice
      await supabase
        .from('financial_documents')
        .update({
          lhdn_status: 'submitted',
          lhdn_uuid: mockLhdnResponse.acceptedDocuments[0].uuid
        })
        .eq('id', invoiceId);

      // 7. Audit
      await auditService.log({
        firm_id: firmId,
        user_id: userId,
        action: 'SUBMIT_LHDN',
        table_name: 'financial_documents',
        record_id: invoiceId,
        new_data: { lhdn_uuid: mockLhdnResponse.acceptedDocuments[0].uuid },
        module: 'lhdn'
      });

      // 8. Increment Usage
      await usageService.incrementUsage(firmId, 'lhdn_submission', 1, submission.id);

      return mockLhdnResponse;

    } catch (error: any) {
      // Handle Failure
      await supabase
        .from('lhdn_submissions')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', submission.id);
      
      throw error;
    }
  }
}

export const lhdnSubmitService = new LhdnSubmitService();
