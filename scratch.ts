import { getCDAccountPosition, allocateCDRenewalPayment } from './src/services/cdLedgerEngine';

const mockLoan = {
  loan_id: 'CD_AUDIT',
  amount: 750000,
  date: '2025-02-18', // Loan Date
  period_days: 30,
  interest_rate: 3,
  penalty_percent: 0.75,
  grace_days: 5
};

const DAILY_INTEREST = 750;
const DAILY_PENALTY = 187.50;

const ledgerEntries: any[] = [
  {
    id: 'L0',
    entry_date: '2025-02-18',
    entry_type: 'original_loan',
    credit: 0
  },
  {
    id: 'L1',
    entry_date: '2025-03-24',
    entry_type: 'amount_paid',
    credit: 22500,
    renewed_days: 30,
    interest: 22500,
    penalty: 0
  },
  {
    id: 'L2',
    entry_date: '2025-04-19',
    entry_type: 'amount_paid',
    credit: 22500,
    renewed_days: 30,
    interest: 22500,
    penalty: 0
  }
];

const pos = getCDAccountPosition(mockLoan, ledgerEntries, [], '2025-05-28');
console.log('pos 28 May:', pos);

