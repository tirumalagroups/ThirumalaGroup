-- 1. Extend Customers Table
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS phone2 TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS partner_name TEXT;

-- 2. Extend Loans Table
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS surety_address TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS surety_relation TEXT;

-- 3. Extend Transactions Table
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';

-- 4. Create Documents Table
CREATE TABLE IF NOT EXISTS finance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE finance_documents ENABLE ROW LEVEL SECURITY;

-- 6. Add Authenticated Policy
DROP POLICY IF EXISTS "Allow authenticated full access to finance_documents" ON finance_documents;
CREATE POLICY "Allow authenticated full access to finance_documents"
ON finance_documents FOR ALL TO authenticated
USING (true) WITH CHECK (true);
