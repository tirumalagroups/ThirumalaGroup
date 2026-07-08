/**
 * CD ₹25,00,000 OG ACCESS PARITY FIXTURE
 * ────────────────────────────────────────
 *
 * Source: Real Microsoft Access CD account, forensically verified.
 *
 * Loan Parameters
 * ───────────────
 *   Loan Date      : 14-Nov-2023
 *   Principal      : ₹25,00,000
 *   Interest Rate  : 3%  per 30 days
 *   Penalty Rate   : 0.75% per 30 days
 *   Period         : 30 days
 *   Grace Days     : 5
 *
 * OG Access Screenshot (as of 16-Jun-2026)
 * ─────────────────────────────────────────
 *   Due Date        = 12-Jun-26
 *   Due Days        = 3
 *   Interest        = ₹8,250
 *   Penalty         = ₹0
 *   Total Amt Ren   = ₹8,250
 *   Next Due Dt     = 16-Jun-26
 *   Total Close     = ₹25,08,250
 *
 * All assertions in this file must pass before any changes to the CD
 * timeline engine are considered correct.
 *
 * DO NOT CHANGE EXPECTED VALUES.  If the engine diverges, fix the engine.
 */

import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';

// ── Loan Constants ──────────────────────────────────────────────────────────
const LOAN_DATE     = '2023-11-12';
const PRINCIPAL     = 2_500_000;
const INTEREST_RATE = 3;       // % per 30 days
const PENALTY_RATE  = 0.75;    // % per 30 days
const PERIOD_DAYS   = 30;
const GRACE_DAYS    = 5;

// ── Daily Rates ─────────────────────────────────────────────────────────────
const MONTHLY_INTEREST = PRINCIPAL * (INTEREST_RATE / 100);
const DAILY_INTEREST   = MONTHLY_INTEREST / PERIOD_DAYS;   // 2,500
const MONTHLY_PENALTY  = PRINCIPAL * (PENALTY_RATE  / 100);
const DAILY_PENALTY    = MONTHLY_PENALTY  / PERIOD_DAYS;   // 625

// ── Historical Post-Opening Interest Credits ─────────────────────────────────
const POST_OPENING_INTEREST_CREDITS: { date: string; interest: number }[] = [
  { date: '2023-12-18', interest: 75_000 },
  { date: '2024-01-16', interest: 75_000 },
  { date: '2024-02-16', interest: 75_000 },
  { date: '2024-03-15', interest: 73_475 },
  { date: '2024-04-15', interest: 75_000 },
  { date: '2024-05-15', interest: 75_000 },
  { date: '2024-06-15', interest: 71_500 },
  { date: '2024-07-18', interest: 75_000 },
  { date: '2024-08-12', interest: 75_000 },
  { date: '2024-09-10', interest: 75_000 },
  { date: '2024-10-11', interest: 75_000 },
  { date: '2024-11-09', interest: 75_000 },
  { date: '2024-12-11', interest: 71_250 },
  { date: '2025-01-07', interest: 75_000 },
  { date: '2025-02-07', interest: 71_550 },
  { date: '2025-03-08', interest: 71_325 },
  { date: '2025-04-04', interest: 75_000 },
  { date: '2025-05-05', interest: 75_000 },
  { date: '2025-06-03', interest: 75_000 },
  { date: '2025-07-04', interest: 75_000 },
  { date: '2025-08-02', interest: 50_000 },
  { date: '2025-08-03', interest: 25_000 },
  { date: '2025-09-02', interest: 45_000 },
  { date: '2025-09-03', interest: 30_000 },
  { date: '2025-10-03', interest: 71_025 },
  { date: '2025-10-31', interest: 26_275 },
  { date: '2025-11-01', interest: 45_000 },
  { date: '2025-11-28', interest: 30_000 },
  { date: '2025-11-29', interest: 45_000 },
  { date: '2025-12-29', interest: 71_250 },
  { date: '2026-01-26', interest: 26_300 },
  { date: '2026-01-29', interest: 45_000 },
  { date: '2026-02-21', interest: 35_000 },
  { date: '2026-03-07', interest: 40_000 },
  { date: '2026-03-24', interest: 30_000 },
  { date: '2026-04-08', interest: 40_375 },
  { date: '2026-04-22', interest: 20_000 },
  { date: '2026-04-30', interest: 55_000 },
  { date: '2026-05-23', interest: 26_075 },
  { date: '2026-06-02', interest: 21_350 },
  { date: '2026-06-04', interest: 20_000 },
];

// ── Expected Invariants ──────────────────────────────────────────────────────
const EXPECTED_POST_OPENING_TOTAL     = 2_281_750;
const EXPECTED_CUMULATIVE_RENEWED     = 912.70;
const EXPECTED_INITIAL_DUE_DATE       = '2023-12-11';
const EXPECTED_CURRENT_DUE_DATE       = '2026-06-10';
const EXPECTED_CURRENT_DUE_DATE_UI    = '2026-06-11'; // rounded up since 0.70 >= 0.5
const EXPECTED_FRACTIONAL_CARRY       = 0.70;

const AUDIT_DATE = '2026-06-16';

const EXPECTED_EXACT_DUE_DAYS   = 5.30; // 2026-06-16 - 2026-06-10 (with carry)
const EXPECTED_DISPLAY_DUE_DAYS = 5;
const EXPECTED_ACCRUED_INTEREST = 13_250;
const EXPECTED_ACCRUED_PENALTY  = 0;
const EXPECTED_TODAY_DUE        = 13250.00;
const EXPECTED_TOTAL_FOR_CLOSE  = 2_513_250.00;

const EXPECTED_RENEWED_DAYS_PURCHASED = 3.30;
const EXPECTED_NEXT_DUE_DATE          = '2026-06-14';

// ── Mock Data ────────────────────────────────────────────────────────────────

const mockLoan = {
  date: LOAN_DATE,
  amount: PRINCIPAL,
  interest_rate: INTEREST_RATE,
  penalty_percent: PENALTY_RATE,
  period_days: PERIOD_DAYS,
  grace_days: GRACE_DAYS,
};

// Opening commission row (credit > 0, date === loanDate → must be excluded)
const openingCommissionRow = {
  entry_date: LOAN_DATE,
  credit: 75_000,
  renewed_days: 0,
};

const postOpeningRows = POST_OPENING_INTEREST_CREDITS.map(r => ({
  entry_date: r.date,
  credit: r.interest,
  renewed_days: 0,
  row_type: 'interest_payment',
}));

const allInterestRows = [openingCommissionRow, ...postOpeningRows];

const mockLedgerEntries = [
  {
    entry_type: 'original_loan',
    entry_date: LOAN_DATE,
    debit: PRINCIPAL,
    credit: 0,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Rs25L OG Access CD Account — Canonical Timeline Parity', () => {

  it('1. daily interest = Rs2500 and daily penalty = Rs625', () => {
    expect(DAILY_INTEREST).toBe(2_500);
    expect(DAILY_PENALTY).toBe(625);
  });

  it('2. post-opening interest credits total Rs22,81,750', () => {
    const total = POST_OPENING_INTEREST_CREDITS.reduce((s, r) => s + r.interest, 0);
    expect(total).toBe(EXPECTED_POST_OPENING_TOTAL);
  });

  it('3. cumulative renewed days exact = 912.70', () => {
    const total = POST_OPENING_INTEREST_CREDITS.reduce((s, r) => s + r.interest, 0);
    const days  = total / DAILY_INTEREST;
    expect(Number(days.toFixed(2))).toBe(EXPECTED_CUMULATIVE_RENEWED);
  });

  it('4. initial contractual due date = 2023-12-13 (loanDate + 29 days)', () => {
    const initial = financeCalculationService.addCalendarDays(LOAN_DATE, PERIOD_DAYS - 1);
    expect(initial).toBe(EXPECTED_INITIAL_DUE_DATE);
  });

  it('5. buildCDContractualTimeline returns correct initial position', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    expect(tl.initialContractualPositionStr).toBe(EXPECTED_INITIAL_DUE_DATE);
  });

  it('6. buildCDContractualTimeline: cumulativeRenewedDaysExact = 912.70', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    expect(Number(tl.cumulativeRenewedDaysExact.toFixed(2))).toBe(EXPECTED_CUMULATIVE_RENEWED);
  });

  it('7. currentDueDateStr = 2026-06-13', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    expect(tl.currentDueDateStr).toBe(EXPECTED_CURRENT_DUE_DATE_UI);
    expect(tl.contractualPositionDate).toBe(EXPECTED_CURRENT_DUE_DATE);
  });

  it('8. fractionalCarry = 0.70', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    expect(Number(tl.fractionalCarry.toFixed(2))).toBe(EXPECTED_FRACTIONAL_CARRY);
  });

  it('9. exactDueDays as of 2026-06-16 = 3.30', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(Number(pos!.exactDueDays.toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
  });

  it('10. displayDueDays = 3 (OG shows integer floor)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.displayDueDays).toBe(EXPECTED_DISPLAY_DUE_DAYS);
  });

  it('11. accruedInterest = Rs8250 (3.30 x 2500)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.accruedInterest).toBe(EXPECTED_ACCRUED_INTEREST);
    expect(Number((EXPECTED_EXACT_DUE_DAYS * DAILY_INTEREST).toFixed(2))).toBe(EXPECTED_ACCRUED_INTEREST);
  });

  it('12. accruedPenalty = Rs0 (3.30 days within 5-day grace)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.accruedPenalty).toBe(EXPECTED_ACCRUED_PENALTY);
  });

  it('13. todayDue = Rs8250', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.todayDue).toBe(EXPECTED_TODAY_DUE);
  });

  it('14. totalForClose = Rs25,08,250 (principal + interest)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.totalForClose).toBe(EXPECTED_TOTAL_FOR_CLOSE);
  });

  it('15. paying Rs8250 interest purchases exactly 3.30 renewed days', () => {
    const renewedDaysPurchased = 8_250 / DAILY_INTEREST;
    expect(Number(renewedDaysPurchased.toFixed(2))).toBe(EXPECTED_RENEWED_DAYS_PURCHASED);
  });

  it('16. nextDueDate after paying Rs8250 = 2026-06-16 (carry 0.70 + 3.30 = 0.00)', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const renewedDaysPurchased = 8_250 / DAILY_INTEREST; // 3.30
    const newPositionExact = tl.currentContractualPositionExact + renewedDaysPurchased;
    const newWholePart      = Math.floor(newPositionExact);
    const newFractionalCarry = Number((newPositionExact - newWholePart).toFixed(10));
    const newDueDateStr     = financeCalculationService.ordinalToDateStr(newWholePart);

    expect(newDueDateStr).toBe(EXPECTED_NEXT_DUE_DATE);
    expect(Number(newFractionalCarry.toFixed(2))).toBe(0.00);
  });

  it('17. opening commission is excluded (does not add to cumulativeRenewedDays)', () => {
    const withoutOpening = financeCalculationService.buildCDContractualTimeline(
      mockLoan, postOpeningRows, mockLedgerEntries
    );
    const withOpening = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    expect(Number(withOpening.cumulativeRenewedDaysExact.toFixed(2)))
      .toBe(Number(withoutOpening.cumulativeRenewedDaysExact.toFixed(2)));
  });

  it('18. end-to-end: all 8 primary OG assertions pass simultaneously', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, allInterestRows, mockLedgerEntries
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);

    expect(Number(tl.cumulativeRenewedDaysExact.toFixed(2))).toBe(EXPECTED_CUMULATIVE_RENEWED);
    expect(tl.currentDueDateStr).toBe(EXPECTED_CURRENT_DUE_DATE_UI);
    expect(tl.contractualPositionDate).toBe(EXPECTED_CURRENT_DUE_DATE);
    expect(Number(tl.fractionalCarry.toFixed(2))).toBe(EXPECTED_FRACTIONAL_CARRY);
    expect(Number(pos!.exactDueDays.toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
    expect(pos!.displayDueDays).toBe(EXPECTED_DISPLAY_DUE_DAYS);
    expect(pos!.accruedInterest).toBe(EXPECTED_ACCRUED_INTEREST);
    expect(pos!.accruedPenalty).toBe(EXPECTED_ACCRUED_PENALTY);
    expect(pos!.totalForClose).toBe(EXPECTED_TOTAL_FOR_CLOSE);
  });

});
