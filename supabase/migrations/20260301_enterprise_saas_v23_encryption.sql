-- Migration: Enterprise SaaS Encryption Columns (v23)
-- Description: Adds encrypted columns for sensitive data.

-- 1. Cases Table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_ic_encrypted TEXT;

-- 2. Payment Vouchers Table
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS reference_encrypted TEXT;
