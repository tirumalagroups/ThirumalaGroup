const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  const tables = [
    'finance_loans',
    'finance_transactions',
    'finance_cd_ledger_entries',
    'finance_cd_interest_details',
    'finance_customers',
    'finance_photos',
    'finance_dues'
  ];

  for (const table of tables) {
    console.log(`\n--- RLS Check for ${table} ---`);
    // Try to update a nonexistent row to see if we get a permission/policy error
    const { data, error } = await supabase.from(table).update({ amount: 9999 }).eq('id', '00000000-0000-0000-0000-000000000000').select();
    if (error) {
      console.log(`Error updating ${table}:`, error.message);
    } else {
      console.log(`Update ${table} success (affected 0 rows).`);
    }
  }
}

checkRLS();
