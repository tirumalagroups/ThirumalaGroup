-- ================================================================
-- PATCH v2: Add book_id and finance_mode columns to
--            finance.transaction_reviews (no FK constraint - safe)
--
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire script and click Run
-- ================================================================

-- Step 1: Add book_id as a plain UUID (no FK constraint to avoid schema issues)
ALTER TABLE finance.transaction_reviews
  ADD COLUMN IF NOT EXISTS book_id UUID;

-- Step 2: Add finance_mode as nullable text first (we backfill before making NOT NULL)
ALTER TABLE finance.transaction_reviews
  ADD COLUMN IF NOT EXISTS finance_mode TEXT;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_finance_mode
  ON finance.transaction_reviews(finance_mode);

CREATE INDEX IF NOT EXISTS idx_transaction_reviews_book_id
  ON finance.transaction_reviews(book_id);

-- Step 4: Backfill finance_mode for existing rows using book_id
--         The ITR book UUID is 82788397-972b-4c2f-953f-2549c8652daf
UPDATE finance.transaction_reviews SET
  finance_mode = CASE
    WHEN book_id = '82788397-972b-4c2f-953f-2549c8652daf' THEN 'ITR'
    ELSE 'REGULAR'
  END
WHERE finance_mode IS NULL;

-- Step 5: Default remaining NULL rows (no book_id) to REGULAR
UPDATE finance.transaction_reviews
  SET finance_mode = 'REGULAR'
WHERE finance_mode IS NULL;

-- Step 6: Backfill book_id from linked loans for loan-payment rows
UPDATE finance.transaction_reviews tr
SET book_id = l.book_id
FROM finance.loans l
WHERE tr.loan_id = l.id
  AND tr.book_id IS NULL;

-- Step 7: Now make finance_mode NOT NULL (all rows backfilled above)
ALTER TABLE finance.transaction_reviews
  ALTER COLUMN finance_mode SET NOT NULL;

-- Step 8: Add check constraint for finance_mode values
ALTER TABLE finance.transaction_reviews
  DROP CONSTRAINT IF EXISTS transaction_reviews_finance_mode_check;

ALTER TABLE finance.transaction_reviews
  ADD CONSTRAINT transaction_reviews_finance_mode_check
  CHECK (finance_mode IN ('REGULAR', 'ITR'));

-- Step 9: Backfill historical loan collection payments not yet in reviews table
INSERT INTO finance.transaction_reviews (
  book_id, finance_mode, source_type, source_id, loan_id,
  receipt_number, transaction_type, transaction_date, amount,
  penalty_amount, interest_amount, principal_amount,
  entered_by, entered_at, review_status, approved_by, approved_at
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
  CASE
    WHEN l.loan_category = 'CD' THEN COALESCE((
      SELECT SUM(credit) FROM finance.cd_ledger_entries
      WHERE receipt_no = tx.receipt_no AND account_name = 'CD Penalty'
    ), 0)
    ELSE 0
  END as penalty_amount,
  CASE
    WHEN l.loan_category = 'CD' THEN COALESCE((
      SELECT SUM(credit) FROM finance.cd_ledger_entries
      WHERE receipt_no = tx.receipt_no AND account_name = 'CD Interest'
    ), 0)
    ELSE 0
  END as interest_amount,
  CASE
    WHEN l.loan_category = 'CD' THEN COALESCE((
      SELECT SUM(credit) FROM finance.cd_ledger_entries
      WHERE receipt_no = tx.receipt_no AND account_name = 'CD Amount Paid'
    ), 0)
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

-- Step 10: Backfill manual Day Book entries
INSERT INTO finance.transaction_reviews (
  book_id, finance_mode, source_type, source_id, loan_id,
  receipt_number, transaction_type, transaction_date, amount,
  penalty_amount, interest_amount, principal_amount,
  entered_by, entered_at, review_status, approved_by, approved_at
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
  0, 0, 0,
  COALESCE(cb.created_by, 'System'),
  cb.created_at,
  'APPROVED' as review_status,
  'SYSTEM_MIGRATION' as approved_by,
  cb.created_at as approved_at
FROM finance.cashbook_entries cb
WHERE cb.account_number IS NULL
   OR cb.account_number = ''
   OR cb.account_number NOT IN (SELECT loan_id FROM finance.loans)
ON CONFLICT (source_id) DO NOTHING;

-- Verify result:
-- SELECT finance_mode, review_status, COUNT(*)
-- FROM finance.transaction_reviews
-- GROUP BY finance_mode, review_status
-- ORDER BY finance_mode, review_status;
