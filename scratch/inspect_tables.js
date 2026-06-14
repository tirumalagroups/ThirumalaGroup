const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable(tableName) {
  console.log(`\n--- Inspecting ${tableName} ---`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
  } else if (data && data.length > 0) {
    console.log(`Columns in ${tableName}:`, Object.keys(data[0]));
    console.log('Sample record:', data[0]);
  } else {
    console.log(`${tableName} exists but has no records.`);
  }
}

async function run() {
  await inspectTable('finance_cd_ledger_entries');
  await inspectTable('finance_cd_interest_details');
  await inspectTable('finance_transactions');
  await inspectTable('finance_loans');
}

run();
