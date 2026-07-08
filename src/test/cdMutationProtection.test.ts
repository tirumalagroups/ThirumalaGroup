import { describe, it, expect } from 'vitest';
import { supabaseFinance } from '../lib/supabaseFinance';
import { financeCalculationService } from '../services/financeCalculationService';
import { supabase } from '../lib/supabase';

describe('CD Mutation Protection & Chronology Guards Regression Tests', () => {
  const TEST_LOAN_UUID = 'a9c4601a-6df4-434c-9915-7f4b827c6f21'; // CD120

  it('proves that customer update allowlist filters out arbitrary non-allowed fields', async () => {
    // Attempt to update customer with an arbitrary field not on the allowlist
    const customerId = '508d07bf-ada5-43a7-8bce-2724d652a7e1';
    
    // We pass an arbitrary field "invalid_field_should_be_stripped"
    const updated = await supabaseFinance.updateCustomer(
      customerId,
      {
        name: 'K KOTESHWARA RAO',
        // Typecast to bypass TS check for testing the runtime protection
        ...({ invalid_field_should_be_stripped: 'malicious' } as any)
      },
      'TEST_RUNNER',
      true
    );

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('K KOTESHWARA RAO');
    
    // Fetch directly from DB to verify it was not persisted
    const { data: rawCust } = await supabase
      .schema('finance')
      .from('borrowers')
      .select('*')
      .eq('id', customerId)
      .single();

    expect((rawCust as any).invalid_field_should_be_stripped).toBeUndefined();
  });

  it('proves that loan update allowlist filters out arbitrary non-allowed fields', async () => {
    // Attempt to update loan with an arbitrary field not on the allowlist
    const updated = await supabaseFinance.updateLoan(
      TEST_LOAN_UUID,
      {
        remarks: 'ITEM DETAILS: \nGOLD DETAILS: \nVEHICLE DETAILS: \nNOTES: COLLATERAL: N/A, GPS: N/A | EXTRA: N/A',
        ...({ arbitrary_malicious_loan_field: 'malicious' } as any)
      },
      'TEST_RUNNER',
      true
    );

    expect(updated).not.toBeNull();
    
    // Fetch directly from DB to verify it was not persisted
    const { data: rawLoan } = await supabase
      .schema('finance')
      .from('loans')
      .select('*')
      .eq('id', TEST_LOAN_UUID)
      .single();

    expect((rawLoan as any).arbitrary_malicious_loan_field).toBeUndefined();
  });

  it('proves that updating contract fields on a loan with ledger activity throws CD_CONTRACT_FIELD_IMMUTABLE', async () => {
    // CD120 has 65 ledger entries, so it definitely has activity.
    // Attempting to modify loan.date should throw.
    await expect(
      supabaseFinance.updateLoan(
        TEST_LOAN_UUID,
        { date: '2025-02-19' },
        'TEST_RUNNER',
        true
      )
    ).rejects.toThrow(/CD_CONTRACT_FIELD_IMMUTABLE/);

    // Attempting to modify loan.amount should throw.
    await expect(
      supabaseFinance.updateLoan(
        TEST_LOAN_UUID,
        { amount: 800000 },
        'TEST_RUNNER',
        true
      )
    ).rejects.toThrow(/CD_CONTRACT_FIELD_IMMUTABLE/);
  });

  it('proves that getCDAccountPosition throws CD_DATA_INTEGRITY_ERROR when chronology is broken', async () => {
    // Construct a mock loan and mock entries where loan date (2026-04-29) is after earliest monetary payment (2025-03-24)
    const mockLoan: any = {
      id: 'mock-uuid',
      loan_id: 'CD-MOCK',
      date: '2026-04-29',
      amount: 750000,
      interest_rate: 3,
      penalty_percent: 0.75,
      period_days: 30,
      loan_category: 'CD'
    };

    const mockEntries: any[] = [
      {
        entry_type: 'original_loan',
        entry_date: '2026-04-29',
        debit: 750000,
        credit: 0
      },
      {
        entry_type: 'amount_paid',
        entry_date: '2025-03-24', // Earlier than loan date!
        debit: 0,
        credit: 22500
      }
    ];

    expect(() =>
      financeCalculationService.getCDAccountPosition(
        mockLoan,
        mockEntries,
        [],
        '2026-07-06'
      )
    ).toThrow(/CD_DATA_INTEGRITY_ERROR/);
  });
});
