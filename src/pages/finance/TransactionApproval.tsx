import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseFinance, FinanceTransactionReview } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import Card from '../../components/UI/Card';
import CustomCalendar from '../../components/UI/CustomCalendar';
import { 
  Check, 
  Search, 
  RotateCcw, 
  FileCheck, 
  Loader2, 
  User, 
  Calendar, 
  AlertCircle,
  Book,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const TransactionApproval: React.FC = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<FinanceTransactionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Bulk Approval States
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set());
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Filter States
  const [statusTab, setStatusTab] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [filterDate, setFilterDate] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterLoanType, setFilterLoanType] = useState('ALL');
  const [filterAccountNo, setFilterAccountNo] = useState('');
  const [filterReceiptNo, setFilterReceiptNo] = useState('');

  // Calendar States
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingDates, setPendingDates] = useState<{ c_date: string }[]>([]);

  const fetchPendingDates = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_transaction_reviews')
        .select('transaction_date')
        .eq('review_status', 'PENDING');
      
      if (error) throw error;
      setPendingDates((data || []).map(r => ({ c_date: r.transaction_date })));
    } catch (err) {
      console.error('Error loading pending dates for calendar:', err);
    }
  };

  const fetchReviews = async () => {
    try {
      setSelectedReviewIds(new Set());
      setLoading(true);
      setQueryError(null);
      const data = await supabaseFinance.getTransactionReviews({
        status: statusTab,
        date: filterDate || undefined,
        enteredBy: filterOperator.trim() || undefined,
        loanType: filterLoanType !== 'ALL' ? filterLoanType : undefined,
        accountNo: filterAccountNo.trim() || undefined,
        receiptNo: filterReceiptNo.trim() || undefined
      });
      setReviews(data);
    } catch (err: any) {
      console.error('Error fetching transaction reviews:', err);
      setQueryError(err?.message || 'Failed to load transaction reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch reviews and pending dates on dependencies change
  useEffect(() => {
    fetchReviews();
    fetchPendingDates();
  }, [statusTab, filterDate, filterLoanType]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReviews();
  };

  const handleResetFilters = () => {
    setFilterDate('');
    setFilterOperator('');
    setFilterLoanType('ALL');
    setFilterAccountNo('');
    setFilterReceiptNo('');
    fetchReviews();
  };

  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());
  const [reviewDetails, setReviewDetails] = useState<Record<string, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  const toggleExpandReview = async (reviewId: string) => {
    const next = new Set(expandedReviewIds);
    if (next.has(reviewId)) {
      next.delete(reviewId);
    } else {
      next.add(reviewId);
      if (!reviewDetails[reviewId]) {
        setLoadingDetails(prev => ({ ...prev, [reviewId]: true }));
        try {
          const details = await supabaseFinance.getTransactionReviewDetails(reviewId);
          setReviewDetails(prev => ({ ...prev, [reviewId]: details }));
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingDetails(prev => ({ ...prev, [reviewId]: false }));
        }
      }
    }
    setExpandedReviewIds(next);
  };

  const handleApprove = async (reviewId: string) => {
    if (!user?.is_admin) {
      toast.error('Access Denied: Only administrators can approve transactions.');
      return;
    }

    if (!window.confirm('Are you sure you want to approve this transaction?')) {
      return;
    }

    try {
      setActioningId(reviewId);
      const success = await supabaseFinance.approveTransactionReview(reviewId, user.username);
      if (success) {
        toast.success('Transaction approved successfully');
        // Refresh review list and calendar pending dates
        fetchReviews();
        fetchPendingDates();
      } else {
        toast.error('Failed to approve transaction');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred during approval');
    } finally {
      setActioningId(null);
    }
  };

  const handleSelectToggle = (reviewId: string) => {
    const next = new Set(selectedReviewIds);
    if (next.has(reviewId)) {
      next.delete(reviewId);
    } else {
      next.add(reviewId);
    }
    setSelectedReviewIds(next);
  };

  const handleSelectAll = () => {
    const pendingIds = reviews.filter(r => r.review_status === 'PENDING').map(r => r.id);
    if (selectedReviewIds.size === pendingIds.length && pendingIds.length > 0) {
      setSelectedReviewIds(new Set()); // Deselect all
    } else {
      setSelectedReviewIds(new Set(pendingIds)); // Select all pending
    }
  };

  const handleBulkApproveConfirm = () => {
    if (!user?.is_admin) {
      toast.error('Access Denied: Only administrators can bulk approve transactions.');
      return;
    }
    
    const targetIds = selectedReviewIds.size > 0 
      ? Array.from(selectedReviewIds)
      : reviews.filter(r => r.review_status === 'PENDING').map(r => r.id);
      
    if (targetIds.length === 0) {
      toast.error('No pending transactions available to approve.');
      return;
    }
    
    setShowBulkConfirmModal(true);
  };

  const executeBulkApproval = async () => {
    const targetIds = selectedReviewIds.size > 0 
      ? Array.from(selectedReviewIds)
      : reviews.filter(r => r.review_status === 'PENDING').map(r => r.id);

    try {
      setIsBulkApproving(true);
      const result = await supabaseFinance.approveTransactionsBulk({
        transactionIds: targetIds,
        approvedBy: user?.username || 'System'
      });
      
      setBulkResult(result);
      fetchReviews();
      fetchPendingDates();
    } catch (err: any) {
      console.error('Bulk approval failed:', err);
      toast.error(err.message || 'Bulk approval failed unexpectedly');
    } finally {
      setIsBulkApproving(false);
      setShowBulkConfirmModal(false);
    }
  };

  const handleReject = async (reviewId: string) => {
    if (!user?.is_admin) {
      toast.error('Access Denied: Only administrators can reject transactions.');
      return;
    }

    if (!window.confirm('Are you sure you want to REJECT this transaction?')) {
      return;
    }

    try {
      setActioningId(reviewId);
      const success = await supabaseFinance.rejectTransactionReview(reviewId, user.username);
      if (success) {
        toast.success('Transaction review status marked as REJECTED');
        fetchReviews();
        fetchPendingDates();
      } else {
        toast.error('Failed to reject transaction');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred during rejection');
    } finally {
      setActioningId(null);
    }
  };

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const convertToDisplayFormat = (yyyyMMdd: string): string => {
    if (!yyyyMMdd) return '';
    const parts = yyyyMMdd.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const transactionTypes = [
    'ALL',
    'CD Renewal',
    'CD Partial Payment',
    'CD Close',
    'CD Collection',
    'HP Payment',
    'STBD Payment',
    'TBD Payment',
    'Day Book Entry'
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-outfit select-none">
           {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <span className="text-slate-500 finance-caption uppercase">ADMIN PANEL</span>
          <h1 className="mt-1 finance-h1 text-[#0f172a] flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-[#0f172a]" />
            TRANSACTION APPROVALS
          </h1>
          <p className="text-slate-400 finance-small-label uppercase mt-0.5">
            Verify and approve operator-entered financial transactions
          </p>
        </div>
      </div>

      {/* Filter and Tab Section */}
      <div className="bg-white rounded-xl border border-slate-150 shadow-sm p-5 space-y-5">
        
        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 pb-1">
          {(['PENDING', 'APPROVED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-6 py-2.5 font-bold text-sm tracking-wide uppercase transition-all relative ${
                statusTab === tab
                  ? 'text-[#0f172a] border-b-2 border-[#0f172a]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter Inputs Form */}
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* Custom Datepicker with CustomCalendar Integration */}
          <div className="relative">
            <label className="finance-caption uppercase">Date</label>
            <div className="relative">
              <input
                type="text"
                value={filterDate ? convertToDisplayFormat(filterDate) : ''}
                readOnly
                onClick={() => setShowCalendar(!showCalendar)}
                placeholder="dd/mm/yyyy"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none h-10 shadow-sm finance-header-time cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded text-gray-500"
              >
                <Calendar className="w-4 h-4" />
              </button>
              {showCalendar && (
                <CustomCalendar
                  entries={pendingDates}
                  onDateSelect={(date) => {
                    setFilterDate(date);
                    setShowCalendar(false);
                  }}
                  selectedDate={filterDate}
                  onClose={() => setShowCalendar(false)}
                  dotColor="red"
                  tooltipLabel="Pending Approvals"
                />
              )}
            </div>
          </div>

          <div>
            <label className="finance-caption uppercase">Operator</label>
            <input
              type="text"
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              placeholder="Operator name"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none h-10 shadow-sm finance-header-time placeholder-slate-300"
            />
          </div>

          <div>
            <label className="finance-caption uppercase">Tx Type</label>
            <select
              value={filterLoanType}
              onChange={(e) => setFilterLoanType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none h-10 shadow-sm finance-header-time"
            >
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="finance-caption uppercase">A/c Number</label>
            <input
              type="text"
              value={filterAccountNo}
              onChange={(e) => setFilterAccountNo(e.target.value)}
              placeholder="e.g. CD001"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none h-10 shadow-sm finance-header-time placeholder-slate-300"
            />
          </div>

          <div>
            <label className="finance-caption uppercase">Receipt / Ref No</label>
            <input
              type="text"
              value={filterReceiptNo}
              onChange={(e) => setFilterReceiptNo(e.target.value)}
              placeholder="Receipt No"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none h-10 shadow-sm finance-header-time placeholder-slate-300"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 bg-[#0f172a] text-white hover:bg-slate-800 h-10 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-1 shadow-sm transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="bg-slate-100 hover:bg-slate-250 text-slate-600 h-10 w-10 rounded-lg flex items-center justify-center transition-colors shadow-inner"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>

      {/* Bulk Action Bar (Only show on PENDING tab when there are results) */}
      {statusTab === 'PENDING' && reviews.length > 0 && !loading && !queryError && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 px-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="w-5 h-5 rounded border border-indigo-300 flex items-center justify-center bg-white text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-all"
            >
              {selectedReviewIds.size > 0 && (
                selectedReviewIds.size === reviews.filter(r => r.review_status === 'PENDING').length 
                  ? <Check className="w-3.5 h-3.5 font-bold" />
                  : <div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
              )}
            </button>
            <span className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
              {selectedReviewIds.size > 0 
                ? `${selectedReviewIds.size} Selected` 
                : `${reviews.filter(r => r.review_status === 'PENDING').length} Pending Matches`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedReviewIds.size > 0 && (
              <button
                onClick={() => setSelectedReviewIds(new Set())}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase px-3 py-1.5 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleBulkApproveConfirm}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {selectedReviewIds.size > 0 ? 'Approve Selected' : 'Approve All Matching'}
            </button>
          </div>
        </div>
      )}

      {/* Main List Table / Card */}
      <Card className="shadow-sm border-slate-150 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            <span className="text-slate-400 finance-header-time uppercase">Loading reviews...</span>
          </div>
        ) : queryError ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100 shadow-inner">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-red-800 text-lg uppercase tracking-wide">Query Error</h3>
              <p className="text-slate-500 text-sm max-w-lg mt-1 mx-auto">
                {queryError.includes('relation') && queryError.includes('does not exist')
                  ? 'The transaction reviews table does not exist in the database yet. Please run the migration file "20260705180000_create_transaction_reviews.sql" in your Supabase SQL Editor.'
                  : queryError}
              </p>
            </div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner">
              <FileCheck className="w-7 h-7 text-slate-350" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg uppercase tracking-wide">No Transactions Found</h3>
              <p className="text-slate-400 text-sm max-w-sm mt-1">
                There are no transaction records matching the current filters and approval status tab.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase finance-small-label">
                  {statusTab === 'PENDING' && <th className="px-6 py-4 text-left w-12"></th>}
                  <th className="px-6 py-4 text-left tracking-wider">Date & Ref</th>
                  <th className="px-6 py-4 text-left tracking-wider">Transaction Details</th>
                  <th className="px-6 py-4 text-left tracking-wider">Source Type</th>
                  <th className="px-6 py-4 text-right tracking-wider">Amount Breakdown</th>
                  <th className="px-6 py-4 text-left tracking-wider">Entered By</th>
                  <th className="px-6 py-4 text-center tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviews.map((item) => {
                  const hasSplits = (item.penalty_amount || 0) > 0 || (item.interest_amount || 0) > 0 || (item.principal_amount || 0) > 0;
                  const isExpanded = expandedReviewIds.has(item.id);
                  const details = reviewDetails[item.id] || [];
                  const isDetailsLoading = loadingDetails[item.id];
                  
                  const loanCategory = (item as any).finance_loans?.loan_category || '';
                  const customerName = (item as any).finance_loans?.customer?.name || 'Manual Daybook Entry';

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`transition-colors ${selectedReviewIds.has(item.id) ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                        
                        {/* Checkbox */}
                        {statusTab === 'PENDING' && (
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleSelectToggle(item.id)}
                              className="w-5 h-5 rounded border border-slate-300 flex items-center justify-center bg-white text-indigo-600 focus:outline-none transition-all hover:border-indigo-400"
                            >
                              {selectedReviewIds.has(item.id) && <Check className="w-3.5 h-3.5 font-bold" />}
                            </button>
                          </td>
                        )}

                        {/* Date & Ref */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 finance-header-time">
                            {format(new Date(item.transaction_date), 'dd MMM yyyy')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5">
                            RC: {item.receipt_number || 'N/A'}
                          </div>
                        </td>

                        {/* Transaction Details */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-850 finance-input">
                            {item.transaction_type.toUpperCase()}
                          </div>
                          <div className="text-slate-400 text-xs font-bold mt-0.5">
                            {item.loan_id ? (
                              <span className="space-x-1.5">
                                <span className="text-slate-700">{(item as any).finance_loans?.loan_id}</span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{loanCategory}</span>
                                <span className="text-slate-900 font-black">{customerName}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Daybook Account Entry</span>
                            )}
                          </div>
                        </td>

                        {/* Source Type */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.source_type === 'Loan Payment' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}>
                            {item.source_type}
                          </span>
                        </td>

                        {/* Amount Breakdown */}
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-slate-900 text-sm finance-header-time">
                            {formatCurrency(item.amount)}
                          </div>
                          {hasSplits && (
                            <div className="text-[10px] text-slate-400 font-semibold space-x-1.5 mt-0.5">
                              {item.principal_amount ? <span>P: {formatCurrency(item.principal_amount)}</span> : null}
                              {item.interest_amount ? <span>I: {formatCurrency(item.interest_amount)}</span> : null}
                              {item.penalty_amount ? <span>Pen: {formatCurrency(item.penalty_amount)}</span> : null}
                            </div>
                          )}
                        </td>

                        {/* Entered By */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-650 finance-caption">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">{item.entered_by.toUpperCase()}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {format(new Date(item.entered_at), 'hh:mm a')}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          {item.review_status === 'APPROVED' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                                <Check className="w-3.5 h-3.5" />
                                Approved
                              </span>
                              {item.approved_by && (
                                <span className="text-[9px] text-slate-400 font-medium mt-1 uppercase">
                                  By {item.approved_by}
                                </span>
                              )}
                            </div>
                          ) : item.review_status === 'REJECTED' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                                <X className="w-3.5 h-3.5" />
                                Rejected
                              </span>
                              {item.approved_by && (
                                <span className="text-[9px] text-slate-400 font-medium mt-1 uppercase">
                                  By {item.approved_by}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {item.review_status === 'PENDING' ? (
                              <>
                                <button
                                  onClick={() => handleApprove(item.id)}
                                  disabled={actioningId === item.id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] tracking-wide uppercase px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50"
                                >
                                  {actioningId === item.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(item.id)}
                                  disabled={actioningId === item.id}
                                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] tracking-wide uppercase px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50"
                                >
                                  {actioningId === item.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-350 text-xs font-semibold uppercase mr-2">Closed</span>
                            )}
                            <button
                              onClick={() => toggleExpandReview(item.id)}
                              className="text-indigo-600 hover:text-indigo-850 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-150 transition-all focus:outline-none"
                            >
                              {isExpanded ? 'Hide Details' : 'View Details'}
                            </button>
                          </div>
                        </td>

                      </tr>

                      {/* View Details Sub-table */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-8 py-4 border-b border-slate-200">
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Book className="w-4 h-4 text-indigo-500" />
                                Generated Ledger / Cashbook Journal Entries Splits
                              </h4>
                              {isDetailsLoading ? (
                                <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-xs font-semibold uppercase tracking-wider">Loading journal details...</span>
                                </div>
                              ) : details.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2 pl-4">No detailed journal ledger records found for this transaction.</p>
                              ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-white">
                                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                                    <thead className="bg-slate-50">
                                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-2.5 text-left">Date</th>
                                        <th className="px-4 py-2.5 text-left">Account Name</th>
                                        <th className="px-4 py-2.5 text-left">Particulars</th>
                                        <th className="px-4 py-2.5 text-right">Debit</th>
                                        <th className="px-4 py-2.5 text-right">Credit</th>
                                        <th className="px-4 py-2.5 text-left">Entered By</th>
                                        <th className="px-4 py-2.5 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                                      {details.map((detail: any, dIdx: number) => (
                                        <tr key={dIdx} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="px-4 py-2 font-sans">{format(new Date(detail.date), 'dd/MM/yyyy')}</td>
                                          <td className="px-4 py-2 font-sans font-black text-indigo-900">{detail.account_name}</td>
                                          <td className="px-4 py-2 font-sans text-slate-500 font-bold">{detail.particulars}</td>
                                          <td className="px-4 py-2 text-right font-bold text-slate-900">{detail.debit > 0 ? formatCurrency(detail.debit) : '-'}</td>
                                          <td className="px-4 py-2 text-right font-bold text-slate-900">{detail.credit > 0 ? formatCurrency(detail.credit) : '-'}</td>
                                          <td className="px-4 py-2 font-sans font-semibold uppercase text-[10px] text-slate-650">{detail.entered_by}</td>
                                          <td className="px-4 py-2 text-center font-sans">
                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                              detail.status === 'APPROVED'
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : detail.status === 'REJECTED'
                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                              {detail.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bulk Confirm Modal */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-5 text-white flex items-center gap-3">
              <Check className="w-6 h-6" />
              <h3 className="font-bold text-lg">Confirm Bulk Approval</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">
                You are about to approve <strong>{selectedReviewIds.size > 0 ? selectedReviewIds.size : reviews.filter(r => r.review_status === 'PENDING').length}</strong> transactions simultaneously.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Warning: Idempotent Ledger Rebuild
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  This action will post all associated financial ledgers and execute chronological CD loan recalculations for affected accounts.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkConfirmModal(false)}
                disabled={isBulkApproving}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-sm uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkApproval}
                disabled={isBulkApproving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center gap-2 transition-colors shadow-sm"
              >
                {isBulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isBulkApproving ? 'Approving...' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Result Modal */}
      {bulkResult && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className={`p-5 text-white flex items-center justify-between ${bulkResult.failed > 0 ? 'bg-amber-600' : 'bg-emerald-600'}`}>
              <div className="flex items-center gap-3">
                {bulkResult.failed > 0 ? <AlertCircle className="w-6 h-6" /> : <Check className="w-6 h-6" />}
                <h3 className="font-bold text-lg">Bulk Approval Complete</h3>
              </div>
              <button onClick={() => setBulkResult(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <div className="text-2xl font-black text-slate-800">{bulkResult.requested}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Requested</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center">
                  <div className="text-2xl font-black text-emerald-700">{bulkResult.approved}</div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Approved</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <div className="text-2xl font-black text-slate-500">{bulkResult.skipped}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Skipped</div>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-center">
                  <div className="text-2xl font-black text-rose-700">{bulkResult.failed}</div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">Failed</div>
                </div>
              </div>

              {bulkResult.failures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Failure Details</h4>
                  <div className="max-h-40 overflow-y-auto bg-rose-50 border border-rose-100 rounded-lg p-2">
                    <ul className="text-xs text-rose-800 space-y-2">
                      {bulkResult.failures.map((f: any, i: number) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-bold shrink-0">{f.receiptNo}:</span>
                          <span>{f.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setBulkResult(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TransactionApproval;
