import { supabase } from '../lib/supabaseClient';
import { JSZip } from 'jszip'; // Need to install: npm install jszip
import { saveAs } from 'file-saver'; // Browser only, for worker environment need S3 upload logic

export class DataExportWorker {
  
  /**
   * Process Pending Export Requests
   * In production, this runs on a separate node process/lambda.
   */
  async processQueue() {
    // 1. Fetch pending job (with Locking)
    // Using RPC or raw query for locking is best, but Supabase JS doesn't support 'FOR UPDATE SKIP LOCKED' easily.
    // We simulate locking by updating status atomically if possible, or using a stored procedure.
    // Here we use a two-step lock: Update where null -> Process.
    
    const workerId = `worker_${Date.now()}_${Math.random()}`;
    
    // Attempt to lock a job
    const { data: job, error } = await supabase
      .from('data_export_requests')
      .update({ 
        status: 'processing',
        locked_at: new Date().toISOString(),
        locked_by: workerId
      })
      .eq('status', 'pending')
      .is('locked_at', null) // Ensure not already locked
      .limit(1)
      .select()
      .maybeSingle();

    if (!job) return; // No jobs available or failed to lock

    try {
      console.log(`Processing Job ${job.id} by ${workerId}`);

      // 2. Fetch Data (Parallel)
      const [documents, payments, ledger] = await Promise.all([
        supabase.from('financial_documents').select('*').eq('firm_id', job.firm_id),
        supabase.from('payments').select('*').eq('firm_id', job.firm_id),
        supabase.from('journal_entries').select('*, journal_entry_lines(*)').eq('firm_id', job.firm_id)
      ]);

      // 3. Generate JSON Files (Simulated ZIP creation)
      // For large datasets, we should stream this.
      // Here we assume memory is sufficient for Phase 4A, but mark for optimization.
      
      // const zip = new JSZip();
      // zip.file("documents.json", JSON.stringify(documents.data));
      // ...
      
      const mockUrl = `https://s3.aws.com/exports/${job.firm_id}/${job.id}.zip`;

      // 4. Complete
      await supabase
        .from('data_export_requests')
        .update({
          status: 'completed',
          download_url: mockUrl,
          expiry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
          locked_at: null, // Release lock (optional, but good for history)
          locked_by: null
        })
        .eq('id', job.id);

    } catch (error: any) {
      await supabase
        .from('data_export_requests')
        .update({ 
          status: 'failed',
          locked_at: null, // Release lock on failure so it can be retried or inspected
          locked_by: null 
        })
        .eq('id', job.id);
    }
  }
}

export const dataExportWorker = new DataExportWorker();
