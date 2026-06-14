const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Attempting to update CD022 loan amount in database...");
  const { data, error } = await supabase
    .from('finance_loans')
    .update({ amount: 8500 })
    .eq('loan_id', 'CD022')
    .select();
  
  if (error) {
    console.error("Error updating CD022:", error);
  } else {
    console.log("Success updating CD022:", data);
  }
}

run();
