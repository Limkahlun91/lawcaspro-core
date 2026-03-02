import { auditLog, auditActions } from '../../lib/auditLog'

// Audit Log Integration for MasterDocumentTemplate
export const logDocumentAction = async (action: string, details: any = {}) => {
    await auditLog({
        action,
        table_name: 'cases',
        details,
    })
}

export const logBankDocGenerated = async (type: 'LO' | 'Advice', caseId: string) => {
    await logDocumentAction(
        type === 'LO' ? auditActions.GENERATE_BANK_LO : auditActions.GENERATE_BANK_ADVICE,
        { caseId, type }
    )
}

export const logCoverLetterGenerated = async (caseId: string) => {
    await logDocumentAction(auditActions.GENERATE_COVER_LETTER, { caseId })
}

export const logDocumentExported = async (format: 'word' | 'pdf', caseId: string) => {
    await logDocumentAction(
        format === 'word' ? auditActions.EXPORT_DOCUMENT_WORD : auditActions.EXPORT_DOCUMENT_PDF,
        { caseId, format }
    )
}

export const logWillAudit = async (caseId: string, result: 'valid' | 'invalid', issues?: string[]) => {
    await logDocumentAction(auditActions.AI_AUDIT_WILL, { caseId, result, issues })
}
