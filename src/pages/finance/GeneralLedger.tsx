import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance, UnifiedLedgerEntry } from '../../lib/supabaseFinance';
import { Printer, RefreshCw, ArrowLeft, ChevronRight, X, Calendar, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

const GeneralLedger: React.FC = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<UnifiedLedgerEntry[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedHead, setSelectedHead] = useState<string | null>(null);
  const [drillSearchQuery, setDrillSearchQuery] = useState('');

  const canonicalHeads = [
    'BANK',
    'CAPITAL',
    'CD INTEREST',
    'CD PRINCIPAL',
    'HP COMMISSION',
    'STBD COMMISSION',
    'TBD COMMISSION',
    'LIABILITIES',
    'SALARY',
    'EXPENDITURE'
  ];

  useEffect(() => {
    fetchLedgerData();
  }, [startDate, endDate]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getUnifiedLedgerEntries({
        startDate,
        endDate
      });
      setAllEntries(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load general ledger data');
    } finally {
      setLoading(false);
    }
  };

  const mapToGeneralLedgerHead = (entry: UnifiedLedgerEntry): string => {
    const head = (entry.head_of_account || '').toUpperCase();
    if (head === 'BANK' || head.includes('BANK')) return 'BANK';
    if (head === 'CAPITAL' || head.includes('CAPITAL')) return 'CAPITAL';
    
    if (entry.category === 'CD') {
      if (head.includes('PRINCIPAL') || head === 'CD PRINCIPAL' || head === 'CD A/C') return 'CD PRINCIPAL';
      return 'CD INTEREST';
    }
    if (entry.category === 'HP') {
      if (head.includes('COMMISSION') || head.includes('PENALTY') || head.includes('INTEREST')) return 'HP COMMISSION';
      return 'LIABILITIES';
    }
    if (entry.category === 'STBD') {
      if (head.includes('COMMISSION') || head.includes('PENALTY') || head.includes('INTEREST')) return 'STBD COMMISSION';
      return 'LIABILITIES';
    }
    if (entry.category === 'TBD') {
      if (head.includes('COMMISSION') || head.includes('PENALTY') || head.includes('INTEREST')) return 'TBD COMMISSION';
      return 'LIABILITIES';
    }
    if (head === 'SALARY' || head.includes('SALARY')) return 'SALARY';
    if (head === 'EXPENSE' || head === 'EXPENDITURE' || head.includes('EXPENSE') || head.includes('EXPENDITURE')) return 'EXPENDITURE';
    if (head === 'LIABILITIES' || head.includes('LIABILITY')) return 'LIABILITIES';
    return 'LIABILITIES';
  };

  const summaryData = useMemo(() => {
    // Initialize summary map for canonical heads
    const map: Record<string, { debit: number; credit: number }> = {};
    canonicalHeads.forEach(head => {
      map[head] = { debit: 0, credit: 0 };
    });

    // Aggregate values
    allEntries.forEach(entry => {
      const head = mapToGeneralLedgerHead(entry);
      if (!map[head]) {
        map[head] = { debit: 0, credit: 0 };
      }
      map[head].debit += entry.debit || 0;
      map[head].credit += entry.credit || 0;
    });

    return Object.entries(map).map(([head, totals]) => {
      // Balance = Credit - Debit
      const balance = totals.credit - totals.debit;
      return {
        head,
        debit: totals.debit,
        credit: totals.credit,
        balance
      };
    });
  }, [allEntries]);

  // Totals for the entire general ledger
  const overallTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    summaryData.forEach(s => {
      debit += s.debit;
      credit += s.credit;
    });
    return {
      debit,
      credit,
      balance: credit - debit
    };
  }, [summaryData]);

  // Drilldown entries
  const drillDownEntries = useMemo(() => {
    if (!selectedHead) return [];
    let list = allEntries.filter(entry => mapToGeneralLedgerHead(entry) === selectedHead);

    if (drillSearchQuery.trim()) {
      const q = drillSearchQuery.toLowerCase().trim();
      list = list.filter(entry => 
        (entry.account_number || '').toLowerCase().includes(q) ||
        (entry.particulars || '').toLowerCase().includes(q) ||
        (entry.user || '').toLowerCase().includes(q) ||
        String(entry.debit).includes(q) ||
        String(entry.credit).includes(q)
      );
    }
    return list;
  }, [allEntries, selectedHead, drillSearchQuery]);

  const drillDownTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    drillDownEntries.forEach(e => {
      debit += e.debit || 0;
      credit += e.credit || 0;
    });
    return { debit, credit, balance: credit - debit };
  }, [drillDownEntries]);

  const displayDateRange = `${new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-')} TO ${new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-')}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">General Ledger</h1>
          <p className="finance-small-label uppercase">Summary of accounts with absolute drill-down capabilities</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={fetchLedgerData} variant="secondary" size="sm" icon={RefreshCw} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Refresh
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print Summary
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl ${showPrintPreview ? 'print:hidden' : ''}`}>
        <Input
          label="FROM DATE"
          type="date"
          value={startDate}
          onChange={setStartDate}
          icon={Calendar}
        />
        <Input
          label="TO DATE"
          type="date"
          value={endDate}
          onChange={setEndDate}
          icon={Calendar}
        />
      </div>

      {/* Summary Table */}
      <div className={showPrintPreview ? 'print:hidden' : ''}>
        <Card
          title={
            <div className="flex justify-between items-center w-full">
              <span className="finance-card-title uppercase">Accounts Summary</span>
              <span className="font-mono text-slate-500 text-right finance-small-label uppercase">
                {displayDateRange}
              </span>
            </div>
          }
          subtitle="Click any row to drill down into transaction details"
          className="shadow-md border-slate-150 rounded-xl overflow-hidden"
        >
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="min-w-full divide-y divide-slate-150 finance-caption">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="finance-small-label uppercase">Head of Account</th>
                      <th className="text-right finance-small-label uppercase">Debit (Dr)</th>
                      <th className="text-right finance-small-label uppercase">Credit (Cr)</th>
                      <th className="text-right finance-small-label uppercase">Balance</th>
                      <th className="text-center finance-small-label uppercase w-20">Drill</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {summaryData.map(s => (
                      <tr 
                        key={s.head} 
                        onClick={() => setSelectedHead(s.head)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3.5 text-slate-900 font-bold uppercase finance-input">{s.head}</td>
                        <td className="px-4 py-3.5 text-right text-rose-600 font-semibold whitespace-nowrap">
                          {s.debit > 0 ? `₹${s.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-emerald-600 font-semibold whitespace-nowrap">
                          {s.credit > 0 ? `₹${s.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className={`px-4 py-3.5 text-right font-black whitespace-nowrap ${s.balance >= 0 ? 'text-emerald-800' : 'text-rose-850'}`}>
                          ₹{Math.abs(s.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {s.balance >= 0 ? 'Cr' : 'Dr'}
                        </td>
                        <td className="px-4 py-3.5 text-center text-slate-400">
                          <ChevronRight className="w-4 h-4 mx-auto" />
                        </td>
                      </tr>
                    ))}
                    {/* Overall totals */}
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td className="px-4 py-4 text-slate-800 uppercase finance-input">Grand Total:</td>
                      <td className="px-4 py-4 text-right text-rose-700 font-extrabold whitespace-nowrap">
                        ₹{overallTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-right text-emerald-700 font-extrabold whitespace-nowrap">
                        ₹{overallTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-4 text-right font-black whitespace-nowrap ${overallTotals.balance >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                        ₹{Math.abs(overallTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.balance >= 0 ? 'Cr' : 'Dr'}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Drill Down Modal */}
      {selectedHead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">
                  Drill Down: {selectedHead}
                </h3>
                <p className="text-xs text-slate-500 font-semibold uppercase mt-0.5">{displayDateRange}</p>
              </div>
              <button 
                onClick={() => { setSelectedHead(null); setDrillSearchQuery(''); }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input 
                    label="Search Drill Down Entries" 
                    value={drillSearchQuery} 
                    onChange={setDrillSearchQuery}
                    placeholder="Search by account number, amount, particulars..." 
                    icon={Search}
                  />
                </div>
                <div className="flex gap-4 items-end pb-1.5 text-center text-xs">
                  <div className="px-4 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <span className="text-red-600 block uppercase font-bold text-[9px]">Drill Debit</span>
                    <span className="font-bold text-red-800">₹{drillDownTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="px-4 py-2 bg-green-50 border border-green-100 rounded-lg">
                    <span className="text-green-600 block uppercase font-bold text-[9px]">Drill Credit</span>
                    <span className="font-bold text-green-800">₹{drillDownTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`px-4 py-2 border rounded-lg ${drillDownTotals.balance >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    <span className="block uppercase font-bold text-[9px]">Drill Net</span>
                    <span className="font-bold">₹{Math.abs(drillDownTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {drillDownTotals.balance >= 0 ? 'Cr' : 'Dr'}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 rounded-xl flex-1">
                <table className="min-w-full divide-y divide-slate-150 finance-caption">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="finance-small-label uppercase">Sl No</th>
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="finance-small-label uppercase">Account / Loan</th>
                      <th className="text-right finance-small-label uppercase">Debit (Dr)</th>
                      <th className="text-right finance-small-label uppercase">Credit (Cr)</th>
                      <th className="finance-small-label uppercase">Particulars</th>
                      <th className="finance-small-label uppercase">User</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {drillDownEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 finance-input">
                          No transactions found.
                        </td>
                      </tr>
                    ) : (
                      drillDownEntries.map((e, idx) => (
                        <tr key={e.id} className="hover:bg-slate-50/30">
                          <td className="px-3 py-2.5 text-slate-500 finance-input">{idx + 1}</td>
                          <td className="px-3 py-2.5 text-slate-650 whitespace-nowrap finance-input">
                            {e.date.split('-').reverse().join('/')}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-900 font-black">{e.account_number}</td>
                          <td className="px-3 py-2.5 text-right text-rose-600 whitespace-nowrap font-medium">
                            {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-600 whitespace-nowrap font-medium">
                            {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 max-w-xs break-words finance-input">{e.particulars}</td>
                          <td className="px-3 py-2.5 text-slate-500 uppercase finance-input">{e.user}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="General Ledger Summary"
        documentTitle={`GENERAL LEDGER SUMMARY: ${displayDateRange}`}
      >
        {!loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-900 pb-2">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
                <p className="text-[13px] uppercase text-slate-500">General Ledger Summary Statement</p>
              </div>
              <div className="text-right text-[13px] text-slate-600">
                <p>Period: {startDate.split('-').reverse().join('/')} to {endDate.split('-').reverse().join('/')}</p>
              </div>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100">
                  <th className="p-2 text-left border">Head of Account</th>
                  <th className="p-2 text-right border">Debit (Dr)</th>
                  <th className="p-2 text-right border">Credit (Cr)</th>
                  <th className="p-2 text-right border">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map(s => (
                  <tr key={s.head} className="border-b">
                    <td className="p-2 border font-bold uppercase">{s.head}</td>
                    <td className="p-2 border text-right text-red-650">
                      {s.debit > 0 ? `₹${s.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="p-2 border text-right text-green-650">
                      {s.credit > 0 ? `₹${s.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className={`p-2 border text-right font-black ${s.balance >= 0 ? 'text-emerald-800' : 'text-rose-850'}`}>
                      ₹{Math.abs(s.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {s.balance >= 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-800">
                  <td className="p-2 border uppercase">Grand Total:</td>
                  <td className="p-2 border text-right text-red-700">₹{overallTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 border text-right text-green-700">₹{overallTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className={`p-2 border text-right font-black ${overallTotals.balance >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                    ₹{Math.abs(overallTotals.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {overallTotals.balance >= 0 ? 'Cr' : 'Dr'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default GeneralLedger;
