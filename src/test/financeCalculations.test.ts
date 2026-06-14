import { describe, it, expect } from 'vitest';
import { financeCalculationService } from '../services/financeCalculationService';

describe('CD Ledger Calculation Rules', () => {
  const principal = 10000;
  const rate = 3;
  const penaltyRate = 0.75;

  it('calculates interest correctly based on days', () => {
    // Interest = Principal * Rate% * Due Days / 30
    const interest = financeCalculationService.calculateInterest(principal, rate, 63);
    expect(interest).toBe(630);
  });

  it('applies grace period correctly for penalty', () => {
    // Penalty is 0 if due days <= 5
    const penaltyUnderGrace = financeCalculationService.calculatePenalty(principal, penaltyRate, 4);
    expect(penaltyUnderGrace).toBe(0);

    const penaltyAtGraceLimit = financeCalculationService.calculatePenalty(principal, penaltyRate, 5);
    expect(penaltyAtGraceLimit).toBe(0);
  });

  it('calculates penalty on full due days once grace period is exceeded', () => {
    // Penalty is calculated on all overdue days if dueDays > 5
    const penaltyCrossed = financeCalculationService.calculatePenalty(principal, penaltyRate, 6);
    // 10000 * 0.75% * 6 / 30 = 15.00
    expect(penaltyCrossed).toBe(15.00);
  });

  it('matches the screenshot validation test case', () => {
    const dueDays = 63;
    const interest = financeCalculationService.calculateInterest(principal, rate, dueDays);
    const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, dueDays);
    const renewalTotal = financeCalculationService.calculateRenewalTotal(interest, penalty);
    const closeTotal = financeCalculationService.calculateCloseTotal(principal, interest, penalty);

    expect(interest).toBe(630);
    expect(penalty).toBe(157.50);
    expect(renewalTotal).toBe(787.50);
    expect(closeTotal).toBe(10787.50);
  });

  it('applies payment splits in correct order: penalty first, interest second, principal last', () => {
    const interestDue = 630;
    const penaltyDue = 157.50;
    const principalBalance = 10000;

    // Split 1: Amount only covers partial penalty
    const split1 = financeCalculationService.applyPaymentSplit(100, interestDue, penaltyDue, principalBalance);
    expect(split1.penaltyPaid).toBe(100);
    expect(split1.interestPaid).toBe(0);
    expect(split1.principalPaid).toBe(0);

    // Split 2: Amount clears penalty and covers partial interest
    const split2 = financeCalculationService.applyPaymentSplit(500, interestDue, penaltyDue, principalBalance);
    expect(split2.penaltyPaid).toBe(157.50);
    expect(split2.interestPaid).toBe(342.50);
    expect(split2.principalPaid).toBe(0);

    // Split 3: Amount clears penalty, interest and covers partial principal
    const split3 = financeCalculationService.applyPaymentSplit(1000, interestDue, penaltyDue, principalBalance);
    expect(split3.penaltyPaid).toBe(157.50);
    expect(split3.interestPaid).toBe(630);
    expect(split3.principalPaid).toBe(212.50);
  });

  it('matches the user test case: Principal 10,000, Due Days 31, Rate 3%, Penalty 0.75%, Paid 300', () => {
    const dueDays = 31;
    const interest = financeCalculationService.calculateInterest(principal, rate, dueDays);
    const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, dueDays);
    const split = financeCalculationService.applyPaymentSplit(300, interest, penalty, principal);

    expect(interest).toBe(310);
    expect(penalty).toBe(77.50);
    expect(split.penaltyPaid).toBe(77.50);
    expect(split.interestPaid).toBe(222.50);
    expect(split.principalPaid).toBe(0);

    const remainingPenalty = penalty - split.penaltyPaid;
    const remainingInterest = interest - split.interestPaid;
    const remainingPrincipal = principal - split.principalPaid;

    expect(remainingPenalty).toBe(0);
    expect(remainingInterest).toBe(87.50);
    expect(remainingPrincipal).toBe(10000);

    const closeTotal = financeCalculationService.calculateCloseTotal(remainingPrincipal, remainingInterest, remainingPenalty);
    expect(closeTotal).toBe(10087.50);
  });

  it('matches sequence of Testcase 1 and Testcase 2 for renewal payment allocation', () => {
    // Testcase 1: Gross Interest = 630, Gross Penalty = 157.50, Paid = 300
    const intDue1 = 630;
    const penDue1 = 157.50;
    const firstPayment = 300;
    const split1 = financeCalculationService.applyPaymentSplit(firstPayment, intDue1, penDue1, principal);
    
    expect(split1.penaltyPaid).toBe(157.50);
    expect(split1.interestPaid).toBe(142.50);
    expect(split1.principalPaid).toBe(0);
    
    const remInt1 = intDue1 - split1.interestPaid; // 487.50
    const remPen1 = penDue1 - split1.penaltyPaid;   // 0
    expect(remInt1).toBe(487.50);
    expect(remPen1).toBe(0);

    // Testcase 2: Remaining Interest = 487.50, Remaining Penalty = 0, Paid = 487.50
    const secondPayment = 487.50;
    const split2 = financeCalculationService.applyPaymentSplit(secondPayment, remInt1, remPen1, principal);
    
    expect(split2.penaltyPaid).toBe(0);
    expect(split2.interestPaid).toBe(487.50);
    expect(split2.principalPaid).toBe(0);
    
    const remInt2 = remInt1 - split2.interestPaid; // 0
    const remPen2 = remPen1 - split2.penaltyPaid;  // 0
    const remPrincipal2 = principal - split2.principalPaid; // 10000
    
    expect(remInt2).toBe(0);
    expect(remPen2).toBe(0);
    expect(remPrincipal2).toBe(10000);
  });

  it("verifies today's payment test: three payments (2000, 2000, 1000) with zero starting dues", () => {
    let currentPrincipal = 10000;

    // Start with dues already cleared (penalty = 0, interest = 0)
    const penaltyDue = 0;
    const interestDue = 0;

    // Payment 1: ₹2,000
    const pay1 = 2000;
    const penaltyPaid1 = Math.min(pay1, penaltyDue);
    const interestPaid1 = Math.min(pay1 - penaltyPaid1, interestDue);
    const principalPaid1 = pay1 - penaltyPaid1 - interestPaid1;

    expect(penaltyPaid1).toBe(0);
    expect(interestPaid1).toBe(0);
    expect(principalPaid1).toBe(2000);
    currentPrincipal -= principalPaid1;
    expect(currentPrincipal).toBe(8000);

    // Payment 2: ₹2,000
    const pay2 = 2000;
    const penaltyPaid2 = Math.min(pay2, penaltyDue);
    const interestPaid2 = Math.min(pay2 - penaltyPaid2, interestDue);
    const principalPaid2 = pay2 - penaltyPaid2 - interestPaid2;

    expect(penaltyPaid2).toBe(0);
    expect(interestPaid2).toBe(0);
    expect(principalPaid2).toBe(2000);
    currentPrincipal -= principalPaid2;
    expect(currentPrincipal).toBe(6000);

    // Payment 3: ₹1,000
    const pay3 = 1000;
    const penaltyPaid3 = Math.min(pay3, penaltyDue);
    const interestPaid3 = Math.min(pay3 - penaltyPaid3, interestDue);
    const principalPaid3 = pay3 - penaltyPaid3 - interestPaid3;

    expect(penaltyPaid3).toBe(0);
    expect(interestPaid3).toBe(0);
    expect(principalPaid3).toBe(1000);
    currentPrincipal -= principalPaid3;
    expect(currentPrincipal).toBe(5000);

    expect(principalPaid1 + principalPaid2 + principalPaid3).toBe(5000);
  });

  // ── Bug-report test cases: Penalty ₹155, Interest ₹620 ────────────────────

  describe('Partial payment priority allocation (reported bug cases)', () => {
    const bugInterest = 620;
    const bugPenalty  = 155;
    const bugPrincipal = 10000;

    it('Case 1 — payment ₹500: clears penalty first, partial interest', () => {
      // Penalty Due = 155, Interest Due = 620, Payment = 500
      // Expected: Penalty Paid = 155, Interest Paid = 345
      const split = financeCalculationService.applyPaymentSplit(500, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(155);
      expect(split.interestPaid).toBe(345);
      expect(split.principalPaid).toBe(0);

      const remainingInterest = bugInterest - split.interestPaid;
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;

      expect(remainingPenalty).toBe(0);
      expect(remainingInterest).toBe(275);

      const pendingDues = remainingInterest + remainingPenalty;
      expect(pendingDues).toBe(275);
    });

    it('Case 2 — payment ₹100: only partial penalty, no interest', () => {
      // Penalty Due = 155, Interest Due = 620, Payment = 100
      // Expected: Penalty Paid = 100, Interest Paid = 0
      const split = financeCalculationService.applyPaymentSplit(100, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(100);
      expect(split.interestPaid).toBe(0);
      expect(split.principalPaid).toBe(0);

      const remainingInterest = bugInterest - split.interestPaid;
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;

      expect(remainingPenalty).toBe(55);
      expect(remainingInterest).toBe(620);
    });

    it('Case 3 — payment ₹800: clears penalty + interest, excess to principal', () => {
      // Penalty Due = 155, Interest Due = 620, Payment = 800
      // Expected: Penalty Paid = 155, Interest Paid = 620, Principal = 25
      const split = financeCalculationService.applyPaymentSplit(800, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(155);
      expect(split.interestPaid).toBe(620);
      expect(split.principalPaid).toBe(25);

      const remainingInterest = bugInterest - split.interestPaid;
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;

      expect(remainingPenalty).toBe(0);
      expect(remainingInterest).toBe(0);

      const pendingDues = remainingInterest + remainingPenalty;
      expect(pendingDues).toBe(0);
    });

    it('Rule 4 — partial payment must not clear dues or advance loan date', () => {
      // Total dues = 775 (Interest 620 + Penalty 155)
      // Payment = 500
      // Expected pending = 275 (Interest 275 remaining)
      const totalDue = bugInterest + bugPenalty; // 775
      const payment = 500;

      const split = financeCalculationService.applyPaymentSplit(payment, bugInterest, bugPenalty, bugPrincipal);

      expect(split.penaltyPaid).toBe(155);
      expect(split.interestPaid).toBe(345);
      expect(split.principalPaid).toBe(0);

      const remainingInterest = bugInterest - split.interestPaid; // 275
      const remainingPenalty  = bugPenalty  - split.penaltyPaid;  // 0
      const pendingDues = remainingInterest + remainingPenalty;    // 275

      expect(pendingDues).toBe(275);
      expect(totalDue - payment).toBe(275);

      // Rule 4: allDuesCleared must be false → loan date must NOT advance
      const allDuesCleared =
        split.interestPaid >= bugInterest &&
        split.penaltyPaid  >= bugPenalty;

      expect(allDuesCleared).toBe(false); // loan date must stay unchanged
    });
  });

  describe('New CD Ledger Business Rules', () => {
    it('applies computeRenewSplit correctly when penaltyDue > 0', () => {
      const split = financeCalculationService.computeRenewSplit(1000, 300);
      expect(split.penaltyPaid).toBe(200);
      expect(split.interestPaid).toBe(800);
      expect(split.principalPaid).toBe(0);
    });

    it('applies computeRenewSplit correctly when penaltyDue <= 0', () => {
      const split = financeCalculationService.computeRenewSplit(1000, 0);
      expect(split.penaltyPaid).toBe(0);
      expect(split.interestPaid).toBe(1000);
      expect(split.principalPaid).toBe(0);
    });

    it('applies computeCDPaymentSplit correctly for Close action', () => {
      // principalBefore = 100000, interestDue = 3000, penaltyDue = 500, paymentAmount = 103500
      const split = financeCalculationService.computeCDPaymentSplit(
        103500,
        500,
        3000,
        3000,
        100000,
        'Close'
      );
      expect(split.penaltyPaid).toBe(500);
      expect(split.interestPaid).toBe(3000);
      expect(split.principalPaid).toBe(100000);
    });

    it('applies computeCDPaymentSplit correctly for Renew action', () => {
      // principalBefore = 100000, interestDue = 3000, penaltyDue = 500, paymentAmount = 1000
      const split = financeCalculationService.computeCDPaymentSplit(
        1000,
        500,
        3000,
        3000,
        100000,
        'Renew'
      );
      expect(split.penaltyPaid).toBe(200);
      expect(split.interestPaid).toBe(800);
      expect(split.principalPaid).toBe(0);
    });
  });

  describe('CD Ledger - 16 Business Rule Test Cases', () => {
    function calculateCDDuesAndSplit(params: {
      principal: number;
      rate: number;
      paymentDate: string;
      currentDueDate: string;
      paymentAmount: number;
      interestPaidInCycle?: number;
      penaltyPaidInCycle?: number;
      actionType?: 'Renew' | 'Partial' | 'Close';
      periodDays?: number;
    }) {
      const {
        principal,
        rate,
        paymentDate,
        currentDueDate,
        paymentAmount,
        interestPaidInCycle = 0,
        penaltyPaidInCycle = 0,
        actionType = 'Renew',
        periodDays = 30
      } = params;

      const paymentDateObj = new Date(paymentDate);
      const currentDueDateObj = new Date(currentDueDate);
      
      paymentDateObj.setHours(0, 0, 0, 0);
      currentDueDateObj.setHours(0, 0, 0, 0);

      const rawDueDays = Math.round((paymentDateObj.getTime() - currentDueDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const dueDays = Math.max(0, rawDueDays);
      const daysRemaining = rawDueDays < 0 ? Math.abs(rawDueDays) : 0;

      // Overdue/daily interest and penalty use constant 30-day divisor
      const grossInterest = dueDays <= 0 ? 0 : Number(((principal * rate * dueDays) / 30 / 100).toFixed(2));
      const penaltyDays = dueDays <= 5 ? 0 : dueDays;
      const grossPenalty = penaltyDays <= 0 ? 0 : Number(((principal * 0.75 * penaltyDays) / 30 / 100).toFixed(2));

      const effectiveGrossInterest = grossInterest;
      const effectiveGrossPenalty = grossPenalty;

      const outstandingInterest = Math.max(0, Number(grossInterest.toFixed(2)));
      const outstandingPenalty = Math.max(0, Number(grossPenalty.toFixed(2)));

      const displayInterest = dueDays <= 0 ? 0 : outstandingInterest;
      const displayPenalty = dueDays <= 0 ? 0 : outstandingPenalty;
      const totalDue = displayInterest + displayPenalty;

      // Renewal Due scales with periodDays
      const renewalDue = Number(((principal * (rate / 100) * periodDays) / 30).toFixed(2));

      // Total To Regularize defaults to 0 when outstanding dues are 0
      const totalToRegularize = (outstandingInterest === 0 && outstandingPenalty === 0)
        ? 0
        : Number((totalDue + renewalDue).toFixed(2));
      const pendingDues = Math.max(0, Number((totalDue + renewalDue - (interestPaidInCycle + penaltyPaidInCycle)).toFixed(2)));
      const totalClose = Number((principal + displayInterest + displayPenalty).toFixed(2));

      const split = financeCalculationService.computeCDPaymentSplit(
        paymentAmount,
        outstandingPenalty,
        outstandingInterest,
        renewalDue,
        principal,
        actionType,
        periodDays
      );

      const renewedDays = split.renewedDays;

      let nextDueDate: string | null = null;
      if (paymentAmount > 0 && renewedDays > 0) {
        const baseDateMs = Math.max(currentDueDateObj.getTime(), paymentDateObj.getTime());
        const nextDate = new Date(baseDateMs + renewedDays * 24 * 60 * 60 * 1000);
        const tzoffset = nextDate.getTimezoneOffset() * 60000;
        nextDueDate = new Date(nextDate.getTime() - tzoffset).toISOString().split('T')[0];
      }

      const enableRenewal = paymentAmount > 0;
      const enablePartial = paymentAmount > totalToRegularize;
      const enableClose = principal <= 0 && totalDue <= 0;

      return {
        principal,
        dueDays,
        daysRemaining,
        interest: displayInterest,
        penalty: displayPenalty,
        totalDue,
        renewalDue,
        totalToRegularize,
        pendingDues,
        totalClose,
        penaltyPaid: split.penaltyPaid,
        interestPaid: split.interestPaid,
        principalPaid: split.principalPaid,
        renewedDays,
        nextDueDate,
        enableRenewal,
        enablePartial,
        enableClose
      };
    }

    it('Test Case 1 - New Loan (No Overdue)', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.dueDays).toBe(0);
      expect(res.daysRemaining).toBe(8);
      expect(res.interest).toBe(0);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(0);
      expect(res.renewalDue).toBe(3000);
      expect(res.totalToRegularize).toBe(0);
      expect(res.totalClose).toBe(100000);
      expect(res.nextDueDate).toBeNull();
      expect(res.renewedDays).toBe(0);
    });

    it('Test Case 2 - Early Partial Renewal', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 1000
      });
      expect(res.interest).toBe(0);
      expect(res.penalty).toBe(0);
      expect(res.renewalDue).toBe(3000);
      expect(res.interestPaid).toBe(1000);
      expect(res.penaltyPaid).toBe(0);
      expect(res.renewedDays).toBe(10);
      expect(res.nextDueDate).toBe('2026-06-28');
      
      const resAfter = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 0,
        interestPaidInCycle: 1000
      });
      expect(resAfter.pendingDues).toBe(2000);
    });

    it('Test Case 3 - Full Renewal', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 3000
      });
      expect(res.interestPaid).toBe(3000);
      expect(res.penaltyPaid).toBe(0);
      expect(res.renewedDays).toBe(30);
      expect(res.nextDueDate).toBe('2026-07-18');
      expect(res.pendingDues).toBe(3000); // before posting
      
      const resAfter = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0,
        interestPaidInCycle: 3000
      });
      expect(resAfter.pendingDues).toBe(0);
    });

    it('Test Case 4 - Overpayment Renewal', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 5000,
        actionType: 'Renew'
      });
      expect(res.interestPaid).toBe(5000);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(0);
      expect(res.renewedDays).toBe(50);
      expect(res.nextDueDate).toBe('2026-08-07');
    });

    it('Test Case 5 - Overdue by 10 Days', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-05-31',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.dueDays).toBe(10);
      expect(res.interest).toBe(1000);
      expect(res.penalty).toBe(250);
      expect(res.totalDue).toBe(1250);
      expect(res.totalToRegularize).toBe(4250);
      expect(res.totalClose).toBe(101250);
    });

    it('Test Case 6 - Penalty Split Logic', () => {
      const split = financeCalculationService.computeCDPaymentSplit(
        1000,
        500, // penaltyDue
        1500, // interestDue
        3000, // standard monthly
        100000,
        'Renew'
      );
      expect(split.penaltyPaid).toBe(200);
      expect(split.interestPaid).toBe(800);
      expect(split.principalPaid).toBe(0);
    });

    it('Test Case 7 - No Penalty Split Logic', () => {
      const split = financeCalculationService.computeCDPaymentSplit(
        1000,
        0, // penaltyDue
        1500, // interestDue
        3000,
        100000,
        'Renew'
      );
      expect(split.penaltyPaid).toBe(0);
      expect(split.interestPaid).toBe(1000);
      expect(split.principalPaid).toBe(0);
    });

    it('Test Case 8 - Pending Dues Reduction', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 0,
        interestPaidInCycle: 1000
      });
      expect(res.renewalDue).toBe(3000);
      expect(res.pendingDues).toBe(2000);
    });

    it('Test Case 9 - Pending Dues Fully Cleared', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0,
        interestPaidInCycle: 3000
      });
      expect(res.renewalDue).toBe(3000);
      expect(res.pendingDues).toBe(0);
    });

    it('Test Case 10 - Negative Days Prevention', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-20',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.dueDays).toBe(0);
      expect(res.interest).toBe(0);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(0);
    });

    it('Test Case 11 - Renewal Date Protection', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-10',
        paymentAmount: 3000
      });
      expect(res.nextDueDate).toBe('2026-07-18');
    });

    it('Test Case 12 - NPA Close', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-05-31',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      expect(res.principal).toBe(100000);
      expect(res.interest).toBe(1000);
      expect(res.penalty).toBe(250);
      expect(res.totalClose).toBe(101250);
    });

    it('Test Case 13 - Close Account Validation', () => {
      const res = calculateCDDuesAndSplit({
        principal: 0,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0
      });
      expect(res.enableClose).toBe(true);
    });

    it('Test Case 14 - Close Account Blocked', () => {
      const res = calculateCDDuesAndSplit({
        principal: 50000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0
      });
      expect(res.enableClose).toBe(false);
    });

    it('Test Case 15 - Cross Cycle Validation', () => {
      // Cycle 1: Paid 3000
      const cycle1 = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-18',
        paymentAmount: 0,
        interestPaidInCycle: 3000
      });
      expect(cycle1.pendingDues).toBe(0);

      // Cycle 2: new cycle interest paid starts at 0, then we pay 1000.
      // previous cycle's 3000 is excluded.
      const cycle2 = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-07-18',
        paymentDate: '2026-07-20',
        paymentAmount: 0,
        interestPaidInCycle: 1000 // Only Cycle 2 payments are counted here
      });
      expect(cycle2.pendingDues).toBe(2200); // Correctly excludes penalty (0 days overdue for penalty since overdue is 2 days)
    });

    it('Test Case 16 - Single Source of Truth', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-05-31',
        paymentDate: '2026-06-10',
        paymentAmount: 0
      });
      
      const summaryTotalDue = res.interest + res.penalty;
      const footerTotalDue = res.interest + res.penalty;
      const borrowerLedgerTotalDue = res.interest + res.penalty;

      expect(summaryTotalDue).toBe(res.totalDue);
      expect(footerTotalDue).toBe(res.totalDue);
      expect(borrowerLedgerTotalDue).toBe(res.totalDue);
    });

    it('Partial Payment & Renewal Validation Case 1 - Exact Regularize Payment', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-20',
        paymentAmount: 3200,
        actionType: 'Renew'
      });
      expect(res.dueDays).toBe(2);
      expect(res.interest).toBe(200);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(200);
      expect(res.renewalDue).toBe(3000);
      expect(res.totalToRegularize).toBe(3200);
      expect(res.interestPaid).toBe(3200);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(0);
      expect(res.renewedDays).toBe(30);
      expect(res.nextDueDate).toBe('2026-07-20');
    });

    it('Partial Payment Validation Case 2 - Excess Payment with Principal Reduction Only', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-20',
        paymentAmount: 7000,
        actionType: 'Partial'
      });
      expect(res.dueDays).toBe(2);
      expect(res.interest).toBe(200);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(200);
      expect(res.interestPaid).toBe(0);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(7000);
      expect(res.renewedDays).toBe(0);
      expect(res.nextDueDate).toBeNull();
    });

    it('Partial Payment Validation Case 3 - Heavy Excess Payment with Principal Reduction Only', () => {
      const res = calculateCDDuesAndSplit({
        principal: 100000,
        rate: 3,
        currentDueDate: '2026-06-18',
        paymentDate: '2026-06-20',
        paymentAmount: 10000,
        actionType: 'Partial'
      });
      expect(res.dueDays).toBe(2);
      expect(res.interest).toBe(200);
      expect(res.penalty).toBe(0);
      expect(res.totalDue).toBe(200);
      expect(res.interestPaid).toBe(0);
      expect(res.penaltyPaid).toBe(0);
      expect(res.principalPaid).toBe(10000);
      expect(res.renewedDays).toBe(0);
      expect(res.nextDueDate).toBeNull();
    });

    describe('User Requested Validation Tests', () => {
      it('Test 1 - Partial Payment - Exact principal payment', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-20',
          paymentAmount: 3200,
          actionType: 'Partial'
        });
        expect(res.interestPaid).toBe(0);
        expect(res.penaltyPaid).toBe(0);
        expect(res.principalPaid).toBe(3200); // Entire amount reduces principal
        expect(res.renewedDays).toBe(0); // Due date/cycle unchanged
        expect(res.nextDueDate).toBeNull();
      });

      it('Test 2 - Partial Payment - Payment of 5,000', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-20',
          paymentAmount: 5000,
          actionType: 'Partial'
        });
        expect(res.interestPaid).toBe(0);
        expect(res.penaltyPaid).toBe(0);
        expect(res.principalPaid).toBe(5000); // Entire amount reduces principal
        expect(res.renewedDays).toBe(0); // Due date/cycle unchanged
        expect(res.nextDueDate).toBeNull();
      });

      it('Test 3 - Partial Payment - Payment of 10,000', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-20',
          paymentAmount: 10000,
          actionType: 'Partial'
        });
        expect(res.interestPaid).toBe(0);
        expect(res.penaltyPaid).toBe(0);
        expect(res.principalPaid).toBe(10000); // Entire amount reduces principal
        expect(res.renewedDays).toBe(0); // Due date/cycle unchanged
        expect(res.nextDueDate).toBeNull();
      });

      it('Test 4 - Renewal Account - Payment of 10,000', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18', // Same day -> Outstanding Due = 0
          paymentAmount: 10000,
          actionType: 'Renew'
        });
        expect(res.totalDue).toBe(0); // Outstanding Due
        expect(res.principalPaid).toBe(0); // Principal Reduction: 0
        expect(res.renewedDays).toBe(100); // Uncapped renewal interest: 10000 / 3000 * 30
        expect(res.nextDueDate).toBe('2026-09-26');
      });

      it('Test 5 - Cycle Reset Rule - After successful Partial Payment & Renewal', () => {
        const newPrincipal = 98200;
        const newDueDate = '2026-07-20';

        // Immediately after save (same day as partial payment & renewal: 2026-06-20)
        // Due Days, Interest, Penalty, and Total Due must all be 0.
        // Active cycle payments for the new cycle start at 0.
        const resAfterSave = calculateCDDuesAndSplit({
          principal: newPrincipal,
          rate: 3,
          currentDueDate: newDueDate,
          paymentDate: '2026-06-20',
          paymentAmount: 0,
          interestPaidInCycle: 0,
          penaltyPaidInCycle: 0
        });
        expect(resAfterSave.dueDays).toBe(0);
        expect(resAfterSave.interest).toBe(0);
        expect(resAfterSave.penalty).toBe(0);
        expect(resAfterSave.totalDue).toBe(0);

        // Future calculation (e.g. 7 days overdue in the new cycle: 2026-07-27)
        // Calculations start fresh from the new due date without being affected by
        // historical payments (which were cleared in the previous cycle).
        const resOverdue = calculateCDDuesAndSplit({
          principal: newPrincipal,
          rate: 3,
          currentDueDate: newDueDate,
          paymentDate: '2026-07-27',
          paymentAmount: 0,
          interestPaidInCycle: 0,
          penaltyPaidInCycle: 0
        });
        expect(resOverdue.dueDays).toBe(7);
        expect(resOverdue.interest).toBe(687.40); // 98200 * 0.03 * 7 / 30
        expect(resOverdue.penalty).toBe(171.85);   // 98200 * 0.0075 * 7 / 30
        expect(resOverdue.totalDue).toBe(687.40 + 171.85);
      });
 
      it('Test 6 - CD Ledger Renewal Bug scenario (131 days overdue, ₹5,000 renewal payment)', () => {
        const res = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-01-30',
          paymentDate: '2026-06-10',
          paymentAmount: 5000,
          actionType: 'Renew'
        });
        expect(res.dueDays).toBe(131);
        expect(res.interest).toBe(13100);
        expect(res.penalty).toBe(3275);
        expect(res.totalDue).toBe(16375);
        expect(res.penaltyPaid).toBe(1000);
        expect(res.interestPaid).toBe(4000);
        expect(res.principalPaid).toBe(0);
        expect(res.renewedDays).toBe(0);
        expect(res.nextDueDate).toBeNull();
      });
 
      it('Validation Test 15 - Penalty Due = ₹315, Overdue Interest Due = ₹1,310, Payment = ₹1,500', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-01-30',
          paymentDate: '2026-06-10',
          paymentAmount: 1500,
          actionType: 'Renew'
        });
        expect(res.dueDays).toBe(131);
        expect(res.interest).toBe(1310);
        expect(res.penalty).toBe(327.50);
        expect(res.totalDue).toBe(1637.50);
        expect(res.penaltyPaid).toBe(327.50);
        expect(res.interestPaid).toBe(1172.50);
        expect(res.principalPaid).toBe(0);
        expect(res.renewedDays).toBe(0);
        expect(res.nextDueDate).toBeNull();
      });
 
      it('Validation Test 16 - Penalty Due = ₹315, Overdue Interest Due = ₹1,310, Payment = ₹1,700', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-01-30',
          paymentDate: '2026-06-10',
          paymentAmount: 1700,
          actionType: 'Renew'
        });
        expect(res.dueDays).toBe(131);
        expect(res.interest).toBe(1310);
        expect(res.penalty).toBe(327.50);
        expect(res.totalDue).toBe(1637.50);
        expect(res.penaltyPaid).toBe(327.50);
        expect(res.interestPaid).toBe(1372.50);
        expect(res.principalPaid).toBe(0);
        expect(res.renewedDays).toBe(6);
        expect(res.nextDueDate).toBe('2026-06-16');
      });
    });

    describe('Dynamic Period Days (15-Day Period Examples)', () => {
      it('Example A: Principal 10,000, Rate 3%, Period 15 -> Renewal Interest = 150, Daily Interest = 10', () => {
        const principal = 10000;
        const rate = 3;
        const periodDays = 15;

        // Interest due for 15 days elapsed (divided by 30)
        const interest = financeCalculationService.calculateInterest(principal, rate, 15, periodDays);
        expect(interest).toBe(150);

        // renewalDue = principal * rate * periodDays / 30
        const renewalDue = Number(((principal * (rate / 100) * periodDays) / 30).toFixed(2));
        expect(renewalDue).toBe(150);

        // dailyInterestValue = renewalDue / periodDays = 150 / 15 = 10
        const dailyInterestValue = Number((renewalDue / periodDays).toFixed(5));
        expect(dailyInterestValue).toBe(10);
      });

      it('Example B: Renewal Interest Paid 600, Daily Interest 10 -> Renewed Days = 60', () => {
        const periodDays = 15;
        const renewalDue = 150; // principal 10000 * 3% * 15 / 30

        // Split call with 15 days period
        const split = financeCalculationService.computeCDPaymentSplit(
          600, // paymentAmount
          0,   // penaltyDue
          0,   // interestDue
          renewalDue,
          10000, // principalBefore
          'Renew',
          periodDays
        );

        // dailyInterestValue = 150 / 15 = 10
        // renewedDays = 600 / 10 = 60
        expect(split.renewedDays).toBe(60);
      });

      it('Example C: Penalty Rate 0.75%, Principal 10,000, Period 15 -> Cycle Penalty = 37.50, Daily Penalty = 2.50', () => {
        const principal = 10000;
        const penaltyRate = 0.75;
        const periodDays = 15;

        // penalty for 15 days elapsed (divided by 30)
        const penalty = financeCalculationService.calculatePenalty(principal, penaltyRate, 15, periodDays);
        expect(penalty).toBe(37.50);

        // daily penalty value: (principal * 0.75 / 100 / 30)
        const renewalPenalty = Number(((principal * (penaltyRate / 100) * periodDays) / 30).toFixed(2));
        expect(renewalPenalty).toBe(37.50);
        const dailyPenalty = Number((renewalPenalty / periodDays).toFixed(5));
        expect(dailyPenalty).toBe(2.50);
      });

      it('verifies 15-day period calculations using calculateCDDuesAndSplit helper', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-15',
          paymentDate: '2026-06-30', // exactly 15 days overdue
          paymentAmount: 600,
          actionType: 'Renew',
          periodDays: 15
        });

        expect(res.dueDays).toBe(15);
        expect(res.interest).toBe(150);
        expect(res.penalty).toBe(37.50);
        expect(res.totalDue).toBe(187.50);
        expect(res.penaltyPaid).toBe(37.50);
        expect(res.interestPaid).toBe(562.50); // 600 - 37.50 = 562.50
        expect(res.renewedDays).toBe(41); // 412.50 / 10 = 41.25 -> 41 days
      });

      it('verifies due date is calculated as loan_date + period_days exactly', () => {
        const loanDate = new Date('2026-06-10T00:00:00Z');
        const periodDays = 15;
        const dueDate = new Date(loanDate.getTime() + periodDays * 24 * 60 * 60 * 1000);
        expect(dueDate.toISOString().split('T')[0]).toBe('2026-06-25');
      });
    });

    describe('Explicit Validation Tests', () => {
      it('TEST 1 - Principal = 10000, Rate = 3%, Period = 15 -> Renewal = 150', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18',
          paymentAmount: 0,
          periodDays: 15
        });
        expect(res.renewalDue).toBe(150);
      });

      it('TEST 2 - Principal = 10000, Rate = 3%, Period = 10 -> Renewal = 100', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18',
          paymentAmount: 0,
          periodDays: 10
        });
        expect(res.renewalDue).toBe(100);
      });

      it('TEST 3 - Principal = 10000, Rate = 3%, Period = 30 -> Renewal = 300', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-18',
          paymentAmount: 0,
          periodDays: 30
        });
        expect(res.renewalDue).toBe(300);
      });

      it('TEST 4 - Fresh Loan - Interest Due = 0, Penalty Due = 0 -> Today Due = 0, Total To Regularize = 0', () => {
        const res = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-18',
          paymentDate: '2026-06-10', // early, no overdue
          paymentAmount: 0,
          periodDays: 15
        });
        expect(res.totalDue).toBe(0); // Today Due
        expect(res.totalToRegularize).toBe(0);
      });

      it('TEST 5 - Edit Loan Principal from 10,000 to 100,000 with 3% rate and 15 period days -> Renewal = 1500, Total For Close = 100000', () => {
        // Original State
        const resOriginal = calculateCDDuesAndSplit({
          principal: 10000,
          rate: 3,
          currentDueDate: '2026-06-26',
          paymentDate: '2026-06-11',
          paymentAmount: 0,
          periodDays: 15
        });
        expect(resOriginal.renewalDue).toBe(150);
        expect(resOriginal.totalClose).toBe(10000);

        // Edited State
        const resEdited = calculateCDDuesAndSplit({
          principal: 100000,
          rate: 3,
          currentDueDate: '2026-06-26',
          paymentDate: '2026-06-11',
          paymentAmount: 0,
          periodDays: 15
        });
        expect(resEdited.renewalDue).toBe(1500); // 100000 * 3% * 15 / 30 = 1500
        expect(resEdited.totalClose).toBe(100000);
      });
    });
  });
});

