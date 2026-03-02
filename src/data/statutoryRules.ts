
// Statutory Rules Configuration
// Based on User Provided Rules

export type StatutoryRule = {
    paymentType: string;
    epf: boolean;
    socso: boolean;
    eis: boolean;
    pcb: boolean; // Taxable
    hrdf: boolean; // 1%
    note?: string;
}

export const statutoryRules: StatutoryRule[] = [
    // 1. Basic Salary
    { paymentType: 'Basic Salary', epf: true, socso: true, eis: true, pcb: true, hrdf: true },
    
    // 2. Allowances
    { paymentType: 'Fixed Allowance', epf: true, socso: true, eis: true, pcb: true, hrdf: true, note: 'HRDF 1% applies' },
    { paymentType: 'Traveling Allowance', epf: false, socso: false, eis: false, pcb: false, hrdf: false, note: 'Exempt if for official duty' }, // General rule, user didn't specify, assuming standard exemption for simplicity or user can check
    { paymentType: 'Food Allowance', epf: true, socso: true, eis: true, pcb: true, hrdf: true },

    // 3. Bonus & Incentives
    { paymentType: 'Bonus', epf: true, socso: false, eis: false, pcb: true, hrdf: true, note: 'User Rule: No SOCSO/EIS' },
    { paymentType: 'Commission', epf: true, socso: true, eis: true, pcb: true, hrdf: true },
    { paymentType: 'Incentive', epf: true, socso: true, eis: true, pcb: true, hrdf: true },
    
    // 4. Overtime & Others
    { paymentType: 'Overtime', epf: false, socso: true, eis: true, pcb: true, hrdf: false, note: 'User Rule: SOCSO/EIS Yes, EPF No' },
    { paymentType: 'Gratuity', epf: false, socso: true, eis: true, pcb: true, hrdf: false, note: 'User Rule: SOCSO/EIS Yes' },
    { paymentType: 'Director Fee', epf: true, socso: false, eis: false, pcb: true, hrdf: false, note: 'User Rule: No SOCSO/EIS' },
];

export const checkStatutory = (paymentName: string): StatutoryRule | undefined => {
    // Simple partial match
    return statutoryRules.find(r => paymentName.toLowerCase().includes(r.paymentType.toLowerCase()));
}
