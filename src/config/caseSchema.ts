
// src/config/caseSchema.ts

export type TabType = 
    'basic' | 'property' | 'spa' | 'spa_status' | 'spa_fees' | 
    'loan' | 'loan_status' | 'loan_fees' | 'property_extended' | 'company' | 
    'vendor' | 'doc_activities' | 'progress' | 'timeline' | 'documents' | 
    'invoices' | 'vpla' | 'eckht' | 'efspo' | 'e_duti_setem';

export interface FieldConfig {
    key: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'email' | 'tel' | 'checkbox';
    options?: string[];
    required?: boolean;
    hasPrinter?: boolean;
    autoSum?: boolean;
    placeholder?: string;
    colSpan?: number; // 1 or 2 (default 1)
}

export interface TabConfig {
    id: TabType;
    label: string;
    fields: FieldConfig[];
}

export const caseSchema: TabConfig[] = [
    {
        id: 'basic',
        label: 'Basic Info',
        fields: [
            { key: 'file_ref', label: 'File Ref No', type: 'text', required: true },
            { key: 'assigned_staff', label: 'Assigned Team (Staff)', type: 'text', required: true },
            { key: 'project_id', label: 'Project', type: 'select', required: true, options: [] }, 
            { key: 'unit_no', label: 'Unit No', type: 'text', required: true },
            { key: 'spa_price', label: 'SPA Price (RM)', type: 'number', required: true },
            { key: 'purchaser_name', label: 'Purchaser 1 Name', type: 'text', required: true, colSpan: 2 },
            { key: 'ic_no', label: 'Purchaser 1 IC', type: 'text', required: true },
            { key: 'contact_no', label: 'Contact No', type: 'tel' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'tin_no', label: 'TIN No', type: 'text' },
            { key: 'purchaser_2_name', label: 'Purchaser 2 Name', type: 'text', colSpan: 2 },
            { key: 'purchaser_2_ic', label: 'Purchaser 2 IC', type: 'text' },
            { key: 'purchaser_2_contact', label: 'Purchaser 2 Contact', type: 'tel' },
            { key: 'purchaser_2_email', label: 'Purchaser 2 Email', type: 'email' },
            { key: 'correspondence_address', label: 'Correspondence Address', type: 'textarea', colSpan: 2 },
            { key: 'remarks_basic', label: 'Remarks', type: 'textarea', colSpan: 2 }
        ]
    },
    {
        id: 'property',
        label: 'Property Details',
        fields: [
            { key: 'property_address', label: 'Property Address', type: 'textarea', colSpan: 2 },
            { key: 'title_no', label: 'Title No', type: 'text' },
            { key: 'lot_no', label: 'Lot No', type: 'text' },
            { key: 'mukim', label: 'Mukim', type: 'text' },
            { key: 'daerah', label: 'Daerah', type: 'text' },
            { key: 'negeri', label: 'Negeri', type: 'text' },
            { key: 'area', label: 'Area (sq ft)', type: 'number' },
            { key: 'property_type', label: 'Property Type', type: 'select', options: ['Residential', 'Commercial', 'Industrial', 'Land'] },
            { key: 'developer_parcel_no', label: 'Developer Parcel No', type: 'text' },
            { key: 'accessory_parcel_no', label: 'Accessory Parcel No', type: 'text' },
            { key: 'share_units', label: 'Share Units', type: 'text' },
            { key: 'quit_rent', label: 'Quit Rent', type: 'number' },
            { key: 'assessment', label: 'Assessment', type: 'number' }
        ]
    },
    {
        id: 'spa',
        label: 'SPA Details',
        fields: [
            { key: 'spa_date', label: 'SPA Date', type: 'date', required: true },
            { key: 'spa_stamping_date', label: 'SPA Stamping Date', type: 'date' },
            { key: 'completion_date', label: 'Completion Date', type: 'date' },
            { key: 'extended_completion_date', label: 'Extended Completion Date', type: 'date' },
            { key: 'actual_vp_date', label: 'Actual VP Date', type: 'date' },
            { key: 'defect_liability_period', label: 'Defect Liability Period (Months)', type: 'number' },
            { key: 'purchase_type', label: 'Purchase Type', type: 'select', options: ['Cash', 'Loan'] },
            { key: 'solicitor_ref', label: 'Solicitor Ref', type: 'text' }
        ]
    },
    {
        id: 'spa_status',
        label: 'SPA Status',
        fields: [
            { key: 'spa_signed_date', label: 'SPA Signed Date', type: 'date', hasPrinter: true },
            { key: 'stamping_date', label: 'Stamping Date', type: 'date', hasPrinter: true },
            { key: 'ckht_form_submitted', label: 'CKHT Form Submitted', type: 'date', hasPrinter: true },
            { key: 'mot_submitted', label: 'MOT Submitted', type: 'date', hasPrinter: true },
            { key: 'mot_registered', label: 'MOT Registered', type: 'date' },
            { key: 'title_received', label: 'Title Received', type: 'date' }
        ]
    },
    {
        id: 'spa_fees',
        label: 'SPA Legal Fees',
        fields: [
            { key: 'spa_legal_fee', label: 'Professional Legal Fee', type: 'number', autoSum: true },
            { key: 'spa_disbursement', label: 'Disbursements', type: 'number', autoSum: true },
            { key: 'spa_sst', label: 'SST (8%)', type: 'number', autoSum: true },
            { key: 'spa_stamp_duty', label: 'Stamp Duty', type: 'number', autoSum: true },
            { key: 'spa_misc', label: 'Miscellaneous', type: 'number', autoSum: true }
        ]
    },
    {
        id: 'loan',
        label: 'Loan Details',
        fields: [
            { key: 'bank_name', label: 'Bank Name', type: 'text' },
            { key: 'bank_branch', label: 'Bank Branch', type: 'text' },
            { key: 'loan_amount', label: 'Loan Amount (RM)', type: 'number' },
            { key: 'loan_ref_no', label: 'Loan Ref No', type: 'text' },
            { key: 'mrta_amount', label: 'MRTA Amount', type: 'number' },
            { key: 'mrta_financier', label: 'MRTA Financier', type: 'text' }
        ]
    },
    {
        id: 'loan_status',
        label: 'Loan Status',
        fields: [
            { key: 'lo_date', label: 'LO Date', type: 'date', hasPrinter: true },
            { key: 'acting_letter_dated', label: 'Acting Letter Dated', type: 'date', hasPrinter: true },
            { key: 'bank_execution_dated', label: 'Bank Execution Dated', type: 'date', hasPrinter: true },
            { key: 'bank_lu_dated', label: "Bank's LU Dated", type: 'date', hasPrinter: true },
            { key: 'dev_lu_dated', label: 'Dev. LU Dated', type: 'date', hasPrinter: true },
            { key: 'disclaimer_letter_dated', label: 'Disclaimer Letter Dated', type: 'date', hasPrinter: true },
            { key: 'bankruptcy_search_dated', label: 'Bankruptcy Search Dated', type: 'date', hasPrinter: true },
            { key: 'statutory_declaration_dated', label: 'Statutory Declaration Dated', type: 'date', hasPrinter: true },
            { key: 'statutory_declaration_stamped_on', label: 'Statutory Declaration Stamped ON', type: 'date', hasPrinter: true },
            { key: 'fa_date', label: 'FA Date', type: 'date', hasPrinter: true },
            { key: 'fa_stamp_on', label: 'FA Stamp ON', type: 'date', hasPrinter: true },
            { key: 'noa_dated', label: 'NOA Dated', type: 'date', hasPrinter: true },
            { key: 'loan_agreement_signed', label: 'Loan Agreement Signed', type: 'date', hasPrinter: true },
            { key: 'pa_signed', label: 'PA Signed', type: 'date', hasPrinter: true },
            { key: 'advice_for_drawdown', label: 'Advice for Drawdown', type: 'date', hasPrinter: true },
            { key: 'first_drawdown_date', label: 'First Drawdown Date', type: 'date' },
            { key: 'final_drawdown_date', label: 'Final Drawdown Date', type: 'date' }
        ]
    },
    {
        id: 'loan_fees',
        label: 'Loan Legal Fees',
        fields: [
            { key: 'loan_legal_fee', label: 'Professional Legal Fee', type: 'number', autoSum: true },
            { key: 'loan_disbursement', label: 'Disbursements', type: 'number', autoSum: true },
            { key: 'loan_sst', label: 'SST (8%)', type: 'number', autoSum: true },
            { key: 'loan_stamp_duty', label: 'Stamp Duty', type: 'number', autoSum: true },
            { key: 'loan_valuation_fee', label: 'Valuation Fee', type: 'number', autoSum: true }
        ]
    },
    {
        id: 'property_extended',
        label: 'Property Details (Extended)',
        fields: [
            { key: 'restriction_in_interest', label: 'Restriction in Interest', type: 'textarea', colSpan: 2 },
            { key: 'express_condition', label: 'Express Condition', type: 'textarea', colSpan: 2 },
            { key: 'encumbrances', label: 'Encumbrances', type: 'text' },
            { key: 'category_of_land_use', label: 'Category of Land Use', type: 'text' }
        ]
    },
    {
        id: 'company',
        label: 'Company Details',
        fields: [
            { key: 'company_name', label: 'Company Name', type: 'text', colSpan: 2 },
            { key: 'company_reg_no', label: 'Company Reg No', type: 'text' },
            { key: 'company_address', label: 'Registered Address', type: 'textarea', colSpan: 2 },
            { key: 'director_names', label: 'Directors', type: 'textarea', colSpan: 2 }
        ]
    },
    {
        id: 'vendor',
        label: 'Vendor Details',
        fields: [
            { key: 'vendor_name', label: 'Vendor Name', type: 'text', colSpan: 2 },
            { key: 'vendor_ic', label: 'Vendor IC / Reg No', type: 'text' },
            { key: 'vendor_address', label: 'Vendor Address', type: 'textarea', colSpan: 2 },
            { key: 'vendor_solicitor', label: 'Vendor Solicitor', type: 'text' },
            { key: 'vendor_solicitor_ref', label: 'Vendor Solicitor Ref', type: 'text' }
        ]
    },
    {
        id: 'doc_activities',
        label: 'Document Activities',
        fields: [
            { key: 'doc_sent_to_client', label: 'Sent to Client', type: 'date' },
            { key: 'doc_returned_by_client', label: 'Returned by Client', type: 'date' },
            { key: 'doc_sent_to_bank', label: 'Sent to Bank', type: 'date' },
            { key: 'doc_returned_by_bank', label: 'Returned by Bank', type: 'date' }
        ]
    },
    {
        id: 'progress',
        label: 'Progress Tracker',
        fields: [
            { key: 'current_stage', label: 'Current Stage', type: 'select', options: ['Open', 'SPA Signed', 'Loan Approved', 'Drawdown', 'Completed', 'Aborted'] },
            { key: 'pending_action', label: 'Pending Action', type: 'text', colSpan: 2 },
            { key: 'last_updated', label: 'Last Updated', type: 'date' }
        ]
    },
    {
        id: 'timeline',
        label: 'Timeline',
        fields: [
            { key: 'timeline_start_date', label: 'Start Date', type: 'date' },
            { key: 'timeline_target_completion', label: 'Target Completion', type: 'date' },
            { key: 'timeline_actual_completion', label: 'Actual Completion', type: 'date' }
        ]
    },
    {
        id: 'documents',
        label: 'Documents',
        fields: [
            { key: 'uploaded_docs_count', label: 'Uploaded Documents', type: 'number' },
            { key: 'missing_docs', label: 'Missing Documents', type: 'textarea', colSpan: 2 }
        ]
    },
    {
        id: 'invoices',
        label: 'Invoices',
        fields: [
            { key: 'inv_no', label: 'Invoice No', type: 'text' },
            { key: 'inv_date', label: 'Invoice Date', type: 'date' },
            { key: 'inv_amount', label: 'Invoice Amount', type: 'number' }
        ]
    },
    {
        id: 'vpla',
        label: 'VPLA Details',
        fields: [
            { key: 'vpla_dated', label: 'VPLA Dated', type: 'date', hasPrinter: true },
            { key: 'vpla_d_dated', label: 'VPLA D Dated', type: 'date', hasPrinter: true }
        ]
    },
    {
        id: 'eckht',
        label: 'ECKHT',
        fields: [
            { key: 'eckht_dated', label: 'ECKHT Dated', type: 'date', hasPrinter: true },
            { key: 'eckht_withdrawal_dated', label: 'ECKHT Withdrawal Dated', type: 'date', hasPrinter: true }
        ]
    },
    {
        id: 'efspo',
        label: 'EFSPO A',
        fields: [
            { key: 'efspo_a_dated', label: 'EFSPO A Dated', type: 'date', hasPrinter: true }
        ]
    },
    {
        id: 'e_duti_setem',
        label: 'E-Duti Setem',
        fields: [
            { key: 'e_duti_setem_dated', label: 'E-Duti Setem Dated', type: 'date', hasPrinter: true }
        ]
    }
];
