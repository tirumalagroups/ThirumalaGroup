import { supabaseFinance } from './src/lib/supabaseFinance';

async function test() {
  console.log("Fetching CD dues...");
  const data = await supabaseFinance.getDuesLedgerSummary();
  console.log("Total records:", data.length);
  const cdRecords = data.filter(r => r.loan_type === 'CD');
  console.log("CD records:", cdRecords.length);
  
  const activeDues = cdRecords.filter(r => r.present_due > 0);
  console.log("Active CD Dues:", activeDues.length);
  if (activeDues.length > 0) {
    console.log("First active due:", activeDues[0]);
  }
}

test().catch(console.error);
