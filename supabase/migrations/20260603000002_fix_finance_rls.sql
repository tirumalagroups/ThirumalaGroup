-- Ensure external fingerprint columns exist in case previous migrations were skipped
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_fingerprint_template TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_fingerprint_image_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_fingerprint_added BOOLEAN DEFAULT FALSE;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS surety_fingerprint_template TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS surety_fingerprint_image_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS surety_fingerprint_added BOOLEAN DEFAULT FALSE;

-- Disable RLS on all finance tables to support the custom authentication model (local public.users table with unauthenticated anon Supabase client)
ALTER TABLE finance_partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_capital_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_dues DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_edited_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_deleted_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_guarantors DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fingerprints DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_documents DISABLE ROW LEVEL SECURITY;

-- Allow public insert access to storage bucket 'finance-photos'
DROP POLICY IF EXISTS "Allow authenticated insert access to finance-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access to finance-photos" ON storage.objects;

CREATE POLICY "Allow public insert access to finance-photos"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'finance-photos');
