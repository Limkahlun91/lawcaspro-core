
-- Function to set firm_id automatically
CREATE OR REPLACE FUNCTION public.set_firm_id_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.firm_id IS NULL THEN
        NEW.firm_id := public.get_user_firm_id();
    END IF;
    
    -- Validate that the user actually belongs to this firm (Double Check)
    IF NEW.firm_id != public.get_user_firm_id() THEN
        RAISE EXCEPTION 'User does not belong to the specified firm.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS set_firm_id_cases ON cases;
CREATE TRIGGER set_firm_id_cases
    BEFORE INSERT ON cases
    FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();

DROP TRIGGER IF EXISTS set_firm_id_finance_logs ON finance_logs;
CREATE TRIGGER set_firm_id_finance_logs
    BEFORE INSERT ON finance_logs
    FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();

DROP TRIGGER IF EXISTS set_firm_id_einvoices ON einvoices;
CREATE TRIGGER set_firm_id_einvoices
    BEFORE INSERT ON einvoices
    FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();

DROP TRIGGER IF EXISTS set_firm_id_gl_entries ON gl_entries;
CREATE TRIGGER set_firm_id_gl_entries
    BEFORE INSERT ON gl_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();
