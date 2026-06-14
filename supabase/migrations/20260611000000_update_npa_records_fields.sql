-- Migration to add total_liability and waived_amount to finance_npa_records
ALTER TABLE finance_npa_records ADD COLUMN IF NOT EXISTS total_liability NUMERIC DEFAULT 0;
ALTER TABLE finance_npa_records ADD COLUMN IF NOT EXISTS waived_amount NUMERIC DEFAULT 0;
