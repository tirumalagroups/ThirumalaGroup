import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTableMode } from '../../contexts/TableModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseFinance } from '../../lib/supabaseFinance';


import { 
  FileText, 
  Edit, 
  Users, 
  Shield, 
  BookOpen, 
  DollarSign, 
  Search, 
  Calculator, 
  Book, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalDisbursed: number;
  loansCount: number;
  totalOutstanding: number;
  collectedToday: number;
  overdueLoansCount: number;
}

const FinanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { mode: tableMode } = useTableMode();
  const { user } = useAuth();

  useEffect(() => {
    if (tableMode !== 'finance') {
      navigate('/', { replace: true });
    }
  }, [tableMode, navigate]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalDisbursed: 0,
    loansCount: 0,
    totalOutstanding: 0,
    collectedToday: 0,
    overdueLoansCount: 0
  });
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    if (tableMode === 'finance') {
      fetchDashboardData();
    }
  }, [tableMode]);

  if (tableMode !== 'finance') {
    return null;
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [loans, txs, pendingCount] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions(),
        user?.is_admin ? supabaseFinance.getPendingApprovalsCount() : Promise.resolve(0)
      ]);
      setPendingApprovalsCount(pendingCount);

      // Get today's local date string formatted as YYYY-MM-DD
      const today = new Date();
      const offset = today.getTimezoneOffset();
      const localToday = new Date(today.getTime() - (offset * 60 * 1000));
      const todayStr = getLocalBusinessDateISO(localToday);

      // 1. Disbursed (All-time)
      const totalDisbursed = loans.reduce((sum, loan) => sum + Number(loan.amount), 0);
      const loansCount = loans.length;

      // 2. Outstanding & Overdue Loans
      let totalOutstanding = 0;
      let overdueCount = 0;

      loans.forEach(loan => {
        const principal = Number(loan.amount);
        const duration = Number(loan.duration_months);
        const interestAmount = (principal * (Number(loan.interest_rate) / 100) * duration);
        const repayable = principal + interestAmount;

        const loanCols = txs.filter(t => t.loan_id === loan.id && t.type === 'Collection');
        const loanCollected = loanCols.reduce((sum, c) => sum + Number(c.amount), 0);
        const outstanding = Math.max(0, repayable - loanCollected);

        if (loan.status === 'Active') {
          totalOutstanding += outstanding;

          // Check if expired & has outstanding balance
          const loanDate = new Date(loan.date);
          const expiryDate = new Date(loanDate);
          expiryDate.setMonth(loanDate.getMonth() + duration);

          if (today >= expiryDate && outstanding > 0) {
            overdueCount++;
          }
        }
      });

      // 3. Collected Today (collections received on today's local date)
      const collectedToday = txs
        .filter(t => t.type === 'Collection' && t.date === todayStr)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setStats({
        totalDisbursed,
        loansCount,
        totalOutstanding,
        collectedToday,
        overdueLoansCount: overdueCount
      });

      // Take 8 most recent disbursements
      setRecentLoans(loans.slice(0, 8));

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'New Loan', path: '/finance/loan-entry', icon: FileText },
    { label: 'Edit Loan', path: '/finance/edit-loan-entry', icon: Edit },
    { label: 'New Customer', path: '/finance/new-customer', icon: Users },
    { label: 'New Guarantor', path: '/finance/new-guarantor', icon: Shield },
    { label: 'Cash Book', path: '/finance/daybook', icon: BookOpen },
    { label: 'Capital', path: '/finance/capital-entry', icon: DollarSign },
    { label: 'Search', path: '/finance/search', icon: Search },
    { label: 'Calculator', path: '/finance/calculator', icon: Calculator },
    { label: 'CD Ledger', path: '/finance/cd-ledger', icon: Book },
    { label: 'HP Ledger', path: '/finance/hp-ledger', icon: Book },
    { label: 'STBD Ledger', path: '/finance/stbd-ledger', icon: Book },
    { label: 'TBD Ledger', path: '/finance/tbd-ledger', icon: Book },
  ];

  const reports = [
    { label: 'Day Book', path: '/finance/daybook', icon: BookOpen },
    { label: 'Daily Report', path: '/finance/new-customers', icon: FileText },
    { label: 'General Ledger', path: '/finance/general-ledger', icon: BookOpen },
    { label: 'Dues List', path: '/finance/dues-ledger', icon: AlertCircle },
    { label: 'Profit & Loss', path: '/finance/pl', icon: TrendingUp },
    { label: 'Final Statement', path: '/finance/final-statement', icon: FileText },
    { label: 'Business Details', path: '/finance/business-report', icon: FileText },
    { label: 'Partner Performance', path: '/finance/partner-performance', icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto select-none pb-12">
      
      {/* Dashboard Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="finance-h1">DASHBOARD</h1>
          <p className="finance-small-label uppercase">
            OVERVIEW OF TODAY'S CD LEDGER OPERATIONS
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/finance/loan-entry"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all shadow-sm finance-button uppercase"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3px]" />
            NEW LOAN
          </Link>
          <Link
            to="/finance/daybook"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-850 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm finance-header-time uppercase"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            CASH BOOK
          </Link>
        </div>
      </div>

      {/* Pending Approvals Card (Admin Only) */}
      {user?.is_admin && pendingApprovalsCount > 0 && (
        <div className="bg-[#fffbeb] border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200 shadow-inner">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-amber-800 text-sm uppercase tracking-wide">
                Transactions Pending Approval
              </h3>
              <p className="text-slate-600 text-xs mt-0.5 font-bold">
                {pendingApprovalsCount} Pending
              </p>
            </div>
          </div>
          <Link
            to="/finance/transaction-approval"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-xs font-bold uppercase transition-all shadow-sm"
          >
            Verify & Approve
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      {user?.is_admin && pendingApprovalsCount === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex justify-between items-center transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-500 rounded-xl border border-slate-200 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-700 text-sm uppercase tracking-wide">
                Transaction Approvals
              </h3>
              <p className="text-slate-400 text-xs mt-0.5 font-bold">
                All transactions approved
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TODAY AT A GLANCE section */}
      <div className="space-y-3">
        <h2 className="finance-section-heading uppercase">
          TODAY AT A GLANCE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Disbursed (All-time) */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[110px]">
            <div className="flex justify-between items-start">
              <span className="finance-card-title">
                DISBURSED (ALL-TIME)
              </span>
              <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg border border-slate-100/80">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="finance-money">
                ₹{stats.totalDisbursed.toLocaleString('en-IN')}
              </div>
              <div className="finance-caption uppercase">
                {stats.loansCount} Loans on Book
              </div>
            </div>
          </div>

          {/* Card 2: Outstanding */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[110px]">
            <div className="flex justify-between items-start">
              <span className="finance-card-title">
                OUTSTANDING
              </span>
              <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg border border-rose-100/50">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="!text-rose-600 finance-money">
                ₹{stats.totalOutstanding.toLocaleString('en-IN')}
              </div>
              <div className="finance-caption uppercase">
                PRINCIPAL + ACCRUED INTEREST
              </div>
            </div>
          </div>

          {/* Card 3: Collected Today */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[110px]">
            <div className="flex justify-between items-start">
              <span className="finance-card-title">
                COLLECTED TODAY
              </span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/50">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="!text-emerald-600 finance-money">
                ₹{stats.collectedToday.toLocaleString('en-IN')}
              </div>
              <div className="finance-caption uppercase">
                DEBIT SIDE OF CASHBOOK
              </div>
            </div>
          </div>

          {/* Card 4: Overdue Loans */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[110px]">
            <div className="flex justify-between items-start">
              <span className="finance-card-title">
                OVERDUE LOANS
              </span>
              <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg border border-amber-100/50">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="!text-amber-600 finance-money">
                {stats.overdueLoansCount}
              </div>
              <div className="finance-caption uppercase">
                PAST DUE DATE
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* QUICK ACTIONS section */}
      <div className="space-y-3">
        <h2 className="finance-section-heading uppercase">
          QUICK ACTIONS
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {quickActions.map((action, idx) => {
            const IconComponent = action.icon;
            return (
              <Link
                key={idx}
                to={action.path}
                className="bg-white border border-slate-150 rounded-xl p-4 shadow-sm hover:border-slate-350 hover:shadow hover:-translate-y-0.5 transition-all group flex flex-col items-start"
              >
                <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/50 text-slate-800 group-hover:bg-slate-100 transition-colors">
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className="finance-input uppercase">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* RECENT LOANS & REPORTS side-by-side grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Loans */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-end border-b border-slate-100 pb-2">
            <div>
              <h2 className="finance-section-heading uppercase">
                RECENT LOANS
              </h2>
              <p className="text-[9px] text-slate-400 mt-0.5 finance-input uppercase">
                MOST RECENT 8 DISBURSALS
              </p>
            </div>
            <Link
              to="/finance/search"
              className="finance-button uppercase"
            >
              VIEW ALL &rarr;
            </Link>
          </div>

          {recentLoans.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center mt-3 min-h-[310px] bg-white">
              <div className="text-slate-850 tracking-[0.16px] finance-brand">
                No loans yet
              </div>
              <div className="text-slate-500 mt-1 mb-6 finance-sidebar-link">
                Start by creating your first loan entry.
              </div>
              <Link
                to="/finance/loan-entry"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm tracking-[0.16px] finance-input"
              >
                <Plus className="w-4 h-4" />
                Create loan
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-sm mt-3">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-150 finance-caption">
                  <thead>
                    <tr className="bg-slate-50/75 text-slate-500 text-[9px] finance-input uppercase">
                      <th className="finance-small-label uppercase">Loan ID</th>
                      <th className="finance-small-label uppercase">Customer Name</th>
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Category</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 finance-input">
                    {recentLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-900 finance-input">
                          {loan.loan_id}
                        </td>
                        <td className="px-4 py-3 text-slate-900 finance-input">
                          {loan.customer?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 finance-input">
                          {new Date(loan.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 finance-input">
                          ₹{Number(loan.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 finance-input">
                          {loan.loan_category?.trim().toUpperCase() || 'CD'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] ${ loan.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-50 text-slate-500 border border-slate-200' } finance-input uppercase`}
                          >
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Reports */}
        <div className="space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="finance-section-heading uppercase">
              REPORTS
            </h2>
            <p className="text-[9px] text-slate-400 mt-0.5 finance-input uppercase">
              PRINTABLE STATEMENTS
            </p>
          </div>

          <div className="bg-white border border-slate-150 rounded-xl p-3 shadow-sm mt-3 divide-y divide-slate-100">
            {reports.map((report, idx) => {
              const IconComponent = report.icon;
              return (
                <Link
                  key={idx}
                  to={report.path}
                  className="flex items-center justify-between py-3.5 px-3 hover:bg-slate-50 transition-all rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                    <span className="text-slate-700 group-hover:text-slate-900 transition-colors tracking-[0.16px] finance-header-time uppercase">
                      {report.label}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-350 group-hover:text-slate-650 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};

export default FinanceDashboard;
