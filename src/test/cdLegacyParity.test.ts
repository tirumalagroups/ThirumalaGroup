import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';
import * as cdLedgerEngine from '../services/cdLedgerEngine';

function parseDateStr(dateStr: string): string {
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const parts = dateStr.split('-');
  const day = parts[0].padStart(2, '0');
  const month = months[parts[1]];
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

const legacyLedger = [
  { date: '18-Dec-2023', payment: 75000, interest: 75000, penalty: 0 },
  { date: '16-Jan-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '16-Feb-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '15-Mar-2024', payment: 75000, interest: 73475, penalty: 1525 },
  { date: '15-Apr-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '15-May-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '15-Jun-2024', payment: 75000, interest: 71500, penalty: 3500 },
  { date: '18-Jul-2024', payment: 81250, interest: 75000, penalty: 6250 },
  { date: '12-Aug-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '10-Sep-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '11-Oct-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '09-Nov-2024', payment: 75000, interest: 75000, penalty: 0 },
  { date: '11-Dec-2024', payment: 75000, interest: 71250, penalty: 3750 },
  { date: '07-Jan-2025', payment: 75000, interest: 75000, penalty: 0 },
  { date: '07-Feb-2025', payment: 75000, interest: 71550, penalty: 3450 },
  { date: '08-Mar-2025', payment: 75000, interest: 71325, penalty: 3675 },
  { date: '04-Apr-2025', payment: 75000, interest: 75000, penalty: 0 },
  { date: '05-May-2025', payment: 75000, interest: 75000, penalty: 0 },
  { date: '03-Jun-2025', payment: 75000, interest: 75000, penalty: 0 },
  { date: '04-Jul-2025', payment: 75000, interest: 75000, penalty: 0 },
  { date: '02-Aug-2025', payment: 50000, interest: 50000, penalty: 0 },
  { date: '03-Aug-2025', payment: 25000, interest: 25000, penalty: 0 },
  { date: '02-Sep-2025', payment: 45000, interest: 45000, penalty: 0 },
  { date: '03-Sep-2025', payment: 30000, interest: 30000, penalty: 0 },
  { date: '03-Oct-2025', payment: 75000, interest: 71025, penalty: 3975 },
  { date: '31-Oct-2025', payment: 30000, interest: 26275, penalty: 3725 },
  { date: '01-Nov-2025', payment: 45000, interest: 45000, penalty: 0 },
  { date: '28-Nov-2025', payment: 30000, interest: 30000, penalty: 0 },
  { date: '29-Nov-2025', payment: 45000, interest: 45000, penalty: 0 },
  { date: '29-Dec-2025', payment: 75000, interest: 71250, penalty: 3750 },
  { date: '26-Jan-2026', payment: 30000, interest: 26300, penalty: 3700 },
  { date: '29-Jan-2026', payment: 45000, interest: 45000, penalty: 0 },
  { date: '21-Feb-2026', payment: 35000, interest: 35000, penalty: 0 },
  { date: '07-Mar-2026', payment: 40000, interest: 40000, penalty: 0 },
  { date: '24-Mar-2026', payment: 30000, interest: 30000, penalty: 0 },
  { date: '08-Apr-2026', payment: 45000, interest: 40375, penalty: 4625 },
  { date: '22-Apr-2026', payment: 20000, interest: 20000, penalty: 0 },
  { date: '30-Apr-2026', payment: 55000, interest: 55000, penalty: 0 },
  { date: '23-May-2026', payment: 30000, interest: 26075, penalty: 3925 },
  { date: '02-Jun-2026', payment: 25000, interest: 21350, penalty: 3650 },
  { date: '04-Jun-2026', payment: 20000, interest: 20000, penalty: 0 }
];

describe('CD ₹25L legacy 80/20 penalty and sequential renewal parity', () => {
  it.skip('replays every payment sequentially, asserts parameters, and prints a detailed mismatch report', () => {
    const originalLoanDateStr = parseDateStr('14-Nov-2023');
    const principal = 2500000;
    const periodDays = 30;
    const interestRate = 3;
    const penaltyPercent = 0.75;
    const graceDays = 5;

    // NOTE: This test replays historical transactions recorded by the legacy Access system.
    // The Access system used baseDueDate = loanDate + periodDays (exclusive counting).
    // We must reproduce that formula here to match the historical splits.
    // The inclusive-cycle fix (periodDays - 1) applies to NEW calculations going forward only.
    const baseDueDateStr = financeCalculationService.addCalendarDays(originalLoanDateStr, periodDays);

    let currentPrincipal = principal;
    let totalRenewedDays = 0;

    const simulationResults: any[] = [];
    let firstDivergenceIndex: number | null = null;
    let hasMismatch = false;

    // Run the simulation to collect results and find mismatches
    for (let i = 0; i < legacyLedger.length; i++) {
      const item = legacyLedger[i];
      const txDateStr = parseDateStr(item.date);
      const paymentAmount = item.payment;

      const actionType: 'Renew' | 'Partial' | 'Close' = paymentAmount < 75000 ? 'Partial' : 'Renew';

      const dueDateStr = financeCalculationService.addCalendarDays(baseDueDateStr, totalRenewedDays);
      const dueDays = financeCalculationService.differenceInCalendarDays(txDateStr, dueDateStr);

      const interestDue = Number(((currentPrincipal * interestRate * dueDays) / (periodDays * 100)).toFixed(2));
      let penaltyDue = 0;
      if (dueDays > graceDays) {
        penaltyDue = Number(((currentPrincipal * penaltyPercent * dueDays) / (periodDays * 100)).toFixed(2));
      }

      const monthlyInterest = Number(((currentPrincipal * interestRate * periodDays) / 3000).toFixed(2));

      const dummyPos = {
        principalBalance: currentPrincipal,
        periodDays,
        exactDueDays: dueDays,
        dailyInterest: monthlyInterest / periodDays,
        dailyPenalty: 0,
        accruedInterest: interestDue,
        accruedPenalty: penaltyDue,
        todayDue: penaltyDue + interestDue,
        renewalAmount: monthlyInterest,
        totalToRegularize: penaltyDue + interestDue + monthlyInterest
      } as any;

      const split = cdLedgerEngine.allocateCDPayment(
        dummyPos,
        paymentAmount,
        actionType,
        periodDays
      );

      let penaltyPaid = split.penaltyPaid;
      let interestPaid = split.interestPaid;
      const renewedDays = split.renewedDays;

      if (renewedDays > 0 && actionType === 'Renew') {
        const dailyInterestRate = monthlyInterest / periodDays;
        interestPaid = financeCalculationService.roundRupee(dailyInterestRate * renewedDays);
        penaltyPaid = paymentAmount - interestPaid;
      }

      const isMismatch = interestPaid !== item.interest || penaltyPaid !== item.penalty;
      if (isMismatch) {
        hasMismatch = true;
        if (firstDivergenceIndex === null) {
          firstDivergenceIndex = i;
        }
      }

      simulationResults.push({
        paymentDate: item.date,
        paymentAmount,
        previousDueDate: dueDateStr,
        rawDueDays: dueDays,
        displayDueDays: dueDays,
        penaltyTriggered: dueDays > graceDays,
        penaltyDue,
        initialPenaltyShare: paymentAmount * 0.20,
        initialInterestShare: paymentAmount * 0.80,
        penaltyPaid,
        interestPaid,
        renewalDays: renewedDays,
        nextDueDate: financeCalculationService.addCalendarDays(dueDateStr, renewedDays),
        expectedInterest: item.interest,
        expectedPenalty: item.penalty,
        isMismatch
      });

      totalRenewedDays += renewedDays;
    }

    // Print Mismatch Report if there are any divergences
    if (hasMismatch) {
      console.log('\n======================================================================');
      console.log('CD ₹25L LEGACY PARITY REGRESSION TEST - MISMATCH REPORT');
      console.log('======================================================================');
      console.log(`First divergence detected at transaction index ${firstDivergenceIndex! + 1} (${legacyLedger[firstDivergenceIndex!].date}):`);
      console.log(`  Expected: Interest = ₹${legacyLedger[firstDivergenceIndex!].interest.toLocaleString()}, Penalty = ₹${legacyLedger[firstDivergenceIndex!].penalty.toLocaleString()}`);
      console.log(`  Got:      Interest = ₹${simulationResults[firstDivergenceIndex!].interestPaid.toLocaleString()}, Penalty = ₹${simulationResults[firstDivergenceIndex!].penaltyPaid.toLocaleString()}`);
      console.log('\nDetailed Transaction History:');
      console.log('-------------------------------------------------------------------------------------------------------------------');
      console.log('Row | Date        | Payment   | Expected (Int / Pen)     | Actual (Int / Pen)       | DueDays | NextDueDate | Status');
      console.log('-------------------------------------------------------------------------------------------------------------------');
      simulationResults.forEach((res, index) => {
        const rowNum = String(index + 1).padStart(3, ' ');
        const dateStr = res.paymentDate.padEnd(11, ' ');
        const payment = String(res.paymentAmount).padStart(9, ' ');
        const expected = `${res.expectedInterest} / ${res.expectedPenalty}`.padEnd(24, ' ');
        const actual = `${res.interestPaid} / ${res.penaltyPaid}`.padEnd(24, ' ');
        const dueDaysStr = String(res.rawDueDays).padStart(7, ' ');
        const nextDue = res.nextDueDate.padEnd(11, ' ');
        const status = res.isMismatch ? 'MISMATCH *' : 'MATCH';
        console.log(`${rowNum} | ${dateStr} | ${payment} | ${expected} | ${actual} | ${dueDaysStr} | ${nextDue} | ${status}`);
      });
      console.log('======================================================================\n');
    }

    // Perform Mandatory Assertions
    simulationResults.forEach((res, index) => {
      // Assert paymentDate and paymentAmount
      expect(res.paymentDate).toBe(legacyLedger[index].date);
      expect(res.paymentAmount).toBe(legacyLedger[index].payment);

      // Assert sum equals paymentAmount
      expect(res.interestPaid + res.penaltyPaid).toBe(res.paymentAmount);

      // Assert exact legacy parity splits
      expect(res.interestPaid).toBe(res.expectedInterest);
      expect(res.penaltyPaid).toBe(res.expectedPenalty);
    });
  });
});
