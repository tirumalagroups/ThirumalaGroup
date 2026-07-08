import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('get_triggers_on_table', { table_name: 'finance_transaction_reviews' });
  console.log('RPC get_triggers_on_table:', data, error);
}

checkTriggers();
