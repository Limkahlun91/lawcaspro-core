
// src/modules/ai/legal_ai.service.ts

import { supabase } from '../../lib/supabaseClient'

export interface AIAnalysisResult {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
    riskLevel: 'Low' | 'Medium' | 'High';
}

export class LegalAIService {
    private static instance: LegalAIService;
    // Mock Knowledge Base (In production, this would be a vector DB or RAG system)
    private knowledgeBase = {
        will: {
            rules: [
                "Witnesses cannot be beneficiaries.",
                "Two witnesses are required.",
                "Executor cannot be a minor.",
                "Guardian is mandatory if beneficiaries are minors."
            ]
        },
        finance: {
            rules: [
                "EPF is mandatory for 'Salary', 'Bonus', 'Commission'.",
                "Overtime is subject to EPF/SOCSO but check threshold.",
                "Claims/Reimbursements are generally not subject to EPF."
            ]
        }
    };

    private constructor() {}

    public static getInstance(): LegalAIService {
        if (!LegalAIService.instance) {
            LegalAIService.instance = new LegalAIService();
        }
        return LegalAIService.instance;
    }

    // 1. Will Auditor
    public async auditWill(data: any): Promise<AIAnalysisResult> {
        await this.refreshSession(); // Prevent 401
        
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Rule: Witness Conflict
        if (data.beneficiaries && data.witnesses) {
            const beneficiaryNames = data.beneficiaries.map((b: any) => b.name.toLowerCase());
            data.witnesses.forEach((w: any) => {
                if (beneficiaryNames.includes(w.name.toLowerCase())) {
                    issues.push(`Conflict of Interest: Witness '${w.name}' is also a beneficiary.`);
                }
            });
        }

        // Rule: Guardian for Minors
        const hasMinors = data.beneficiaries?.some((b: any) => b.age < 18);
        if (hasMinors && !data.guardian) {
            issues.push("Critical: Minor beneficiaries detected but no Guardian appointed.");
            suggestions.push("Appoint a trusted Guardian for beneficiaries under 18.");
        }

        return {
            isValid: issues.length === 0,
            issues,
            suggestions,
            riskLevel: issues.length > 0 ? 'High' : 'Low'
        };
    }

    // 2. Finance/PV Auditor
    public async auditPV(purpose: string, category: string, amount: number): Promise<AIAnalysisResult> {
        await this.refreshSession();
        
        const issues: string[] = [];
        const suggestions: string[] = [];
        const lowerPurpose = purpose.toLowerCase();

        // Rule: EPF Compliance
        if (category === 'Office Expense' || category === 'Staff Cost') {
            if (lowerPurpose.includes('salary') || lowerPurpose.includes('bonus')) {
                // Check if EPF mentioned? This is a simple keyword check.
                // In real AI, we would parse the slip or check the breakdown.
                suggestions.push("Ensure EPF/SOCSO calculations are included for this payroll item.");
            }
            
            if (lowerPurpose.includes('overtime') && !lowerPurpose.includes('epf')) {
                 issues.push("Warning: Overtime usually attracts EPF. Please verify statutory deductions.");
            }
        }

        // Rule: High Value Flag
        if (amount > 5000 && category === 'Petty Cash') {
            issues.push("High Risk: Petty Cash payout exceeds RM 5,000 limit.");
            suggestions.push("Use Bank Transfer for amounts > RM 500.");
        }

        return {
            isValid: issues.length === 0,
            issues,
            suggestions,
            riskLevel: issues.length > 0 ? 'Medium' : 'Low'
        };
    }

    // 3. Tax Exemption Logic (Above Ace)
    public checkTaxExempt(item: string): { isExempt: boolean; limit: number; note: string } {
        const lowerItem = item.toLowerCase();
        
        // Rules based on Above Ace / ANC
        if (lowerItem.includes('petrol') || lowerItem.includes('fuel')) {
            return { isExempt: true, limit: 6000, note: 'Tax Exempt up to RM 6,000 per year' };
        }
        if (lowerItem.includes('toll') || lowerItem.includes('parking')) {
            return { isExempt: true, limit: 6000, note: 'Tax Exempt up to RM 6,000 per year (Combined with Petrol)' };
        }
        if (lowerItem.includes('phone') || lowerItem.includes('mobile') || lowerItem.includes('internet')) {
            return { isExempt: true, limit: 5000, note: 'Tax Exempt for smartphone/bill up to RM 5,000' };
        }
        if (lowerItem.includes('child care') || lowerItem.includes('nursery')) {
            return { isExempt: true, limit: 3000, note: 'Tax Exempt up to RM 3,000' };
        }

        return { isExempt: false, limit: 0, note: '' };
    }

    // Helper: Refresh Supabase Session
    private async refreshSession() {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
            console.warn("AI Service: Session expired or invalid. Attempting refresh...");
            // In a real app, we might trigger a re-login flow or token refresh
            // supabase.auth.refreshSession() is handled automatically by the client usually,
            // but checking here ensures we don't fire requests if offline.
        }
    }
}

export const legalAI = LegalAIService.getInstance();
