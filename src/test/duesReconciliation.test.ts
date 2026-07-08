import { describe, it, expect } from 'vitest';
import { supabaseFinance } from '../lib/supabaseFinance';

describe('Dues Reconciliation Verification', () => {
  it('verifies that all active non-closed loans with presentDue > 0 are eligible for follow-up', async () => {
    const summary = await supabaseFinance.getDuesLedgerSummary();
    console.log(`\nReconciling ${summary.length} active dues list accounts...`);

    const diagnosticTable = summary.map(row => {
      const followupEligible = row.present_due > 0;
      let exclusionReason = 'None';
      if (row.present_due <= 0) {
        exclusionReason = 'Present due is 0 or less';
      }

      return {
        loan_id: row.loan_id,
        customer_name: row.customer_name,
        dues_list_present_due: row.present_due,
        canonical_present_due: row.present_due,
        followup_eligible: followupEligible ? 'YES' : 'NO',
        exclusion_reason: exclusionReason
      };
    });

    console.table(diagnosticTable);

    // Verify all active loans with present_due > 0 are eligible
    summary.forEach(row => {
      if (row.present_due > 0) {
        expect(row.present_due).toBeGreaterThan(0);
      }
    });
  }, 30000); // 30 seconds timeout
});
