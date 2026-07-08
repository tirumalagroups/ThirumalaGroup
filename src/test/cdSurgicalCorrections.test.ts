import { describe, it, expect } from 'vitest';
import * as cdLedgerEngine from '../services/cdLedgerEngine';
import { financeCalculationService } from '../services/financeCalculationService';
import { getLocalBusinessDateISO } from '../utils/dateUtils';

describe('CD Rebuild Surgical Corrections — Issue 1-3 Regression Tests', () => {

  // ===========================================================================
  // ISSUE 1: Engine and Gateway Due Date Alignment
  // ===========================================================================
  describe('Issue 1: Engine and Gateway Due Date Alignment', () => {
    it('aligns the due dates and exposes contractualPositionDate and fractionalCarry', () => {
      const mockLoan = {
        id: 'cd120-uuid',
        loan_id: 'CD120',
        date: '2025-02-18',
        amount: 750000,
        interest_rate: 3,
        penalty_percent: 0.75,
        period_days: 30,
        grace_days: 5
      };

      const ledgerEntries = [
        { entry_type: 'original_loan', entry_date: '2025-02-18', debit: 750000, credit: 0 },
        { entry_type: 'amount_paid', entry_date: '2026-06-29', debit: 0, credit: 18000 }
      ];

      const interestDetails = [
        { entry_date: '2025-03-24', credit: 0, renewed_days: 30 },
        { entry_date: '2025-04-19', credit: 0, renewed_days: 30 },
        { entry_date: '2025-05-28', credit: 0, renewed_days: 10.83 },
        { entry_date: '2025-05-30', credit: 0, renewed_days: 6.67 },
        { entry_date: '2025-06-03', credit: 0, renewed_days: 13.33 },
        { entry_date: '2025-06-23', credit: 0, renewed_days: 28.5 },
        { entry_date: '2025-08-06', credit: 0, renewed_days: 34.75 },
        { entry_date: '2025-08-26', credit: 0, renewed_days: 10.5 },
        { entry_date: '2025-09-12', credit: 0, renewed_days: 16.75 },
        { entry_date: '2025-09-26', credit: 0, renewed_days: 9.6 },
        { entry_date: '2025-10-27', credit: 0, renewed_days: 52.19 },
        { entry_date: '2025-12-08', credit: 0, renewed_days: 24.75 },
        { entry_date: '2026-01-05', credit: 0, renewed_days: 9.6 },
        { entry_date: '2026-01-14', credit: 0, renewed_days: 14.4 },
        { entry_date: '2026-02-03', credit: 0, renewed_days: 10.67 },
        { entry_date: '2026-02-07', credit: 0, renewed_days: 12.27 },
        { entry_date: '2026-03-05', credit: 0, renewed_days: 13.87 },
        { entry_date: '2026-03-20', credit: 0, renewed_days: 10.13 },
        { entry_date: '2026-04-02', credit: 0, renewed_days: 24 },
        { entry_date: '2026-05-02', credit: 0, renewed_days: 24 },
        { entry_date: '2026-06-01', credit: 0, renewed_days: 24 },
        { entry_date: '2026-06-29', credit: 0, renewed_days: 24 }
      ];

      // Get engine position as of 2026-07-06
      const enginePos = cdLedgerEngine.getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2026-07-06');
      
      expect(enginePos.currentDueDate).toBe('2026-05-28');
      expect(enginePos.contractualPositionDate).toBe('2026-05-27');
      expect(enginePos.fractionalCarry).toBe(0.81);

      // Get gateway position as of 2026-07-06
      const gatewayPos = financeCalculationService.getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2026-07-06');
      expect(gatewayPos.currentDueDate).toBe('2026-05-28');
      expect(gatewayPos.dueDateStr).toBe('2026-05-28');
    });
  });

  // ===========================================================================
  // ISSUE 2: UTC Payment Date Default Bug
  // ===========================================================================
  describe('Issue 2: Local Timezone Date Utilities', () => {
    it('returns the correct local date regardless of UTC time offset', () => {
      // Mock Date object at early morning 00:30 local time (which might still be previous day in UTC)
      // e.g. 2026-07-07 00:30 IST is 2026-07-06 19:00 UTC
      const customDate = new Date('2026-07-06T19:00:00Z'); // 19:00 UTC
      
      // If we use .toISOString().split('T')[0] on it, we get "2026-07-06"
      expect(customDate.toISOString().split('T')[0]).toBe('2026-07-06');

      // In local time, if the system runs in Asia/Kolkata timezone:
      // We manually construct dates with specific values to verify formatting:
      const dateString = getLocalBusinessDateISO(new Date(2026, 6, 7, 0, 30)); // July is index 6
      expect(dateString).toBe('2026-07-07');
    });
  });

  // ===========================================================================
  // ISSUE 3: Consolidate Close payment allocation
  // ===========================================================================
  describe('Issue 3: Close Action Payment Split Allocation', () => {
    const mockPos: cdLedgerEngine.CDAccountPosition = {
      principalBalance: 750000,
      originalLoanDate: '2025-02-18',
      periodDays: 30,
      baseDueDate: '2025-03-19',
      totalRenewedDays: 434.81,
      contractualPositionDate: '2026-05-27',
      currentDueDate: '2026-05-28',
      fractionalCarry: 0.81,
      displayDueDays: 39,
      exactDueDays: 39.19,
      dailyInterest: 750,
      dailyPenalty: 187.5,
      accruedInterest: 29392.50,
      accruedPenalty: 7348.13,
      todayDue: 36740.63,
      renewalAmount: 22500,
      totalToRegularize: 59240.63,
      initialContractualPositionStr: '2025-02-18',
      totalForClose: 786740.63,
      lastPaymentDate: '2026-06-29'
    } as cdLedgerEngine.CDAccountPosition;

    it('correctly allocates split for Close action with ₹7,86,740.63 (exact close amount)', () => {
      const split = cdLedgerEngine.allocateCDPayment(
        mockPos,
        786740.63,
        'Close',
        30
      );

      expect(split.penaltyPaid).toBe(7348.13);
      expect(split.interestPaid).toBe(29392.50);
      expect(split.principalPaid).toBe(750000.00);
      expect(split.renewedDays).toBe(0);
    });

    it('correctly allocates split for Close action with ₹7,87,678.13 (close amount for next day)', () => {
      const nextDayPos = {
        ...mockPos,
        accruedPenalty: 7535.63,
        accruedInterest: 30142.50
      };
      
      const split = cdLedgerEngine.allocateCDPayment(
        nextDayPos,
        787678.13,
        'Close',
        30
      );

      expect(split.penaltyPaid).toBe(7535.63);
      expect(split.interestPaid).toBe(30142.50);
      expect(split.principalPaid).toBe(750000.00);
      expect(split.renewedDays).toBe(0);
    });
  });
});
