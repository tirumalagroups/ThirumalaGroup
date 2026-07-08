import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roundCDMoney, getCDContractualPosition, buildCDContract } from '../services/cdLedgerEngine';
import { supabaseFinance } from '../lib/supabaseFinance';
import { cdLedgerRebuildService } from '../services/cdLedgerRebuildService';


// Initialize global state for the mock
(globalThis as any).mockState = {
  singleLoan: null as any,
  ledgerEntries: [] as any[],
  interestDetails: [] as any[],
  transactions: [] as any[],
  lastLoanUpdates: null as any,
  addedInterestDetails: [] as any[],
};

const getGlobalState = () => (globalThis as any).mockState;

// Create hoisted mock definitions
vi.mock('../lib/supabase', () => {
  const mockSupabase = {
    from: (table: string) => {
      const state = (globalThis as any).mockState;
      let data = null;
      let count = 0;
      if (table === 'finance_loans') {
        data = state.singleLoan;
        count = state.singleLoan ? 1 : 0;
      } else if (table === 'finance_cd_ledger_entries') {
        data = state.ledgerEntries;
        count = state.ledgerEntries.filter((e: any) => e.entry_type !== 'original_loan').length;
      } else if (table === 'finance_cd_interest_details') {
        data = state.interestDetails;
        count = state.interestDetails.length;
      } else if (table === 'finance_transactions') {
        data = state.transactions;
        count = state.transactions.filter((t: any) => t.type !== 'Disbursement').length;
      }

      const queryResult = { data, error: null, count };
      const localChain: any = {
        select: () => localChain,
        eq: () => localChain,
        neq: () => localChain,
        in: () => localChain,
        order: () => localChain,
        single: () => Promise.resolve({ data: queryResult.data, error: queryResult.error, count: queryResult.count }),
        maybeSingle: () => Promise.resolve({ data: queryResult.data, error: queryResult.error, count: queryResult.count }),
        delete: () => localChain,
        insert: () => localChain,
        update: (payload: any) => {
          state.lastLoanUpdates = payload;
          return localChain;
        },
        then: (onfulfilled: any) => {
          return Promise.resolve(queryResult).then(onfulfilled);
        },
      };
      return localChain;
    },
  };

  return {
    supabase: mockSupabase,
    default: mockSupabase,
    resolveSchemaAndTable: (tableName: string) => ({ schema: 'finance', table: tableName }),
  };
});

vi.mock('../lib/supabaseDatabase', () => {
  const mockSupabase = {
    from: (table: string) => {
      const state = (globalThis as any).mockState;
      let data = null;
      let count = 0;
      if (table === 'finance_loans') {
        data = state.singleLoan;
        count = state.singleLoan ? 1 : 0;
      } else if (table === 'finance_cd_ledger_entries') {
        data = state.ledgerEntries;
        count = state.ledgerEntries.filter((e: any) => e.entry_type !== 'original_loan').length;
      } else if (table === 'finance_cd_interest_details') {
        data = state.interestDetails;
        count = state.interestDetails.length;
      } else if (table === 'finance_transactions') {
        data = state.transactions;
        count = state.transactions.filter((t: any) => t.type !== 'Disbursement').length;
      }

      const queryResult = { data, error: null, count };
      const localChain: any = {
        select: () => localChain,
        eq: () => localChain,
        neq: () => localChain,
        in: () => localChain,
        order: () => localChain,
        single: () => Promise.resolve({ data: queryResult.data, error: queryResult.error, count: queryResult.count }),
        maybeSingle: () => Promise.resolve({ data: queryResult.data, error: queryResult.error, count: queryResult.count }),
        delete: () => localChain,
        insert: () => localChain,
        update: (payload: any) => {
          state.lastLoanUpdates = payload;
          return localChain;
        },
        then: (onfulfilled: any) => {
          return Promise.resolve(queryResult).then(onfulfilled);
        },
      };
      return localChain;
    },
  };

  return {
    supabase: mockSupabase,
    default: mockSupabase,
    resolveSchemaAndTable: (tableName: string) => ({ schema: 'finance', table: tableName }),
  };
});

describe('CD Compliance Audit Regression Tests', () => {
  beforeEach(() => {
    const state = getGlobalState();
    state.singleLoan = null;
    state.ledgerEntries = [];
    state.interestDetails = [];
    state.transactions = [];
    state.lastLoanUpdates = null;
    state.addedInterestDetails = [];
    vi.clearAllMocks();
  });

  describe('FIX 1: Rounding of CD Decimal Money', () => {
    it('correctly rounds half-up to 2 decimal places at result boundaries', () => {
      expect(roundCDMoney(7348.125)).toBe(7348.13);
      expect(roundCDMoney(7535.625)).toBe(7535.63);
      expect(roundCDMoney(1875.005)).toBe(1875.01);
      expect(roundCDMoney(29392.505)).toBe(29392.51);
      expect(roundCDMoney(22500.005)).toBe(22500.01);
    });
  });

  describe('FIX 2: Mixed History Mode A / Mode B Selection', () => {
    it('correctly resolves renewed days on a receipt-by-receipt basis instead of global switch', () => {
      const contract = buildCDContract({
        id: 'mock-loan-id',
        amount: 750000,
        interest_rate: 3,
        penalty_percent: 0.75,
        period_days: 30,
        date: '2025-02-18',
        status: 'Active',
      });

      const interestEvents = [
        { id: '1', entryDate: '2025-03-24', credit: 0, receiptNo: 'RC698', particulars: 'Renewal Note', renewedDays: 30, renewedTillDate: null, rowType: 'Renewal' },
        { id: '2', entryDate: '2025-04-19', credit: 0, receiptNo: 'RC699', particulars: 'Renewal Note', renewedDays: 30, renewedTillDate: null, rowType: 'Renewal' },
        { id: '3', entryDate: '2025-05-28', credit: 8125, receiptNo: 'RC700', particulars: 'Interest Payment', renewedDays: 0, renewedTillDate: null, rowType: 'interest_payment' },
        { id: '4', entryDate: '2025-05-30', credit: 0, receiptNo: 'RC701', particulars: 'Renewal Note', renewedDays: 6.67, renewedTillDate: null, rowType: 'Renewal' },
      ];

      const { exactRenewedDays } = getCDContractualPosition(contract, [], interestEvents);
      expect(exactRenewedDays).toBe(77.50);
    });
  });

  describe('FIX 3 & 4: Historical Rebuild Preservation and Date Immutability', () => {
    it('preserves manual historical renewed_days variance and does not mutate loan date', async () => {
      const state = getGlobalState();
      state.singleLoan = {
        id: 'mock-loan-rebuild',
        loan_id: 'CDX01',
        customer_id: 'mock-cust',
        amount: 750000,
        interest_rate: 3,
        penalty_percent: 0.75,
        period_days: 30,
        grace_days: 5,
        date: '2025-02-18',
        status: 'Active',
      };

      state.ledgerEntries = [
        { id: 'l1', loan_id: 'mock-loan-rebuild', entry_type: 'original_loan', entry_date: '2025-02-18', debit: 750000, credit: 0, receipt_no: null },
        { id: 'l2', loan_id: 'mock-loan-rebuild', entry_type: 'interest_payment', entry_date: '2025-03-24', debit: 0, credit: 8125, receipt_no: 'RCX01' },
        { id: 'l3', loan_id: 'mock-loan-rebuild', entry_type: 'penalty_payment', entry_date: '2025-03-24', debit: 0, credit: 1875, receipt_no: 'RCX01' },
        { id: 'l4', loan_id: 'mock-loan-rebuild', entry_type: 'amount_paid', entry_date: '2025-03-24', debit: 0, credit: 10000, receipt_no: 'RCX01' },
      ];

      state.interestDetails = [
        { id: 'i1', loan_id: 'mock-loan-rebuild', row_type: 'interest_payment', entry_date: '2025-03-24', credit: 8125, receipt_no: 'RCX01', renewed_days: 0 },
        { id: 'i2', loan_id: 'mock-loan-rebuild', row_type: 'penalty_payment', entry_date: '2025-03-24', credit: 1875, receipt_no: 'RCX01', renewed_days: 0 },
        { id: 'i3', loan_id: 'mock-loan-rebuild', row_type: 'Renewal', entry_date: '2025-03-24', credit: 0, receipt_no: 'RCX01', renewed_days: 10.67 }, // Persisted manual variance (10.67 vs 10.83 derived)
      ];

      state.transactions = [
        { id: 't1', loan_id: 'mock-loan-rebuild', type: 'Disbursement', date: '2025-02-18', amount: 750000, receipt_no: null },
        { id: 't2', loan_id: 'mock-loan-rebuild', type: 'Collection', date: '2025-03-24', amount: 10000, receipt_no: 'RCX01', remarks: 'Renew' },
      ];

      // Track interest detail adds to check what renewed_days are re-written
      vi.spyOn(supabaseFinance, 'addCDInterestDetail').mockImplementation((payload: any) => {
        state.addedInterestDetails.push(payload);
        return Promise.resolve(payload);
      });
      vi.spyOn(supabaseFinance, 'addCDLedgerEntry').mockImplementation((payload: any) => {
        return Promise.resolve({
          ...payload,
          id: 'mock-entry-id' // return mock entry id!
        });
      });

      const result = await cdLedgerRebuildService.rebuildCDLoanLifecycle('mock-loan-rebuild');
      expect(result.success).toBe(true);

      // 1. Verify that the Note row rebuilt for RCX01 preserves 10.67, NOT 10.83!
      const noteEntry = state.addedInterestDetails.find((d: any) => d.receipt_no === 'RCX01' && d.credit === 0 && d.row_type === 'Renewal');
      expect(noteEntry).toBeDefined();
      expect(noteEntry.renewed_days).toBe(10.67);

      // 2. Verify that finance_loans.date was NEVER mutated/updated
      expect(state.lastLoanUpdates).not.toBeNull();
      expect(state.lastLoanUpdates.date).toBeUndefined(); // 'date' key must not exist in update payload
    });
  });

  describe('FIX 4: Edit Loan Backend Guard Immutable Date', () => {
    it('rejects changes to loan date when ledger activity exists', async () => {
      // CD120 has ledger activity
      const CD120_LOAN_UUID = 'a9c4601a-6df4-434c-9915-7f4b827c6f21';
      
      // Setup mock data for this check
      const state = getGlobalState();
      state.singleLoan = {
        id: CD120_LOAN_UUID,
        loan_id: 'CD120',
        date: '2025-02-18',
        amount: 750000,
        interest_rate: 3,
        status: 'Active',
      };
      
      // Simulate that there is ledger activity
      state.ledgerEntries = [
        { id: '1', loan_id: CD120_LOAN_UUID, entry_type: 'interest_payment', entry_date: '2025-03-24', credit: 22500 }
      ];

      await expect(
        supabaseFinance.updateLoan(CD120_LOAN_UUID, { date: '2026-01-01' }, 'System Test')
      ).rejects.toThrow('CD_CONTRACT_FIELD_IMMUTABLE');
    });
  });
});
