-- Safe migration to add new columns for Guarantor details everywhere
ALTER TABLE finance_guarantors
ADD COLUMN IF NOT EXISTS village text,
ADD COLUMN IF NOT EXISTS mandal text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS permanent_address text,
ADD COLUMN IF NOT EXISTS current_address text;
