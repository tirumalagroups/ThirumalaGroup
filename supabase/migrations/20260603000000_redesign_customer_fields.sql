-- Redesign finance_customers fields
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_id SERIAL;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS village TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS mandal TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS aadhaar_address TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS present_address TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS phone_1 TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS phone_2 TEXT;
