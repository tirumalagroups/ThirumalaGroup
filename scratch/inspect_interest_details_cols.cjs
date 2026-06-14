const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('finance_cd_interest_details').select('*').limit(1);
  if (error) {
    console.error("Error fetching interest details:", error);
  } else {
    // If empty, let's look at the API schema by checking query parameters or select specific fields
    console.log("Data:", data);
    // Let's print out what columns it might have by checking if we select '*' and what fields are returned (which is an empty array but we can get metadata from postgrest by doing a select or similar if we check postgrest schema)
    // Actually, let's try to insert an empty object to trigger a constraint/null error to see all fields, or let's run a select with a bunch of common fields.
  }
}

run();
