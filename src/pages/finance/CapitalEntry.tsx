import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import { supabaseFinance, FinancePartner, FinanceCapitalEntry } from '../../lib/supabaseFinance';
import { 
  ArrowLeft, 
  Printer, 
  Save, 
  RotateCcw, 
  Trash2, 
  Edit2, 
  Info 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { useAuth } from '../../contexts/AuthContext';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface DisplayCapitalEntry extends FinanceCapitalEntry {
  partner?: FinancePartner;
  running_balance?: number;
}

const CapitalEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data States
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [entries, setEntries] = useState<DisplayCapitalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States (New / Edit Entry)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [partnerId, setPartnerId] = useState('');
  const [particulars, setParticulars] = useState('');
  const [credit, setCredit] = useState('');
  const [debit, setDebit] = useState('');
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const dateRef = React.useRef<HTMLInputElement>(null);
  const partnerIdRef = React.useRef<HTMLSelectElement>(null);

  const creditRef = React.useRef<HTMLInputElement>(null);
  const debitRef = React.useRef<HTMLInputElement>(null);


  // Bulk Distribution States
  const [bulkCreditAmount, setBulkCreditAmount] = useState('');
  const [bulkDebitAmount, setBulkDebitAmount] = useState('');
  const [bulkPosting, setBulkPosting] = useState(false);

  // Print Preview Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = await supabaseFinance.getPartners();
      setPartners(p);

      const e = await supabaseFinance.getCapitalEntries();
      setEntries(e);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load capital database details');
    } finally {
      setLoading(false);
    }
  };

  // Mutually exclusive Credit/Debit inputs handlers
  const handleCreditChange = (val: string) => {
    setCredit(val);
    if (val) setDebit('');
  };

  const handleDebitChange = (val: string) => {
    setDebit(val);
    if (val) setCredit('');
  };

  const handleResetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPartnerId('');
    setParticulars('');
    setCredit('');
    setDebit('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const creditAmt = Number(credit) || 0;
    const debitAmt = Number(debit) || 0;

    const fields: ValidationField[] = [
      { name: 'date', label: 'Date', value: date, required: true, ref: dateRef },
      { name: 'partnerId', label: 'Partner', value: partnerId, required: true, ref: partnerIdRef as any },
      { 
        name: 'amount_xor', 
        label: 'Credit or Debit', 
        value: 'checked', 
        required: true, 
        customValidation: () => (creditAmt > 0 || debitAmt > 0) ? null : 'Please enter a valid Credit or Debit amount greater than zero'
      }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;


    const selectedPartner = partners.find(p => p.id === partnerId);
    if (!selectedPartner) {
      toast.error('Invalid partner selected');
      return;
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';
      const payload = {
        entry_date: date,
        partner_id: partnerId,
        partner_name: selectedPartner.name,
        particulars: particulars.trim() || (creditAmt > 0 ? 'Capital Introduced' : 'Drawings/Withdrawal'),
        credit: creditAmt,
        debit: debitAmt,
        created_by: staffName
      };

      let result;
      if (editingId) {
        result = await supabaseFinance.updateCapitalEntry(editingId, payload, staffName);
      } else {
        result = await supabaseFinance.createCapitalEntry(payload);
      }

      if (result) {
        toast.success(editingId ? 'Capital transaction updated successfully' : 'Capital entry recorded successfully');
        handleResetForm();
        fetchData();
      } else {
        toast.error('Failed to save capital entry');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong during save');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (entry: DisplayCapitalEntry) => {
    setEditingId(entry.id);
    setDate(entry.entry_date);
    setPartnerId(entry.partner_id);
    setParticulars(entry.particulars || '');
    setCredit(entry.credit > 0 ? String(entry.credit) : '');
    setDebit(entry.debit > 0 ? String(entry.debit) : '');
    
    // Scroll smoothly to top form card
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success('Loaded transaction details into editor');
  };

  const handleDelete = async (id: string, particularsStr: string) => {
    if (!window.confirm(`Are you sure you want to delete entry "${particularsStr}"?`)) return;
    const deleteToastId = toast.loading('Deleting capital entry...');
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteCapitalEntry(id, staffName);
      if (success) {
        toast.success('Capital entry deleted successfully', { id: deleteToastId });
        fetchData();
      } else {
        toast.error('Failed to delete entry', { id: deleteToastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Deletion failed', { id: deleteToastId });
    }
  };

  // Bulk Distribution Handlers
  const handleBulkSubmit = async (type: 'Credit' | 'Debit') => {
    const inputAmt = type === 'Credit' ? bulkCreditAmount : bulkDebitAmount;
    const amount = Number(inputAmt);

    if (!inputAmt || isNaN(amount) || amount <= 0) {
      toast.error(`Please enter a valid bulk ${type.toLowerCase()} amount`);
      return;
    }

    if (partners.length === 0) {
      toast.error('No partners registered to distribute funds');
      return;
    }

    const splitAmount = parseFloat((amount / partners.length).toFixed(2));
    const confirmMsg = `Are you sure you want to ${type === 'Credit' ? 'credit' : 'debit'} ₹${amount.toLocaleString('en-IN')} equally across ${partners.length} partners (₹${splitAmount.toLocaleString('en-IN')} each)?`;

    if (!window.confirm(confirmMsg)) return;

    setBulkPosting(true);
    const bulkToastId = toast.loading(`Posting bulk ${type.toLowerCase()} entries...`);
    try {
      const staffName = user?.username || 'Staff';
      const bulkEntries = partners.map(p => ({
        entry_date: date, // Use currently selected date in the main form
        partner_id: p.id,
        partner_name: p.name,
        particulars: `Bulk ${type} Distribution (Total ₹${amount.toLocaleString('en-IN')})`,
        credit: type === 'Credit' ? splitAmount : 0,
        debit: type === 'Debit' ? splitAmount : 0,
        created_by: staffName
      }));

      const result = await supabaseFinance.createCapitalEntries(bulkEntries);
      if (result) {
        toast.success(`Bulk ${type.toLowerCase()} entries posted successfully`, { id: bulkToastId });
        if (type === 'Credit') setBulkCreditAmount('');
        else setBulkDebitAmount('');
        fetchData();
      } else {
        toast.error('Failed to post bulk entries', { id: bulkToastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong during bulk post', { id: bulkToastId });
    } finally {
      setBulkPosting(false);
    }
  };

  // Calculations for Totals & Balances
  const summaries = useMemo(() => {
    let totalCapitalIn = 0;
    let totalDrawings = 0;

    entries.forEach(e => {
      totalCapitalIn += e.credit || 0;
      totalDrawings += e.debit || 0;
    });

    return {
      totalCapitalIn,
      totalDrawings,
      netValue: totalCapitalIn - totalDrawings
    };
  }, [entries]);

  // Partner specific ledger balances calculation
  const partnerBalances = useMemo(() => {
    const balancesMap: Record<string, { partnerName: string; capitalIn: number; drawings: number }> = {};
    
    // Initialize with all current partners
    partners.forEach(p => {
      balancesMap[p.id] = {
        partnerName: p.name,
        capitalIn: 0,
        drawings: 0
      };
    });

    // Populate balances from transaction entries
    entries.forEach(e => {
      if (!balancesMap[e.partner_id]) {
        // Fallback for partner records that might be deleted
        balancesMap[e.partner_id] = {
          partnerName: e.partner_name || 'Unknown Partner',
          capitalIn: 0,
          drawings: 0
        };
      }
      balancesMap[e.partner_id].capitalIn += e.credit || 0;
      balancesMap[e.partner_id].drawings += e.debit || 0;
    });

    return Object.keys(balancesMap).map(pId => ({
      partnerId: pId,
      partnerName: balancesMap[pId].partnerName,
      capitalIn: balancesMap[pId].capitalIn,
      drawings: balancesMap[pId].drawings,
      netBalance: balancesMap[pId].capitalIn - balancesMap[pId].drawings
    })).sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [partners, entries]);

  // Chronologically calculated running ledger balance list
  const entriesWithRunningBalance = useMemo(() => {
    // Sort oldest to newest
    const sortedOldest = [...entries].sort((a, b) => {
      const dateCompare = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    let runningBal = 0;
    const mapped = sortedOldest.map(e => {
      runningBal += (e.credit || 0) - (e.debit || 0);
      return {
        ...e,
        running_balance: runningBal
      };
    });

    // Return newest first for standard ledger view
    return mapped.reverse();
  }, [entries]);


  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none print:p-0">
      
      {/* Top Header Actions Bar */}
      <div className={`flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 ${showPrintModal ? 'print:hidden' : 'no-print'}`}>
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">CAPITAL</span>
          </div>
          <h1 className="mt-1 finance-h1">CAPITAL ENTRY</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            Partner capital contributions, drawings, and balances
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
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            PRINT
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${showPrintModal ? 'print:hidden' : 'no-print'}`}>
        
        {/* Left Column (Forms & Transactions) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* New Entry Form Card */}
          <Card 
            title={
              <span className="text-slate-900 finance-header-time uppercase">
                {editingId ? 'EDIT CAPITAL ENTRY' : 'NEW ENTRY'}
              </span>
            }
            subtitle={
              <span className="text-slate-400 finance-small-label uppercase">
                {editingId ? 'MODIFY PARTNER LEDGER ENTRY RECORD' : 'RECORD PARTNER DEPOSITS OR DRAWINGS'}
              </span>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="finance-caption uppercase">
                    DATE <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setErrors(p => ({...p, date: false})) }}
                    ref={dateRef}
                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none h-9 shadow-sm finance-header-time ${errors.date ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}
                    required
                    
                  />
                </div>

                <div>
                  <label className="finance-caption uppercase">
                    PARTNER <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={partnerId}
                    onChange={(e) => { setPartnerId(e.target.value); setErrors(p => ({...p, partnerId: false})) }}
                    ref={partnerIdRef as any}
                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none h-9 shadow-sm finance-header-time ${errors.partnerId ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}
                    required
                    
                  >
                    <option value="">SELECT PARTNER</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="finance-caption uppercase">
                  PARTICULARS
                </label>
                <input
                  type="text"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  placeholder="e.g. CAPITAL INTRODUCTION / OFFICE DRAWINGS"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none shadow-sm finance-header-time"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="finance-caption uppercase">
                    CREDIT (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={credit}
                    onChange={(e) => { handleCreditChange(e.target.value); setErrors(p => ({...p, amount_xor: false})) }}
                    ref={creditRef}
                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm finance-header-time ${errors.amount_xor ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}
                    disabled={!!debit}
                    placeholder="0.00"
                    
                  />
                </div>

                <div>
                  <label className="finance-caption uppercase">
                    DEBIT (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={debit}
                    onChange={(e) => { handleDebitChange(e.target.value); setErrors(p => ({...p, amount_xor: false})) }}
                    ref={debitRef}
                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 shadow-sm finance-header-time ${errors.amount_xor ? "border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500" : "border-slate-200 focus:ring-1 focus:ring-slate-900"}`}
                    disabled={!!credit}
                    placeholder="0.00"
                    
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RESET
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
            </form>
          </Card>

          {/* Bulk Distribution Card */}
          <Card
            title={
              <span className="text-slate-900 finance-header-time uppercase">
                BULK DISTRIBUTION
              </span>
            }
            subtitle={
              <span className="text-slate-400 finance-small-label uppercase">
                SPLITS AMOUNT EQUALLY ACROSS {partners.length} PARTNER(S)
              </span>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Credit All Group */}
              <div className="space-y-2">
                <label className="finance-caption uppercase">
                  CREDIT ALL AMOUNT (₹)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={bulkCreditAmount}
                    onChange={(e) => setBulkCreditAmount(e.target.value)}
                    placeholder="Total amount to credit"
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkSubmit('Credit')}
                    disabled={bulkPosting}
                    className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 finance-header-time"
                  >
                    CREDIT ALL
                  </button>
                </div>
              </div>

              {/* Debit All Group */}
              <div className="space-y-2">
                <label className="finance-caption uppercase">
                  DEBIT ALL AMOUNT (₹)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={bulkDebitAmount}
                    onChange={(e) => setBulkDebitAmount(e.target.value)}
                    placeholder="Total amount to debit"
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-9 shadow-sm finance-header-time"
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkSubmit('Debit')}
                    disabled={bulkPosting}
                    className="inline-flex items-center justify-center px-4 py-2 bg-red-650 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 finance-header-time"
                  >
                    DEBIT ALL
                  </button>
                </div>
              </div>

            </div>
          </Card>

          {/* Transactions Card */}
          <Card
            title={
              <span className="text-slate-900 finance-header-time uppercase">
                TRANSACTIONS
              </span>
            }
            subtitle={
              <span className="text-slate-400 finance-small-label uppercase">
                {entriesWithRunningBalance.length} ENTRIES RECORDED
              </span>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
                <p className="text-slate-400 finance-small-label uppercase">Loading capital entries...</p>
              </div>
            ) : entriesWithRunningBalance.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                <Info className="w-8 h-8 text-slate-350 mx-auto" />
                <h3 className="text-slate-800 finance-header-time uppercase">NO TRANSACTIONS</h3>
                <p className="text-slate-400 max-w-xs mx-auto finance-small-label uppercase">
                  Post entries from the form above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-150 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-3 py-2.5 text-left text-slate-500 finance-input uppercase">Date</th>
                      <th className="px-3 py-2.5 text-left text-slate-500 finance-input uppercase">Partner</th>
                      <th className="px-3 py-2.5 text-left text-slate-500 finance-input uppercase">Particulars</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Credit (Cr)</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Debit (Dr)</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Balance</th>
                      <th className="px-3 py-2.5 text-left text-slate-500 finance-input uppercase">By</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {entriesWithRunningBalance.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/20">
                        <td className="px-3 py-3 text-slate-700 finance-input">
                          {e.entry_date.split('-').reverse().join('/')}
                        </td>
                        <td className="px-3 py-3 text-slate-900 finance-input">
                          {e.partner_name?.toUpperCase() || e.partner?.name?.toUpperCase() || '—'}
                        </td>
                        <td className="px-3 py-3 text-slate-650 max-w-[200px] truncate finance-input" title={e.particulars || ''}>
                          {e.particulars || '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-600 finance-input">
                          {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-red-650 finance-input">
                          {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-800 finance-input">
                          ₹{(e.running_balance || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-slate-500 finance-input uppercase">
                          {e.created_by || 'STAFF'}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditClick(e)}
                              title="Edit Entry"
                              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(e.id, e.particulars || '')}
                              title="Delete Entry"
                              className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (Totals Summary & Partner Balances) */}
        <div className="space-y-6">
          
          {/* Total Capital In Card */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm">
            <h4 className="text-slate-400 finance-small-label uppercase">
              TOTAL CAPITAL IN
            </h4>
            <div className="font-mono mt-1 text-emerald-600 finance-money">
              ₹{summaries.totalCapitalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Total Drawings Card */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm">
            <h4 className="text-slate-400 finance-small-label uppercase">
              TOTAL DRAWINGS
            </h4>
            <div className="font-mono mt-1 text-red-650 finance-money">
              ₹{summaries.totalDrawings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Partner Balances Card */}
          <Card
            title={
              <div className="flex justify-between items-center w-full">
                <span className="text-slate-900 finance-header-time uppercase">
                  PARTNER BALANCES
                </span>
                <span className="px-1.5 py-0.5 text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md finance-input uppercase">
                  LIVE
                </span>
              </div>
            }
            subtitle={
              <span className="text-slate-400 finance-small-label uppercase">
                {partnerBalances.length} PARTNERS · NET ₹{summaries.netValue.toLocaleString('en-IN')}
              </span>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-slate-900"></div>
              </div>
            ) : partnerBalances.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl space-y-2">
                <h3 className="text-slate-800 finance-header-time uppercase">NO PARTNERS</h3>
                <p className="text-[9px] text-slate-400 max-w-[180px] mx-auto finance-input uppercase">
                  Register partners first to track capital.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full finance-caption">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left text-slate-500 finance-input uppercase">Partner</th>
                      <th className="pb-2 text-right text-slate-500 finance-input uppercase">Capital In</th>
                      <th className="pb-2 text-right text-slate-500 finance-input uppercase">Drawings</th>
                      <th className="pb-2 text-right text-slate-500 finance-input uppercase">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {partnerBalances.map((pb) => (
                      <tr key={pb.partnerId} className="hover:bg-slate-50/30">
                        <td className="py-2.5 text-slate-850 finance-input uppercase">
                          {pb.partnerName}
                        </td>
                        <td className="py-2.5 text-right font-mono text-emerald-600 finance-input">
                          ₹{pb.capitalIn.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 text-right font-mono text-red-650 finance-input">
                          ₹{pb.drawings.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-900 finance-input">
                          ₹{pb.netBalance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* MODAL: Print Preview Panel */}
      <FinancePrintPreview
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Capital Entry Ledger"
        documentTitle={`PARTNER CAPITAL & DRAWINGS LEDGER STATEMENT`}
      >
        <div className="text-center pb-6 border-b-2 border-slate-900">
          <h2 className="finance-brand">TIRUMALA FINANCE</h2>
          <p className="mt-1 finance-header-time uppercase">PARTNER CAPITAL & DRAWINGS LEDGER STATEMENT</p>
          <p className="text-slate-600 mt-0.5 finance-small-label">
            PRINTED DATE: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Total Summaries Section */}
        <div className="grid grid-cols-3 gap-4 py-6 border-b border-slate-300 font-sans finance-caption">
          <div>
            <p className="text-slate-500 finance-input uppercase">TOTAL CAPITAL IN:</p>
            <p className="text-emerald-600 mt-1 finance-brand">₹{summaries.totalCapitalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-slate-500 finance-input uppercase">TOTAL DRAWINGS:</p>
            <p className="text-red-600 mt-1 finance-brand">₹{summaries.totalDrawings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 finance-input uppercase">NET CAPITAL VALUE:</p>
            <p className="text-slate-900 mt-1 finance-brand">₹{summaries.netValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Table 1: Partner Balances */}
        <div className="my-6">
          <h3 className="mb-2 border-b border-slate-300 pb-1 finance-header-time uppercase">1. PARTNER BALANCES</h3>
          <table className="min-w-full divide-y divide-slate-800 border border-slate-300 finance-caption">
            <thead>
              <tr className="bg-slate-100 text-slate-800 finance-input uppercase">
                <th className="border border-slate-300 px-2 py-2 text-left">Partner</th>
                <th className="border border-slate-300 px-2 py-2 text-right">Capital In (Cr)</th>
                <th className="border border-slate-300 px-2 py-2 text-right">Drawings (Dr)</th>
                <th className="border border-slate-300 px-2 py-2 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {partnerBalances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-slate-400 finance-input uppercase">No partners registered.</td>
                </tr>
              ) : (
                partnerBalances.map(pb => (
                  <tr key={pb.partnerId} className="text-slate-900 finance-input">
                    <td className="border border-slate-300 px-2 py-2 finance-input uppercase">{pb.partnerName}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono">₹{pb.capitalIn.toLocaleString('en-IN')}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono">₹{pb.drawings.toLocaleString('en-IN')}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono finance-input">₹{pb.netBalance.toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table 2: Transactions List */}
        <div className="my-6">
          <h3 className="mb-2 border-b border-slate-300 pb-1 finance-header-time uppercase">2. TRANSACTION HISTORY</h3>
          <table className="min-w-full divide-y divide-slate-800 border border-slate-300 finance-caption">
            <thead>
              <tr className="bg-slate-100 text-slate-800 finance-input uppercase">
                <th className="border border-slate-300 px-2 py-2 text-left">Date</th>
                <th className="border border-slate-300 px-2 py-2 text-left">Partner</th>
                <th className="border border-slate-300 px-2 py-2 text-left">Particulars</th>
                <th className="border border-slate-300 px-2 py-2 text-right">Credit (Cr)</th>
                <th className="border border-slate-300 px-2 py-2 text-right">Debit (Dr)</th>
                <th className="border border-slate-300 px-2 py-2 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entriesWithRunningBalance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-slate-400 finance-input uppercase">No transactions logged.</td>
                </tr>
              ) : (
                entriesWithRunningBalance.map(e => (
                  <tr key={e.id} className="text-slate-900 finance-input">
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{e.entry_date.split('-').reverse().join('/')}</td>
                    <td className="border border-slate-300 px-2 py-2 finance-input uppercase">{e.partner_name || e.partner?.name || '—'}</td>
                    <td className="border border-slate-300 px-2 py-2 max-w-[200px] break-words finance-input uppercase">{e.particulars || '—'}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono text-emerald-700 finance-input">{e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono text-red-700 finance-input">{e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="border border-slate-300 px-2 py-2 text-right font-mono finance-input">₹{(e.running_balance || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-center mt-20 pt-8 border-t border-slate-300 finance-header-time uppercase">
          <div>
            <p>CASHIER SIGNATURE</p>
            <p className="text-slate-400 mt-8 finance-small-label">AUTHORIZED SIGNATORY</p>
          </div>
          <div className="text-right">
            <p>VERIFIED BY MANAGER</p>
            <p className="text-slate-400 mt-8 finance-small-label">PARTNER AUDIT SIGN</p>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default CapitalEntry;
