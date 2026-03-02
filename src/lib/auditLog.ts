import { supabase } from '../lib/supabaseClient'

export const auditLog = async (params: {
    action: string,
    table_name?: string,
    record_id?: string,
    details?: any,
}) => {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('firm_id')
            .eq('id', user.id)
            .single()

        if (!profile?.firm_id) return

        await supabase.from('audit_logs').insert({
            action: params.action,
            table_name: params.table_name,
            record_id: params.record_id,
            details: params.details || {},
            user_id: user.id,
            firm_id: profile.firm_id,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        console.error('Audit Log Error:', err)
    }
}

export const auditActions = {
    GENERATE_BANK_LO: 'generate_bank_lo',
    GENERATE_BANK_ADVICE: 'generate_bank_advice',
    GENERATE_COVER_LETTER: 'generate_cover_letter',
    EXPORT_DOCUMENT_WORD: 'export_document_word',
    EXPORT_DOCUMENT_PDF: 'export_document_pdf',
    AI_AUDIT_WILL: 'ai_audit_will',
} as const
