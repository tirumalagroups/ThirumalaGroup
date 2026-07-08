import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  console.log("=== STEP 1: AUDIT finance.loans DIRECTLY ===");
  const { data: allLoans, error } = await supabase.schema('finance').from('loans').select('*');
  
  if (error) {
    console.error("Error fetching raw loans:", error);
    return;
  }
  
  console.log("TOTAL LOANS =", allLoans.length);
  
  const categoryCounts = {};
  
  allLoans.forEach(l => {
    categoryCounts[l.loan_category] = (categoryCounts[l.loan_category] || 0) + 1;
  });
  
  console.log("\nloan_category:");
  for (const [k, v] of Object.entries(categoryCounts)) console.log(`${k} = ${v}`);
  
  const cdLoans = allLoans.filter(l => l.loan_category === 'CD');
  console.log("Loans where loan_category === 'CD':", cdLoans.length);
  cdLoans.forEach(l => {
     console.log(`${l.loan_id || l.number}: status = ${l.status}, loan_category = ${l.loan_category}`);
  });

}

audit();
