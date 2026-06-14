require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Query standard RPC / functions in postgres
  const { data, error } = await supabase.rpc('get_functions'); // if exists
  if (error) {
    console.log('get_functions rpc failed:', error.message);
    
    // Let's try querying pg_catalog or information_schema through an insert/select if we can, 
    // but wait, we can just try to run custom sql. Since exec_sql didn't work, is there another?
    // Let's try another script to fetch all tables.
  } else {
    console.log('Functions:', data);
  }
}

run();
