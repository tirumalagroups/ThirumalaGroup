import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://pmqeegdmcrktccszgbwu.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function run() {
  const { data, error } = await supabase.from('users').select('username, password_hash').eq('username', 'admin_user').single();
  if (error) {
    console.error('Error:', error);
    return;
  }
  const candidates = ['admin', 'admin_user', 'admin123', 'admin@123', '123456', 'password', 'thirumala', 'thirumala123'];
  for (const c of candidates) {
    const match = await bcrypt.compare(c, data.password_hash);
    if (match) {
      console.log(`Found password for admin_user: "${c}"`);
      return;
    }
  }
  console.log('No matches found in simple candidates.');
}
run();
