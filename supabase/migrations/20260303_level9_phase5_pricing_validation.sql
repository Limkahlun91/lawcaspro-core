-- LEVEL 9 PHASE 5: Pricing Engine Validation
-- Created at: 2026-03-03
-- Description: Enforce pricing logic integrity.

CREATE OR REPLACE FUNCTION trigger_validate_pricing()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Validate Approved Purchase Price <= SPA Price
    -- Only check if both are present and non-zero
    IF NEW.approved_purchase_price IS NOT NULL AND NEW.spa_price IS NOT NULL AND NEW.spa_price > 0 THEN
        IF NEW.approved_purchase_price > NEW.spa_price THEN
            RAISE EXCEPTION 'Approved Purchase Price (%) cannot be greater than SPA Price (%)', 
                NEW.approved_purchase_price, NEW.spa_price;
        END IF;
    END IF;

    -- 2. Validate APDL Price logic (Optional, usually APDL Price is fixed by developer)
    -- If we had logic like "SPA Price cannot be lower than APDL Price", we would add it here.
    -- But usually developer gives discount.
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_pricing_trigger ON cases;
CREATE TRIGGER validate_pricing_trigger
BEFORE INSERT OR UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION trigger_validate_pricing();
