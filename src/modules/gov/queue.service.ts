import { supabase } from '../../lib/supabaseClient';

export class GovQueueService {
  
  /**
   * Queue a document for submission
   */
  async queueSubmission(documentId: string, type: 'invoice' | 'cancel', firmId: string) {
    await supabase.from('gov_submission_queue').insert({
      firm_id: firmId,
      document_type: type,
      document_id: documentId,
      status: 'queued',
      next_retry_at: new Date().toISOString()
    });
  }

  /**
   * Process Queue (Worker Function)
   * This would typically run in a scheduled job or edge function.
   */
  async processQueue() {
    // 1. Fetch Pending Items
    const { data: jobs } = await supabase
      .from('gov_submission_queue')
      .select('*')
      .in('status', ['queued', 'retrying'])
      .lte('next_retry_at', new Date().toISOString())
      .limit(10);

    if (!jobs || jobs.length === 0) return;

    for (const job of jobs) {
      try {
        // Mark as processing
        await supabase.from('gov_submission_queue').update({ status: 'processing' }).eq('id', job.id);

        // --- CALL LHDN API HERE ---
        // await lhdnService.submit(job.document_id);
        // Simulate Success
        const success = true; 

        if (success) {
          await supabase.from('gov_submission_queue').update({ status: 'submitted' }).eq('id', job.id);
        } else {
          throw new Error('Simulation Failed');
        }

      } catch (error: any) {
        console.error(`Job ${job.id} failed:`, error);
        
        const nextRetry = job.retry_count + 1;
        if (nextRetry >= (job.max_retries || 3)) {
           await supabase.from('gov_submission_queue').update({ 
             status: 'failed', 
             last_error: error.message 
           }).eq('id', job.id);
        } else {
           // Exponential Backoff
           const delayMinutes = Math.pow(2, nextRetry); 
           const nextTime = new Date();
           nextTime.setMinutes(nextTime.getMinutes() + delayMinutes);

           await supabase.from('gov_submission_queue').update({ 
             status: 'retrying',
             retry_count: nextRetry,
             next_retry_at: nextTime.toISOString(),
             last_error: error.message
           }).eq('id', job.id);
        }
      }
    }
  }
}

export const govQueueService = new GovQueueService();
