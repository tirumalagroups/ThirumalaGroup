const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260606000004_remove_guarantor_module.sql');
  console.log(`Reading SQL from ${migrationPath}...`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing SQL migration on Supabase...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.error('❌ Error executing SQL migration:', error);
    process.exit(1);
  } else {
    console.log('✅ SQL migration completed successfully!', data);
  }
}

run();
