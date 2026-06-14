import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';

interface PartnerPerfRow {
  id: string;
  name: string;
  phone: string | null;
  netCapital: number;
  sharePercentage: number;
  realisedProfitShare: number;
  accruedProfitShare: number;
}

const PartnerPerformance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PartnerPerfRow[]>([]);
  const [totals, setTotals] = useState({
    netCapital: 0,
    realisedInterest: 0,
    accruedInterest: 0
  });
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const partners = await supabaseFinance.getPartners();
      const capEntries = await supabaseFinance.getCapitalEntries();
      const loans = await supabaseFinance.getLoans();
      const txs = await supabaseFinance.getTransactions();
      const ledgerSettings = await financeLedgerSettingsService.getAllLedgerSettings();

      // 1. Calculate net capital contributions per partner
      const partnerCapitals: Record<string, number> = {};
      let totalNetCapital = 0;

      capEntries.forEach(entry => {
        if (!partnerCapitals[entry.partner_id]) {
          partnerCapitals[entry.partner_id] = 0;
        }
        const credit = Number(entry.credit) || 0;
        const debit = Number(entry.debit) || 0;

        partnerCapitals[entry.partner_id] += credit;
        totalNetCapital += credit;

        partnerCapitals[entry.partner_id] -= debit;
        totalNetCapital -= debit;
      });

      // 2. Calculate Total Accrued Interest (Revenue)
      let accruedInterest = 0;
      loans.forEach(loan => {
        const P = Number(loan.amount);
        const cat = loan.loan_category?.trim().toUpperCase() || 'CD';
        const setting = ledgerSettings[cat] || ledgerSettings['CD'];
        const I = setting ? financeCalculationService.calculateInterestFromSetting(P, Number(loan.duration_months) * 30, setting, Number(loan.duration_months)) : (P * (Number(loan.interest_rate) / 100) * Number(loan.duration_months));
        accruedInterest += I;
      });

      // 3. Calculate Total Realised Interest (Cash basis interest collected)
      let realisedInterest = 0;
      txs.forEach(tx => {
        if (tx.type === 'Collection') {
          const loan = loans.find(l => l.id === tx.loan_id);
          if (loan) {
            const P = Number(loan.amount);
            const cat = loan.loan_category?.trim().toUpperCase() || 'CD';
            const setting = ledgerSettings[cat] || ledgerSettings['CD'];
            const I = setting ? financeCalculationService.calculateInterestFromSetting(P, Number(loan.duration_months) * 30, setting, Number(loan.duration_months)) : (P * (Number(loan.interest_rate) / 100) * Number(loan.duration_months));
            const totalRepayable = P + I;
            if (totalRepayable > 0) {
              const interestRatio = I / totalRepayable;
              realisedInterest += Number(tx.amount) * interestRatio;
            }
          }
        }
      });

      // 4. Calculate shares
      const perfRows: PartnerPerfRow[] = partners.map(partner => {
        const capital = partnerCapitals[partner.id] || 0;
        // Share of capital
        const sharePercentage = totalNetCapital > 0 ? (capital / totalNetCapital) * 100 : 0;
        
        // Share of profits based on capital percentage
        const realisedProfitShare = realisedInterest * (sharePercentage / 100);
        const accruedProfitShare = accruedInterest * (sharePercentage / 100);

        return {
          id: partner.id,
          name: partner.name,
          phone: partner.phone,
          netCapital: capital,
          sharePercentage: parseFloat(sharePercentage.toFixed(2)),
          realisedProfitShare: parseFloat(realisedProfitShare.toFixed(2)),
          accruedProfitShare: parseFloat(accruedProfitShare.toFixed(2))
        };
      });

      // Sort partners by capital share descending
      perfRows.sort((a, b) => b.netCapital - a.netCapital);

      setRows(perfRows);
      setTotals({
        netCapital: totalNetCapital,
        realisedInterest: parseFloat(realisedInterest.toFixed(2)),
        accruedInterest: parseFloat(accruedInterest.toFixed(2))
      });

    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze partner performance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">Partner Performance Sheet</h1>
          <p className="finance-small-label uppercase">Review capital share holding percentages and estimated interest profit distribution</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print Statement
        </Button>
      </div>

      {loading ? (
        <div className={`flex justify-center py-12 ${showPrintPreview ? 'print:hidden' : ''}`}>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : (
        <div className={`space-y-6 ${showPrintPreview ? 'print:hidden' : ''}`}>
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 block finance-header-time uppercase">Total Capital Pools</span>
              <span className="text-gray-900 finance-brand">₹{totals.netCapital.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-green-50 rounded border border-green-100">
              <span className="text-green-700 block finance-header-time uppercase">Total Cash Interest Earned (Realised)</span>
              <span className="text-green-800 finance-brand">₹{totals.realisedInterest.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-blue-50 rounded border border-blue-100">
              <span className="text-blue-700 block finance-header-time uppercase">Total Book Interest Earned (Accrued)</span>
              <span className="text-blue-800 finance-brand">₹{totals.accruedInterest.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <Card title="Shareholder Capital Ledger" subtitle="Profit allocations based on net contributions ratios" className="shadow-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="finance-small-label uppercase">Partner Name</th>
                    <th className="text-right finance-small-label uppercase">Net Contribution</th>
                    <th className="text-center finance-small-label uppercase">Share holding</th>
                    <th className="text-right finance-small-label uppercase">Realised Profit Share (Cash)</th>
                    <th className="px-3 py-3 text-right text-blue-700 finance-input uppercase">Accrued Profit Share (Accrual)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-3 text-gray-900 finance-input">
                        {row.name}
                        {row.phone && <div className="text-gray-400 finance-small-label">{row.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-900 finance-input">
                        ₹{row.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 finance-input">
                        {row.sharePercentage}%
                      </td>
                      <td className="px-3 py-3 text-right text-green-600 finance-input">
                        ₹{row.realisedProfitShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-blue-600 finance-input">
                        ₹{row.accruedProfitShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-50 finance-input">
                    <td className="px-3 py-3 text-gray-800 finance-input uppercase">Total:</td>
                    <td className="px-3 py-3 text-right">₹{totals.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-center">100.00%</td>
                    <td className="px-3 py-3 text-right text-green-700">₹{totals.realisedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right text-blue-700">₹{totals.accruedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Partner Performance Sheet"
        documentTitle="PARTNER PERFORMANCE REPORT"
      >
        <div className="space-y-6 mt-6">
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded border">
              <span className="text-gray-500 block finance-header-time uppercase">Total Capital Pools</span>
              <span className="text-gray-900 finance-brand">₹{totals.netCapital.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-green-50 rounded border border-green-100">
              <span className="text-green-700 block finance-header-time uppercase">Total Cash Interest Earned (Realised)</span>
              <span className="text-green-800 finance-brand">₹{totals.realisedInterest.toLocaleString('en-IN')}</span>
            </div>
            <div className="p-3 bg-blue-50 rounded border border-blue-100">
              <span className="text-blue-700 block finance-header-time uppercase">Total Book Interest Earned (Accrued)</span>
              <span className="text-blue-800 finance-brand">₹{totals.accruedInterest.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <Card title="Shareholder Capital Ledger" subtitle="Profit allocations based on net contributions ratios" className="shadow-none border-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="finance-small-label uppercase">Partner Name</th>
                    <th className="text-right finance-small-label uppercase">Net Contribution</th>
                    <th className="text-center finance-small-label uppercase">Share holding</th>
                    <th className="text-right finance-small-label uppercase">Realised Profit Share (Cash)</th>
                    <th className="px-3 py-3 text-right text-blue-700 finance-input uppercase">Accrued Profit Share (Accrual)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 text-gray-900 finance-input">
                        {row.name}
                        {row.phone && <div className="text-gray-400 finance-small-label">{row.phone}</div>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-900 finance-input">
                        ₹{row.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 finance-input">
                        {row.sharePercentage}%
                      </td>
                      <td className="px-3 py-3 text-right text-green-600 finance-input">
                        ₹{row.realisedProfitShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-blue-600 finance-input">
                        ₹{row.accruedProfitShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-50 finance-input">
                    <td className="px-3 py-3 text-gray-800 finance-input uppercase">Total:</td>
                    <td className="px-3 py-3 text-right">₹{totals.netCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-center">100.00%</td>
                    <td className="px-3 py-3 text-right text-green-700">₹{totals.realisedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right text-blue-700">₹{totals.accruedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default PartnerPerformance;
