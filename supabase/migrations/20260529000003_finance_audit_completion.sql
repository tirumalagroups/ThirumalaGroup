-- 1. Add father_husband_name columns
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS father_husband_name TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS father_husband_name TEXT;

-- 2. Add loan_category column to finance_loans
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS loan_category TEXT DEFAULT 'Regular';

-- 3. Create finance_fingerprints table
CREATE TABLE IF NOT EXISTS finance_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES finance_customers(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  fingerprint_type text CHECK (fingerprint_type IN ('Customer', 'Surety')) NOT NULL,
  fingerprint_template text NOT NULL,
  fingerprint_image_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS and add policies
ALTER TABLE finance_fingerprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to finance_fingerprints" ON finance_fingerprints;
CREATE POLICY "Allow authenticated full access to finance_fingerprints" ON finance_fingerprints FOR ALL TO authenticated USING (true) WITH CHECK (true);
