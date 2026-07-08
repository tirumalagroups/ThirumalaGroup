import { describe, it } from 'vitest';
import { supabase } from '../lib/supabase';

describe('Repair CD120 loan_date', () => {
  it('repairs the loan date in the database', async () => {
    const loanId = 'a9c4601a-6df4-434c-9915-7f4b827c6f21';

    // 1. Fetch current row
    const { data: beforeLoan, error: beforeErr } = await supabase
      .schema('finance')
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();

    if (beforeErr) {
      console.error('Error fetching loan before repair:', beforeErr);
      return;
    }

    console.log('=== BEFORE REPAIR ===');
    console.log(JSON.stringify(beforeLoan, null, 2));

    // 2. Perform repair if date is incorrect
    if (beforeLoan.date === '2026-04-29') {
      const { data: afterUpdate, error: updateErr } = await supabase
        .schema('finance')
        .from('loans')
        .update({ date: '2025-02-18' })
        .eq('id', loanId)
        .select()
        .single();

      if (updateErr) {
        console.error('Error updating loan:', updateErr);
        return;
      }
      
      console.log('=== AFTER REPAIR ===');
      console.log(JSON.stringify(afterUpdate, null, 2));
    } else {
      console.log('No repair needed: loan date is already', beforeLoan.date);
    }
  });
});
