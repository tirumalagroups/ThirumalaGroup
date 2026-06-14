require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Inserting temporary customer...');
  const { data, error } = await supabase
    .from('finance_customers')
    .insert([{ name: 'TEMPORARY_TEST_CUSTOMER_DELETE_ME' }])
    .select();
    
  if (error) {
    console.error('❌ Insert failed:', error);
    return;
  }
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('✅ Columns in finance_customers:', columns);
    
    // Clean up
    console.log('Deleting temporary customer...');
    const { error: delError } = await supabase
      .from('finance_customers')
      .delete()
      .eq('id', data[0].id);
      
    if (delError) {
      console.error('❌ Deletion failed:', delError);
    } else {
      console.log('✅ Temporary customer deleted successfully!');
    }
  } else {
    console.log('No data returned.');
  }
}

run();
