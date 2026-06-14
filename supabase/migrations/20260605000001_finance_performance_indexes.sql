-- Enable pg_trgm for advanced text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes for finance_customers
CREATE INDEX IF NOT EXISTS idx_finance_customers_name ON finance_customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_finance_customers_aadhaar ON finance_customers (aadhaar);
CREATE INDEX IF NOT EXISTS idx_finance_customers_phone1 ON finance_customers (phone_1);
CREATE INDEX IF NOT EXISTS idx_finance_customers_phone2 ON finance_customers (phone_2);

-- Indexes for finance_guarantors
CREATE INDEX IF NOT EXISTS idx_finance_guarantors_name_trgm
ON finance_guarantors USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_finance_guarantors_aadhaar
ON finance_guarantors (aadhaar);

CREATE INDEX IF NOT EXISTS idx_finance_guarantors_phone
ON finance_guarantors (phone);

CREATE INDEX IF NOT EXISTS idx_finance_guarantors_guarantor_id
ON finance_guarantors (guarantor_id);

-- Indexes for finance_loans
CREATE INDEX IF NOT EXISTS idx_finance_loans_loan_number ON finance_loans (loan_id);
CREATE INDEX IF NOT EXISTS idx_finance_loans_status ON finance_loans (status);
