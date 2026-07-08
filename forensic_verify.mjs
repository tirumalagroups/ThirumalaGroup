import { createServer } from 'vite';

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function verify() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { supabaseFinance } = await vite.ssrLoadModule('/src/lib/supabaseFinance.ts');
    
    console.log("=== STEP 10: REAL VERIFICATION ===");
    const targetDate = new Date().toISOString().split('T')[0];
    
    // 1. Run Engine via Normalization
    const normalized = await supabaseFinance.getActiveCDDuePositions(targetDate);
    const TARGET_LOAN = 'db9f554d-889c-41fa-8f9b-fe02cee55153';
    const nRow = normalized.find(n => n.id === TARGET_LOAN);
    
    console.log("KNOWN CD LOAN:");
    console.log(TARGET_LOAN);
    if (nRow) {
      console.log("Engine totalToRegularize =", nRow.present_due);
    }
    console.log("Dues normalized row exists =", !!nRow);
    
    // 2. getDuesLedgerSummary
    const summary = await supabaseFinance.getDuesLedgerSummary(targetDate);
    const sRow = summary.find(s => s.id === TARGET_LOAN);
    console.log("getDuesLedgerSummary contains loan =", !!sRow);
    
    // 3. Dues List final filter
    const activeDues = summary.filter((due) => {
      const presentDue = Number(due.present_due || 0);
      const dueDays = Number(due.due_days || 0);
      return presentDue > 0 || dueDays > 0;
    });
    console.log("Dues List final filter contains loan =", activeDues.some(d => d.id === TARGET_LOAN));
    
    // 4. Payment Follow-Up source
    // Simulating Payment Follow Up logic
    const pfDues = summary.map((row) => ({
       id: row.id,
       loanId: row.loan_id,
       presentDue: row.present_due,
       dueDays: row.due_days
    }));
    const activeDueLoans = pfDues.filter(l => l.presentDue > 0);
    const inPf = activeDueLoans.some(d => d.id === TARGET_LOAN);
    console.log("Payment Follow-Up source contains loan =", inPf);
    
    if (inPf) {
      const pfRow = activeDueLoans.find(d => d.id === TARGET_LOAN);
      // Determine classification logic
      let classification = 'TODAYS';
      if (pfRow.dueDays > 0) classification = 'MISSED';
      else if (pfRow.dueDays < 0) classification = 'UPCOMING';
      console.log("Payment Follow-Up classification =", classification);
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    vite.close();
  }
}

verify();
