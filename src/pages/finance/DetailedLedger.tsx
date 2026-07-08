import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance, UnifiedLedgerEntry } from '../../lib/supabaseFinance';
import { Printer, ArrowLeft, Calendar, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

const DetailedLedgerFinance: React.FC = () => {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => getLocalBusinessDateISO());
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD' | 'BANK' | 'SALARY' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<UnifiedLedgerEntry[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getUnifiedLedgerEntries({
        startDate: fromDate,
        endDate: toDate
      });
      setEntries(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load detailed ledger entries');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Apply category filter
    if (categoryFilter !== 'ALL') {
      result = result.filter(entry => {
        if (categoryFilter === 'CD') return entry.category === 'CD';
        if (categoryFilter === 'HP') return entry.category === 'HP';
        if (categoryFilter === 'STBD') return entry.category === 'STBD';
        if (categoryFilter === 'TBD') return entry.category === 'TBD';
        if (categoryFilter === 'BANK') return entry.category === 'BANK';
        if (categoryFilter === 'SALARY') return entry.category === 'SALARY';
        if (categoryFilter === 'EXPENSE') return entry.category === 'EXPENSE';
        return true;
      });
    }

    // Apply search filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(entry => {
        const head = (entry.head_of_account || '').toLowerCase();
        const accNo = (entry.account_number || '').toLowerCase();
        const part = (entry.particulars || '').toLowerCase();
        const usr = (entry.user || '').toLowerCase();
        const dateStr = entry.date.split('-').reverse().join('/');
        return (
          head.includes(query) ||
          accNo.includes(query) ||
          part.includes(query) ||
          usr.includes(query) ||
          entry.date.includes(query) ||
          dateStr.includes(query)
        );
      });
    }

    return result;
  }, [entries, categoryFilter, searchQuery]);

  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    filteredEntries.forEach(entry => {
      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    });

    return {
      totalDebit,
      totalCredit,
      balance: totalCredit - totalDebit
    };
  }, [filteredEntries]);

  const categories: { value: typeof categoryFilter; label: string }[] = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'CD', label: 'CD Loans' },
    { value: 'HP', label: 'HP Loans' },
    { value: 'STBD', label: 'STBD Loans' },
    { value: 'TBD', label: 'TBD Loans' },
    { value: 'BANK', label: 'Bank A/c' },
    { value: 'SALARY', label: 'Salary A/c' },
    { value: 'EXPENSE', label: 'Expense A/c' }
  ];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>REPORTS</span>
            <span>/</span>
            <span className="text-slate-600">DETAILED LEDGER</span>
          </div>
          <h1 className="mt-1 finance-h1">Detailed Ledger</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            Comprehensive audit report for all financial transaction heads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            PRINT
          </button>
        </div>
      </div>

      {/* Date & Category Filters */}
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl ${showPrintPreview ? 'print:hidden' : ''}`}>
        <Input
          label="FROM DATE"
          type="date"
          value={fromDate}
          onChange={setFromDate}
          icon={Calendar}
        />
        <Input
          label="TO DATE"
          type="date"
          value={toDate}
          onChange={setToDate}
          icon={Calendar}
        />
        <div className="flex flex-col justify-end">
          <label className="text-slate-500 mb-1 finance-small-label uppercase">Category Filter</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:ring-1 focus:ring-green-500 focus:border-green-500 finance-input"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <Input
          label="SEARCH TRANSACTION"
          type="text"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by loan, head, particulars..."
          icon={Search}
        />
      </div>

      {/* Detailed Ledger Sheet */}
      <div className={showPrintPreview ? 'print:hidden' : ''}>
        <Card
          title={
            <div className="flex justify-between items-center w-full">
              <span className="finance-card-title uppercase">Ledger Transactions</span>
              <span className="font-mono text-slate-500 text-right finance-small-label uppercase">
                {new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to {new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
          }
          subtitle={`Showing ${filteredEntries.length} entries matching filters`}
          className="shadow-md border-slate-150 rounded-xl"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 shadow-xs">
                  <span className="text-red-700 block finance-header-time uppercase">Total Debits (Dr)</span>
                  <span className="text-red-800 finance-brand">₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 shadow-xs">
                  <span className="text-green-700 block finance-header-time uppercase">Total Credits (Cr)</span>
                  <span className="text-green-800 finance-brand">₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`p-4 rounded-xl border shadow-xs ${totals.balance >= 0 ? 'bg-emerald-100 border-emerald-250' : 'bg-rose-100 border-rose-250'}`}>
                  <span className={`${totals.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'} block finance-header-time uppercase`}>Net Balance</span>
                  <span className={`${totals.balance >= 0 ? 'text-emerald-950' : 'text-rose-950'} finance-brand`}>
                    {totals.balance >= 0 ? '+' : ''}₹{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="min-w-full divide-y divide-slate-150 finance-caption">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="finance-small-label uppercase">Sl No</th>
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="finance-small-label uppercase">Account Number</th>
                      <th className="finance-small-label uppercase">Head of Account</th>
                      <th className="text-right finance-small-label uppercase">Debit (Dr)</th>
                      <th className="text-right finance-small-label uppercase">Credit (Cr)</th>
                      <th className="finance-small-label uppercase">Particulars</th>
                      <th className="finance-small-label uppercase">User</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 finance-input">
                          No transactions found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, idx) => (
                        <tr key={entry.id} className="hover:bg-slate-50/30">
                          <td className="px-3 py-3 text-slate-500 finance-input">{idx + 1}</td>
                          <td className="px-3 py-3 text-slate-650 whitespace-nowrap finance-input">
                            {entry.date.split('-').reverse().join('/')}
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-900 font-black">{entry.account_number}</td>
                          <td className="px-3 py-3 text-slate-800 font-semibold uppercase">{entry.head_of_account}</td>
                          <td className="px-3 py-3 text-right text-rose-600 font-medium whitespace-nowrap finance-input">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap finance-input">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-slate-700 max-w-xs break-words finance-input">{entry.particulars}</td>
                          <td className="px-3 py-3 text-slate-500 finance-input uppercase">{entry.user}</td>
                        </tr>
                      ))
                    )}
                    {/* Grand Total */}
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={4} className="px-3 py-3.5 text-right text-slate-800 finance-input uppercase">Grand Total:</td>
                      <td className="px-3 py-3.5 text-right text-rose-700 font-bold whitespace-nowrap finance-input">
                        ₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3.5 text-right text-emerald-700 font-bold whitespace-nowrap finance-input">
                        ₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Detailed Ledger Report"
        documentTitle={`DETAILED LEDGER: ${new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
      >
        {!loading && (
          <div className="space-y-6">
            {/* Headers */}
            <div className="flex justify-between items-end border-b border-slate-900 pb-2">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
                <p className="text-[13px] uppercase text-slate-500">Detailed Ledger Statement</p>
              </div>
              <div className="text-right text-[13px] text-slate-650">
                <p>Period: {fromDate.split('-').reverse().join('/')} to {toDate.split('-').reverse().join('/')}</p>
                <p>Category: {categoryFilter}</p>
              </div>
            </div>

            {/* Print Summary */}
            <div className="grid grid-cols-3 gap-4 border p-3 rounded">
              <div>
                <span className="text-[13px] text-slate-500 uppercase block">Total Debits</span>
                <span className="text-sm font-bold text-red-700">₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[13px] text-slate-500 uppercase block">Total Credits</span>
                <span className="text-sm font-bold text-green-700">₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[13px] text-slate-500 uppercase block">Net Balance</span>
                <span className={`text-sm font-bold ${totals.balance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  ₹{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Print Table */}
            <table className="w-full border-collapse" style={{ tableLayout: 'auto', fontSize: '10pt' }}>
              <colgroup>
                {/* Sl  Date  AcctNo  Head  Debit  Credit  Particulars  User */}
                <col style={{ width: '3%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '38%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100">
                  <th className="p-1.5 text-left border print-nowrap">Sl No</th>
                  <th className="p-1.5 text-left border print-nowrap">Date</th>
                  <th className="p-1.5 text-left border print-nowrap">Account Number</th>
                  <th className="p-1.5 text-left border print-wrap">Head of Account</th>
                  <th className="p-1.5 text-right border print-nowrap">Debit (Dr)</th>
                  <th className="p-1.5 text-right border print-nowrap">Credit (Cr)</th>
                  <th className="p-1.5 text-left border print-wrap">Particulars</th>
                  <th className="p-1.5 text-left border print-nowrap">User</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, idx) => (
                  <tr key={entry.id} className="border-b">
                    <td className="p-1.5 border print-nowrap">{idx + 1}</td>
                    <td className="p-1.5 border print-nowrap">{entry.date.split('-').reverse().join('/')}</td>
                    <td className="p-1.5 border font-mono font-bold print-nowrap">{entry.account_number}</td>
                    <td className="p-1.5 border uppercase print-wrap">{entry.head_of_account}</td>
                    <td className="p-1.5 border text-right text-red-650 print-amount">{entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="p-1.5 border text-right text-green-650 print-amount">{entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="p-1.5 border print-wrap">{entry.particulars}</td>
                    <td className="p-1.5 border text-slate-500 uppercase print-nowrap">{entry.user}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-800 print-total">
                  <td colSpan={4} className="p-1.5 text-right border uppercase print-wrap">Grand Total:</td>
                  <td className="p-1.5 text-right border text-red-700 print-amount">₹{totals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-1.5 text-right border text-green-700 print-amount">₹{totals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td colSpan={2} className="border"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default DetailedLedgerFinance;
