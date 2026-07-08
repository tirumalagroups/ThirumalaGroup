import { describe, it, expect } from 'vitest';
import { getCDAccountPosition, allocateCDRenewalPayment } from '../services/cdLedgerEngine';

describe('CD Engine Audit: Observed Checkpoints', () => {

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
      credit: 0,
      debit: 750000
    },
    {
      id: 'L1',
      entry_date: '2025-03-24',
      entry_type: 'amount_paid',
      credit: 22500,
      receipt_no: 'R1'
    },
    {
      id: 'L2',
      entry_date: '2025-04-19',
      entry_type: 'amount_paid',
      credit: 22500,
      receipt_no: 'R2'
    }
  ];

  const interestDetails: any[] = [
    {
      id: 'I1_1',
      entry_date: '2025-03-24',
      credit: 22500,
      row_type: 'interest_payment',
      receipt_no: 'R1'
    },
    {
      id: 'I1_2',
      entry_date: '2025-03-24',
      credit: 0,
      renewed_days: 30,
      row_type: 'Renewal',
      receipt_no: 'R1'
    },
    {
      id: 'I2_1',
      entry_date: '2025-04-19',
      credit: 22500,
      row_type: 'interest_payment',
      receipt_no: 'R2'
    },
    {
      id: 'I2_2',
      entry_date: '2025-04-19',
      credit: 0,
      renewed_days: 30,
      row_type: 'Renewal',
      receipt_no: 'R2'
    }
  ];

  let rc = 3;

  it('1. 28-May-2025 Payment Checkpoint', () => {
    // 28-May-2025 Payment
    const pos = getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2025-05-28');
    
    const allocation = allocateCDRenewalPayment(
      10000,
      pos.displayDueDays,
      DAILY_INTEREST,
      DAILY_PENALTY,
      5
    );

    expect(allocation.renewedDays).toBe(10.83);
    expect(allocation.interestPaidExact).toBe(8122.50);
    expect(allocation.penaltyPaidExact).toBe(1877.50);
    expect(allocation.interestLedgerCredit).toBe(8122);
    expect(allocation.penaltyLedgerCredit).toBe(1878);

    ledgerEntries.push({
      id: `L${rc}`,
      entry_date: '2025-05-28',
      entry_type: 'amount_paid',
      credit: 10000,
      receipt_no: `R${rc}`
    });
    
    interestDetails.push({
      id: `I${rc}_1`,
      entry_date: '2025-05-28',
      credit: allocation.interestLedgerCredit,
      row_type: 'interest_payment',
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_2`,
      entry_date: '2025-05-28',
      credit: 0,
      renewed_days: allocation.renewedDays,
      row_type: 'Renewal',
      receipt_no: `R${rc}`
    });
    rc++;
  });

  it('2. 30-May-2025 Payment Checkpoint', () => {
    const pos = getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2025-05-30');
    
    const allocation = allocateCDRenewalPayment(
      5000,
      pos.displayDueDays,
      DAILY_INTEREST,
      DAILY_PENALTY,
      5
    );

    expect(allocation.renewedDays).toBe(6.67);
    expect(allocation.interestPaidExact).toBe(5002.50);
    expect(allocation.penaltyPaidExact).toBe(0);
    expect(allocation.interestLedgerCredit).toBe(5002);
    expect(allocation.penaltyLedgerCredit).toBe(0);

    ledgerEntries.push({
      id: `L${rc}`,
      entry_date: '2025-05-30',
      entry_type: 'amount_paid',
      credit: 5000,
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_1`,
      entry_date: '2025-05-30',
      credit: allocation.interestLedgerCredit,
      row_type: 'interest_payment',
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_2`,
      entry_date: '2025-05-30',
      credit: 0,
      renewed_days: allocation.renewedDays,
      row_type: 'Renewal',
      receipt_no: `R${rc}`
    });
    rc++;
  });

  it('3. 03-Jun-2025 Payment Checkpoint', () => {
    const pos = getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2025-06-03');
    
    const allocation = allocateCDRenewalPayment(
      10000,
      pos.displayDueDays,
      DAILY_INTEREST,
      DAILY_PENALTY,
      5
    );

    expect(allocation.renewedDays).toBe(13.33);
    expect(allocation.interestPaidExact).toBe(9997.50);
    expect(allocation.penaltyPaidExact).toBe(2.50);
    expect(allocation.interestLedgerCredit).toBe(9998);
    expect(allocation.penaltyLedgerCredit).toBe(2);

    ledgerEntries.push({
      id: `L${rc}`,
      entry_date: '2025-06-03',
      entry_type: 'amount_paid',
      credit: 10000,
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_1`,
      entry_date: '2025-06-03',
      credit: allocation.interestLedgerCredit,
      row_type: 'interest_payment',
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_2`,
      entry_date: '2025-06-03',
      credit: 0,
      renewed_days: allocation.renewedDays,
      row_type: 'Renewal',
      receipt_no: `R${rc}`
    });
    rc++;
  });

  it('4. 23-Jun-2025 Payment Checkpoint (EXPECTED DIVERGENCE)', () => {
    const pos = getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2025-06-23');
    
    expect(pos.exactDueDays).toBe(5.17); // 5.16 rounded mathematically in code, check actual

    const allocation = allocateCDRenewalPayment(
      22500,
      pos.displayDueDays,
      DAILY_INTEREST,
      DAILY_PENALTY,
      5
    );

    expect(pos.displayDueDays).toBe(5);
    expect(pos.displayDueDays > 5).toBe(false);

    expect(allocation.renewedDays).toBe(30);
    expect(allocation.interestPaidExact).toBe(22500);
    expect(allocation.penaltyPaidExact).toBe(0);
    expect(allocation.interestLedgerCredit).toBe(22500);
    expect(allocation.penaltyLedgerCredit).toBe(0);

    ledgerEntries.push({
      id: `L${rc}`,
      entry_date: '2025-06-23',
      entry_type: 'amount_paid',
      credit: 22500,
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_1`,
      entry_date: '2025-06-23',
      credit: allocation.interestLedgerCredit,
      row_type: 'interest_payment',
      receipt_no: `R${rc}`
    });
    interestDetails.push({
      id: `I${rc}_2`,
      entry_date: '2025-06-23',
      credit: 0,
      renewed_days: allocation.renewedDays,
      row_type: 'Renewal',
      receipt_no: `R${rc}`
    });
    rc++;
  });

  it('5. 06-Aug-2025 Payment Checkpoint', () => {
    const pos = getCDAccountPosition(mockLoan, ledgerEntries, interestDetails, '2025-08-06');
    
    const allocation = allocateCDRenewalPayment(
      30000,
      pos.displayDueDays,
      DAILY_INTEREST,
      DAILY_PENALTY,
      5
    );

    expect(allocation.renewedDays).toBe(35.25);
    expect(allocation.interestPaidExact).toBe(26437.50);
    expect(allocation.penaltyPaidExact).toBe(3562.50);
    expect(allocation.interestLedgerCredit).toBe(26438);
    expect(allocation.penaltyLedgerCredit).toBe(3562);
  });

});
