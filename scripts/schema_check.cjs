const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pmqeegdmcrktccszgbwu.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  // Try to insert a dummy customer and see what columns exist by getting an error, or just run a query
  // Since we don't have direct SQL access through supabase-js, let's fetch one row and see its keys.
  const { data: cData, error: cErr } = await supabase.from('finance_customers').select('*').limit(1);
  console.log("finance_customers:", cData && cData[0] ? Object.keys(cData[0]) : cErr);

  const { data: lData, error: lErr } = await supabase.from('finance_loans').select('*').limit(1);
  console.log("finance_loans:", lData && lData[0] ? Object.keys(lData[0]) : lErr);
}
checkSchema();
