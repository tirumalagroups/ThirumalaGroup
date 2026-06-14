import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://pmqeegdmcrktccszgbwu.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function run() {
  const { data, error } = await supabase.from('users').select('username, is_active');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Users:', data);
  }
}
run();
