require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('🚀 Checking Camera and Fingerprint fields in database tables...\n');

  try {
    const { data: customerData, error: custError } = await supabase
      .from('finance_customers')
      .select('customer_photo_url, fingerprint_url, fingerprint_template, fingerprint_added')
      .limit(1);

    const { data: loanData, error: loanError } = await supabase
      .from('finance_loans')
      .select('customer_photo_url, surety_photo_url, fingerprint_url, fingerprint_template, fingerprint_added')
      .limit(1);

    if (!custError && !loanError) {
      console.log('✅ All Camera and Fingerprint columns are present in database!');
      return;
    }

    console.log('⚠️  Columns are missing. Please execute the migration SQL.\n');
    console.log('📝 Run this SQL in your Supabase SQL Editor:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`-- Alter finance_customers table
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_photo_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS fingerprint_url TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS fingerprint_added BOOLEAN DEFAULT FALSE;

-- Alter finance_loans table
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
WITH CHECK (bucket_id = 'finance-photos');`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
  }
}

checkColumns();
