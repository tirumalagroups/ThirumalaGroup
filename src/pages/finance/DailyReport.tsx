import React, { useEffect, useState, useMemo } from 'react';

import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';
import { getLocalBusinessDateISO } from '../../utils/dateUtils';

interface DailyTransaction {
  id: string;
  source: 'Loan' | 'Capital' | 'Cashbook';
  time: string;
  account: string;
  particulars: string;
  credit: number;
  debit: number;
  user: string;
  runningBalance: number; // Added during computation
}

const DailyReportFinance: React.FC = () => {
  const navigate = useNavigate();
  // Default to today
  const [selectedDate, setSelectedDate] = useState(() => getLocalBusinessDateISO());
  const [loading, setLoading] = useState(true);
  
  const [openingBalance, setOpeningBalance] = useState(0);
  const [transactions, setTransactions] = useState<DailyTransaction[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchDailyData();
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalBusinessDateISO(d));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(getLocalBusinessDateISO(d));
  };

  const fetchDailyData = async () => {
    setLoading(true);
    try {
      const allUnified = await supabaseFinance.getUnifiedLedgerEntries();

      let opBal = 0;
      let dailyCred = 0;
      let dailyDeb = 0;
      const dailyTx: Omit<DailyTransaction, 'runningBalance'>[] = [];

      allUnified.forEach(entry => {
        const cred = Number(entry.credit) || 0;
        const deb = Number(entry.debit) || 0;

        if (entry.date < selectedDate) {
          opBal += cred;
          opBal -= deb;
        } else if (entry.date === selectedDate) {
          dailyCred += cred;
          dailyDeb += deb;
          
          let source: 'Loan' | 'Capital' | 'Cashbook' = 'Cashbook';
          if (entry.category === 'CAPITAL') source = 'Capital';
          else if (['CD', 'HP', 'STBD', 'TBD'].includes(entry.category)) source = 'Loan';

          dailyTx.push({
            id: entry.id,
            source,
            time: entry.date,
            account: entry.head_of_account,
            particulars: entry.particulars || `${cred > 0 ? 'Receipt' : 'Payment'} - ${entry.head_of_account} (${entry.account_number})`,
            credit: cred,
            debit: deb,
            user: entry.user,
          });
        }
      });

      // Compute running balance
      let currentBal = opBal;
      const finalTx: DailyTransaction[] = dailyTx.map(tx => {
        currentBal += tx.credit;
        currentBal -= tx.debit;
        return { ...tx, runningBalance: currentBal };
      });

      setOpeningBalance(opBal);
      setTransactions(finalTx);
      setTotalCredit(dailyCred);
      setTotalDebit(dailyDeb);
      setClosingBalance(opBal + dailyCred - dailyDeb);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Daily Report');
    } finally {
      setLoading(false);
    }
  };

  const accountSummary = useMemo(() => {
    const summary: Record<string, { credit: number; debit: number }> = {};
    transactions.forEach(tx => {
      if (!summary[tx.account]) summary[tx.account] = { credit: 0, debit: 0 };
      summary[tx.account].credit += tx.credit;
      summary[tx.account].debit += tx.debit;
    });
    return Object.entries(summary).map(([account, totals]) => ({
      account,
      credit: totals.credit,
      debit: totals.debit,
      net: totals.credit - totals.debit
    }));
  }, [transactions]);

  const displayDate = new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-');

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">Daily Report</h1>
          <p className="finance-small-label uppercase">Chronological transaction log with account-summary sidebar</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={handlePrevDay} variant="secondary" size="sm" icon={ChevronLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200">{''}</Button>
          <Button onClick={handleNextDay} variant="secondary" size="sm" icon={ChevronRight} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200">{''}</Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print
          </Button>
        </div>
      </div>

      {/* Top Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link"
          />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase">Credit Total</span>
          <span className="text-emerald-600 finance-money">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase">Debit Total</span>
          <span className="text-red-600 finance-money">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase">Closing Balance</span>
          <span className="text-slate-900 finance-money">₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Transactions */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-slate-900 finance-sidebar-link uppercase">Transactions &middot; {displayDate}</h3>
                <p className="text-slate-500 mt-0.5 finance-small-label uppercase">{transactions.length} ROWS</p>
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-slate-400 finance-sidebar-link uppercase">No Transactions</p>
                <p className="text-slate-400 mt-1 finance-header-time uppercase">Nothing posted for this date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">S.No</th>
                      <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">Time</th>
                      <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">Account / Head</th>
                      <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">Particulars</th>
                      <th className="px-4 py-3 text-slate-500 text-right finance-small-label uppercase">Credit</th>
                      <th className="px-4 py-3 text-slate-500 text-right finance-small-label uppercase">Debit</th>
                      <th className="px-4 py-3 text-slate-500 text-right finance-small-label uppercase">Balance</th>
                      <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 finance-header-time">{idx + 1}</td>
                        <td className="px-4 py-3 text-slate-700 finance-header-time">
                          {tx.time ? new Date(tx.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-900 finance-header-time">{tx.account}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate finance-header-time" title={tx.particulars}>{tx.particulars}</td>
                        <td className="px-4 py-3 text-emerald-600 text-right finance-header-time">{tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-4 py-3 text-red-600 text-right finance-header-time">{tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-4 py-3 text-slate-800 text-right finance-header-time">₹{tx.runningBalance.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-slate-500 finance-header-time">{tx.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Account Summary */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-slate-900 finance-sidebar-link uppercase">Account Summary</h3>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : accountSummary.length === 0 ? (
              <div className="p-8 text-center border-t border-dashed border-slate-200 mx-4 my-4 rounded-xl">
                <p className="text-slate-400 finance-header-time uppercase">No Accounts</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {accountSummary.map((acc, idx) => (
                  <div key={idx} className="flex flex-col border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <span className="text-slate-900 mb-2 finance-header-time uppercase">{acc.account}</span>
                    <div className="flex justify-between items-center finance-caption">
                      <span className="text-slate-500 finance-input">Credit: <span className="text-emerald-600">₹{acc.credit.toLocaleString('en-IN')}</span></span>
                      <span className="text-slate-500 finance-input">Debit: <span className="text-red-600">₹{acc.debit.toLocaleString('en-IN')}</span></span>
                    </div>
                    <div className="mt-1.5 flex justify-between items-center finance-header-time">
                      <span className="text-slate-500 finance-small-label uppercase">Net</span>
                      <span className={acc.net > 0 ? "text-emerald-600" : acc.net < 0 ? "text-red-600" : "text-slate-500"}>
                        {acc.net > 0 ? "+" : ""}{acc.net === 0 ? "-" : `₹${acc.net.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Finance Daily Report"
        documentTitle={`DAILY REPORT: ${displayDate}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Summary */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Opening Balance</p>
              <p className="text-slate-900 finance-sidebar-link">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Credit Total</p>
              <p className="text-emerald-700 finance-sidebar-link">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Debit Total</p>
              <p className="text-red-700 finance-sidebar-link">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Closing Balance</p>
              <p className="text-slate-900 finance-sidebar-link">₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Account Summary Print */}
          {accountSummary.length > 0 && (
            <div className="mb-8 border border-slate-300 rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                <h4 className="text-slate-800 finance-small-label uppercase">Account Summary</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 font-sans finance-caption">
                {accountSummary.map((acc, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-800 finance-input">{acc.account}</span>
                    <span className="text-slate-900 finance-input">
                      {acc.net > 0 ? "+" : ""}{acc.net === 0 ? "-" : `₹${acc.net.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-slate-900 finance-small-label uppercase">Transactions Log</h4>
              <span className="text-slate-500 finance-small-label">{transactions.length} ROWS</span>
            </div>
            <table className="w-full text-left finance-caption">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Time</th>
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Account / Head</th>
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Particulars</th>
                  <th className="px-2 py-2 text-emerald-800 text-right border-r border-slate-300 finance-input">Credit</th>
                  <th className="px-2 py-2 text-red-800 text-right border-r border-slate-300 finance-input">Debit</th>
                  <th className="px-2 py-2 text-slate-800 text-right finance-input">Balance</th>
                </tr>
              </thead>
              <tbody className="font-mono finance-small-label">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans finance-input uppercase">No transactions posted</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-2 py-1 border-r border-slate-200">{tx.time ? new Date(tx.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td className="px-2 py-1 border-r border-slate-200 finance-input">{tx.account}</td>
                      <td className="px-2 py-1 text-slate-700 truncate max-w-[150px] border-r border-slate-200">{tx.particulars}</td>
                      <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tx.credit > 0 ? tx.credit.toLocaleString('en-IN') : ''}</td>
                      <td className="px-2 py-1 text-right text-red-700 border-r border-slate-200">{tx.debit > 0 ? tx.debit.toLocaleString('en-IN') : ''}</td>
                      <td className="px-2 py-1 text-right text-slate-900 finance-input">₹{tx.runningBalance.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default DailyReportFinance;
