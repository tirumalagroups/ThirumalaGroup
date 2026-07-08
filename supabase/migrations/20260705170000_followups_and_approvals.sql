-- Migration to add approvals to cashbook entries and create loan payment followups table

-- Alter cashbook_entries table
ALTER TABLE finance.cashbook_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE finance.cashbook_entries ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE finance.cashbook_entries ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE finance.cashbook_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create followups table
CREATE TABLE IF NOT EXISTS finance.loan_payment_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES finance.loans(id) ON DELETE CASCADE,
  follow_up_date DATE NOT NULL,
  followed_up_at TIMESTAMPTZ DEFAULT NOW(),
  followed_up_by TEXT NOT NULL,
  contacted_person TEXT NOT NULL,
  result TEXT NOT NULL,
  narration TEXT NOT NULL,
  next_follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loan_payment_followups_loan_id ON finance.loan_payment_followups(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payment_followups_next_follow_up_date ON finance.loan_payment_followups(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_loan_payment_followups_followed_up_by ON finance.loan_payment_followups(followed_up_by);
CREATE INDEX IF NOT EXISTS idx_loan_payment_followups_follow_up_date ON finance.loan_payment_followups(follow_up_date);

-- Disable Row Level Security consistent with local model proxy bypass pattern
ALTER TABLE finance.loan_payment_followups DISABLE ROW LEVEL SECURITY;
