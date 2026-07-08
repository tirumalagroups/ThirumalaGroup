/**
 * CD LEDGER BUSINESS ENGINE — ONE AUTHORITATIVE SOURCE OF TRUTH
 * 
 * Rebuilt from scratch with exact parity to the original Microsoft Access behavior.
 */

export interface CDContract {
  id: string;
  loanId: string;
  customer_id: string;
  originalLoanDate: string; // YYYY-MM-DD
  originalPrincipal: number;
  interestRate: number; // % per period
  penaltyRate: number; // % per period
  periodDays: number; // e.g. 30
  graceDays: number; // e.g. 5
  status: string;
}

export interface CDEvent {
  id: string;
  entryDate: string; // YYYY-MM-DD
  accountName: string;
  credit: number;
  debit: number;
  receiptNo: string | null;
  particulars: string;
  entryType: string;
}

export interface CDInterestDetailEvent {
  id: string;
  entryDate: string; // YYYY-MM-DD
  credit: number;
  receiptNo: string | null;
  particulars: string;
  renewedDays: number;
  renewedTillDate: string | null;
  rowType: string;
}

export interface CDAccountPosition {
  principalBalance: number;
  originalLoanDate: string;
  periodDays: number;
  initialContractualPositionStr: string;
  baseDueDate: string;
  totalRenewedDays: number;
  contractualPositionDate: string;
  currentDueDate: string;
  fractionalCarry: number;
  displayDays: number;
  displayDueDays: number;
  exactDueDays: number;
  dailyInterest: number;
  dailyPenalty: number;
  accruedInterest: number;
  accruedPenalty: number;
  todayDue: number;
  renewalAmount: number;
  totalToRegularize: number;
  totalForClose: number;
  lastPaymentDate: string | null;
}

export interface CDPaymentSplit {
  totalPaid: number;
  penaltyPaid: number;
  interestPaid: number;
  principalPaid: number;
  renewedDays: number;
  overdueInterestPaid: number;
  renewalInterestPaid: number;
}

// ============================================================================
// CENTRALIZED ROUNDING HELPERS
// ============================================================================

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundCDMoney(value: number): number {
  return Math.round((value + 1e-9) * 100) / 100;
}

export function roundRenewedDays(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDisplayDays(exactDays: number): number {
  const floor = Math.floor(exactDays);
  const frac = exactDays - floor;
  // If fractional part is 0.5 or more, round up to next day
  if (Number(frac.toFixed(4)) >= 0.5) {
    return floor + 1;
  }
  return floor;
}

/**
 * Banker's Rounding (round-half-to-even) to whole numbers.
 * Matches MS Access VBA Int() / Round() behaviour.
 */
export function roundRupee(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Full implementation of MS Access VBA Round() which uses Banker's Rounding (round-to-even).
 */
export function vbaRound(num: number, decimalPlaces: number = 0): number {
  const multiplier = Math.pow(10, decimalPlaces);
  const value = num * multiplier;
  const floor = Math.floor(value);
  const diff = value - floor;
  let rounded;
  if (diff < 0.5) {
    rounded = floor;
  } else if (diff > 0.5) {
    rounded = floor + 1;
  } else {
    rounded = floor % 2 === 0 ? floor : floor + 1;
  }
  return rounded / multiplier;
}


// ============================================================================
// DATE CALCULATION HELPERS
// ============================================================================

export function parseDateParts(d: string | Date | number): { year: number; month: number; day: number } {
  if (d instanceof Date) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  }
  if (typeof d === 'number') {
    const date = new Date(d);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
  if (typeof d === 'string') {
    const isoPart = d.split('T')[0];
    const parts = isoPart.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
        return { year: y, month: m, day };
      }
    }
    const date = new Date(d);
    // If it parsed as UTC midnight
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
      };
    }
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
  const date = new Date();
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function getCalendarMidnightUTC(d: string | Date | number): number {
  const { year, month, day } = parseDateParts(d);
  return Date.UTC(year, month - 1, day);
}

export function dateOrdinal(d: string | Date | number): number {
  return Math.round(getCalendarMidnightUTC(d) / (24 * 60 * 60 * 1000));
}

export function ordinalToDateStr(ordinal: number): string {
  const date = new Date(Math.round(ordinal) * 24 * 60 * 60 * 1000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function differenceInCalendarDays(d1: string | Date | number, d2: string | Date | number): number {
  const utc1 = getCalendarMidnightUTC(d1);
  const utc2 = getCalendarMidnightUTC(d2);
  return Math.round((utc1 - utc2) / (24 * 60 * 60 * 1000));
}

export function addCalendarDays(d: string | Date | number, days: number): string {
  const { year, month, day } = parseDateParts(d);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ============================================================================
// ENGINE IMPLEMENTATION
// ============================================================================

export function buildCDContract(loan: any): CDContract {
  if (!loan) {
    throw new Error('CD_ENGINE_ERROR: Loan record is required to build CDContract.');
  }
  return {
    id: loan.id,
    loanId: loan.loan_id || '',
    customer_id: loan.customer_id || '',
    originalLoanDate: (loan.date || '').split('T')[0],
    originalPrincipal: Number(loan.amount) || 0,
    interestRate: Number(loan.interest_rate) || 3,
    penaltyRate: loan.penalty_percent !== undefined && loan.penalty_percent !== null ? Number(loan.penalty_percent) : 0.75,
    periodDays: loan.period_days && Number(loan.period_days) > 0 ? Number(loan.period_days) : 30,
    graceDays: loan.grace_days !== undefined && loan.grace_days !== null ? Number(loan.grace_days) : 5,
    status: loan.status || 'Active',
  };
}

export function getCDHistoricalEvents(
  ledgerEntries: any[],
  interestDetails: any[]
): { ledgerEvents: CDEvent[]; interestEvents: CDInterestDetailEvent[] } {
  const ledgerEvents: CDEvent[] = (ledgerEntries || []).map(e => ({
    id: e.id,
    entryDate: (e.entry_date || '').split('T')[0],
    accountName: e.account_name || '',
    credit: Number(e.credit) || 0,
    debit: Number(e.debit) || 0,
    receiptNo: e.receipt_no || null,
    particulars: e.particulars || '',
    entryType: e.entry_type || '',
  }));

  const interestEvents: CDInterestDetailEvent[] = (interestDetails || []).map(d => ({
    id: d.id,
    entryDate: (d.entry_date || '').split('T')[0],
    credit: Number(d.credit) || 0,
    receiptNo: d.receipt_no || null,
    particulars: d.particulars || '',
    renewedDays: Number(d.renewed_days) || 0,
    renewedTillDate: d.renewed_till_date ? (d.renewed_till_date || '').split('T')[0] : null,
    rowType: d.row_type || '',
  }));

  return { ledgerEvents, interestEvents };
}

export function getCDPrincipalBalance(contract: CDContract, ledgerEvents: CDEvent[]): number {
  // Find original loan disbursement amount first
  const disb = ledgerEvents.find(e => e.entryType === 'original_loan' || e.entryType === 'Disbursement');
  const originalPrincipal = disb ? disb.debit : contract.originalPrincipal;
  
  // Principal balance = originalPrincipal - sum of principal_payment credit allocations
  const principalPaid = ledgerEvents
    .filter(e => e.entryType === 'principal_payment')
    .reduce((sum, e) => sum + e.credit, 0);

  return Number(Math.max(0, originalPrincipal - principalPaid).toFixed(2));
}

export function getCDTotalRenewedDays(interestEvents: CDInterestDetailEvent[]): number {
  // Mode A & B check:
  // Pre-stored: row has credit = 0 AND renewed_days > 0
  // Derived (for legacy): row has credit > 0.
  // Note: we sum the pre-stored renewed_days from the credit = 0 note rows.
  // This is the authoritative renewed_days history.
  return interestEvents
    .filter(d => d.credit === 0 && d.renewedDays > 0)
    .reduce((sum, d) => sum + d.renewedDays, 0);
}

export function getCDContractualPosition(
  contract: CDContract,
  _ledgerEvents: CDEvent[],
  interestEvents: CDInterestDetailEvent[]
): {
  baseDueDate: string;
  exactRenewedDays: number;
  contractualPositionDate: string;
  currentDueDate: string;
  fractionalCarry: number;
} {
  const baseDueDate = addCalendarDays(contract.originalLoanDate, contract.periodDays - 1);
  const baseOrdinal = dateOrdinal(baseDueDate);

  const dailyInterest = (contract.originalPrincipal * (contract.interestRate / 100)) / contract.periodDays;

  const groups: { [key: string]: CDInterestDetailEvent[] } = {};
  const nullReceiptEvents: CDInterestDetailEvent[] = [];

  for (const row of interestEvents) {
    if (!row.receiptNo) {
      nullReceiptEvents.push(row);
    } else {
      if (!groups[row.receiptNo]) {
        groups[row.receiptNo] = [];
      }
      groups[row.receiptNo].push(row);
    }
  }

  let exactRenewedDays = 0;

  const processGroup = (rows: CDInterestDetailEvent[]) => {
    const renewalRows = rows.filter(row => (row.rowType === 'Renewal' || row.credit === 0) && row.renewedDays > 0);
    if (renewalRows.length > 0) {
      return renewalRows.reduce((sum, r) => sum + r.renewedDays, 0);
    }

    const interestPaid = rows
      .filter(row => row.rowType === 'interest_payment')
      .reduce((sum, r) => sum + r.credit, 0);

    if (interestPaid > 0 && dailyInterest > 0) {
      return vbaRound(interestPaid / dailyInterest, 2);
    }

    return 0;
  };

  for (const receiptNo of Object.keys(groups)) {
    exactRenewedDays += processGroup(groups[receiptNo]);
  }

  for (const row of nullReceiptEvents) {
    exactRenewedDays += processGroup([row]);
  }

  const currentPositionExact = baseOrdinal + exactRenewedDays;
  const wholePart = Math.floor(currentPositionExact);
  const fractionalCarry = vbaRound(currentPositionExact - wholePart, 2);
  const contractualPositionDate = ordinalToDateStr(wholePart);
  
  // MS Access rounds up exactRenewedDays if fraction >= 0.5 for UI presentation
  const exactRenewedFrac = exactRenewedDays - Math.floor(exactRenewedDays);
  const displayRenewedDays = exactRenewedFrac >= 0.5 ? Math.floor(exactRenewedDays) + 1 : Math.floor(exactRenewedDays);
  const displayDueDate = addCalendarDays(baseDueDate, displayRenewedDays);

  return {
    baseDueDate,
    exactRenewedDays: vbaRound(exactRenewedDays, 2),
    contractualPositionDate,
    currentDueDate: displayDueDate,
    fractionalCarry,
  };
}

export function getCDAccountPosition(
  loan: any,
  ledgerEntries: any[],
  interestDetails: any[],
  asOfDate: string
): CDAccountPosition {
  const contract = buildCDContract(loan);
  const { ledgerEvents, interestEvents } = getCDHistoricalEvents(ledgerEntries, interestDetails);

  const disbEntry = ledgerEvents.find(e => e.entryType === 'original_loan' || e.entryType === 'Disbursement');
  if (disbEntry) {
    contract.originalLoanDate = disbEntry.entryDate;
  }

  const monetaryPayments = ledgerEvents
    .filter(e => e.entryType === 'amount_paid' || e.credit > 0)
    .sort((a, b) => dateOrdinal(a.entryDate) - dateOrdinal(b.entryDate));
  if (monetaryPayments.length > 0) {
    const earliestPaymentDate = monetaryPayments[0].entryDate;
    if (contract.originalLoanDate > earliestPaymentDate) {
      const err = new Error(`CD_DATA_INTEGRITY_ERROR: Loan ${contract.loanId} has loan_date ${contract.originalLoanDate} after earliest monetary payment ${earliestPaymentDate}.`);
      (err as any).code = 'CD_DATA_INTEGRITY_ERROR';
      throw err;
    }
  }

  const principalBalance = getCDPrincipalBalance(contract, ledgerEvents);
  const { baseDueDate, exactRenewedDays, contractualPositionDate, currentDueDate, fractionalCarry } = getCDContractualPosition(contract, ledgerEvents, interestEvents);

  const elapsedDays = differenceInCalendarDays(asOfDate, baseDueDate);
  const exactDueDays = vbaRound(elapsedDays - exactRenewedDays, 2);
  const displayDays = exactDueDays;
  const displayDueDays = vbaRound(displayDays, 0);

  const dailyInterest = vbaRound((principalBalance * (contract.interestRate / 100)) / 30, 5);
  const dailyPenalty = vbaRound((principalBalance * (contract.penaltyRate / 100)) / 30, 2);

  const accruedInterest = exactDueDays <= 0 ? 0 : roundCDMoney(dailyInterest * exactDueDays);
  const penaltyEligible = vbaRound(exactDueDays, 0) > contract.graceDays;
  const accruedPenalty = (exactDueDays <= 0 || !penaltyEligible) ? 0 : roundCDMoney(dailyPenalty * exactDueDays);

  const todayDue = roundCDMoney(accruedInterest + accruedPenalty);
  const renewalAmount = roundCDMoney(principalBalance * (contract.interestRate / 100) * (contract.periodDays / 30));
  const totalToRegularize = exactDueDays <= 0 ? 0 : roundCDMoney(todayDue + renewalAmount);
  const totalForClose = roundCDMoney(principalBalance + todayDue);

  const paymentEntries = ledgerEvents
    .filter(e => e.entryType === 'amount_paid' && e.credit > 0)
    .sort((a, b) => dateOrdinal(b.entryDate) - dateOrdinal(a.entryDate));
  
  const lastPaymentDate = paymentEntries.length > 0 ? paymentEntries[0].entryDate : null;

  return {
    principalBalance,
    originalLoanDate: contract.originalLoanDate,
    periodDays: contract.periodDays,
    initialContractualPositionStr: baseDueDate,
    baseDueDate,
    totalRenewedDays: exactRenewedDays,
    contractualPositionDate,
    currentDueDate,
    fractionalCarry,
    displayDays,
    displayDueDays,
    exactDueDays,
    dailyInterest,
    dailyPenalty,
    accruedInterest,
    accruedPenalty,
    todayDue,
    renewalAmount,
    totalToRegularize,
    totalForClose,
    lastPaymentDate,
  };
}

export function allocateCDRenewalPayment(
  cash: number,
  displayDueDaysBeforePayment: number,
  dailyInterest: number,
  dailyPenalty: number,
  graceDays: number
): { renewedDays: number, interestPaidExact: number, penaltyPaidExact: number, interestLedgerCredit: number, penaltyLedgerCredit: number } {
  
  const penaltyEligible = displayDueDaysBeforePayment > graceDays;
  const initialPenalty = penaltyEligible ? vbaRound(dailyPenalty * displayDueDaysBeforePayment, 2) : 0;

  const renewedDays = vbaRound((cash - initialPenalty) / dailyInterest, 2);
  
  const interestPaidExact = vbaRound(dailyInterest * renewedDays, 2);
  let penaltyResidual = vbaRound(cash - interestPaidExact, 2);

  if (penaltyResidual < 0) {
      penaltyResidual = 0;
  }
  return {
      renewedDays,
      interestPaidExact,
      penaltyPaidExact: penaltyResidual,
      interestLedgerCredit: vbaRound(interestPaidExact, 0),
      penaltyLedgerCredit: vbaRound(penaltyResidual, 0)
  };
}

export interface AccessRenewSimulationResult {
  initialInterest: number;
  initialPenalty: number;
  lostFocusRDays: number;
  lostFocusInterest: number;
  lostFocusPenalty: number;
  finalRDays: number;
  finalInterestExact: number;
  finalPenaltyExact: number;
  persistedInterest: number;
  persistedPenalty: number;
}

export function simulateAccessRenewEventChain(
  position: CDAccountPosition,
  cash: number
): AccessRenewSimulationResult {
  const principal = position.principalBalance;
  
  // Derive rates from position values to keep it signature-compatible
  const rate = position.principalBalance > 0 
    ? vbaRound((position.dailyInterest * 3000) / position.principalBalance, 2) 
    : 3;
  const penaltyRate = position.principalBalance > 0 
    ? vbaRound((position.dailyPenalty * 3000) / position.principalBalance, 2) 
    : 0.75;

  const exactDueDays = position.exactDueDays;
  const initialInterest = position.accruedInterest;
  const initialPenalty = position.accruedPenalty;

  // 2. PENALTY ELIGIBILITY & 3. RENEW LOSTFOCUS EVENT SIMULATION
  const checkDueDays = vbaRound(exactDueDays, 0);
  const graceDays = position.periodDays === 45 ? 5 : 5; // standard grace is 5
  
  let penaltyAfterCalculating = 0;
  let lostFocusRDays = 0;
  
  const dailyInterestLostFocus = vbaRound(principal * rate / 100 / 30, 2);
  const dailyPenalty = vbaRound(principal * penaltyRate / 100 / 30, 2);
  
  if (checkDueDays <= graceDays) {
    penaltyAfterCalculating = 0;
    lostFocusRDays = dailyInterestLostFocus > 0 ? vbaRound(cash / dailyInterestLostFocus, 0) : 0;
  } else {
    const dailyCombined = vbaRound(
      principal * (rate + penaltyRate) / 100 / 30,
      2
    );

    lostFocusRDays = dailyCombined > 0 ? vbaRound(
      cash / dailyCombined,
      0
    ) : 0;

    const pDays = exactDueDays > lostFocusRDays ? lostFocusRDays : exactDueDays;

    penaltyAfterCalculating = vbaRound(
      dailyPenalty * pDays,
      0
    );
  }

  const lostFocusInterest = vbaRound(dailyInterestLostFocus * lostFocusRDays, 0);
  const lostFocusPenalty = penaltyAfterCalculating;

  // 4. RENBTN_GOTFOCUS SIMULATION
  const dailyInterest = vbaRound(
    principal * rate / 100 / 30,
    5
  );

  let finalRDays = 0;
  let interestExact = 0;
  let penaltyExact = 0;

  if (cash <= penaltyAfterCalculating) {
    finalRDays = 0;
    interestExact = 0;
    penaltyExact = cash;
  } else {
    finalRDays = dailyInterest > 0 ? vbaRound(
      (cash - penaltyAfterCalculating) / dailyInterest,
      2
    ) : 0;

    interestExact = vbaRound(
      dailyInterest * finalRDays,
      2
    );

    penaltyExact = vbaRound(
      cash - interestExact,
      2
    );
    if (penaltyExact < 0) {
      penaltyExact = 0;
    }
  }

  // 5. DATABASE POSTING
  const persistedInterest = vbaRound(interestExact, 0);
  const persistedPenalty = vbaRound(penaltyExact, 0);

  return {
    initialInterest,
    initialPenalty,
    lostFocusRDays,
    lostFocusInterest,
    lostFocusPenalty,
    finalRDays,
    finalInterestExact: interestExact,
    finalPenaltyExact: penaltyExact,
    persistedInterest,
    persistedPenalty,
  };
}

export function allocateCDPayment(
  position: CDAccountPosition,
  paymentAmount: number,
  actionType: 'Renew' | 'Partial' | 'Close',
  _periodDays: number
): CDPaymentSplit {
  const pAmt = roundMoney(paymentAmount);
  const penDue = position.accruedPenalty;
  const intDue = position.accruedInterest;
  const prin = position.principalBalance;
  
  const totalDues = roundMoney(penDue + intDue);
  const isClosing = actionType === 'Close' || pAmt >= roundMoney(totalDues + prin);

  let penaltyPaid = 0;
  let interestPaid = 0;
  let principalPaid = 0;
  let renewedDays = 0;

  if (isClosing) {
    penaltyPaid = roundCDMoney(penDue);
    interestPaid = roundCDMoney(intDue);
    principalPaid = roundMoney(Math.max(0, pAmt - penaltyPaid - interestPaid));
    renewedDays = 0;
  } else if (actionType === 'Renew') {
    const sim = simulateAccessRenewEventChain(position, pAmt);
    renewedDays = sim.finalRDays;
    interestPaid = sim.persistedInterest;
    penaltyPaid = sim.persistedPenalty;
    principalPaid = 0;
  } else if (pAmt >= totalDues && actionType === 'Partial') {
    penaltyPaid = roundCDMoney(penDue);
    interestPaid = roundCDMoney(intDue);
    principalPaid = roundMoney(Math.max(0, pAmt - penaltyPaid - interestPaid));
    renewedDays = position.exactDueDays;
  } else if (actionType === 'Partial') {
    // actionType === 'Partial' underpaying (combined-rate allocator)
    const combinedRate = position.dailyInterest + position.dailyPenalty;
    if (combinedRate <= 0) {
      renewedDays = 0;
      interestPaid = 0;
      penaltyPaid = pAmt;
    } else {
      renewedDays = vbaRound(pAmt / combinedRate, 2);
      interestPaid = vbaRound(renewedDays * position.dailyInterest, 2);
      penaltyPaid = vbaRound(pAmt - interestPaid, 2);
    }
    principalPaid = 0;
  } else {
    throw new Error(`Unsupported CD payment action: ${actionType}`);
  }

  const isOverduePayment = isClosing || (pAmt >= totalDues && actionType === 'Partial');

  return {
    totalPaid: pAmt,
    penaltyPaid,
    interestPaid,
    principalPaid,
    renewedDays,
    overdueInterestPaid: isOverduePayment ? interestPaid : 0,
    renewalInterestPaid: !isOverduePayment ? interestPaid : 0,
  };
}



export function validateCDReceipt(events: { ledgerEvents: CDEvent[] }, receiptNo: string): {
  success: boolean;
  cashAmount: number;
  allocationAmount: number;
  difference: number;
} {
  const receiptEntries = events.ledgerEvents.filter(e => e.receiptNo === receiptNo);
  
  const cashEntry = receiptEntries.find(e => e.entryType === 'amount_paid');
  const cashAmount = cashEntry ? cashEntry.credit : 0;

  const allocations = receiptEntries.filter(e => 
    e.entryType === 'penalty_payment' || 
    e.entryType === 'interest_payment' || 
    e.entryType === 'principal_payment'
  );
  const allocationAmount = allocations.reduce((sum, e) => sum + e.credit, 0);
  
  const difference = roundMoney(cashAmount - allocationAmount);
  const success = Math.abs(difference) <= 0.01;

  return {
    success,
    cashAmount,
    allocationAmount,
    difference,
  };
}
