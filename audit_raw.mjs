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
  
  const typeCounts = {};
  const loanTypeCounts = {};
  const statusCounts = {};
  const activeCounts = {};
  const modeCounts = {};
  const ledgerTypeCounts = {};
  
  allLoans.forEach(l => {
    typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
    loanTypeCounts[l.loan_type] = (loanTypeCounts[l.loan_type] || 0) + 1;
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    activeCounts[l.is_active] = (activeCounts[l.is_active] || 0) + 1;
    modeCounts[l.mode] = (modeCounts[l.mode] || 0) + 1;
    ledgerTypeCounts[l.ledger_type] = (ledgerTypeCounts[l.ledger_type] || 0) + 1;
  });
  
  console.log("\nloan_type:");
  for (const [k, v] of Object.entries(loanTypeCounts)) console.log(`${k} = ${v}`);
  
  console.log("\ntype:");
  for (const [k, v] of Object.entries(typeCounts)) console.log(`${k} = ${v}`);
  
  console.log("\nstatus:");
  for (const [k, v] of Object.entries(statusCounts)) console.log(`${k} = ${v}`);
  
  console.log("\nis_active:");
  for (const [k, v] of Object.entries(activeCounts)) console.log(`${k} = ${v}`);
  
  console.log("\nmode:");
  for (const [k, v] of Object.entries(modeCounts)) console.log(`${k} = ${v}`);
  
  console.log("\nledger_type:");
  for (const [k, v] of Object.entries(ledgerTypeCounts)) console.log(`${k} = ${v}`);

  console.log("\n=== STEP 2: FIND ALL CD-LIKE LOANS ===");
  const cdLike = allLoans.filter(l => 
    l.loan_type === 'CD' || 
    l.type === 'CD' || 
    l.ledger_type === 'CD' ||
    (l.loan_id && l.loan_id.toUpperCase().startsWith('CD')) ||
    (l.number && l.number.toUpperCase().startsWith('CD'))
  );
  
  console.log("RAW CD-LIKE LOAN COUNT =", cdLike.length);
  console.log("First 10 CD-like loans:");
  cdLike.slice(0, 10).forEach(l => {
    console.log(`id: ${l.id}, number: ${l.loan_id || l.number}, borrower_id: ${l.customer_id || l.borrower_id}, loan_type: ${l.loan_type}, type: ${l.type}, status: ${l.status}, is_active: ${l.is_active}, date: ${l.date}, amount: ${l.amount}`);
  });
  
  console.log("\n=== STEP 4: AUDIT DEFAULT SUPABASE ROW LIMIT ===");
  const { data: allLoansLimit } = await supabase.schema('finance').from('loans').select('*');
  console.log("query returned count =", allLoansLimit ? allLoansLimit.length : 0);
  
  const { count: exactCount } = await supabase.schema('finance').from('loans').select('*', { count: 'exact', head: true });
  console.log("EXACT DB COUNT =", exactCount);
  console.log("RETURNED ROW COUNT =", allLoansLimit ? allLoansLimit.length : 0);
  
  console.log("\n=== STEP 5: AUDIT STATUS FILTER ===");
  console.log("CD-like loans before status filtering:");
  cdLike.slice(0, 5).forEach(l => {
    console.log(`number: ${l.loan_id || l.number} | raw status: ${l.status} | is_active: ${l.is_active}`);
  });
  
  const activeStatusLoans = cdLike.filter(l => l.status === 'Active');
  console.log("\nCD-like loans with status === 'Active':", activeStatusLoans.length);
  const rejectedStatusLoans = cdLike.filter(l => l.status !== 'Active');
  console.log("REJECTED BY STATUS FILTER:", rejectedStatusLoans.length);
  rejectedStatusLoans.slice(0, 5).forEach(l => {
    console.log(`REJECTED: number = ${l.loan_id || l.number}, status = ${l.status}, reason = not 'Active'`);
  });
  
  console.log("\n=== STEP 6: AUDIT NUMBER FILTER ===");
  const distinctPatterns = [...new Set(cdLike.map(l => {
    const num = l.loan_id || l.number;
    return num ? num.replace(/[0-9]/g, '') : 'null';
  }))];
  console.log("Distinct account-number patterns:", distinctPatterns);
  
  console.log("\n=== STEP 8: COMPARE KNOWN MIGRATED DATA ===");
  const knownIds = ['CD119', 'CD120', 'CD121', 'CD122', 'CD123'];
  knownIds.forEach(kid => {
    const found = allLoans.some(l => (l.loan_id === kid || l.number === kid));
    console.log(`${kid} in finance.loans = ${found}`);
  });
  
  // Also print 20 CD-like loans immediately before CD119 (by date/account order)
  const sortedCd = [...cdLike].sort((a,b) => (a.date < b.date ? -1 : 1));
  const idx119 = sortedCd.findIndex(l => (l.loan_id === 'CD119' || l.number === 'CD119'));
  console.log("Index of CD119:", idx119);
  if (idx119 > 0) {
    console.log("Loans immediately before CD119:");
    sortedCd.slice(Math.max(0, idx119 - 20), idx119).forEach(l => {
      console.log(`${l.loan_id || l.number} (${l.date})`);
    });
  }
  
  console.log("\n=== STEP 9: CHECK TABLE CONFUSION ===");
  const { count: c_loans } = await supabase.schema('finance').from('loans').select('*', { count: 'exact', head: true });
  const { data: cdLedger } = await supabase.schema('finance').from('cd_ledger_entries').select('loan_id');
  const { data: cdInterest } = await supabase.schema('finance').from('cd_interest_details').select('loan_id');
  const { data: loanTx } = await supabase.schema('finance').from('loan_transactions').select('loan_id');
  
  console.log("finance.loans total rows =", c_loans);
  
  const distinctLedgerLoanIds = new Set(cdLedger ? cdLedger.map(e => e.loan_id) : []);
  const distinctInterestLoanIds = new Set(cdInterest ? cdInterest.map(e => e.loan_id) : []);
  const distinctTxLoanIds = new Set(loanTx ? loanTx.map(e => e.loan_id) : []);
  
  console.log("cd_ledger_entries distinct loan_id =", distinctLedgerLoanIds.size);
  console.log("cd_interest_details distinct loan_id =", distinctInterestLoanIds.size);
  console.log("loan_transactions distinct loan_id =", distinctTxLoanIds.size);
  
  const allLoanIdsInDb = new Set(allLoans.map(l => l.id));
  let orphanCount = 0;
  const orphans = [];
  distinctLedgerLoanIds.forEach(lid => {
    if (!allLoanIdsInDb.has(lid)) {
      orphanCount++;
      if (orphans.length < 20) orphans.push(lid);
    }
  });
  console.log("ledger loan_id NOT FOUND in finance.loans =", orphanCount);
  console.log("First 20 Orphan IDs:", orphans);
}

audit();
