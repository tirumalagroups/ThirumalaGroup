require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS customer_id SERIAL;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS father_name TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS village TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS mandal TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS district TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS aadhaar_address TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS present_address TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS phone_1 TEXT;
    ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS phone_2 TEXT;
  `;
  
  console.log('Running SQL...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('❌ Error executing SQL:', error);
  } else {
    console.log('✅ SQL executed successfully!', data);
  }
}

run();
