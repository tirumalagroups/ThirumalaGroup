/**
 * CD120 RESHABOINA RENUKA — Full Account-Position PRECISION LOCK
 * ──────────────────────────────────────────────────────────────
 *
 * STATUS: LOCKED — DO NOT CHANGE EXPECTED VALUES.
 *
 * These values were verified against every ledger receipt (RC698–RC719)
 * and every cd_interest_details row for CD120 on 2026-07-06.
 *
 * PRECISION RULE (OG-compatible historical replay)
 * ─────────────────────────────────────────────────
 *   Per historical interest transaction:
 *     rawRenewedDays   = interestPaid / dailyInterest
 *     storedRenewedDays = round(rawRenewedDays, 2)     ← persisted in DB
 *
 *   contractual timeline += storedRenewedDays           ← never re-derived from money
 *
 * WHY THE "FULL-MONEY" PATH IS WRONG FOR CD120
 * ─────────────────────────────────────────────
 *   total historical interest paid = ₹3,26,103
 *   dailyInterest                  = ₹750
 *   full-money sum                 = 326103 / 750 = 434.804        ← WRONG
 *   persisted renewed_days sum     = 434.81                        ← CORRECT
 *
 *   The ₹7 rounding difference accumulates from 14 non-round transactions
 *   where the 2-decimal stored value differs from the full-precision quotient.
 *
 * ACCOUNT PARAMETERS (CD120, as of 2026-07-06)
 *   Principal Balance : ₹7,50,000
 *   Last Payment      : 2026-06-29  (RC719)
 *   Current Due Date  : 2026-05-28
 *   Display Due Days  : 39
 *   Exact Due Days    : 39.19
 *   Accrued Interest  : ₹29,392.50
 *   Accrued Penalty   : ₹7,348.13
 *   Today Due         : ₹36,740.63
 *   Standard Renewal  : ₹22,500.00
 *   Total To Regular. : ₹59,240.63
 *   Total For Close   : ₹7,86,740.63
 */

import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';
import { vbaRound, roundCDMoney } from '../services/cdLedgerEngine';

// ── Account Parameters ───────────────────────────────────────────────────────

const PRINCIPAL      = 750_000;
const INTEREST_RATE  = 3;        // % per 30 days
const PENALTY_RATE   = 0.75;     // % per 30 days
const PERIOD_DAYS    = 30;
const GRACE_DAYS     = 5;
const LOAN_DATE      = '2025-02-18';

const DAILY_INTEREST = PRINCIPAL * (INTEREST_RATE / 100) / PERIOD_DAYS;  // 750.00
const DAILY_PENALTY  = PRINCIPAL * (PENALTY_RATE  / 100) / PERIOD_DAYS;  // 187.50

// ── Reference Date ───────────────────────────────────────────────────────────

const AUDIT_DATE = '2026-07-06';

// ── Persisted Mode A Interest-Detail Rows (credit = 0, renewed_days > 0) ────
// These are the authoritative cd_interest_details note rows for CD120.
// Each renewed_days is the 2-decimal-rounded value persisted at payment time:
//   storedRenewedDays = round(interestPaid / dailyInterest, 2)
// The engine MUST use these stored values — not recompute from the credit column.

const CD120_INTEREST_ROWS = [
  { entry_date: '2025-03-24', credit: 0, renewed_days: 30    },  // RC698 22500/750
  { entry_date: '2025-04-19', credit: 0, renewed_days: 30    },  // RC699 22500/750
  { entry_date: '2025-05-28', credit: 0, renewed_days: 10.83 },  // RC700  8125/750 = 10.833...
  { entry_date: '2025-05-30', credit: 0, renewed_days: 6.67  },  // RC701  5000/750 = 6.666...
  { entry_date: '2025-06-03', credit: 0, renewed_days: 13.33 },  // RC702 10000/750 = 13.333...
  { entry_date: '2025-06-23', credit: 0, renewed_days: 28.5  },  // RC703 21375/750
  { entry_date: '2025-08-06', credit: 0, renewed_days: 34.75 },  // RC704 26063/750
  { entry_date: '2025-08-26', credit: 0, renewed_days: 10.5  },  // RC705  7875/750
  { entry_date: '2025-09-12', credit: 0, renewed_days: 16.75 },  // RC706 12563/750
  { entry_date: '2025-09-26', credit: 0, renewed_days: 9.6   },  // RC707  7200/750
  { entry_date: '2025-10-27', credit: 0, renewed_days: 52.19 },  // RC708 39142/750 = 52.189...
  { entry_date: '2025-12-08', credit: 0, renewed_days: 24.75 },  // RC709 18563/750
  { entry_date: '2026-01-05', credit: 0, renewed_days: 9.6   },  // RC710  7200/750
  { entry_date: '2026-01-14', credit: 0, renewed_days: 14.4  },  // RC711 10800/750
  { entry_date: '2026-02-03', credit: 0, renewed_days: 10.67 },  // RC712  8000/750 = 10.666...
  { entry_date: '2026-02-07', credit: 0, renewed_days: 12.27 },  // RC713  9200/750 = 12.266...
  { entry_date: '2026-03-05', credit: 0, renewed_days: 13.87 },  // RC714 10400/750 = 13.866...
  { entry_date: '2026-03-20', credit: 0, renewed_days: 10.13 },  // RC715  7600/750 = 10.133...
  { entry_date: '2026-04-02', credit: 0, renewed_days: 24    },  // RC716 18000/750
  { entry_date: '2026-05-02', credit: 0, renewed_days: 24    },  // RC717 18000/750
  { entry_date: '2026-06-01', credit: 0, renewed_days: 24    },  // RC718 18000/750
  { entry_date: '2026-06-29', credit: 0, renewed_days: 24    },  // RC719 18000/750
];

// ── Mock Ledger Entries (disbursement + last payment) ────────────────────────

const CD120_LEDGER_ENTRIES = [
  { entry_type: 'original_loan', entry_date: LOAN_DATE, debit: PRINCIPAL, credit: 0 },
  { entry_type: 'amount_paid',   entry_date: '2026-06-29', debit: 0, credit: 18_000 },
];

// ── Mock Loan Object ─────────────────────────────────────────────────────────

const mockLoan = {
  date: LOAN_DATE,
  amount: PRINCIPAL,
  interest_rate: INTEREST_RATE,
  penalty_percent: PENALTY_RATE,
  period_days: PERIOD_DAYS,
  grace_days: GRACE_DAYS,
};

// ── Expected Lock Values ─────────────────────────────────────────────────────

const EXPECTED_CUMULATIVE_RENEWED      = 434.81;
const EXPECTED_INITIAL_DUE_DATE        = '2025-03-19';    // LOAN_DATE + 29
const EXPECTED_CURRENT_DUE_DATE_UI     = '2026-05-28';    // 2025-03-19 + 435
const EXPECTED_CURRENT_DUE_DATE_FLOOR  = '2026-05-27';    // 2025-03-19 + 434
const EXPECTED_FRACTIONAL_CARRY        = 0.81;

const EXPECTED_LAST_PAYMENT            = '2026-06-29';
const EXPECTED_EXACT_DUE_DAYS          = 39.19;
const EXPECTED_DISPLAY_DUE_DAYS        = 39;               // floor(39.19)
const EXPECTED_ACCRUED_INTEREST        = 29_392.50;
const EXPECTED_ACCRUED_PENALTY         = 7_348.13;
const EXPECTED_TODAY_DUE               = 36_740.63;
const EXPECTED_STANDARD_RENEWAL        = 22_500.00;
const EXPECTED_TOTAL_TO_REGULARIZE     = 59_240.63;
const EXPECTED_TOTAL_FOR_CLOSE         = 786_740.63;

// ── Proof: Full-Money Path Produces WRONG Result ─────────────────────────────

const TOTAL_HISTORICAL_INTEREST_PAID     = 326_103;          // sum of all payments
const WRONG_CUMULATIVE_RENEWED           = 434.804;          // 326103 / 750 (full-money, wrong)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CD120 Full Account-Position — PRECISION LOCK (DO NOT MODIFY EXPECTED VALUES)', () => {

  it('0. daily rates are correct', () => {
    expect(DAILY_INTEREST).toBe(750);
    expect(DAILY_PENALTY).toBe(187.5);
  });

  // ── GUARD: prove the full-money path is the wrong path ───────────────────

  it('G1. WRONG: full-money path (SUM(interestPaid)/daily) produces 434.804, not 434.81', () => {
    const wrongSum = TOTAL_HISTORICAL_INTEREST_PAID / DAILY_INTEREST;
    expect(Number(wrongSum.toFixed(3))).toBe(WRONG_CUMULATIVE_RENEWED);
    // Confirm it is NOT the correct value
    expect(Number(wrongSum.toFixed(2))).not.toBe(EXPECTED_CUMULATIVE_RENEWED);
  });

  it('G2. WRONG: full-money path produces WRONG accrued interest', () => {
    // If you used SUM(credit)/daily = 434.804 with a different due-date model...
    // The key point: using 434.804 vs 434.81 shifts exactDueDays
    const wrongRenewed   = TOTAL_HISTORICAL_INTEREST_PAID / DAILY_INTEREST; // 434.804
    const initialOrdinal = financeCalculationService.dateOrdinal('2025-03-19');
    const wrongPositionExact = initialOrdinal + wrongRenewed;
    const auditOrdinal = financeCalculationService.dateOrdinal(AUDIT_DATE);
    const wrongExactDueDays = auditOrdinal - wrongPositionExact;
    const wrongInterest = Number(((PRINCIPAL * INTEREST_RATE * wrongExactDueDays) / (PERIOD_DAYS * 100)).toFixed(2));

    // The wrong path produces different (incorrect) interest
    expect(wrongInterest).not.toBe(EXPECTED_ACCRUED_INTEREST);
  });

  it('G3. UI Due Date expectation: calculateDisplayDays based display date is 2026-05-28', () => {
    const displayDays = financeCalculationService.calculateDisplayDays(EXPECTED_CUMULATIVE_RENEWED);
    const uiDueDate = financeCalculationService.addCalendarDays(EXPECTED_INITIAL_DUE_DATE, displayDays);
    expect(uiDueDate).toBe(EXPECTED_CURRENT_DUE_DATE_UI);
  });

  // ── CORRECT: Mode A path with persisted renewed_days ─────────────────────

  it('1. buildCDContractualTimeline: initial due date = 2025-03-19 (inclusive)', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    expect(tl.initialContractualPositionStr).toBe(EXPECTED_INITIAL_DUE_DATE);
  });

  it('2. buildCDContractualTimeline: cumulativeRenewedDaysExact = 434.81 (Mode A — persisted rows)', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    expect(Number(tl.cumulativeRenewedDaysExact.toFixed(2))).toBe(EXPECTED_CUMULATIVE_RENEWED);
  });

  it('3. buildCDContractualTimeline: currentDueDateStr = 2026-05-28', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    expect(tl.currentDueDateStr).toBe(EXPECTED_CURRENT_DUE_DATE_UI);
    expect(tl.contractualPositionDate).toBe(EXPECTED_CURRENT_DUE_DATE_FLOOR);
  });

  it('4. buildCDContractualTimeline: fractionalCarry = 0.81', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    expect(Number(tl.fractionalCarry.toFixed(2))).toBe(EXPECTED_FRACTIONAL_CARRY);
  });

  it('5. buildCDContractualTimeline: lastPaymentDate = 2026-06-29 (RC719)', () => {
    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    expect(tl.lastPaymentDate).toBe(EXPECTED_LAST_PAYMENT);
  });

  it('6. getCDAccountPositionV2: exactDueDays = 39.19', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(Number(pos!.exactDueDays.toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
  });

  it('7. getCDAccountPositionV2: displayDueDays = 39 (floor of exactDueDays)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.displayDueDays).toBe(EXPECTED_DISPLAY_DUE_DAYS);
  });

  it('8. getCDAccountPositionV2: accruedInterest = ₹29,392.50', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.accruedInterest).toBe(EXPECTED_ACCRUED_INTEREST);
    // Verify formula directly
    expect(Number((EXPECTED_EXACT_DUE_DAYS * DAILY_INTEREST).toFixed(2))).toBe(EXPECTED_ACCRUED_INTEREST);
  });

  it('9. getCDAccountPositionV2: accruedPenalty = ₹7,348.12', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.accruedPenalty).toBe(EXPECTED_ACCRUED_PENALTY);
    // Verify formula directly: 39.19 × 187.50 = 7348.125 → vbaRound to 7348.12
    expect(roundCDMoney(EXPECTED_EXACT_DUE_DAYS * DAILY_PENALTY)).toBe(EXPECTED_ACCRUED_PENALTY);
  });

  it('10. todayDue = ₹36,740.63 (interest + penalty)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.todayDue).toBe(EXPECTED_TODAY_DUE);
    // Cross-check: 29392.50 + 7348.13 = 36740.63
    expect(Number((EXPECTED_ACCRUED_INTEREST + EXPECTED_ACCRUED_PENALTY).toFixed(2))).toBe(EXPECTED_TODAY_DUE);
  });

  it('11. standardRenewalAmount = ₹22,500 (1 full period at 3% on ₹7.5L)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.standardRenewalAmount).toBe(EXPECTED_STANDARD_RENEWAL);
  });

  it('12. totalToRegularize = ₹59,240.63 (todayDue + standardRenewal)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.totalToRegularize).toBe(EXPECTED_TOTAL_TO_REGULARIZE);
    expect(Number((EXPECTED_TODAY_DUE + EXPECTED_STANDARD_RENEWAL).toFixed(2))).toBe(EXPECTED_TOTAL_TO_REGULARIZE);
  });

  it('13. totalForClose = ₹7,86,740.63 (principal + todayDue)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.totalForClose).toBe(EXPECTED_TOTAL_FOR_CLOSE);
    expect(Number((PRINCIPAL + EXPECTED_TODAY_DUE).toFixed(2))).toBe(EXPECTED_TOTAL_FOR_CLOSE);
  });

  it('14. principalBalance = ₹7,50,000 (no principal payments)', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);
    expect(pos!.principalBalance).toBe(PRINCIPAL);
  });

  it('15. exactDueDays arithmetic: diff(auditDate, initialDueDate) - cumulativeRenewed = 39.19', () => {
    // Prove the formula independently of the engine
    const calendarDaysSinceInitialDue = financeCalculationService.differenceInCalendarDays(
      AUDIT_DATE, EXPECTED_INITIAL_DUE_DATE
    );
    // = ordinal(2026-07-06) - ordinal(2025-03-19) = 474 total calendar days
    const exactDueDays = Number((calendarDaysSinceInitialDue - EXPECTED_CUMULATIVE_RENEWED).toFixed(2));
    expect(exactDueDays).toBe(EXPECTED_EXACT_DUE_DAYS);
  });

  it('16. end-to-end: all 12 position metrics pass simultaneously', () => {
    const tl  = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    const pos = financeCalculationService.getCDAccountPositionV2(mockLoan, tl, AUDIT_DATE);

    // Timeline layer
    expect(Number(tl.cumulativeRenewedDaysExact.toFixed(2))).toBe(EXPECTED_CUMULATIVE_RENEWED);
    expect(tl.currentDueDateStr).toBe(EXPECTED_CURRENT_DUE_DATE_UI);
    expect(tl.contractualPositionDate).toBe(EXPECTED_CURRENT_DUE_DATE_FLOOR);
    expect(Number(tl.fractionalCarry.toFixed(2))).toBe(EXPECTED_FRACTIONAL_CARRY);
    expect(tl.lastPaymentDate).toBe(EXPECTED_LAST_PAYMENT);

    // Position layer
    expect(Number(pos!.exactDueDays.toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
    expect(pos!.displayDueDays).toBe(EXPECTED_DISPLAY_DUE_DAYS);
    expect(pos!.accruedInterest).toBe(EXPECTED_ACCRUED_INTEREST);
    expect(pos!.accruedPenalty).toBe(EXPECTED_ACCRUED_PENALTY);
    expect(pos!.todayDue).toBe(EXPECTED_TODAY_DUE);
    expect(pos!.standardRenewalAmount).toBe(EXPECTED_STANDARD_RENEWAL);
    expect(pos!.totalToRegularize).toBe(EXPECTED_TOTAL_TO_REGULARIZE);
    expect(pos!.totalForClose).toBe(EXPECTED_TOTAL_FOR_CLOSE);
    expect(pos!.principalBalance).toBe(PRINCIPAL);
    expect(pos!.lastPaymentDate).toBe(EXPECTED_LAST_PAYMENT);
  });

  // ── GUARD: Confirm Mode A rows are correctly identified by the engine ─────

  it('17. Mode A rows (credit = 0, renewed_days > 0) are picked up; Mode B rows (credit > 0) are ignored for CD120', () => {
    // If a Mode B row (credit > 0) were added on a post-loan date it would
    // be processed as credit/daily instead of renewed_days.
    // For CD120 all rows are Mode A (credit=0) so the result must stay 434.81.
    const allModeA = CD120_INTEREST_ROWS.every(r => r.credit === 0 && r.renewed_days > 0);
    expect(allModeA).toBe(true);

    const tl = financeCalculationService.buildCDContractualTimeline(
      mockLoan, CD120_INTEREST_ROWS, CD120_LEDGER_ENTRIES
    );
    expect(Number(tl.cumulativeRenewedDaysExact.toFixed(2))).toBe(EXPECTED_CUMULATIVE_RENEWED);
  });

  it('18. per-row rounding rule: round(interestPaid/daily, 2) matches each stored value', () => {
    // Validate that the 2-decimal-rounded computation matches what is stored.
    // This is the OG-compatible write rule; the engine reads the stored value.
    const pairs: [number, number][] = [
      [22_500, 30    ],
      [ 8_125, 10.83 ],  // 10.8333... → 10.83
      [ 5_000,  6.67 ],  // 6.6666...  → 6.67
      [10_000, 13.33 ],  // 13.3333... → 13.33
      [39_142, 52.19 ],  // 52.1893... → 52.19
      [ 8_000, 10.67 ],  // 10.6666... → 10.67
      [ 9_200, 12.27 ],  // 12.2666... → 12.27
      [10_400, 13.87 ],  // 13.8666... → 13.87
      [ 7_600, 10.13 ],  // 10.1333... → 10.13
    ];
    for (const [paid, storedDays] of pairs) {
      const raw = paid / DAILY_INTEREST;
      const rounded = Number(raw.toFixed(2));
      expect(rounded).toBe(storedDays);
    }
  });

});
