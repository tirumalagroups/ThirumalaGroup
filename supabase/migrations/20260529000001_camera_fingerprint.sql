-- Alter finance_customers table to add photo and fingerprint columns
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_photo_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS fingerprint_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS fingerprint_added BOOLEAN DEFAULT FALSE;

-- Alter finance_loans table to add photo and fingerprint columns
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS customer_photo_url TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS surety_photo_url TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS fingerprint_url TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS fingerprint_added BOOLEAN DEFAULT FALSE;

-- Create storage bucket for finance-photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-photos', 'finance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public reading and authenticated uploading
DROP POLICY IF EXISTS "Allow public read access to finance-photos" ON storage.objects;
CREATE POLICY "Allow public read access to finance-photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'finance-photos');

DROP POLICY IF EXISTS "Allow authenticated insert access to finance-photos" ON storage.objects;
CREATE POLICY "Allow authenticated insert access to finance-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'finance-photos');
