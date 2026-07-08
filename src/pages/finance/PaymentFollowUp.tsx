import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseFinance, FinanceLoanPaymentFollowup } from '../../lib/supabaseFinance';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Printer, 
  Search,
  MessageSquare,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useAuth } from '../../contexts/AuthContext';

interface ActiveDueLoan {
  id: string;
  loanId: string;
  customerName: string;
  loanCategory: string;
  loanType: 'CD' | 'HP' | 'STBD' | 'TBD';
  loanAmount: number;
  currentPrincipal: number;
  loanDate: string;
  currentDueDate: string;
  pendingInterest: number;
  penalty: number;
  presentDue: number;
  dueDays: number;
  phone: string;
  g1Name: string;
  g1Phone: string;
  g2Name: string;
  g2Phone: string;
  partnerName: string;
  status: string;
  // Follow up state
  lastFollowUp?: FinanceLoanPaymentFollowup;
  nextFollowUpDate: string | null;
}

type FollowUpTab = 'ACTIVE_QUEUE' | 'TODAYS' | 'UPCOMING' | 'MISSED' | 'HISTORY';

// Simple Close Icon mapping
const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} 
    stroke="currentColor" 
    className="w-5 h-5"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PaymentFollowUp: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Loading and Data States
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<ActiveDueLoan[]>([]);
  const [followUps, setFollowUps] = useState<FinanceLoanPaymentFollowup[]>([]);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<FollowUpTab>('ACTIVE_QUEUE');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState<'ALL' | 'CD' | 'HP' | 'STBD' | 'TBD'>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL STAFF');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Follow-up Form Modal State
  const [selectedLoan, setSelectedLoan] = useState<ActiveDueLoan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [contactedPerson, setContactedPerson] = useState<'CUSTOMER' | 'GUARANTOR_1' | 'GUARANTOR_2' | 'OTHER'>('CUSTOMER');
  const [result, setResult] = useState<'ANSWERED' | 'NO_ANSWER' | 'PROMISED_PAYMENT' | 'CALL_BACK_LATER' | 'GUARANTOR_CONTACTED' | 'OTHER'>('ANSWERED');
  const [narration, setNarration] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  // Print Preview state
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Followup records
      const fetchedFollowups = await supabaseFinance.getFollowUps();
      setFollowUps(fetchedFollowups);

      // 2. Fetch Aggregated Dues Summary via RPC
      const summaryData = await supabaseFinance.getDuesLedgerSummary();

      const calculatedLoans: ActiveDueLoan[] = summaryData.map((row: any) => {
        // Get this loan's follow-up history
        const loanFollowups = fetchedFollowups
          .filter((f: any) => f.loan_id === row.id)
          .sort((a, b) => new Date(b.followed_up_at).getTime() - new Date(a.followed_up_at).getTime());

        const lastFollowUp = loanFollowups[0];
        const nextFollowUpDate = lastFollowUp ? lastFollowUp.next_follow_up_date : null;

        return {
          id: row.id,
          loanId: row.loan_id,
          customerName: row.customer_name,
          loanCategory: row.loan_category || 'General',
          loanType: row.loan_type,
          loanAmount: Number(row.loan_amount),
          currentPrincipal: Number(row.current_principal),
          loanDate: row.loan_date,
          currentDueDate: row.current_due_date,
          pendingInterest: Number(row.pending_interest || 0),
          penalty: Number(row.penalty || 0),
          presentDue: Number(row.present_due || 0),
          dueDays: Number(row.due_days || 0),
          phone: row.phone || '',
          g1Name: row.g1_name || '',
          g1Phone: row.g1_phone || '',
          g2Name: row.g2_name || '',
          g2Phone: row.g2_phone || '',
          partnerName: row.partner_name || 'Unassigned',
          status: 'Active',
          lastFollowUp,
          nextFollowUpDate
        };
      });

      setLoans(calculatedLoans);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load collection follow-ups data');
    } finally {
      setLoading(false);
    }
  };

  // Staff list for filter
  const staffList = useMemo(() => {
    const staffSet = new Set<string>();
    followUps.forEach(f => {
      if (f.followed_up_by) staffSet.add(f.followed_up_by);
    });
    return Array.from(staffSet);
  }, [followUps]);

  // Tab calculations
  const todayDateStr = useMemo(() => getLocalBusinessDateISO(), []);

  const categorizedLoans = useMemo(() => {
    // Only Active Loans are eligible for active queues
    const activeDueLoans = loans.filter(l => l.status === 'Active' && l.presentDue > 0);

    return {
      ACTIVE_QUEUE: activeDueLoans,
      TODAYS: activeDueLoans.filter(l => l.nextFollowUpDate === todayDateStr),
      UPCOMING: activeDueLoans.filter(l => l.nextFollowUpDate && l.nextFollowUpDate > todayDateStr),
      MISSED: activeDueLoans.filter(l => l.nextFollowUpDate && l.nextFollowUpDate < todayDateStr)
    };
  }, [loans, todayDateStr]);

  // Main UI Filter Logic
  const filteredList = useMemo(() => {
    if (activeTab === 'HISTORY') return [];

    let list = categorizedLoans[activeTab as keyof typeof categorizedLoans] || [];

    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      list = list.filter(l => 
        l.loanId.toLowerCase().includes(query) || 
        l.customerName.toLowerCase().includes(query) ||
        l.phone.toLowerCase().includes(query)
      );
    }

    // Loan type
    if (loanTypeFilter !== 'ALL') {
      list = list.filter(l => l.loanType === loanTypeFilter);
    }

    return list;
  }, [categorizedLoans, activeTab, searchQuery, loanTypeFilter]);

  // Unified History Records for history tab/report
  const filteredHistory = useMemo(() => {
    if (activeTab !== 'HISTORY') return [];

    let list = [...followUps];

    // Staff filter
    if (staffFilter !== 'ALL STAFF') {
      list = list.filter(f => f.followed_up_by === staffFilter);
    }

    // Date filter
    if (dateFilter) {
      list = list.filter(f => f.follow_up_date === dateFilter);
    }

    // Search query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      list = list.filter(f => {
        const loanNo = f.loan?.loan_id || '';
        const custName = f.loan?.customer?.name || '';
        const narration = f.narration || '';
        return (
          loanNo.toLowerCase().includes(query) ||
          custName.toLowerCase().includes(query) ||
          narration.toLowerCase().includes(query)
        );
      });
    }

    // Filter by loan type
    if (loanTypeFilter !== 'ALL') {
      list = list.filter(f => {
        const loanNo = f.loan?.loan_id || '';
        const type = loanNo.startsWith('CD') ? 'CD' : loanNo.startsWith('HP') ? 'HP' : loanNo.startsWith('STBD') ? 'STBD' : 'TBD';
        return type === loanTypeFilter;
      });
    }

    return list;
  }, [followUps, activeTab, staffFilter, dateFilter, searchQuery, loanTypeFilter]);

  // Open Log Modal
  const handleOpenFollowUpModal = (loan: ActiveDueLoan) => {
    setSelectedLoan(loan);
    setContactedPerson('CUSTOMER');
    setResult('ANSWERED');
    setNarration('');
    setNextFollowUpDate('');
    setShowModal(true);
  };

  // Quick next date calculator helpers
  const handleSetQuickDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNextFollowUpDate(d.toISOString().split('T')[0]);
  };

  // Save followup record
  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    if (!narration.trim()) {
      toast.error('Please enter a narration / call summary');
      return;
    }

    setSubmitting(true);
    const staffName = user?.username || 'Staff';

    const payload = {
      loan_id: selectedLoan.id,
      follow_up_date: getLocalBusinessDateISO(),
      followed_up_by: staffName,
      contacted_person: contactedPerson,
      result: result,
      narration: narration.trim(),
      next_follow_up_date: nextFollowUpDate || null
    };

    try {
      const result = await supabaseFinance.createFollowUp(payload);
      if (result) {
        toast.success('Follow-up record logged successfully');
        setShowModal(false);
        fetchData();
      } else {
        toast.error('Failed to log follow-up record');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error logging follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // Get selected loan specific history (sorted)
  const selectedLoanHistory = useMemo(() => {
    if (!selectedLoan) return [];
    return followUps
      .filter(f => f.loan_id === selectedLoan.id)
      .sort((a, b) => new Date(b.followed_up_at).getTime() - new Date(a.followed_up_at).getTime());
  }, [selectedLoan, followUps]);

  return (
    <div className="flex flex-col gap-2 w-full max-w-[100%] mx-auto px-4 pt-3 pb-4 print:p-0 select-none">
      
      {/* ── ROW 1: Header ───────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-[15px] font-black uppercase text-slate-900 tracking-wide leading-none">Collection Follow-up Dashboard</h1>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Active overdue callbacks, next scheduled actions &amp; staff accountability</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 text-[12px] font-bold uppercase shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1329] text-white rounded-lg hover:bg-slate-800 text-[12px] font-bold uppercase shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Landscape
          </button>
        </div>
      </div>

      {/* ── ROW 2: Filters + KPI Status Counts (single horizontal bar) ───────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2.5 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          
          {/* Follow-up View Select */}
          <div className="flex flex-col min-w-[170px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Follow-up View</label>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as FollowUpTab)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 uppercase bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer h-[34px]"
            >
              <option value="ACTIVE_QUEUE">Active Due Queue</option>
              <option value="TODAYS">Today's Schedules</option>
              <option value="MISSED">Missed Schedules</option>
              <option value="UPCOMING">Upcoming Schedules</option>
              <option value="HISTORY">Staff Callback Reports</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex flex-col flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Search Account / Customer</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. CD100, NARSIMULU"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-slate-800 font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]"
              />
            </div>
          </div>

          {/* Loan Type */}
          <div className="flex flex-col min-w-[135px]">
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

          {/* Conditional Date & Staff filters for History report */}
          {activeTab === 'HISTORY' && (
            <>
              {/* Staff Member */}
              <div className="flex flex-col min-w-[140px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Staff Member</label>
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 uppercase bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer h-[34px]"
                >
                  <option value="ALL STAFF">ALL STAFF</option>
                  {staffList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Follow-up Date */}
              <div className="flex flex-col min-w-[130px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Follow-up Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-[34px]"
                />
              </div>
            </>
          )}

          {/* ── KPI Metrics (right side) ───────────────────────────────────── */}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            {/* Active */}
            <div 
              onClick={() => setActiveTab('ACTIVE_QUEUE')}
              className={`cursor-pointer px-3 py-1 flex flex-col justify-center text-center rounded-lg border transition-all min-w-[85px] h-[38px] ${
                activeTab === 'ACTIVE_QUEUE' 
                  ? 'bg-[#0b1329] text-white border-[#0b1329] shadow-sm' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${activeTab === 'ACTIVE_QUEUE' ? 'text-slate-300' : 'text-slate-500'}`}>Active</span>
              <span className="text-[16px] font-black font-mono mt-0.5 leading-none">{categorizedLoans.ACTIVE_QUEUE.length}</span>
            </div>

            {/* Today */}
            <div 
              onClick={() => setActiveTab('TODAYS')}
              className={`cursor-pointer px-3 py-1 flex flex-col justify-center text-center rounded-lg border transition-all min-w-[85px] h-[38px] ${
                activeTab === 'TODAYS' 
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${activeTab === 'TODAYS' ? 'text-emerald-200' : 'text-slate-500'}`}>Today</span>
              <span className="text-[16px] font-black font-mono mt-0.5 leading-none">{categorizedLoans.TODAYS.length}</span>
            </div>

            {/* Missed */}
            <div 
              onClick={() => setActiveTab('MISSED')}
              className={`cursor-pointer px-3 py-1 flex flex-col justify-center text-center rounded-lg border transition-all min-w-[85px] h-[38px] ${
                activeTab === 'MISSED' 
                  ? 'bg-rose-700 text-white border-rose-700 shadow-sm' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${activeTab === 'MISSED' ? 'text-rose-200' : 'text-slate-500'}`}>Missed</span>
              <span className="text-[16px] font-black font-mono mt-0.5 leading-none">{categorizedLoans.MISSED.length}</span>
            </div>

            {/* Upcoming */}
            <div 
              onClick={() => setActiveTab('UPCOMING')}
              className={`cursor-pointer px-3 py-1 flex flex-col justify-center text-center rounded-lg border transition-all min-w-[85px] h-[38px] ${
                activeTab === 'UPCOMING' 
                  ? 'bg-blue-650 text-white border-blue-650 shadow-sm' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${activeTab === 'UPCOMING' ? 'text-blue-200' : 'text-slate-500'}`}>Upcoming</span>
              <span className="text-[16px] font-black font-mono mt-0.5 leading-none">{categorizedLoans.UPCOMING.length}</span>
            </div>
          </div>{/* end KPI bar */}
        </div>{/* end filter flex row */}
      </div>{/* end filter card container */}

        {/* ── ROW 3: Follow-up Queue / History Table ──────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden print:hidden">
        {/* Compact section header */}
        <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[12px] font-black uppercase text-slate-700 tracking-wide">
            {activeTab === 'HISTORY' ? 'Staff Callbacks History Report' : `${activeTab.replace('_', ' ')} list`}
          </span>
          <span className="text-[12px] text-slate-500 font-extrabold uppercase">
            {activeTab === 'HISTORY' ? filteredHistory.length : filteredList.length} records
          </span>
        </div>

        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 210px)' }}>
          {activeTab === 'HISTORY' ? (
            // HISTORY / REPORT LIST
            !loading && filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-[200px]">
                <span className="text-[13px] font-black uppercase text-slate-400 tracking-wide">NO CALLBACK RECORDS FOUND</span>
                <p className="text-[11px] text-slate-450 uppercase mt-1">There are currently no staff callback reports to display.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-150 finance-caption">
                 <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                  <tr className="bg-slate-50">
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-center bg-slate-50 finance-small-label">Sl</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Loan No</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Party Name</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Follow Date</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Staff</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Contacted</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-center bg-slate-50 finance-small-label">Result</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Narration</th>
                    <th className="px-2 py-2 text-slate-800 text-left bg-slate-50 finance-small-label">Next Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono text-sm">
                  {loading && Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-6 mx-auto"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-20 mx-auto"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                      <td className="p-2"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    </tr>
                  ))}
                  {!loading && filteredHistory.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/40">
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-500 font-sans text-center text-sm font-semibold">{idx + 1}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 font-bold text-blue-650 text-sm whitespace-nowrap">{item.loan?.loan_id || '—'}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-900 font-sans font-bold text-sm">{item.loan?.customer?.name || 'N/A'}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-660 font-sans whitespace-nowrap text-sm font-semibold">{item.follow_up_date.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-700 font-sans font-bold text-sm">{item.followed_up_by}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-655 font-sans text-sm font-semibold whitespace-nowrap">{item.contacted_person}</td>
                      <td className={`px-2 py-1.5 border-r border-slate-100 font-sans font-extrabold text-sm text-center whitespace-nowrap ${item.result === 'PROMISED_PAYMENT' ? 'text-green-700' : item.result === 'NO_ANSWER' ? 'text-red-655' : 'text-slate-700'}`}>
                        {item.result.replace('_', ' ')}
                      </td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-700 font-sans leading-relaxed text-sm font-semibold" title={item.narration}>{item.narration}</td>
                      <td className="px-2 py-1.5 text-blue-650 font-sans font-bold whitespace-nowrap text-sm">
                        {item.next_follow_up_date ? item.next_follow_up_date.split('-').reverse().join('/') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            // ACTIVE & SCHEDULED QUEUES
            !loading && filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-[200px]">
                <span className="text-[13px] font-black uppercase text-slate-400 tracking-wide">NO ACTIVE DUE ACCOUNTS</span>
                <p className="text-[11px] text-slate-450 uppercase mt-1">There are currently no accounts requiring follow-up.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-150 text-base finance-caption">
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                  <tr className="bg-slate-50">
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-center bg-slate-50 finance-small-label">Sl</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Loan No</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Party Name</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-right bg-slate-50 finance-small-label">Present Due</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-center bg-slate-50 finance-small-label">Due Days</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Due Date</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Phones (B / G1 / G2)</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-slate-800 text-left bg-slate-50 finance-small-label">Latest Callback Summary</th>
                    <th className="px-2 py-2 text-slate-800 text-center bg-slate-50 finance-small-label">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono text-sm">
                  {loading && Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-6 mx-auto"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-16 font-bold"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-10 mx-auto"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                      <td className="p-2 border-r border-slate-100"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                      <td className="p-2"><div className="h-8 bg-slate-200 rounded w-full"></div></td>
                    </tr>
                  ))}
                  {!loading && filteredList.map((due, idx) => (
                    <tr key={due.id} className="hover:bg-slate-50/40">
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-500 font-sans text-center text-sm font-semibold">{idx + 1}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 font-bold text-blue-655 text-sm whitespace-nowrap">{due.loanId}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-905 font-sans font-bold text-sm">{due.customerName}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-right text-slate-950 font-sans text-sm font-black whitespace-nowrap">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-center text-red-655 text-sm font-bold whitespace-nowrap">{due.dueDays}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-600 font-sans whitespace-nowrap text-sm font-semibold">{due.currentDueDate.split('-').reverse().join('/')}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100 font-sans text-sm text-slate-600 space-y-0.5 whitespace-normal">
                        <div><span className="font-bold text-slate-900">B:</span> {due.phone || '—'}</div>
                        {due.g1Phone && (
                          <div><span className="font-bold text-slate-900">G1:</span> {due.g1Name} ({due.g1Phone})</div>
                        )}
                        {due.g2Phone && (
                          <div><span className="font-bold text-slate-900">G2:</span> {due.g2Name} ({due.g2Phone})</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 border-r border-slate-100 text-slate-700 font-sans text-sm leading-relaxed whitespace-normal">
                        {due.lastFollowUp ? (
                          <div>
                            <div className="text-[11px] text-slate-400 font-bold mb-0.5 flex gap-1 items-center font-sans">
                              <span>{due.lastFollowUp.follow_up_date.split('-').reverse().join('/')}</span>
                              <span>•</span>
                              <span>{due.lastFollowUp.followed_up_by}</span>
                              <span>•</span>
                              <span className="text-indigo-650 font-extrabold">{due.lastFollowUp.result}</span>
                            </div>
                            <div className="font-semibold text-slate-800 text-sm leading-snug" title={due.lastFollowUp.narration}>
                              {due.lastFollowUp.narration}
                            </div>
                          </div>
                        ) : (
                          <span className="italic text-gray-400 text-sm">No callbacks logged</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => handleOpenFollowUpModal(due)}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 rounded border border-indigo-200 transition-colors font-sans font-extrabold text-[13px] uppercase inline-flex items-center justify-center gap-1.5 min-h-[30px] w-full whitespace-nowrap"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          LOG CALL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* RECORD FOLLOW-UP MODAL */}
      {showModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-150 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0b1329] text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Log Call Action / Follow-up</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                  Account: {selectedLoan.loanId} — Borrower: {selectedLoan.customerName}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-450 hover:text-white transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
              
              {/* Account Quick Metrics Summary */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-450 uppercase font-black">Present Dues</span>
                  <span className="text-sm font-black text-red-655 mt-0.5 font-mono">₹{Math.round(selectedLoan.presentDue).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-450 uppercase font-black">Days Overdue</span>
                  <span className="text-sm font-black text-red-655 mt-0.5 font-mono">{selectedLoan.dueDays} Days</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-450 uppercase font-black">Principal Balance</span>
                  <span className="text-sm font-black text-slate-900 mt-0.5 font-mono">₹{Math.round(selectedLoan.currentPrincipal).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Call Details / History Tracker per Loan */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 border-b pb-1 mb-2">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  Callback History for {selectedLoan.loanId}
                </span>
                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {selectedLoanHistory.length === 0 ? (
                    <p className="text-slate-400 italic text-sm py-2">No previous callbacks logged for this loan.</p>
                  ) : (
                    selectedLoanHistory.map((h) => (
                      <div key={h.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-155 leading-relaxed text-sm">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-1 font-sans">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {h.followed_up_by}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {h.follow_up_date.split('-').reverse().join('/')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase rounded border border-indigo-200">
                            {h.contacted_person}
                          </span>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-black uppercase rounded border border-green-200">
                            {h.result.replace('_', ' ')}
                          </span>
                          {h.next_follow_up_date && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black uppercase rounded border border-blue-200 font-mono">
                              Next: {h.next_follow_up_date.split('-').reverse().join('/')}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 font-sans">{h.narration}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Callback Form Form Entry */}
              <form onSubmit={handleSaveFollowUp} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Contacted Person */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-450 block mb-1">Contacted Person</span>
                    <select
                      value={contactedPerson}
                      onChange={(e) => setContactedPerson(e.target.value as any)}
                      className="w-full text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-sm uppercase"
                    >
                      <option value="CUSTOMER">Customer (Borrower)</option>
                      <option value="GUARANTOR_1">Guarantor 1</option>
                      <option value="GUARANTOR_2">Guarantor 2</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  {/* Result */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-455 block mb-1">Call Result</span>
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value as any)}
                      className="w-full text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-sm uppercase"
                    >
                      <option value="ANSWERED">Answered</option>
                      <option value="NO_ANSWER">No Answer</option>
                      <option value="PROMISED_PAYMENT">Promised Payment</option>
                      <option value="CALL_BACK_LATER">Call Back Later</option>
                      <option value="GUARANTOR_CONTACTED">Guarantor Contacted</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                </div>

                {/* Narration */}
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-450 block mb-1">Call Summary / Details</span>
                  <textarea
                    rows={3}
                    placeholder="e.g. Customer promised to pay ₹12,000 on Saturday morning."
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-800 leading-relaxed"
                  />
                </div>

                {/* Next Follow Up Date & Quick Helpers */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-450 block">Schedule Next Follow-up</span>
                    <span className="text-[9px] text-indigo-600 font-extrabold uppercase">Optional Callback Reminder</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      min={getLocalBusinessDateISO()}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="text-slate-900 border border-slate-200 rounded-lg p-2 focus:ring-slate-900 bg-white font-bold text-sm uppercase h-10 w-44"
                    />

                    {/* Quick Selector Helpers */}
                    <div className="flex items-center gap-1.5 flex-1">
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(1)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        Tomorrow
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(3)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        +3 Days
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(5)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        +5 Days
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleSetQuickDate(7)}
                        className="h-10 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black text-[9px] uppercase rounded transition-colors"
                      >
                        +7 Days
                      </button>
                      {nextFollowUpDate && (
                        <button 
                          type="button"
                          onClick={() => setNextFollowUpDate('')}
                          className="h-10 px-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-black text-[9px] uppercase rounded transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-2.5 pt-3 border-t">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-[12px] font-bold uppercase rounded-lg shadow-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="px-3 py-1.5 bg-[#0b1329] hover:bg-slate-800 text-white text-[12px] font-bold uppercase rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    {submitting ? 'Saving...' : 'Save Callback'}
                  </button>
                </div>

              </form>

            </div>

          </div>
        </div>
      )}

      {/* PRINT PREVIEW LANDSCAPE */}
      <FinancePrintPreview
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Collection Dues Callbacks Report"
        documentTitle={`FOLLOWUPS_LIST_${activeTab}_${loanTypeFilter}`}
        orientation="landscape"
      >
        {!loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-900 pb-2">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900">Thirumala Group Finance</h2>
                <p className="text-[13px] uppercase text-slate-500">Collection Dues Follow-up Report ({activeTab.replace('_', ' ')} - {loanTypeFilter})</p>
              </div>
              <div className="text-right text-[13px] text-slate-600">
                <p>Report Date: {new Date().toLocaleDateString('en-IN')}</p>
                <p>Printed By: {user?.username || 'Staff'}</p>
              </div>
            </div>

            {activeTab === 'HISTORY' ? (
              <table className="w-full border-collapse" style={{ tableLayout: 'auto', fontSize: '10pt' }}>
                <colgroup>
                  {/* Sl  Loan  Name  FollowDate  Staff  Contacted  Result  Narration  NextDate */}
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '36%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-slate-850 bg-slate-100">
                    <th className="p-1 border text-center font-bold print-nowrap">Sl No</th>
                    <th className="p-1 border font-bold print-nowrap">Loan No</th>
                    <th className="p-1 border font-bold print-wrap">Party Name</th>
                    <th className="p-1 border font-bold print-nowrap">Follow Date</th>
                    <th className="p-1 border font-bold print-wrap">Staff Member</th>
                    <th className="p-1 border font-bold print-nowrap">Contacted</th>
                    <th className="p-1 border font-bold print-nowrap">Call Result</th>
                    <th className="p-1 border font-bold print-wrap">Narration / Conversation</th>
                    <th className="p-1 border font-bold print-nowrap">Next Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item, idx) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-1 border text-center print-nowrap">{idx + 1}</td>
                      <td className="p-1 border font-bold text-blue-850 print-nowrap">{item.loan?.loan_id || '—'}</td>
                      <td className="p-1 border font-bold print-wrap">{item.loan?.customer?.name || 'N/A'}</td>
                      <td className="p-1 border print-nowrap">{item.follow_up_date.split('-').reverse().join('/')}</td>
                      <td className="p-1 border font-bold print-wrap">{item.followed_up_by}</td>
                      <td className="p-1 border print-nowrap">{item.contacted_person}</td>
                      <td className="p-1 border font-bold text-indigo-700 print-nowrap">{item.result.replace('_', ' ')}</td>
                      <td className="p-1 border print-wrap">{item.narration}</td>
                      <td className="p-1 border font-bold print-nowrap">{item.next_follow_up_date ? item.next_follow_up_date.split('-').reverse().join('/') : '—'}</td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center p-4 italic text-slate-400">No callbacks recorded for current filters</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse" style={{ tableLayout: 'auto', fontSize: '10pt' }}>
                <colgroup>
                  {/* Sl  Loan  Name  Due  Days  DueDate  Phone  G1G2  LastCall  NextCall */}
                  <col style={{ width: '3%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '29%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-slate-850 bg-slate-100">
                    <th className="p-1 border text-center font-bold print-nowrap">Sl No</th>
                    <th className="p-1 border font-bold print-nowrap">Loan No</th>
                    <th className="p-1 border font-bold print-wrap">Party Name</th>
                    <th className="p-1 border text-right font-bold print-nowrap">Present Due</th>
                    <th className="p-1 border text-center font-bold print-nowrap">Days</th>
                    <th className="p-1 border font-bold print-nowrap">Due Date</th>
                    <th className="p-1 border font-bold print-nowrap">Borrower Phone</th>
                    <th className="p-1 border font-bold print-wrap">Guarantor Phones (G1 / G2)</th>
                    <th className="p-1 border font-bold print-wrap">Last Callback Summary</th>
                    <th className="p-1 border font-bold print-nowrap">Next Call</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((due, idx) => (
                    <tr key={due.id} className="border-b">
                      <td className="p-1 border text-center print-nowrap">{idx + 1}</td>
                      <td className="p-1 border font-bold text-blue-855 print-nowrap">{due.loanId}</td>
                      <td className="p-1 border font-bold print-wrap">{due.customerName}</td>
                      <td className="p-1 border text-right text-red-700 font-bold print-amount">₹{Math.round(due.presentDue).toLocaleString('en-IN')}</td>
                      <td className="p-1 border text-center font-bold print-nowrap">{due.dueDays}</td>
                      <td className="p-1 border print-nowrap">{due.currentDueDate.split('-').reverse().join('/')}</td>
                      <td className="p-1 border font-bold print-nowrap">{due.phone || '—'}</td>
                      <td className="p-1 border leading-tight print-wrap">
                        {due.g1Phone && <div>G1: {due.g1Name} ({due.g1Phone})</div>}
                        {due.g2Phone && <div>G2: {due.g2Name} ({due.g2Phone})</div>}
                      </td>
                      <td className="p-1 border print-wrap">
                        {due.lastFollowUp ? `[${due.lastFollowUp.follow_up_date.split('-').reverse().join('/')} - ${due.lastFollowUp.followed_up_by}] ${due.lastFollowUp.result}: ${due.lastFollowUp.narration}` : 'No previous log'}
                      </td>
                      <td className="p-1 border font-bold text-indigo-700 print-nowrap">
                        {due.nextFollowUpDate ? due.nextFollowUpDate.split('-').reverse().join('/') : '—'}
                      </td>
                    </tr>
                  ))}
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center p-4 italic text-slate-400">No outstanding queue accounts to display</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </FinancePrintPreview>

    </div>
  );
};

export default PaymentFollowUp;
