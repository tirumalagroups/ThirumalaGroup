import { getCDAccountPosition, allocateCDRenewalPayment, vbaRound } from './src/services/cdLedgerEngine';

const mockLoan = {
  loan_id: 'CD_AUDIT',
  amount: 750000,
  date: '2025-02-18', 
  period_days: 30,
  interest_rate: 3,
  penalty_percent: 0.75,
  grace_days: 5
};

const DAILY_INTEREST = 750;
const DAILY_PENALTY = 187.50;

const ledgerEntries: any[] = [
  { id: 'L0', entry_date: '2025-02-18', entry_type: 'original_loan', credit: 0, debit: 750000 },
  { id: 'L1', entry_date: '2025-03-24', entry_type: 'amount_paid', credit: 22500, receipt_no: 'R1' },
  { id: 'L2', entry_date: '2025-04-19', entry_type: 'amount_paid', credit: 22500, receipt_no: 'R2' }
];

const interestDetails: any[] = [
  { id: 'I1_1', entry_date: '2025-03-24', credit: 22500, row_type: 'interest_payment', receipt_no: 'R1' },
  { id: 'I1_2', entry_date: '2025-03-24', credit: 0, renewed_days: 30, row_type: 'Renewal', receipt_no: 'R1' },
  { id: 'I2_1', entry_date: '2025-04-19', credit: 22500, row_type: 'interest_payment', receipt_no: 'R2' },
  { id: 'I2_2', entry_date: '2025-04-19', credit: 0, renewed_days: 30, row_type: 'Renewal', receipt_no: 'R2' }
];

let rc = 3;

function runPayment(date: string, cash: number) {
  const pos = getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, date);
  const allocation = allocateCDRenewalPayment(cash, pos.displayDueDays, DAILY_INTEREST, DAILY_PENALTY, 5);
  
  console.log(`\n--- Checkpoint: ${date} (Cash: ${cash}) ---`);
  console.log(`exactDueDays: ${pos.exactDueDays}`);
  console.log(`displayDueDays: ${pos.displayDueDays}`);
  console.log(`Engine renewedDays: ${allocation.renewedDays}`);
  console.log(`Engine exact interest: ${allocation.interestPaidExact}`);
  console.log(`Engine exact penalty: ${allocation.penaltyPaidExact}`);
  console.log(`Engine stored interest: ${allocation.interestLedgerCredit}`);
  console.log(`Engine stored penalty: ${allocation.penaltyLedgerCredit}`);

  ledgerEntries.push({
    id: `L${rc}`, entry_date: date, entry_type: 'amount_paid', credit: cash, receipt_no: `R${rc}`
  });
  interestDetails.push({
    id: `I${rc}_1`, entry_date: date, credit: allocation.interestLedgerCredit, row_type: 'interest_payment', receipt_no: `R${rc}`
  });
  interestDetails.push({
    id: `I${rc}_2`, entry_date: date, credit: 0, renewed_days: allocation.renewedDays, row_type: 'Renewal', receipt_no: `R${rc}`
  });
  rc++;
}

runPayment('2025-05-28', 10000);
runPayment('2025-05-30', 5000);
runPayment('2025-06-03', 10000);
runPayment('2025-06-23', 22500);
runPayment('2025-08-06', 30000);
