import { createServer } from 'vite';

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function trace() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { supabaseFinance } = await vite.ssrLoadModule('/src/lib/supabaseFinance.ts');
    const { supabase } = await vite.ssrLoadModule('/src/lib/supabaseDatabase.ts');
    const { financeCalculationService } = await vite.ssrLoadModule('/src/services/financeCalculationService.ts');
    
    console.log("=== STEP 1: TRACE ACTIVE LOAN QUERY ===");
    const { data: cdLoans, error: loansErr } = await supabase
      .from('finance_loans')
      .select('*')
      .eq('status', 'Active')
      .like('loan_id', 'CD%');
      
    console.log("ACTIVE QUERY:");
    console.log("count =", cdLoans ? cdLoans.length : 0);
    if (loansErr) console.log("error =", loansErr);
    
    // Total loan types
    const { data: allActiveLoans } = await supabase.from('finance_loans').select('loan_id, status').eq('status', 'Active');
    const typeCounts = { CD: 0, HP: 0, STBD: 0, TBD: 0 };
    if (allActiveLoans) {
      allActiveLoans.forEach(l => {
        if (l.loan_id.startsWith('CD')) typeCounts.CD++;
        else if (l.loan_id.startsWith('HP')) typeCounts.HP++;
        else if (l.loan_id.startsWith('STBD')) typeCounts.STBD++;
        else typeCounts.TBD++;
      });
    }
    console.log("\nTYPE COUNTS:");
    console.log("CD =", typeCounts.CD);
    console.log("HP =", typeCounts.HP);
    console.log("STBD =", typeCounts.STBD);
    console.log("TBD =", typeCounts.TBD);
    
    const TARGET_LOAN = 'db9f554d-889c-41fa-8f9b-fe02cee55153';
    
    console.log("\n=== STEP 2: TRACE ONE KNOWN CD LOAN ===");
    const { data: knownLoan, error: knownErr } = await supabase.from('finance_loans').select('*').eq('id', TARGET_LOAN).single();
    if (knownErr) console.log("error fetching known loan:", knownErr);
    if (knownLoan) {
      console.log("id:", knownLoan.id);
      console.log("number:", knownLoan.loan_id);
      console.log("loan_type:", knownLoan.loan_type);
      console.log("type:", knownLoan.type);
      console.log("status:", knownLoan.status);
      console.log("is_active:", knownLoan.is_active);
      console.log("date:", knownLoan.date);
      console.log("amount:", knownLoan.amount);
      console.log("book_id:", knownLoan.book_id);
    }
    
    console.log("\n=== STEP 3: TRACE HISTORY FETCH ===");
    const { data: entries, error: entriesErr } = await supabase.from('finance_cd_ledger_entries').select('*').eq('loan_id', TARGET_LOAN).order('entry_date', {ascending: true});
    const { data: interests, error: interestsErr } = await supabase.from('finance_cd_interest_details').select('*').eq('loan_id', TARGET_LOAN).order('date', {ascending: true});
    
    console.log("ledger entries count:", entries ? entries.length : 0);
    if (entriesErr) console.log("entries error:", entriesErr);
    console.log("interest details count:", interests ? interests.length : 0);
    if (interestsErr) console.log("interests error:", interestsErr);
    
    if (entries && entries.length > 0) {
      console.log("first ledger row:", JSON.stringify(entries[0]));
      console.log("last ledger row:", JSON.stringify(entries[entries.length - 1]));
    }
    if (interests && interests.length > 0) {
      console.log("first interest row:", JSON.stringify(interests[0]));
      console.log("last interest row:", JSON.stringify(interests[interests.length - 1]));
    }
    
    console.log("\n=== STEP 4: RUN ENGINE DIRECTLY ===");
    const targetDate = new Date().toISOString().split('T')[0]; // Using today as target date
    const pos = financeCalculationService.getCDAccountPosition(knownLoan, entries || [], interests || [], targetDate);
    
    console.log("principalBalance:", pos.principalBalance);
    console.log("currentDueDate:", pos.currentDueDate);
    console.log("calculationDays:", pos.calculationDays);
    console.log("exactDueDays:", pos.exactDueDays);
    console.log("displayDueDays:", pos.displayDueDays);
    console.log("accruedInterest:", pos.accruedInterest);
    console.log("accruedPenalty:", pos.accruedPenalty);
    console.log("renewalDue:", pos.renewalDue);
    console.log("totalToRegularize:", pos.totalToRegularize);
    console.log("totalForClose:", pos.totalForClose);
    
    console.log("\nQUALIFICATION CHECK:");
    console.log("totalToRegularize > 0 =", pos.totalToRegularize > 0);
    console.log("displayDueDays > 0 =", pos.displayDueDays > 0);
    console.log("QUALIFIES FOR DUES LIST =", pos.totalToRegularize > 0 || pos.displayDueDays > 0);
    
    console.log("\n=== STEP 5: TRACE NORMALIZATION ===");
    const normalized = await supabaseFinance.getActiveCDDuePositions(targetDate);
    console.log("normalized rows count:", normalized.length);
    const targetNormalized = normalized.find(n => n.id === TARGET_LOAN);
    if (targetNormalized) {
      console.log("loan_number:", targetNormalized.loan_id);
      console.log("loan_id:", targetNormalized.id);
      console.log("loan_type:", targetNormalized.loan_type);
      console.log("due_date:", targetNormalized.current_due_date);
      console.log("days:", targetNormalized.days);
      console.log("due_days:", targetNormalized.due_days);
      console.log("present_due:", targetNormalized.present_due);
    } else {
      console.log("TARGET LOAN MISSING FROM NORMALIZED RESULTS!");
    }
    
    console.log("\n=== STEP 6: TRACE getDuesLedgerSummary() ===");
    const summary = await supabaseFinance.getDuesLedgerSummary(targetDate);
    console.log("raw result length:", summary.length);
    console.log("CD rows count:", summary.filter(r => r.loan_type === 'CD').length);
    console.log("HP rows count:", summary.filter(r => r.loan_type === 'HP').length);
    console.log("STBD rows count:", summary.filter(r => r.loan_type === 'STBD').length);
    console.log("TBD rows count:", summary.filter(r => r.loan_type === 'TBD').length);
    
    console.log("first 5 result rows:");
    console.log(JSON.stringify(summary.slice(0, 5).map(r => ({ loan_id: r.loan_id, present_due: r.present_due, due_days: r.due_days })), null, 2));
    
  } catch (e) {
    console.error(e);
  } finally {
    vite.close();
  }
}

trace();
