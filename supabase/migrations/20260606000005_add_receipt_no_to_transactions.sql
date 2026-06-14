-- Add receipt_no to finance_transactions (Daybook)
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS receipt_no TEXT;
