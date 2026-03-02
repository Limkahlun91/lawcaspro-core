import { supabase } from '../../lib/supabaseClient';
import { auditService } from '../audit/audit.service';
import { permissionService } from '../auth/permission.service';

export class DigitalSignatureService {
  
  /**
   * Cryptographically sign a Finance Record (PV, Credit Note, etc.)
   * Uses Web Crypto API for client-side hashing (SHA-256).
   * In a real enterprise app, the actual signing (Private Key) happens:
   * 1. On a secure server (HSM/KMS) via API
   * 2. Or using a user's USB Token (Client-side)
   * 
   * Here we simulate Server-Side Signing by storing a hash and a mock signature.
   */
  async signRecord(recordType: 'payment_voucher', recordId: string, userId: string, firmId: string) {
    // 1. Permission Check
    if (!(await permissionService.hasPermission(userId, 'finance.sign'))) {
      throw new Error('Permission Denied: Not authorized to sign finance documents');
    }

    // 2. Fetch Record Data (Snapshot)
    const { data: record } = await supabase
      .from('payment_vouchers')
      .select('*')
      .eq('id', recordId)
      .single();

    if (!record) throw new Error('Record not found');
    if (record.is_locked) throw new Error('Record is already locked');

    // 3. Generate Canonical Hash (SHA-256)
    // We strictly define the payload structure to ensure reproducibility
    const payload = {
      firm_id: record.firm_id,
      voucher_no: record.voucher_no,
      total_amount: record.total_amount,
      payee_name: record.payee_name,
      created_at: record.created_at,
      approved_at: record.approved_at
    };
    
    const canonicalString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 4. "Sign" the Hash (Simulation of RSA Signing)
    // In prod: await kmsService.sign(hashHex)
    const mockSignature = `sig_rsa_${Date.now()}_${hashHex.substring(0, 10)}`;

    // 5. Store Signature
    const { error: sigError } = await supabase.from('finance_signatures').insert({
      firm_id: firmId,
      record_type: recordType,
      record_id: recordId,
      hash_value: hashHex,
      signature: mockSignature,
      signed_by: userId,
      signed_at: new Date().toISOString()
    });

    if (sigError) throw sigError;

    // 6. Lock the Record
    // We don't necessarily lock immediately if we wait for LHDN, but signing usually implies finalization.
    // Let's assume signing is a pre-requisite for LHDN or is the final internal step.
    // For now, we just mark it signed in the audit log. The 'Locked' stage in workflow handles the lock.
    
    // 7. Audit
    await auditService.log({
      firm_id: firmId,
      user_id: userId,
      action: 'UPDATE', // Custom action: SIGNED
      table_name: 'payment_vouchers',
      record_id: recordId,
      new_data: { signed: true, signature: mockSignature },
      module: 'digital-signature'
    });

    return { hash: hashHex, signature: mockSignature };
  }

  /**
   * Verify if a record has been tampered with since signing.
   */
  async verifyRecord(recordType: 'payment_voucher', recordId: string) {
    // 1. Fetch Signature
    const { data: sig } = await supabase
      .from('finance_signatures')
      .select('*')
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!sig) return { verified: false, reason: 'No signature found' };

    // 2. Fetch Current Record
    const { data: record } = await supabase
      .from('payment_vouchers')
      .select('*')
      .eq('id', recordId)
      .single();

    if (!record) return { verified: false, reason: 'Record missing' };

    // 3. Reconstruct Hash
    const payload = {
      firm_id: record.firm_id,
      voucher_no: record.voucher_no,
      total_amount: record.total_amount,
      payee_name: record.payee_name,
      created_at: record.created_at,
      approved_at: record.approved_at
    };
    
    const canonicalString = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 4. Compare
    if (currentHash === sig.hash_value) {
      return { verified: true, signed_at: sig.signed_at, signed_by: sig.signed_by };
    } else {
      return { verified: false, reason: 'Hash mismatch - Data has been modified' };
    }
  }
}

export const digitalSignatureService = new DigitalSignatureService();
