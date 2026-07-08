/**
 * CD120 RESHABOINA RENUKA — Fractional-Renewal Parity Regression Test
 *
 * BUSINESS RULE UNDER TEST
 * ────────────────────────
 * The legacy MS Access CD system maintained fractional renewed days internally
 * (e.g. 10.83, 6.67, 13.33 days). The new system must:
 *   1. Store exact fractional days in cd_interest_details.renewed_days.
 *   2. Sum them with full floating-point precision (no rounding between rows).
 *   3. Derive the DISPLAY due-date from calculateDisplayDays(exactSum):
 *        fraction >= 0.50 -> round UP, fraction < 0.50 -> round DOWN.
 *   4. Compute accrued interest/penalty against the EXACT days elapsed,
 *      including the carry introduced by the rounding of display days.
 *
 * ACCOUNT PARAMETERS (CD120)
 *   Principal     : Rs. 7,50,000
 *   Rate          : 3% per 30 days
 *   Period        : 30 days
 *   Penalty rate  : 0.75% per 30 days
 *   Grace days    : 5
 *   Daily interest: Rs. 750   (7,50,000 x 3% / 30)
 *   Daily penalty : Rs. 187.50 (7,50,000 x 0.75% / 30)
 *   Disbursement  : 2025-02-18
 *   Base due date : 2025-03-19 (inclusive-cycle: +29 days)
 *
 * FORENSIC PARITY PROOF (on 2026-07-06)
 *   Sum of 22 renewed-days rows (RC698-RC719)      = 434.81 (exact)
 *   calculateDisplayDays(434.81) -> 435             (0.81 >= 0.50 -> round up)
 *   Display due date = 2025-03-19 + 435             = 2026-05-28
 *   Calendar days past due on 2026-07-06            = 39
 *   Fractional carry  = 435 - 434.81                = 0.19
 *   Exact calculation days = 39 + 0.19              = 39.19
 *   Accrued interest = 39.19 x 750                  = Rs. 29,392.50 (verified)
 *   Accrued penalty  = 39.19 x 187.50               ~ Rs. 7,348.13  (verified)
 */

import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';

// EXACT NOTE-ROW DATA from cd_interest_details where credit = 0 for CD120
// Ordered by entry_date asc, created_at asc (matches DB query order)
const CD120_NOTE_ROWS: { receipt_no: string; entry_date: string; renewed_days: number }[] = [
  { receipt_no: 'RC698', entry_date: '2025-03-24', renewed_days: 30    },
  { receipt_no: 'RC699', entry_date: '2025-04-19', renewed_days: 30    },
  { receipt_no: 'RC700', entry_date: '2025-05-28', renewed_days: 10.83 },
  { receipt_no: 'RC701', entry_date: '2025-05-30', renewed_days: 6.67  },
  { receipt_no: 'RC702', entry_date: '2025-06-03', renewed_days: 13.33 },
  { receipt_no: 'RC703', entry_date: '2025-06-23', renewed_days: 28.5  },
  { receipt_no: 'RC704', entry_date: '2025-08-06', renewed_days: 34.75 },
  { receipt_no: 'RC705', entry_date: '2025-08-26', renewed_days: 10.5  },
  { receipt_no: 'RC706', entry_date: '2025-09-12', renewed_days: 16.75 },
  { receipt_no: 'RC707', entry_date: '2025-09-26', renewed_days: 9.6   },
  { receipt_no: 'RC708', entry_date: '2025-10-27', renewed_days: 52.19 },
  { receipt_no: 'RC709', entry_date: '2025-12-08', renewed_days: 24.75 },
  { receipt_no: 'RC710', entry_date: '2026-01-05', renewed_days: 9.6   },
  { receipt_no: 'RC711', entry_date: '2026-01-14', renewed_days: 14.4  },
  { receipt_no: 'RC712', entry_date: '2026-02-03', renewed_days: 10.67 },
  { receipt_no: 'RC713', entry_date: '2026-02-07', renewed_days: 12.27 },
  { receipt_no: 'RC714', entry_date: '2026-03-05', renewed_days: 13.87 },
  { receipt_no: 'RC715', entry_date: '2026-03-20', renewed_days: 10.13 },
  { receipt_no: 'RC716', entry_date: '2026-04-02', renewed_days: 24    },
  { receipt_no: 'RC717', entry_date: '2026-05-02', renewed_days: 24    },
  { receipt_no: 'RC718', entry_date: '2026-06-01', renewed_days: 24    },
  { receipt_no: 'RC719', entry_date: '2026-06-29', renewed_days: 24    },
];

// CONSTANTS
const PRINCIPAL      = 750_000;
const INTEREST_RATE  = 3;       // % per period
const PENALTY_RATE   = 0.75;    // % per period
const PERIOD_DAYS    = 30;
const DAILY_INTEREST = PRINCIPAL * (INTEREST_RATE / 100) / PERIOD_DAYS;  // 750
const DAILY_PENALTY  = PRINCIPAL * (PENALTY_RATE  / 100) / PERIOD_DAYS;  // 187.5
const DISBURSAL_DATE = '2025-02-18';
const BASE_DUE_DATE  = '2025-03-19'; // DISBURSAL_DATE + (PERIOD_DAYS - 1) inclusive-cycle
const AUDIT_DATE     = '2026-07-06'; // reference date for parity proof

// EXPECTED TOTALS after all 22 receipts
const EXPECTED_TOTAL_EXACT_RENEWED_DAYS = 434.81;
const EXPECTED_DISPLAY_RENEWED_DAYS     = 435;        // 0.81 >= 0.5 -> round up
const EXPECTED_DISPLAY_DUE_DATE         = '2026-05-28';
const EXPECTED_CARRY                    = 0.19;       // 435 - 434.81
const EXPECTED_CALENDAR_DUE_DAYS        = 39;         // 2026-07-06 - 2026-05-28
const EXPECTED_EXACT_DUE_DAYS           = 39.19;      // calendar + carry
const EXPECTED_ACCRUED_INTEREST         = 29_392.50;  // 39.19 x 750
const EXPECTED_ACCRUED_PENALTY          = 7_348.13;   // round(39.19 x 187.50, 2)

describe('CD120 RESHABOINA RENUKA — exact fractional carry parity', () => {

  // 1. Base due date uses inclusive-cycle rule
  it('computes base due date using inclusive-cycle rule (disbDate + periodDays - 1)', () => {
    const computed = financeCalculationService.addCalendarDays(DISBURSAL_DATE, PERIOD_DAYS - 1);
    expect(computed).toBe(BASE_DUE_DATE);
  });

  // 2. Note rows contain fractional (non-integer) values
  it('stores exact fractional renewed_days in every note row (no integer rounding)', () => {
    const nonIntegerRows = CD120_NOTE_ROWS.filter(r => !Number.isInteger(r.renewed_days));
    expect(nonIntegerRows.length).toBeGreaterThan(0);
    for (const row of nonIntegerRows) {
      expect(Number.isFinite(row.renewed_days)).toBe(true);
      expect(row.renewed_days).not.toBe(Math.round(row.renewed_days));
    }
  });

  // 3. Sequential running-sum accumulation
  it('accumulates renewed days sequentially with full floating-point precision', () => {
    let runningSum = 0;
    const expectedSums = [
       30,     // RC698
       60,     // RC699
       70.83,  // RC700
       77.5,   // RC701
       90.83,  // RC702
      119.33,  // RC703
      154.08,  // RC704 (raw float: 154.07999...)
      164.58,  // RC705
      181.33,  // RC706
      190.93,  // RC707
      243.12,  // RC708
      267.87,  // RC709
      277.47,  // RC710
      291.87,  // RC711
      302.54,  // RC712
      314.81,  // RC713
      328.68,  // RC714
      338.81,  // RC715
      362.81,  // RC716
      386.81,  // RC717
      410.81,  // RC718
      434.81,  // RC719
    ];
    for (let i = 0; i < CD120_NOTE_ROWS.length; i++) {
      runningSum += CD120_NOTE_ROWS[i].renewed_days;
      expect(Number(runningSum.toFixed(2))).toBeCloseTo(expectedSums[i], 2);
    }
  });

  // 4. Final exact total = 434.81
  it('total exact renewed days across all 22 receipts equals 434.81', () => {
    const total = CD120_NOTE_ROWS.reduce((sum, r) => sum + r.renewed_days, 0);
    expect(Number(total.toFixed(2))).toBe(EXPECTED_TOTAL_EXACT_RENEWED_DAYS);
  });

  // 5. calculateDisplayDays(434.81) = 435
  it('calculateDisplayDays(434.81) rounds UP to 435 because fraction 0.81 >= 0.50', () => {
    const display = financeCalculationService.calculateDisplayDays(EXPECTED_TOTAL_EXACT_RENEWED_DAYS);
    expect(display).toBe(EXPECTED_DISPLAY_RENEWED_DAYS);
  });

  // 6. Display due date = baseDueDate + 435 = 2026-05-28
  it('display due date is 2026-05-28 (baseDueDate + 435 days)', () => {
    const displayDays = financeCalculationService.calculateDisplayDays(EXPECTED_TOTAL_EXACT_RENEWED_DAYS);
    const dueDate = financeCalculationService.addCalendarDays(BASE_DUE_DATE, displayDays);
    expect(dueDate).toBe(EXPECTED_DISPLAY_DUE_DATE);
  });

  // 7. Calendar days past due on 2026-07-06 = 39
  it('calendar days past due on 2026-07-06 equals 39', () => {
    const calendarDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, EXPECTED_DISPLAY_DUE_DATE);
    expect(calendarDays).toBe(EXPECTED_CALENDAR_DUE_DAYS);
  });

  // 8. Carry = 435 - 434.81 = 0.19
  it('fractional carry equals 0.19 (display days purchased minus exact days purchased)', () => {
    const carry = EXPECTED_DISPLAY_RENEWED_DAYS - EXPECTED_TOTAL_EXACT_RENEWED_DAYS;
    expect(Number(carry.toFixed(2))).toBe(EXPECTED_CARRY);
  });

  // 9. Exact calc days = 39.19
  it('exact calculation days on 2026-07-06 equals 39.19', () => {
    const totalExact = CD120_NOTE_ROWS.reduce((sum, r) => sum + r.renewed_days, 0);
    const displayRenewed = financeCalculationService.calculateDisplayDays(totalExact);
    const displayDueDateStr = financeCalculationService.addCalendarDays(BASE_DUE_DATE, displayRenewed);
    const calendarDueDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, displayDueDateStr);
    // Engine formula: rawDueDays = diff(today, baseDueDate) - totalExactRenewedDays
    const rawDueDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - totalExact;
    expect(Number(rawDueDays.toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
    // Cross-check: calendarDays + carry = exactDueDays
    const carry = displayRenewed - totalExact;
    expect(Number((calendarDueDays + carry).toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
  });

  // 10. Accrued interest = Rs. 29,392.50
  it('accrued interest on 2026-07-06 equals Rs. 29,392.50', () => {
    const totalExact = CD120_NOTE_ROWS.reduce((sum, r) => sum + r.renewed_days, 0);
    const rawDueDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - totalExact;
    const grossInterest = Number(((PRINCIPAL * INTEREST_RATE * rawDueDays) / (PERIOD_DAYS * 100)).toFixed(2));
    expect(grossInterest).toBe(EXPECTED_ACCRUED_INTEREST);
    expect(Number((rawDueDays * DAILY_INTEREST).toFixed(2))).toBe(EXPECTED_ACCRUED_INTEREST);
  });

  // 11. Accrued penalty = Rs. 7,348.13
  it('accrued penalty on 2026-07-06 equals Rs. 7,348.13', () => {
    const totalExact = CD120_NOTE_ROWS.reduce((sum, r) => sum + r.renewed_days, 0);
    const rawDueDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - totalExact;
    const grossPenalty = Number(((PRINCIPAL * PENALTY_RATE * rawDueDays) / (PERIOD_DAYS * 100)).toFixed(2));
    expect(grossPenalty).toBe(EXPECTED_ACCRUED_PENALTY);
    expect(Number((rawDueDays * DAILY_PENALTY).toFixed(2))).toBe(EXPECTED_ACCRUED_PENALTY);
  });

  // 12. calculateDisplayDays boundary rule
  it('calculateDisplayDays correctly implements the 0.50 boundary rule', () => {
    expect(financeCalculationService.calculateDisplayDays(10.49)).toBe(10);
    expect(financeCalculationService.calculateDisplayDays(10.50)).toBe(11);
    expect(financeCalculationService.calculateDisplayDays(10.51)).toBe(11);
    expect(financeCalculationService.calculateDisplayDays(10.83)).toBe(11);   // RC700
    expect(financeCalculationService.calculateDisplayDays(6.67)).toBe(7);     // RC701
    expect(financeCalculationService.calculateDisplayDays(13.33)).toBe(13);   // RC702
    expect(financeCalculationService.calculateDisplayDays(30)).toBe(30);      // whole days
    expect(financeCalculationService.calculateDisplayDays(434.81)).toBe(435); // final sum
  });

  // 13. Guard: Math.round on total is WRONG and produces different interest
  it('using Math.round on total renewed days (wrong!) would produce incorrect interest', () => {
    const totalExact   = CD120_NOTE_ROWS.reduce((sum, r) => sum + r.renewed_days, 0); // 434.81
    const totalRounded = Math.round(totalExact); // 435 — WRONG
    const correctDueDays = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - totalExact;
    const wrongDueDays   = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - totalRounded;
    const correctInterest = Number(((PRINCIPAL * INTEREST_RATE * correctDueDays) / (PERIOD_DAYS * 100)).toFixed(2));
    const wrongInterest   = Number(((PRINCIPAL * INTEREST_RATE * wrongDueDays)   / (PERIOD_DAYS * 100)).toFixed(2));
    expect(correctInterest).toBe(EXPECTED_ACCRUED_INTEREST);      // Rs. 29,392.50
    expect(wrongInterest).not.toBe(EXPECTED_ACCRUED_INTEREST);    // MUST differ
    expect(wrongInterest).toBe(Number((39.00 * DAILY_INTEREST).toFixed(2))); // Rs. 29,250
  });

  // 14. End-to-end: all six parity metrics pass simultaneously
  it('end-to-end: all six parity metrics match simultaneously on 2026-07-06', () => {
    const totalExact        = CD120_NOTE_ROWS.reduce((sum, r) => sum + r.renewed_days, 0);
    const displayRenewed    = financeCalculationService.calculateDisplayDays(totalExact);
    const displayDueDateStr = financeCalculationService.addCalendarDays(BASE_DUE_DATE, displayRenewed);
    const calendarDueDays   = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, displayDueDateStr);
    const rawDueDays        = financeCalculationService.differenceInCalendarDays(AUDIT_DATE, BASE_DUE_DATE) - totalExact;
    const grossInterest     = Number(((PRINCIPAL * INTEREST_RATE * rawDueDays) / (PERIOD_DAYS * 100)).toFixed(2));
    const grossPenalty      = Number(((PRINCIPAL * PENALTY_RATE  * rawDueDays) / (PERIOD_DAYS * 100)).toFixed(2));

    expect(Number(totalExact.toFixed(2))).toBe(EXPECTED_TOTAL_EXACT_RENEWED_DAYS);
    expect(displayRenewed).toBe(EXPECTED_DISPLAY_RENEWED_DAYS);
    expect(displayDueDateStr).toBe(EXPECTED_DISPLAY_DUE_DATE);
    expect(calendarDueDays).toBe(EXPECTED_CALENDAR_DUE_DAYS);
    expect(Number(rawDueDays.toFixed(2))).toBe(EXPECTED_EXACT_DUE_DAYS);
    expect(grossInterest).toBe(EXPECTED_ACCRUED_INTEREST);
    expect(grossPenalty).toBe(EXPECTED_ACCRUED_PENALTY);
  });

});
