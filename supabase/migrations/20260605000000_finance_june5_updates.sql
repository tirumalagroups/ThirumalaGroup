-- Finance Mode Update Migration: 5 June 2026
-- 1. Extend finance_loans
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS penalty_percent NUMERIC DEFAULT 0.75;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS document_charges NUMERIC;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS npa_closed BOOLEAN DEFAULT false;

-- 2. Create finance_npa_records
CREATE TABLE IF NOT EXISTS finance_npa_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES finance_customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  aadhaar text,
  phone text,
  loan_type text,
  loan_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  balance_amount numeric NOT NULL,
  interest_due numeric DEFAULT 0,
  penalty_due numeric DEFAULT 0,
  settlement_amount numeric DEFAULT 0,
  reason text,
  full_history_json jsonb,
  closed_by text,
  closed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3. Create finance_cd_ledger_entries
CREATE TABLE IF NOT EXISTS finance_cd_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES finance_customers(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  account_name text,
  credit numeric DEFAULT 0,
  debit numeric DEFAULT 0,
  receipt_no text,
  particulars text,
  user_name text,
  entry_type text,
  created_at timestamptz DEFAULT now()
);

-- 4. Create finance_cd_interest_details
CREATE TABLE IF NOT EXISTS finance_cd_interest_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES finance_cd_ledger_entries(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  credit numeric DEFAULT 0,
  receipt_no text,
  particulars text,
  renewed_days integer DEFAULT 0,
  renewed_till_date date,
  row_type text,
  created_at timestamptz DEFAULT now()
);

-- 5. Create finance_documents_returned
CREATE TABLE IF NOT EXISTS finance_documents_returned (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  returned_date date NOT NULL,
  returned_to text NOT NULL,
  received_by_signature text,
  remarks text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- 6. Enable RLS
ALTER TABLE finance_npa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_cd_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_cd_interest_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_documents_returned ENABLE ROW LEVEL SECURITY;

-- 7. Add Policies
DROP POLICY IF EXISTS "Allow authenticated full access to finance_npa_records" ON finance_npa_records;
CREATE POLICY "Allow authenticated full access to finance_npa_records" ON finance_npa_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to finance_cd_ledger_entries" ON finance_cd_ledger_entries;
CREATE POLICY "Allow authenticated full access to finance_cd_ledger_entries" ON finance_cd_ledger_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to finance_cd_interest_details" ON finance_cd_interest_details;
CREATE POLICY "Allow authenticated full access to finance_cd_interest_details" ON finance_cd_interest_details FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to finance_documents_returned" ON finance_documents_returned;
CREATE POLICY "Allow authenticated full access to finance_documents_returned" ON finance_documents_returned FOR ALL TO authenticated USING (true) WITH CHECK (true);
