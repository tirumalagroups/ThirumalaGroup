import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState } from 'react';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { Printer, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { useNavigate } from 'react-router-dom';

interface PartnerBusinessTotal {
  partnerId: string;
  partnerName: string;
  loanCount: number;
  actualLoan: number;
  actualPaid: number;
  actualBalance: number;
  totalLoan: number;
  totalPaid: number;
  totalBalance: number;
}

interface PartnerBusinessRow {
  id: string;
  date: string;
  customerName: string;
  loanNo: string;
  loanType: string;
  loanAmount: number;
  paid: number;
  balance: number;
  status: string;
}

interface PartnerOutstandingRow {
  id: string;
  customerName: string;
  loanNo: string;
  dueDate: string;
  principal: number;
  interest: number;
  penalty: number;
  totalDue: number;
  status: string;
}

const startOfDay = (d: string | Date | number) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const BusinessReport: React.FC = () => {
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => getLocalBusinessDateISO());
  
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');

  // Metrics
  const [mdSummary, setMdSummary] = useState({
    actualLoan: 0,
    actualPaid: 0,
    actualBalance: 0,
    totalLoan: 0,
    totalPaid: 0,
    totalBalance: 0
  });

  const [totalBusiness, setTotalBusiness] = useState<PartnerBusinessTotal[]>([]);
  const [partnerBusiness, setPartnerBusiness] = useState<PartnerBusinessRow[]>([]);
  const [partnerOutstanding, setPartnerOutstanding] = useState<PartnerOutstandingRow[]>([]);
  const [ledgerSettings, setLedgerSettings] = useState<any>({});

  useEffect(() => {
    fetchBusinessData();
  }, [startDate, endDate]);

  const fetchBusinessData = async () => {
    setLoading(true);
    try {
      const [fetchedPartners, loans, txs, ledgerSettings] = await Promise.all([
        supabaseFinance.getPartners(),
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions(),
        financeLedgerSettingsService.getAllLedgerSettings()
      ]);

      setPartners(fetchedPartners);
      setLedgerSettings(ledgerSettings);

      // Fetch specific dues
      const { data: rawDues } = await supabase
        .from('finance_dues')
        .select(`*, finance_loans(*, customer:finance_customers!customer_id(*))`)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      const dues = rawDues || [];
      const loansInDateRange = loans.filter(l => l.date >= startDate && l.date <= endDate);

      // 1. Calculate MD Summary & Total Business Table
      const pTotalsMap = new Map<string, PartnerBusinessTotal>();

      fetchedPartners.forEach(p => {
        pTotalsMap.set(p.name, {
          partnerId: p.id,
          partnerName: p.name,
          loanCount: 0,
          actualLoan: 0,
          actualPaid: 0,
          actualBalance: 0,
          totalLoan: 0,
          totalPaid: 0,
          totalBalance: 0
        });
      });

      loansInDateRange.forEach(loan => {
        const pName = loan.customer?.partner_name || '';
        if (pTotalsMap.has(pName)) {
          const pt = pTotalsMap.get(pName)!;
          
          const principal = Number(loan.amount);
          const interest = (principal * (Number(loan.interest_rate) / 100) * Number(loan.duration_months));
          
          const loanTxs = txs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
          const paid = loanTxs.reduce((sum, t) => sum + Number(t.amount), 0);

          pt.loanCount++;
          pt.actualLoan += principal;
          pt.totalLoan += (principal + interest);
          pt.actualPaid += paid;
          pt.totalPaid += paid;
          pt.actualBalance += Math.max(0, principal - paid);
          pt.totalBalance += Math.max(0, (principal + interest) - paid);
        }
      });

      const allTotals = Array.from(pTotalsMap.values());
      setTotalBusiness(allTotals);

      updateDependentViews(allTotals, loansInDateRange, txs, dues, 'ALL');

    } catch (err) {
      console.error(err);
      toast.error('Failed to load business details');
    } finally {
      setLoading(false);
    }
  };

  const updateDependentViews = (totalsList: PartnerBusinessTotal[], rangeLoans: any[], allTxs: any[], rawDues: any[], pId: string) => {
    const filteredTotals = pId === 'ALL' ? totalsList : totalsList.filter(t => t.partnerId === pId);
    
    const newMd = {
      actualLoan: filteredTotals.reduce((s, t) => s + t.actualLoan, 0),
      actualPaid: filteredTotals.reduce((s, t) => s + t.actualPaid, 0),
      actualBalance: filteredTotals.reduce((s, t) => s + t.actualBalance, 0),
      totalLoan: filteredTotals.reduce((s, t) => s + t.totalLoan, 0),
      totalPaid: filteredTotals.reduce((s, t) => s + t.totalPaid, 0),
      totalBalance: filteredTotals.reduce((s, t) => s + t.totalBalance, 0),
    };
    setMdSummary(newMd);

    const pbList: PartnerBusinessRow[] = [];
    const targetPartnerName = pId === 'ALL' ? '' : totalsList.find(t => t.partnerId === pId)?.partnerName;
    const validLoans = pId === 'ALL' ? rangeLoans : rangeLoans.filter(l => l.customer?.partner_name === targetPartnerName);
    
    validLoans.forEach(loan => {
      const principal = Number(loan.amount);
      const loanTxs = allTxs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
      const paid = loanTxs.reduce((sum, t) => sum + Number(t.amount), 0);

      pbList.push({
        id: loan.id,
        date: loan.date,
        customerName: loan.customer?.name || 'Unknown',
        loanNo: loan.loan_id,
        loanType: loan.loan_type,
        loanAmount: principal,
        paid: paid,
        balance: Math.max(0, principal - paid),
        status: loan.status
      });
    });
    setPartnerBusiness(pbList);

    const outList: PartnerOutstandingRow[] = [];
    const validDues = pId === 'ALL' 
      ? rawDues 
      : rawDues.filter(d => d.finance_loans?.customer?.partner_name === targetPartnerName);

    const today = new Date();
    validDues.forEach(due => {
      if (due.status === 'Pending' || due.status === 'Partially Paid') {
        let principal = 0;
        let interest = 0;
        const loan = due.finance_loans;
        if (loan) {
          const totalPrincipal = Number(loan.amount) || 0;
          const durationMonths = Number(loan.duration_months) || 12;
          const interestRate = Number(loan.interest_rate) || 3;
          
          const totalInterest = totalPrincipal * (interestRate / 100) * durationMonths;
          
          const totalLoanRepayable = totalPrincipal + totalInterest;
          const interestRatio = totalLoanRepayable > 0 ? totalInterest / totalLoanRepayable : 0;
          
          const dueAmt = Number(due.amount) || 0;
          interest = dueAmt * interestRatio;
          principal = dueAmt * (1 - interestRatio);
        }
        
        const dueAmt = Number(due.amount) || 0;
        const duePaid = Number(due.paid_amount) || 0;
        const duePending = dueAmt - duePaid;

        const todayMs = startOfDay(today);
        const dueMs = startOfDay(due.due_date);
        const overdueDays = todayMs > dueMs ? Math.round((todayMs - dueMs) / (1000 * 60 * 60 * 24)) : 0;
        let penalty = Number(due.penalty_amount) || 0;

        if (duePending > 0 && overdueDays > 0) {
           const cat = due.finance_loans?.loan_category?.trim().toUpperCase() || 'CD';
           const setting = ledgerSettings[cat] || ledgerSettings['CD'];
           if (setting && overdueDays > 5) {
              const calcPenalty = (duePending * (setting.overdue / 100) * overdueDays) / (setting.days_per_year / 12);
              penalty = calcPenalty > penalty ? Math.round(calcPenalty) : penalty;
           }
        }
        
        const totalDue = duePending + penalty;

        outList.push({
          id: due.id,
          customerName: due.finance_loans?.customer?.name || 'Unknown',
          loanNo: due.finance_loans?.loan_id || '-',
          dueDate: due.due_date,
          principal: principal,
          interest: interest,
          penalty: penalty,
          totalDue: Math.max(0, totalDue),
          status: due.status
        });
      }
    });

    // Sort dues by due date
    outList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setPartnerOutstanding(outList);
  };

  const handlePartnerSelect = (pId: string) => {
    setSelectedPartnerId(pId);
    
    // We need to re-filter everything. But we already have totalBusiness.
    // To properly re-filter PartnerBusiness and Outstanding without re-fetching,
    // we would need loans and dues in state. 
    // For a reliable UI flow, re-fetching is safest when the dataset is complex, but to avoid 
    // network calls let's fetch again cleanly. It's fast.
    fetchBusinessDataForSelect(pId);
  };

  const fetchBusinessDataForSelect = async (pId: string) => {
    setLoading(true);
    try {
      const [loans, txs] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions()
      ]);

      const { data: rawDues } = await supabase
        .from('finance_dues')
        .select(`*, finance_loans(*, customer:finance_customers!customer_id(*))`)
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      const loansInDateRange = loans.filter(l => l.date >= startDate && l.date <= endDate);
      updateDependentViews(totalBusiness, loansInDateRange, txs, rawDues || [], pId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update views');
    } finally {
      setLoading(false);
    }
  };

  const selectedPartnerName = selectedPartnerId === 'ALL' 
    ? 'All Partners' 
    : partners.find(p => p.id === selectedPartnerId)?.name || 'Unknown';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto print:hidden">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-h1">Business Details</h1>
          <p className="finance-small-label uppercase">
            Partner-wise & MD Business, Outstanding, and Disbursal Activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(-1)} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 finance-header-time uppercase">
            Back
          </Button>
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer} className="bg-[#0b1329] hover:bg-slate-800 text-white finance-header-time uppercase">
            Print
          </Button>
        </div>
      </div>

      {/* Top Filter Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer finance-sidebar-link uppercase"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center bg-slate-50">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">Partners</label>
          <span className="text-slate-900 finance-h1">{partners.length} Total</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-col justify-center">
          <label className="text-slate-400 mb-1 finance-small-label uppercase">Selected</label>
          <span className="text-[#0b1329] truncate finance-h1">{selectedPartnerName}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar: Partners */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-slate-900 finance-sidebar-link uppercase">Partners</h2>
                <p className="text-slate-500 mt-1 finance-small-label uppercase">{partners.length} Total</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto">
              <button
                onClick={() => handlePartnerSelect('ALL')}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${ selectedPartnerId === 'ALL' ? 'bg-[#0b1329] text-white' : 'bg-white text-slate-700 hover:bg-slate-50' } finance-sidebar-link uppercase`}
              >
                All Partners
              </button>
              {partners.length === 0 ? (
                <div className="p-6 text-center text-slate-400 finance-header-time uppercase">
                  No Partners
                </div>
              ) : (
                partners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePartnerSelect(p.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${ selectedPartnerId === p.id ? 'bg-[#0b1329] text-white' : 'bg-white text-slate-700 hover:bg-slate-50' } finance-sidebar-link uppercase`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 space-y-6 min-w-0">
          
          {/* MD Summary */}
          <div>
            <div className="mb-3">
              <h2 className="text-slate-900 finance-sidebar-link uppercase">MD Summary</h2>
              <p className="text-slate-500 mt-1 finance-small-label uppercase">Master Business Overview</p>
            </div>
            {loading ? (
              <div className="flex justify-center items-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-slate-400 block mb-1 finance-small-label uppercase">Actual Loan</span>
                  <span className="text-[#0b1329] finance-h1">₹{mdSummary.actualLoan.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-slate-400 block mb-1 finance-small-label uppercase">Actual Paid</span>
                  <span className="text-emerald-600 finance-h1">₹{mdSummary.actualPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-slate-400 block mb-1 finance-small-label uppercase">Actual Balance</span>
                  <span className="text-red-600 finance-h1">₹{mdSummary.actualBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-slate-400 block mb-1 finance-small-label uppercase">Total Loan</span>
                  <span className="text-[#0b1329] finance-h1">₹{mdSummary.totalLoan.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-slate-400 block mb-1 finance-small-label uppercase">Total Paid</span>
                  <span className="text-emerald-600 finance-h1">₹{mdSummary.totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center hover:border-slate-300 transition-colors">
                  <span className="text-slate-400 block mb-1 finance-small-label uppercase">Total Balance</span>
                  <span className="text-red-600 finance-h1">₹{mdSummary.totalBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Total Business Table Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-slate-900 finance-sidebar-link uppercase">Total Business</h2>
                <p className="text-slate-500 mt-1 finance-small-label uppercase">Partner-wise Totals</p>
              </div>
              <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 finance-small-label uppercase">
                {totalBusiness.length} Rows
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
              </div>
            ) : totalBusiness.length === 0 ? (
              <div className="flex justify-center items-center p-6 bg-slate-50">
                <span className="text-slate-400 border border-dashed border-slate-200 px-6 py-4 rounded-xl finance-header-time uppercase">No Business Data</span>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">S.No</th>
                      <th className="px-3 py-2 text-slate-400 min-w-[150px] finance-small-label uppercase">Partner Name</th>
                      <th className="px-3 py-2 text-slate-400 text-center finance-small-label uppercase">Count</th>
                      <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Actual Loan</th>
                      <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Actual Paid</th>
                      <th className="px-3 py-2 text-slate-400 text-right border-r border-slate-100 finance-small-label uppercase">Actual Balance</th>
                      <th className="px-3 py-2 text-slate-400 text-right bg-slate-100/50 finance-small-label uppercase">Total Loan</th>
                      <th className="px-3 py-2 text-slate-400 text-right bg-slate-100/50 finance-small-label uppercase">Total Paid</th>
                      <th className="px-3 py-2 text-slate-400 text-right bg-slate-100/50 finance-small-label uppercase">Total Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {totalBusiness.map((tb, idx) => (
                      <tr 
                        key={tb.partnerId} 
                        className={`transition-colors hover:bg-slate-50 ${selectedPartnerId === tb.partnerId ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="px-3 py-2 text-slate-500 finance-header-time">{idx + 1}</td>
                        <td className="px-3 py-2 text-slate-900 truncate max-w-[200px] finance-header-time uppercase" title={tb.partnerName}>{tb.partnerName}</td>
                        <td className="px-3 py-2 text-[#0b1329] text-center bg-slate-50/50 finance-header-time">{tb.loanCount}</td>
                        <td className="px-3 py-2 text-[#0b1329] text-right finance-header-time">₹{tb.actualLoan.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-emerald-600 text-right finance-header-time">₹{tb.actualPaid.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-red-600 text-right border-r border-slate-100 finance-header-time">₹{tb.actualBalance.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-[#0b1329] text-right bg-slate-50 finance-header-time">₹{tb.totalLoan.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-emerald-600 text-right bg-slate-50 finance-header-time">₹{tb.totalPaid.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-red-600 text-right bg-slate-50 finance-header-time">₹{tb.totalBalance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {/* Bottom Card A: Partner Business */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-slate-900 finance-sidebar-link uppercase">Partner · Business</h2>
                  <p className="text-slate-500 mt-1 finance-small-label uppercase">{partnerBusiness.length} Rows</p>
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
                </div>
              ) : partnerBusiness.length === 0 ? (
                <div className="flex justify-center items-center p-6 bg-slate-50">
                  <span className="text-slate-400 border border-dashed border-slate-200 px-6 py-4 rounded-xl finance-header-time uppercase">No Business Records</span>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Date</th>
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Customer</th>
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Loan No</th>
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Type</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Amount</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Paid</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Balance</th>
                        <th className="px-3 py-2 text-slate-400 text-center finance-small-label uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerBusiness.map((b) => (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-500 finance-header-time">{new Date(b.date).toLocaleDateString('en-GB')}</td>
                          <td className="px-3 py-2 text-slate-900 truncate max-w-[120px] finance-header-time uppercase" title={b.customerName}>{b.customerName}</td>
                          <td className="px-3 py-2 text-slate-400 finance-small-label uppercase">{b.loanNo}</td>
                          <td className="px-3 py-2 text-slate-600 finance-small-label uppercase">{b.loanType}</td>
                          <td className="px-3 py-2 text-[#0b1329] text-right finance-header-time">{b.loanAmount.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-emerald-600 text-right finance-header-time">{b.paid.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-red-600 text-right finance-header-time">{b.balance.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] border ${ b.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' : b.status === 'Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200' } finance-input uppercase`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Card B: Partner Outstanding */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-slate-900 finance-sidebar-link uppercase">Partner · Outstanding</h2>
                  <p className="text-slate-500 mt-1 finance-small-label uppercase">{partnerOutstanding.length} Rows</p>
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0b1329]"></div>
                </div>
              ) : partnerOutstanding.length === 0 ? (
                <div className="flex justify-center items-center p-6 bg-slate-50">
                  <span className="text-slate-400 border border-dashed border-slate-200 px-6 py-4 rounded-xl finance-header-time uppercase">No Outstanding Records</span>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Customer</th>
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Loan No</th>
                        <th className="px-3 py-2 text-slate-400 finance-small-label uppercase">Due Date</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Principal</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Interest</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Penalty</th>
                        <th className="px-3 py-2 text-slate-400 text-right finance-small-label uppercase">Total Due</th>
                        <th className="px-3 py-2 text-slate-400 text-center finance-small-label uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerOutstanding.map((out) => (
                        <tr key={out.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-900 truncate max-w-[120px] finance-header-time uppercase" title={out.customerName}>{out.customerName}</td>
                          <td className="px-3 py-2 text-slate-400 finance-small-label uppercase">{out.loanNo}</td>
                          <td className="px-3 py-2 text-red-600 finance-small-label">{new Date(out.dueDate).toLocaleDateString('en-GB')}</td>
                          <td className="px-3 py-2 text-slate-600 text-right finance-small-label">{out.principal.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-slate-600 text-right finance-small-label">{out.interest.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-slate-600 text-right finance-small-label">{out.penalty.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-red-600 text-right finance-header-time">₹{out.totalDue.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] border ${ out.status === 'Pending' ? 'bg-red-50 text-red-700 border-red-200' : out.status === 'Partially Paid' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200' } finance-input uppercase`}>
                              {out.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Business Details"
        documentTitle={`BUSINESS DETAILS: ${new Date(startDate).toLocaleDateString('en-GB')} TO ${new Date(endDate).toLocaleDateString('en-GB')}`}
      >
        <div className="space-y-8 pb-12">
          {/* Print Summary Metrics */}
          <div className="grid grid-cols-4 gap-4 border-b border-t border-slate-900 py-4 text-center">
            <div>
              <p className="text-slate-500 finance-small-label uppercase">From Date</p>
              <p className="text-slate-900 finance-sidebar-link">{new Date(startDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">To Date</p>
              <p className="text-slate-900 finance-sidebar-link">{new Date(endDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Partners Count</p>
              <p className="text-slate-900 finance-sidebar-link">{partners.length}</p>
            </div>
            <div>
              <p className="text-slate-500 finance-small-label uppercase">Selected</p>
              <p className="text-[#0b1329] truncate finance-sidebar-link uppercase">{selectedPartnerName}</p>
            </div>
          </div>

          <div className="border border-slate-900 bg-slate-50">
             <div className="bg-slate-100 border-b border-slate-900 px-4 py-2">
              <h4 className="text-slate-900 text-center finance-small-label uppercase">MD Summary</h4>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-300 border-b border-slate-300">
              <div className="p-2 text-center">
                <span className="text-[9px] text-slate-500 block finance-input uppercase">Actual Loan</span>
                <span className="text-slate-900 finance-header-time">₹{mdSummary.actualLoan.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] text-slate-500 block finance-input uppercase">Actual Paid</span>
                <span className="text-emerald-700 finance-header-time">₹{mdSummary.actualPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] text-slate-500 block finance-input uppercase">Actual Balance</span>
                <span className="text-red-700 finance-header-time">₹{mdSummary.actualBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-300 bg-slate-100">
              <div className="p-2 text-center">
                <span className="text-[9px] text-slate-500 block finance-input uppercase">Total Loan</span>
                <span className="text-slate-900 finance-header-time">₹{mdSummary.totalLoan.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] text-slate-500 block finance-input uppercase">Total Paid</span>
                <span className="text-emerald-700 finance-header-time">₹{mdSummary.totalPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 text-center">
                <span className="text-[9px] text-slate-500 block finance-input uppercase">Total Balance</span>
                <span className="text-red-700 finance-header-time">₹{mdSummary.totalBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Total Business Print Table */}
          <div className="border border-slate-900">
            <div className="bg-slate-100 border-b border-slate-900 px-4 py-2 flex justify-between">
              <h4 className="text-slate-900 finance-small-label uppercase">Total Business (Partner-Wise)</h4>
            </div>
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-50">
                  <th className="px-2 py-1 text-slate-800 border-r border-slate-300 finance-input">Partner</th>
                  <th className="px-2 py-1 text-slate-800 text-center border-r border-slate-300 finance-input">Loans</th>
                  <th className="px-2 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Act. Loan</th>
                  <th className="px-2 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Act. Paid</th>
                  <th className="px-2 py-1 text-slate-900 text-right border-r border-slate-300 finance-input">Act. Bal</th>
                  <th className="px-2 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Tot. Loan</th>
                  <th className="px-2 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Tot. Paid</th>
                  <th className="px-2 py-1 text-slate-900 text-right finance-input">Tot. Bal</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {totalBusiness.map((tb, idx) => (
                  <tr key={idx} className="border-b border-slate-200 last:border-0">
                    <td className="px-2 py-1 text-slate-900 border-r border-slate-200 finance-input uppercase">{tb.partnerName}</td>
                    <td className="px-2 py-1 text-center text-slate-700 border-r border-slate-200">{tb.loanCount}</td>
                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{tb.actualLoan.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tb.actualPaid.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-red-700 border-r border-slate-200 finance-input">{tb.actualBalance.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">{tb.totalLoan.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-emerald-700 border-r border-slate-200">{tb.totalPaid.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1 text-right text-red-700 finance-input">{tb.totalBalance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* Partner Business Print Table */}
             <div className="border border-slate-900">
              <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 flex justify-between">
                <h4 className="text-[9px] text-slate-900 finance-input uppercase">Business ({selectedPartnerName})</h4>
              </div>
              <table className="w-full text-left text-[8px]">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-50">
                    <th className="px-1 py-1 text-slate-800 border-r border-slate-300 finance-input">Date</th>
                    <th className="px-1 py-1 text-slate-800 border-r border-slate-300 finance-input">Cust</th>
                    <th className="px-1 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Amt</th>
                    <th className="px-1 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Paid</th>
                    <th className="px-1 py-1 text-slate-900 text-right finance-input">Bal</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {partnerBusiness.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-500 font-sans finance-input uppercase">No records</td></tr>
                  ) : (
                    partnerBusiness.map((b, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="px-1 py-1 text-slate-700 border-r border-slate-200">{new Date(b.date).toLocaleDateString('en-GB')}</td>
                        <td className="px-1 py-1 text-slate-900 border-r border-slate-200 truncate max-w-[80px] finance-input uppercase">{b.customerName}</td>
                        <td className="px-1 py-1 text-right text-slate-700 border-r border-slate-200">{b.loanAmount.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right text-emerald-700 border-r border-slate-200">{b.paid.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right text-red-700 finance-input">{b.balance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Partner Outstanding Print Table */}
            <div className="border border-slate-900">
              <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 flex justify-between">
                <h4 className="text-[9px] text-slate-900 finance-input uppercase">Outstanding ({selectedPartnerName})</h4>
              </div>
              <table className="w-full text-left text-[8px]">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-50">
                    <th className="px-1 py-1 text-slate-800 border-r border-slate-300 finance-input">Cust</th>
                    <th className="px-1 py-1 text-slate-800 border-r border-slate-300 finance-input">Due Dt</th>
                    <th className="px-1 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Prin</th>
                    <th className="px-1 py-1 text-slate-800 text-right border-r border-slate-300 finance-input">Int</th>
                    <th className="px-1 py-1 text-slate-900 text-right finance-input">Total</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {partnerOutstanding.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-500 font-sans finance-input uppercase">No records</td></tr>
                  ) : (
                    partnerOutstanding.map((out, idx) => (
                      <tr key={idx} className="border-b border-slate-200 last:border-0">
                        <td className="px-1 py-1 text-slate-900 border-r border-slate-200 truncate max-w-[80px] finance-input uppercase">{out.customerName}</td>
                        <td className="px-1 py-1 text-red-600 border-r border-slate-200">{new Date(out.dueDate).toLocaleDateString('en-GB')}</td>
                        <td className="px-1 py-1 text-right text-slate-700 border-r border-slate-200">{out.principal.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right text-slate-700 border-r border-slate-200">{out.interest.toLocaleString('en-IN')}</td>
                        <td className="px-1 py-1 text-right text-red-700 finance-input">{out.totalDue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default BusinessReport;
