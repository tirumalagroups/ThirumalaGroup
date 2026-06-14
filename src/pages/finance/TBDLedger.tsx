import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';

const TBDLedger: React.FC = () => {
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    let filtered = ledgerRows.filter(row => 
      (row.loanId.toLowerCase().includes(q) ||
      row.customerName.toLowerCase().includes(q) ||
      (row.phone && row.phone.includes(q)))
    );
    if (startDate) {
      filtered = filtered.filter(row => row.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(row => row.date <= endDate);
    }
    setFilteredRows(filtered);
  }, [searchQuery, ledgerRows, startDate, endDate]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const [loans, txs, settings] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions(),
        financeLedgerSettingsService.getAllLedgerSettings()
      ]);

      // Filter for Term Business Deposit prefix "TBD" or "T-" or category "TBD"
      const tbdLoans = loans.filter(l => 
        l.loan_category === 'TBD' || 
        l.loan_id.toUpperCase().startsWith('TBD') || 
        l.loan_id.toUpperCase().startsWith('T-')
      );

      const rows = tbdLoans.map(loan => {
        const loanWithTxs = { ...loan, transactions: txs.filter(t => t.loan_id === loan.id) };
        const calc = financeCalculationService.getLoanCalculations(loanWithTxs, settings['TBD'] || null);

        return {
          id: loan.id,
          loanId: loan.loan_id,
          customerName: loan.customer?.name || 'N/A',
          phone: loan.customer?.phone || '',
          date: loan.date,
          principal: calc.principal,
          interestRate: Number(loan.interest_rate),
          duration: Number(loan.duration_months),
          interestAmount: calc.interestAmount,
          totalRepayable: calc.totalRepayable,
          totalCollected: calc.totalCredit,
          outstanding: calc.currentBalance,
          status: loan.status
        };
      });

      setLedgerRows(rows);
      setFilteredRows(rows);
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile TBD Ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">TBD Ledger</h1>
          <p className="finance-small-label uppercase">Review accounts starting with the 'TBD' or 'T-' identifier prefix</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print Ledger
        </Button>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl bg-gray-50 p-4 rounded-xl border ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <Input
            label="Filter TBD Accounts"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by ID, Name, Phone..."
          />
        </div>
        <div>
          <Input
            label="From Date"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <div>
          <Input
            label="To Date"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
        </div>
      </div>

      <div className={showPrintPreview ? 'print:hidden' : ''}>
        <Card title="TBD Ledger Index" subtitle="Term Business Deposit receivables summary" className="shadow-md">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No TBD ledger entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
              <thead>
                <tr className="bg-gray-100">
                  <th className="finance-small-label uppercase">Loan ID</th>
                  <th className="finance-small-label uppercase">Customer</th>
                  <th className="finance-small-label uppercase">Disbursed</th>
                  <th className="text-right finance-small-label uppercase">Principal</th>
                  <th className="text-right finance-small-label uppercase">Interest</th>
                  <th className="text-right finance-small-label uppercase">Total Repayable</th>
                  <th className="text-right finance-small-label uppercase">Collected (Cr)</th>
                  <th className="text-right finance-small-label uppercase">Receivable (Dr)</th>
                  <th className="text-center finance-small-label uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-900 font-mono finance-input">{row.loanId}</td>
                    <td className="px-3 py-3">
                      <div className="text-gray-900 finance-input">{row.customerName}</div>
                      {row.phone && <div className="text-gray-400 mt-0.5 finance-small-label">{row.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-right finance-input">
                      ₹{row.principal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 finance-input">
                      ₹{row.interestAmount.toLocaleString('en-IN')} <span className="text-[9px]">({row.interestRate}%)</span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-900 finance-input">
                      ₹{row.totalRepayable.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600 finance-input">
                      ₹{row.totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-orange-700 finance-input">
                      ₹{row.outstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${ row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="text-gray-900 md:text-sm finance-header-time">
                  <td colSpan={3} className="px-3 py-3 text-right finance-input uppercase">Total:</td>
                  <td className="px-3 py-3 text-right">₹{filteredRows.reduce((sum, r) => sum + r.principal, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-gray-500">₹{filteredRows.reduce((sum, r) => sum + r.interestAmount, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right">₹{filteredRows.reduce((sum, r) => sum + r.totalRepayable, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-green-700">₹{filteredRows.reduce((sum, r) => sum + r.totalCollected, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-orange-700">₹{filteredRows.reduce((sum, r) => sum + r.outstanding, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </Card>
      </div>

      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="TBD Ledger"
        documentTitle="TBD LEDGER REPORT"
      >
        {filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
              <thead>
                <tr className="bg-gray-100">
                  <th className="finance-small-label uppercase">Loan ID</th>
                  <th className="finance-small-label uppercase">Customer</th>
                  <th className="finance-small-label uppercase">Disbursed</th>
                  <th className="text-right finance-small-label uppercase">Principal</th>
                  <th className="text-right finance-small-label uppercase">Interest</th>
                  <th className="text-right finance-small-label uppercase">Total Repayable</th>
                  <th className="text-right finance-small-label uppercase">Collected (Cr)</th>
                  <th className="text-right finance-small-label uppercase">Receivable (Dr)</th>
                  <th className="text-center finance-small-label uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-900 font-mono finance-input">{row.loanId}</td>
                    <td className="px-3 py-3">
                      <div className="text-gray-900 finance-input">{row.customerName}</div>
                      {row.phone && <div className="text-gray-400 mt-0.5 finance-small-label">{row.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-right finance-input">
                      ₹{row.principal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 finance-input">
                      ₹{row.interestAmount.toLocaleString('en-IN')} <span className="text-[9px]">({row.interestRate}%)</span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-900 finance-input">
                      ₹{row.totalRepayable.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600 finance-input">
                      ₹{row.totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-orange-700 finance-input">
                      ₹{row.outstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${ row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="text-gray-900 md:text-sm finance-header-time">
                  <td colSpan={3} className="px-3 py-3 text-right finance-input uppercase">Total:</td>
                  <td className="px-3 py-3 text-right">₹{filteredRows.reduce((sum, r) => sum + r.principal, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-gray-500">₹{filteredRows.reduce((sum, r) => sum + r.interestAmount, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right">₹{filteredRows.reduce((sum, r) => sum + r.totalRepayable, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-green-700">₹{filteredRows.reduce((sum, r) => sum + r.totalCollected, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-orange-700">₹{filteredRows.reduce((sum, r) => sum + r.outstanding, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default TBDLedger;
