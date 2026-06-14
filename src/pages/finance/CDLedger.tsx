import React, { useEffect, useState, useMemo } from 'react';

import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinanceTransaction, FinanceDue, FinanceDocument } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { financeCalculationService } from '../../services/financeCalculationService';
import { 
  Printer, 
  Download, 
  RefreshCw, 
  Search, 
  Edit2, 
  Save, 
  X, 
  User, 
  File as FileIcon, 
  ShieldAlert,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  List
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel, exportToCSV } from '../../utils/excel';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

const startOfDay = (d: Date | string | number) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const CDLedger: React.FC = () => {
  const { user } = useAuth();


  // Permission Check
  const hasAccess = useMemo(() => {
    return user?.is_admin || user?.features.includes('cd_ledger');
  }, [user]);

  // UI / State
  const [loading, setLoading] = useState(true);
  const [loansList, setLoansList] = useState<(FinanceLoan & { customer: FinanceCustomer; guarantor_1?: FinanceCustomer; guarantor_2?: FinanceCustomer })[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED' | 'NPA CLOSED'>('ACTIVE');

  const filteredLoansList = useMemo(() => {
    return loansList.filter(loan => {
      if (statusFilter === 'ACTIVE') return loan.status === 'Active';
      if (statusFilter === 'CLOSED') return loan.status === 'Closed';
      if (statusFilter === 'NPA CLOSED') return loan.status === 'NPA_CLOSED';
      return true;
    });
  }, [loansList, statusFilter]);
  
  // Custom Autocomplete Search State
  const [searchNameQuery, setSearchNameQuery] = useState('');
  const [searchAcQuery, setSearchAcQuery] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showAcDropdown, setShowAcDropdown] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState('');

  const [selectedLoan, setSelectedLoan] = useState<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: any[]; dues: FinanceDue[]; documents: FinanceDocument[] }) | null>(null);
  
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Edit mode details
  const [isEditing, setIsEditing] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  // Edit fields: Customer details
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustPhone2, setEditCustPhone2] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustAadhaar, setEditCustAadhaar] = useState('');
  const [editCustFatherName, setEditCustFatherName] = useState('');
  const [editCustPartnerName, setEditCustPartnerName] = useState('');
  
  // Edit fields: Surety details
  const [editSuretyName, setEditSuretyName] = useState('');
  const [editSuretyPhone, setEditSuretyPhone] = useState('');
  const [editSuretyAadhaar, setEditSuretyAadhaar] = useState('');
  const [editSuretyAddress, setEditSuretyAddress] = useState('');
  const [editSuretyRelation, setEditSuretyRelation] = useState('');
  const [editLoanRemarks, setEditLoanRemarks] = useState('');

  // Upload document fields
  const [docType, setDocType] = useState('Pledge Document');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Print Preview Modal State
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Return Document Modal State
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnedTo, setReturnedTo] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [isReturningDoc, setIsReturningDoc] = useState(false);
  const [returnSignature, setReturnSignature] = useState<File | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [showReturnDocModal, setShowReturnDocModal] = useState(false);

  // New Tables State
  const [cdLedgerEntries, setCdLedgerEntries] = useState<any[]>([]);
  const [cdInterestDetails, setCdInterestDetails] = useState<any[]>([]);

  // Action Panel State
  const [totalAmountPaying, setTotalAmountPaying] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [activeLogTab, setActiveLogTab] = useState<'statement' | 'interest'>('statement');

  // NPA Modal State
  const [showNpaModal, setShowNpaModal] = useState(false);
  const [npaReason, setNpaReason] = useState('');
  const [npaSettlementAmount, setNpaSettlementAmount] = useState('');
  const [isNpaClosing, setIsNpaClosing] = useState(false);

  // Guarantor Full Objects for Display
  const [guarantor1, setGuarantor1] = useState<any | null>(null);
  const [guarantor2, setGuarantor2] = useState<any | null>(null);
  const [loanDocuments, setLoanDocuments] = useState<any[]>([]);
  const [collateralLog, setCollateralLog] = useState<any | null>(null);
  const [documentReturned, setDocumentReturned] = useState<any | null>(null);
  // Real-time ticking Clock State
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formatted = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
      setTimeStr(formatted);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchLedgerData();
    }
  }, [hasAccess]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const allLoans = await supabaseFinance.getCDLoansList();

      // Show ONLY CD loans in CD Ledger
      const cdLoans = allLoans.filter((l: any) => l.loan_category === 'CD');
      setLoansList(cdLoans);

      // Do NOT auto-load — show the index/list view on mount
    } catch (err) {
      console.error(err);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const loadLedgerDetails = async (loanId: string) => {
    setLoading(true);
    try {
      const fullDetails = await supabaseFinance.getLoanById(loanId);
      if (fullDetails) {
        setSelectedLoan(fullDetails);
        
        // Map edit fields
        setEditCustName(fullDetails.customer?.name || '');
        setEditCustPhone(fullDetails.customer?.phone || '');
        setEditCustPhone2(fullDetails.customer?.phone2 || '');
        setEditCustAddress(fullDetails.customer?.address || '');
        setEditCustAadhaar(fullDetails.customer?.aadhaar || '');
        setEditCustFatherName(fullDetails.customer?.father_husband_name || '');
        setEditCustPartnerName(fullDetails.customer?.partner_name || '');

        setEditSuretyName(fullDetails.surety_name || '');
        setEditSuretyPhone(fullDetails.surety_phone || '');
        setEditSuretyAadhaar(fullDetails.surety_aadhaar || '');
        setEditSuretyAddress(fullDetails.surety_present_address || '');
        setEditSuretyRelation(fullDetails.surety_relation || '');
        setEditLoanRemarks(fullDetails.remarks || '');
        
        // Fetch explicit CD entries and interest rows
        const entries = await supabaseFinance.getCDLedgerEntries(loanId);
        const interests = await supabaseFinance.getCDInterestDetails(loanId);
        
        // Normalize legacy/native entries to prevent commission/charges from reducing dues.
        // KEY RULE: Never reclassify a row whose entry_type is already interest_payment or penalty_payment.
        // Only mark as opening_commission when: (a) DB type is opening_commission/Commission/document_charge,
        // OR (b) receipt_no is '-' or null/missing (disbursement-time rows have no real receipt number).
        const normalizedEntries = entries.map((entry: any) => {
          let entryType = entry.entry_type;
          let particulars = entry.particulars || '';
          const accountNameLower = (entry.account_name || '').toLowerCase();
          const particularsLower = particulars.toLowerCase();

          // If native CD entry, keep particulars unchanged except for opening charges normalization
          if (entry.account_name) {
            if (accountNameLower === 'cd commission a/c') {
              // Only treat as opening_commission if it was saved as such, or has no real receipt (disbursement row).
              // Do NOT reclassify interest_payment rows - they have RC numbers and different entry_type.
              const isOpeningRow = entryType === 'opening_commission' || entryType === 'Commission'
                || (!entry.receipt_no || entry.receipt_no === '-');
              if (isOpeningRow && entryType !== 'interest_payment' && entryType !== 'penalty_payment') {
                entryType = 'opening_commission';
                particulars = 'Opening CD Commission Charged';
              }
              // If entry_type is interest_payment or penalty_payment, leave completely unchanged
            } else if (accountNameLower === 'cd document charges a/c') {
              if (entryType !== 'document_charge') entryType = 'document_charge';
            } else if (
              particularsLower.includes('disbursement') ||
              accountNameLower === 'disbursement' ||
              entryType === 'original_loan' ||
              (accountNameLower === 'cd a/c' && entry.debit > 0 && !entry.credit)
            ) {
              entryType = 'original_loan';
              particulars = 'Original Loan Disbursement';
            }
            return { ...entry, entry_type: entryType, particulars };
          }

          // Fallback normalization for legacy/unsplit entries where account_name is null
          if (particularsLower.includes('disbursement') || (entry.debit > 0 && !entry.credit)) {
            entryType = 'original_loan';
            particulars = 'Original Loan Disbursement';
          }

          return { ...entry, entry_type: entryType, particulars };
        });
        
        setCdLedgerEntries(normalizedEntries);
        setCdInterestDetails(interests);

        // Fetch Guarantors if present from finance_customers
        if (fullDetails.guarantor_1_id) {
          const { data: g1 } = await supabase.from('finance_customers').select('*').eq('id', fullDetails.guarantor_1_id).single();
          setGuarantor1(g1 || null);
        } else {
          setGuarantor1(null);
        }
        
        if (fullDetails.guarantor_2_id) {
          const { data: g2 } = await supabase.from('finance_customers').select('*').eq('id', fullDetails.guarantor_2_id).single();
          setGuarantor2(g2 || null);
        } else {
          setGuarantor2(null);
        }

        // Fetch loan documents from finance_loan_documents
        const { data: loanDocs } = await supabase
          .from('finance_loan_documents')
          .select('*')
          .eq('loan_id', loanId);
        setLoanDocuments(loanDocs || []);

        // Fetch collateral logs from finance_edited_logs
        const { data: colLogs } = await supabase
          .from('finance_edited_logs')
          .select('*')
          .eq('table_name', 'finance_loans_collateral')
          .eq('record_id', loanId)
          .order('edited_at', { ascending: false })
          .limit(1);
        if (colLogs && colLogs.length > 0) {
          setCollateralLog(colLogs[0].new_values);
        } else {
          setCollateralLog(null);
        }

        // Fetch returned document status
        const { data: retDocs } = await supabase
          .from('finance_documents_returned')
          .select('*')
          .eq('loan_id', loanId)
          .order('created_at', { ascending: false })
          .limit(1);
        setDocumentReturned(retDocs && retDocs.length > 0 ? retDocs[0] : null);

        // Set auto-generated receipt number (sequential)
        const nextReceipt = await supabaseFinance.getNextReceiptNumber();
        setReceiptNo(nextReceipt);
        setTotalAmountPaying('');

        setIsEditing(false);
      } else {
        toast.error('Ledger details could not be resolved');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching CD ledger details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchLedgerData();
    if (selectedLoan) {
      loadLedgerDetails(selectedLoan.id);
    }
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleSaveDetails = async () => {
    if (!selectedLoan) return;
    setSavingDetails(true);
    try {
      const staffName = user?.username || 'Staff';
      
      const customerPayload: Partial<FinanceCustomer> = {
        name: editCustName,
        phone: editCustPhone || null,
        address: editCustAddress || null,
        aadhaar: editCustAadhaar || null,
        father_husband_name: editCustFatherName || null,
      };

      try {
        customerPayload.phone2 = editCustPhone2 || null;
        customerPayload.partner_name = editCustPartnerName || null;
      } catch (err) {
        console.warn('phone2 or partner_name could not be updated in payload', err);
      }

      const updatedCust = await supabaseFinance.updateCustomer(
        selectedLoan.customer_id,
        customerPayload,
        staffName
      );

      const loanPayload: Partial<FinanceLoan> = {
        surety_name: editSuretyName || null,
        surety_phone: editSuretyPhone || null,
        surety_aadhaar: editSuretyAadhaar || null,
        remarks: editLoanRemarks || null,
      };

      try {
        loanPayload.surety_present_address = editSuretyAddress || null;
        loanPayload.surety_relation = editSuretyRelation || null;
      } catch (err) {
        console.warn('surety_present_address or surety_relation could not be updated in payload', err);
      }

      const updatedLoan = await supabaseFinance.updateLoan(
        selectedLoan.id,
        loanPayload,
        staffName
      );

      if (updatedCust && updatedLoan) {
        toast.success('Account details updated successfully!');
        setIsEditing(false);
        loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to save details. Verify database schemas.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving updates');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLoan) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      const fileObj = new File([file], `doc-${selectedLoan.loan_id}-${Date.now()}-${file.name}`, { type: file.type });
      
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      const docResult = await supabaseFinance.addLoanDocument({
        loan_id: selectedLoan.id,
        category: docType === 'Pledge Document' ? 'Financial' : docType === 'Land Registry Copy' ? 'Original' : 'Registration',
        document_name: docType,
        file_url: publicUrl,
        is_submitted: true
      });

      if (docResult) {
        toast.success('Document uploaded successfully!');
        loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to link document in database.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document file');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const success = await supabaseFinance.deleteDocument(id);
      if (success) {
        toast.success('Document deleted');
        if (selectedLoan) loadLedgerDetails(selectedLoan.id);
      } else {
        toast.error('Failed to delete document');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting document');
    }
  };

  // Autocomplete Suggestions logic
  const nameSuggestions = useMemo(() => {
    const q = searchNameQuery.toLowerCase().trim();
    if (!q) return [];
    return filteredLoansList.filter(loan => {
      const cust = loan.customer;
      const g1 = loan.guarantor_1;
      const g2 = loan.guarantor_2;
      return (
        loan.loan_id.toLowerCase().includes(q) ||
        (cust?.name && cust.name.toLowerCase().includes(q)) ||
        (cust?.phone && cust.phone.includes(q)) ||
        (cust?.phone2 && cust.phone2.includes(q)) ||
        (cust?.phone_1 && cust.phone_1.includes(q)) ||
        (cust?.phone_2 && cust.phone_2.includes(q)) ||
        (cust?.aadhaar && cust.aadhaar.includes(q)) ||
        (cust?.partner_name && cust.partner_name.toLowerCase().includes(q)) ||
        (g1?.name && g1.name.toLowerCase().includes(q)) ||
        (g1?.phone && g1.phone.includes(q)) ||
        (g1?.aadhaar && g1.aadhaar.includes(q)) ||
        (g2?.name && g2.name.toLowerCase().includes(q)) ||
        (g2?.phone && g2.phone.includes(q)) ||
        (g2?.aadhaar && g2.aadhaar.includes(q)) ||
        (cust?.village && cust.village.toLowerCase().includes(q)) ||
        (cust?.mandal && cust.mandal.toLowerCase().includes(q)) ||
        (cust?.district && cust.district.toLowerCase().includes(q)) ||
        (cust?.aadhaar_village && cust.aadhaar_village.toLowerCase().includes(q)) ||
        (cust?.aadhaar_mandal && cust.aadhaar_mandal.toLowerCase().includes(q)) ||
        (cust?.aadhaar_district && cust.aadhaar_district.toLowerCase().includes(q)) ||
        (cust?.present_village && cust.present_village.toLowerCase().includes(q)) ||
        (cust?.present_mandal && cust.present_mandal.toLowerCase().includes(q)) ||
        (cust?.present_district && cust.present_district.toLowerCase().includes(q))
      );
    });
  }, [filteredLoansList, searchNameQuery]);

  const acSuggestions = useMemo(() => {
    const q = searchAcQuery.toLowerCase().trim();
    if (!q) return [];
    return filteredLoansList.filter(loan => loan.loan_id.toLowerCase().includes(q));
  }, [filteredLoansList, searchAcQuery]);

  // Record Index Navigator Memo
  const currentIndex = useMemo(() => {
    if (!selectedLoan || filteredLoansList.length === 0) return -1;
    return filteredLoansList.findIndex(l => l.id === selectedLoan.id);
  }, [selectedLoan, filteredLoansList]);

  const handlePrevRecord = () => {
    if (currentIndex > 0) {
      loadLedgerDetails(filteredLoansList[currentIndex - 1].id);
    }
  };

  const handleNextRecord = () => {
    if (currentIndex < filteredLoansList.length - 1) {
      loadLedgerDetails(filteredLoansList[currentIndex + 1].id);
    }
  };

  // ===== SINGLE SOURCE OF TRUTH: current principal balance =====
  // Derived from cdLedgerEntries so that renewCalculations, ledgerMetrics,
  // and all UI sections consume the exact same value.
  const currentPrincipalBalance = useMemo(() => {
    if (!selectedLoan) return Number(0);

    // 1. Find original disbursement amount from ledger entries
    const disbursementEntries = cdLedgerEntries.filter(
      (e: any) => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement'
    );
    const originalFromLedger = disbursementEntries.reduce(
      (sum: number, e: any) => sum + Number(e.debit || 0), 0
    );

    // 2. Find total principal paid from ledger entries
    const principalPaidFromLedger = cdLedgerEntries
      .filter((e: any) => {
        const isPrincipalPaid =
          (e.particulars || '').toLowerCase().includes('principal paid') ||
          (e.particulars || '').toLowerCase().includes('principal adjusted') ||
          e.entry_type === 'principal_payment';
        return isPrincipalPaid && Number(e.credit || 0) > 0;
      })
      .reduce((sum: number, e: any) => sum + Number(e.credit || 0), 0);

    // 3. If we found disbursement entries, use ledger-derived value;
    //    otherwise fall back to selectedLoan.amount (for loans without ledger history)
    if (originalFromLedger > 0) {
      return Number(Math.max(0, originalFromLedger - principalPaidFromLedger).toFixed(2));
    }

    // Fallback: use DB amount (already reduced by past payments)
    return Number(selectedLoan.amount);
  }, [selectedLoan, cdLedgerEntries]);

  // Dynamic calculations based on payment date and selected loan
  const renewCalculations = useMemo(() => {
    if (!selectedLoan) return null;

    const entryDate = new Date(selectedLoan.date);
    const today = new Date(paymentDate);

    // Original disbursement date (earliest disbursal entry or loan creation date)
    const disbEntry = [...cdLedgerEntries]
      .filter(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
      .sort((a, b) => startOfDay(a.entry_date) - startOfDay(b.entry_date))[0];
    const originalLoanDateMs: number = disbEntry
      ? startOfDay(disbEntry.entry_date)
      : startOfDay(selectedLoan.date);

    const originalLoanDate = new Date(originalLoanDateMs);

    // Validate: payment date must not be before the original loan disbursement date
    const isDateInvalid = startOfDay(today) < originalLoanDateMs;
    if (isDateInvalid) {
      return {
        isDateInvalid: true,
        daysCount: 0,
        loanDate: originalLoanDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        dueDate: null,
        daysPastDue: 0,
        daysRemaining: 0,
        nextDueDate: null,
        penaltyDays: 0,
        interest: 0,
        penalty: 0,
        principal: currentPrincipalBalance,
        grossInterest: 0,
        grossPenalty: 0,
        dailyInterest: 0,
        dailyPenalty: 0,
        penaltyPaid: 0,
        interestPaid: 0,
        principalPaid: 0
      };
    }

    const periodDays = (selectedLoan.period_days && Number(selectedLoan.period_days) > 0) ? Number(selectedLoan.period_days) : 30;
    
    // Current Due Date = Loan Date + Period Days - 1
    // VBA: DueDate = Date + Period − 1 (UpdatingDueDate.bas default path)
    const entryDateStart = new Date(startOfDay(entryDate));
    const dueDate = new Date(entryDateStart.getTime() + (periodDays - 1) * 24 * 60 * 60 * 1000);

    // Dynamic Penalty Rate Lookup
    const penaltyRate = selectedLoan.penalty_percent !== undefined && selectedLoan.penalty_percent !== null ? Number(selectedLoan.penalty_percent) : 0.75;

    // Requirement 5: Debug logging
    console.log('=== CD LEDGER RENEW CALCULATIONS DEBUG ===');
    console.log('period_days:', periodDays);
    console.log('loan_date:', selectedLoan.date);
    console.log('due_date:', dueDate.toISOString().split('T')[0]);
    console.log('calculated_cycle_days:', Math.round((dueDate.getTime() - entryDateStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Due Days = Payment Date - Due Date (Clamped to 0)
    const rawDueDays = Math.round((startOfDay(today) - startOfDay(dueDate)) / (1000 * 60 * 60 * 24));
    const dueDays = Math.max(0, rawDueDays);
    const daysRemaining = rawDueDays < 0 ? Math.abs(rawDueDays) : 0;
    
    const interestRate = Number(selectedLoan.interest_rate) || 3;
    const principalBalance = currentPrincipalBalance;

    // Interest = principal × rate × dueDays ÷ 30 ÷ 100 (0 if dueDays <= 0)
    // Penalty  = principal × penaltyRate% × dueDays ÷ 30 (0 if dueDays <= 5, calculated on full dueDays count if > 5)
    const grossInterest = dueDays <= 0 ? 0 : Number(((principalBalance * interestRate * dueDays) / 30 / 100).toFixed(2));
    const penaltyDays = dueDays <= 5 ? 0 : dueDays;
    const grossPenalty  = penaltyDays <= 0 ? 0 : Number(((principalBalance * penaltyRate * penaltyDays) / 30 / 100).toFixed(2));

    // Daily interest / renewal day value:
    // Derived from the Renewal Due divided by Period Days (cancels out to principal * rate / 100 / 30)
    const renewalInterest = (principalBalance * (interestRate / 100) * periodDays) / 30;
    const baseDailyInterest = Number((renewalInterest / periodDays).toFixed(5));

    const renewalPenalty = (principalBalance * (penaltyRate / 100) * periodDays) / 30;
    const baseDailyPenalty = Number((renewalPenalty / periodDays).toFixed(5));

    let dailyInterest = baseDailyInterest;
    let dailyPenalty = 0;
    if (dueDays > 5) {
      dailyInterest = Number((baseDailyInterest + baseDailyPenalty).toFixed(5));
      dailyPenalty = baseDailyPenalty;
    }

    // ── BUGFIX: Determine the true current-cycle start from the ledger ──────────
    // The start of the current cycle is exactly the loan date in selectedLoan.date.
    // Any payments posted with entry_date on or after this start date belong to the current cycle.
    const cycleStartDateMs = startOfDay(selectedLoan.date);

    // Paid amounts for the current cycle:
    const penaltyPaidInCycle = cdLedgerEntries
      .filter(e => e.entry_type === 'penalty_payment' && startOfDay(e.entry_date) >= cycleStartDateMs)
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);

    const interestPaidInCycle = cdLedgerEntries
      .filter(e => e.entry_type === 'interest_payment' && startOfDay(e.entry_date) >= cycleStartDateMs)
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);

    // ── OLD ACCESS VBA: effective gross & pending dues ────────────────────────────
    // grossInterest can be NEGATIVE when loan is not yet due (credit).
    // For payment/outstanding purposes, outstanding = max(0, gross - paid).
    // For DISPLAY purposes, show the raw gross (including negative = credit).
    //
    // When gross is negative but there are payments in cycle, effectiveGross
    // must be at least the paid amount so pending doesn't go negative.
    const effectiveGrossInterest = grossInterest;
    const effectiveGrossPenalty  = grossPenalty;

    // Outstanding dues for PAYMENT purposes (never negative)
    const outstandingInterest = Math.max(0, Number(grossInterest.toFixed(2)));
    const outstandingPenalty  = Math.max(0, Number(grossPenalty.toFixed(2)));

    // Display interest/penalty: show the raw formula value (never negative)
    const displayInterest = dueDays <= 0 ? 0 : outstandingInterest;
    const displayPenalty  = dueDays <= 0 ? 0 : outstandingPenalty;

    // CD067 / CD070 debugging trace
    console.log('=== CD LEDGER MIGRATION AUDIT TRACE ===', {
      loan_number: selectedLoan.loan_id,
      principal_balance: principalBalance,
      due_days: dueDays,
      interest_formula_result: grossInterest,
      penalty_formula_result: grossPenalty,
      interest_paid_considered: interestPaidInCycle,
      penalty_paid_considered: penaltyPaidInCycle,
      total_dues_result: outstandingInterest + outstandingPenalty
    });

    return {
      isDateInvalid: false,
      daysCount: dueDays,
      loanDate: entryDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      dueDate: dueDate,
      daysPastDue: dueDays,            // raw due days (can be negative)
      daysRemaining,                    // absolute days remaining (when not yet due)
      nextDueDate: null,                // Computed dynamically based on renewedDays
      penaltyDays,
      interest: displayInterest,        // for display: negative when credit, pending when overdue
      penalty: displayPenalty,          // for display: 0 when not due, pending when overdue
      outstandingInterest,              // for payments: always >= 0
      outstandingPenalty,               // for payments: always >= 0
      principal: principalBalance,
      grossInterest,                    // raw formula result (can be negative)
      grossPenalty,                     // raw formula result (0 if dueDays <= 5)
      effectiveGrossInterest,           // max(grossInterest, paid) — always >= paid
      effectiveGrossPenalty,            // max(grossPenalty, paid) — always >= paid
      dailyInterest,
      dailyPenalty,
      baseDailyInterest,               // pure interest daily rate (no penalty component)
      penaltyPaid: penaltyPaidInCycle,
      interestPaid: interestPaidInCycle,
      principalPaid: 0
    };
  }, [selectedLoan, paymentDate, cdLedgerEntries, currentPrincipalBalance]);

  // Date Formatter helper (returns format e.g. 07-Mar-26)
  const formatDateOld = (dateStr: string | Date | number | null | undefined) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const yy = String(year).slice(-2);
      return `${day}-${months[monthIndex]}-${yy}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yy = String(d.getFullYear()).slice(-2);
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}-${months[d.getMonth()]}-${yy}`;
  };

  // Statement ledger builder containing native logs + fallbacks (interest, document charges etc.)
  const displayedStatementEntries = useMemo(() => {
    if (!selectedLoan || !renewCalculations) return [];
    
    const list: any[] = [];
    const sortedDbEntries = [...cdLedgerEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    
    // Find original loan start date
    const disb = sortedDbEntries.find(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
    const originalLoanStart = startOfDay(disb ? disb.entry_date : selectedLoan.date);
    
    // Find all renewal dates
    const cycleEnds = sortedDbEntries
      .filter(e => 
        e.entry_type === 'Renewal' || 
        e.entry_type === 'Renew' || 
        (e.particulars || '').toLowerCase().includes('renewal') || 
        (e.particulars || '').toLowerCase().includes('renew')
      )
      .map(e => startOfDay(e.entry_date));
    
    const uniqueCycleEnds = Array.from(new Set(cycleEnds)).sort((a, b) => a - b);
    
    // Build the list of cycles
    const cycles: { start: number; end: number; isCurrent: boolean }[] = [];
    let currentStart = originalLoanStart;
    for (const end of uniqueCycleEnds) {
      if (end > currentStart) {
        cycles.push({ start: currentStart, end, isCurrent: false });
        currentStart = end;
      }
    }
    cycles.push({ start: currentStart, end: startOfDay(paymentDate), isCurrent: true });

    // Step-by-step simulation of cycles to determine running principal and split payments
    const principalPaidTotalDb = sortedDbEntries
      .filter(e => {
        const isPrincipalPaid = (e.particulars || '').toLowerCase().includes('principal paid') || 
                                (e.particulars || '').toLowerCase().includes('principal adjusted') ||
                                e.entry_type === 'principal_payment';
        return e.account_name === 'CD A/C' && isPrincipalPaid;
      })
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);
    
    const originalAmount = Number(selectedLoan.amount) + principalPaidTotalDb;
    let runningPrincipal = originalAmount;

    // Let's first add the Disbursement row
    const hasDisbursement = sortedDbEntries.some(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
    if (!hasDisbursement) {
      list.push({
        id: `fallback-disb-${selectedLoan.id}`,
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD A/C',
        entry_date: selectedLoan.date,
        credit: 0,
        debit: originalAmount,
        receipt_no: '-',
        particulars: 'Original Loan Disbursement',
        user_name: 'System',
        entry_type: 'original_loan'
      });
    }

    // Check if we have CD Commission opening row in the DB.
    // IMPORTANT: check by entry_type, not by account name — interest_payment rows also use CD COMMISSION A/C.
    const hasCommission = sortedDbEntries.some(e =>
      e.entry_type === 'opening_commission' || e.entry_type === 'Commission'
    );
    if (!hasCommission) {
      // Fallback: derive from disbursement debit (the true original principal, never changes)
      const disbEntry = sortedDbEntries.find(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
      const P = disbEntry ? Number(disbEntry.debit) : originalAmount;
      const R = Number(selectedLoan.interest_rate) || 3;
      const pDays = (selectedLoan.period_days && Number(selectedLoan.period_days) > 0) ? Number(selectedLoan.period_days) : 30;
      const commAmount = Number(((P * (R / 100) * pDays) / 30).toFixed(2));

      list.push({
        id: `fallback-comm-${selectedLoan.id}`,
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD COMMISSION A/C',
        entry_date: disbEntry ? disbEntry.entry_date : selectedLoan.date,
        credit: commAmount,
        debit: 0,
        receipt_no: '-',
        particulars: 'Opening CD Commission Charged',
        user_name: 'System',
        entry_type: 'opening_commission'
      });
    }

    // Check if we have CD Document Charges row
    const docChargesVal = Number(selectedLoan.document_charges) || 0;
    const hasDocCharges = sortedDbEntries.some(e =>
      (e.account_name || '').toLowerCase() === 'cd document charges a/c' ||
      e.entry_type === 'document_charge'
    );
    if (!hasDocCharges && docChargesVal > 0) {
      list.push({
        id: `fallback-doc-${selectedLoan.id}`,
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD DOCUMENT CHARGES A/C',
        credit: docChargesVal,
        debit: 0,
        receipt_no: '-',
        particulars: 'Document Charges Collected',
        user_name: 'System',
        entry_type: 'document_charge',
        entry_date: selectedLoan.date
      });
    }

    // Process each cycle
    cycles.forEach((cycle) => {
      // Find all payments inside this cycle
      const cyclePayments = sortedDbEntries.filter(entry => {
        const isNonPaymentEntry =
          entry.entry_type === 'original_loan' || entry.entry_type === 'Disbursement' ||
          entry.entry_type === 'Document Charges' || entry.entry_type === 'document_charge' ||
          entry.entry_type === 'Commission' || entry.entry_type === 'opening_commission';
        if (isNonPaymentEntry) {
          return false;
        }
        const isPayment = entry.credit > 0 &&
                          !isNonPaymentEntry &&
                          !entry.id.toString().startsWith('fallback-comm-') &&
                          !entry.id.toString().startsWith('fallback-doc-');
        if (!isPayment) return false;
        
        const d = startOfDay(entry.entry_date);
        
        const isFirstCycle = cycle.start === originalLoanStart;
        if (isFirstCycle) {
          return d >= cycle.start && d <= cycle.end;
        } else {
          return d > cycle.start && d <= cycle.end;
        }
      });

      // Dues calculation for this cycle
      // VBA: DueDate = Date + Period − 1
      const periodDays = (selectedLoan.period_days && Number(selectedLoan.period_days) > 0) ? Number(selectedLoan.period_days) : 30;
      const cycleDueDate = new Date(cycle.start + (periodDays - 1) * 24 * 60 * 60 * 1000);
      const cycleDueDays = Math.max(0, Math.round((cycle.end - startOfDay(cycleDueDate)) / (1000 * 60 * 60 * 24)));
      
      const interestRate = Number(selectedLoan.interest_rate) || 3;
      const penaltyRate = selectedLoan.penalty_percent !== undefined && selectedLoan.penalty_percent !== null ? Number(selectedLoan.penalty_percent) : 0.75;
      
      const cycleGrossInterest = cycleDueDays <= 0 ? 0 : Number(((runningPrincipal * interestRate * cycleDueDays) / 30 / 100).toFixed(2));
      const cycleGrossPenalty = cycleDueDays <= 0 ? 0 : Number(((runningPrincipal * penaltyRate * cycleDueDays) / 30 / 100).toFixed(2));

      // Check if some payments inside this cycle are ALREADY split
      const alreadySplitSum = cyclePayments.filter(e => {
        const isPrincipalPaid = (e.particulars || '').toLowerCase().includes('principal paid') || 
                                (e.particulars || '').toLowerCase().includes('principal adjusted') ||
                                e.entry_type === 'principal_payment';
        const isAlreadySplit = ['penalty a/c', 'cd commission a/c'].includes((e.account_name || '').toLowerCase()) || 
                               e.entry_type === 'penalty_payment' ||
                               e.entry_type === 'interest_payment' ||
                               e.entry_type === 'principal_payment' ||
                               ((e.account_name || '').toLowerCase() === 'cd a/c' && isPrincipalPaid);
        return isAlreadySplit;
      }).reduce((sum, e) => sum + Number(e.credit), 0);

      let accumulatedPayments = alreadySplitSum;

      // Now map each payment entry in the cycle
      cyclePayments.forEach(entry => {
        const isPrincipalPaid = (entry.particulars || '').toLowerCase().includes('principal paid') || 
                               (entry.particulars || '').toLowerCase().includes('principal adjusted') ||
                               entry.entry_type === 'principal_payment';
        const isAlreadySplit = ['penalty a/c', 'cd commission a/c'].includes((entry.account_name || '').toLowerCase()) || 
                               entry.entry_type === 'penalty_payment' ||
                               entry.entry_type === 'interest_payment' ||
                               entry.entry_type === 'principal_payment' ||
                               ((entry.account_name || '').toLowerCase() === 'cd a/c' && isPrincipalPaid);

        if (isAlreadySplit) {
          list.push({ ...entry, account_name: entry.account_name || 'CD A/C' });
          if (((entry.account_name || '').toLowerCase() === 'cd a/c' && isPrincipalPaid) || entry.entry_type === 'principal_payment') {
            runningPrincipal -= Number(entry.credit);
          }
          return;
        }

        const isRenewal = entry.entry_type === 'Renewal' || entry.entry_type === 'Renew' || 
                          (entry.particulars || '').toLowerCase().includes('renewal') || 
                          (entry.particulars || '').toLowerCase().includes('renew');
        const isCloseAction = entry.entry_type === 'Close' || entry.entry_type === 'Settlement';
        const actionType = isCloseAction ? 'Close' : (isRenewal ? 'Renew' : 'Partial');
        const creditAmt = Number(entry.credit || 0);

        const monthlyInterestVal = Number((runningPrincipal * interestRate / 100).toFixed(2));

        const oldSplit = financeCalculationService.computeCDPaymentSplit(
          accumulatedPayments,
          cycleGrossPenalty,
          cycleGrossInterest,
          monthlyInterestVal,
          runningPrincipal,
          actionType,
          periodDays
        );
        const newSplit = financeCalculationService.computeCDPaymentSplit(
          accumulatedPayments + creditAmt,
          cycleGrossPenalty,
          cycleGrossInterest,
          monthlyInterestVal,
          runningPrincipal,
          actionType,
          periodDays
        );

        const pPaid = Number((newSplit.penaltyPaid - oldSplit.penaltyPaid).toFixed(2));
        const iPaid = Number((newSplit.interestPaid - oldSplit.interestPaid).toFixed(2));
        const prPaid = Number((newSplit.principalPaid - oldSplit.principalPaid).toFixed(2));

        accumulatedPayments += creditAmt;
        runningPrincipal -= prPaid;

        const actionText = actionType === 'Renew'
          ? 'Renewal Completed'
          : (actionType === 'Close' ? 'Close' : 'Partial Payment');
        const rNum = entry.receipt_no ? ` - ${entry.receipt_no}` : '';

        if (pPaid > 0) {
          list.push({
            ...entry,
            id: `${entry.id}-penalty`,
            account_name: 'PENALTY A/C',
            credit: pPaid,
            particulars: `Penalty Paid - ${actionText}${rNum}`
          });
        }
        if (iPaid > 0) {
          list.push({
            ...entry,
            id: `${entry.id}-interest`,
            account_name: 'CD COMMISSION A/C',
            credit: iPaid,
            particulars: `Interest Paid - ${actionText}${rNum}`
          });
        }
        if (prPaid > 0) {
          list.push({
            ...entry,
            id: `${entry.id}-principal`,
            account_name: 'CD A/C',
            credit: prPaid,
            particulars: `Principal Adjusted - ${actionText}${rNum}`
          });
        }
      });
    });

    // Pushes non-payment database entries directly (opening rows that are immutable)
    sortedDbEntries.forEach(entry => {
      const isNonPayment =
        entry.entry_type === 'original_loan' || entry.entry_type === 'Disbursement' ||
        entry.entry_type === 'Document Charges' || entry.entry_type === 'document_charge' ||
        entry.entry_type === 'Commission' || entry.entry_type === 'opening_commission' ||
        entry.entry_type === 'NPA_CLOSE' || entry.entry_type === 'NPA_CLOSED';
      if (isNonPayment) {
        list.push({ ...entry, account_name: entry.account_name || 'CD A/C' });
      }
    });

    return list.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [selectedLoan, cdLedgerEntries, paymentDate]);

  // Original Loan Amount calculations
  const originalLoanAmount = useMemo(() => {
    if (!selectedLoan) return 0;
    return displayedStatementEntries
      .filter(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
      .reduce((sum, e) => sum + Number(e.debit), 0) || Number(selectedLoan.amount);
  }, [selectedLoan, displayedStatementEntries]);

  const originalLoanDate = useMemo(() => {
    if (!selectedLoan) return null;
    const disb = displayedStatementEntries.find(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement');
    return disb ? disb.entry_date : selectedLoan.date;
  }, [displayedStatementEntries, selectedLoan]);

  // Principal Paid calculations
  const principalPaidTotal = useMemo(() => {
    return displayedStatementEntries
      .filter(e => 
        e.entry_type === 'principal_payment' ||
        (e.particulars || '').toLowerCase().includes('principal paid') || 
        (e.particulars || '').toLowerCase().includes('principal adjusted')
      )
      .reduce((sum, e) => sum + Number(e.credit), 0);
  }, [displayedStatementEntries]);

  const displayedInterestDetails = useMemo(() => {
    const list: any[] = [];
    if (!selectedLoan) return list;

    displayedStatementEntries.forEach(entry => {
      const isInterestOrPenalty = ['penalty a/c', 'cd commission a/c'].includes((entry.account_name || '').toLowerCase());
      if (isInterestOrPenalty && entry.credit > 0 && entry.entry_type !== 'opening_commission' && entry.entry_type !== 'Commission' && !entry.id.toString().startsWith('fallback-comm-')) {
        
        // Find matching interest detail row from Supabase table
        const matchingDetail = cdInterestDetails.find(d => 
          d.entry_id === entry.id || 
          d.ledger_entry_id === entry.id ||
          (d.receipt_no === entry.receipt_no && d.row_type === (entry.account_name === 'PENALTY A/C' ? 'penalty_payment' : 'interest_payment'))
        );

        let renewed_days = 0;
        let renewed_till_date = null;

        if (matchingDetail) {
          renewed_days = Number(matchingDetail.renewed_days) || 0;
          renewed_till_date = matchingDetail.renewed_till_date;
        }

        list.push({
          id: `int-detail-${entry.id}`,
          loan_id: entry.loan_id,
          entry_id: entry.id,
          entry_date: entry.entry_date,
          credit: entry.credit,
          receipt_no: entry.receipt_no,
          particulars: entry.particulars,
          renewed_days,
          renewed_till_date,
          row_type: entry.account_name === 'PENALTY A/C' ? 'Penalty Paid' : 'Interest Paid',
          created_at: entry.created_at || entry.entry_date
        });
      }
    });

    cdInterestDetails.forEach(detail => {
      if ((detail.particulars || '').toLowerCase().includes('note:')) {
        let renewed_days = Number(detail.renewed_days) || 0;
        let renewed_till_date = detail.renewed_till_date;

        list.push({
          ...detail,
          renewed_days,
          renewed_till_date
        });
      }
    });

    return list.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [displayedStatementEntries, cdInterestDetails, selectedLoan]);

  // Shared single source of truth calculations
  const ledgerMetrics = useMemo(() => {
    if (!selectedLoan || !renewCalculations) {
      return {
        originalPrincipal: 0,
        principalPaid: 0,
        principalBalance: 0,
        grossInterestDue: 0,
        grossPenaltyDue: 0,
        paidInterest: 0,
        paidPenalty: 0,
        pendingInterest: 0,
        pendingPenalty: 0,
        renewalDue: 0,
        currentTotalDues: 0,
        currentPaidDues: 0,
        currentPendingDues: 0,
        totalToRegularize: 0,
        totalClose: 0,
        totalCredit: 0,
        totalDebit: 0
      };
    }

    const originalPrincipal = originalLoanAmount;
    const principalPaid = principalPaidTotal;
    const principalBalance = Number((originalPrincipal - principalPaid).toFixed(2));

    const grossInterestDue = renewCalculations.effectiveGrossInterest || 0;
    const grossPenaltyDue = renewCalculations.effectiveGrossPenalty || 0;

    const paidInterest = renewCalculations.interestPaid || 0;
    const paidPenalty = renewCalculations.penaltyPaid || 0;

    // Display values (can be negative when loan is not yet due)
    const pendingInterest = renewCalculations.interest || 0;
    const pendingPenalty = renewCalculations.penalty || 0;


    // Outstanding values for payment purposes (always >= 0)

    const interestRate = Number(selectedLoan.interest_rate) || 3;
    const periodDays = (selectedLoan.period_days && Number(selectedLoan.period_days) > 0) ? Number(selectedLoan.period_days) : 30;
    const renewalDue = Number(((principalBalance * (interestRate / 100) * periodDays) / 30).toFixed(2));

    const outstandingInterest = renewCalculations.outstandingInterest || 0;
    const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
    const totalDue = outstandingInterest + outstandingPenalty;

    // Total To Regularize = total_due + total_for_renewal (if there are active dues)
    const totalToRegularize = (outstandingInterest === 0 && outstandingPenalty === 0)
      ? 0
      : Number((totalDue + renewalDue).toFixed(2));

    // Footer metrics synchronized with calculations and card values
    const currentTotalDues = (renewCalculations.daysPastDue || 0) <= 0
      ? 0
      : Number((grossInterestDue + grossPenaltyDue).toFixed(2));
    const currentPaidDues = (renewCalculations.daysPastDue || 0) <= 0
      ? 0
      : Number((paidInterest + paidPenalty).toFixed(2));
    const currentPendingDues = Math.max(0, Number((currentTotalDues - currentPaidDues).toFixed(2)));

    // Close Amount = Principal + Interest + Penalty (only when interest and penalty are non-negative)
    const totalClose = Number((principalBalance + Math.max(0, pendingInterest) + Math.max(0, pendingPenalty)).toFixed(2));

    // totalCredit = only real cash collected (interest, penalty, principal payments)
    // Must NOT include opening_commission or document_charge rows (not real collections)
    const NON_COLLECTION_TYPES = new Set(['original_loan', 'Disbursement', 'opening_commission', 'Commission', 'Document Charges', 'document_charge']);
    const totalCredit = displayedStatementEntries
      .filter(e => !NON_COLLECTION_TYPES.has(e.entry_type) && Number(e.credit) > 0)
      .reduce((sum, e) => sum + Number(e.credit || 0), 0);

    const totalDebit = displayedStatementEntries
      .filter(e => e.entry_type === 'original_loan' || e.entry_type === 'Disbursement')
      .reduce((sum, e) => sum + Number(e.debit || 0), 0);

    return {
      originalPrincipal,
      principalPaid,
      principalBalance,
      grossInterestDue,
      grossPenaltyDue,
      paidInterest,
      paidPenalty,
      pendingInterest,
      pendingPenalty,
      renewalDue,
      currentTotalDues,
      currentPaidDues,
      currentPendingDues,
      totalToRegularize,
      totalClose,
      totalCredit,
      totalDebit
    };
  }, [selectedLoan, renewCalculations, originalLoanAmount, principalPaidTotal, displayedInterestDetails, displayedStatementEntries]);

  // Calculation bottom totals
  const bottomTotals = useMemo(() => {
    const totalCredit = displayedStatementEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const totalDebit = displayedStatementEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    return {
      totalCredit,
      totalDebit,
      presentBalance: ledgerMetrics.principalBalance,
      totalDues: ledgerMetrics.currentTotalDues,
      paidDues: ledgerMetrics.currentPaidDues,
      pendingDues: ledgerMetrics.currentPendingDues
    };
  }, [displayedStatementEntries, ledgerMetrics]);

  // Payment preview calculation — priority allocation: Penalty → Interest → Principal
  const paymentPreview = useMemo(() => {
    const paymentAmount = Number(totalAmountPaying) || 0;
    if (paymentAmount <= 0 || !renewCalculations) return null;

    const principalBefore = ledgerMetrics.principalBalance;
    const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
    const outstandingInterest = renewCalculations.outstandingInterest || 0;

    const periodDays = (selectedLoan?.period_days && Number(selectedLoan.period_days) > 0) ? Number(selectedLoan.period_days) : 30;
    const interestRate = Number(selectedLoan?.interest_rate) || 3;
    const monthlyInterest = Number(((principalBefore * (interestRate / 100) * periodDays) / 30).toFixed(2));
    const dailyInterestValue = Number((monthlyInterest / periodDays).toFixed(5));

    const isClosingPayment = paymentAmount >= Math.max(0, ledgerMetrics.totalClose);

    if (isClosingPayment) {
      const penaltyPaid = outstandingPenalty;
      const overdueInterestPaid = outstandingInterest;
      const renewalInterestPaid = 0;
      const principalPaid = Number(Math.max(0, paymentAmount - penaltyPaid - overdueInterestPaid).toFixed(2));
      const principalAfter = Number(Math.max(0, principalBefore - principalPaid).toFixed(2));
      
      const details = {
        penaltyPaid,
        overdueInterestPaid,
        renewalInterestPaid,
        interestPaid: overdueInterestPaid + renewalInterestPaid,
        principalPaid,
        principalAfter,
        renewedDays: 0,
        nextDueDate: null,
        dailyInterestValue
      };

      return {
        paymentAmount,
        isClosingPayment,
        renew: details,
        partial: details
      };
    }

    // Renew Option (Option 1)
    const renewSplit = financeCalculationService.computeCDPaymentSplit(
      paymentAmount,
      outstandingPenalty,
      outstandingInterest,
      monthlyInterest,
      principalBefore,
      'Renew',
      periodDays
    );
    // VBA: NextDueDate = DueDate + RDAYS — always extends from old DueDate, not payment date
    const renewBaseDateMs = renewCalculations?.dueDate
      ? startOfDay(renewCalculations.dueDate)
      : startOfDay(paymentDate);
    const renewNextDueDate = renewSplit.renewedDays > 0 
      ? new Date(renewBaseDateMs + renewSplit.renewedDays * 24 * 60 * 60 * 1000) 
      : null;

    const renewDetails = {
      penaltyPaid: renewSplit.penaltyPaid,
      overdueInterestPaid: renewSplit.overdueInterestPaid,
      renewalInterestPaid: renewSplit.renewalInterestPaid,
      interestPaid: renewSplit.interestPaid,
      principalPaid: renewSplit.principalPaid,
      principalAfter: Number(Math.max(0, principalBefore - renewSplit.principalPaid).toFixed(2)),
      renewedDays: renewSplit.renewedDays,
      nextDueDate: renewNextDueDate,
      dailyInterestValue
    };

    // Partial Option (Option 2)
    const partialSplit = financeCalculationService.computeCDPaymentSplit(
      paymentAmount,
      outstandingPenalty,
      outstandingInterest,
      monthlyInterest,
      principalBefore,
      'Partial',
      periodDays
    );
    const partialBaseDateMs = Math.max(startOfDay(renewCalculations?.dueDate || paymentDate), startOfDay(paymentDate));
    const partialNextDueDate = partialSplit.renewedDays > 0 
      ? new Date(partialBaseDateMs + partialSplit.renewedDays * 24 * 60 * 60 * 1000) 
      : null;

    const partialDetails = {
      penaltyPaid: partialSplit.penaltyPaid,
      overdueInterestPaid: partialSplit.overdueInterestPaid,
      renewalInterestPaid: partialSplit.renewalInterestPaid,
      interestPaid: partialSplit.interestPaid,
      principalPaid: partialSplit.principalPaid,
      principalAfter: Number(Math.max(0, principalBefore - partialSplit.principalPaid).toFixed(2)),
      renewedDays: partialSplit.renewedDays,
      nextDueDate: partialNextDueDate,
      dailyInterestValue
    };

    return {
      paymentAmount,
      isClosingPayment,
      renew: renewDetails,
      partial: partialDetails
    };
  }, [totalAmountPaying, ledgerMetrics, renewCalculations, selectedLoan, paymentDate]);

  // Aggregated Loan Documents & Fingerprint display metadata
  const aggregatedDocs = useMemo(() => {
    const list: any[] = [];

    loanDocuments.forEach(doc => {
      list.push({
        id: doc.id,
        source: 'loan_doc',
        category: doc.category || 'Loan Doc',
        name: doc.document_name || 'Document',
        remarks: doc.remarks || 'N/A',
        fileUrl: doc.file_url,
        returnedStatus: documentReturned ? 'Returned' : 'Not Returned',
        allowDelete: true
      });
    });

    if (collateralLog) {
      list.push({
        id: 'collateral-metadata',
        source: 'collateral',
        category: 'Collateral',
        name: 'Collateral Assets Details',
        remarks: `Address: ${collateralLog.collateral_address || 'N/A'}, particulars: ${collateralLog.particulars || 'N/A'}`,
        fileUrl: null,
        returnedStatus: documentReturned ? 'Returned' : 'Not Returned',
        allowDelete: false
      });

      if (collateralLog.collateral_image) {
        list.push({
          id: 'collateral-image',
          source: 'collateral',
          category: 'Collateral',
          name: 'Collateral Asset Image',
          remarks: `GPS: ${collateralLog.gps_latitude || 'N/A'}, ${collateralLog.gps_longitude || 'N/A'}`,
          fileUrl: collateralLog.collateral_image,
          returnedStatus: documentReturned ? 'Returned' : 'Not Returned',
          allowDelete: false
        });
      }
    }

    if (selectedLoan?.customer) {
      if (selectedLoan.customer.customer_photo_url) {
        list.push({
          id: 'customer-photo',
          source: 'customer',
          category: 'Registration',
          name: 'Customer Photo',
          remarks: `Aadhaar: ${selectedLoan.customer.aadhaar || 'N/A'}`,
          fileUrl: selectedLoan.customer.customer_photo_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
      if (selectedLoan.customer.customer_fingerprint_image_url || selectedLoan.customer.fingerprint_url) {
        list.push({
          id: 'customer-fingerprint',
          source: 'customer',
          category: 'Registration',
          name: 'Customer Fingerprint',
          remarks: selectedLoan.customer.fingerprint_template ? 'Template Captured' : 'Image Captured',
          fileUrl: selectedLoan.customer.customer_fingerprint_image_url || selectedLoan.customer.fingerprint_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
    }

    if (guarantor1) {
      if (guarantor1.customer_photo_url) {
        list.push({
          id: 'guarantor1-photo',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 1 Photo',
          remarks: `Aadhaar: ${guarantor1.aadhaar || 'N/A'}`,
          fileUrl: guarantor1.customer_photo_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
      if (guarantor1.customer_fingerprint_image_url || guarantor1.fingerprint_url) {
        list.push({
          id: 'guarantor1-fingerprint',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 1 Fingerprint',
          remarks: guarantor1.fingerprint_template ? 'Template Captured' : 'Image Captured',
          fileUrl: guarantor1.customer_fingerprint_image_url || guarantor1.fingerprint_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
    }

    if (guarantor2) {
      if (guarantor2.customer_photo_url) {
        list.push({
          id: 'guarantor2-photo',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 2 Photo',
          remarks: `Aadhaar: ${guarantor2.aadhaar || 'N/A'}`,
          fileUrl: guarantor2.customer_photo_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
      if (guarantor2.customer_fingerprint_image_url || guarantor2.fingerprint_url) {
        list.push({
          id: 'guarantor2-fingerprint',
          source: 'customer',
          category: 'Registration',
          name: 'Guarantor 2 Fingerprint',
          remarks: guarantor2.fingerprint_template ? 'Template Captured' : 'Image Captured',
          fileUrl: guarantor2.customer_fingerprint_image_url || guarantor2.fingerprint_url,
          returnedStatus: 'Active',
          allowDelete: false
        });
      }
    }

    return list;
  }, [loanDocuments, collateralLog, documentReturned, selectedLoan, guarantor1, guarantor2]);

  // Handle payments renewals and closures (Access VBA logic)
  const handleActionSubmit = async (actionType: 'Renew' | 'Partial' | 'Close') => {
    if (isRenewing) return;
    if (!selectedLoan || !renewCalculations) return;
    
    // Block if payment date is before loan date
    if (renewCalculations.isDateInvalid) {
      toast.error('Payment date cannot be before loan date.');
      return;
    }
    
    const amount = Number(totalAmountPaying) || 0;
    if (actionType !== 'Close' && (amount <= 0 || isNaN(amount))) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    // Validation for Partial Payment principal bounds
    if (actionType === 'Partial') {
      const principal = ledgerMetrics.principalBalance || 0;
      if (amount >= principal) {
        toast.error(`Partial Payment amount (₹${amount.toFixed(2)}) must be strictly less than the outstanding principal balance (₹${principal.toFixed(2)}). To close the loan, please use Close Account.`);
        return;
      }
    }

    // Operator Warning/Confirmation when outstanding dues exist during Partial Payment
    const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
    const outstandingInterest = renewCalculations.outstandingInterest || 0;
    if (actionType === 'Partial' && (outstandingPenalty > 0 || outstandingInterest > 0)) {
      const totalOutstanding = outstandingPenalty + outstandingInterest;
      const confirmMsg = `WARNING: There are outstanding dues of ₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Interest: ₹${outstandingInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Penalty: ₹${outstandingPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).\n\nMaking a Partial Payment will reduce the Principal Balance ONLY.\nIt will NOT pay off outstanding interest/penalty, NOT extend the due date, and NOT reset the accrual cycle.\n\nAre you sure you want to proceed with this Principal Reduction Only payment?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    const dueDays = renewCalculations.daysPastDue || 0;

    setIsRenewing(true);
    try {
      // Snapshot variables before saving
      const principalBefore = ledgerMetrics.principalBalance;
      const paymentAmount = Number(amount.toFixed(2));

      // ===== PRIORITY ALLOCATION: Penalty → Interest → Principal =====
      let penaltyPaid = 0;
      let interestPaid = 0;
      let principalPaid = 0;
      let renewedDays = 0;

      // Use OUTSTANDING (always >= 0) for payment allocation, not display values
      const outstandingPenalty = renewCalculations.outstandingPenalty || 0;
      const outstandingInterest = renewCalculations.outstandingInterest || 0;

      const periodDays = (selectedLoan.period_days && Number(selectedLoan.period_days) > 0) ? Number(selectedLoan.period_days) : 30;
      const interestRate = Number(selectedLoan?.interest_rate) || 3;
      const monthlyInterest = Number(((principalBefore * (interestRate / 100) * periodDays) / 30).toFixed(2));

      const isClosingPayment = actionType === 'Close' || paymentAmount >= Math.max(0, ledgerMetrics.totalClose);

      let overdueInterestPaid = 0;
      let renewalInterestPaid = 0;

      if (isClosingPayment) {
        // Close: clear all remaining dues, excess reduces principal
        penaltyPaid   = outstandingPenalty;
        overdueInterestPaid = outstandingInterest;
        renewalInterestPaid = 0;
        interestPaid  = outstandingInterest;
        principalPaid = Number(Math.max(0, paymentAmount - penaltyPaid - overdueInterestPaid).toFixed(2));
        renewedDays   = 0;
      } else {
        const split = financeCalculationService.computeCDPaymentSplit(
          paymentAmount,
          outstandingPenalty,
          outstandingInterest,
          monthlyInterest,
          principalBefore,
          actionType,
          periodDays
        );
        penaltyPaid   = split.penaltyPaid;
        overdueInterestPaid = split.overdueInterestPaid;
        renewalInterestPaid = split.renewalInterestPaid;
        interestPaid  = split.interestPaid;
        principalPaid = split.principalPaid;
        renewedDays   = split.renewedDays;
      }

      let renewedTillDate: string | null = null;
      if (renewedDays > 0) {
        // VBA: NextDueDate = DueDate + RDAYS — always extends from old DueDate
        const baseDateMs = renewCalculations?.dueDate
          ? startOfDay(renewCalculations.dueDate)
          : startOfDay(paymentDate);
        const nextDueDate = new Date(baseDateMs + renewedDays * 24 * 60 * 60 * 1000);
        const tzoffset = nextDueDate.getTimezoneOffset() * 60000;
        renewedTillDate = new Date(nextDueDate.getTime() - tzoffset).toISOString().split('T')[0];
      }

      // Console logs for debugging
      console.log('=== Priority Payment Split ===');
      console.log('receiptNo:', receiptNo);
      console.log('paymentAmount:', paymentAmount);
      console.log('dueDays:', dueDays);
      console.log('renewedDays:', renewedDays);
      console.log('renewedTillDate:', renewedTillDate);
       console.log('penaltyPaid:', penaltyPaid);
       console.log('interestPaid:', interestPaid);
       console.log('overdueInterestPaid:', overdueInterestPaid);
       console.log('renewalInterestPaid:', renewalInterestPaid);
       console.log('principalPaid:', principalPaid);
      console.log('principalBefore:', principalBefore);
      console.log('principalAfter:', Number((principalBefore - principalPaid).toFixed(2)));
      
      const res = await supabaseFinance.postCdLedgerPayment({
        loanId: selectedLoan.id,
        customerId: selectedLoan.customer_id,
        accountName: selectedLoan.customer?.name || null,
        userName: user?.username || 'Staff',
        actionType,
        principalPaid,
        interestPaid,
        penaltyPaid,
        renewedDays,
        paymentDate,
        receiptNo,
        renewedTillDate
      });
      
      if (!res.success) {
        throw new Error(res.error || 'Failed to post ledger entries');
      }
      
      const totalForClose = ledgerMetrics.totalClose;

      if (actionType === 'Close' || paymentAmount >= totalForClose) {
        const { error: closeError } = await supabase.from('finance_loans').update({ 
          status: 'Closed',
          amount: Math.max(0, Number((principalBefore - principalPaid).toFixed(2)))
        }).eq('id', selectedLoan.id);
        if (closeError) throw closeError;
      } else {
        const updates: any = {};
        
        // For renewal/partial: set loan date based on next_due_date = base_date + renewed_days
        // Loan start date = next_due_date - periodDays
        // VBA: NextDueDate = DueDate + RDAYS — always extends from old DueDate
        if (renewedDays > 0) {
          const baseDateMs = renewCalculations?.dueDate
            ? startOfDay(renewCalculations.dueDate)
            : startOfDay(paymentDate);
          const nextDueDate = new Date(baseDateMs + renewedDays * 24 * 60 * 60 * 1000);
          
          console.log('=== RENEWAL DUE DATE ADVANCEMENT DEBUG ===');
          console.log('old_current_due_date:', renewCalculations.dueDate);
          console.log('payment_date:', paymentDate);
          console.log('base_date:', new Date(baseDateMs));
          console.log('interest_paid:', interestPaid);
          console.log('monthly_interest:', monthlyInterest);
          console.log('renewed_days:', renewedDays);
          console.log('next_due_date:', nextDueDate);

          const newCycleStart = new Date(nextDueDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
          const tzoffset = newCycleStart.getTimezoneOffset() * 60000;
          updates.date = new Date(newCycleStart.getTime() - tzoffset).toISOString().split('T')[0];
          
          console.log('new_loan_date (updates.date):', updates.date);
        }
        
        if (principalPaid > 0) {
          updates.amount = Math.max(0, Number((principalBefore - principalPaid).toFixed(2)));
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase.from('finance_loans').update(updates).eq('id', selectedLoan.id);
          if (updateError) throw updateError;
        }
      }
      
      setTotalAmountPaying('');
      await fetchLedgerData();
      await loadLedgerDetails(selectedLoan.id);

      if (actionType === 'Close' || paymentAmount >= totalForClose) {
        toast.success('Account closed successfully');
      } else {
        toast.success(`Payment applied — ${renewedDays} days renewed`);
      }
    } catch(e: any) {
      console.error(e);
      toast.error(e?.message || 'Error applying payment');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleNPACloseSubmit = async () => {
    if (!selectedLoan) return;
    setIsNpaClosing(true);
    try {
      const npaClosedDate = new Date(paymentDate).toISOString();
      const npaClosedAmount = Number(npaSettlementAmount) || 0;
      const closedBy = (user?.username || 'Staff').toUpperCase();
      const npaReceiptNo = await supabaseFinance.getNextReceiptNumber();
      const cleanNpaReason = npaReason.trim().toUpperCase();
      
      const updatedRemarks = `${selectedLoan.remarks || ''}\n[NPA CLOSED AT ${npaClosedDate} BY ${closedBy} WITH SETTLEMENT AMOUNT: ${npaClosedAmount}]`.trim().toUpperCase();
      
      const { error: loanError } = await supabase.from('finance_loans')
        .update({ 
          status: 'NPA_CLOSED', 
          npa_closed: true, 
          amount: selectedLoan.amount,
          remarks: updatedRemarks
        })
        .eq('id', selectedLoan.id);
      if (loanError) throw loanError;

      const principal_balance = ledgerMetrics.principalBalance;
      const interest_due = ledgerMetrics.pendingInterest;
      const penalty_due = ledgerMetrics.pendingPenalty;
      const total_outstanding = principal_balance + interest_due + penalty_due;
      const principalPaidTotal = 0;

      await supabaseFinance.addNPARecord({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        customer_name: (selectedLoan.customer?.name || '').toUpperCase(),
        aadhaar: selectedLoan.customer?.aadhaar || '',
        phone: selectedLoan.customer?.phone || '',
        loan_type: selectedLoan.loan_category || 'CD',
        loan_amount: Number(selectedLoan.amount),
        paid_amount: principalPaidTotal,
        balance_amount: principal_balance,
        interest_due: interest_due,
        penalty_due: penalty_due,
        settlement_amount: npaClosedAmount,
        total_liability: total_outstanding,
        waived_amount: total_outstanding - npaClosedAmount,
        reason: cleanNpaReason,
        closed_by: closedBy,
        closed_at: npaClosedDate
      });

      const npaParticulars = `NPA CLOSE\n` +
        `Principal Outstanding: ₹${principal_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Interest Outstanding: ₹${interest_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Penalty Outstanding: ₹${penalty_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Total Outstanding: ₹${total_outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `Closed By: ${closedBy}\n` +
        `Reason: ${cleanNpaReason}`;

      await supabaseFinance.addCDLedgerEntry({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD A/C',
        entry_date: npaClosedDate,
        credit: 0,
        debit: 0,
        receipt_no: npaReceiptNo,
        particulars: npaParticulars.toUpperCase(),
        user_name: closedBy,
        entry_type: 'NPA_CLOSE'
      });

      await fetchLedgerData();
      await loadLedgerDetails(selectedLoan.id);
      toast.success('NPA Account closed and settlement recorded.');
      setShowNpaModal(false);
    } catch(e) {
      console.error(e);
      toast.error('Error settling NPA account');
    } finally {
      setIsNpaClosing(false);
    }
  };

  const handleReturnDocSubmit = async () => {
    if (!selectedLoan) return;
    setIsReturningDoc(true);
    try {
      let signatureUrl = null;
      if (returnSignature) {
        const fileExt = returnSignature.name.split('.').pop();
        const fileName = `signature-${selectedLoan.loan_id}-${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('finance-photos').upload(`documents/${fileName}`, returnSignature);
        if (!error && data) {
          signatureUrl = supabase.storage.from('finance-photos').getPublicUrl(data.path).data.publicUrl;
        }
      }

      const docReceiptNo = await supabaseFinance.getNextReceiptNumber();

      const { error: docError } = await supabase.from('finance_documents_returned').insert({
        loan_id: selectedLoan.id,
        returned_date: returnDate,
        returned_to: returnedTo,
        received_by_signature: signatureUrl,
        remarks: returnRemarks,
        created_by: user?.username || 'Staff',
        receipt_no: docReceiptNo
      });
      if (docError) throw docError;

      await supabaseFinance.addCDLedgerEntry({
        loan_id: selectedLoan.id,
        customer_id: selectedLoan.customer_id,
        account_name: 'CD A/C',
        entry_date: returnDate,
        credit: 0,
        debit: 0,
        receipt_no: docReceiptNo,
        particulars: `Documents Returned to ${returnedTo} - ${returnRemarks}`,
        user_name: user?.username || 'Staff',
        entry_type: 'Settlement'
      });

      await loadLedgerDetails(selectedLoan.id);
      toast.success('Documents returned successfully.');
      setShowReturnDocModal(false);
    } catch(e) {
      console.error(e);
      toast.error('Error recording document return');
    } finally {
      setIsReturningDoc(false);
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!selectedLoan) {
      toast.error('No ledger data is currently loaded to export');
      return;
    }

    const exportData = displayedStatementEntries.map((tx: any) => ({
      Date: formatDateOld(tx.entry_date),
      Account: tx.account_name || 'CD A/C',
      Credit: tx.credit,
      Debit: tx.debit,
      Particulars: tx.particulars || '',
      User: tx.user_name || '',
      'Receipt No': tx.receipt_no || '-'
    }));

    const filename = `${selectedLoan.loan_id}_CD_Ledger_${new Date().toISOString().split('T')[0]}`;

    if (format === 'xlsx') {
      const res = exportToExcel(exportData, filename, 'Transactions');
      if (res.success) toast.success('Excel ledger exported successfully');
    } else {
      const res = exportToCSV(exportData, filename);
      if (res.success) toast.success('CSV ledger exported successfully');
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full border border-red-200">
          <ShieldAlert className="w-16 h-16 text-red-600 animate-pulse" />
        </div>
        <h1 className="finance-h1">Access Restricted</h1>
        <p className="text-gray-500 max-w-md">
          Only authorized personnel are allowed to view the CD Ledger. Please consult your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-6 p-6 max-w-7xl mx-auto ${showPrintPreview ? 'print:hidden' : 'print:p-0'}`}>
        
        {/* Top row: unified search and metadata header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
          
          {/* Top Left: Today's date and navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="finance-caption uppercase block mb-1">Today's Date / Payment Date</label>
              <input 
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={selectedLoan?.status === 'Closed' || selectedLoan?.status === 'NPA_CLOSED'}
                className={`bg-white border rounded-xl p-2 text-gray-800 focus:ring-2 focus:outline-none finance-input h-[42px] ${renewCalculations?.isDateInvalid ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-green-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
            
            <div>
              <label className="finance-caption uppercase block mb-1">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setSelectedLoan(null);
                }}
                className="bg-white border border-gray-200 rounded-xl p-2 text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none finance-input h-[42px] font-bold text-xs uppercase"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ALL">ALL</option>
                <option value="CLOSED">CLOSED</option>
                <option value="NPA CLOSED">NPA CLOSED</option>
              </select>
            </div>
          </div>

          {/* Top Middle: Dynamic user name & real-time clock */}
          <div className="flex flex-col text-center border-l border-r border-gray-150 px-6 py-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              User: <span className="text-green-700 font-bold">{(user as any)?.name || user?.username || 'RAMESH'}</span>
            </span>
            <span className="text-xs text-gray-400 font-mono mt-0.5">{timeStr}</span>
          </div>

          {/* Top Right: Autocomplete Name Search and Account Dropdowns */}
          <div className="flex flex-1 max-w-lg gap-3">
            {/* Name autocomplete */}
            <div className="relative flex-1">
              <label className="finance-caption uppercase block mb-1">Name Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchNameQuery !== '' ? searchNameQuery : (selectedLoan?.customer?.name || '')}
                  onChange={(e) => {
                    setSearchNameQuery(e.target.value);
                    setShowNameDropdown(true);
                  }}
                  onFocus={() => setShowNameDropdown(true)}
                  onBlur={() => setTimeout(() => setShowNameDropdown(false), 250)}
                  placeholder="Search name..."
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none h-[42px]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
              
              {showNameDropdown && nameSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {nameSuggestions.map(loan => (
                    <button
                      key={loan.id}
                      onMouseDown={() => {
                        loadLedgerDetails(loan.id);
                        setSearchNameQuery('');
                        setShowNameDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-gray-750 font-medium border-b border-gray-50 last:border-0"
                    >
                      <div className="font-semibold text-gray-900">{loan.customer?.name}</div>
                      <div className="text-[10px] text-gray-500 flex justify-between">
                        <span>A/C: {loan.loan_id}</span>
                        <span>Phone: {loan.customer?.phone}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* A/C selector */}
            <div className="relative w-40">
              <label className="finance-caption uppercase block mb-1">A/C Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchAcQuery !== '' ? searchAcQuery : (selectedLoan?.loan_id || '')}
                  onChange={(e) => {
                    setSearchAcQuery(e.target.value);
                    setShowAcDropdown(true);
                  }}
                  onFocus={() => setShowAcDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAcDropdown(false), 250)}
                  placeholder="Search A/C..."
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none h-[42px]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
              
              {showAcDropdown && acSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {acSuggestions.map(loan => (
                    <button
                      key={loan.id}
                      onMouseDown={() => {
                        loadLedgerDetails(loan.id);
                        setSearchAcQuery('');
                        setShowAcDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-gray-750 font-medium border-b border-gray-50 last:border-0"
                    >
                      <div className="font-semibold text-gray-900">A/C: {loan.loan_id}</div>
                      <div className="text-[10px] text-gray-500 flex justify-between">
                        <span>Name: {loan.customer?.name}</span>
                        <span>Phone: {loan.customer?.phone}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
            <p className="text-gray-500 finance-section-heading">Compiling CD ledger registry...</p>
          </div>
        ) : !selectedLoan ? (
          /* ========== LOAN INDEX / LIST VIEW ========== */
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Index Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <List className="w-5 h-5 text-green-600" />
                  All CD Loans
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{filteredLoansList.length} loan(s) in the system</p>
              </div>
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Search by name, A/C number, or phone..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none focus:bg-white transition-colors"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Loan Table */}
            {(() => {
              const q = listSearchQuery.toLowerCase().trim();
              const filtered = q
                ? filteredLoansList.filter(loan =>
                    loan.loan_id.toLowerCase().includes(q) ||
                    (loan.customer?.name || '').toLowerCase().includes(q) ||
                    (loan.customer?.phone || '').includes(q) ||
                    (loan.customer?.aadhaar || '').includes(q)
                  )
                : filteredLoansList;

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm">
                      {filteredLoansList.length === 0
                        ? 'No CD loans found in the system.'
                        : `No loans match "${listSearchQuery}"`}
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">A/C Number</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Loan Amount</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate %</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((loan, idx) => (
                        <tr
                          key={loan.id}
                          className="hover:bg-green-50/50 cursor-pointer transition-colors group"
                          onClick={() => {
                            loadLedgerDetails(loan.id);
                            setListSearchQuery('');
                          }}
                        >
                          <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-6 py-3.5 font-bold text-green-700 font-mono">{loan.loan_id}</td>
                          <td className="px-6 py-3.5 font-semibold text-gray-900">{loan.customer?.name || 'N/A'}</td>
                          <td className="px-6 py-3.5 text-gray-600 font-mono">{loan.customer?.phone || '-'}</td>
                          <td className="px-6 py-3.5 font-semibold text-gray-800">₹{Number(loan.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-6 py-3.5 text-gray-600">{loan.interest_rate}%</td>
                          <td className="px-6 py-3.5 text-gray-500 text-xs">{loan.date ? new Date(loan.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}</td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              loan.status === 'Active' ? 'bg-green-100 text-green-700'
                              : loan.status === 'Closed' ? 'bg-gray-100 text-gray-500'
                              : loan.status === 'NPA_CLOSED' ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {(loan.status || 'Active').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="text-green-600 text-xs font-semibold group-hover:underline">Open →</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Workspace Header Hub */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => { setSelectedLoan(null); setListSearchQuery(''); }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-gray-655 hover:text-slate-900 bg-gray-50 hover:bg-gray-100 border border-gray-200/60 px-3 py-2 rounded-xl transition-all shadow-sm font-sans"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to All
                </button>
                <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                    {selectedLoan.customer?.name}
                    <span className="text-sm font-mono text-slate-900 font-black bg-slate-100 px-2.5 py-0.5 rounded-lg">A/C: {selectedLoan.loan_id}</span>
                  </h2>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedLoan.status === 'Active' ? 'bg-green-100 text-green-700'
                  : selectedLoan.status === 'Closed' ? 'bg-gray-100 text-gray-500'
                  : selectedLoan.status === 'NPA_CLOSED' ? 'bg-orange-100 text-orange-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {(selectedLoan.status || 'Active').toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto font-sans">
                <span className="text-xs text-slate-800 uppercase tracking-wider font-extrabold">
                  Record: <span className="text-gray-750 font-black">{currentIndex + 1}</span> of <span className="text-gray-750 font-black">{filteredLoansList.length}</span>
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevRecord}
                    disabled={currentIndex <= 0}
                    className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Previous Record"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-650" />
                  </button>
                  <button
                    onClick={handleNextRecord}
                    disabled={currentIndex >= filteredLoansList.length - 1}
                    className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Next Record"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-655" />
                  </button>
                </div>
              </div>
            </div>

            {/* Workspace Profile Cards Layout (Row 1: Borrower & Guarantors, Row 2: Photos & Documents) */}
            <div className="space-y-6 print:hidden">
              {/* Row 1: Borrower and Guarantor Details (3 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Customer Details */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <div>
                      <span className="text-xs uppercase font-extrabold text-slate-900 tracking-wider block">Customer Details</span>
                      <span className="text-[10px] text-slate-500 font-bold block">Borrower Info</span>
                    </div>
                    <Button 
                      onClick={isEditing ? handleSaveDetails : handleToggleEdit} 
                      variant={isEditing ? "success" : "secondary"}
                      size="xs"
                      icon={isEditing ? Save : Edit2}
                      disabled={savingDetails || selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                      className="scale-90 border-0"
                    >
                      {isEditing ? 'Save' : 'Edit'}
                    </Button>
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2 text-xs">
                        <Input label="Name" value={editCustName} onChange={setEditCustName} className="scale-90 origin-top-left" />
                        <Input label="S/o W/o" value={editCustFatherName} onChange={setEditCustFatherName} className="scale-90 origin-top-left" />
                        <Input label="Address" value={editCustAddress} onChange={setEditCustAddress} className="scale-90 origin-top-left" />
                        <Input label="Phone 1" value={editCustPhone} onChange={setEditCustPhone} className="scale-90 origin-top-left" />
                        <Input label="Phone 2" value={editCustPhone2} onChange={setEditCustPhone2} className="scale-90 origin-top-left" />
                        <Input label="Aadhaar" value={editCustAadhaar} onChange={setEditCustAadhaar} className="scale-90 origin-top-left" />
                        <Input label="Partner" value={editCustPartnerName} onChange={setEditCustPartnerName} className="scale-90 origin-top-left" />
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs text-gray-700">
                        <div className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Name:</span>
                          <span className="text-xs font-black text-black">{selectedLoan.customer?.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">S/o W/o:</span>
                          <span className="text-xs font-black text-black">{selectedLoan.customer?.father_husband_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Phone 1:</span>
                          <span className="text-xs font-black text-black">{selectedLoan.customer?.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Phone 2:</span>
                          <span className="text-xs font-black text-black">{selectedLoan.customer?.phone2 || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Aadhaar:</span>
                          <span className="text-xs font-black text-black font-mono">{selectedLoan.customer?.aadhaar || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Partner:</span>
                          <span className="text-xs font-black text-black">{selectedLoan.customer?.partner_name || 'N/A'}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-50 pb-1.5">
                          <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Address:</span>
                          <span className="text-xs font-black text-black leading-tight mt-1">{selectedLoan.customer?.address || 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Guarantor 1 */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <div>
                      <span className="text-xs uppercase font-extrabold text-slate-900 tracking-wider block">Guarantor 1</span>
                      <span className="text-[10px] text-slate-500 font-bold block">Surety Profile</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 text-xs text-gray-700">
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Name:</span>
                      <span className="text-xs font-black text-black">{guarantor1?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Phone No:</span>
                      <span className="text-xs font-black text-black">{guarantor1?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Aadhaar:</span>
                      <span className="text-xs font-black text-black font-mono">{guarantor1?.aadhaar || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Guarantor 2 */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <div>
                      <span className="text-xs uppercase font-extrabold text-slate-900 tracking-wider block">Guarantor 2</span>
                      <span className="text-[10px] text-slate-500 font-bold block">Secondary Surety</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 text-xs text-gray-700">
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Name:</span>
                      <span className="text-xs font-black text-black">{guarantor2?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Phone No:</span>
                      <span className="text-xs font-black text-black">{guarantor2?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Aadhaar:</span>
                      <span className="text-xs font-black text-black font-mono">{guarantor2?.aadhaar || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Profile Photos and Document Status (2 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 4: Profile Photos */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <div>
                      <span className="text-xs uppercase font-extrabold text-slate-900 tracking-wider block">Profile Photos</span>
                      <span className="text-[10px] text-slate-500 font-bold block">Biometric Images</span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4 mt-1">
                    {/* Borrower Photo */}
                    <div className="text-center">
                      <div className="w-full aspect-[4/3] rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative group">
                        {selectedLoan.customer?.customer_photo_url ? (
                          <img src={selectedLoan.customer.customer_photo_url} alt="Borrower Person" className="w-full h-full object-cover" />
                        ) : selectedLoan.customer_photo_url ? (
                          <img src={selectedLoan.customer_photo_url} alt="Borrower Person" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-gray-300" />
                        )}
                        <span className="absolute bottom-0 left-0 right-0 bg-slate-900/60 text-white text-[10px] py-1 text-center font-bold tracking-wider opacity-90">BORROWER</span>
                      </div>
                    </div>

                    {/* Surety 1 Photo */}
                    <div className="text-center">
                      <div className="w-full aspect-[4/3] rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative group">
                        {guarantor1?.photo_url ? (
                          <img src={guarantor1.photo_url} alt="Surety 1 Person" className="w-full h-full object-cover" />
                        ) : guarantor1?.customer_photo_url ? (
                          <img src={guarantor1.customer_photo_url} alt="Surety 1 Person" className="w-full h-full object-cover" />
                        ) : selectedLoan.surety_photo_url ? (
                          <img src={selectedLoan.surety_photo_url} alt="Surety 1 Person" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-gray-300" />
                        )}
                        <span className="absolute bottom-0 left-0 right-0 bg-slate-900/60 text-white text-[10px] py-1 text-center font-bold tracking-wider opacity-90">SURETY 1</span>
                      </div>
                    </div>

                    {/* Surety 2 Photo */}
                    <div className="text-center">
                      <div className="w-full aspect-[4/3] rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative group">
                        {guarantor2?.photo_url ? (
                          <img src={guarantor2.photo_url} alt="Surety 2 Person" className="w-full h-full object-cover" />
                        ) : guarantor2?.customer_photo_url ? (
                          <img src={guarantor2.customer_photo_url} alt="Surety 2 Person" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-gray-300" />
                        )}
                        <span className="absolute bottom-0 left-0 right-0 bg-slate-900/60 text-white text-[10px] py-1 text-center font-bold tracking-wider opacity-90">SURETY 2</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 5: Documents & Status */}
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 relative flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <div>
                      <span className="text-xs uppercase font-extrabold text-slate-900 tracking-wider block">Document Status</span>
                      <span className="text-[10px] text-slate-500 font-bold block">Pledged Files</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-3 text-xs">
                    <div className="space-y-2 text-gray-700">
                      <div className="flex justify-between border-b border-gray-50 pb-1.5">
                        <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Doc Type:</span>
                        <span className="text-xs font-black text-black text-right" title={loanDocuments.map(d => d.document_name).join(', ')}>
                          {loanDocuments.map(d => d.document_name).join(', ') || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
                        <span className="text-[11px] uppercase font-extrabold text-slate-900 tracking-wider">Returned Status:</span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                          documentReturned ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {documentReturned ? 'Yes (Returned)' : 'No (Submitted)'}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => setShowReturnDocModal(true)}
                      disabled={(selectedLoan.status !== 'Closed' && selectedLoan.status !== 'NPA_CLOSED') || !!renewCalculations?.isDateInvalid}
                      variant="primary"
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700 border-0 text-xs py-2 uppercase font-bold tracking-wider mt-1 font-sans"
                    >
                      Document Returned
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Unified Operator Workspace - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* LEFT COLUMN (2/3 Width): Action Hub & Statements */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Operator calculations panel */}
                <Card 
                  title="Operator Action & Calculations" 
                  subtitle="Configure transactions and calculations details"
                  className="shadow-sm border-gray-100 rounded-3xl"
                >
                  {renewCalculations?.isDateInvalid ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-750 font-semibold mb-6">
                      <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
                      <span>Payment date cannot be before loan date ({renewCalculations.loanDate}).</span>
                    </div>
                  ) : null}

                  {/* Active Interactive Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <Input label="Receipt No" value={receiptNo} readOnly className="bg-gray-50 text-gray-700 font-mono" />
                    <Input 
                      label="Total Amount Paying" 
                      value={totalAmountPaying} 
                      onChange={setTotalAmountPaying} 
                      className="font-bold text-green-700 text-lg" 
                      placeholder="Enter ₹" 
                      type="text"
                      inputMode="decimal"
                      disabled={selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                    />
                  </div>

                  {/* Signature Element: Interactive Payment Allocation Visualizer */}
                  {paymentPreview && (
                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 mb-6 space-y-4 shadow-sm">
                      <h4 className="text-xs text-slate-800 font-bold uppercase tracking-wider border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        Real-Time Payment Allocation Visualizer
                      </h4>

                      {paymentPreview.isClosingPayment ? (
                        <div className="space-y-3">
                          <span className="text-xs font-bold text-slate-600 uppercase block">Closing Allocation Preview</span>
                          {(() => {
                            const total = paymentPreview.paymentAmount;
                            const pPaid = paymentPreview.renew.penaltyPaid;
                            const oPaid = paymentPreview.renew.overdueInterestPaid;
                            const prPaid = paymentPreview.renew.principalPaid;

                            const pctP = total > 0 ? (pPaid / total) * 100 : 0;
                            const pctO = total > 0 ? (oPaid / total) * 100 : 0;
                            const pctPr = total > 0 ? (prPaid / total) * 100 : 0;

                            return (
                              <div className="space-y-2.5">
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                  {pctP > 0 && <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${pctP}%` }} title={`Penalty: ₹${pPaid}`} />}
                                  {pctO > 0 && <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pctO}%` }} title={`Overdue Interest: ₹${oPaid}`} />}
                                  {pctPr > 0 && <div className="bg-indigo-650 h-full transition-all duration-300" style={{ width: `${pctPr}%` }} title={`Principal: ₹${prPaid}`} />}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600 font-sans">
                                  {pPaid > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Penalty: ₹{pPaid.toLocaleString('en-IN')}</span>}
                                  {oPaid > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Overdue Int: ₹{oPaid.toLocaleString('en-IN')}</span>}
                                  {prPaid > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-650"></span>Principal: ₹{prPaid.toLocaleString('en-IN')}</span>}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Option 1 Bar */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-emerald-800 uppercase block">Option 1: Renewal Account Allocation</span>
                            {(() => {
                              const total = paymentPreview.paymentAmount;
                              const pPaid = paymentPreview.renew.penaltyPaid;
                              const oPaid = paymentPreview.renew.overdueInterestPaid;
                              const rPaid = paymentPreview.renew.renewalInterestPaid;
                              const prPaid = paymentPreview.renew.principalPaid;

                              const pctP = total > 0 ? (pPaid / total) * 100 : 0;
                              const pctO = total > 0 ? (oPaid / total) * 100 : 0;
                              const pctR = total > 0 ? (rPaid / total) * 100 : 0;
                              const pctPr = total > 0 ? (prPaid / total) * 100 : 0;

                              return (
                                <div className="space-y-2">
                                  <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200/40">
                                    {pctP > 0 && <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${pctP}%` }} title={`Penalty: ₹${pPaid}`} />}
                                    {pctO > 0 && <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pctO}%` }} title={`Overdue Interest: ₹${oPaid}`} />}
                                    {pctR > 0 && <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${pctR}%` }} title={`Renewal Interest: ₹${rPaid}`} />}
                                    {pctPr > 0 && <div className="bg-indigo-650 h-full transition-all duration-300" style={{ width: `${pctPr}%` }} title={`Principal: ₹${prPaid}`} />}
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600 font-sans">
                                    {pPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Penalty: ₹{pPaid.toLocaleString('en-IN')}</span>}
                                    {oPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Overdue Int: ₹{oPaid.toLocaleString('en-IN')}</span>}
                                    {rPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Renewal Int: ₹{rPaid.toLocaleString('en-IN')}</span>}
                                    {prPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-650"></span>Principal: ₹{prPaid.toLocaleString('en-IN')}</span>}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Option 2 Bar */}
                          {paymentPreview.partial.principalPaid > 0 && (
                            <div className="space-y-2 border-t border-slate-200/50 pt-3">
                              <span className="text-[11px] font-bold text-indigo-800 uppercase block">Option 2: Partial Payment Allocation (Principal Only)</span>
                              {(() => {
                                const total = paymentPreview.paymentAmount;
                                const pPaid = paymentPreview.partial.penaltyPaid;
                                const oPaid = paymentPreview.partial.overdueInterestPaid;
                                const rPaid = paymentPreview.partial.renewalInterestPaid;
                                const prPaid = paymentPreview.partial.principalPaid;

                                const pctP = total > 0 ? (pPaid / total) * 100 : 0;
                                const pctO = total > 0 ? (oPaid / total) * 100 : 0;
                                const pctR = total > 0 ? (rPaid / total) * 100 : 0;
                                const pctPr = total > 0 ? (prPaid / total) * 100 : 0;

                                return (
                                  <div className="space-y-2">
                                    <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200/40">
                                      {pctP > 0 && <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${pctP}%` }} title={`Penalty: ₹${pPaid}`} />}
                                      {pctO > 0 && <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pctO}%` }} title={`Overdue Interest: ₹${oPaid}`} />}
                                      {pctR > 0 && <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${pctR}%` }} title={`Renewal Interest: ₹${rPaid}`} />}
                                      {pctPr > 0 && <div className="bg-indigo-650 h-full transition-all duration-300" style={{ width: `${pctPr}%` }} title={`Principal: ₹${prPaid}`} />}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600 font-sans">
                                      {pPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Penalty: ₹{pPaid.toLocaleString('en-IN')}</span>}
                                      {oPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Overdue Int: ₹{oPaid.toLocaleString('en-IN')}</span>}
                                      {rPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Renewal Int: ₹{rPaid.toLocaleString('en-IN')}</span>}
                                      {prPaid > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-650"></span>Principal: ₹{prPaid.toLocaleString('en-IN')}</span>}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form variables display */}
                  <div className="grid grid-cols-2 gap-3 mb-6 font-sans">
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Loan Amount:</span>
                      <span className="text-base font-black text-black">₹{originalLoanAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Rate / Penalty:</span>
                      <span className="text-base font-black text-black">{Number(selectedLoan.interest_rate).toFixed(2)}% / {Number(selectedLoan.penalty_percent || 0.75).toFixed(2)}%</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Loan Date:</span>
                      <span className="text-base font-black text-black">{formatDateOld(originalLoanDate)}</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Last Payment:</span>
                      <span className="text-base font-black text-black">{formatDateOld(selectedLoan.date)}</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Current Due Date:</span>
                      <span className="text-base font-black text-black">{formatDateOld(renewCalculations?.dueDate)}</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Next Due Date:</span>
                      <span className="text-base font-black text-black">{totalAmountPaying && Number(totalAmountPaying) > 0 && paymentPreview?.renew?.nextDueDate ? formatDateOld(paymentPreview.renew.nextDueDate) : '—'}</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Due Days:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-black text-black">{renewCalculations?.daysPastDue !== undefined ? renewCalculations.daysPastDue : 0}</span>
                        {renewCalculations && renewCalculations.daysRemaining !== undefined && renewCalculations.daysRemaining > 0 && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-black text-[10px] uppercase tracking-wider">{renewCalculations.daysRemaining} Left</span>
                        )}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-3 shadow-sm">
                      <span className="text-xs text-slate-900 font-extrabold uppercase block tracking-wider mb-1">Doc Status:</span>
                      <span className="text-base font-black text-black">{documentReturned ? 'Returned' : 'Submitted'}</span>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      onClick={() => handleActionSubmit('Renew')}
                      disabled={
                        isRenewing || 
                        selectedLoan.status === 'Closed' || 
                        selectedLoan.status === 'NPA_CLOSED' || 
                        !!renewCalculations?.isDateInvalid ||
                        !totalAmountPaying || 
                        Number(totalAmountPaying) <= 0
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1 border-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Renewal
                    </Button>
                    
                    <Button
                      onClick={() => handleActionSubmit('Partial')}
                      disabled={
                        isRenewing || 
                        !totalAmountPaying || 
                        Number(totalAmountPaying) <= 0 ||
                        Number(totalAmountPaying) >= ledgerMetrics.principalBalance ||
                        selectedLoan.status === 'Closed' || 
                        selectedLoan.status === 'NPA_CLOSED' || 
                        !!renewCalculations?.isDateInvalid
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1 border-0"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Partial Payment
                    </Button>
                    
                    <Button
                      onClick={() => handleActionSubmit('Close')}
                      disabled={
                        isRenewing || 
                        selectedLoan.status === 'Closed' || 
                        selectedLoan.status === 'NPA_CLOSED' || 
                        !totalAmountPaying ||
                        Number(totalAmountPaying) < ledgerMetrics.totalClose ||
                        !!renewCalculations?.isDateInvalid
                      }
                      className="bg-rose-600 hover:bg-rose-700 text-white py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1 border-0"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Close Account
                    </Button>
                  </div>
                </Card>

                {/* Statements & Logs unified tabbed card */}
                <Card 
                  title={
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                      <div>
                        <span className="text-base font-extrabold text-slate-950 block">Statements & Logs</span>
                        <span className="text-xs text-slate-600 font-bold block mt-0.5">Track transaction history and interest accruals</span>
                      </div>
                      <div className="flex gap-1.5 bg-gray-100 border border-gray-200 p-1 rounded-xl self-start sm:self-auto font-sans">
                        <button
                          onClick={() => setActiveLogTab('statement')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${
                            activeLogTab === 'statement' 
                              ? 'bg-white text-green-800 shadow-sm border border-gray-150' 
                              : 'text-slate-900 hover:text-black'
                          }`}
                        >
                          Ledger Statement
                        </button>
                        <button
                          onClick={() => setActiveLogTab('interest')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider ${
                            activeLogTab === 'interest' 
                              ? 'bg-white text-green-800 shadow-sm border border-gray-150' 
                              : 'text-slate-900 hover:text-black'
                          }`}
                        >
                          Interest History
                        </button>
                      </div>
                    </div>
                  }
                  className="shadow-sm border-gray-100 rounded-3xl w-full font-sans"
                >
                  {activeLogTab === 'statement' ? (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                      <table className="w-full text-[13px] text-left min-w-[1000px]">
                        <thead>
                          <tr className="bg-gray-100 text-slate-955 uppercase tracking-wider text-[11px] font-black border-b border-gray-200">
                            <th className="px-4 py-3.5">Date</th>
                            <th className="px-4 py-3.5">A/C Name</th>
                            <th className="px-4 py-3.5 text-right">Credit</th>
                            <th className="px-4 py-3.5 text-right">Debit</th>
                            <th className="px-4 py-3.5">User</th>
                            <th className="px-4 py-3.5">Receipt No</th>
                            <th className="px-4 py-3.5">Particulars</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 bg-white">
                          {displayedStatementEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-3.5 font-bold text-slate-800">{formatDateOld(entry.entry_date)}</td>
                              <td className="px-4 py-3.5 font-black text-slate-950">{entry.account_name || 'CD A/C'}</td>
                              <td className="px-4 py-3.5 text-right text-green-800 font-black text-sm">
                                {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right text-red-700 font-black text-sm">
                                {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="px-4 py-3.5 text-slate-800 font-bold">{entry.user_name || 'Staff'}</td>
                              <td className="px-4 py-3.5 font-mono text-slate-900 font-black">{entry.receipt_no || '-'}</td>
                              <td className="px-4 py-3.5 text-slate-700 font-bold" title={entry.particulars}>{entry.particulars || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                      <table className="w-full text-[13px] text-left min-w-[1000px]">
                        <thead>
                          <tr className="bg-gray-100 text-slate-955 uppercase tracking-wider text-[11px] font-black border-b border-gray-200">
                            <th className="px-4 py-3.5">Date</th>
                            <th className="px-4 py-3.5 text-right">Credit</th>
                            <th className="px-4 py-3.5">Receipt No</th>
                            <th className="px-4 py-3.5">Type</th>
                            <th className="px-4 py-3.5">Particulars</th>
                            <th className="px-4 py-3.5 text-center">Days Renewed</th>
                            <th className="px-4 py-3.5">Renewed Till</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 bg-white">
                          {displayedInterestDetails.map((detail) => (
                            <tr key={detail.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-3.5 font-bold text-slate-800">{formatDateOld(detail.entry_date)}</td>
                              <td className="px-4 py-3.5 text-right text-green-800 font-black text-sm">
                                ₹{Number(detail.credit).toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-slate-900 font-black">{detail.receipt_no || '-'}</td>
                              <td className="px-4 py-3.5 font-black text-slate-950">{detail.row_type || '-'}</td>
                              <td className="px-4 py-3.5 text-slate-700 font-bold" title={detail.particulars}>{detail.particulars || '-'}</td>
                              <td className="px-4 py-3.5 text-center font-black text-slate-900">{detail.renewed_days > 0 ? `${detail.renewed_days} Days` : '-'}</td>
                              <td className="px-4 py-3.5 font-bold text-slate-800">{detail.renewed_till_date ? formatDateOld(detail.renewed_till_date) : '-'}</td>
                            </tr>
                          ))}
                          {displayedInterestDetails.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-slate-500 font-bold italic">No interest details found for this loan</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

              </div>

              {/* RIGHT COLUMN (1/3 Width): Summary & Files */}
              <div className="lg:col-span-1 space-y-6">

                {/* Bento Metrics Panel (Unified Summary Panel) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Amount / Principal */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-slate-800 text-xs uppercase font-extrabold tracking-wider block mb-1">Principal Bal.</span>
                    <span className="text-xl font-black text-slate-950 block">₹{ledgerMetrics.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Today Due */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-slate-800 text-xs uppercase font-extrabold tracking-wider block mb-1">Today Due</span>
                    <span className={`text-xl font-black block ${(ledgerMetrics.pendingInterest + ledgerMetrics.pendingPenalty) < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      ₹{(ledgerMetrics.pendingInterest + ledgerMetrics.pendingPenalty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Interest */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-slate-800 text-xs uppercase font-extrabold tracking-wider block mb-1">Accrued Interest</span>
                    <span className={`text-lg font-black block ${ledgerMetrics.pendingInterest < 0 ? 'text-emerald-700' : 'text-slate-950'}`}>
                      ₹{ledgerMetrics.pendingInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Penalty */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-slate-800 text-xs uppercase font-extrabold tracking-wider block mb-1">Accrued Penalty</span>
                    <span className="text-lg font-black text-rose-700 block">₹{ledgerMetrics.pendingPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Total for Renewal */}
                  <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                    <div>
                      <span className="text-emerald-900 text-xs uppercase font-black tracking-wider block">Total for Renewal</span>
                      <span className="text-[11px] text-emerald-800 font-bold block mt-0.5">To extend standard cycle</span>
                    </div>
                    <span className="text-[22px] font-black text-emerald-800">
                      ₹{ledgerMetrics.renewalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Total to Regularize */}
                  <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                    <div>
                      <span className="text-amber-900 text-xs uppercase font-black tracking-wider block">Total to Regularize</span>
                      <span className="text-[11px] text-amber-800 font-bold block mt-0.5">Overdue interest + penalty + renewal</span>
                    </div>
                    <span className="text-[22px] font-black text-amber-800">
                      ₹{ledgerMetrics.totalToRegularize.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Payoff Close Card - Slate/Indigo theme */}
                  <div className="col-span-2 bg-slate-950 border border-slate-900 rounded-2xl p-4 text-white flex justify-between items-center shadow-md hover:scale-[1.01] transition-transform">
                    <div>
                      <span className="text-white text-xs uppercase font-black tracking-wider block">Total for Close</span>
                      <span className="text-[11px] text-slate-350 font-bold block mt-0.5">Full payoff principal & dues</span>
                    </div>
                    <span className="text-2xl font-black text-emerald-400">
                      ₹{ledgerMetrics.totalClose.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Submitted Files & Media Card */}
                <Card title="Submitted Files & Media" className="shadow-sm border-gray-100 rounded-3xl max-h-[300px] overflow-y-auto">
                  <div className="space-y-2.5">
                    {/* Document Upload selector */}
                    <div className="flex gap-2 p-2 bg-gray-50 border border-gray-150 rounded-xl items-center">
                      <select 
                        value={docType} 
                        onChange={(e) => setDocType(e.target.value)} 
                        disabled={selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                        className="flex-1 text-xs bg-white border border-gray-250 p-1.5 rounded-lg focus:outline-none font-sans font-bold text-slate-900"
                      >
                        <option value="Pledge Document">Pledge Document</option>
                        <option value="Aadhaar Card Copy">Aadhaar Card Copy</option>
                        <option value="PAN Card Copy">PAN Card Copy</option>
                        <option value="Land Registry Copy">Land Registry Copy</option>
                        <option value="Other Attachment">Other Attachment</option>
                      </select>
                      <label className={`bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none ${
                        (selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED') ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}>
                        {uploadingDoc ? 'Uploading...' : 'Upload'}
                        <input 
                          type="file" 
                          onChange={handleUploadDocument} 
                          disabled={uploadingDoc || selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {aggregatedDocs.map((doc) => (
                        <div key={doc.id} className="flex justify-between items-center py-2 text-xs">
                          <div className="flex flex-col flex-1 min-w-0 pr-2">
                            <span className="font-semibold text-gray-800 truncate">{doc.name}</span>
                            <span className="text-[10px] text-gray-400 truncate">{doc.remarks}</span>
                          </div>
                          <div className="flex items-center gap-2 font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              doc.returnedStatus === 'Returned' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                            }`}>
                              {doc.returnedStatus}
                            </span>
                            {doc.fileUrl ? (
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:underline font-bold">
                                View
                              </a>
                            ) : null}
                            {doc.allowDelete ? (
                              <button 
                                onClick={() => handleDeleteDocument(doc.id)} 
                                disabled={selectedLoan.status === 'Closed' || selectedLoan.status === 'NPA_CLOSED'}
                                className="text-red-500 hover:text-red-700 font-bold ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {aggregatedDocs.length === 0 ? (
                        <p className="text-center text-gray-400 italic py-4">No documents or files found</p>
                      ) : null}
                    </div>
                  </div>
                </Card>

              </div>

            </div>

            {/* Totals Summary Footer Card & Buttons */}
            <div className="bg-white px-5 py-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3">

              {/* Stats row — flex-wrap so values never clip */}
              <div className="flex flex-wrap items-start gap-x-6 gap-y-3">

                {/* Total Credit */}
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Total Credit</span>
                  <span className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${bottomTotals.totalCredit > 0 ? 'text-green-700' : 'text-slate-300'}`}>
                    ₹{bottomTotals.totalCredit.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px bg-slate-100 hidden sm:block" />

                {/* Total Debit */}
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Total Debit</span>
                  <span className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${bottomTotals.totalDebit > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                    ₹{bottomTotals.totalDebit.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px bg-slate-100 hidden sm:block" />

                {/* Present Balance */}
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Present Bal.</span>
                  <span className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${
                    bottomTotals.presentBalance <= 0 ? 'text-slate-300'
                    : bottomTotals.presentBalance < bottomTotals.totalDebit * 0.25 ? 'text-emerald-600'
                    : 'text-amber-700'
                  }`}>
                    ₹{bottomTotals.presentBalance.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px bg-slate-100 hidden sm:block" />

                {/* Total Dues + mini progress bar */}
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Total Dues</span>
                  <span className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${bottomTotals.totalDues > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                    ₹{bottomTotals.totalDues.toLocaleString('en-IN')}
                  </span>
                  {bottomTotals.totalDues > 0 && (
                    <div className="w-full h-[3px] bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.round((bottomTotals.paidDues / bottomTotals.totalDues) * 100))}%`,
                          background: bottomTotals.pendingDues <= 0 ? '#16a34a' : bottomTotals.paidDues > 0 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="self-stretch w-px bg-slate-100 hidden sm:block" />

                {/* Paid Dues */}
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
                    Paid Dues
                    {bottomTotals.totalDues > 0 && (
                      <span className="ml-1 text-[8px] font-normal text-slate-300 normal-case">
                        {Math.min(100, Math.round((bottomTotals.paidDues / bottomTotals.totalDues) * 100))}%
                      </span>
                    )}
                  </span>
                  <span className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${
                    bottomTotals.paidDues <= 0 ? 'text-slate-300'
                    : bottomTotals.pendingDues <= 0 ? 'text-emerald-600'
                    : 'text-emerald-700'
                  }`}>
                    ₹{bottomTotals.paidDues.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px bg-slate-100 hidden sm:block" />

                {/* Pending Dues */}
                <div className="flex flex-col min-w-[90px]">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Pending Dues</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${bottomTotals.pendingDues > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      ₹{bottomTotals.pendingDues.toLocaleString('en-IN')}
                    </span>
                    {bottomTotals.pendingDues > 0 && (
                      <span className="inline-flex items-center gap-1 bg-red-50 border border-red-100 rounded-full px-1.5 py-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                        <span className="text-[8px] text-red-500 font-semibold">DUE</span>
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Buttons row — always below the stats */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
                <Button
                  onClick={() => setShowPrintPreview(true)}
                  variant="primary"
                  size="sm"
                  icon={Printer}
                  className="bg-green-600 hover:bg-green-700 border-0 text-white rounded-xl shadow-sm text-xs py-2 px-4"
                >
                  Open Report
                </Button>

                <Button
                  onClick={() => setShowNpaModal(true)}
                  disabled={false}
                  variant="danger"
                  size="sm"
                  icon={ShieldAlert}
                  className="bg-orange-600 hover:bg-orange-700 text-white border-0 rounded-xl shadow-sm text-xs py-2 px-4"
                >
                  NPA Close
                </Button>

                <Button 
                  onClick={handleRefresh} 
                  variant="secondary" 
                  size="sm" 
                  icon={RefreshCw}
                  className="rounded-xl border-gray-200 text-xs py-2 px-4"
                >
                  Refresh
                </Button>
                
                <Button
                  onClick={() => handleExport('xlsx')}
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  className="rounded-xl border-gray-200 text-emerald-700 hover:bg-emerald-50 text-xs py-2 px-4"
                >
                  Excel
                </Button>
              </div>

            </div>
          </>
        )}

      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview && !!selectedLoan && !!renewCalculations}
        onClose={() => setShowPrintPreview(false)}
        title="Print Preview (A4 Friendly Layout)"
        documentTitle="CD Daily Loan Ledger Report Card"
      >
        {selectedLoan && renewCalculations && (
          <div className="space-y-6 text-gray-800 font-sans text-xs">
            <div className="text-center border-b-2 border-double border-gray-300 pb-4">
              <h1 className="text-xl font-black text-gray-900 tracking-wide uppercase">Thirumala Finance Groups</h1>
              <span className="text-xs text-gray-500 uppercase tracking-widest block font-medium">CD Daily Loan Ledger statement</span>
              <div className="flex justify-between items-center text-gray-400 mt-4 font-mono text-[9px]">
                <span>PRINTED: {new Date().toLocaleString('en-IN').replace(/\s/g, '')}</span>
                <span>A/C ID: {selectedLoan.loan_id}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-b pb-6">
              <div className="space-y-1.5">
                <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Borrower Details</h4>
                <table className="w-full text-left text-xs leading-loose">
                  <tbody>
                    <tr>
                      <td className="text-gray-400 w-24">Name:</td>
                      <td className="text-gray-900 font-bold">{selectedLoan.customer?.name}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">S/o / W/o:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.customer?.father_husband_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Phones:</td>
                      <td className="text-gray-800 font-medium">
                        {selectedLoan.customer?.phone || 'N/A'} {selectedLoan.customer?.phone2 ? `, ${selectedLoan.customer.phone2}` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Aadhaar:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.customer?.aadhaar || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Partner:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.customer?.partner_name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Address:</td>
                      <td className="text-gray-750 font-medium text-[11px] leading-relaxed">{selectedLoan.customer?.address || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Loan terms</h4>
                <table className="w-full text-left text-xs leading-loose">
                  <tbody>
                    <tr>
                      <td className="text-gray-400 w-28">Original Loan:</td>
                      <td className="text-gray-900 font-bold">₹{originalLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Remaining Bal:</td>
                      <td className="text-gray-900 font-bold">₹{ledgerMetrics.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Rate / Penalty:</td>
                      <td className="text-gray-800 font-medium">{selectedLoan.interest_rate || 3}% / {selectedLoan.penalty_percent || 0.75}%</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Present Interest:</td>
                      <td className="text-gray-900 font-bold text-orange-600">₹{ledgerMetrics.pendingInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Present Penalty:</td>
                      <td className="text-gray-900 font-bold text-red-650">₹{ledgerMetrics.pendingPenalty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-400">Loan Date:</td>
                      <td className="text-gray-800 font-medium">{formatDateOld(selectedLoan.date)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guarantors */}
            <div className="border-b pb-6 space-y-2">
              <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Guarantor Profiles</h4>
              <div className="grid grid-cols-2 gap-4">
                {guarantor1 ? (
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 text-xs">Guarantor 1:</h5>
                    <table className="w-full text-left leading-normal text-xs">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 w-20">Name:</td>
                          <td className="text-gray-900 font-medium">{guarantor1.name}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Phone:</td>
                          <td className="text-gray-800 font-medium">{guarantor1.phone}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Aadhaar:</td>
                          <td className="text-gray-800 font-medium">{guarantor1.aadhaar}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {guarantor2 ? (
                  <div>
                    <h5 className="font-bold text-gray-800 mb-1 text-xs">Guarantor 2:</h5>
                    <table className="w-full text-left leading-normal text-xs">
                      <tbody>
                        <tr>
                          <td className="text-gray-400 w-20">Name:</td>
                          <td className="text-gray-900 font-medium">{guarantor2.name}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Phone:</td>
                          <td className="text-gray-800 font-medium">{guarantor2.phone}</td>
                        </tr>
                        <tr>
                          <td className="text-gray-400">Aadhaar:</td>
                          <td className="text-gray-800 font-medium">{guarantor2.aadhaar}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Interest details */}
            <div className="space-y-2">
              <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Interest & Penalty logs</h4>
              <table className="w-full border border-gray-200 text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[9px] font-bold">
                    <th className="p-2 border-r">Date</th>
                    <th className="p-2 border-r text-right">Credit</th>
                    <th className="p-2 border-r">Receipt No</th>
                    <th className="p-2 border-r">Type</th>
                    <th className="p-2 border-r">Particulars</th>
                    <th className="p-2 border-r text-center">Days Renewed</th>
                    <th className="p-2">Renewed Till</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-250 font-mono text-gray-700">
                  {displayedInterestDetails.map((detail) => (
                    <tr key={detail.id}>
                      <td className="p-2 border-r font-sans">{formatDateOld(detail.entry_date)}</td>
                      <td className="p-2 border-r text-right text-green-700 font-semibold">₹{Number(detail.credit).toLocaleString('en-IN')}</td>
                      <td className="p-2 border-r text-gray-500">{detail.receipt_no || '-'}</td>
                      <td className="p-2 border-r font-sans text-gray-700">{detail.row_type || '-'}</td>
                      <td className="p-2 border-r text-gray-500 font-sans">{detail.particulars || '-'}</td>
                      <td className="p-2 border-r text-center font-bold text-gray-800">{detail.renewed_days > 0 ? `${detail.renewed_days} Days` : '-'}</td>
                      <td className="p-2 font-sans">{detail.renewed_till_date ? formatDateOld(detail.renewed_till_date) : '-'}</td>
                    </tr>
                  ))}
                  {displayedInterestDetails.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 font-sans text-gray-400 italic">No details found</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Statement table */}
            <div className="space-y-2">
              <h4 className="text-green-800 border-b pb-1 text-[10px] font-bold uppercase tracking-wider">Statement Ledgers</h4>
              <table className="w-full border border-gray-200 text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[9px] font-bold">
                    <th className="p-2 border-r">Date</th>
                    <th className="p-2 border-r">A/C Name</th>
                    <th className="p-2 border-r text-right">Credit</th>
                    <th className="p-2 border-r text-right">Debit</th>
                    <th className="p-2 border-r">User</th>
                    <th className="p-2 border-r">Receipt No</th>
                    <th className="p-2">Particulars</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-250 font-mono text-gray-700">
                  {displayedStatementEntries.map((tx) => (
                    <tr key={tx.id}>
                      <td className="p-2 border-r font-sans">{formatDateOld(tx.entry_date)}</td>
                      <td className="p-2 border-r font-sans font-bold text-gray-900">{tx.account_name || 'CD A/C'}</td>
                      <td className="p-2 border-r text-right text-green-705 font-bold">{tx.credit > 0 ? `₹${Number(tx.credit).toLocaleString('en-IN')}` : '-'}</td>
                      <td className="p-2 border-r text-right text-red-705 font-bold">{tx.debit > 0 ? `₹${Number(tx.debit).toLocaleString('en-IN')}` : '-'}</td>
                      <td className="p-2 border-r font-sans text-gray-700">{tx.user_name || 'Staff'}</td>
                      <td className="p-2 border-r text-gray-500">{tx.receipt_no || '-'}</td>
                      <td className="p-2 text-gray-500 font-sans">{tx.particulars || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print Signatures */}
            <div className="pt-20 grid grid-cols-2 gap-20 text-center text-gray-500 text-[10px] font-semibold">
              <div>
                <div className="border-t border-gray-300 pt-1.5 w-32 mx-auto">Borrower Signature</div>
              </div>
              <div>
                <div className="border-t border-gray-300 pt-1.5 w-32 mx-auto">Auditor Signature</div>
              </div>
            </div>

          </div>
        )}
      </FinancePrintPreview>

      {/* NPA Close Account Modal */}
      {showNpaModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl relative">
            <button onClick={() => setShowNpaModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-600" />
              NPA Settlement Close
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 text-orange-850 border border-orange-200 rounded-2xl text-xs leading-relaxed leading-normal">
                <p className="font-semibold mb-1">Confirm NPA Close Action</p>
                <p>Are you sure you want to close this account under NPA? This will mark the loan status as Closed with NPA designation and permanently record the settlement and waived amounts.</p>
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

      {/* Return Documents Modal */}
      {showReturnDocModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl relative">
            <button onClick={() => setShowReturnDocModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <FileIcon className="w-6 h-6 text-blue-600" />
              Return Documents
            </h2>
            <div className="space-y-4">
              <div>
                <label className="finance-caption uppercase mb-2 block">Return Date</label>
                <input 
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>
              <div>
                <Input 
                  label="Returned To (Name)" 
                  value={returnedTo} 
                  onChange={setReturnedTo} 
                  placeholder="Person receiving documents"
                />
              </div>
              <div>
                <label className="finance-caption uppercase mb-2 block">Receiver Signature / Photo</label>
                <input 
                  type="file"
                  onChange={(e) => setReturnSignature(e.target.files?.[0] || null)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2 text-sm text-gray-800"
                />
              </div>
              <div>
                <Input label="Remarks" value={returnRemarks} onChange={setReturnRemarks} />
              </div>
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowReturnDocModal(false)} variant="secondary" className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleReturnDocSubmit} variant="primary" className="flex-1 bg-blue-600 hover:bg-blue-700 border-0 text-white rounded-xl" disabled={isReturningDoc || !returnedTo.trim()}>
                  {isReturningDoc ? 'Saving...' : 'Confirm Return'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CDLedger;
