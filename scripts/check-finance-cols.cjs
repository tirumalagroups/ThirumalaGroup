require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('finance_customers').select('*').limit(1);
  if (error) {
    console.error('Error fetching finance_customers:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in finance_customers:', Object.keys(data[0]));
  } else {
    console.log('finance_customers table exists but contains no records. We can fetch column names via RPC or by checking the error/other tables.');
    // Let's insert a dummy customer and delete it, or check database schema through information_schema.
    const { data: cols, error: schemaErr } = await supabase.rpc('get_table_columns', { table_name: 'finance_customers' });
    if (schemaErr) {
      console.log('RPC get_table_columns not available:', schemaErr.message);
    } else {
      console.log('Columns:', cols);
    }
  }
}
run();
