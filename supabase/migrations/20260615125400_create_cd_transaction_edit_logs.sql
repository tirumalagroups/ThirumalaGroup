-- Migration to create CD transaction edit logs table for audit tracking
CREATE TABLE IF NOT EXISTS finance.cd_transaction_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES finance.loans(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL,
  old_data JSONB NOT NULL,
  new_data JSONB NOT NULL,
  edited_by TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE finance.cd_transaction_edit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users read/write access"
  ON finance.cd_transaction_edit_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
