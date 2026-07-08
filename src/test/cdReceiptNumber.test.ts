import { describe, it, expect, vi } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';
import { supabaseFinance } from '../lib/supabaseFinance';

describe('Receipt Number Sequence Transitions', () => {
  it('handles sequence transitions correctly', () => {
    // 1. existing highest RC719 -> next RC1000
    expect(financeCalculationService.getNextReceiptNumber('RC719')).toBe('RC1000');

    // 2. existing highest RC999 -> next RC1000
    expect(financeCalculationService.getNextReceiptNumber('RC999')).toBe('RC1000');

    // 3. existing highest RC1000 -> next RC1001
    expect(financeCalculationService.getNextReceiptNumber('RC1000')).toBe('RC1001');

    // 4. existing highest RC1058 -> next RC1059
    expect(financeCalculationService.getNextReceiptNumber('RC1058')).toBe('RC1059');
  });

  it('ignores malformed values and defaults to RC1000', () => {
    expect(financeCalculationService.getNextReceiptNumber('ABC')).toBe('RC1000');
    expect(financeCalculationService.getNextReceiptNumber('RC001_malformed')).toBe('RC1000');
    expect(financeCalculationService.getNextReceiptNumber(null)).toBe('RC1000');
    expect(financeCalculationService.getNextReceiptNumber('')).toBe('RC1000');
  });
});

describe('Receipt Generator Failures and Invariants', () => {
  it('blocks payment save if receipt generation fails', async () => {
    // Mock getNextReceiptNumber to throw the expected error simulating database routine failure
    const originalGetNext = supabaseFinance.getNextReceiptNumber;
    supabaseFinance.getNextReceiptNumber = vi.fn().mockRejectedValue(new Error('Unable to generate receipt number. Payment was not saved.'));

    await expect(supabaseFinance.postCdLedgerPayment({
      loanId: 'dummy-loan',
      customerId: 'dummy-cust',
      accountName: 'Dummy Account',
      userName: 'Staff',
      actionType: 'Renew',
      principalPaid: 0,
      interestPaid: 22500,
      penaltyPaid: 0,
      renewedDays: 30
    })).resolves.toEqual({
      success: false,
      error: 'Unable to generate receipt number. Payment was not saved.'
    });

    // Restore mock
    supabaseFinance.getNextReceiptNumber = originalGetNext;
  });

  it('ensures all ledger split rows and transactions share the exact same receipt number', async () => {
    // Verify that postCdLedgerPayment calls addTransaction and addCDLedgerEntry with the same generated receipt number
    const addTransactionSpy = vi.spyOn(supabaseFinance, 'addTransaction').mockResolvedValue({ id: 'tx-123' } as any);
    const addCDLedgerEntrySpy = vi.spyOn(supabaseFinance, 'addCDLedgerEntry').mockResolvedValue({ id: 'ledger-123', entry_type: 'interest_payment' } as any);
    const addCDInterestDetailSpy = vi.spyOn(supabaseFinance, 'addCDInterestDetail').mockResolvedValue({} as any);

    // Mock receipt number generator to return a fixed mock sequence number
    const originalGetNext = supabaseFinance.getNextReceiptNumber;
    supabaseFinance.getNextReceiptNumber = vi.fn().mockResolvedValue('RC1000');

    await supabaseFinance.postCdLedgerPayment({
      loanId: 'dummy-loan',
      customerId: 'dummy-cust',
      accountName: 'Dummy Account',
      userName: 'Staff',
      actionType: 'Renew',
      principalPaid: 0,
      interestPaid: 22500,
      penaltyPaid: 4500,
      renewedDays: 24
    });

    // Check receipt numbers passed to spy calls
    expect(addTransactionSpy).toHaveBeenCalledWith(expect.objectContaining({ receipt_no: 'RC1000' }));
    
    // Check all ledger splits share RC1000
    addCDLedgerEntrySpy.mock.calls.forEach(call => {
      expect(call[0].receipt_no).toBe('RC1000');
    });

    // Check all interest details share RC1000
    addCDInterestDetailSpy.mock.calls.forEach(call => {
      expect(call[0].receipt_no).toBe('RC1000');
    });

    // Restore
    addTransactionSpy.mockRestore();
    addCDLedgerEntrySpy.mockRestore();
    addCDInterestDetailSpy.mockRestore();
    supabaseFinance.getNextReceiptNumber = originalGetNext;
  });
});
