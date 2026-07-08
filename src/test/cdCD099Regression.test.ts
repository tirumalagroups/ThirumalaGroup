/**
 * CD099 REGRESSION TEST STUB
 *
 * STATUS: BLOCKED — Cannot write expected values until CD099's actual
 * payment history is entered and confirmed in the database.
 *
 * WHAT IS KNOWN (from forensic audit 2026-07-06):
 *   - loan_id:       CD099
 *   - loan_date:     2023-10-05
 *   - principal:     ₹4,00,000
 *   - rate:          3%
 *   - penalty:       0.75%
 *   - period_days:   30
 *   - baseDueDate:   2023-11-03  (loanDate + 29 days, inclusive-cycle)
 *   - dailyInterest: ₹400.00/day
 *
 * WHAT IS BROKEN:
 *   - cd_interest_details: 0 rows (completely empty)
 *   - cd_ledger_entries:   0 rows (completely empty)
 *   - loan_transactions (Collections): 0 rows
 *
 * WHAT THE UI CURRENTLY SHOWS (WRONG):
 *   - currentDueDate:  2023-11-03  (baseDue — no renewals applied)
 *   - rawDueDays:      976
 *   - accruedInterest: ₹3,90,400  (correct arithmetic, wrong input)
 *   - accruedPenalty:  ₹97,600
 *   - totalForClose:   ₹8,88,000
 *
 * HOW TO UNBLOCK:
 *   1. Retrieve CD099's actual payment history from the legacy Access system.
 *   2. Enter payments through the CD Ledger UI (partial/renewal payment flow).
 *   3. Run Rebuild from the CD Ledger UI.
 *   4. Query the db for the resulting cd_interest_details rows.
 *   5. Replace the TODO values below with actual DB-verified values.
 *   6. Uncomment the tests.
 *
 * DO NOT FABRICATE EXPECTED VALUES. DO NOT HARDCODE GUESSED AMOUNTS.
 */

import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';

// ── loan constants (verified from DB 2026-07-06) ──────────────────────────────
const LOAN_DATE       = '2023-10-05';
const PERIOD_DAYS     = 30;
const PRINCIPAL       = 400_000;
const INTEREST_RATE   = 3;
const PENALTY_PERCENT = 0.75;
const AUDIT_DATE      = '2026-07-06';

// Inclusive-cycle: Day 1 = LoanDate, DueDate = LoanDate + (period - 1)
// BASE_DUE_DATE = '2023-11-03' (manually verified: 2023-10-05 + 29 = 2023-11-03)
const DAILY_INTEREST  = (PRINCIPAL * INTEREST_RATE) / (100 * PERIOD_DAYS); // 400.00

describe('CD099 — Forensic Regression Tests (BLOCKED pending payment history)', () => {

  it('verifies loan constants are correct', () => {
    expect(LOAN_DATE).toBe('2023-10-05');
    const baseDue = financeCalculationService.addCalendarDays(LOAN_DATE, PERIOD_DAYS - 1);
    expect(baseDue).toBe('2023-11-03');
    expect(DAILY_INTEREST).toBe(400);
    expect(financeCalculationService.differenceInCalendarDays(AUDIT_DATE, baseDue)).toBe(976);
  });

  it('confirms zero renewals produce 976 due days on 2026-07-06', () => {
    const baseDue = financeCalculationService.addCalendarDays(LOAN_DATE, PERIOD_DAYS - 1);
    const totalRenewedDays = 0; // current DB state — no note rows
    const rawDueDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, baseDue) - totalRenewedDays;
    expect(rawDueDays).toBe(976);

    // This produces the wrong (inflated) interest currently shown in UI:
    const wrongInterest = (PRINCIPAL * INTEREST_RATE * rawDueDays) / (PERIOD_DAYS * 100);
    expect(wrongInterest).toBe(390_400);
  });

  /**
   * TODO: Uncomment and fill in the correct values once CD099's payment
   * history has been entered and the rebuild has been run.
   *
   * Replace each TODO_* with the actual verified value from the DB.
   */

  // it('CORRECT: total exact renewed days equals the DB sum of credit=0 note rows', () => {
  //   const TODO_TOTAL_EXACT_RENEWED_DAYS = NaN; // fill from DB
  //   expect(TODO_TOTAL_EXACT_RENEWED_DAYS).toBeGreaterThan(0);
  // });

  // it('CORRECT: display renewed days rounds correctly', () => {
  //   const TODO_TOTAL_EXACT_RENEWED_DAYS = NaN;
  //   const TODO_DISPLAY_DAYS = NaN;
  //   expect(calculateDisplayDays(TODO_TOTAL_EXACT_RENEWED_DAYS)).toBe(TODO_DISPLAY_DAYS);
  // });

  // it('CORRECT: current due date on 2026-07-06', () => {
  //   const TODO_DISPLAY_DAYS = NaN;
  //   const TODO_CURRENT_DUE_DATE = 'YYYY-MM-DD';
  //   expect(addCalendarDays(BASE_DUE_DATE, TODO_DISPLAY_DAYS)).toBe(TODO_CURRENT_DUE_DATE);
  // });

  // it('CORRECT: accrued interest on 2026-07-06', () => {
  //   const TODO_TOTAL_EXACT_RENEWED_DAYS = NaN;
  //   const rawDueDays = differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - TODO_TOTAL_EXACT_RENEWED_DAYS;
  //   const interest = (PRINCIPAL * INTEREST_RATE * rawDueDays) / (PERIOD_DAYS * 100);
  //   const TODO_EXPECTED_INTEREST = NaN;
  //   expect(interest).toBeCloseTo(TODO_EXPECTED_INTEREST, 2);
  // });

  // it('CORRECT: accrued penalty on 2026-07-06', () => {
  //   const TODO_TOTAL_EXACT_RENEWED_DAYS = NaN;
  //   const rawDueDays = differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - TODO_TOTAL_EXACT_RENEWED_DAYS;
  //   const penalty = (PRINCIPAL * PENALTY_PERCENT * rawDueDays) / (PERIOD_DAYS * 100);
  //   const TODO_EXPECTED_PENALTY = NaN;
  //   expect(penalty).toBeCloseTo(TODO_EXPECTED_PENALTY, 2);
  // });
});
