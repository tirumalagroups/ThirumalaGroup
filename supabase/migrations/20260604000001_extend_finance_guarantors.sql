-- Add new address fields to finance_guarantors table
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS aadhaar_address text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS present_address text;
