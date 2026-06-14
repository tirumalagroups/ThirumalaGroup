-- Add explicit schema extension to finance_guarantors to support complete module
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS phone_2 text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS father_name text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS village text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS mandal text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS permanent_address text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS current_address text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS fingerprint_status text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS fingerprint_id text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE finance_guarantors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
