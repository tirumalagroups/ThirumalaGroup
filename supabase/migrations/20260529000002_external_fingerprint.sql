-- Alter finance_customers table to add fingerprint fields
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_fingerprint_template TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_fingerprint_image_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_fingerprint_added BOOLEAN DEFAULT FALSE;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS surety_fingerprint_template TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS surety_fingerprint_image_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS surety_fingerprint_added BOOLEAN DEFAULT FALSE;

-- Alter finance_loans table to add fingerprint fields
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS customer_fingerprint_template TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS customer_fingerprint_image_url TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS customer_fingerprint_added BOOLEAN DEFAULT FALSE;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS surety_fingerprint_template TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS surety_fingerprint_image_url TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS surety_fingerprint_added BOOLEAN DEFAULT FALSE;
