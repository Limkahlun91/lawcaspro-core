
ALTER TABLE payment_vouchers 
ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE payment_vouchers 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'advance';
