import React, { useEffect, useState, useMemo } from 'react';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer, ArrowLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface OverdueDueItem {
  id: string;
  loanId: string;
  customerName: string;
  loanCategory: string;
  loanType: 'CD' | 'HP' | 'STBD' | 'TBD';
  loanAmount: number;
  currentPrincipal: number;
  loanDate: string;
  currentDueDate: string;
  interestPaid: number;
  pendingInterest: number;
  penalty: number;
  presentDue: number;
  dueDays: number;
  isNPA: boolean;
  phone: string;
  g1Name: string;
  g1Phone: string;
  g2Name: string;
  g2Phone: string;
  partnerName: string;
}

type ReportType = 'OUTSTANDING' | 'TOTAL DUE LIST' | 'CD DUE LIST' | 'A -> B DUE LIST' | 'NPA LIST';

const DuesLedger: React.FC = () => {
  const navigate = useNavigate();
  
  const [dues, setDues] = useState<OverdueDueItem[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  
  const [activeReport, setActiveReport] = useState<ReportType>('OUTSTANDING');
  const [selectedPartner, setSelectedPartner] = useState<string>('ALL PARTNERS');
  const [loanTypeFilter, setLoanTypeFilter] = useState<'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD'>('ALL');
  
  const [searchName, setSearchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Partners
      const partnersData = await supabaseFinance.getPartners();
      setPartners(partnersData.map(p => ({ id: p.id, name: p.name })));

      // 2. Fetch Aggregated Dues Summary via RPC
      const summaryData = await supabaseFinance.getDuesLedgerSummary();
      
      const formatted: OverdueDueItem[] = summaryData.map((row: any) => ({
        id: row.id,
        loanId: row.loan_id,
        customerName: row.customer_name,
        loanCategory: row.loan_category,
        loanType: row.loan_type,
        loanAmount: Number(row.loan_amount),
        currentPrincipal: Number(row.current_principal),
        loanDate: row.loan_date,
        currentDueDate: row.current_due_date,
        interestPaid: Number(row.interest_paid || 0),
        pendingInterest: Number(row.pending_interest || 0),
        penalty: Number(row.penalty || 0),
        presentDue: Number(row.present_due || 0),
        dueDays: Number(row.due_days || 0),
        isNPA: Boolean(row.is_npa),
        phone: row.phone || '',
        g1Name: row.g1_name || '',
        g1Phone: row.g1_phone || '',
        g2Name: row.g2_name || '',
        g2Phone: row.g2_phone || '',
        partnerName: row.partner_name || 'Unassigned'
      }));

      setDues(formatted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dues ledger');
    } finally {
      setLoading(false);
    }
  };


  const filteredDues = useMemo(() => {
    return dues.filter(due => {
      // 1. Report Type Filter
      if (activeReport === 'OUTSTANDING') {
        if (due.presentDue <= 0 && due.dueDays <= 0) return false;
      } else if (activeReport === 'NPA LIST') {
        if (!due.isNPA) return false;
      } else if (activeReport === 'CD DUE LIST') {
        if (due.loanType !== 'CD') return false;
      } else if (activeReport === 'A -> B DUE LIST') {
        if (startDate && due.currentDueDate < startDate) return false;
        if (endDate && due.currentDueDate > endDate) return false;
      }

      // 2. Partner Filter
      if (selectedPartner !== 'ALL PARTNERS' && due.partnerName !== selectedPartner) return false;

      // 3. Loan Type Filter
      if (loanTypeFilter !== 'ALL' && due.loanType !== loanTypeFilter) return false;

      // 4. Search Filter
      if (searchName && !due.customerName.toLowerCase().includes(searchName.toLowerCase()) && !due.loanId.toLowerCase().includes(searchName.toLowerCase())) return false;

      return true;
    });
  }, [dues, activeReport, selectedPartner, loanTypeFilter, searchName, startDate, endDate]);

  const totals = useMemo(() => {
    let principal = 0;
    let interestPaid = 0;
    let interest = 0;
    let penalty = 0;
    let presentDue = 0;
    let amountToClose = 0;

    filteredDues.forEach(d => {
      principal += d.currentPrincipal;
      interestPaid += d.interestPaid;
      interest += d.pendingInterest;
      penalty += d.penalty;
      presentDue += d.presentDue;
      amountToClose += d.currentPrincipal + d.pendingInterest + d.penalty;
    });

    return { principal, interestPaid, interest, penalty, presentDue, amountToClose };
  }, [filteredDues]);

  const options: ReportType[] = ['OUTSTANDING', 'TOTAL DUE LIST', 'CD DUE LIST', 'A -> B DUE LIST', 'NPA LIST'];

  return (
    <div className="flex flex-col gap-2 w-full max-w-[100%] mx-auto px-4 pt-3 pb-4 print:p-0">

      {/* ── ROW 1: Header ───────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[15px] font-black uppercase text-slate-900 tracking-wide leading-none">Dues List</h1>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Outstanding · NPA · Partner Collection</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 text-[12px] font-bold uppercase shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1329] text-white rounded-lg hover:bg-slate-800 text-[12px] font-bold uppercase shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Landscape
          </button>
        </div>
      </div>

      {/* ── ROW 2: Filters + Summary (single horizontal bar) ────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-3">

          {/* Partner */}
          <div className="flex flex-col min-w-[160px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Partner</label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 uppercase bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer h-[34px]"
            >
              <option value="ALL PARTNERS">ALL PARTNERS</option>
              {partners.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Loan Type */}
          <div className="flex flex-col min-w-[130px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Loan Type</label>
            <select
              value={loanTypeFilter}
              onChange={(e) => setLoanTypeFilter(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 uppercase bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer h-[34px]"
            >
              <option value="ALL">ALL TYPES</option>
              <option value="CD">CD LOANS</option>
              <option value="HP">HP LOANS</option>
              <option value="STBD">STBD LOANS</option>
              <option value="TBD">TBD LOANS</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Search Account / Name</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. CD100, NARSIMULU"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-slate-800 font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]"
              />
            </div>
          </div>

          {/* A→B date filters — only shown when tab is active */}
          {activeReport === 'A -> B DUE LIST' && (
            <>
              <div className="flex flex-col min-w-[130px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">From Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]" />
              </div>
              <div className="flex flex-col min-w-[130px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">To Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]" />
              </div>
            </>
          )}

          {/* ── Summary Metrics (right side) ───────────────────────────────── */}
          <div className="flex items-stretch gap-2 ml-auto flex-wrap">
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 flex flex-col justify-center min-w-[140px]">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-wider leading-none">Total Present Dues</span>
              <span className="text-red-650 text-[17px] font-black font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                ₹{totals.presentDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex flex-col justify-center min-w-[100px]">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider leading-none">Accounts</span>
              <span className="text-slate-900 text-[22px] font-black font-mono tracking-tight leading-tight mt-0.5">
                {filteredDues.length}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ── ROW 3: Report Type Tabs ──────────────────────────────────────────── */}
      <div className="bg-slate-100 px-1.5 py-1 rounded-xl border border-slate-200">
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setActiveReport(opt)}
              className={`flex-1 min-w-[130px] text-center px-3 py-2 rounded-lg text-[12px] font-extrabold tracking-wide uppercase transition-all duration-150 ${
                activeReport === opt
                  ? 'bg-[#0b1329] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROW 4: Dues Table ────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Compact section header */}
        <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[12px] font-black uppercase text-slate-700 tracking-wide">{activeReport} — {loanTypeFilter}</span>
          <span className="text-[11px] text-slate-400 font-semibold uppercase">{filteredDues.length} records</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-slate-900"></div>
          </div>
        ) : filteredDues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 font-bold uppercase text-[13px]">No Due Accounts Found</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <table className="min-w-full divide-y divide-slate-150 finance-caption">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                <tr className="bg-slate-50">
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-center w-10 bg-slate-50 finance-small-label">Sl</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-left w-20 bg-slate-50 finance-small-label">Loan No</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Party Name</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 text-center w-14 bg-slate-50 finance-small-label">Type</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-32 bg-slate-50 finance-small-label">Principal</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-28 bg-slate-50 finance-small-label">Int. Paid</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-28 bg-slate-50 finance-small-label">Pend. Int</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-24 bg-slate-50 finance-small-label">Penalty</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-32 bg-slate-50 finance-small-label font-black">Present Due</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 w-32 bg-slate-50 finance-small-label font-black text-blue-900">Close Amt</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-slate-800 w-28 bg-slate-50 finance-small-label">Due Date</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-800 w-16 bg-slate-50 finance-small-label">Days</th>
                  <th className="px-2 py-1.5 text-slate-800 text-left bg-slate-50 finance-small-label">Contact (B / G1 / G2)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-mono text-[13px]">
                {filteredDues.map((due, idx) => (
                  <tr key={due.id} className={`hover:bg-slate-50/40 transition-colors ${due.isNPA ? 'bg-red-50/20' : ''}`}>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-500 font-sans text-center text-[13px] font-semibold">{idx + 1}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 font-bold text-blue-650 text-[13px] whitespace-nowrap">{due.loanId}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-905 font-sans font-bold text-[13px]">{due.customerName}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600 font-sans text-center text-[13px] font-semibold">{due.loanType}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-slate-700 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.currentPrincipal).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-emerald-700 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.interestPaid).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-orange-600 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.pendingInterest).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-red-650 text-[13px] font-semibold whitespace-nowrap">₹{Math.round(due.penalty).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-slate-950 font-sans text-[13px] font-bold whitespace-nowrap">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-right text-blue-900 font-sans text-[13px] font-bold whitespace-nowrap">₹{Math.round(due.currentPrincipal + due.pendingInterest + due.penalty).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600 font-sans whitespace-nowrap text-[13px] font-semibold">{due.currentDueDate.split('-').reverse().join('/')}</td>
                    <td className="px-2 py-1.5 border-r border-slate-100 text-center text-red-650 text-[13px] font-bold whitespace-nowrap">{due.dueDays}</td>
                    <td className="px-2 py-1.5 font-sans text-[13px] text-slate-600 space-y-0.5">
                      <div><span className="font-semibold text-slate-900">B:</span> {due.phone || '—'}</div>
                      {due.g1Name && (
                        <div><span className="font-semibold text-slate-900">G1:</span> {due.g1Name} ({due.g1Phone || '—'})</div>
                      )}
                      {due.g2Name && (
                        <div><span className="font-semibold text-slate-900">G2:</span> {due.g2Name} ({due.g2Phone || '—'})</div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-slate-50 font-sans font-extrabold border-t-2 border-slate-200 text-[13px]">
                  <td colSpan={4} className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 uppercase">Grand Total:</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-800 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.principal).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-emerald-700 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.interestPaid).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-orange-750 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.interest).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-red-650 font-bold text-[13px] whitespace-nowrap">₹{Math.round(totals.penalty).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-950 font-black text-[13px] whitespace-nowrap">₹{Math.round(totals.presentDue).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 text-right text-blue-950 font-black text-[13px] whitespace-nowrap">₹{Math.round(totals.amountToClose).toLocaleString('en-IN')}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINT PREVIEW */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Collection Dues Report"
        documentTitle={`DUES LIST — ${activeReport}`}
        orientation="landscape"
      >
        {!loading && (
          <div className="space-y-4">
            {/* Print Header */}
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4" style={{ fontSize: '10px' }}>
              <div>
                <h3 className="font-bold uppercase text-slate-900" style={{ fontSize: '12px', margin: 0 }}>THIRUMALA GROUP FINANCE</h3>
                <p className="text-slate-500" style={{ margin: 0 }}>Collection Dues Ledger</p>
              </div>
              <div className="text-right text-slate-900">
                <p style={{ margin: 0 }}><span className="font-bold">DATE:</span> {new Date().toLocaleDateString('en-IN')}</p>
                <p style={{ margin: 0 }}><span className="font-bold">PARTNER:</span> {selectedPartner}</p>
              </div>
            </div>

            <table className="w-full border-collapse" style={{ tableLayout: 'fixed', fontSize: '9px' }}>
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold" style={{ fontSize: '9px' }}>
                  <th className="p-1 border text-center print-nowrap" style={{ whiteSpace: 'nowrap' }}>SL</th>
                  <th className="p-1 border text-left print-nowrap" style={{ whiteSpace: 'nowrap' }}>LOAN NO</th>
                  <th className="p-1 border text-left print-wrap" style={{ wordBreak: 'normal', overflowWrap: 'normal', whiteSpace: 'normal' }}>PARTY NAME</th>
                  <th className="p-1 border text-center print-nowrap" style={{ whiteSpace: 'nowrap' }}>TYPE</th>
                  <th className="p-1 border text-right print-nowrap" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>PRINCIPAL</th>
                  <th className="p-1 border text-right print-nowrap" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>INT. PAID</th>
                  <th className="p-1 border text-right print-nowrap" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>PEND. INT</th>
                  <th className="p-1 border text-right print-nowrap" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>PENALTY</th>
                  <th className="p-1 border text-right print-nowrap" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>PRESENT DUE</th>
                  <th className="p-1 border text-right print-nowrap" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>CLOSE AMT</th>
                  <th className="p-1 border text-left print-nowrap" style={{ whiteSpace: 'nowrap' }}>DUE DATE</th>
                  <th className="p-1 border text-center print-nowrap" style={{ whiteSpace: 'nowrap' }}>DAYS</th>
                  <th className="p-1 border text-left print-nowrap" style={{ whiteSpace: 'nowrap' }}>CONTACT</th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map((due, idx) => (
                  <tr key={due.id} className="border-b" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <td className="p-1 border text-center print-nowrap" style={{ whiteSpace: 'nowrap' }}>{idx + 1}</td>
                    <td className="p-1 border font-bold text-blue-800 print-nowrap" style={{ whiteSpace: 'nowrap' }}>{due.loanId}</td>
                    <td className="p-1 border font-bold print-wrap" style={{ wordBreak: 'normal', overflowWrap: 'normal', whiteSpace: 'normal', minWidth: '90px' }}>
                      {due.customerName}
                    </td>
                    <td className="p-1 border text-center print-nowrap" style={{ whiteSpace: 'nowrap' }}>{due.loanType}</td>
                    <td className="p-1 border text-right print-amount" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Math.round(due.currentPrincipal).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-green-700 print-amount" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Math.round(due.interestPaid).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-orange-700 print-amount" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Math.round(due.pendingInterest).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right text-red-600 print-amount" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Math.round(due.penalty).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right font-bold text-red-750 print-amount" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                    <td className="p-1 border text-right font-bold text-blue-900 print-amount" style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{Math.round(due.currentPrincipal + due.pendingInterest + due.penalty).toLocaleString('en-IN')}</td>
                    <td className="p-1 border print-nowrap" style={{ whiteSpace: 'nowrap' }}>{due.currentDueDate.split('-').reverse().join('/')}</td>
                    <td className="p-1 border text-center text-red-600 font-bold print-nowrap" style={{ whiteSpace: 'nowrap' }}>{due.dueDays}</td>
                    <td className="p-1 border font-sans leading-tight print-nowrap" style={{ whiteSpace: 'nowrap', fontSize: '8.5px' }}>
                      {due.phone && (
                        <div style={{ whiteSpace: 'nowrap' }}><span className="font-semibold text-slate-850">B:</span> {due.phone}</div>
                      )}
                      {due.g1Phone && (
                        <div style={{ whiteSpace: 'nowrap' }}><span className="font-semibold text-slate-850">G1:</span> {due.g1Phone}</div>
                      )}
                      {due.g2Phone && (
                        <div style={{ whiteSpace: 'nowrap' }}><span className="font-semibold text-slate-850">G2:</span> {due.g2Phone}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Section */}
            <div className="mt-6 flex justify-end" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div className="w-[450px] border-2 border-slate-900 rounded-lg p-4 bg-slate-50" style={{ fontSize: '11px', fontFamily: 'sans-serif' }}>
                <h4 className="font-bold text-center border-b-2 border-slate-900 pb-2 mb-3 uppercase tracking-wider" style={{ fontSize: '12px', margin: 0 }}>Report Totals</h4>
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-slate-300 pb-1">
                    <span className="font-semibold text-slate-700 uppercase">Outstanding Principal:</span>
                    <span className="font-bold" style={{ whiteSpace: 'nowrap' }}>₹{Math.round(totals.principal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 pb-1">
                    <span className="font-semibold text-slate-700 uppercase">Interest Paid:</span>
                    <span className="font-bold text-green-700" style={{ whiteSpace: 'nowrap' }}>₹{Math.round(totals.interestPaid).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 pb-1">
                    <span className="font-semibold text-slate-700 uppercase">Pending Interest:</span>
                    <span className="font-bold text-orange-700" style={{ whiteSpace: 'nowrap' }}>₹{Math.round(totals.interest).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 pb-1">
                    <span className="font-semibold text-slate-700 uppercase">Pending Penalty:</span>
                    <span className="font-bold text-red-600" style={{ whiteSpace: 'nowrap' }}>₹{Math.round(totals.penalty).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 pb-1">
                    <span className="font-semibold text-slate-700 uppercase">Present Due:</span>
                    <span className="font-bold text-red-700" style={{ whiteSpace: 'nowrap' }}>₹{Math.round(totals.presentDue).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t-2 border-slate-900 mt-2 bg-slate-900 text-white p-2 rounded" style={{ fontSize: '13px' }}>
                    <span className="font-black uppercase tracking-wide">Total Amount to Close:</span>
                    <span className="font-black" style={{ whiteSpace: 'nowrap' }}>₹{Math.round(totals.amountToClose).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </FinancePrintPreview>
    </div>
  );
};

export default DuesLedger;
