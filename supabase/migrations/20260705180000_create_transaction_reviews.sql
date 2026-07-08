-- Overwrite and recreate finance_transaction_reviews table with book and mode isolation
DROP TABLE IF EXISTS finance.transaction_reviews CASCADE;

CREATE TABLE finance.transaction_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  finance_mode TEXT CHECK (finance_mode IN ('REGULAR', 'ITR')) NOT NULL,
  source_type TEXT NOT NULL, -- 'Loan Payment' or 'Day Book Entry'
  source_id UUID NOT NULL UNIQUE,
  loan_id UUID REFERENCES finance.loans(id) ON DELETE CASCADE,
  receipt_number TEXT,
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  penalty_amount DECIMAL(15,2) DEFAULT 0,
  interest_amount DECIMAL(15,2) DEFAULT 0,
  principal_amount DECIMAL(15,2) DEFAULT 0,
  entered_by TEXT NOT NULL,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  review_status TEXT CHECK (review_status IN ('PENDING', 'APPROVED')) DEFAULT 'PENDING',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching, sorting and isolation
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_finance_mode ON finance.transaction_reviews(finance_mode);
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_review_status ON finance.transaction_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_source_id ON finance.transaction_reviews(source_id);
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_transaction_date ON finance.transaction_reviews(transaction_date);

-- Disable Row Level Security consistent with local model proxy bypass pattern
ALTER TABLE finance.transaction_reviews DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- HISTORICAL BACKFILL (Idempotent)
-- ----------------------------------------------------

-- 1. Backfill Loan Collection Payments
INSERT INTO finance.transaction_reviews (
  book_id,
  finance_mode,
  source_type,
  source_id,
  loan_id,
  receipt_number,
  transaction_type,
  transaction_date,
  amount,
  penalty_amount,
  interest_amount,
  principal_amount,
  entered_by,
  entered_at,
  review_status,
  approved_by,
  approved_at
)
SELECT 
  l.book_id,
  CASE 
    WHEN l.book_id = '82788397-972b-4c2f-953f-2549c8652daf' THEN 'ITR'
    ELSE 'REGULAR'
  END as finance_mode,
  'Loan Payment' as source_type,
  tx.id as source_id,
  tx.loan_id,
  tx.receipt_no,
  CASE 
    WHEN l.loan_category = 'CD' THEN 'CD Collection'
    WHEN l.loan_category = 'HP' THEN 'HP Payment'
    WHEN l.loan_category = 'STBD' THEN 'STBD Payment'
    WHEN l.loan_category = 'TBD' THEN 'TBD Payment'
    ELSE l.loan_category || ' Payment'
  END as transaction_type,
  tx.date::DATE,
  tx.amount,
  -- Best-effort CD split resolving
  CASE 
    WHEN l.loan_category = 'CD' THEN COALESCE((SELECT SUM(credit) FROM finance.cd_ledger_entries WHERE receipt_no = tx.receipt_no AND account_name = 'CD Penalty'), 0)
    ELSE 0
  END as penalty_amount,
  CASE 
    WHEN l.loan_category = 'CD' THEN COALESCE((SELECT SUM(credit) FROM finance.cd_ledger_entries WHERE receipt_no = tx.receipt_no AND account_name = 'CD Interest'), 0)
    ELSE 0
  END as interest_amount,
  CASE 
    WHEN l.loan_category = 'CD' THEN COALESCE((SELECT SUM(credit) FROM finance.cd_ledger_entries WHERE receipt_no = tx.receipt_no AND account_name = 'CD Amount Paid'), 0)
    ELSE tx.amount
  END as principal_amount,
  COALESCE(tx.collected_by, 'System'),
  tx.created_at,
  'APPROVED' as review_status,
  'SYSTEM_MIGRATION' as approved_by,
  tx.created_at as approved_at
FROM finance.loan_transactions tx
JOIN finance.loans l ON l.id = tx.loan_id
WHERE tx.type = 'Collection'
ON CONFLICT (source_id) DO NOTHING;

-- 2. Backfill Manual Day Book Entries (Non-loan cashbook entries)
INSERT INTO finance.transaction_reviews (
  book_id,
  finance_mode,
  source_type,
  source_id,
  loan_id,
  receipt_number,
  transaction_type,
  transaction_date,
  amount,
  penalty_amount,
  interest_amount,
  principal_amount,
  entered_by,
  entered_at,
  review_status,
  approved_by,
  approved_at
)
SELECT 
  cb.book_id,
  CASE 
    WHEN cb.book_id = '82788397-972b-4c2f-953f-2549c8652daf' THEN 'ITR'
    ELSE 'REGULAR'
  END as finance_mode,
  'Day Book Entry' as source_type,
  cb.id as source_id,
  NULL as loan_id,
  cb.account_number as receipt_number,
  'Day Book Entry' as transaction_type,
  cb.entry_date::DATE,
  (COALESCE(cb.credit, 0) + COALESCE(cb.debit, 0)) as amount,
  0 as penalty_amount,
  0 as interest_amount,
  0 as principal_amount,
  COALESCE(cb.created_by, 'System'),
  cb.created_at,
  'APPROVED' as review_status,
  'SYSTEM_MIGRATION' as approved_by,
  cb.created_at as approved_at
FROM finance.cashbook_entries cb
WHERE cb.account_number IS NULL OR cb.account_number = '' OR cb.account_number NOT IN (SELECT loan_id FROM finance.loans)
ON CONFLICT (source_id) DO NOTHING;
