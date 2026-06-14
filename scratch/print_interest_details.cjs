const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('finance_cd_interest_details').select('*');
  console.log("Records:", data);
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
    // Let's clean up
    await supabase.from('finance_cd_interest_details').delete().eq('id', data[0].id);
    console.log("Cleaned up successfully.");
  }
}

run();
