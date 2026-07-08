import { describe, it, expect, vi } from 'vitest';

// Force unmocking of Supabase client to ensure live network database queries
vi.unmock('../lib/supabase');
vi.unmock('@supabase/supabase-js');

import { supabaseFinance } from '../lib/supabaseFinance';
import { financeCalculationService } from '../services/financeCalculationService';

const CD120_LOAN_UUID = 'a9c4601a-6df4-434c-9915-7f4b827c6f21';
const AUDIT_DATE = '2026-07-06';

describe('CD120 Production Path Integration Test', () => {
  it('loads real data from DB, runs it through the production calculator, and verifies all target values', async () => {
    // 1. Load the actual persisted loan record
    const selectedLoan = await supabaseFinance.getLoanById(CD120_LOAN_UUID);
    expect(selectedLoan).not.toBeNull();
    expect(selectedLoan!.loan_id).toBe('CD120');

    // 2. Fetch the actual ledger and interest-detail entries
    const cdLedgerEntries = await supabaseFinance.getCDLedgerEntries(CD120_LOAN_UUID);
    const cdInterestDetails = await supabaseFinance.getCDInterestDetails(CD120_LOAN_UUID);

    expect(cdLedgerEntries.length).toBeGreaterThan(0);
    expect(cdInterestDetails.length).toBeGreaterThan(0);
    // 3. Run through the real production service used by CD Ledger React component
    const pos = financeCalculationService.getCDAccountPosition(
      selectedLoan,
      cdLedgerEntries,
      cdInterestDetails,
      AUDIT_DATE
    );

    // 4. Assert all locked target values
    // Principal Balance = 750,000.00 (CD120 original amount was ₹7,50,000)
    expect(pos.principalBalance).toBe(750000.00);

    // Last Payment = 2026-06-29 (RC719)
    expect(pos.lastPaymentDate).toBe('2026-06-29');

    // Current Due Date = 2026-05-28
    expect(pos.initialContractualPositionStr).toBe('2025-03-19');
    expect(pos.contractualPositionDate).toBe('2026-05-27');
    expect(pos.currentDueDateStr).toBe('2026-05-28');

    expect(pos.exactCalculationDays).toBe(39.19);
    expect(pos.exactDueDays).toBe(39.19);

    // Accrued Interest = 29392.50 (39.19 * 750)
    expect(pos.accruedInterest).toBe(29392.50);

    // Accrued Penalty = 7348.13 (39.19 * 187.50)
    expect(pos.accruedPenalty).toBe(7348.13);

    // Today Due = 36740.63
    expect(pos.todayDue).toBe(36740.63);

    // Total Renewal = ₹22,500.00
    expect(pos.renewalAmount).toBe(22500.00);

    // Total To Regularize = 36740.63 + 22500.00 = 59240.63
    expect(pos.totalToRegularize).toBe(59240.63);

    // Total For Close = 750000 + 36740.63 = 786740.63
    expect(pos.totalForClose).toBe(786740.63);
  });

  it('proves that the UI-facing mapping logic formats the production position result correctly for the UI cards/detail blocks', async () => {
    // 1. Fetch real DB data for CD120
    const selectedLoan = await supabaseFinance.getLoanById(CD120_LOAN_UUID);
    const cdLedgerEntries = await supabaseFinance.getCDLedgerEntries(CD120_LOAN_UUID);
    const cdInterestDetails = await supabaseFinance.getCDInterestDetails(CD120_LOAN_UUID);

    // 2. Generate production position
    const pos = financeCalculationService.getCDAccountPosition(
      selectedLoan,
      cdLedgerEntries,
      cdInterestDetails,
      AUDIT_DATE
    );

    // 3. UI Helpers replicating CDLedger.tsx mapping and formatting
    const formatDateOld = (dateStr: string | Date | number | null | undefined) => {
      if (!dateStr) return '';
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const yy = String(year).slice(-2);
        return `${day}-${months[monthIndex]}-${yy}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const yy = String(d.getFullYear()).slice(-2);
      const day = String(d.getDate()).padStart(2, '0');
      return `${day}-${months[d.getMonth()]}-${yy}`;
    };

    const formatCurrency = (val: number) => {
      return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // 4. Map to UI fields (exactly as ledgerMetrics and JSX cards render them now)
    const uiPrincipalBalance   = formatCurrency(pos.principalBalance);
    const uiTodayDue           = formatCurrency(pos.todayDue);
    const uiAccruedInterest    = formatCurrency(pos.accruedInterest);
    const uiAccruedPenalty     = formatCurrency(pos.accruedPenalty);
    const uiTotalForRenewal    = formatCurrency(pos.totalRenewal);
    const uiTotalToRegularize  = formatCurrency(pos.totalToRegularize);
    const uiTotalForClose      = formatCurrency(pos.totalForClose);
    const uiLastPayment        = formatDateOld(pos.lastPaymentDate);
    const uiCurrentDueDate     = formatDateOld(pos.currentDueDate);
    const uiDueDays            = pos.displayDueDays;

    // 5. Assert display values match the user requirements exactly
    expect(uiPrincipalBalance).toBe('₹7,50,000.00');
    expect(uiTodayDue).toBe('₹36,740.63');
    expect(uiAccruedInterest).toBe('₹29,392.50');
    expect(uiAccruedPenalty).toBe('₹7,348.13');
    expect(uiTotalForRenewal).toBe('₹22,500.00');
    expect(uiTotalToRegularize).toBe('₹59,240.63');
    expect(uiTotalForClose).toBe('₹7,86,740.63');
    expect(uiLastPayment).toBe('29-Jun-26');
    expect(uiCurrentDueDate).toBe('28-May-26');
    expect(uiDueDays).toBe(39);
  });
});
