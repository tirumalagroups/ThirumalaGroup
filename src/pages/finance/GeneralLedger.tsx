import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface LedgerEntry {
  id: string;
  date: string;
  time: string;
  accountType: string;
  accountName: string;
  particulars: string;
  credit: number;
  debit: number;
  voucherNo: string;
  user: string;
}

const GeneralLedger: React.FC = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [cashbookAccounts, setCashbookAccounts] = useState<string[]>([]);
  
  const [selectedAccountType, setSelectedAccountType] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const accountTypes = ['Loan Operations', 'Partner Capital', 'Cashbook'];

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const [txs, capitals, cbEntries, cbAccounts] = await Promise.all([
        supabaseFinance.getTransactions(),
        supabaseFinance.getCapitalEntries(),
        supabaseFinance.getCashbookEntries(),
        supabaseFinance.getCashbookAccounts()
      ]);

      const entries: LedgerEntry[] = [];

      // 1. Loans
      txs.forEach(tx => {
        const isCol = tx.type === 'Collection';
        const amt = Number(tx.amount) || 0;
        entries.push({
          id: tx.id,
          date: tx.date,
          time: tx.created_at,
          accountType: 'Loan Operations',
          accountName: isCol ? 'Loan Collections' : 'Loan Disbursements',
          particulars: `${tx.loan?.customer?.name || 'Customer'} (${tx.loan?.loan_id || 'N/A'}) - ${tx.remarks || 'No remarks'}`,
          credit: isCol ? amt : 0,
          debit: !isCol ? amt : 0,
          voucherNo: tx.id.slice(0, 8).toUpperCase(),
          user: (tx as any).staff_name || 'Admin'
        });
      });

      // 2. Capital
      capitals.forEach(cap => {
        const cred = Number(cap.credit) || 0;
        const deb = Number(cap.debit) || 0;
        entries.push({
          id: cap.id,
          date: cap.entry_date,
          time: cap.created_at,
          accountType: 'Partner Capital',
          accountName: cred > 0 ? 'Capital Deposits' : 'Capital Withdrawals',
          particulars: `${cap.partner?.name || cap.partner_name || 'Partner'} - ${cap.particulars || 'No remarks'}`,
          credit: cred,
          debit: deb,
          voucherNo: cap.id.slice(0, 8).toUpperCase(),
          user: cap.created_by || 'Admin'
        });
      });

      // 3. Cashbook
      const cbAccMap = new Map(cbAccounts.map(a => [a.id, a.account_name]));
      setCashbookAccounts(cbAccounts.map(a => a.account_name));

      cbEntries.forEach(cb => {
        entries.push({
          id: cb.id,
          date: cb.entry_date,
          time: cb.created_at,
          accountType: 'Cashbook',
          accountName: cbAccMap.get(cb.head_of_account) || 'General Cashbook',
          particulars: cb.particulars || '-',
          credit: Number(cb.credit) || 0,
          debit: Number(cb.debit) || 0,
          voucherNo: cb.id.slice(0, 8).toUpperCase(),
          user: cb.created_by || 'Admin'
        });
      });

      setAllEntries(entries);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const accountsForSelectedType = useMemo(() => {
    if (!selectedAccountType) return [];
    if (selectedAccountType === 'Loan Operations') return ['Loan Collections', 'Loan Disbursements'];
    if (selectedAccountType === 'Partner Capital') return ['Capital Deposits', 'Capital Withdrawals'];
    if (selectedAccountType === 'Cashbook') return cashbookAccounts;
    return [];
  }, [selectedAccountType, cashbookAccounts]);

  const { displayedTransactions, openingBalance, totalCredits, totalDebits, closingBalance } = useMemo(() => {
    if (!selectedAccount || !startDate || !endDate) {
      return { displayedTransactions: [], openingBalance: 0, totalCredits: 0, totalDebits: 0, closingBalance: 0 };
    }

    let opBal = 0;
    let periodCred = 0;
    let periodDeb = 0;
    const currentTxs: (LedgerEntry & { runningBalance: number })[] = [];

    // Filter to selected account
    const accountEntries = allEntries.filter(e => e.accountName === selectedAccount);

    // Calculate opening balance
    accountEntries.forEach(e => {
      if (e.date < startDate) {
        opBal += e.credit;
        opBal -= e.debit;
      }
    });

    // Get period entries
    const periodEntries = accountEntries.filter(e => e.date >= startDate && e.date <= endDate);
    periodEntries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let runBal = opBal;
    periodEntries.forEach(e => {
      periodCred += e.credit;
      periodDeb += e.debit;
      runBal += e.credit;
      runBal -= e.debit;
      currentTxs.push({ ...e, runningBalance: runBal });
    });

    return {
      displayedTransactions: currentTxs,
      openingBalance: opBal,
      totalCredits: periodCred,
      totalDebits: periodDeb,
      closingBalance: runBal
    };
  }, [allEntries, selectedAccount, startDate, endDate]);

  const handleAccountTypeClick = (type: string) => {
    setSelectedAccountType(type);
    setSelectedAccount(null); // Reset child selection
  };

  const handleAccountClick = (acc: string) => {
    setSelectedAccount(acc);
  };

  const displayDateRange = `${new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-')} TO ${new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-')}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">General Ledger</h1>
          <p className="finance-small-label uppercase">Drill from Account Types &rarr; Accounts &rarr; Transaction Detail</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={fetchLedgerData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link"
          />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link"
          />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase">Credits</span>
          <span className="text-emerald-600 finance-money">₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block finance-small-label uppercase">Debits</span>
          <span className="text-red-600 finance-money">₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Middle Row: Account Types & Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Account Types */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="text-slate-900 finance-sidebar-link uppercase">Account Types</h3>
              <p className="text-slate-500 mt-0.5 finance-small-label uppercase">{accountTypes.length} GROUPS</p>
            </div>
            <span className="bg-[#e0f2fe] text-[#0369a1] px-2 py-0.5 rounded border border-[#bae6fd] finance-small-label uppercase">LIVE</span>
          </div>
          <div className="p-2 flex-1">
            {accountTypes.length === 0 ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-8">
                <span className="text-slate-400 finance-header-time uppercase">No Account Types</span>
              </div>
            ) : (
              <div className="space-y-1">
                {accountTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => handleAccountTypeClick(type)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all border ${ selectedAccountType === type ? 'bg-[#0b1329] text-white border-[#0b1329] shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50' } finance-sidebar-link`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accounts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[300px] md:h-auto">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-slate-900 finance-sidebar-link uppercase">Accounts</h3>
            <p className="text-slate-500 mt-0.5 finance-small-label uppercase">Select an account type</p>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            {!selectedAccountType ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-8 mx-2 mt-2 mb-2">
                <span className="text-slate-400 finance-header-time uppercase">Pick an account type</span>
              </div>
            ) : accountsForSelectedType.length === 0 ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg p-8 mx-2 mt-2 mb-2">
                <span className="text-slate-400 finance-header-time uppercase">No accounts found</span>
              </div>
            ) : (
              <div className="space-y-1">
                {accountsForSelectedType.map(acc => (
                  <button
                    key={acc}
                    onClick={() => handleAccountClick(acc)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all border ${ selectedAccount === acc ? 'bg-[#0b1329] text-white border-[#0b1329] shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50' } finance-sidebar-link`}
                  >
                    {acc}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Row: Transaction Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-slate-900 finance-sidebar-link uppercase">Transaction Details</h3>
            <p className="text-slate-500 mt-0.5 finance-small-label uppercase">
              {selectedAccount ? `${selectedAccount} · ${displayDateRange}` : 'Select an account'}
            </p>
          </div>
          {selectedAccount && (
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 finance-small-label uppercase">
              {displayedTransactions.length} ROWS
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
          </div>
        ) : !selectedAccount ? (
          <div className="py-24 text-center border-t border-dashed border-slate-200 mx-4 my-4 rounded-xl">
            <span className="text-slate-400 finance-sidebar-link uppercase">Pick an account to drill down</span>
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="py-24 text-center border-t border-dashed border-slate-200 mx-4 my-4 rounded-xl">
            <p className="text-slate-400 finance-sidebar-link uppercase">No Transactions Found</p>
            <p className="text-slate-400 mt-1 finance-header-time uppercase">Try adjusting the date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">Date</th>
                  <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">Particulars</th>
                  <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">Voucher / Ref</th>
                  <th className="px-4 py-3 text-slate-500 text-right finance-small-label uppercase">Credit</th>
                  <th className="px-4 py-3 text-slate-500 text-right finance-small-label uppercase">Debit</th>
                  <th className="px-4 py-3 text-slate-500 text-right finance-small-label uppercase">Balance</th>
                  <th className="px-4 py-3 text-slate-500 finance-small-label uppercase">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/50">
                  <td colSpan={5} className="px-4 py-2 text-slate-700 text-right finance-header-time uppercase">Opening Balance</td>
                  <td className="px-4 py-2 text-slate-900 text-right finance-header-time">₹{openingBalance.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap finance-header-time">
                      {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[250px] truncate finance-header-time" title={tx.particulars}>{tx.particulars}</td>
                    <td className="px-4 py-3 font-mono text-slate-400 finance-header-time">{tx.voucherNo}</td>
                    <td className="px-4 py-3 text-emerald-600 text-right finance-header-time">{tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-4 py-3 text-red-600 text-right finance-header-time">{tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-4 py-3 text-slate-800 text-right finance-header-time">₹{tx.runningBalance.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-slate-500 finance-header-time">{tx.user}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={3} className="px-4 py-3 text-slate-700 text-right finance-header-time uppercase">Closing Balance</td>
                  <td className="px-4 py-3 text-emerald-600 text-right finance-header-time">₹{totalCredits.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-red-600 text-right finance-header-time">₹{totalDebits.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-slate-900 text-right finance-sidebar-link">₹{closingBalance.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="General Ledger Report"
        documentTitle={`GENERAL LEDGER: ${selectedAccount ? selectedAccount.toUpperCase() : 'NO ACCOUNT SELECTED'}`}
      >
        <div className="space-y-6 pb-12">
          {/* Print Headers */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-900 pb-4 mb-4">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Date Range</p>
              <p className="text-slate-900 finance-sidebar-link">{displayDateRange}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 finance-small-label uppercase">Account Details</p>
              <p className="text-slate-900 finance-sidebar-link">{selectedAccountType ? selectedAccountType.toUpperCase() : 'N/A'} &rarr; {selectedAccount ? selectedAccount.toUpperCase() : 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 mb-6 text-center">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Opening Balance</p>
              <p className="text-slate-900 finance-sidebar-link">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Total Credits</p>
              <p className="text-emerald-700 finance-sidebar-link">₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Total Debits</p>
              <p className="text-red-700 finance-sidebar-link">₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Closing Balance</p>
              <p className="text-slate-900 finance-sidebar-link">₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Transactions Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-slate-900 finance-small-label uppercase">Transactions Ledger</h4>
              <span className="text-slate-500 finance-small-label">{displayedTransactions.length} ROWS</span>
            </div>
            <table className="w-full text-left finance-caption">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Date</th>
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Particulars</th>
                  <th className="px-2 py-2 text-slate-800 border-r border-slate-300 finance-input">Voucher</th>
                  <th className="px-2 py-2 text-emerald-800 text-right border-r border-slate-300 finance-input">Credit</th>
                  <th className="px-2 py-2 text-red-800 text-right border-r border-slate-300 finance-input">Debit</th>
                  <th className="px-2 py-2 text-slate-800 text-right finance-input">Balance</th>
                </tr>
              </thead>
              <tbody className="font-mono finance-small-label">
                {!selectedAccount ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans finance-input uppercase">No account selected for print</td>
                  </tr>
                ) : displayedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-sans finance-input uppercase">No transactions in this period</td>
                  </tr>
                ) : (
                  <>
                    <tr className="border-b border-slate-300 bg-slate-50/50">
                      <td colSpan={5} className="px-2 py-2 text-slate-700 text-right border-r border-slate-300 finance-input uppercase">Opening Balance</td>
                      <td className="px-2 py-2 text-slate-900 text-right finance-input">₹{openingBalance.toLocaleString('en-IN')}</td>
                    </tr>
                    {displayedTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-200 last:border-0">
                        <td className="px-2 py-1 border-r border-slate-200 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                        <td className="px-2 py-1 text-slate-700 truncate max-w-[200px] border-r border-slate-200">{tx.particulars}</td>
                        <td className="px-2 py-1 text-slate-500 border-r border-slate-200">{tx.voucherNo}</td>
                        <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tx.credit > 0 ? tx.credit.toLocaleString('en-IN') : ''}</td>
                        <td className="px-2 py-1 text-right text-red-700 border-r border-slate-200">{tx.debit > 0 ? tx.debit.toLocaleString('en-IN') : ''}</td>
                        <td className="px-2 py-1 text-right text-slate-900 finance-input">₹{tx.runningBalance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-900 bg-slate-50">
                      <td colSpan={3} className="px-2 py-2 text-slate-900 text-right border-r border-slate-300 finance-input uppercase">Closing Balance</td>
                      <td className="px-2 py-2 text-right text-emerald-700 border-r border-slate-300 finance-input">₹{totalCredits.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-right text-red-700 border-r border-slate-300 finance-input">₹{totalDebits.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-right text-slate-900 finance-sidebar-link">₹{closingBalance.toLocaleString('en-IN')}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default GeneralLedger;
