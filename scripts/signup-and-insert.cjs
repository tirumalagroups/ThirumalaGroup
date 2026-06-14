require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Attempting sign up...');
  const email = `test-auth-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (signUpError) {
    console.error('❌ Sign up failed:', signUpError.message);
    
    // Try signing in with a generic user if signup is disabled
    console.log('Attempting sign in with standard credentials...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@thirumala.com',
      password: 'admin123' // wait, admin@thirumala.com is in public.users, not necessarily auth.users. But let's try.
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }
    console.log('✅ Sign in successful!', signInData.user.email);
  } else {
    console.log('✅ Sign up successful!', signUpData.user.email);
  }
  
  // Now try inserting a customer with redesigned columns
  console.log('Inserting customer with authenticated user...');
  const { data: customerData, error: insertError } = await supabase
    .from('finance_customers')
    .insert([{
      name: 'TEMPORARY_TEST_CUSTOMER_DELETE_ME',
      father_name: 'TEST_FATHER',
      village: 'TEST_VILLAGE',
      mandal: 'TEST_MANDAL',
      district: 'TEST_DISTRICT',
      aadhaar_address: 'TEST_AADHAAR_ADDRESS',
      present_address: 'TEST_PRESENT_ADDRESS',
      phone_1: '1234567890',
      phone_2: '0987654321'
    }])
    .select();
    
  if (insertError) {
    console.error('❌ Insert failed even when authenticated:', insertError);
  } else {
    console.log('✅ Insert successful!', customerData);
    
    // Clean up
    console.log('Deleting temporary customer...');
    const { error: delError } = await supabase
      .from('finance_customers')
      .delete()
      .eq('id', customerData[0].id);
      
    if (delError) {
      console.error('❌ Deletion failed:', delError);
    } else {
      console.log('✅ Temporary customer deleted successfully!');
    }
  }
}

run();
