const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = `
    ALTER TABLE finance_loans DROP CONSTRAINT IF EXISTS finance_loans_status_check;
    ALTER TABLE finance_loans ADD CONSTRAINT finance_loans_status_check CHECK (status IN ('Active', 'Closed', 'NPA_CLOSED'));
  `;
  console.log("Running migration via exec_sql...");
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error("RPC Error:", error);
    } else {
      console.log("Migration executed successfully! Result:", data);
    }
  } catch (err) {
    console.error("Failed to run RPC:", err.message);
  }
}

run();
