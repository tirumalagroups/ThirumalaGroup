-- Migration to add period_days column to finance_loans table
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS period_days INTEGER;
