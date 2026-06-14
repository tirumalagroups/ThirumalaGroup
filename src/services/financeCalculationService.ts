import { FinanceLedgerSetting } from '../lib/supabaseFinance';
import { financeLedgerSettingsService } from './financeLedgerSettingsService';

export const financeCalculationService = {
  /**
   * Calculates simple interest given a principal, rate per month, and days elapsed.
   */
  calculateSimpleInterest(principal: number, ratePerMonth: number, daysElapsed: number, daysPerYear: number = 365): number {
    // If rate is per month, then annual rate is ratePerMonth * 12
    // Daily rate is (ratePerMonth * 12) / daysPerYear
    // But traditionally in this system, it might just be calculated as (daysElapsed / 30)
    // Let's stick to the current formula used everywhere: principal * (rate/100) * (days/30)
    // But if we use daysPerYear, maybe: principal * (ratePerMonth * 12 / 100) * (daysElapsed / daysPerYear)
    // To remain backward compatible while adopting daysPerYear:
    return principal * (ratePerMonth / 100) * (daysElapsed / (daysPerYear / 12));
  },

  /**
   * Calculates flat EMI interest.
   */
  calculateFlatInterest(principal: number, ratePerMonth: number, durationMonths: number): number {
    return principal * (ratePerMonth / 100) * durationMonths;
  },

  /**
   * Dynamic calculate interest wrapper based on setting method
   */
  calculateInterestFromSetting(
    principal: number, 
    durationDays: number, 
    setting: FinanceLedgerSetting,
    durationMonthsFallback: number = 0
  ): number {
    switch (setting.method) {
      case 'FLAT_EMI':
        const months = durationMonthsFallback > 0 ? durationMonthsFallback : (durationDays / (setting.days_per_year / 12));
        return this.calculateFlatInterest(principal, setting.rate, months);
      case 'COMPOUND_MONTHLY':
        // A placeholder for compound monthly if needed. Currently falls back to simple in most modules.
        // P(1 + r/100)^n - P
        const n = durationMonthsFallback > 0 ? durationMonthsFallback : Math.floor(durationDays / (setting.days_per_year / 12));
        return (principal * Math.pow(1 + setting.rate / 100, n)) - principal;
      case 'SIMPLE_DAILY':
      default:
        return this.calculateSimpleInterest(principal, setting.rate, durationDays, setting.days_per_year);
    }
  },

  /**
   * Calculates penalty (overdue) interest based on setting
   */
  calculatePenaltyFromSetting(principal: number, overdueDays: number, setting: FinanceLedgerSetting): number {
    if (overdueDays <= 0) return 0;
    return this.calculateSimpleInterest(principal, setting.overdue, overdueDays, setting.days_per_year);
  },

  /**
   * Get settings and calculate standard interest for a given ledger type
   */
  async calculateStandardInterest(principal: number, durationDays: number, ledgerCode: string): Promise<number> {
    const setting = await financeLedgerSettingsService.getLedgerSettings(ledgerCode);
    return this.calculateInterestFromSetting(principal, durationDays, setting);
  },

  /**
   * Complete loan calculations used by ledgers (CD, HP, etc)
   */
  getLoanCalculations(selectedLoan: any, setting: FinanceLedgerSetting | null) {
    const principal = Number(selectedLoan.amount);
    const duration = Number(selectedLoan.duration_months);

    // Calculate Interest charge and total repayable balance
    const interestAmount = setting 
      ? this.calculateInterestFromSetting(principal, duration * 30, setting, duration) 
      : (principal * (Number(selectedLoan.interest_rate) / 100) * duration);
      
    const totalRepayable = principal + interestAmount;

    // Filter collection transactions
    const collections = (selectedLoan.transactions || []).filter((t: any) => t.type === 'Collection');
    const totalCredit = collections.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

    // Disbursements transactions
    const disbursements = (selectedLoan.transactions || []).filter((t: any) => t.type === 'Disbursement');
    const totalDebit = disbursements.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

    const currentBalance = Math.max(0, totalRepayable - totalCredit);

    // Installment/dues statistics
    const totalDues = (selectedLoan.dues || []).reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const paidDues = (selectedLoan.dues || []).reduce((sum: number, d: any) => sum + Number(d.paid_amount || 0), 0);
    const pendingDues = Math.max(0, totalDues - paidDues);

    // Compile transaction list with running balance
    let runningBalance = totalRepayable;
    const processedTransactions = (selectedLoan.transactions || []).map((tx: any) => {
      let credit = 0;
      let debit = 0;
      if (tx.type === 'Collection') {
        credit = Number(tx.amount);
        runningBalance = Math.max(0, runningBalance - credit);
      } else if (tx.type === 'Disbursement') {
        debit = Number(tx.amount);
      }
      return {
        ...tx,
        credit,
        debit,
        balance: runningBalance
      };
    });

    return {
      principal,
      interestAmount,
      totalRepayable,
      totalCredit,
      totalDebit,
      currentBalance,
      totalDues,
      paidDues,
      pendingDues,
      processedTransactions
    };
  },

  /**
   * CD Ledger Specific Calculations
   */
  calculateInterest(principal: number, rate: number, interestDays: number, _periodDays?: number): number {
    if (interestDays <= 0) return 0;
    // Overdue interest uses a constant 30-day divisor as it is a daily accrual.
    return Number(((principal * (rate / 100) * interestDays) / 30).toFixed(2));
  },

  calculatePenalty(principal: number, penaltyRate: number, dueDays: number, _periodDays?: number): number {
    const penaltyDays = dueDays <= 5 ? 0 : dueDays;
    if (penaltyDays <= 0) return 0;
    // Overdue penalty uses a constant 30-day divisor as it is a daily accrual.
    return Number(((principal * (penaltyRate / 100) * penaltyDays) / 30).toFixed(2));
  },

  calculateRenewalTotal(interest: number, penalty: number): number {
    return Number((interest + penalty).toFixed(2));
  },

  calculateCloseTotal(principal: number, interest: number, penalty: number): number {
    return Number((principal + interest + penalty).toFixed(2));
  },

  computeRenewSplit(paymentAmount: number, penaltyDue: number) {
    if (penaltyDue > 0) {
      let penaltyPaid = Number((paymentAmount * 0.20).toFixed(2));
      let interestPaid = Number((paymentAmount * 0.80).toFixed(2));
      
      if (penaltyPaid > penaltyDue) {
        penaltyPaid = penaltyDue;
        interestPaid = Number((paymentAmount - penaltyPaid).toFixed(2));
      }
      
      return {
        penaltyPaid,
        interestPaid,
        principalPaid: 0
      };
    } else {
      return {
        penaltyPaid: 0,
        interestPaid: Number(paymentAmount.toFixed(2)),
        principalPaid: 0
      };
    }
  },

  computeCDPaymentSplit(
    paymentAmount: number,
    penaltyDue: number,
    interestDue: number,
    renewalInterestDue: number,
    principal: number,
    actionType: string,
    periodDays: number = 10
  ) {
    const pAmt = Number(paymentAmount) || 0;
    const penDue = Number(penaltyDue) || 0;
    const intDue = Number(interestDue) || 0;
    const renDue = Number(renewalInterestDue) || 0;
    const prin = Number(principal) || 0;
    const days = Number(periodDays) || 10;

    if (actionType === 'Partial') {
      return {
        penaltyPaid: 0,
        overdueInterestPaid: 0,
        renewalInterestPaid: 0,
        interestPaid: 0,
        principalPaid: pAmt,
        renewedDays: 0,
        remaining: 0
      };
    }

    if (actionType === 'Close') {
      let remaining = pAmt;
      const penaltyPaid = Math.min(remaining, penDue);
      remaining = Number((remaining - penaltyPaid).toFixed(2));
      const overdueInterestPaid = Math.min(remaining, intDue);
      remaining = Number((remaining - overdueInterestPaid).toFixed(2));
      const principalPaid = Math.min(remaining, prin);
      remaining = Number((remaining - principalPaid).toFixed(2));

      return {
        penaltyPaid: Number(penaltyPaid.toFixed(2)),
        overdueInterestPaid: Number(overdueInterestPaid.toFixed(2)),
        renewalInterestPaid: 0,
        interestPaid: Number(overdueInterestPaid.toFixed(2)),
        principalPaid: Number(principalPaid.toFixed(2)),
        renewedDays: 0,
        remaining: Number(remaining.toFixed(2))
      };
    }

    // VBA: RDAYS = (TotalAmountPaying − Penalty) / DailyInterest
    // Always strict sequential: Penalty first, then remainder buys interest days.
    // No proportional split — the legacy system never used one.
    {
      const penaltyPaid = Math.max(0, Math.min(pAmt, penDue));
      let remaining = Number((pAmt - penaltyPaid).toFixed(2));

      const overdueInterestPaid = Math.max(0, Math.min(remaining, intDue));
      remaining = Number((remaining - overdueInterestPaid).toFixed(2));

      const penaltyOutstanding = Number((penDue - penaltyPaid).toFixed(2));
      const overdueInterestOutstanding = Number((intDue - overdueInterestPaid).toFixed(2));

      // Only buy renewal days if all outstanding dues have been cleared
      const isDuesCleared = penaltyOutstanding === 0 && overdueInterestOutstanding === 0;

      const renewalInterestPaid = isDuesCleared ? remaining : 0;
      const totalInterestPaid = Number((overdueInterestPaid + renewalInterestPaid).toFixed(2));

      // dailyInterestValue = principal × rate / 100 / 30 (same as VBA DailyInterest)
      const dailyInterestValue = days > 0 ? (renDue / days) : (renDue / 10);
      const renewedDays = dailyInterestValue > 0 ? Math.floor(renewalInterestPaid / dailyInterestValue) : 0;

      return {
        penaltyPaid: Number(penaltyPaid.toFixed(2)),
        overdueInterestPaid: Number(overdueInterestPaid.toFixed(2)),
        renewalInterestPaid: Number(renewalInterestPaid.toFixed(2)),
        interestPaid: totalInterestPaid,
        principalPaid: 0,
        renewedDays,
        remaining: 0
      };
    }
  },

  applyPaymentSplit(
    amountPaying: number,
    interestDue: number,
    penaltyDue: number,
    principalBalance: number
  ) {
    let remaining = amountPaying;
    let penaltyPaid = 0;
    let interestPaid = 0;
    let principalPaid = 0;

    // Split order: (1) Penalty first, (2) Interest second, (3) Principal last
    if (remaining > 0) {
      penaltyPaid = Math.min(remaining, penaltyDue);
      remaining -= penaltyPaid;
    }
    if (remaining > 0) {
      interestPaid = Math.min(remaining, interestDue);
      remaining -= interestPaid;
    }
    if (remaining > 0) {
      principalPaid = Math.min(remaining, principalBalance);
      remaining -= principalPaid;
    }

    return {
      penaltyPaid: Number(penaltyPaid.toFixed(2)),
      interestPaid: Number(interestPaid.toFixed(2)),
      principalPaid: Number(principalPaid.toFixed(2)),
      remaining: Number(remaining.toFixed(2))
    };
  },

  calculateNextDueDate(paymentDate: string | Date, periodDays: number = 10): string {
    const dateObj = new Date(paymentDate);
    const nextDueDate = new Date(dateObj.getTime() + periodDays * 24 * 60 * 60 * 1000);
    return nextDueDate.toISOString().split('T')[0];
  },

  getNextReceiptNumber(latestReceiptNo: string | null): string {
    if (!latestReceiptNo) {
      return 'RC001';
    }
    const match = latestReceiptNo.match(/RC(\d+)/i);
    if (!match) {
      return 'RC001';
    }
    const num = parseInt(match[1], 10);
    const nextNum = num + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `RC${padded}`;
  }
};

