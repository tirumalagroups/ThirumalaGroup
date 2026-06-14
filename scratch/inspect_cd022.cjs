const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCD022() {
  console.log(`\n=== CD022 Loan ===`);
  const { data: loan, error: loanErr } = await supabase.from('finance_loans').select('*').eq('loan_id', 'CD022');
  if (loanErr) {
    console.error("Error fetching loan CD022:", loanErr);
    return;
  }
  console.log("Loan:", loan);

  if (loan && loan.length > 0) {
    const loanId = loan[0].id;
    
    console.log(`\n=== finance_transactions (Daybook) for CD022 ===`);
    const { data: txs, error: txsErr } = await supabase.from('finance_transactions').select('*').eq('loan_id', loanId);
    console.log("Transactions:", txs);

    console.log(`\n=== finance_cd_ledger_entries for CD022 ===`);
    const { data: entries, error: entriesErr } = await supabase.from('finance_cd_ledger_entries').select('*').eq('loan_id', loanId);
    console.log("Ledger Entries:", entries);

    console.log(`\n=== finance_cd_interest_details for CD022 ===`);
    const { data: interestDetails, error: intErr } = await supabase.from('finance_cd_interest_details').select('*').eq('loan_id', loanId);
    console.log("Interest Details:", interestDetails);
  }
}

inspectCD022();
