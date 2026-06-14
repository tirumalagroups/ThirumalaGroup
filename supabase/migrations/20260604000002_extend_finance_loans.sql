-- Add surety address columns to finance_loans if they don't exist
ALTER TABLE finance_loans
ADD COLUMN IF NOT EXISTS surety_aadhaar_address text,
ADD COLUMN IF NOT EXISTS surety_present_address text;
