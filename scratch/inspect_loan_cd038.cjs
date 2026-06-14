const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: loan, error } = await supabase
    .from('finance_loans')
    .select('*')
    .eq('loan_id', 'CD038')
    .single();

  if (error) {
    console.error('Error fetching loan:', error);
    return;
  }

  const { data: transactions } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('loan_id', loan.id);

  const { data: ledgerEntries } = await supabase
    .from('cd_ledger')
    .select('*')
    .eq('loan_id', loan.id);

  console.log('Loan full object:', loan);
  console.log('Duration Months:', loan.duration_months);
  console.log('Transactions:', transactions);
  console.log('CD Ledger Entries:', ledgerEntries);
}

run();
