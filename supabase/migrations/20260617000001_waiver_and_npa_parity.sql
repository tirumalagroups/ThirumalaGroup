-- Migration to create loan waiver audits table in finance schema
CREATE TABLE IF NOT EXISTS finance.loan_waiver_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES finance.loans(id) ON DELETE CASCADE,
  waived_date DATE NOT NULL DEFAULT CURRENT_DATE,
  waived_by TEXT NOT NULL,
  waiver_reason TEXT,
  waived_interest NUMERIC(15,2) DEFAULT 0,
  waived_penalty NUMERIC(15,2) DEFAULT 0,
  waived_commission NUMERIC(15,2) DEFAULT 0,
  receipt_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE finance.loan_waiver_audits ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users read/write access to loan_waiver_audits"
  ON finance.loan_waiver_audits
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
