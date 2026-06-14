const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const updates = {
    date: new Date('2026-06-07').toISOString().split('T')[0],
    amount: 4000
  };
  console.log("Sending updates:", updates);
  const { data, error } = await supabase
    .from('finance_loans')
    .update(updates)
    .eq('id', '6d9a29d4-84c0-4a37-8f9d-a5d728ad960c')
    .select();
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Result:", data);
  }
}

run();
