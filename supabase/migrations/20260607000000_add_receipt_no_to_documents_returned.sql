-- Add receipt_no to finance_documents_returned
ALTER TABLE finance_documents_returned ADD COLUMN IF NOT EXISTS receipt_no TEXT;
