import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance, FinanceCustomer, FinancePartner } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabaseDatabase';
import { 
  ArrowLeft, 
  Check, 
  Plus, 
  Trash2, 
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { useAuth } from '../../contexts/AuthContext';

interface RenewalRow {
  id: string;
  date: string;
  interest: string;
  penalty: string;
  partialPaid: string;
}

const OldDataEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Lists
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const custNameRef = useRef<HTMLInputElement>(null);
  const loanNumberRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const loanDateRef = useRef<HTMLInputElement>(null);
  const billingPeriodRef = useRef<HTMLInputElement>(null);
  const principalRef = useRef<HTMLInputElement>(null);


  // Form State - Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custFatherName, setCustFatherName] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // Form State - Loan Basics
  const [ledgerType, setLedgerType] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('CD');
  const [loanNumber, setLoanNumber] = useState('');
  const [rate, setRate] = useState('3');
  const [loanDate, setLoanDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('60');
  const [principal, setPrincipal] = useState('');
  const [holdPercent, setHoldPercent] = useState('3');
  const [docCharges, setDocCharges] = useState('');
  const [particulars, setParticulars] = useState('OLD DATA MIGRATION');

  // Form State - Past Renewals
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);

  // Fetch initial collections
  useEffect(() => {
    fetchCustomers();
    fetchPartners();
  }, []);

  const fetchCustomers = async () => {
    try {
      const custs = await supabaseFinance.getCustomers();
      setCustomers(custs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customers list');
    }
  };

  const fetchPartners = async () => {
    try {
      const prts = await supabaseFinance.getPartners();
      setPartners(prts);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load partners list');
    }
  };

  // Helper: Date Difference
  const getDaysBetween = (date1Str: string, date2Str: string): number => {
    if (!date1Str || !date2Str) return 0;
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Customer Select Autofill
  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    if (!id) {
      setCustName('');
      setCustFatherName('');
      setCustAadhaar('');
      setCustPhone('');
      setCustAddress('');
      setSelectedPartnerId('');
      setPartnerName('');
      return;
    }
    const c = customers.find(cust => cust.id === id);
    if (c) {
      setCustName(c.name || '');
      setCustFatherName(c.father_name || c.father_husband_name || '');
      setCustAadhaar(c.aadhaar || '');
      setCustPhone(c.phone || c.phone_1 || '');
      setCustAddress(c.address || c.present_address || '');
      
      if (c.partner_name) {
        const p = partners.find(part => part.name === c.partner_name);
        if (p) {
          setSelectedPartnerId(p.id);
          setPartnerName(p.name);
        } else {
          setSelectedPartnerId('');
          setPartnerName(c.partner_name);
        }
      } else {
        setSelectedPartnerId('');
        setPartnerName('');
      }
    }
  };

  // Partner select autofill name
  const handlePartnerSelect = (id: string) => {
    setSelectedPartnerId(id);
    if (!id) {
      setPartnerName('');
      return;
    }
    const p = partners.find(part => part.id === id);
    if (p) {
      setPartnerName(p.name);
    }
  };

  // Past Renewals Handlers
  const handleAddRenewal = () => {
    const newRenewal: RenewalRow = {
      id: Math.random().toString(36).substr(2, 9),
      date: '',
      interest: '',
      penalty: '',
      partialPaid: ''
    };
    setRenewals([...renewals, newRenewal]);
  };

  const handleRenewalChange = (id: string, field: keyof RenewalRow, value: string) => {
    setRenewals(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDeleteRenewal = (id: string) => {
    setRenewals(prev => prev.filter(r => r.id !== id));
  };

  // Computed days for renewals
  const computedRenewals = useMemo(() => {
    return renewals.map((renew, idx) => {
      const prevDateStr = idx === 0 ? loanDate : renewals[idx - 1].date;
      const days = getDaysBetween(prevDateStr, renew.date);
      return {
        ...renew,
        days
      };
    });
  }, [renewals, loanDate]);

  // Chronological sorted renewals for posting & preview
  const sortedRenewals = useMemo(() => {
    return [...computedRenewals].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [computedRenewals]);

  // Summary Computations
  const parsedPrincipal = useMemo(() => parseFloat(principal) || 0, [principal]);
  const parsedHoldPercent = useMemo(() => parseFloat(holdPercent) || 0, [holdPercent]);
  const holdAmount = useMemo(() => parsedPrincipal * (parsedHoldPercent / 100), [parsedPrincipal, parsedHoldPercent]);
  const parsedDocCharges = useMemo(() => parseFloat(docCharges) || 0, [docCharges]);
  const netDisbursement = useMemo(() => parsedPrincipal - holdAmount - parsedDocCharges, [parsedPrincipal, holdAmount, parsedDocCharges]);
  const renewalsCount = useMemo(() => renewals.length, [renewals]);

  const totalInterestPosted = useMemo(() => {
    return renewals.reduce((sum, r) => sum + (parseFloat(r.interest) || 0), 0);
  }, [renewals]);

  const totalPenaltyPosted = useMemo(() => {
    return renewals.reduce((sum, r) => sum + (parseFloat(r.penalty) || 0), 0);
  }, [renewals]);

  const totalPartialCollected = useMemo(() => {
    return renewals.reduce((sum, r) => sum + (parseFloat(r.partialPaid) || 0), 0);
  }, [renewals]);

  // Accrued Forward Computations
  const todayStr = useMemo(() => getLocalBusinessDateISO(), []);

  const lastReferenceDate = useMemo(() => {
    if (sortedRenewals.length > 0) {
      const lastRenew = sortedRenewals[sortedRenewals.length - 1];
      if (lastRenew.date) return lastRenew.date;
    }
    return loanDate;
  }, [sortedRenewals, loanDate]);

  const daysElapsedToToday = useMemo(() => {
    if (!lastReferenceDate) return 0;
    return getDaysBetween(lastReferenceDate, todayStr);
  }, [lastReferenceDate, todayStr]);

  const accruedForwardInterest = useMemo(() => {
    const P = parsedPrincipal - totalPartialCollected;
    if (P <= 0 || daysElapsedToToday <= 0) return 0;
    const R = parseFloat(rate) || 0;
    const months = daysElapsedToToday / 30;
    const interest = P * (R / 100) * months;
    return Math.round(interest);
  }, [parsedPrincipal, totalPartialCollected, daysElapsedToToday, rate]);

  // Ledger Preview
  const ledgerPreviewRows = useMemo(() => {
    const P = parsedPrincipal;
    if (P <= 0 || !loanDate) return [];

    const docFees = parsedDocCharges;

    const rows: { date: string; particulars: string; debit: number; credit: number; balance: number }[] = [];
    
    let currentBal = P;
    
    // 1. Disbursement
    rows.push({
      date: loanDate,
      particulars: `${ledgerType} A/C (DEBIT)`,
      debit: P,
      credit: 0,
      balance: currentBal
    });

    // 2. Hold Commission
    if (holdAmount > 0) {
      currentBal -= holdAmount;
      rows.push({
        date: loanDate,
        particulars: `${ledgerType} COMMISSION (${holdPercent}% HOLD)`,
        debit: 0,
        credit: holdAmount,
        balance: currentBal
      });
    }

    // 3. Document Charges
    if (docFees > 0) {
      currentBal -= docFees;
      rows.push({
        date: loanDate,
        particulars: `${ledgerType} DOC CHARGES`,
        debit: 0,
        credit: docFees,
        balance: currentBal
      });
    }

    // 4. Renewals
    sortedRenewals.forEach(r => {
      if (!r.date) return;
      const interestVal = parseFloat(r.interest) || 0;
      const penaltyVal = parseFloat(r.penalty) || 0;
      const partialVal = parseFloat(r.partialPaid) || 0;

      if (interestVal > 0) {
        currentBal -= interestVal;
        rows.push({
          date: r.date,
          particulars: `${ledgerType} COMMISSION`,
          debit: 0,
          credit: interestVal,
          balance: currentBal
        });
      }

      if (penaltyVal > 0) {
        currentBal -= penaltyVal;
        rows.push({
          date: r.date,
          particulars: `PENALTY ${ledgerType}`,
          debit: 0,
          credit: penaltyVal,
          balance: currentBal
        });
      }

      if (partialVal > 0) {
        currentBal -= partialVal;
        rows.push({
          date: r.date,
          particulars: `PARTIAL PRINCIPAL PAID`,
          debit: 0,
          credit: partialVal,
          balance: currentBal
        });
      }
    });

    return rows;
  }, [parsedPrincipal, holdAmount, parsedDocCharges, loanDate, ledgerType, sortedRenewals, holdPercent]);

  // Submission / DB migration posting
  const handleSubmit = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();


    const fields: ValidationField[] = [
      { name: 'loanNumber', label: 'Loan Number', value: loanNumber, required: true, ref: loanNumberRef },
      { name: 'loanDate', label: 'Loan Date', value: loanDate, required: true, ref: loanDateRef },
      { name: 'principal', label: 'Principal', value: principal, required: true, ref: principalRef },
      { name: 'rate', label: 'Rate', value: rate, required: true, ref: rateRef },
      { name: 'billingPeriod', label: 'Billing Period', value: billingPeriod, required: true, ref: billingPeriodRef },
    ];
    if (!selectedCustomerId) {
      fields.push({ name: 'custName', label: 'Customer Name', value: custName, required: true, ref: custNameRef });
    }
    
    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;

    if (parsedPrincipal <= 0) {
      toast.error('Principal must be greater than 0');
      return;
    }


    // Validate renewal rows
    for (const r of renewals) {
      if (!r.date) {
        toast.error('All renewal rows must have a valid date');
        return;
      }
      if (new Date(r.date) < new Date(loanDate)) {
        toast.error('Renewal dates must be after or on the original Loan Date');
        return;
      }
    }

    setSaving(true);
    const savingToastId = toast.loading('Posting historic loan details and ledger...');
    try {
      const staffName = user?.username || 'Staff';
      let resolvedCustomerId = selectedCustomerId;

      // 1. Check duplicate Aadhaar if creating new customer
      if (!resolvedCustomerId && custAadhaar.trim()) {
        const { data: dupCust } = await supabase
          .from('finance_customers')
          .select('id, name')
          .eq('aadhaar', custAadhaar.trim())
          .maybeSingle();
        if (dupCust) {
          toast.error(`Customer with Aadhaar ${custAadhaar.trim()} already exists: ${dupCust.name}`, { id: savingToastId });
          setSaving(false);
          return;
        }
      }

      // 2. Check unique loanNumber in finance_loans
      const { data: dupLoan } = await supabase
        .from('finance_loans')
        .select('id')
        .eq('loan_id', loanNumber.trim())
        .maybeSingle();
      if (dupLoan) {
        toast.error(`Loan Number "${loanNumber.trim()}" already exists in the system.`, { id: savingToastId });
        setSaving(false);
        return;
      }

      // 3. Create or update customer
      if (!resolvedCustomerId) {
        const { data: newCust, error: custError } = await supabase
          .from('finance_customers')
          .insert([{
            name: custName.trim(),
            phone: custPhone || null,
            phone_1: custPhone || null,
            address: custAddress || null,
            present_address: custAddress || null,
            aadhaar: custAadhaar.trim() || null,
            father_husband_name: custFatherName || null,
            father_name: custFatherName || null,
            partner_name: partnerName || null
          }])
          .select()
          .single();

        if (custError) throw custError;
        resolvedCustomerId = newCust.id;
      } else {
        // Sync partner name and father name to customer if set
        await supabase
          .from('finance_customers')
          .update({
            partner_name: partnerName || null,
            father_name: custFatherName || null,
            father_husband_name: custFatherName || null
          })
          .eq('id', resolvedCustomerId);
      }

      // 4. Calculate dues parameters
      const billingDays = parseInt(billingPeriod) || 60;
      const durationMonths = Math.max(1, Math.ceil(billingDays / 30));
      const interestAmount = parsedPrincipal * (parseFloat(rate) / 100) * durationMonths;
      const totalRepayment = parsedPrincipal + interestAmount;
      const dueAmount = totalRepayment / billingDays;

      // 5. Insert Loan
      const { data: newLoan, error: loanError } = await supabase
        .from('finance_loans')
        .insert([{
          loan_id: loanNumber.trim(),
          customer_id: resolvedCustomerId,
          date: loanDate,
          amount: parsedPrincipal,
          interest_rate: parseFloat(rate),
          duration_months: durationMonths,
          due_type: 'Daily',
          due_amount: parseFloat(dueAmount.toFixed(2)),
          remarks: particulars || 'OLD DATA MIGRATION',
          status: 'Active',
          loan_category: ledgerType,
          period_days: ledgerType === 'CD' ? (billingDays || 30) : null
        }])
        .select()
        .single();

      if (loanError) throw loanError;

      // 6. Generate daily dues list
      const duesList = [];
      const startDateObj = new Date(loanDate);
      for (let i = 1; i <= billingDays; i++) {
        const dDate = new Date(startDateObj);
        dDate.setDate(startDateObj.getDate() + i);
        duesList.push({
          loan_id: newLoan.id,
          due_date: getLocalBusinessDateISO(dDate),
          amount: parseFloat(dueAmount.toFixed(2)),
          paid_amount: 0,
          status: 'Pending'
        });
      }

      const { error: duesError } = await supabase
        .from('finance_dues')
        .insert(duesList);
      if (duesError) throw duesError;

      // 7. Generate first 3 daybook transactions (Disbursement, Hold Commission, Doc Charges)
      const transactionsToInsert = [];
      
      // Disbursement (Debit)
      transactionsToInsert.push({
        loan_id: newLoan.id,
        date: loanDate,
        amount: parsedPrincipal,
        type: 'Disbursement',
        remarks: particulars || 'Loan Disbursed',
        collected_by: staffName,
        payment_mode: 'Cash'
      });

      // Hold Commission (Credit)
      if (holdAmount > 0) {
        transactionsToInsert.push({
          loan_id: newLoan.id,
          date: loanDate,
          amount: holdAmount,
          type: 'Collection',
          remarks: `${ledgerType} COMMISSION (${holdPercent}% HOLD)`,
          collected_by: staffName,
          payment_mode: 'Cash'
        });
      }

      // Doc Charges (Credit)
      if (parsedDocCharges > 0) {
        transactionsToInsert.push({
          loan_id: newLoan.id,
          date: loanDate,
          amount: parsedDocCharges,
          type: 'Collection',
          remarks: `${ledgerType} DOC CHARGES`,
          collected_by: staffName,
          payment_mode: 'Cash'
        });
      }

      // 8. Add past renewals transactions (Credit)
      sortedRenewals.forEach(r => {
        if (!r.date) return;
        const interestVal = parseFloat(r.interest) || 0;
        const penaltyVal = parseFloat(r.penalty) || 0;
        const partialVal = parseFloat(r.partialPaid) || 0;

        if (interestVal > 0) {
          transactionsToInsert.push({
            loan_id: newLoan.id,
            date: r.date,
            amount: interestVal,
            type: 'Collection',
            remarks: `${ledgerType} COMMISSION`,
            collected_by: staffName,
            payment_mode: 'Cash'
          });
        }

        if (penaltyVal > 0) {
          transactionsToInsert.push({
            loan_id: newLoan.id,
            date: r.date,
            amount: penaltyVal,
            type: 'Collection',
            remarks: `PENALTY ${ledgerType}`,
            collected_by: staffName,
            payment_mode: 'Cash'
          });
        }

        if (partialVal > 0) {
          transactionsToInsert.push({
            loan_id: newLoan.id,
            date: r.date,
            amount: partialVal,
            type: 'Collection',
            remarks: `PARTIAL PRINCIPAL PAID`,
            collected_by: staffName,
            payment_mode: 'Cash'
          });
        }
      });

      const { error: txError } = await supabase
        .from('finance_transactions')
        .insert(transactionsToInsert);
      if (txError) throw txError;

      // 9. Recalculate dues allocation
      await supabaseFinance.recalculateDuesForLoan(newLoan.id);

      toast.success(`Historic loan ${loanNumber} migrated successfully!`, { id: savingToastId });

      // 10. Redirect to the corresponding ledger page
      if (ledgerType === 'CD') {
        navigate('/finance/cd-ledger');
      } else if (ledgerType === 'HP') {
        navigate('/finance/hp-ledger');
      } else if (ledgerType === 'STBD') {
        navigate('/finance/stbd-ledger');
      } else if (ledgerType === 'TBD') {
        navigate('/finance/tbd-ledger');
      } else {
        navigate('/finance/general-ledger');
      }

    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error occurred while saving old loan data';
      toast.error(errMsg, { id: savingToastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span>LOANS</span>
            <span>/</span>
            <span className="text-slate-600">OLD-DATA ENTRY</span>
          </div>
          <h1 className="mt-1 finance-h1">OLD-DATA ENTRY</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            MIGRATE AN EXISTING CUSTOMER'S LOAN + FULL RENEWAL HISTORY — SYSTEM COMPUTES FORWARD DYNAMICALLY
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
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'CREATE LOAN + POST LEDGER'}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form entries */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Customer Details */}
          <Card 
            title={<span className="text-slate-900 finance-header-time uppercase">1. CUSTOMER</span>} 
            subtitle={<span className="text-slate-400 finance-small-label uppercase">PICK EXISTING TO AUTO-FILL, OR FILL IN MANUALLY</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="space-y-4">
              <div>
                <label className="finance-caption uppercase">
                  PICK EXISTING CUSTOMER
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-950 focus:outline-none finance-header-time"
                >
                  <option value="">— FRESH CUSTOMER —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : c.phone_1 ? `(${c.phone_1})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="CUSTOMER NAME" 
                  ref={custNameRef} error={errors.custName} value={custName} onChange={(val) => { setCustName(val); setErrors(p => ({...p, custName: false})) }} 
                  placeholder="Full Name" 
                  readOnly={!!selectedCustomerId} 
                  required 
                />
                <Input 
                  label="FATHER" 
                  value={custFatherName} 
                  onChange={setCustFatherName} 
                  placeholder="Father / Husband Name" 
                  readOnly={!!selectedCustomerId} 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input 
                  label="AADHAAR" 
                  value={custAadhaar} 
                  onChange={setCustAadhaar} 
                  placeholder="12-digit Aadhaar UID" 
                  readOnly={!!selectedCustomerId} 
                />
                <Input 
                  label="PHONE" 
                  value={custPhone} 
                  onChange={setCustPhone} 
                  placeholder="Phone Number" 
                  readOnly={!!selectedCustomerId} 
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  ADDRESS
                </label>
                <textarea
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Address details"
                  readOnly={!!selectedCustomerId}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-950 focus:outline-none h-16 disabled:bg-slate-50 disabled:cursor-not-allowed finance-header-time"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="finance-caption uppercase">
                    PARTNER
                  </label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => handlePartnerSelect(e.target.value)}
                    disabled={!!selectedCustomerId}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-950 focus:outline-none disabled:bg-slate-50 disabled:cursor-not-allowed finance-header-time"
                  >
                    <option value="">— SELECT PARTNER —</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input 
                  label="PARTNER NAME" 
                  value={partnerName} 
                  placeholder="Partner Name" 
                  readOnly={true} 
                />
              </div>
            </div>
          </Card>

          {/* Card 2: Loan Basics */}
          <Card
            title={<span className="text-slate-900 finance-header-time uppercase">2. LOAN BASICS (AS ORIGINALLY DISBURSED)</span>}
            subtitle={<span className="text-slate-400 finance-small-label uppercase">THESE CREATE THE FIRST 3 DAYBOOK ROWS: CD A/C (DEBIT) + CD COMMISSION (3% HOLD) + CD DOC CHARGES</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="finance-caption uppercase">
                    LEDGER TYPE
                  </label>
                  <select
                    value={ledgerType}
                    onChange={(e) => setLedgerType(e.target.value as 'CD' | 'STBD' | 'HP' | 'TBD' | 'L')}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-950 focus:outline-none finance-header-time"
                  >
                    <option value="CD">CASH DEPOSIT (CD)</option>
                    <option value="HP">HP LEDGER</option>
                    <option value="STBD">STBD LEDGER</option>
                    <option value="TBD">TBD LEDGER</option>
                    <option value="L">REGULAR (L)</option>
                  </select>
                </div>
                <Input
                  label="LOAN NUMBER"
                  ref={loanNumberRef} error={errors.loanNumber} value={loanNumber} onChange={(val) => { setLoanNumber(val); setErrors(p => ({...p, loanNumber: false})) }}
                  placeholder="e.g. CD-1020"
                  required
                />
                <Input
                  label="RATE (% / MONTH)"
                  type="number"
                  ref={rateRef} error={errors.rate} value={rate} onChange={(val) => { setRate(val); setErrors(p => ({...p, rate: false})) }}
                  step="0.01"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="LOAN DATE"
                  type="date"
                  ref={loanDateRef} error={errors.loanDate} value={loanDate} onChange={(val) => { setLoanDate(val); setErrors(p => ({...p, loanDate: false})) }}
                  required
                />
                <Input
                  label="DUE DATE (OPTIONAL)"
                  type="date"
                  value={dueDate}
                  onChange={setDueDate}
                />
                <Input
                  label="BILLING PERIOD (DAYS)"
                  type="number"
                  ref={billingPeriodRef} error={errors.billingPeriod} value={billingPeriod} onChange={(val) => { setBillingPeriod(val); setErrors(p => ({...p, billingPeriod: false})) }}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="PRINCIPAL (₹)"
                  type="number"
                  ref={principalRef} error={errors.principal} value={principal} onChange={(val) => { setPrincipal(val); setErrors(p => ({...p, principal: false})) }}
                  required
                />
                <Input
                  label="HOLD % (FLAT, 3% DEFAULT)"
                  type="number"
                  value={holdPercent}
                  onChange={setHoldPercent}
                  step="0.1"
                />
                <Input
                  label="DOCUMENT CHARGES (₹)"
                  type="number"
                  value={docCharges}
                  onChange={setDocCharges}
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  PARTICULARS
                </label>
                <textarea
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  placeholder="Migration details"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-850 focus:ring-1 focus:ring-slate-955 focus:outline-none h-16 finance-header-time"
                />
              </div>
            </div>
          </Card>

          {/* Card 3: Past Renewals */}
          <Card
            title={<span className="text-slate-900 finance-header-time uppercase">3. PAST RENEWALS (FROM ACCESS CD LEDGER)</span>}
            subtitle={<span className="text-slate-400 finance-small-label uppercase">EACH ROW = ONE DATE POSTING CD COMMISSION + PENALTY CD PAIR. DAYS AUTO-CALC FROM PREVIOUS DATE.</span>}
            headerActions={
              <button
                type="button"
                onClick={handleAddRenewal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
              >
                <Plus className="w-3.5 h-3.5 text-slate-550" />
                ADD RENEWAL
              </button>
            }
            className="shadow-sm border-slate-150 rounded-xl"
          >
            {renewals.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <Info className="w-8 h-8 mx-auto text-slate-350" />
                <div className="text-slate-700 finance-header-time uppercase">NO RENEWALS YET</div>
                <div className="text-slate-450 max-w-sm mx-auto finance-small-label">
                  CLICK ADD RENEWAL FOR EACH ROW IN THE OLD ACCESS CD LEDGER. LEAVE BLANK IF NO PAST RENEWALS.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="finance-small-label uppercase">Date</th>
                      <th className="finance-small-label uppercase">Days</th>
                      <th className="finance-small-label uppercase">Interest Paid</th>
                      <th className="finance-small-label uppercase">Penalty Paid</th>
                      <th className="finance-small-label uppercase">Partial Paid</th>
                      <th className="text-center finance-small-label uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {renewals.map((r, index) => (
                      <tr key={r.id} className="hover:bg-slate-50/20">
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={r.date}
                            onChange={(e) => handleRenewalChange(r.id, 'date', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-850 focus:outline-none focus:ring-1 focus:ring-slate-950 finance-header-time"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 shrink-0 finance-header-time">
                          {computedRenewals[index]?.days || 0} days
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={r.interest}
                            onChange={(e) => handleRenewalChange(r.id, 'interest', e.target.value)}
                            placeholder="₹0"
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-850 focus:outline-none focus:ring-1 focus:ring-slate-950 finance-header-time"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={r.penalty}
                            onChange={(e) => handleRenewalChange(r.id, 'penalty', e.target.value)}
                            placeholder="₹0"
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-850 focus:outline-none focus:ring-1 focus:ring-slate-955 finance-header-time"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={r.partialPaid}
                            onChange={(e) => handleRenewalChange(r.id, 'partialPaid', e.target.value)}
                            placeholder="₹0"
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-850 focus:outline-none focus:ring-1 focus:ring-slate-955 finance-header-time"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRenewal(r.id)}
                            className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Card 4: Ledger Preview */}
          <Card
            title={<span className="text-slate-900 finance-header-time uppercase">4. LEDGER PREVIEW — EXACTLY WHAT WILL POST</span>}
            subtitle={<span className="text-slate-400 finance-small-label uppercase">MIRRORS THE OLD ACCESS CD LEDGER LAYOUT</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            {ledgerPreviewRows.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <Info className="w-8 h-8 mx-auto text-slate-350" />
                <div className="text-slate-700 finance-header-time uppercase">NOTHING TO PREVIEW YET</div>
                <div className="text-slate-450 max-w-sm mx-auto finance-small-label">
                  ENTER PRINCIPAL TO SEE THE LEDGER ROWS.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-150 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-3 py-2.5 text-left text-slate-500 finance-input uppercase">Date</th>
                      <th className="px-3 py-2.5 text-left text-slate-500 finance-input uppercase">Particulars</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Debit (Dr)</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Credit (Cr)</th>
                      <th className="px-3 py-2.5 text-right text-slate-500 finance-input uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ledgerPreviewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        <td className="px-3 py-2.5 text-slate-700 finance-input">
                          {row.date ? new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 finance-input">
                          {row.particulars}
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-650 font-mono finance-input">
                          {row.debit > 0 ? `₹${row.debit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-green-650 font-mono finance-input">
                          {row.credit > 0 ? `₹${row.credit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-900 finance-input">
                          ₹{row.balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          
        </div>

        {/* Right Column: Summary & Info panels */}
        <div className="space-y-6">
          
          {/* Card 5: SUMMARY */}
          <Card
            title={<span className="text-slate-900 finance-header-time uppercase">SUMMARY</span>}
            subtitle={<span className="text-slate-400 finance-small-label uppercase">WHAT GETS SAVED TO THE NEW SYSTEM</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="space-y-3">
              {/* Principal Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 animate-pulse finance-input uppercase">PRINCIPAL</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  ₹{parsedPrincipal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Hold Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">HOLD ({holdPercent}%)</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  ₹{holdAmount.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Doc Charges Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">DOCUMENT CHARGES</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  ₹{parsedDocCharges.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Net Disbursement Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">NET DISBURSEMENT</span>
                <span className="text-green-650 mt-1 finance-brand">
                  ₹{netDisbursement.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Renewals Entered Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">RENEWALS ENTERED</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  {renewalsCount}
                </span>
              </div>

              {/* Interest Posted So Far Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">INTEREST POSTED SO FAR</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  ₹{totalInterestPosted.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Penalty Posted So Far Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">PENALTY POSTED SO FAR</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  ₹{totalPenaltyPosted.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Partial Collected Card */}
              <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-150 flex flex-col">
                <span className="text-[9px] text-slate-400 finance-input uppercase">PARTIAL COLLECTED</span>
                <span className="text-slate-850 mt-1 finance-brand">
                  ₹{totalPartialCollected.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Accrued forward details card */}
              {loanDate && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col space-y-1.5 mt-2">
                  <span className="text-[9px] text-slate-500 flex items-center gap-1 finance-input uppercase">
                    <Info className="w-3.5 h-3.5 shrink-0 text-slate-500" /> ACCRUED FORWARD STATUS
                  </span>
                  <div className="flex justify-between text-slate-600 finance-header-time">
                    <span>Last Reference Date:</span>
                    <span>{lastReferenceDate ? new Date(lastReferenceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 finance-header-time">
                    <span>Days elapsed to today:</span>
                    <span>{daysElapsedToToday} days</span>
                  </div>
                  <div className="flex justify-between text-slate-700 border-t border-slate-200 pt-1.5 mt-1.5 finance-header-time">
                    <span>Forward Accrued Interest:</span>
                    <span className="text-[#0b1329] finance-input">₹{accruedForwardInterest.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Card 6: HOW THIS WORKS */}
          <Card
            title={<span className="text-slate-900 finance-header-time uppercase">HOW THIS WORKS</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="text-slate-650 space-y-3 finance-header-time">
              <div className="flex gap-2">
                <span className="text-slate-800 finance-input">1.</span>
                <span>CREATES THE LOAN RECORD WITH ORIGINAL PRINCIPAL + LOAN DATE.</span>
              </div>
              <div className="flex gap-2 border-t border-slate-50 pt-2.5">
                <span className="text-slate-800 finance-input">2.</span>
                <span>
                  AUTO-POSTS THE FIRST 3 DAYBOOK ROWS: <span className="bg-slate-50 border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-700 finance-small-label">CD A/C (DEBIT)</span> + <span className="bg-slate-50 border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-700 finance-small-label">CD COMMISSION (3% HOLD)</span> + <span className="bg-slate-50 border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-700 finance-small-label">CD DOC CHARGES</span>.
                </span>
              </div>
              <div className="flex gap-2 border-t border-slate-50 pt-2.5">
                <span className="text-slate-800 finance-input">3.</span>
                <span>
                  EACH PAST RENEWAL ROW POSTS <span className="bg-slate-50 border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-700 finance-small-label">CD COMMISSION</span> + <span className="bg-slate-50 border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-700 finance-small-label">PENALTY CD</span> AT THE HISTORICAL DATE.
                </span>
              </div>
              <div className="flex gap-2 border-t border-slate-50 pt-2.5">
                <span className="text-slate-800 finance-input">4.</span>
                <span>SYSTEM THEN COMPUTES INTEREST/PENALTY/DUE FORWARD FROM LAST RENEWAL TO TODAY — DYNAMICALLY.</span>
              </div>
              <div className="flex gap-2 border-t border-slate-50 pt-2.5">
                <span className="text-slate-800 finance-input">5.</span>
                <span>REDIRECTS TO THE RENEWAL PAGE SO YOU CAN POST NEXT RENEWAL WHENEVER CUSTOMER COMES IN.</span>
              </div>
            </div>
          </Card>
          
        </div>

      </div>

    </div>
  );
};

export default OldDataEntry;
