import React, { useEffect, useState, useMemo } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Save, X, Edit, Trash2, AlertCircle, Upload, CheckCircle, FileText, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { CameraCapture } from '../../components/finance/CameraCapture';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

interface DocumentItem {
  key: string;
  label: string;
  category: 'Financial' | 'Original' | 'Registration';
  checked: boolean;
  refNo: string;
  fileUrl: string | null;
  uploading: boolean;
  isCustom?: boolean;
  dbId?: string;
}

// Helper to format currency properly as Indian Rupees
const formatRupee = (value: number) => {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Remarks serialize/deserialize helpers
const serializeRemarks = (itemDetails: string, goldDetails: string, vehicleDetails: string, notes: string) => {
  return [
    `Item Details: ${itemDetails || ''}`,
    `Gold Details: ${goldDetails || ''}`,
    `Vehicle Details: ${vehicleDetails || ''}`,
    `Notes: ${notes || ''}`
  ].join('\n');
};

const parseRemarks = (remarksStr: string) => {
  const result = {
    itemDetails: '',
    goldDetails: '',
    vehicleDetails: '',
    notes: remarksStr || ''
  };
  if (!remarksStr) return result;

  const itemMatch = remarksStr.match(/Item Details:\s*(.*?)(?=\nGold Details:|\nVehicle Details:|\nNotes:|$)/s);
  const goldMatch = remarksStr.match(/Gold Details:\s*(.*?)(?=\nItem Details:|\nVehicle Details:|\nNotes:|$)/s);
  const vehicleMatch = remarksStr.match(/Vehicle Details:\s*(.*?)(?=\nItem Details:|\nGold Details:|\nNotes:|$)/s);
  const notesMatch = remarksStr.match(/Notes:\s*(.*?)(?=\nItem Details:|\nGold Details:|\nVehicle Details:|$)/s);

  if (itemMatch || goldMatch || vehicleMatch || notesMatch) {
    result.itemDetails = itemMatch ? itemMatch[1].trim() : '';
    result.goldDetails = goldMatch ? goldMatch[1].trim() : '';
    result.vehicleDetails = vehicleMatch ? vehicleMatch[1].trim() : '';
    result.notes = notesMatch ? notesMatch[1].trim() : '';
  }
  return result;
};

const EditLoanEntry: React.FC = () => {
  const { user } = useAuth();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [loans, setLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit states - Customer
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPhone2, setCustPhone2] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);
  const [custFatherHusbandName, setCustFatherHusbandName] = useState('');
  const [custVillage, setCustVillage] = useState('');
  const [custMandal, setCustMandal] = useState('');
  const [custDistrict, setCustDistrict] = useState('');
  const [custAadhaarAddress, setCustAadhaarAddress] = useState('');
  const [custPresentAddress, setCustPresentAddress] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // Edit states - Loan Basics & Terms
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('L');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [dueAmount, setDueAmount] = useState('');
  const [status, setStatus] = useState<'Active' | 'Closed' | 'NPA_CLOSED'>('Active');
  const [docCharges, setDocCharges] = useState('');
  const [penaltyPercent, setPenaltyPercent] = useState('0.75');
  const [periodDays, setPeriodDays] = useState('');

  // Edit states - Collateral & Details (from Remarks)
  const [itemDetails, setItemDetails] = useState('');
  const [goldDetails, setGoldDetails] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [notes, setNotes] = useState('');

  // Edit states - Surety / Guarantors
  const [suretyName, setSuretyName] = useState('');
  const [suretyPhone, setSuretyPhone] = useState('');
  const [suretyAadhaar, setSuretyAadhaar] = useState('');
  const [suretyAadhaarAddress, setSuretyAadhaarAddress] = useState('');
  const [suretyPresentAddress, setSuretyPresentAddress] = useState('');
  const [suretyPhoto, setSuretyPhoto] = useState<string | null>(null);
  const [suretyFingerprintUrl, setSuretyFingerprintUrl] = useState<string | null>(null);
  const [suretyFingerprintTemplate, setSuretyFingerprintTemplate] = useState<string | null>(null);
  const [suretyFingerprintAdded, setSuretyFingerprintAdded] = useState(false);

  // Edit states - Documents Checklist (matches New Loan Entry 1:1)

  const [documents, setDocuments] = useState<DocumentItem[]>([
    { key: 'bank_statements', label: 'BANK STATEMENTS', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'income_proof', label: 'INCOME PROOF / SAL', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'it_returns_gst', label: 'IT RETURNS / GST', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    
    { key: 'land_title_patta', label: 'LAND TITLE / PATTA', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'property_deed', label: 'PROPERTY DEED', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'vehicle_asset_paper', label: 'VEHICLE / ASSET PAP', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    
    { key: 'joint_registration', label: 'JOINT REGISTRATION', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'agreement_bond', label: 'AGREEMENT / BOND', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'photograph', label: 'PHOTOGRAPH', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
  ]);


  // Activity Status
  const [hasLedgerActivity, setHasLedgerActivity] = useState(false);

  useEffect(() => {
    fetchLoans();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredLoans(loans);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = loans.filter(l => 
      l.loan_id.toLowerCase().includes(q) ||
      l.customer?.name.toLowerCase().includes(q) ||
      (l.customer?.phone && l.customer.phone.includes(q)) ||
      (l.customer?.aadhaar && l.customer.aadhaar.includes(q))
    );
    setFilteredLoans(filtered);
  }, [searchQuery, loans]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getLoans();
      setLoans(data);
      setFilteredLoans(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load loans directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLoan = async (loan: any) => {
    setLoading(true);
    try {
      // Fetch loan directly from database (do not use list cache)
      const fullLoan = await supabaseFinance.getLoanById(loan.id);
      if (!fullLoan) {
        toast.error('Failed to load loan record directly from database');
        return;
      }

      setSelectedLoan(fullLoan);
      
      // Customer
      setCustName(fullLoan.customer?.name || '');
      setCustPhone(fullLoan.customer?.phone || '');
      setCustPhone2(fullLoan.customer?.phone_2 || fullLoan.customer?.phone2 || '');
      setCustAddress(fullLoan.customer?.address || '');
      setCustAadhaar(fullLoan.customer?.aadhaar || '');
      setCustPhoto(fullLoan.customer?.customer_photo_url || null);
      setCustFingerprintUrl(fullLoan.customer?.customer_fingerprint_image_url || fullLoan.customer?.fingerprint_url || null);
      setCustFingerprintTemplate(fullLoan.customer?.customer_fingerprint_template || fullLoan.customer?.fingerprint_template || null);
      setCustFingerprintAdded(!!(fullLoan.customer?.customer_fingerprint_added || fullLoan.customer?.fingerprint_added));
      setCustFatherHusbandName(fullLoan.customer?.father_husband_name || fullLoan.customer?.father_name || '');
      setCustVillage(fullLoan.customer?.village || '');
      setCustMandal(fullLoan.customer?.mandal || '');
      setCustDistrict(fullLoan.customer?.district || '');
      setCustAadhaarAddress(fullLoan.customer?.aadhaar_address || '');
      setCustPresentAddress(fullLoan.customer?.present_address || '');
      setPartnerName(fullLoan.customer?.partner_name || '');
      setLoanCategory(fullLoan.loan_category as any || 'L');
  
      // Loan Basics
      setDate(fullLoan.date);
      setAmount(String(fullLoan.amount));
      setInterestRate(String(fullLoan.interest_rate));
      setDurationMonths(String(fullLoan.duration_months));
      setDueType(fullLoan.due_type);
      setDueAmount(String(fullLoan.due_amount));
      setStatus(fullLoan.status);
      setDocCharges(String(fullLoan.document_charges || 0));
      setPenaltyPercent(String(fullLoan.penalty_percent || 0.75));
      setPeriodDays(String(fullLoan.period_days || ''));

      // Parse structured remarks
      const parsedRemarks = parseRemarks(fullLoan.remarks || '');
      setItemDetails(parsedRemarks.itemDetails);
      setGoldDetails(parsedRemarks.goldDetails);
      setVehicleDetails(parsedRemarks.vehicleDetails);
      setNotes(parsedRemarks.notes);
  
      // Surety
      setSuretyName(fullLoan.surety_name || '');
      setSuretyPhone(fullLoan.surety_phone || '');
      setSuretyAadhaar(fullLoan.surety_aadhaar || '');
      setSuretyAadhaarAddress(fullLoan.surety_aadhaar_address || '');
      setSuretyPresentAddress(fullLoan.surety_present_address || '');
      setSuretyPhoto(fullLoan.surety_photo_url || null);
      setSuretyFingerprintUrl(fullLoan.surety_fingerprint_image_url || null);
      setSuretyFingerprintTemplate(fullLoan.surety_fingerprint_template || null);
      setSuretyFingerprintAdded(!!fullLoan.surety_fingerprint_added);

      if (fullLoan.guarantor_1_id) {
        const g = await supabaseFinance.getCustomerById(fullLoan.guarantor_1_id);
        if (g) {
          setSuretyAadhaarAddress(g.aadhaar_address || fullLoan.surety_aadhaar_address || '');
          setSuretyPresentAddress(g.present_address || g.address || fullLoan.surety_present_address || '');
        }
      }

      // Fetch documents for the loan and populate the categorized checklist
      const docs = await supabaseFinance.getLoanDocuments(loan.id);


      // Reset documents checklist to defaults first
      const defaultDocs: DocumentItem[] = [
        { key: 'bank_statements', label: 'BANK STATEMENTS', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'income_proof', label: 'INCOME PROOF / SAL', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'it_returns_gst', label: 'IT RETURNS / GST', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'land_title_patta', label: 'LAND TITLE / PATTA', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'property_deed', label: 'PROPERTY DEED', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'vehicle_asset_paper', label: 'VEHICLE / ASSET PAP', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'joint_registration', label: 'JOINT REGISTRATION', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'agreement_bond', label: 'AGREEMENT / BOND', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
        { key: 'photograph', label: 'PHOTOGRAPH', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
      ];

      // Match DB docs to default checklist items
      const matchedDbIds = new Set<string>();
      const updatedDocs = defaultDocs.map(d => {
        const matched = docs.find((x: any) => x.document_name.toUpperCase().includes(d.label.toUpperCase()));
        if (matched) {
          matchedDbIds.add(matched.id);
          return { ...d, checked: true, refNo: matched.remarks || '', fileUrl: matched.file_url || null, dbId: matched.id };
        }
        return d;
      });

      // Add any extra DB docs that didn't match defaults as custom entries
      docs.forEach((dbDoc: any) => {
        if (!matchedDbIds.has(dbDoc.id)) {
          const cat = dbDoc.category === 'Financial' ? 'Financial' : dbDoc.category === 'Registration' ? 'Registration' : 'Original';
          updatedDocs.push({
            key: `db_${dbDoc.id}`,
            label: dbDoc.document_name,
            category: cat as 'Financial' | 'Original' | 'Registration',
            checked: true,
            refNo: dbDoc.remarks || '',
            fileUrl: dbDoc.file_url || null,
            uploading: false,
            isCustom: true,
            dbId: dbDoc.id,
          });
        }
      });

      setDocuments(updatedDocs);



      // Check ledger/transaction activity
      const entries = await supabaseFinance.getCDLedgerEntries(loan.id);
      const interests = await supabaseFinance.getCDInterestDetails(loan.id);

      const hasActivity = 
        fullLoan.transactions.some((t: any) => t.type !== 'Disbursement') ||
        interests.length > 0 ||
        entries.some((e: any) => 
          e.entry_type !== 'original_loan' && 
          e.entry_type !== 'opening_commission' && 
          e.entry_type !== 'document_charge'
        );

      setHasLedgerActivity(hasActivity);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // Live Calculations
  const liveCalculations = useMemo(() => {
    const P = Number(amount) || 0;
    const R = Number(interestRate) || 0;
    const pDays = loanCategory === 'CD' ? (Number(periodDays) || 30) : 30;
    const docFees = Number(docCharges) || 0;
    const D = Number(durationMonths) || 1;

    let interestPreview = 0;
    if (loanCategory === 'CD') {
      interestPreview = P * (R / 100) * (pDays / 30);
    } else {
      interestPreview = P * (R / 100) * D;
    }

    const renewalAmount = interestPreview;
    const payableAmount = loanCategory === 'CD' ? P - interestPreview - docFees : P - docFees;

    let dueDatePreview = '';
    if (date) {
      const d = new Date(date);
      if (loanCategory === 'CD') {
        d.setDate(d.getDate() + pDays);
      } else {
        d.setMonth(d.getMonth() + D);
      }
      dueDatePreview = d.toISOString().split('T')[0];
    }

    return {
      interestPreview: parseFloat(interestPreview.toFixed(2)),
      renewalAmount: parseFloat(renewalAmount.toFixed(2)),
      payableAmount: parseFloat(payableAmount.toFixed(2)),
      dueDatePreview
    };
  }, [amount, interestRate, periodDays, docCharges, date, loanCategory, durationMonths]);

  // Bi-directional Due Date handler
  const handleDueDateChange = (val: string) => {
    if (!date || !val) return;
    const start = new Date(date);
    const end = new Date(val);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      if (loanCategory === 'CD') {
        setPeriodDays(String(diffDays));
        setDurationMonths(String(diffDays));
      } else {
        const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        setDurationMonths(String(Math.max(1, diffMonths)));
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    // Validation checks
    const P = Number(amount);
    const R = Number(interestRate);
    const pDays = loanCategory === 'CD' ? Number(periodDays) : 30;
    const docFees = Number(docCharges);
    const penPercent = Number(penaltyPercent);

    if (isNaN(P) || P <= 0) {
      toast.error('Principal Amount must be greater than 0.');
      return;
    }
    if (isNaN(R) || R < 0) {
      toast.error('Interest Rate cannot be negative.');
      return;
    }
    if (loanCategory === 'CD' && (isNaN(pDays) || pDays <= 0)) {
      toast.error('Period Days must be greater than 0.');
      return;
    }
    if (isNaN(docFees) || docFees < 0) {
      toast.error('Document Charges cannot be negative.');
      return;
    }
    if (isNaN(penPercent) || penPercent < 0) {
      toast.error('Penalty Rate cannot be negative.');
      return;
    }

    setSaving(true);
    const savingToastId = toast.loading('Saving loan modifications and validating database integrity...');
    try {
      const staffName = user?.username || 'Staff';

      // Parse current DB remarks
      const dbParsedRemarks = parseRemarks(selectedLoan.remarks || '');

      // Check for exact modifications
      const serializeNewRemarks = serializeRemarks(itemDetails, goldDetails, vehicleDetails, notes);
      const remarksChanged = serializeNewRemarks !== (selectedLoan.remarks || '');
      
      const suretyChanged = 
        suretyName !== (selectedLoan.surety_name || '') ||
        suretyPhone !== (selectedLoan.surety_phone || '') ||
        suretyAadhaar !== (selectedLoan.surety_aadhaar || '') ||
        suretyAadhaarAddress !== (selectedLoan.surety_aadhaar_address || '') ||
        suretyPresentAddress !== (selectedLoan.surety_present_address || '') ||
        suretyPhoto !== (selectedLoan.surety_photo_url || null) ||
        suretyFingerprintUrl !== (selectedLoan.surety_fingerprint_image_url || null) ||
        suretyFingerprintTemplate !== (selectedLoan.surety_fingerprint_template || null) ||
        suretyFingerprintAdded !== !!selectedLoan.surety_fingerprint_added;

      const customerChanged = 
        custName !== (selectedLoan.customer?.name || '') ||
        custPhone !== (selectedLoan.customer?.phone || '') ||
        custPhone2 !== (selectedLoan.customer?.phone_2 || selectedLoan.customer?.phone2 || '') ||
        custAddress !== (selectedLoan.customer?.address || '') ||
        custAadhaar !== (selectedLoan.customer?.aadhaar || '') ||
        custFatherHusbandName !== (selectedLoan.customer?.father_husband_name || selectedLoan.customer?.father_name || '') ||
        custVillage !== (selectedLoan.customer?.village || '') ||
        custMandal !== (selectedLoan.customer?.mandal || '') ||
        custDistrict !== (selectedLoan.customer?.district || '') ||
        custAadhaarAddress !== (selectedLoan.customer?.aadhaar_address || '') ||
        custPresentAddress !== (selectedLoan.customer?.present_address || '') ||
        custPhoto !== (selectedLoan.customer?.customer_photo_url || null) ||
        custFingerprintUrl !== (selectedLoan.customer?.customer_fingerprint_image_url || selectedLoan.customer?.fingerprint_url || null) ||
        custFingerprintTemplate !== (selectedLoan.customer?.customer_fingerprint_template || selectedLoan.customer?.fingerprint_template || null) ||
        custFingerprintAdded !== !!(selectedLoan.customer?.customer_fingerprint_added || selectedLoan.customer?.fingerprint_added);

      const loanFieldsChanged = 
        date !== selectedLoan.date ||
        Number(amount) !== Number(selectedLoan.amount) ||
        Number(interestRate) !== Number(selectedLoan.interest_rate) ||
        Number(durationMonths) !== Number(selectedLoan.duration_months) ||
        dueType !== selectedLoan.due_type ||
        Number(dueAmount) !== Number(selectedLoan.due_amount) ||
        status !== selectedLoan.status ||
        Number(docCharges) !== Number(selectedLoan.document_charges) ||
        Number(penaltyPercent) !== Number(selectedLoan.penalty_percent) ||
        Number(periodDays) !== Number(selectedLoan.period_days) ||
        remarksChanged ||
        suretyChanged;

      // Abort if no changes
      if (!customerChanged && !loanFieldsChanged) {
        toast.error('No changes detected.', { id: savingToastId });
        setSaving(false);
        return;
      }

      // 1. Update customer record
      if (selectedLoan.customer?.id && customerChanged) {
        await supabaseFinance.updateCustomer(selectedLoan.customer.id, {
          name: custName.toUpperCase(),
          phone: custPhone || null,
          phone_1: custPhone || null,
          phone_2: custPhone2 || null,
          phone2: custPhone2 || null,
          address: (custPresentAddress || custAddress || null)?.toUpperCase(),
          aadhaar: custAadhaar || null,
          customer_photo_url: custPhoto,
          fingerprint_url: custFingerprintUrl,
          fingerprint_template: custFingerprintTemplate,
          fingerprint_added: custFingerprintAdded,
          customer_fingerprint_template: custFingerprintTemplate,
          customer_fingerprint_image_url: custFingerprintUrl,
          customer_fingerprint_added: custFingerprintAdded,
          father_husband_name: (custFatherHusbandName || null)?.toUpperCase(),
          father_name: (custFatherHusbandName || null)?.toUpperCase(),
          village: (custVillage || null)?.toUpperCase(),
          mandal: (custMandal || null)?.toUpperCase(),
          district: (custDistrict || null)?.toUpperCase(),
          aadhaar_address: (custAadhaarAddress || null)?.toUpperCase(),
          present_address: (custPresentAddress || null)?.toUpperCase()
        }, staffName, true); // skip generic logging
      }

      // 2. Update loan record
      if (loanFieldsChanged) {
        await supabaseFinance.updateLoan(selectedLoan.id, {
          date,
          amount: Number(amount),
          interest_rate: Number(interestRate),
          duration_months: Number(durationMonths),
          due_type: dueType,
          due_amount: Number(dueAmount),
          status,
          remarks: serializeNewRemarks.toUpperCase(),
          surety_name: (suretyName || null)?.toUpperCase(),
          surety_phone: suretyPhone || null,
          surety_aadhaar: suretyAadhaar || null,
          surety_aadhaar_address: (suretyAadhaarAddress || null)?.toUpperCase(),
          surety_present_address: (suretyPresentAddress || null)?.toUpperCase(),
          customer_photo_url: custPhoto,
          surety_photo_url: suretyPhoto,
          fingerprint_url: custFingerprintUrl,
          fingerprint_template: custFingerprintTemplate,
          fingerprint_added: custFingerprintAdded,
          customer_fingerprint_template: custFingerprintTemplate,
          customer_fingerprint_image_url: custFingerprintUrl,
          customer_fingerprint_added: custFingerprintAdded,
          surety_fingerprint_template: suretyFingerprintTemplate,
          surety_fingerprint_image_url: suretyFingerprintUrl,
          surety_fingerprint_added: suretyFingerprintAdded,
          father_husband_name: (custFatherHusbandName || null)?.toUpperCase(),
          loan_category: loanCategory,
          penalty_percent: Number(penaltyPercent),
          document_charges: Number(docCharges),
          period_days: loanCategory === 'CD' ? (Number(periodDays) || 30) : null
        }, staffName, true); // skip generic logging
      }

      // 3. Reload from database
      const reloaded = await supabaseFinance.getLoanById(selectedLoan.id);
      if (!reloaded) {
        throw new Error('Failed to reload loan from database for verification');
      }

      // 4. Compare saved values
      const mismatches: string[] = [];
      if (Number(reloaded.amount) !== Number(amount)) mismatches.push('Amount');
      if (Number(reloaded.interest_rate) !== Number(interestRate)) mismatches.push('Interest Rate');
      if (Number(reloaded.penalty_percent) !== Number(penaltyPercent)) mismatches.push('Penalty Rate');
      if (reloaded.date !== date) mismatches.push('Loan Date');
      if (Number(reloaded.document_charges) !== Number(docCharges)) mismatches.push('Document Charges');
      if (reloaded.status !== status) mismatches.push('Status');
      
      if (loanCategory === 'CD') {
        const dbPeriodDays = reloaded.period_days ? Number(reloaded.period_days) : 30;
        if (dbPeriodDays !== Number(periodDays)) mismatches.push('Period Days');
      }

      if (reloaded.customer) {
        if (reloaded.customer.name !== custName) mismatches.push('Borrower Name');
        if ((reloaded.customer.phone || '') !== (custPhone || '')) mismatches.push('Borrower Phone');
        if ((reloaded.customer.address || '') !== (custAddress || '')) mismatches.push('Borrower Address');
        if ((reloaded.customer.aadhaar || '') !== (custAadhaar || '')) mismatches.push('Borrower Aadhaar');
      }

      // Verify sync in DB (Correction 6)
      const [{ data: verTxs }, { data: verEntries }, { data: verDues }] = await Promise.all([
        supabase.from('finance_transactions').select('*').eq('loan_id', selectedLoan.id).eq('type', 'Disbursement'),
        supabase.from('finance_cd_ledger_entries').select('*').eq('loan_id', selectedLoan.id),
        supabase.from('finance_dues').select('*').eq('loan_id', selectedLoan.id)
      ]);

      if (verTxs && verTxs.length > 0) {
        if (Number(verTxs[0].amount) !== Number(amount)) {
          mismatches.push('Transaction Sync (Disbursement Amount)');
        }
      }
      if (loanCategory === 'CD' && verEntries) {
        const origEntry = verEntries.find((e: any) => e.entry_type === 'original_loan');
        if (origEntry && Number(origEntry.debit) !== Number(amount)) {
          mismatches.push('CD Ledger Sync (Original Loan Debit)');
        }

        const commRate = Number(interestRate);
        const pDays = Number(periodDays) || 30;
        const expectedComm = Number(((Number(amount) * (commRate / 100) * pDays) / 30).toFixed(2));
        const expectedDoc = Number(docCharges);

        const commEntry = verEntries.find((e: any) => e.entry_type === 'opening_commission');
        const docEntry = verEntries.find((e: any) => e.entry_type === 'document_charge');

        if (expectedComm > 0 && (!commEntry || Number(commEntry.credit) !== expectedComm)) {
          mismatches.push('CD Ledger Sync (Opening Commission)');
        }
        if (expectedDoc > 0 && (!docEntry || Number(docEntry.credit) !== expectedDoc)) {
          mismatches.push('CD Ledger Sync (Document Charges)');
        }
      }
      if (loanCategory !== 'CD' && verDues && verDues.length > 0) {
        const expectedDue = Number(dueAmount);
        const incorrectDues = verDues.filter(d => Number(d.amount) !== expectedDue);
        if (incorrectDues.length > 0) {
          mismatches.push(`Dues Sync (${incorrectDues.length} dues have incorrect amount)`);
        }
      }
      const { data: verNpa } = await supabase.from('finance_npa_records').select('*').eq('loan_id', selectedLoan.id).maybeSingle();
      if (verNpa) {
        if (Number(verNpa.loan_amount) !== Number(amount)) {
          mismatches.push('NPA Record Sync (Loan Amount)');
        }
        const expectedLiability = Number(amount) + Number(verNpa.interest_due || 0) + Number(verNpa.penalty_due || 0);
        const actualLiability = Number(verNpa.total_liability) > 0 
          ? Number(verNpa.total_liability) 
          : (Number(verNpa.balance_amount || 0) + Number(verNpa.interest_due || 0) + Number(verNpa.penalty_due || 0));
        if (actualLiability !== expectedLiability) {
          mismatches.push('NPA Record Sync (Total Liability)');
        }
      }

      if (mismatches.length > 0) {
        throw new Error(`Database Verification Mismatch: ${mismatches.join(', ')}`);
      }

      // 5. Save audit logs individually
      const auditLogs: any[] = [];
      const addAudit = (fieldName: string, oldVal: any, newVal: any) => {
        auditLogs.push({
          table_name: 'finance_loans',
          record_id: selectedLoan.id,
          old_values: {
            loan_id: selectedLoan.id,
            loan_number: selectedLoan.loan_id,
            customer_name: selectedLoan.customer?.name || '',
            field_name: fieldName,
            value: oldVal
          },
          new_values: {
            loan_id: selectedLoan.id,
            loan_number: selectedLoan.loan_id,
            customer_name: selectedLoan.customer?.name || '',
            field_name: fieldName,
            value: newVal,
            source: 'Edit Loan'
          },
          edited_by: staffName,
          edited_at: new Date().toISOString()
        });
      };

      // Financial fields comparison
      if (Number(selectedLoan.amount) !== Number(amount)) {
        addAudit('Loan Amount', Number(selectedLoan.amount), Number(amount));
      }
      if (Number(selectedLoan.interest_rate) !== Number(interestRate)) {
        addAudit('Interest Rate', Number(selectedLoan.interest_rate), Number(interestRate));
      }
      if (Number(selectedLoan.penalty_percent) !== Number(penaltyPercent)) {
        addAudit('Penalty Rate', Number(selectedLoan.penalty_percent), Number(penaltyPercent));
      }
      if (loanCategory === 'CD' && Number(selectedLoan.period_days || 30) !== Number(periodDays)) {
        addAudit('Period Days', Number(selectedLoan.period_days || 30), Number(periodDays));
      }
      if (selectedLoan.date !== date) {
        addAudit('Loan Date', selectedLoan.date, date);
      }
      if (Number(selectedLoan.document_charges || 0) !== Number(docCharges)) {
        addAudit('Document Charges', Number(selectedLoan.document_charges || 0), Number(docCharges));
      }
      if (selectedLoan.status !== status) {
        addAudit('Status', selectedLoan.status, status);
      }

      // Collateral comparisons
      if (itemDetails !== dbParsedRemarks.itemDetails) {
        addAudit('Item Details', dbParsedRemarks.itemDetails, itemDetails);
      }
      if (goldDetails !== dbParsedRemarks.goldDetails) {
        addAudit('Gold Details', dbParsedRemarks.goldDetails, goldDetails);
      }
      if (vehicleDetails !== dbParsedRemarks.vehicleDetails) {
        addAudit('Vehicle Details', dbParsedRemarks.vehicleDetails, vehicleDetails);
      }
      if (notes !== dbParsedRemarks.notes) {
        addAudit('Notes', dbParsedRemarks.notes, notes);
      }

      // Customer fields comparisons
      if ((selectedLoan.customer?.name || '') !== custName) {
        addAudit('Borrower Name', selectedLoan.customer?.name || '', custName);
      }
      if ((selectedLoan.customer?.phone || '') !== (custPhone || '')) {
        addAudit('Borrower Phone', selectedLoan.customer?.phone || '', custPhone);
      }
      if ((selectedLoan.customer?.address || '') !== (custAddress || '')) {
        addAudit('Borrower Address', selectedLoan.customer?.address || '', custAddress);
      }
      if ((selectedLoan.customer?.aadhaar || '') !== (custAadhaar || '')) {
        addAudit('Borrower Aadhaar', selectedLoan.customer?.aadhaar || '', custAadhaar);
      }
      if ((selectedLoan.customer?.father_husband_name || '') !== (custFatherHusbandName || '')) {
        addAudit('Father / Husband Name', selectedLoan.customer?.father_husband_name || '', custFatherHusbandName);
      }

      // Surety comparisons
      if ((selectedLoan.surety_name || '') !== suretyName) {
        addAudit('Surety Name', selectedLoan.surety_name || '', suretyName);
      }
      if ((selectedLoan.surety_phone || '') !== suretyPhone) {
        addAudit('Surety Phone', selectedLoan.surety_phone || '', suretyPhone);
      }
      if ((selectedLoan.surety_aadhaar || '') !== suretyAadhaar) {
        addAudit('Surety Aadhaar', selectedLoan.surety_aadhaar || '', suretyAadhaar);
      }

      // Bulk write audit entries
      if (auditLogs.length > 0) {
        const { error: auditError } = await supabase
          .from('finance_edited_logs')
          .insert(auditLogs);
        if (auditError) throw auditError;
      }

      // Save documents checklist to DB
      await handleEditDocSave(selectedLoan.id);

      toast.success(`Loan details for Account ${selectedLoan.loan_id} updated and individual logs recorded!`, { id: savingToastId });
      setSelectedLoan(null);
      fetchLoans();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Something went wrong. Please check edits.', { id: savingToastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loanId: string) => {
    if (!window.confirm('WARNING: Deleting this loan will wipe all collection logs, dues schedules, and photos. This cannot be undone. Are you absolutely sure?')) return;
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteLoan(loanId, staffName);
      if (success) {
        toast.success('Loan completely deleted from ledger.');
        setSelectedLoan(null);
        fetchLoans();
      } else {
        toast.error('Failed to delete loan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete loan');
    }
  };

  // Upload checklist document to storage (matches New Loan Entry 1:1)
  const handleChecklistUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: true } : doc));

    try {
      const fileObj = new File([file], `doc-${selectedLoan?.loan_id || 'edit'}-${key}-${Date.now()}-${file.name}`, { type: file.type });

      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, checked: true, fileUrl: publicUrl, uploading: false } : doc));
      toast.success('DOCUMENT UPLOADED AND ATTACHED SUCCESSFULLY!');
    } catch (err) {
      console.error(err);
      toast.error('DOCUMENT UPLOAD FAILED');
      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: false } : doc));
    }
  };

  const removeChecklistUpload = (key: string) => {
    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, fileUrl: null } : doc));
    toast.success('ATTACHMENT DETACHED');
  };

  // Save all documents to the DB when the main form is saved
  const handleEditDocSave = async (loanId: string) => {
    const linkedDocs = documents.filter(doc => doc.checked || doc.fileUrl).map(doc => ({
      loan_id: loanId,
      document_name: doc.label,
      category: doc.category,
      ref_no: doc.refNo || '',
      file_url: doc.fileUrl || '',
      is_submitted: doc.checked,
    }));

    // Delete existing docs and re-insert
    await supabase.from('finance_loan_documents').delete().eq('loan_id', loanId);
    if (linkedDocs.length > 0) {
      await supabase.from('finance_loan_documents').insert(linkedDocs);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h1 className="finance-h1">EDIT LOAN LEDGER</h1>
          <p className="mt-1 finance-small-label uppercase">Modify active loan parameters, surety files, and record status updates</p>
        </div>
      </div>

      {selectedLoan ? (
        <>
          {/* Editing View Form */}
          <Card
            title={`Edit Loan Account: ${selectedLoan.loan_id}`}
            subtitle={`Editing profile for ${selectedLoan.customer?.name}`}
            className="border-green-200"
          >
          {hasLedgerActivity && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg flex gap-3 items-start shadow-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-amber-800 font-semibold text-sm uppercase">Financial Restrictions Active</h4>
                <p className="text-amber-700 text-xs mt-1">
                  This loan already contains financial transactions. Core financial fields are locked to preserve ledger accuracy.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Column 1: Customer Profile */}
              <div className="space-y-3">
                <h4 className="text-gray-800 border-b pb-1 finance-section-heading">Customer Profile</h4>
                <Input label="Customer Name" value={custName} onChange={setCustName} required />
                <Input label="Father / Husband Name" value={custFatherHusbandName} onChange={setCustFatherHusbandName} />
                <Input label="Phone Number" value={custPhone} onChange={setCustPhone} />
                <Input label="Secondary Phone" value={custPhone2} onChange={setCustPhone2} />
                <Input label="Address" value={custAddress} onChange={setCustAddress} />
                <Input label="Aadhaar UID" value={custAadhaar} onChange={setCustAadhaar} />
                
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Village" value={custVillage} onChange={setCustVillage} />
                  <Input label="Mandal" value={custMandal} onChange={setCustMandal} />
                  <Input label="District" value={custDistrict} onChange={setCustDistrict} />
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <CameraCapture
                    label="Customer Photo Capture"
                    existingPhotoUrl={custPhoto}
                    onPhotoSaved={setCustPhoto}
                  />
                  <BiometricScanner
                    label="Customer Fingerprint Capture"
                    existingImageUrl={custFingerprintUrl}
                    existingTemplate={custFingerprintTemplate}
                    onFingerprintSaved={(url, template, added) => {
                      setCustFingerprintUrl(url);
                      setCustFingerprintTemplate(template);
                      setCustFingerprintAdded(added);
                    }}
                  />
                </div>
              </div>

              {/* Column 2: Loan Parameters */}
              <div className="space-y-3">
                <h4 className="text-gray-800 border-b pb-1 finance-section-heading">Loan Parameters</h4>
                
                <Input 
                  label="Disbursed Date" 
                  type="date" 
                  value={date} 
                  onChange={setDate} 
                  required 
                  readOnly={hasLedgerActivity}
                  className={hasLedgerActivity ? 'bg-gray-150' : ''}
                />
                
                <div>
                  <label className="finance-caption uppercase">
                    Loan Category
                  </label>
                  <select
                    value={loanCategory}
                    onChange={(e) => setLoanCategory(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-green-500 finance-header-time"
                    style={{ fontFamily: 'Times New Roman', fontSize: '15px', fontWeight: 'bold' }}
                  >
                    <option value="L">Regular Loan (L)</option>
                    <option value="CD">Chit Fund (CD)</option>
                    <option value="STBD">Short Term Business Deposit (STBD)</option>
                    <option value="HP">Hire Purchase (HP)</option>
                    <option value="TBD">Term Business Deposit (TBD)</option>
                  </select>
                </div>

                <Input 
                  label="Principal Amount (₹)" 
                  type="number" 
                  value={amount} 
                  onChange={setAmount} 
                  required 
                  readOnly={hasLedgerActivity}
                  className={hasLedgerActivity ? 'bg-gray-150' : ''}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    label="Rate (% pm)" 
                    type="number" 
                    value={interestRate} 
                    onChange={setInterestRate} 
                    required 
                    readOnly={hasLedgerActivity}
                    className={hasLedgerActivity ? 'bg-gray-150' : ''}
                  />
                  
                  <Input 
                    label="Penalty Rate (% pm)" 
                    type="number" 
                    value={penaltyPercent} 
                    onChange={setPenaltyPercent} 
                    required 
                    readOnly={hasLedgerActivity}
                    className={hasLedgerActivity ? 'bg-gray-150' : ''}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    label={loanCategory === 'CD' ? 'Period (Days)' : 'Duration (Months)'} 
                    type="number" 
                    value={loanCategory === 'CD' ? periodDays : durationMonths} 
                    onChange={(val) => {
                      if (loanCategory === 'CD') {
                        setPeriodDays(val);
                        setDurationMonths(val);
                      } else {
                        setDurationMonths(val);
                      }
                    }} 
                    required 
                    readOnly={hasLedgerActivity}
                    className={hasLedgerActivity ? 'bg-gray-150' : ''}
                  />
                  
                  <Input 
                    label="Document Charges (₹)" 
                    type="number" 
                    value={docCharges} 
                    onChange={setDocCharges} 
                    required 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    label="Due Date Preview" 
                    type="date" 
                    value={liveCalculations.dueDatePreview} 
                    onChange={handleDueDateChange} 
                    readOnly={hasLedgerActivity}
                    className={hasLedgerActivity ? 'bg-gray-150 font-semibold text-gray-500' : 'font-semibold text-green-600'}
                  />

                  <div>
                    <label className="finance-caption uppercase">
                      Instalment Type
                    </label>
                    <select
                      value={dueType}
                      onChange={(e) => setDueType(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-green-500 finance-header-time"
                      style={{ fontFamily: 'Times New Roman', fontSize: '15px', fontWeight: 'bold' }}
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <Input label="Due Amount (₹)" type="number" value={dueAmount} onChange={setDueAmount} required />

                {/* Live Calculations Preview */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-4 space-y-2.5">
                  <div className="flex justify-between border-b border-dashed border-gray-200 pb-1.5 items-center">
                    <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Interest Preview:</span>
                    <span className="text-slate-950 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.interestPreview)}</span>
                  </div>
                  <div className="flex justify-between border-b border-dashed border-gray-200 pb-1.5 items-center">
                    <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Renewal Due:</span>
                    <span className="text-slate-950 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.renewalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-900 text-[14px] uppercase font-black tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Payable Amount:</span>
                    <span className="text-emerald-800 text-[22px] font-black" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.payableAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Column 3: Collaterals, Surety & Account Status */}
              <div className="space-y-3">
                <h4 className="text-gray-800 border-b pb-1 finance-section-heading">Collaterals & Guarantors</h4>
                
                <div>
                  <label className="finance-caption uppercase">Item Details</label>
                  <textarea 
                    value={itemDetails} 
                    onChange={(e) => setItemDetails(e.target.value)}
                    placeholder="General item specifications"
                    rows={1}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="finance-caption uppercase">Gold Details</label>
                  <textarea 
                    value={goldDetails} 
                    onChange={(e) => setGoldDetails(e.target.value)}
                    placeholder="Carats, weight in grams, etc."
                    rows={1}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="finance-caption uppercase">Vehicle Details</label>
                  <textarea 
                    value={vehicleDetails} 
                    onChange={(e) => setVehicleDetails(e.target.value)}
                    placeholder="Engine no, chassis no, tax and registration details"
                    rows={1}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="finance-caption uppercase">Notes / Remarks</label>
                  <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special instructions or notes"
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Surety */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <Input label="Guarantor Name" value={suretyName} onChange={setSuretyName} />
                  <Input label="Guarantor Phone" value={suretyPhone} onChange={setSuretyPhone} />
                  <Input label="Guarantor Aadhaar" value={suretyAadhaar} onChange={setSuretyAadhaar} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="finance-caption uppercase">Account Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-green-500 finance-header-time"
                      style={{ fontFamily: 'Times New Roman', fontSize: '15px', fontWeight: 'bold' }}
                    >
                      <option value="Active">Active Account</option>
                      <option value="Closed">Closed Account</option>
                      <option value="NPA_CLOSED">NPA Closed Account</option>
                    </select>
                  </div>
                  <Input label="Partner Name" value={partnerName} readOnly className="bg-gray-100 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="submit" variant="success" icon={Save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={() => handleDelete(selectedLoan.id)}
                variant="danger"
                icon={Trash2}
                disabled={saving}
              >
                Delete Loan Account
              </Button>
              <Button
                onClick={() => setSelectedLoan(null)}
                variant="secondary"
                icon={X}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        {/* DOCUMENTS SECTION - Edit Loan Style */}
        <Card
          title="LOAN DOCUMENTS"
          subtitle={`REVIEW, UPDATE AND MANAGE DOCUMENTS FOR ${selectedLoan.loan_id}`}
          className="mt-6 border-blue-200"
        >
          {/* Completion Summary */}
          {(() => {
            const total = documents.length;
            const submitted = documents.filter(d => d.checked || d.fileUrl).length;
            const withFile = documents.filter(d => d.fileUrl).length;
            const checkedNoFile = documents.filter(d => d.checked && !d.fileUrl).length;
            const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
            return (
              <div className={`p-4 rounded-lg mb-5 border-l-4 flex items-center justify-between ${pct === 100 ? 'bg-green-50 border-green-500' : pct > 0 ? 'bg-blue-50 border-blue-500' : 'bg-slate-50 border-slate-300'}`}>
                <div className="flex items-center gap-3">
                  {pct === 100 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-600" />
                  )}
                  <div>
                    <p className={`text-sm font-bold uppercase ${pct === 100 ? 'text-green-800' : 'text-slate-800'}`}>
                      {submitted} OF {total} DOCUMENTS SUBMITTED ({pct}%)
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 uppercase">
                      {withFile > 0 && `${withFile} WITH DIGITAL FILE`}
                      {withFile > 0 && checkedNoFile > 0 && ' · '}
                      {checkedNoFile > 0 && `${checkedNoFile} PHYSICAL ONLY`}
                      {(withFile > 0 || checkedNoFile > 0) && (total - submitted) > 0 && ' · '}
                      {(total - submitted) > 0 && `${total - submitted} PENDING`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full uppercase">
                    FIN {documents.filter(d => d.category === 'Financial' && (d.checked || d.fileUrl)).length}/{documents.filter(d => d.category === 'Financial').length}
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full uppercase">
                    ORIG {documents.filter(d => d.category === 'Original' && (d.checked || d.fileUrl)).length}/{documents.filter(d => d.category === 'Original').length}
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full uppercase">
                    REG {documents.filter(d => d.category === 'Registration' && (d.checked || d.fileUrl)).length}/{documents.filter(d => d.category === 'Registration').length}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Document Tables by Category */}
          {(['Financial', 'Original', 'Registration'] as const).map((cat, catIdx) => {
            const catDocs = documents.filter(d => d.category === cat);
            const catSubmitted = catDocs.filter(d => d.checked || d.fileUrl).length;

            let catLabel = '';
            if (cat === 'Financial') catLabel = 'FINANCIAL DOCUMENTS';
            if (cat === 'Original') catLabel = 'ORIGINAL DOCUMENTS (LAND, ASSETS)';
            if (cat === 'Registration') catLabel = 'REGISTRATION DOCUMENTS (BONDS, STAMPS)';

            return (
              <div key={catIdx} className="mb-6 last:mb-0">
                {/* Category Header */}
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-gray-800 border-b pb-1 finance-section-heading flex items-center gap-2">
                    {catIdx + 1}. {catLabel}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 ${
                      catSubmitted === catDocs.length && catDocs.length > 0
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : catSubmitted > 0
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {catSubmitted}/{catDocs.length}
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newDoc: DocumentItem = {
                        key: `custom_${Date.now()}_${Math.random()}`,
                        label: '',
                        category: cat,
                        checked: true,
                        refNo: '',
                        fileUrl: null,
                        uploading: false,
                        isCustom: true
                      };
                      setDocuments(prev => [...prev, newDoc]);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md transition-colors text-xs font-bold uppercase"
                  >
                    + ADD DOCUMENT
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-900 uppercase tracking-wider w-10"></th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-900 uppercase tracking-wider w-[100px]">STATUS</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-900 uppercase tracking-wider">DOCUMENT NAME</th>
                        <th className="px-3 py-2.5 text-left font-bold text-slate-900 uppercase tracking-wider">REF NO. / REMARKS</th>
                        <th className="px-3 py-2.5 text-right font-bold text-slate-900 uppercase tracking-wider w-[260px]">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {catDocs.map((doc) => {
                        const hasFile = !!doc.fileUrl;
                        const isChecked = doc.checked;
                        const rowClass = hasFile
                          ? 'bg-green-50/50'
                          : isChecked
                            ? 'bg-amber-50/40'
                            : '';

                        return (
                          <tr key={doc.key} className={`hover:bg-gray-50 transition-colors ${rowClass}`}>
                            {/* Checkbox */}
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={doc.checked}
                                onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, checked: e.target.checked } : d))}
                                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-600"
                              />
                            </td>

                            {/* Status Badge */}
                            <td className="px-3 py-3">
                              {hasFile ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 uppercase border border-green-200">
                                  <CheckCircle className="w-3 h-3" /> UPLOADED
                                </span>
                              ) : isChecked ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase border border-amber-200">
                                  <AlertCircle className="w-3 h-3" /> NO FILE
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase border border-slate-200">
                                  PENDING
                                </span>
                              )}
                            </td>

                            {/* Document Name */}
                            <td className="px-3 py-3">
                              {doc.isCustom ? (
                                <input
                                  type="text"
                                  value={doc.label}
                                  onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, label: e.target.value } : d))}
                                  placeholder="ENTER DOCUMENT NAME"
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-800 font-bold focus:outline-none focus:border-blue-300 uppercase"
                                />
                              ) : (
                                <span className="font-bold text-slate-900 uppercase text-sm">{doc.label}</span>
                              )}
                            </td>

                            {/* Ref No */}
                            <td className="px-3 py-3">
                              <input
                                type="text"
                                value={doc.refNo}
                                onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, refNo: e.target.value } : d))}
                                placeholder="REF NO., AUTHORITY..."
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-600 uppercase focus:outline-none focus:border-blue-300 placeholder:text-slate-300"
                              />
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {hasFile && (
                                  <a
                                    href={doc.fileUrl!}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded hover:bg-green-100 text-[10px] font-bold uppercase transition-all"
                                  >
                                    <Eye className="w-3 h-3" /> VIEW
                                  </a>
                                )}

                                <label className="cursor-pointer inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded hover:bg-blue-100 text-[10px] font-bold uppercase transition-all">
                                  <Upload className="w-3 h-3" />
                                  {doc.uploading ? 'UPLOADING...' : hasFile ? 'REPLACE' : 'UPLOAD'}
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleChecklistUpload(doc.key, e)}
                                    className="hidden"
                                    disabled={doc.uploading}
                                  />
                                </label>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (doc.isCustom) {
                                      setDocuments(prev => prev.filter(d => d.key !== doc.key));
                                    } else {
                                      if (doc.fileUrl) {
                                        removeChecklistUpload(doc.key);
                                      }
                                      setDocuments(prev => prev.map(d =>
                                        d.key === doc.key ? { ...d, checked: false, refNo: '', fileUrl: null } : d
                                      ));
                                    }
                                  }}
                                  className="bg-red-50 border border-red-200 text-red-700 px-2 py-1.5 rounded hover:bg-red-100 text-[10px] font-bold uppercase transition-all"
                                  title={doc.isCustom ? 'Remove Document' : 'Reset Document'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </Card>
        </>
      ) : (
        // Searching & Listing View
        <div className="space-y-4">
          <div className="max-w-md">
            <Input
              label="Quick Search Loan Records"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by ID, Name, Phone, Aadhaar..."
            />
          </div>

          <Card title="Loans Ledger Index" subtitle="Click on Edit to modify customer records, status or transaction details">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No matching loans found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="finance-small-label uppercase">Loan ID</th>
                      <th className="finance-small-label uppercase">Customer</th>
                      <th className="finance-small-label uppercase">Aadhaar</th>
                      <th className="text-right finance-small-label uppercase">Principal</th>
                      <th className="finance-small-label uppercase">Instalment</th>
                      <th className="text-center finance-small-label uppercase">Status</th>
                      <th className="text-right finance-small-label uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredLoans.map(loan => (
                      <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-gray-900 font-mono finance-input">
                          {loan.loan_id}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-gray-900 finance-input">{loan.customer?.name}</div>
                          {loan.customer?.phone && (
                            <div className="text-gray-500 finance-caption">{loan.customer.phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600 font-mono">
                          {loan.customer?.aadhaar || '-'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-gray-900 finance-input">
                          ₹{Number(loan.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                          {loan.due_type} (₹{Number(loan.due_amount).toLocaleString('en-IN')})
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${ loan.status === 'Active' ? 'bg-green-100 text-green-800' : loan.status === 'NPA_CLOSED' ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right">
                          <Button
                            onClick={() => handleSelectLoan(loan)}
                            variant="primary"
                            size="sm"
                            icon={Edit}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default EditLoanEntry;
