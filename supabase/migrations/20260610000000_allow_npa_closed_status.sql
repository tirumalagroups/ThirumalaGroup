-- Migration to allow NPA_CLOSED status on finance loans
ALTER TABLE finance_loans DROP CONSTRAINT IF EXISTS finance_loans_status_check;
ALTER TABLE finance_loans ADD CONSTRAINT finance_loans_status_check CHECK (status IN ('Active', 'Closed', 'NPA_CLOSED'));
