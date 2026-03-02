import { supabase } from '../../lib/supabaseClient';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogDomain = 'financial' | 'lhdn' | 'billing' | 'infra' | 'security';

export interface StructuredLog {
  domain: LogDomain;
  action: string;
  level: LogLevel;
  firm_id?: string;
  user_id?: string;
  request_id?: string;
  metadata?: any;
  error?: any;
}

export class LoggerService {
  
  /**
   * Log an event (Structured)
   * In production, this would send to ElasticSearch / Datadog / CloudWatch.
   * For now, we print JSON to stdout (container logs) and maybe store critical ones in DB.
   */
  log(event: StructuredLog) {
    const timestamp = new Date().toISOString();
    
    // 1. Console Output (JSON format for collectors)
    const logEntry = {
      ts: timestamp,
      ...event,
      error_stack: event.error?.stack
    };
    
    // Use proper stream based on level
    if (event.level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }

    // 2. Critical Errors -> System Alerts (Optional Async)
    if (event.level === 'error' && event.domain === 'lhdn') {
      // triggerAlert(event);
    }
  }

  info(domain: LogDomain, action: string, meta?: any) {
    this.log({ domain, action, level: 'info', metadata: meta });
  }

  error(domain: LogDomain, action: string, error: any, meta?: any) {
    this.log({ domain, action, level: 'error', error, metadata: meta });
  }
}

export const logger = new LoggerService();
