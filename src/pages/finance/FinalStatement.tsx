import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface AccountBalanceItem {
  accountName: string;
  credit: number;
  debit: number;
  balance: number;
  result: 'CR' | 'DR' | 'NIL';
}

const FinalStatement: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [partnerCount, setPartnerCount] = useState(1);
  const [openingCash, setOpeningCash] = useState(0);
  const [creditTotal, setCreditTotal] = useState(0);
  const [debitTotal, setDebitTotal] = useState(0);
  const [capital, setCapital] = useState(0);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceItem[]>([]);

  useEffect(() => {
    fetchStatementData();
  }, [startDate, endDate]);

  const fetchStatementData = async () => {
    setLoading(true);
    try {
      const [cashbookEntries, capitalEntries, partners] = await Promise.all([
        supabaseFinance.getCashbookEntries(),
        supabaseFinance.getCapitalEntries(),
        supabaseFinance.getPartners()
      ]);

      setPartnerCount(partners.length || 1); // Avoid division by zero

      // 1. Calculate Opening Cash (All entries before startDate)
      let prevCredit = 0;
      let prevDebit = 0;
      
      const previousEntries = cashbookEntries.filter(c => c.entry_date < startDate);
      previousEntries.forEach(entry => {
        prevCredit += Number(entry.credit) || 0;
        prevDebit += Number(entry.debit) || 0;
      });
      setOpeningCash(prevCredit - prevDebit);

      // 2. Calculate Current Date Range Values
      const currentEntries = cashbookEntries.filter(c => c.entry_date >= startDate && c.entry_date <= endDate);
      
      let currCredit = 0;
      let currDebit = 0;
      const accountMap = new Map<string, { credit: number, debit: number }>();

      currentEntries.forEach(entry => {
        const credit = Number(entry.credit) || 0;
        const debit = Number(entry.debit) || 0;
        currCredit += credit;
        currDebit += debit;

        const head = entry.head_of_account || 'Miscellaneous';
        const existing = accountMap.get(head) || { credit: 0, debit: 0 };
        accountMap.set(head, { 
          credit: existing.credit + credit, 
          debit: existing.debit + debit 
        });
      });

      setCreditTotal(currCredit);
      setDebitTotal(currDebit);

      // Format Account Balances
      const balances: AccountBalanceItem[] = Array.from(accountMap.entries()).map(([name, data]) => {
        const balance = data.credit - data.debit;
        return {
          accountName: name,
          credit: data.credit,
          debit: data.debit,
          balance: Math.abs(balance),
          result: balance > 0 ? 'CR' : balance < 0 ? 'DR' : 'NIL'
        };
      });

      // Sort alphabetically by account name
      balances.sort((a, b) => a.accountName.localeCompare(b.accountName));
      setAccountBalances(balances);

      // 3. Calculate Capital within date range
      const currentCapitalEntries = capitalEntries.filter(c => c.entry_date >= startDate && c.entry_date <= endDate);
      let capSum = 0;
      currentCapitalEntries.forEach(entry => {
        const credit = Number(entry.credit) || 0;
        const debit = Number(entry.debit) || 0;
        capSum += (credit - debit);
      });
      setCapital(capSum);

    } catch (err) {
      console.error(err);
      toast.error('Failed to compile Final Statement');
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = creditTotal - debitTotal;
  const closingCash = openingCash + grandTotal;
  const shareValue = grandTotal / partnerCount;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">Final Statement</h1>
          <p className="finance-small-label uppercase">
            Net worth snapshot with share value for each partner
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={fetchStatementData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter & Share Row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden">
        {/* Date Filters */}
        <div className="flex-1 grid grid-cols-3 divide-x divide-slate-100 border-b md:border-b-0 md:border-r border-slate-100">
          <div className="px-6 py-4 flex flex-col justify-center">
            <label className="text-slate-400 mb-1 finance-small-label uppercase">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
            />
          </div>
          <div className="px-6 py-4 flex flex-col justify-center">
            <label className="text-slate-400 mb-1 finance-small-label uppercase">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
            />
          </div>
          <div className="px-6 py-4 flex flex-col justify-center bg-slate-50">
            <label className="text-slate-400 mb-1 finance-small-label uppercase">Partners</label>
            <span className="text-slate-900 finance-h1">{partnerCount}</span>
          </div>
        </div>

        {/* Share Value Highlight */}
        <div className="w-full md:w-64 px-6 py-4 flex flex-col justify-center bg-[#0b1329]">
          <span className="text-blue-300 mb-1 block finance-small-label uppercase">Share Value</span>
          <span className={`${shareValue >= 0 ? 'text-emerald-400' : 'text-red-400'} finance-money`}>
            ₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Summary Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Credit Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Credit Total</span>
          <span className="text-emerald-600 mt-1 finance-money">₹{creditTotal.toLocaleString('en-IN')}</span>
        </div>
        
        {/* Debit Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Debit Total</span>
          <span className="text-red-600 mt-1 finance-money">₹{debitTotal.toLocaleString('en-IN')}</span>
        </div>

        {/* Opening Cash */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Opening Cash</span>
          <span className="text-slate-900 mt-1 finance-money">₹{openingCash.toLocaleString('en-IN')}</span>
        </div>

        {/* Closing Cash */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Closing Cash</span>
          <span className="text-slate-900 mt-1 finance-money">₹{closingCash.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Summary Cards Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Capital */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Capital</span>
          <span className={`mt-1 ${capital >= 0 ? 'text-emerald-600' : 'text-red-600'} finance-money`}>
            ₹{Math.abs(capital).toLocaleString('en-IN')} {capital < 0 ? '(DR)' : ''}
          </span>
        </div>
        
        {/* Grand Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Grand Total</span>
          <span className={`mt-1 ${grandTotal >= 0 ? 'text-[#0b1329]' : 'text-red-600'} finance-money`}>
            ₹{grandTotal.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Accounts Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-400 block finance-small-label uppercase">Accounts</span>
          <span className="text-slate-900 mt-1 finance-money">{accountBalances.length}</span>
        </div>
      </div>

      {/* Account Balances Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Table Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 relative">
          <div>
            <h2 className="text-slate-900 finance-brand">Account Balances</h2>
            <p className="text-slate-500 mt-1 finance-small-label uppercase">{accountBalances.length} Accounts</p>
          </div>
          <div className="absolute top-4 right-4 bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 finance-small-label uppercase">
            LIVE
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex-1 flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : accountBalances.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center border border-dashed border-slate-200 rounded-xl p-12 w-full max-w-md bg-slate-50">
              <p className="text-slate-900 mb-2 finance-sidebar-link uppercase">No Accounts</p>
              <p className="text-slate-500 finance-header-time uppercase">No cashbook entries found for this date range.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="px-6 py-4 text-slate-400 finance-small-label uppercase">S.No</th>
                  <th className="px-6 py-4 text-slate-400 w-1/3 finance-small-label uppercase">Account Name</th>
                  <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Credit</th>
                  <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Debit</th>
                  <th className="px-6 py-4 text-slate-400 text-right finance-small-label uppercase">Balance</th>
                  <th className="px-6 py-4 text-slate-400 text-center finance-small-label uppercase">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountBalances.map((acc, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500 finance-sidebar-link">{idx + 1}</td>
                    <td className="px-6 py-4 text-slate-900 finance-sidebar-link uppercase">{acc.accountName}</td>
                    <td className="px-6 py-4 text-emerald-600 text-right finance-sidebar-link">
                      {acc.credit > 0 ? `₹${acc.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-red-600 text-right finance-sidebar-link">
                      {acc.debit > 0 ? `₹${acc.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-800 text-right finance-sidebar-link">
                      ₹{acc.balance.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded border ${ acc.result === 'CR' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : acc.result === 'DR' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200' } finance-small-label uppercase`}>
                        {acc.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Final Statement"
        documentTitle={`FINAL STATEMENT: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Summary Metrics */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Opening Cash</p>
              <p className="text-slate-900 finance-sidebar-link">₹{openingCash.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Closing Cash</p>
              <p className="text-slate-900 finance-sidebar-link">₹{closingCash.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Grand Total</p>
              <p className="text-slate-900 finance-sidebar-link">₹{grandTotal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Share Value ({partnerCount})</p>
              <p className="text-[#0b1329] finance-sidebar-link">₹{shareValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 border-b border-slate-300 pb-6 text-center">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Credit Total</p>
              <p className="text-emerald-700 finance-header-time">₹{creditTotal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Debit Total</p>
              <p className="text-red-700 finance-header-time">₹{debitTotal.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Capital (Net)</p>
              <p className={`${capital >= 0 ? 'text-emerald-700' : 'text-red-700'} finance-header-time`}>
                ₹{Math.abs(capital).toLocaleString('en-IN')} {capital < 0 ? '(DR)' : '(CR)'}
              </p>
            </div>
          </div>

          {/* Account Balances Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-slate-900 finance-small-label uppercase">Account Balances</h4>
              <span className="text-slate-500 finance-small-label">{accountBalances.length} ACCOUNTS</span>
            </div>
            <table className="w-full text-left finance-small-label">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">S.No</th>
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Account Name</th>
                  <th className="px-2 py-2 text-slate-800 text-right border-r border-slate-300 finance-input">Credit</th>
                  <th className="px-2 py-2 text-slate-800 text-right border-r border-slate-300 finance-input">Debit</th>
                  <th className="px-2 py-2 text-slate-900 text-right border-r border-slate-300 finance-input">Balance</th>
                  <th className="px-2 py-2 text-slate-800 text-center finance-input">Result</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {accountBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans finance-input uppercase">No records found</td>
                  </tr>
                ) : (
                  accountBalances.map((acc, idx) => (
                    <tr key={idx} className="border-b border-slate-200 last:border-0">
                      <td className="px-2 py-1 border-r border-slate-200 text-center">{idx + 1}</td>
                      <td className="px-2 py-1 text-slate-900 border-r border-slate-200 finance-input uppercase">{acc.accountName}</td>
                      <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{acc.credit > 0 ? acc.credit.toLocaleString('en-IN') : '-'}</td>
                      <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{acc.debit > 0 ? acc.debit.toLocaleString('en-IN') : '-'}</td>
                      <td className="px-2 py-1 text-right text-slate-900 border-r border-slate-200 finance-input">₹{acc.balance.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1 text-center finance-input">{acc.result}</td>
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

export default FinalStatement;
