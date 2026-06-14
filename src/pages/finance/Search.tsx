import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinanceTransaction, FinanceDue, FinancePhoto } from '../../lib/supabaseFinance';
import { Search as SearchIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const SearchPage: React.FC = () => {
  const { user } = useAuth();
  
  // Search parameters
  const [query, setQuery] = useState('');
  const [loans, setLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Selected Loan full details
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: FinancePhoto[]; dues: FinanceDue[] }) | null>(null);
  
  // Collection Form state
  const [collectAmount, setCollectAmount] = useState('');
  const [collectDate, setCollectDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [collectRemarks, setCollectRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    fetchLoansList();
  }, []);

  useEffect(() => {
    // Dynamic filtering
    if (!query) {
      setFilteredLoans([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = loans.filter(l => 
      l.loan_id.toLowerCase().includes(q) ||
      l.customer?.name.toLowerCase().includes(q) ||
      (l.customer?.phone && l.customer.phone.includes(q)) ||
      (l.customer?.aadhaar && l.customer.aadhaar.includes(q))
    );
    setFilteredLoans(filtered.slice(0, 10)); // Limit to top 10 search results
  }, [query, loans]);

  useEffect(() => {
    if (selectedLoanId) {
      loadLoanDetails(selectedLoanId);
    } else {
      setSelectedLoanDetails(null);
    }
  }, [selectedLoanId]);

  const fetchLoansList = async () => {
    try {
      const data = await supabaseFinance.getLoans();
      setLoans(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load active loan accounts list');
    }
  };

  const loadLoanDetails = async (id: string) => {
    try {
      const details = await supabaseFinance.getLoanById(id);
      if (details) {
        setSelectedLoanDetails(details);
        // Pre-fill collection amount with due instalment amount
        setCollectAmount(String(details.due_amount));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load account detailed ledger');
    }
  };

  const handleQuickCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanDetails) return;
    const numAmt = Number(collectAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      toast.error('Please enter a valid collection amount');
      return;
    }

    setCollecting(true);
    try {
      const staffName = user?.username || 'Operator';
      const tx = await supabaseFinance.createTransaction({
        loan_id: selectedLoanDetails.id,
        date: collectDate,
        amount: numAmt,
        type: 'Collection',
        collected_by: staffName,
        remarks: collectRemarks || null
      }, staffName);

      if (tx) {
        toast.success(`Received collection ₹${numAmt.toLocaleString('en-IN')}! Dues updated.`);
        setCollectRemarks('');
        // Refresh details & list
        loadLoanDetails(selectedLoanDetails.id);
        fetchLoansList();
      } else {
        toast.error('Failed to record collection');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setCollecting(false);
    }
  };

  const handleDeleteTransaction = async (txId: string, type: string) => {
    if (type === 'Disbursement') {
      toast.error('Cannot delete original Loan Disbursement from this screen. Please edit the Loan Account to cancel.');
      return;
    }
    if (!window.confirm('Delete this collection transaction? Dues schedules will automatically adjust.')) return;
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteTransaction(txId, staffName);
      if (success) {
        toast.success('Collection transaction deleted.');
        if (selectedLoanDetails) {
          loadLoanDetails(selectedLoanDetails.id);
        }
        fetchLoansList();
      } else {
        toast.error('Deletion failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper calculation values
  const getFinancialSummary = () => {
    if (!selectedLoanDetails) return { totalPayable: 0, totalPaid: 0, outstanding: 0, paidDues: 0, pendingDues: 0 };
    
    // Total repayment = sum of all dues amounts (or calculated total repayment)
    const totalPayable = selectedLoanDetails.dues.reduce((sum, due) => sum + Number(due.amount), 0);
    
    // Total paid = sum of collections in transactions
    const totalPaid = selectedLoanDetails.transactions
      .filter(tx => tx.type === 'Collection')
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const outstanding = Math.max(0, totalPayable - totalPaid);

    const paidDues = selectedLoanDetails.dues.filter(d => d.status === 'Paid').length;
    const pendingDues = selectedLoanDetails.dues.filter(d => d.status !== 'Paid').length;

    return { totalPayable, totalPaid, outstanding, paidDues, pendingDues };
  };

  const summary = getFinancialSummary();

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h1 className="finance-h1">SEARCH & COLLECTION CENTER</h1>
          <p className="mt-1 finance-small-label uppercase">Lookup loans, view repayment graphs, and collect daily/weekly instalments</p>
        </div>
      </div>

      {/* Search Input and Top Dropdown Results */}
      <div className="relative max-w-lg z-20">
        <Input
          label="Search by ID, Customer Name, Phone, Aadhaar"
          value={query}
          onChange={setQuery}
          placeholder="Type Ramesh or L-1001..."
        />
        {filteredLoans.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
            {filteredLoans.map(loan => (
              <li
                key={loan.id}
                onClick={() => {
                  setSelectedLoanId(loan.id);
                  setQuery('');
                }}
                className="px-4 py-3 cursor-pointer hover:bg-green-50/50 flex justify-between items-center transition-colors"
              >
                <div>
                  <span className="text-gray-900 finance-sidebar-link">{loan.customer?.name}</span>
                  <span className="text-gray-400 font-mono ml-2 finance-small-label">({loan.loan_id})</span>
                  {loan.customer?.phone && (
                    <div className="text-gray-500 mt-0.5 finance-caption">{loan.customer.phone}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-green-700 finance-sidebar-link">₹{Number(loan.amount).toLocaleString('en-IN')}</div>
                  <span className="text-gray-400 finance-small-label">{loan.due_type}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedLoanDetails ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Customer Card, Collection Box, Photos */}
          <div className="space-y-6">
            {/* Customer Brief */}
            <Card title={`Customer Profile (${selectedLoanDetails.loan_id})`} subtitle="Linked identity parameters">
              <div className="space-y-2 text-gray-700 finance-input">
                <div>
                  <span className="text-gray-400 block finance-caption">Customer Name</span>
                  <span className="text-gray-900 finance-brand">{selectedLoanDetails.customer?.name}</span>
                </div>
                {selectedLoanDetails.customer?.phone && (
                  <div>
                    <span className="text-gray-400 block finance-caption">Phone Number</span>
                    <span className="text-gray-900 finance-input">{selectedLoanDetails.customer?.phone}</span>
                  </div>
                )}
                {selectedLoanDetails.customer?.address && (
                  <div>
                    <span className="text-gray-400 block finance-caption">Address</span>
                    <span className="text-gray-900 finance-input">{selectedLoanDetails.customer?.address}</span>
                  </div>
                )}
                {selectedLoanDetails.customer?.aadhaar && (
                  <div>
                    <span className="text-gray-400 block finance-caption">Aadhaar Card UID</span>
                    <span className="text-gray-900 font-mono finance-input">{selectedLoanDetails.customer?.aadhaar}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Collection Entry Form */}
            <Card title="Quick Collection Entry" subtitle="Add collection payments to account" className="border-green-200">
              <form onSubmit={handleQuickCollection} className="space-y-4">
                <Input
                  label="Collection Date"
                  type="date"
                  value={collectDate}
                  onChange={setCollectDate}
                  required
                />
                
                <Input
                  label="Amount Collected (₹)"
                  type="number"
                  value={collectAmount}
                  onChange={setCollectAmount}
                  placeholder="e.g. 500"
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(selectedLoanDetails.due_amount))}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1.5 rounded finance-header-time"
                  >
                    Instalment (₹{selectedLoanDetails.due_amount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(summary.outstanding))}
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1.5 rounded finance-header-time"
                  >
                    Outstanding (₹{summary.outstanding})
                  </button>
                </div>

                <Input
                  label="Remarks"
                  value={collectRemarks}
                  onChange={setCollectRemarks}
                  placeholder="e.g. Collected cash"
                />

                <Button type="submit" variant="success" className="w-full pt-2" disabled={collecting}>
                  {collecting ? 'Saving collection...' : 'Submit Collection'}
                </Button>
              </form>
            </Card>

            {/* Photos */}
            {selectedLoanDetails.photos.length > 0 && (
              <Card title="Linked Images" subtitle="Uploaded customer or surety documentation">
                <div className="grid grid-cols-2 gap-2">
                  {selectedLoanDetails.photos.map(p => (
                    <div key={p.id} className="relative rounded overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                      <img src={p.photo_url} alt={p.photo_type} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white px-2 py-0.5 rounded finance-small-label">
                        {p.photo_type}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Col 2 & 3: Ledger statement, Dues schedule, Transaction history */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Financial balance */}
            <Card title="Account Repayment Balance Statement" subtitle="Current status breakdown">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500 block finance-small-label uppercase">Total Repayable</span>
                  <span className="text-gray-900 finance-brand">₹{summary.totalPayable.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <span className="text-green-700 block finance-small-label uppercase">Total Collected</span>
                  <span className="text-green-800 finance-brand">₹{summary.totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <span className="text-orange-700 block finance-small-label uppercase">Outstanding Bal</span>
                  <span className="text-orange-800 finance-brand">₹{summary.outstanding.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500 block finance-small-label uppercase">Instalment Status</span>
                  <span className="text-gray-900 mt-1 block finance-header-time">
                    {summary.paidDues} Paid / {summary.pendingDues} Pend
                  </span>
                </div>
              </div>
            </Card>

            {/* Dues Schedule Grid */}
            <Card title="Payment Schedule (Calendar)" subtitle="Tracking expectations per instalment date">
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                {selectedLoanDetails.dues.map((due, idx) => (
                  <div
                    key={due.id}
                    className={`p-2 border rounded-lg flex flex-col items-center justify-between text-center relative ${
                      due.status === 'Paid' ? 'bg-green-50 border-green-200 text-green-800' :
                      due.status === 'Partially Paid' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                      'bg-red-50 border-red-100 text-red-800'
                    }`}
                  >
                    <span className="block finance-small-label">{idx + 1}</span>
                    <span className="text-[9px] my-1 font-mono finance-input">
                      {new Date(due.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="block finance-small-label">₹{Number(due.amount).toFixed(0)}</span>
                    
                    {due.paid_amount > 0 && due.status !== 'Paid' && (
                      <span className="text-[8px] text-gray-500 block mt-0.5 finance-input">Rec: ₹{Number(due.paid_amount).toFixed(0)}</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Transaction Ledger list */}
            <Card title="Transaction Logs" subtitle="Disbursements and Collection entries logged for this account" className="shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 finance-caption">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-3 text-left text-gray-500 finance-input uppercase">Date</th>
                      <th className="px-3 py-3 text-left text-gray-500 finance-input uppercase">Type</th>
                      <th className="px-3 py-3 text-left text-gray-500 finance-input uppercase">Staff / Collected By</th>
                      <th className="px-3 py-3 text-left text-gray-500 finance-input uppercase">Remarks</th>
                      <th className="px-3 py-3 text-right text-gray-500 finance-input uppercase">Amount</th>
                      <th className="px-3 py-3 text-right text-gray-500 finance-input uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {selectedLoanDetails.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full ${ tx.type === 'Collection' ? 'bg-green-100 text-green-800' : tx.type === 'Disbursement' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800' } finance-input`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 finance-input">
                          {tx.collected_by || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">
                          {tx.remarks || '-'}
                        </td>
                        <td className={`px-3 py-2.5 text-right ${ tx.type === 'Collection' ? 'text-green-600' : 'text-blue-600' } finance-input`}>
                          ₹{Number(tx.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <Button
                            onClick={() => handleDeleteTransaction(tx.id, tx.type)}
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            disabled={tx.type === 'Disbursement'}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border border-dashed rounded-lg py-20 bg-gray-50/30">
          <SearchIcon className="w-12 h-12 text-gray-400 stroke-1 mb-2" />
          <p className="finance-small-label uppercase">Account Detail Panel is idle</p>
          <p className="finance-small-label uppercase">Use the search box above to lookup customer records and make collections</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
