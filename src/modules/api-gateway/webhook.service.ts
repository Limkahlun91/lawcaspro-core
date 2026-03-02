import { supabase } from '../../lib/supabaseClient';

export class WebhookQueueService {
  
  /**
   * Queue a Webhook Event for a Partner
   */
  async enqueueWebhook(firmId: string, eventType: string, payload: any) {
    // 1. Find Active Webhooks for this Firm & Event Type
    const { data: hooks } = await supabase
      .from('partner_webhooks')
      .select('*')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (!hooks || hooks.length === 0) return;

    // 2. Insert Jobs
    const jobs = hooks.map(hook => ({
      firm_id: firmId,
      partner_webhook_id: hook.id,
      event_type: eventType,
      payload: payload,
      status: 'pending',
      next_retry_at: new Date().toISOString()
    }));

    await supabase.from('webhook_jobs').insert(jobs);
  }

  /**
   * Process Pending Jobs (Worker Logic)
   */
  async processJobs() {
    // Fetch pending jobs
    const { data: jobs } = await supabase
      .from('webhook_jobs')
      .select('*, partner_webhooks(url, secret_key)')
      .eq('status', 'pending')
      .limit(10); // Batch size

    if (!jobs) return;

    for (const job of jobs) {
      try {
        await this.sendWebhook(job);
      } catch (error) {
        await this.handleFailure(job, error);
      }
    }
  }

  private async sendWebhook(job: any) {
    const url = job.partner_webhooks.url;
    const secret = job.partner_webhooks.secret_key;
    const payload = JSON.stringify(job.payload);
    const startTime = Date.now();
    
    // Sign Payload
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    let response;
    let error;

    try {
      // Send Request
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString()
        },
        body: payload
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Update Status
      await supabase
        .from('webhook_jobs')
        .update({
          status: 'completed',
          response_status: response.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);
        
    } catch (err: any) {
      error = err;
      throw err; // Re-throw to trigger retry logic
    } finally {
      // Log Delivery Attempt (Success or Fail)
      const latency = Date.now() - startTime;
      await supabase.from('webhook_delivery_logs').insert({
        job_id: job.id,
        response_status: response?.status || 0,
        response_body: error ? error.message : 'OK',
        latency_ms: latency,
        attempt: job.retry_count + 1
      });
    }
  }

  private async handleFailure(job: any, error: any) {
    const nextRetry = job.retry_count + 1;
    
    if (nextRetry >= 5) {
      await supabase
        .from('webhook_jobs')
        .update({ 
          status: 'failed', 
          failed_permanently: true, // Mark Dead Letter
          response_body: error.message 
        })
        .eq('id', job.id);
    } else {
      // Exponential Backoff: 1m, 5m, 30m, 2h, 12h
      const delays = [1, 5, 30, 120, 720]; 
      const delayMinutes = delays[nextRetry - 1] || 60;
      const nextTime = new Date(Date.now() + delayMinutes * 60000);

      await supabase
        .from('webhook_jobs')
        .update({
          status: 'pending', // Re-queue
          retry_count: nextRetry,
          next_retry_at: nextTime.toISOString(),
          response_body: error.message
        })
        .eq('id', job.id);
    }
  }
}

export const webhookQueueService = new WebhookQueueService();
