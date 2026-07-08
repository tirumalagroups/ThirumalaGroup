-- Add lending parity columns to finance.loans to support STBD, HP, and TBD loan accounts
ALTER TABLE finance.loans ADD COLUMN IF NOT EXISTS balance_with_interest numeric(15,2) DEFAULT 0;
ALTER TABLE finance.loans ADD COLUMN IF NOT EXISTS balance_without_interest numeric(15,2) DEFAULT 0;
ALTER TABLE finance.loans ADD COLUMN IF NOT EXISTS installments_paid integer DEFAULT 0;
ALTER TABLE finance.loans ADD COLUMN IF NOT EXISTS installments_due integer DEFAULT 0;
ALTER TABLE finance.loans ADD COLUMN IF NOT EXISTS dc_status text DEFAULT 'Active';
ALTER TABLE finance.loans ADD COLUMN IF NOT EXISTS grace_days integer;

-- Update existing records to default values
UPDATE finance.loans SET balance_with_interest = amount WHERE balance_with_interest IS NULL;
UPDATE finance.loans SET balance_without_interest = amount WHERE balance_without_interest IS NULL;
UPDATE finance.loans SET installments_paid = 0 WHERE installments_paid IS NULL;
UPDATE finance.loans SET installments_due = duration_months WHERE installments_due IS NULL;
UPDATE finance.loans SET dc_status = 'Active' WHERE dc_status IS NULL;
