import { adminClient } from './admin-client.js';
import { suspendUser } from './security.js';

export async function logAudit({
  action,
  tableName,
  recordId,
  oldData = null,
  newData = null,
  userId,
  firmId,
  ipAddress = null,
  userAgent = null
}) {
  try {
    const { error } = await adminClient
      .from('audit_logs')
      .insert({
        action,
        table_name: tableName,
        record_id: recordId,
        old_value: oldData, // Schema uses old_value/new_value
        new_value: newData,
        user_id: userId,
        firm_id: firmId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Error in logAudit:', err);
  }
}

export async function logExport({
  firmId,
  userId,
  exportType,
  recordCount,
  ipAddress
}) {
  try {
    const { error } = await adminClient
      .from('export_logs')
      .insert({
        firm_id: firmId,
        user_id: userId,
        export_type: exportType,
        record_count: recordCount,
        ip_address: ipAddress
      });

    if (error) console.error('Failed to write export log:', error);
    
    // Check for anomaly after logging
    await checkAnomaly({ firmId, userId, ipAddress });
  } catch (err) {
    console.error('Error in logExport:', err);
  }
}

export async function checkAnomaly({ firmId, userId, ipAddress }) {
  try {
    // Rule 1: excessive_export (10 exports in 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { count, error } = await adminClient
      .from('export_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', fiveMinutesAgo);
    
    if (error) throw error;

    if (count > 10) {
      // Log Security Event
      await adminClient.from('security_events').insert({
        firm_id: firmId,
        user_id: userId,
        event_type: 'excessive_export',
        risk_level: 'high',
        ip_address: ipAddress,
        details: { count, threshold: 10, time_window: '5m' }
      });
      console.warn(`[SECURITY] Excessive export detected for user ${userId}`);
      
      // Auto Suspend
      await suspendUser(userId, 'Excessive export activity');
      
      return { anomaly: true, reason: 'excessive_export' };
    }
    
    // Future rules: check for off-hours access, etc.
    
    return { anomaly: false };
  } catch (err) {
    console.error('Error in checkAnomaly:', err);
    return { anomaly: false };
  }
}

export async function logRead({ firmId, userId, resource, count, ipAddress }) {
  try {
    // 1. Anomaly Check
    if (count > 1000) { // Enterprise Limit
       await suspendUser(userId, `Massive read on ${resource}: ${count} records`);
    }

    // 2. Log
    await adminClient.from('audit_logs').insert({
        action: 'READ',
        table_name: resource,
        user_id: userId,
        firm_id: firmId,
        ip_address: ipAddress,
        new_value: { count }
    });
  } catch (err) {
    console.error('logRead Error:', err);
  }
}
