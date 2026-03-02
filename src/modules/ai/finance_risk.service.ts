import { supabase } from '../../lib/supabaseClient';

export class AiRiskService {
  
  /**
   * Run Risk Analysis on a Payment Voucher
   * Called automatically when a PV is created or updated.
   */
  async analyzeRisk(pvId: string, firmId: string) {
    // 1. Fetch PV Data with History
    const { data: pv } = await supabase
      .from('payment_vouchers')
      .select('*')
      .eq('id', pvId)
      .single();

    if (!pv) return;

    const risks: { type: string, score: number, desc: string }[] = [];

    // --- Rule 1: High Amount Check ---
    if (pv.total_amount > 10000) {
      risks.push({
        type: 'high_amount',
        score: 50,
        desc: `Amount RM${pv.total_amount} exceeds standard threshold`
      });
    }

    // --- Rule 2: Round Number Check (Fraud indicator) ---
    if (pv.total_amount % 1000 === 0 && pv.total_amount > 0) {
      risks.push({
        type: 'round_number',
        score: 30,
        desc: 'Round number amount detected (often suspicious)'
      });
    }

    // --- Rule 3: Duplicate Payee Check (Simulated) ---
    // In real app, query past PVs for same payee/amount in last 24h
    
    // Save Risks
    if (risks.length > 0) {
      const inserts = risks.map(r => ({
        firm_id: firmId,
        target_type: 'payment_voucher',
        target_id: pvId,
        flag_type: r.type,
        risk_score: r.score,
        description: r.desc,
        status: 'pending'
      }));

      await supabase.from('ai_finance_flags').insert(inserts);
    }
  }
}

export const aiRiskService = new AiRiskService();
