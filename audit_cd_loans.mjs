import { createServer } from 'vite';

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function audit() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { supabase } = await vite.ssrLoadModule('/src/lib/supabaseDatabase.ts');
    
    // Disable proxy for this audit to see EVERYTHING across books, or just use it but we'll try raw client
    // Wait, supabase from ssrLoadModule has the proxy. Let's use it first, then bypass if needed.
    // To bypass proxy, we might need the raw client. Let's see if we can get it.
    // Actually, proxy only adds book_id if activeBookId is present.
    // We'll just run queries using the imported supabase.

    console.log("=== STEP 1: AUDIT finance_loans DIRECTLY ===");
    // Fetch all loans without any filter
    const { data: allLoans, error: allLoansErr } = await supabase.from('finance_loans').select('*');
    if (allLoansErr) console.log("Error:", allLoansErr);
    
    console.log("TOTAL LOANS =", allLoans ? allLoans.length : 0);
    
    if (allLoans) {
      const typeCounts = {};
      const loanTypeCounts = {};
      const statusCounts = {};
      const activeCounts = {};
      const modeCounts = {};
      
      allLoans.forEach(l => {
        typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
        loanTypeCounts[l.loan_type] = (loanTypeCounts[l.loan_type] || 0) + 1;
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
        activeCounts[l.is_active] = (activeCounts[l.is_active] || 0) + 1;
        modeCounts[l.mode] = (modeCounts[l.mode] || 0) + 1;
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
      
      console.log("\n=== STEP 2: FIND ALL CD-LIKE LOANS ===");
      const cdLike = allLoans.filter(l => 
        l.loan_type === 'CD' || 
        l.type === 'CD' || 
        l.ledger_type === 'CD' ||
        (l.loan_id && l.loan_id.toUpperCase().startsWith('CD'))
      );
      
      console.log("RAW CD-LIKE LOAN COUNT =", cdLike.length);
      console.log("First 10 CD-like loans:");
      cdLike.slice(0, 10).forEach(l => {
        console.log(`id: ${l.id}, number: ${l.loan_id}, borrower_id: ${l.customer_id}, loan_type: ${l.loan_type}, type: ${l.type}, status: ${l.status}, is_active: ${l.is_active}, date: ${l.date}, amount: ${l.amount}`);
      });
      
      console.log("\n=== STEP 5: AUDIT STATUS FILTER ===");
      const activeStatusLoans = cdLike.filter(l => l.status === 'Active');
      console.log("CD-like loans with status === 'Active':", activeStatusLoans.length);
      const rejectedStatusLoans = cdLike.filter(l => l.status !== 'Active');
      console.log("REJECTED BY STATUS FILTER:", rejectedStatusLoans.length);
      rejectedStatusLoans.slice(0, 5).forEach(l => {
        console.log(`REJECTED: number = ${l.loan_id}, status = ${l.status}, reason = not 'Active'`);
      });
      
      console.log("\n=== STEP 6: AUDIT NUMBER FILTER ===");
      const distinctPatterns = [...new Set(cdLike.map(l => l.loan_id ? l.loan_id.replace(/[0-9]/g, '') : 'null'))];
      console.log("Distinct account-number patterns:", distinctPatterns);
      
      console.log("\n=== STEP 8: COMPARE KNOWN MIGRATED DATA ===");
      const knownIds = ['CD119', 'CD120', 'CD121', 'CD122', 'CD123'];
      knownIds.forEach(kid => {
        const found = allLoans.some(l => l.loan_id === kid);
        console.log(`${kid} in finance_loans = ${found}`);
      });
      
      console.log("\n=== STEP 9: CHECK TABLE CONFUSION ===");
      const { data: cdLedger } = await supabase.from('finance_cd_ledger_entries').select('loan_id');
      const { data: cdInterest } = await supabase.from('finance_cd_interest_details').select('loan_id');
      
      const distinctLedgerLoanIds = new Set(cdLedger ? cdLedger.map(e => e.loan_id) : []);
      const distinctInterestLoanIds = new Set(cdInterest ? cdInterest.map(e => e.loan_id) : []);
      
      console.log("cd_ledger_entries distinct loan_id =", distinctLedgerLoanIds.size);
      console.log("cd_interest_details distinct loan_id =", distinctInterestLoanIds.size);
      
      const allLoanIdsInDb = new Set(allLoans.map(l => l.id));
      let orphanCount = 0;
      const orphans = [];
      distinctLedgerLoanIds.forEach(lid => {
        if (!allLoanIdsInDb.has(lid)) {
          orphanCount++;
          if (orphans.length < 20) orphans.push(lid);
        }
      });
      console.log("ledger loan_id NOT FOUND in finance_loans =", orphanCount);
      console.log("Orphan IDs:", orphans);
      
      if (orphanCount > 0) {
        // Find if these orphans have a record in a different table, e.g. finance_loans but wrong book_id?
        // Let's bypass proxy if possible
      }
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    vite.close();
  }
}

audit();
