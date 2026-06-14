const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const loanId = 'd24c662a-88a3-4e88-a57b-6e685f1a1fa5';
  console.log("Attempting to update status to NPA_CLOSED for loan", loanId);
  const { data, error } = await supabase
    .from('finance_loans')
    .update({ status: 'NPA_CLOSED' })
    .eq('id', loanId)
    .select();
  
  if (error) {
    console.error("Test failed with error:", error.message);
  } else {
    console.log("Success! Status updated successfully to:", data[0].status);
    // Revert it back to Active
    await supabase.from('finance_loans').update({ status: 'Active' }).eq('id', loanId);
  }
}

test();
