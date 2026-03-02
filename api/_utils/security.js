import { adminClient } from './admin-client.js';

export async function suspendUser(userId, reason) {
  try {
    console.warn(`[SECURITY] Suspending user ${userId}: ${reason}`);
    
    // 1. Update Profile Status
    const { error } = await adminClient
      .from('profiles')
      .update({ 
        status: 'suspended', 
        suspension_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    // 2. Log Security Event
    await adminClient.from('security_events').insert({
      user_id: userId,
      event_type: 'account_suspended',
      risk_level: 'critical',
      details: { reason }
    });

  } catch (err) {
    console.error('Suspend User Error:', err);
  }
}
