/**
 * Case Data Aggregator (Level 3 Architecture)
 * Single Source of Truth for Legal Document Generation
 * 
 * Responsibilities:
 * 1. Fetch data from multiple tables (cases, borrowers, properties, etc.)
 * 2. Normalize data into standard variable keys (UPPERCASE_UNDERSCORE)
 * 3. Handle complex structures (Arrays for future-proofing)
 * 4. Provide consistent formatting (Dates, Currency)
 */

export async function buildCaseData(caseId, supabase) {
    if (!caseId) throw new Error("Case ID is required for Aggregator");

    // 1. Fetch Core Case Data & Relations
    // Note: In a real production system, these might be separate tables.
    // For this demo, we assume some fields are on the 'cases' table directly 
    // or joined via foreign keys.
    // Let's assume a normalized structure where borrowers/properties are related.
    // If they are not yet separated, we map from what we have.
    
    const { data: caseRow, error } = await supabase
        .from('cases')
        .select(`
            *,
            client:client_id (*),
            profiles:lawyer_id (*)
        `)
        .eq('id', caseId)
        .single();

    if (error || !caseRow) throw new Error(`Case Aggregation Failed: ${error?.message || 'Case not found'}`);

    // 2. Mock Relations (Future-proofing)
    // In Level 3, we assume these might come from 'borrowers' table.
    // For now, we map from caseRow if they exist there, or create a structure.
    // Let's assume caseRow has 'borrower_name', 'borrower_ic', 'property_address' columns for now.
    
    // 3. Formatters
    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return "";
        return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleDateString('en-GB'); // DD/MM/YYYY
    };

    // 4. Build Normalized Object (The "Standard")
    const aggregatorOutput = {
        // Standard Variables
        CASE_REF: caseRow.case_number || "",
        FILE_NO: caseRow.file_ref || caseRow.case_number || "", // Alias
        
        // Loan Details
        LOAN_AMOUNT: formatCurrency(caseRow.loan_amount),
        LOAN_AMOUNT_RAW: caseRow.loan_amount || 0, // For calculations if needed
        BANK_NAME: caseRow.bank_name || "",
        
        // Borrower Details (Primary)
        BORROWER_NAME: caseRow.borrower_name || caseRow.client?.full_name || "",
        BORROWER_IC: caseRow.borrower_ic || caseRow.client?.ic_no || "",
        BORROWER_EMAIL: caseRow.borrower_email || caseRow.client?.email || "",
        BORROWER_PHONE: caseRow.borrower_phone || caseRow.client?.phone || "",
        
        // Property Details
        PROPERTY_ADDRESS: caseRow.property_address || "",
        PROPERTY_TITLE_NO: caseRow.title_no || "",
        
        // System Variables
        DATE: formatDate(new Date()),
        GENERATED_BY: "LawCasePro Engine",
        
        // Complex Structures (Arrays for Loops)
        // Even if 1 borrower, return array for templates using {#BORROWERS} logic
        BORROWERS: [
            {
                NAME: caseRow.borrower_name || caseRow.client?.full_name || "",
                IC: caseRow.borrower_ic || caseRow.client?.ic_no || "",
                ADDRESS: caseRow.borrower_address || ""
            }
        ],
        
        PROPERTIES: [
            {
                ADDRESS: caseRow.property_address || "",
                TITLE_NO: caseRow.title_no || ""
            }
        ]
    };

    return aggregatorOutput;
}