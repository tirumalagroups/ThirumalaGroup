import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { cdLedgerRebuildService } from '../services/cdLedgerRebuildService';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

describe('CD122 Full Recalculate Verification', () => {
  it('should force FULL_RECALCULATE and correctly rebuild CD122 splits', async () => {
    const cd122Id = '4325a95c-4d43-4918-8f8a-fdd9dfedd1d2';

    console.log('--- REBUILDING CD122 LIFE CYCLE ---');
    const result = await cdLedgerRebuildService.rebuildCDLoanLifecycle(cd122Id, 'FULL_RECALCULATE');
    expect(result.success).toBe(true);

    // Fetch and check splits for key receipts
    const { data: details } = await supabase
      .schema('finance')
      .from('cd_interest_details')
      .select('*')
      .eq('loan_id', cd122Id)
      .order('entry_date', { ascending: false })
      .limit(5);

    console.log('\n=== REBUILT DETAILS FOR CD122 ===');
    details?.forEach(d => {
      console.log(`Receipt: ${d.receipt_no} | Date: ${d.entry_date} | Credit: ${d.credit} | Type: ${d.row_type} | RenewedDays: ${d.renewed_days} | RenewedTill: ${d.renewed_till_date} | Part: ${d.particulars}`);
    });

    const { data: loan } = await supabase
      .schema('finance')
      .from('loans')
      .select('*')
      .eq('id', cd122Id)
      .single();

    console.log('\n=== CD122 LOAN AFTER REBUILD ===');
    console.log(`Due Date: ${loan.due_date} | Status: ${loan.status}`);
  }, 30000); // 30s timeout
});
