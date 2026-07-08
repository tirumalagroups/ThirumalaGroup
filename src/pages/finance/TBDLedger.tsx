import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Printer, X, Eye, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';
import { financeLedgerSettingsService } from '../../services/financeLedgerSettingsService';
import { financeCalculationService } from '../../services/financeCalculationService';
import { getLocalBusinessDateISO } from '../../utils/dateUtils';

const TBDLedger: React.FC = () => {
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Detail Drawer State
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [payingInsts, setPayingInsts] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);
  const [waivedPenalty, setWaivedPenalty] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(() => getLocalBusinessDateISO());
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [isDirectDaysPayment, setIsDirectDaysPayment] = useState<boolean>(false);
  const [customTotalAmount, setCustomTotalAmount] = useState<number>(0);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // NPA States
  const [showNpaModal, setShowNpaModal] = useState(false);
  const [npaReason, setNpaReason] = useState('');
  const [npaSettlementAmount, setNpaSettlementAmount] = useState('');
  const [isNpaClosing, setIsNpaClosing] = useState(false);
  
  // Waiver Auditing States
  const [waiverReason, setWaiverReason] = useState('');
  const [waivedBy, setWaivedBy] = useState('CASHIER');
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    let filtered = ledgerRows.filter(row => 
      (row.loanId.toLowerCase().includes(q) ||
      row.customerName.toLowerCase().includes(q) ||
      (row.phone && row.phone.includes(q)))
    );
    if (startDate) {
      filtered = filtered.filter(row => row.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(row => row.date <= endDate);
    }
    setFilteredRows(filtered);
  }, [searchQuery, ledgerRows, startDate, endDate]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const [loans, txs, settings, pending] = await Promise.all([
        supabaseFinance.getLoans(),
        supabaseFinance.getTransactions(),
        financeLedgerSettingsService.getAllLedgerSettings(),
        supabaseFinance.getTransactionReviews({ status: 'PENDING' })
      ]);
      setPendingReviews(pending);

      const tbdLoans = loans.filter(l => 
        l.loan_category === 'TBD' || 
        l.loan_id.toUpperCase().startsWith('TBD') || 
        l.loan_id.toUpperCase().startsWith('T-')
      );

      const rows = tbdLoans.map(loan => {
        const loanWithTxs = { ...loan, transactions: txs.filter(t => t.loan_id === loan.id) };
        const calc = financeCalculationService.getLoanCalculations(loanWithTxs, settings['TBD'] || null);

        // Get installments info
        const amount = Number(loan.amount);
        const period = Number(loan.period_days || 100);
        const balanceWith = Number(loan.balance_with_interest ?? amount);
        const balanceWithout = Number(loan.balance_without_interest ?? amount);
        const ipaid = Number(loan.installments_paid || 0);

        return {
          id: loan.id,
          loanId: loan.loan_id,
          customerName: loan.customer?.name || 'N/A',
          phone: loan.customer?.phone || '',
          date: loan.date,
          principal: amount,
          interestRate: Number(loan.interest_rate),
          duration: period,
          interestAmount: 0, // TBD charges commission upfront separately, no capitalized interest
          totalRepayable: amount,
          totalCollected: calc.totalCredit,
          outstanding: balanceWithout,
          balanceWith,
          installmentsPaid: ipaid,
          status: loan.status,
          rawLoan: loanWithTxs
        };
      });

      setLedgerRows(rows);
      setFilteredRows(rows);

      // If drawer is open, refresh the selected loan reference
      if (selectedLoan) {
        const updated = rows.find(r => r.id === selectedLoan.id);
        if (updated) setSelectedLoan(updated);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile TBD Ledger');
    } finally {
      setLoading(false);
    }
  };

  const openLoanDetails = async (loan: any) => {
    setSelectedLoan(loan);
    setIsDrawerOpen(true);
    
    // Generate next receipt number
    const nextRc = await supabaseFinance.getNextReceiptNumber();
    setReceiptNo(nextRc);

    // Default installments to pay based on days due
    const schedule = getInstallmentSchedule(loan);
    const overdueCount = schedule.filter(s => s.status === 'Overdue').length;
    setPayingInsts(overdueCount > 0 ? overdueCount : 1);
    setDiscount(0);
    setWaivedPenalty(0);
    setIsDirectDaysPayment(false);
    
    const baseInstAmt = Number(loan.rawLoan.due_amount || (loan.principal / loan.duration));
    setCustomTotalAmount(baseInstAmt);
  };

  // Helper to dynamically calculate daily installment schedule
  const getInstallmentSchedule = (loan: any) => {
    const startDate = new Date(loan.date);
    const duration = Number(loan.duration);
    const installmentAmount = Number(loan.rawLoan.due_amount || (loan.principal / duration));
    const ipaid = Number(loan.installmentsPaid || 0);
    const schedule = [];
    const currentDate = new Date(paymentDate);

    // To prevent loading 100+ rows in slow DOMs, we only display active, overdue and next 10 pending installments
    const maxToDisplay = Math.min(duration, Math.max(20, Math.floor(ipaid) + 15));

    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + i);

      const dueDateStr = dueDate.toISOString().split('T')[0];
      let status: 'Paid' | 'Partially Paid' | 'Pending' | 'Overdue' = 'Pending';
      let paidAmt = 0;

      if (i <= Math.floor(ipaid)) {
        status = 'Paid';
        paidAmt = installmentAmount;
      } else if (i === Math.floor(ipaid) + 1 && ipaid % 1 > 0) {
        status = 'Partially Paid';
        paidAmt = financeCalculationService.roundRupee((ipaid % 1) * installmentAmount);
      } else if (dueDate < currentDate) {
        status = 'Overdue';
      }

      // Calculate delay in days and penalty
      let dueDays = 0;
      let penalty = 0;
      if (status === 'Overdue' || status === 'Partially Paid') {
        const diffTime = currentDate.getTime() - dueDate.getTime();
        dueDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        if (dueDays > 6) { // TBD grace days is 6 days
          penalty = financeCalculationService.roundRupee(installmentAmount * 0.002 * dueDays);
        }
      }

      if (i <= maxToDisplay) {
        schedule.push({
          instNo: i,
          dueDate: dueDateStr,
          installmentAmount,
          paidAmount: paidAmt,
          dueDays,
          penalty,
          status
        });
      }
    }
    return schedule;
  };

  const getPayableCalculations = () => {
    if (!selectedLoan) return { instAmt: 0, penalty: 0, actualPenaltyPaid: 0, total: 0, principalPaid: 0, commissionPaid: 0 };
    const instAmt = Number(selectedLoan.rawLoan.due_amount || (selectedLoan.principal / selectedLoan.duration));
    
    if (isDirectDaysPayment) {
      return {
        instAmt: customTotalAmount,
        penalty: 0,
        actualPenaltyPaid: 0,
        total: customTotalAmount,
        principalPaid: customTotalAmount,
        commissionPaid: 0
      };
    }

    // Standard daily payment calculation
    const schedule = getInstallmentSchedule(selectedLoan);
    const calculatedPenalty = schedule
      .slice(0, Math.floor(selectedLoan.installmentsPaid) + payingInsts)
      .reduce((sum, item) => sum + (item.penalty || 0), 0);

    const actualPenaltyPaid = Math.max(0, calculatedPenalty - waivedPenalty);

    // Split computations:
    // Commission = Amount * 0.03 * payingInsts - discount
    // Principal = InstAmount * payingInsts - Commission
    const splits = financeCalculationService.computeTBDPaymentSplit(
      selectedLoan.principal,
      selectedLoan.duration,
      payingInsts,
      instAmt,
      discount,
      actualPenaltyPaid
    );

    const totalPayable = (instAmt * payingInsts) + actualPenaltyPaid - discount;

    return {
      instAmt: instAmt * payingInsts,
      penalty: calculatedPenalty,
      actualPenaltyPaid,
      total: totalPayable,
      principalPaid: splits.principalPaid,
      commissionPaid: splits.commissionPaid
    };
  };

  const postPayment = async () => {
    if (!selectedLoan) return;
    if (!receiptNo) {
      toast.error('Receipt number is required');
      return;
    }

    // Check if waiver details are entered when waiver is present
    if (!isDirectDaysPayment && (discount > 0 || waivedPenalty > 0) && (!waiverReason.trim() || !waivedBy.trim())) {
      toast.error('Waiver Reason and Approver Name are required for discount transactions.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const calcs = getPayableCalculations();
      
      const res = await supabaseFinance.postTbdLedgerPayment({
        loanId: selectedLoan.id,
        customerId: selectedLoan.rawLoan.customer_id,
        customerName: selectedLoan.customerName,
        loanIdStr: selectedLoan.loanId,
        userName: 'Cashier',
        payingInsts: isDirectDaysPayment ? 0 : payingInsts,
        principalPaid: calcs.principalPaid,
        commissionPaid: calcs.commissionPaid,
        penaltyPaid: calcs.actualPenaltyPaid,
        discount,
        waivedPenalty,
        paymentDate,
        receiptNo,
        isDirectDaysPayment,
        waiverReason: (!isDirectDaysPayment && (discount > 0 || waivedPenalty > 0)) ? waiverReason : undefined,
        waivedBy: (!isDirectDaysPayment && (discount > 0 || waivedPenalty > 0)) ? waivedBy : undefined,
        waivedDate: (!isDirectDaysPayment && (discount > 0 || waivedPenalty > 0)) ? paymentDate : undefined
      });

      if (res.success) {
        toast.success(`Payment posted successfully! Receipt: ${receiptNo}`);
        setWaiverReason('');
        await fetchLedgerData();
      } else {
        toast.error(res.error || 'Failed to post payment');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Error submitting transaction');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleNPACloseSubmit = async () => {
    if (!selectedLoan) return;
    setIsNpaClosing(true);
    try {
      const npaClosedDate = new Date(paymentDate).toISOString();
      const npaClosedAmount = Number(npaSettlementAmount) || 0;
      const closedBy = 'CASHIER';
      const npaReceiptNo = await supabaseFinance.getNextReceiptNumber();
      const cleanNpaReason = npaReason.trim().toUpperCase();

      const updatedRemarks = `${selectedLoan.rawLoan.remarks || ''}\n[NPA CLOSED AT ${npaClosedDate} BY ${closedBy} WITH SETTLEMENT AMOUNT: ${npaClosedAmount}]`.trim().toUpperCase();

      const { error: loanError } = await supabase.from('finance_loans')
        .update({
          status: 'NPA_CLOSED',
          npa_closed: true,
          remarks: updatedRemarks
        })
        .eq('id', selectedLoan.id);
      if (loanError) throw loanError;

      // Outstanding dues before close
      const principal_balance = selectedLoan.outstanding;
      const schedule = getInstallmentSchedule(selectedLoan);
      const penalty_due = schedule.reduce((sum, s) => sum + s.penalty, 0);
      const total_outstanding = principal_balance + penalty_due;
      const waived_amount = total_outstanding - npaClosedAmount;

      await supabaseFinance.addNPARecord({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.rawLoan.customer_id,
        customer_name: selectedLoan.customerName.toUpperCase(),
        phone: selectedLoan.phone || '',
        loan_type: 'TBD',
        loan_amount: selectedLoan.principal,
        paid_amount: selectedLoan.totalCollected,
        balance_amount: principal_balance,
        interest_due: 0,
        penalty_due: penalty_due,
        settlement_amount: npaClosedAmount,
        total_liability: total_outstanding,
        waived_amount: waived_amount,
        reason: cleanNpaReason,
        closed_by: closedBy,
        closed_at: npaClosedDate
      });

      // Post transaction if settlement received
      if (npaClosedAmount > 0) {
        await supabaseFinance.addTransaction({
          loan_id: selectedLoan.id,
          type: 'Collection',
          amount: npaClosedAmount,
          date: paymentDate,
          remarks: `TBD NPA Settlement Collection - ${npaReceiptNo} (Prin: ${npaClosedAmount})`,
          collected_by: closedBy,
          receipt_no: npaReceiptNo
        });

        await supabaseFinance.createCashbookEntry({
          entry_date: paymentDate,
          account_number: selectedLoan.loanId,
          head_of_account: 'TBD A/c',
          particulars: `${selectedLoan.customerName} - NPA Settlement ${npaReceiptNo}`,
          credit: npaClosedAmount,
          debit: 0,
          created_by: closedBy
        });
      }

      // Write waiver record for the remainder
      if (waived_amount > 0) {
        await supabaseFinance.addWaiverAudit({
          loan_id: selectedLoan.id,
          waived_date: paymentDate,
          waived_by: closedBy,
          waiver_reason: `NPA CLOSE WRITE-OFF: ${cleanNpaReason}`,
          waived_interest: 0,
          waived_penalty: penalty_due,
          waived_commission: 0,
          receipt_no: npaReceiptNo
        });
      }

      await fetchLedgerData();
      toast.success('TBD Account closed under NPA successfully');
      setShowNpaModal(false);
      setIsDrawerOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Error settling TBD NPA account');
    } finally {
      setIsNpaClosing(false);
    }
  };

  const schedule = selectedLoan ? getInstallmentSchedule(selectedLoan) : [];
  const payCalcs = getPayableCalculations();

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-teal-100 pb-4 ${showPrintPreview || isDrawerOpen ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1 text-teal-800">TBD Ledger</h1>
          <p className="finance-small-label uppercase">Ten Book Daily (Daily Collections) Account Book</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print Ledger
        </Button>
      </div>

      {/* Filters */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl bg-slate-50 p-4 rounded-xl border ${showPrintPreview || isDrawerOpen ? 'print:hidden' : ''}`}>
        <div>
          <Input
            label="Filter TBD Accounts"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by ID, Name, Phone..."
          />
        </div>
        <div>
          <Input
            label="From Date"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
        <div>
          <Input
            label="To Date"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className={showPrintPreview || isDrawerOpen ? 'hidden' : 'block'}>
        <Card title="TBD Ledger Accounts" subtitle="Daily installments ledger index" className="shadow-md">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-teal-600"></div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No TBD ledger entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
              <thead>
                <tr className="bg-slate-50">
                  <th className="finance-small-label uppercase">Loan ID</th>
                  <th className="finance-small-label uppercase">Customer</th>
                  <th className="finance-small-label uppercase">Disbursed Date</th>
                  <th className="text-right finance-small-label uppercase">Principal</th>
                  <th className="text-right finance-small-label uppercase">Duration</th>
                  <th className="text-right finance-small-label uppercase">Collected (Cr)</th>
                  <th className="text-right finance-small-label uppercase">Receivable (Dr)</th>
                  <th className="text-center finance-small-label uppercase">Status</th>
                  <th className="text-center finance-small-label uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-3 text-teal-900 font-mono font-semibold">{row.loanId}</td>
                    <td className="px-3 py-3">
                      <div className="text-gray-950 font-medium">{row.customerName}</div>
                      {row.phone && <div className="text-gray-400 mt-0.5 text-xs">{row.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-900">
                      ₹{row.principal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500">
                      {row.duration} days
                    </td>
                    <td className="px-3 py-3 text-right text-green-600">
                      ₹{row.totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-rose-800 font-semibold">
                      ₹{row.outstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button 
                        onClick={() => openLoanDetails(row)} 
                        className="inline-flex items-center text-teal-600 hover:text-teal-800 hover:underline text-xs font-semibold gap-1"
                      >
                        <Eye className="w-4 h-4" /> Open Book
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </Card>
      </div>

      {/* Detailed Slide-Over Drawer */}
      {isDrawerOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-gray-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-4xl bg-white shadow-2xl h-full flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-800 to-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold font-sans">Account Ledger: {selectedLoan.loanId}</h2>
                <p className="text-teal-200 text-xs uppercase tracking-wider">{selectedLoan.customerName}</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedLoan.status === 'Active' && (
                  <Button
                    onClick={() => {
                      setNpaReason('');
                      setNpaSettlementAmount('');
                      setShowNpaModal(true);
                    }}
                    variant="danger"
                    size="sm"
                    icon={ShieldAlert}
                    className="bg-orange-600 hover:bg-orange-700 text-white border-0 rounded-xl shadow-sm text-xs py-1.5 px-3 flex items-center gap-1 font-bold font-sans"
                  >
                    NPA Close
                  </Button>
                )}
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 rounded-full hover:bg-teal-750/50 text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 border p-3 rounded-xl">
                  <div className="text-gray-400 text-xs uppercase font-semibold">Disbursed Amount</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">₹{selectedLoan.principal.toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-slate-50 border p-3 rounded-xl">
                  <div className="text-gray-400 text-xs uppercase font-semibold">Days Paid</div>
                  <div className="text-lg font-bold text-teal-700 mt-1">{selectedLoan.installmentsPaid} / {selectedLoan.duration} days</div>
                </div>
                <div className="bg-slate-50 border p-3 rounded-xl">
                  <div className="text-gray-400 text-xs uppercase font-semibold">Total Collected</div>
                  <div className="text-lg font-bold text-green-700 mt-1">₹{selectedLoan.totalCollected.toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-slate-50 border p-3 rounded-xl">
                  <div className="text-gray-400 text-xs uppercase font-semibold">Receivable Balance</div>
                  <div className="text-lg font-bold text-rose-800 mt-1">₹{selectedLoan.outstanding.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Installment Schedule & Collect Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Schedule Table */}
                <div className="lg:col-span-3 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 border-b pb-1">Daily Installments Schedule (showing recent)</h3>
                  <div className="border rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold text-gray-500">Day</th>
                          <th className="px-2 py-2 text-left font-semibold text-gray-500">Due Date</th>
                          <th className="px-2 py-2 text-right font-semibold text-gray-500">Amount</th>
                          <th className="px-2 py-2 text-right font-semibold text-gray-500">Penalty</th>
                          <th className="px-2 py-2 text-center font-semibold text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {schedule.map(inst => (
                          <tr key={inst.instNo} className="hover:bg-slate-50">
                            <td className="px-2 py-2 text-gray-600 font-mono">Day {inst.instNo}</td>
                            <td className="px-2 py-2 text-gray-500">{inst.dueDate}</td>
                            <td className="px-2 py-2 text-right text-gray-950 font-medium">₹{inst.installmentAmount}</td>
                            <td className="px-2 py-2 text-right text-red-600">₹{inst.penalty}</td>
                            <td className="px-2 py-2 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                inst.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                inst.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                                inst.status === 'Overdue' ? 'bg-rose-100 text-rose-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {inst.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Collect Form */}
                <div className="lg:col-span-2 bg-slate-50 p-4 border rounded-2xl space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 border-b pb-1 flex justify-between">
                    <span>Receive Payment</span>
                    <span className="text-xs text-gray-500 font-mono">RNo: {receiptNo}</span>
                  </h3>

                  <div className="space-y-3">
                    {/* Mode selector */}
                    <div className="flex gap-4 p-1 bg-gray-200/60 rounded-lg text-xs font-semibold">
                      <button 
                        onClick={() => setIsDirectDaysPayment(false)}
                        className={`flex-1 text-center py-1 rounded-md transition-all ${!isDirectDaysPayment ? 'bg-white text-teal-850 shadow-sm' : 'text-gray-500'}`}
                      >
                        Split Installments
                      </button>
                      <button 
                        onClick={() => setIsDirectDaysPayment(true)}
                        className={`flex-1 text-center py-1 rounded-md transition-all ${isDirectDaysPayment ? 'bg-white text-teal-850 shadow-sm' : 'text-gray-500'}`}
                      >
                        Direct Days Payment
                      </button>
                    </div>

                    {!isDirectDaysPayment ? (
                      <>
                        <Input
                          label="Number of Days to Pay"
                          type="number"
                          value={payingInsts}
                          onChange={(val) => setPayingInsts(Math.max(1, Number(val)))}
                          min="1"
                          max={selectedLoan.duration - selectedLoan.installmentsPaid}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            label="Commission Discount"
                            type="number"
                            value={discount}
                            onChange={(val) => setDiscount(Math.max(0, Number(val)))}
                          />
                          <Input
                            label="Penalty Discount"
                            type="number"
                            value={waivedPenalty}
                            onChange={(val) => setWaivedPenalty(Math.max(0, Number(val)))}
                          />
                        </div>

                        {(discount > 0 || waivedPenalty > 0) && (
                          <div className="grid grid-cols-2 gap-2 bg-yellow-50/60 p-2.5 rounded-xl border border-yellow-100">
                            <Input
                              label="Waiver Reason"
                              value={waiverReason}
                              onChange={setWaiverReason}
                              placeholder="Reason for waiver"
                              required
                            />
                            <Input
                              label="Approved By"
                              value={waivedBy}
                              onChange={setWaivedBy}
                              placeholder="Approver name"
                              required
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <Input
                        label="Direct Amount (₹)"
                        type="number"
                        value={customTotalAmount}
                        onChange={(val) => setCustomTotalAmount(Math.max(0, Number(val)))}
                      />
                    )}

                    <Input
                      label="Payment Date"
                      type="date"
                      value={paymentDate}
                      onChange={setPaymentDate}
                    />

                    {/* Calculations Display */}
                    <div className="border-t pt-3 space-y-2 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Installments Amount:</span>
                        <span>₹{payCalcs.instAmt}</span>
                      </div>
                      {!isDirectDaysPayment && (
                        <div className="flex justify-between text-red-600">
                          <span>Late Penalty Accrued:</span>
                          <span>₹{payCalcs.penalty}</span>
                        </div>
                      )}
                      {!isDirectDaysPayment && waivedPenalty > 0 && (
                        <div className="flex justify-between text-green-600 font-medium">
                          <span>Penalty Waived:</span>
                          <span>- ₹{waivedPenalty}</span>
                        </div>
                      )}
                      {!isDirectDaysPayment && discount > 0 && (
                        <div className="flex justify-between text-green-600 font-medium">
                          <span>Commission Discount:</span>
                          <span>- ₹{discount}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm text-gray-950 border-t pt-2">
                        <span>Total Cash Received:</span>
                        <span>₹{payCalcs.total}</span>
                      </div>
                    </div>

                    {/* Splitting Allocation Preview */}
                    <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-100 text-[10px] text-teal-800 space-y-1">
                      <div className="font-bold uppercase tracking-wider text-teal-900 border-b pb-0.5 mb-1 text-[9px]">Credits Split Allocation Preview:</div>
                      <div className="flex justify-between">
                        <span>TBD A/c (Principal Component):</span>
                        <span className="font-semibold">₹{payCalcs.principalPaid}</span>
                      </div>
                      {!isDirectDaysPayment && (
                        <>
                          <div className="flex justify-between">
                            <span>COMMISSION A/C (Daily fee):</span>
                            <span className="font-semibold">₹{payCalcs.commissionPaid}</span>
                          </div>
                          {payCalcs.actualPenaltyPaid > 0 && (
                            <div className="flex justify-between">
                              <span>Penalty A/c (Penalty):</span>
                              <span className="font-semibold">₹{payCalcs.actualPenaltyPaid}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Button 
                      onClick={postPayment}
                      variant="primary" 
                      className="w-full text-center py-2 text-sm font-semibold rounded-xl bg-teal-800 hover:bg-teal-900 text-white"
                      disabled={submittingPayment}
                    >
                      {submittingPayment ? 'Posting payment...' : `Submit Payment (₹${payCalcs.total})`}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Transactions History */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 border-b pb-1">Daybook Transactions History</h3>
                {selectedLoan.rawLoan.transactions.length === 0 ? (
                  <p className="text-xs text-gray-400">No payment transactions recorded for this account yet.</p>
                ) : (
                  <div className="border rounded-xl overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Date</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Receipt No</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Collected By</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-semibold">Remarks</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {selectedLoan.rawLoan.transactions.map((tx: any) => {
                          const isPending = tx.receipt_no && tx.receipt_no !== '-' && pendingReviews.some(r => r.receipt_number === tx.receipt_no && r.loan_id === selectedLoan.id);
                          return (
                            <tr key={tx.id} className={`hover:bg-slate-50 ${isPending ? 'bg-[#fff7ed]' : ''}`}>
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2 font-mono text-teal-800 font-medium">
                                {tx.receipt_no || 'N/A'}
                                {isPending && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange-50 text-orange-700 border border-orange-200 uppercase tracking-wide">
                                    Pending Approval
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{tx.collected_by || 'System'}</td>
                              <td className="px-3 py-2 text-gray-400 italic max-w-xs truncate">{tx.remarks}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-950">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Panel */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="TBD Ledger"
        documentTitle="TBD LEDGER REPORT"
      >
        {filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
              <thead>
                <tr className="bg-gray-100">
                  <th className="finance-small-label uppercase">Loan ID</th>
                  <th className="finance-small-label uppercase">Customer</th>
                  <th className="finance-small-label uppercase">Disbursed</th>
                  <th className="text-right finance-small-label uppercase">Principal</th>
                  <th className="text-right finance-small-label uppercase">Interest</th>
                  <th className="text-right finance-small-label uppercase">Total Repayable</th>
                  <th className="text-right finance-small-label uppercase">Collected (Cr)</th>
                  <th className="text-right finance-small-label uppercase">Receivable (Dr)</th>
                  <th className="text-center finance-small-label uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-900 font-mono finance-input">{row.loanId}</td>
                    <td className="px-3 py-3">
                      <div className="text-gray-900 finance-input">{row.customerName}</div>
                      {row.phone && <div className="text-gray-400 mt-0.5 finance-small-label">{row.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 text-right finance-input">
                      ₹{row.principal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 finance-input">
                      ₹{row.interestAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-900 finance-input">
                      ₹{row.totalRepayable.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-green-600 finance-input">
                      ₹{row.totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right text-orange-700 finance-input">
                      ₹{row.outstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${ row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="text-gray-900 md:text-sm finance-header-time">
                  <td colSpan={3} className="px-3 py-3 text-right finance-input uppercase">Total:</td>
                  <td className="px-3 py-3 text-right">₹{filteredRows.reduce((sum, r) => sum + r.principal, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-gray-500">₹{filteredRows.reduce((sum, r) => sum + r.interestAmount, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right">₹{filteredRows.reduce((sum, r) => sum + r.totalRepayable, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-green-700">₹{filteredRows.reduce((sum, r) => sum + r.totalCollected, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3 text-right text-orange-700">₹{filteredRows.reduce((sum, r) => sum + r.outstanding, 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </FinancePrintPreview>

      {/* NPA Close Account Modal */}
      {showNpaModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl relative text-left">
            <button onClick={() => setShowNpaModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 animate-pulse">
              <ShieldAlert className="w-6 h-6 text-orange-600" />
              NPA Settlement Close (TBD)
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 text-orange-850 border border-orange-200 rounded-2xl text-xs leading-normal">
                <p className="font-semibold mb-1">Confirm NPA Close Action</p>
                <p>Are you sure you want to close this TBD account under NPA? This will mark the loan status as Closed with NPA designation and record the settlement and waived amounts.</p>
              </div>
              <div>
                <Input
                  label="Settlement Amount Collected"
                  type="number"
                  value={npaSettlementAmount}
                  onChange={setNpaSettlementAmount}
                  placeholder="Enter settlement amount collected"
                  required
                />
              </div>
              <div>
                <Input
                  label="Reason / Remarks"
                  value={npaReason}
                  onChange={v => setNpaReason(v.toUpperCase())}
                  placeholder="Enter reason/remarks for NPA closure"
                  required
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowNpaModal(false)} variant="secondary" className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleNPACloseSubmit} variant="danger" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl" disabled={isNpaClosing || !npaReason.trim()}>
                  {isNpaClosing ? 'Processing...' : 'Close NPA Account'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TBDLedger;
