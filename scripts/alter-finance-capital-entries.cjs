require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_capital_entries' AND column_name = 'date') THEN
        ALTER TABLE finance_capital_entries RENAME COLUMN date TO entry_date;
      END IF;
    END $$;

    ALTER TABLE finance_capital_entries ADD COLUMN IF NOT EXISTS partner_name TEXT;
    ALTER TABLE finance_capital_entries ADD COLUMN IF NOT EXISTS particulars TEXT;
    ALTER TABLE finance_capital_entries ADD COLUMN IF NOT EXISTS credit NUMERIC DEFAULT 0;
    ALTER TABLE finance_capital_entries ADD COLUMN IF NOT EXISTS debit NUMERIC DEFAULT 0;
    ALTER TABLE finance_capital_entries ADD COLUMN IF NOT EXISTS created_by TEXT;

    -- Move data from old columns (amount, type, remarks) if they exist and are populated
    UPDATE finance_capital_entries 
    SET 
      particulars = COALESCE(particulars, remarks),
      credit = COALESCE(credit, CASE WHEN type = 'Credit' THEN amount ELSE 0 END),
      debit = COALESCE(debit, CASE WHEN type = 'Debit' THEN amount ELSE 0 END);

    -- Disable Row Level Security on finance_capital_entries table
    ALTER TABLE finance_capital_entries DISABLE ROW LEVEL SECURITY;
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
