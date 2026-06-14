require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pmqeegdmcrktccszgbwu.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcWVlZ2RtY3JrdGNjc3pnYnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDY1OTUsImV4cCI6MjA2NzQ4MjU5NX0.OqaYKbr2CcLd10JTdyy0IRawUPwW3KGCAbsPNThcCFM';

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
