import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState } from 'react';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface DaybookItem {
  id: string;
  source: 'Transaction' | 'Capital' | 'Cashbook';
  particulars: string;
  type: string; // 'Collection', 'Disbursement', 'Capital Credit', etc.
  cashIn: number;
  cashOut: number;
  remarks: string | null;
}

const Daybook: React.FC = () => {
  const [fromDate, setFromDate] = useState(() => getLocalBusinessDateISO());
  const [toDate, setToDate] = useState(() => getLocalBusinessDateISO());
  const [loading, setLoading] = useState(true);
  
  const [openingBalance, setOpeningBalance] = useState(0);
  const [daybookItems, setDaybookItems] = useState<DaybookItem[]>([]);
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchDaybookData();
  }, [fromDate, toDate]);

  const fetchDaybookData = async () => {
    setLoading(true);
    try {
      // Fetch all unified entries
      const allUnified = await supabaseFinance.getUnifiedLedgerEntries();

      // 1. Calculate Opening Balance (Net flow before fromDate)
      let opBal = 0;
      allUnified.forEach(entry => {
        if (entry.date < fromDate) {
          opBal += Number(entry.credit) || 0;
          opBal -= Number(entry.debit) || 0;
        }
      });

      setOpeningBalance(opBal);

      // 2. Fetch items for date range
      const items: DaybookItem[] = [];
      let inSum = 0;
      let outSum = 0;

      const rangeEntries = allUnified.filter(e => e.date >= fromDate && e.date <= toDate);
      rangeEntries.forEach(entry => {
        const cashIn = Number(entry.credit) || 0;
        const cashOut = Number(entry.debit) || 0;

        items.push({
          id: entry.id,
          source: (entry.category === 'CAPITAL') ? 'Capital' : (['CD', 'HP', 'STBD', 'TBD'].includes(entry.category)) ? 'Transaction' : 'Cashbook',
          particulars: entry.particulars || `${cashIn > 0 ? 'Receipt' : 'Payment'} - ${entry.head_of_account} (${entry.account_number})`,
          type: entry.head_of_account,
          cashIn,
          cashOut,
          remarks: entry.particulars
        });

        inSum += cashIn;
        outSum += cashOut;
      });

      setDaybookItems(items);
      setTotalCashIn(inSum);
      setTotalCashOut(outSum);
      setClosingBalance(opBal + inSum - outSum);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Daybook ledger');
    } finally {
      setLoading(false);
    }
  };

  const formatPeriodString = (fromStr: string, toStr: string) => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return '';
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      return `${day} ${months[monthIndex] || ''} ${year}`;
    };
    
    return `${formatDate(fromStr)} — ${formatDate(toStr)}`;
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-[100%] mx-auto px-4 pt-3 pb-4 print:p-0 select-none">
      
      {/* ── ROW 1: Compact Page Header ───────────────────────────────────────── */}
      <div className={`flex justify-between items-center print:hidden pb-1 border-b border-slate-100 ${showPrintPreview ? 'hidden' : ''}`}>
        <div>
          <h1 className="text-[15px] font-black uppercase text-slate-900 tracking-wide leading-none">Finance Daybook</h1>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Review cash inflow and outflow transactions for any specific business day</p>
        </div>
        <div>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1329] text-white rounded-lg hover:bg-slate-800 text-[12px] font-bold uppercase shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print Daybook
          </button>
        </div>
      </div>

      {/* ── ROW 2: Filters + Selected Period Summary (single horizontal bar) ── */}
      <div className={`bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2.5 print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="flex flex-col min-w-[130px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px] cursor-pointer"
            />
          </div>
          <div className="flex flex-col min-w-[130px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px] cursor-pointer"
            />
          </div>
          <div className="flex flex-col ml-auto text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Selected Period</span>
            <span className="text-[13px] font-extrabold text-slate-800 uppercase bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg h-[34px] flex items-center justify-center font-mono">
              {formatPeriodString(fromDate, toDate)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Daybook Statement Table Container ─────────────────────────── */}
      <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden print:hidden ${showPrintPreview ? 'hidden' : ''}`}>
        {/* Compact section header */}
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-[12px] font-black uppercase text-slate-700 tracking-wide block">
              DAYBOOK STATEMENT
            </span>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5 block">
              Receipts & Payments cashbook breakdown
            </span>
          </div>
          <span className="text-[12px] text-slate-500 font-mono font-extrabold uppercase">
            PERIOD: {fromDate.split('-').reverse().join('/')} — {toDate.split('-').reverse().join('/')}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 bg-white">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Balance Headers (Summary Metrics) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
              {/* Opening Balance */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex flex-col justify-center min-h-[48px]">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">Opening Balance</span>
                <span className="text-slate-900 text-[17px] font-black font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                  ₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Total Receipts */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex flex-col justify-center min-h-[48px]">
                <span className="text-[9px] font-black text-emerald-650 uppercase tracking-wider leading-none">Total Receipts (+)</span>
                <span className="text-emerald-700 text-[17px] font-black font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                  ₹{totalCashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Total Payments */}
              <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 flex flex-col justify-center min-h-[48px]">
                <span className="text-[9px] font-black text-rose-655 uppercase tracking-wider leading-none">Total Payments (-)</span>
                <span className="text-rose-700 text-[17px] font-black font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                  ₹{totalCashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Closing Balance */}
              <div className="bg-indigo-50 border border-indigo-150 rounded-lg px-3 py-1.5 flex flex-col justify-center min-h-[48px]">
                <span className="text-[9px] font-black text-indigo-650 uppercase tracking-wider leading-none">Closing Balance</span>
                <span className="text-indigo-850 text-[17px] font-black font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                  ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto overflow-y-auto bg-white" style={{ maxHeight: 'calc(100vh - 215px)' }}>
              <table className="min-w-full divide-y divide-slate-150 finance-caption">
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 border-r border-slate-200 text-slate-805 text-left bg-slate-50 finance-small-label">Particulars / Account</th>
                    <th className="px-3 py-2 border-r border-slate-200 text-slate-855 text-left bg-slate-50 finance-small-label">Voucher Type</th>
                    <th className="px-3 py-2 border-r border-slate-200 text-slate-805 text-left bg-slate-50 finance-small-label">Remarks</th>
                    <th className="px-3 py-2 border-r border-slate-200 text-slate-850 text-right bg-slate-50 finance-small-label">Receipts (Cr)</th>
                    <th className="px-3 py-2 text-slate-850 text-right bg-slate-50 finance-small-label">Payments (Dr)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono text-sm">
                  {daybookItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-400 font-sans text-sm font-semibold">
                        No transactions recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    daybookItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/40">
                        <td className="px-3 py-2 border-r border-slate-100 text-slate-900 font-sans font-bold text-sm leading-relaxed">{item.particulars}</td>
                        <td className="px-3 py-2 border-r border-slate-100 text-slate-655 font-sans font-semibold text-sm leading-relaxed">{item.type}</td>
                        <td className="px-3 py-2 border-r border-slate-100 text-slate-705 font-sans text-sm leading-relaxed whitespace-normal break-words" title={item.remarks || ''}>
                          {item.remarks || '—'}
                        </td>
                        <td className="px-3 py-2 border-r border-slate-100 text-right text-emerald-705 font-sans text-sm font-bold whitespace-nowrap">
                          {item.cashIn > 0 ? `₹${item.cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-red-655 font-sans text-sm font-bold whitespace-nowrap">
                          {item.cashOut > 0 ? `₹${item.cashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                  {/* Total row */}
                  <tr className="bg-slate-50 font-sans font-extrabold border-t-2 border-slate-200 text-sm">
                    <td colSpan={3} className="px-3 py-2 border-r border-slate-200 text-right text-slate-805 uppercase font-black">Total Cash Flow:</td>
                    <td className="px-3 py-2 border-r border-slate-200 text-right text-emerald-750 font-bold text-sm whitespace-nowrap">
                      ₹{totalCashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-red-655 font-bold text-sm whitespace-nowrap">
                      ₹{totalCashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Finance Daybook"
        documentTitle={`DAYBOOK: ${new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
      >
        {!loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded border">
                <span className="text-gray-500 block finance-header-time uppercase">Opening Balance</span>
                <span className="text-gray-900 finance-brand">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-green-50 rounded border border-green-100">
                <span className="text-green-700 block finance-header-time uppercase">Total Receipts (+)</span>
                <span className="text-green-800 finance-brand">₹{totalCashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-red-50 rounded border border-red-100">
                <span className="text-red-700 block finance-header-time uppercase">Total Payments (-)</span>
                <span className="text-red-800 finance-brand">₹{totalCashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-emerald-100 rounded border border-emerald-200">
                <span className="text-emerald-800 block finance-header-time uppercase">Closing Balance</span>
                <span className="text-emerald-900 finance-h1">₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 md:text-sm finance-caption">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="finance-small-label uppercase">Particulars / Account</th>
                    <th className="finance-small-label uppercase">Voucher Type</th>
                    <th className="finance-small-label uppercase">Remarks</th>
                    <th className="text-right finance-small-label uppercase">Receipts (Cr)</th>
                    <th className="text-right finance-small-label uppercase">Payments (Dr)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {daybookItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-400 finance-input">
                        No transactions recorded on this date.
                      </td>
                    </tr>
                  ) : (
                    daybookItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-3 text-gray-900 finance-input">{item.particulars}</td>
                        <td className="px-3 py-3 text-gray-600 finance-input">{item.type}</td>
                        <td className="px-3 py-3 text-gray-500">{item.remarks || '-'}</td>
                        <td className="px-3 py-3 text-right text-green-600 finance-input">
                          {item.cashIn > 0 ? `₹${item.cashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-right text-red-600 finance-input">
                          {item.cashOut > 0 ? `₹${item.cashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                  {/* Total row */}
                  <tr className="bg-gray-50 finance-input">
                    <td colSpan={3} className="px-3 py-3 text-right text-gray-800 finance-input uppercase">Total Cash Flow:</td>
                    <td className="px-3 py-3 text-right text-green-700 finance-card-title">₹{totalCashIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right text-red-700 finance-card-title">₹{totalCashOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-between items-center mt-20 pt-8 border-t finance-caption">
              <div>
                <p className="text-gray-700 finance-input">Cashier Signature</p>
                <p className="text-gray-400 mt-8 finance-small-label">Authorized Signatory</p>
              </div>
              <div className="text-right">
                <p className="text-gray-700 finance-input">Verified By Manager</p>
                <p className="text-gray-400 mt-8 finance-small-label">Partner Audit Sign</p>
              </div>
            </div>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default Daybook;
