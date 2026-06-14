import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface DaybookItem {
  id: string;
  source: 'Transaction' | 'Capital';
  particulars: string;
  type: string; // 'Collection', 'Disbursement', 'Capital Credit', etc.
  cashIn: number;
  cashOut: number;
  remarks: string | null;
}

const Daybook: React.FC = () => {
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
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
      // 1. Calculate Opening Balance (Net flow before fromDate)
      // Receipts: collections & capital credits before date
      // Payments: disbursements & capital debits before date
      const allTx = await supabaseFinance.getTransactions();
      const allCapital = await supabaseFinance.getCapitalEntries();

      let opBal = 0;
      allTx.forEach(tx => {
        if (tx.date < fromDate) {
          if (tx.type === 'Collection') {
            opBal += Number(tx.amount);
          } else if (tx.type === 'Disbursement') {
            opBal -= Number(tx.amount);
          }
        }
      });

      allCapital.forEach(cap => {
        if (cap.entry_date < fromDate) {
          if (cap.credit > 0) {
            opBal += Number(cap.credit);
          } else {
            opBal -= Number(cap.debit);
          }
        }
      });

      setOpeningBalance(opBal);

      // 2. Fetch items for date range
      const items: DaybookItem[] = [];
      let inSum = 0;
      let outSum = 0;

      // Filter transactions for this date range
      const rangeTx = allTx.filter(tx => tx.date >= fromDate && tx.date <= toDate);
      rangeTx.forEach(tx => {
        const amt = Number(tx.amount);
        const isCollection = tx.type === 'Collection';
        items.push({
          id: tx.id,
          source: 'Transaction',
          particulars: isCollection 
            ? `Collection Recd - ${tx.loan?.customer?.name || 'N/A'} (${tx.loan?.loan_id || 'N/A'})`
            : `Loan Disbursed - ${tx.loan?.customer?.name || 'N/A'} (${tx.loan?.loan_id || 'N/A'})`,
          type: tx.type,
          cashIn: isCollection ? amt : 0,
          cashOut: !isCollection ? amt : 0,
          remarks: tx.remarks
        });
        if (isCollection) inSum += amt;
        else outSum += amt;
      });

      // Filter capital entries for this date range
      const rangeCap = allCapital.filter(cap => cap.entry_date >= fromDate && cap.entry_date <= toDate);
      rangeCap.forEach(cap => {
        const isCredit = cap.credit > 0;
        const amt = isCredit ? Number(cap.credit) : Number(cap.debit);
        items.push({
          id: cap.id,
          source: 'Capital',
          particulars: isCredit
            ? `Capital Invested by Partner - ${cap.partner?.name || cap.partner_name || 'N/A'}`
            : `Capital Withdrawn by Partner - ${cap.partner?.name || cap.partner_name || 'N/A'}`,
          type: isCredit ? 'Capital Deposit' : 'Capital Withdraw',
          cashIn: isCredit ? amt : 0,
          cashOut: !isCredit ? amt : 0,
          remarks: cap.particulars
        });
        if (isCredit) inSum += amt;
        else outSum += amt;
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

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Title */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">Finance Daybook</h1>
          <p className="finance-small-label uppercase">Review cash inflow and outflow transactions for any specific business day</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
            Print Daybook
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md bg-gray-50 p-4 rounded-xl border ${showPrintPreview ? 'print:hidden' : ''}`}>
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={setFromDate}
        />
        <Input
          label="To Date"
          type="date"
          value={toDate}
          onChange={setToDate}
        />
      </div>

      <div className={showPrintPreview ? 'print:hidden' : ''}>
        {/* Daybook Sheet */}
        <Card
        title={
          <div className="flex justify-between items-center w-full">
            <span>Daybook Statement</span>
            <span className="font-mono text-gray-500 text-right finance-input">
              Period: {new Date(fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to {new Date(toDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
        }
        subtitle="Receipts & Payments cashbook breakdown"
        className="shadow-md border-green-100"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Balance Headers */}
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

            {/* Entries Table */}
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

            {/* Print Signatures */}
            <div className="hidden print:flex justify-between items-center mt-20 pt-8 border-t finance-caption">
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
        </Card>
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
