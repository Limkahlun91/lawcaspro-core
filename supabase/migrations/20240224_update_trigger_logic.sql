
CREATE OR REPLACE FUNCTION public.set_firm_id_trigger()
RETURNS TRIGGER AS $$
DECLARE
    user_firm_id UUID;
BEGIN
    user_firm_id := public.get_user_firm_id();
    
    IF user_firm_id IS NULL THEN
        RAISE EXCEPTION 'User must be assigned to a firm to perform this action.';
    END IF;

    IF NEW.firm_id IS NULL THEN
        NEW.firm_id := user_firm_id;
    ELSIF NEW.firm_id != user_firm_id THEN
        RAISE EXCEPTION 'User does not belong to the specified firm.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
