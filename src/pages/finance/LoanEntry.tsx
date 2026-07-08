import { getLocalBusinessDateISO } from '../../utils/dateUtils';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../../components/UI/Input';
import { supabaseFinance, FinanceCustomer, FinancePartner } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  User, 
  Calculator, 
  Printer, 
  X, 
  Upload, 
  Trash2, 
  Navigation,
  Check,
  Search,
  Camera,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { useAuth } from '../../contexts/AuthContext';
import { BiometricScanner } from '../../components/finance/BiometricScanner';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface DocumentItem {
  key: string;
  label: string;
  category: 'Financial' | 'Original' | 'Registration';
  checked: boolean;
  refNo: string;
  fileUrl: string | null;
  uploading: boolean;
  isCustom?: boolean;
}

const LoanEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Loading/Saving states

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const dateRef = useRef<HTMLInputElement>(null);
  const loanIdRef = useRef<HTMLInputElement>(null);
  const custNameRef = useRef<HTMLInputElement>(null);
  const custPhoneRef = useRef<HTMLInputElement>(null);
  const g1NameRef = useRef<HTMLInputElement>(null);
  const g1PhoneRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const interestRateRef = useRef<HTMLInputElement>(null);
  const durationMonthsRef = useRef<HTMLInputElement>(null);
  const particularsRef = useRef<HTMLTextAreaElement>(null);
  const locAddressRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Form State - Basics
  const [date, setDate] = useState(() => getLocalBusinessDateISO());
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('CD');
  const [loanId, setLoanId] = useState('');

  // Form State - Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custFatherName, setCustFatherName] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPhone2, setCustPhone2] = useState('');
  const [custVillage, setCustVillage] = useState('');
  const [custMandal, setCustMandal] = useState('');
  const [custDistrict, setCustDistrict] = useState('');
  const [custAadhaarAddress, setCustAadhaarAddress] = useState('');
  const [custPresentAddress, setCustPresentAddress] = useState('');
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const [npaWarning, setNpaWarning] = useState<any>(null);

  // Form State - Guarantor 1
  const [g1SelectedId, setG1SelectedId] = useState('');
  const [g1Name, setG1Name] = useState('');
  const [g1Phone, setG1Phone] = useState('');
  const [g1Aadhaar, setG1Aadhaar] = useState('');
  const [g1AadhaarAddress, setG1AadhaarAddress] = useState('');
  const [g1PresentAddress, setG1PresentAddress] = useState('');
  const [g1Photo, setG1Photo] = useState<string | null>(null);
  const [g1FingerprintUrl, setG1FingerprintUrl] = useState<string | null>(null);
  const [g1FingerprintTemplate, setG1FingerprintTemplate] = useState<string | null>(null);
  const [g1FingerprintAdded, setG1FingerprintAdded] = useState(false);
  const [g1Search, setG1Search] = useState('');
  const [g1DropdownOpen, setG1DropdownOpen] = useState(false);
  const [g1Village, setG1Village] = useState('');
  const [g1Mandal, setG1Mandal] = useState('');
  const [g1District, setG1District] = useState('');
  const [g1PermanentAddress, setG1PermanentAddress] = useState('');
  const [g1CurrentAddress, setG1CurrentAddress] = useState('');
  const [g1CurrentVillage, setG1CurrentVillage] = useState('');
  const [g1CurrentMandal, setG1CurrentMandal] = useState('');
  const [g1CurrentDistrict, setG1CurrentDistrict] = useState('');

  // Form State - Guarantor 2
  const [g2SelectedId, setG2SelectedId] = useState('');
  const [g2Name, setG2Name] = useState('');
  const [g2Phone, setG2Phone] = useState('');
  const [g2Aadhaar, setG2Aadhaar] = useState('');
  const [g2AadhaarAddress, setG2AadhaarAddress] = useState('');
  const [g2PresentAddress, setG2PresentAddress] = useState('');
  const [g2Photo, setG2Photo] = useState<string | null>(null);
  const [g2FingerprintUrl, setG2FingerprintUrl] = useState<string | null>(null);
  const [g2FingerprintTemplate, setG2FingerprintTemplate] = useState<string | null>(null);
  const [g2FingerprintAdded, setG2FingerprintAdded] = useState(false);
  const [g2Search, setG2Search] = useState('');
  const [g2DropdownOpen, setG2DropdownOpen] = useState(false);
  const [g2Village, setG2Village] = useState('');
  const [g2Mandal, setG2Mandal] = useState('');
  const [g2District, setG2District] = useState('');
  const [g2PermanentAddress, setG2PermanentAddress] = useState('');
  const [g2CurrentAddress, setG2CurrentAddress] = useState('');
  const [g2CurrentVillage, setG2CurrentVillage] = useState('');
  const [g2CurrentMandal, setG2CurrentMandal] = useState('');
  const [g2CurrentDistrict, setG2CurrentDistrict] = useState('');

  // Reference Data lists
  const [partners, setPartners] = useState<Partial<FinancePartner>[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);

  // Search Results State
  const [customerSearchResults, setCustomerSearchResults] = useState<Partial<FinanceCustomer>[]>([]);
  const [g1SearchResults, setG1SearchResults] = useState<Partial<FinanceCustomer>[]>([]);
  const [g2SearchResults, setG2SearchResults] = useState<Partial<FinanceCustomer>[]>([]);
  const [isSearchingCust, setIsSearchingCust] = useState(false);
  const [isSearchingG1, setIsSearchingG1] = useState(false);
  const [isSearchingG2, setIsSearchingG2] = useState(false);

  // Form State - Loan Terms
  const [amount, setAmount] = useState('');
  const [docCharges, setDocCharges] = useState('');
  const [interestRate, setInterestRate] = useState('3'); // 3% default
  const [durationMonths, setDurationMonths] = useState('');
  const [penaltyPercent, setPenaltyPercent] = useState('0.75'); // 0.75% default
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [particulars, setParticulars] = useState('');

  // Form State - Partner
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // Refs for closing dropdowns
  const dropdownRef = useRef<HTMLDivElement>(null);
  const g1DropdownRef = useRef<HTMLDivElement>(null);
  const g2DropdownRef = useRef<HTMLDivElement>(null);

  // Lookup states
  const [existingCdSearch, setExistingCdSearch] = useState('');
  const [isLookupMode, setIsLookupMode] = useState(false);
  const [cdSuggestions, setCdSuggestions] = useState<string[]>([]);
  const [showCdSuggestions, setShowCdSuggestions] = useState(false);
  const cdSearchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustDropdownOpen(false);
      }
      if (g1DropdownRef.current && !g1DropdownRef.current.contains(e.target as Node)) {
        setG1DropdownOpen(false);
      }
      if (g2DropdownRef.current && !g2DropdownRef.current.contains(e.target as Node)) {
        setG2DropdownOpen(false);
      }
      if (cdSearchDropdownRef.current && !cdSearchDropdownRef.current.contains(e.target as Node)) {
        setShowCdSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const searchCache = useRef<Record<string, any[]>>({});

  // Debounced search hooks
  useEffect(() => {
    if (!custSearch || custSearch.length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    const q = custSearch.trim();
    if (!q) return;
    const cacheKey = `cust_${q.toLowerCase()}`;
    if (searchCache.current[cacheKey]) {
      setCustomerSearchResults(searchCache.current[cacheKey]);
      return;
    }

    setIsSearchingCust(true);
    const delay = setTimeout(async () => {
      const results = await supabaseFinance.searchCustomers(q);
      searchCache.current[cacheKey] = results;
      setCustomerSearchResults(results);
      setIsSearchingCust(false);
    }, 300);
    return () => clearTimeout(delay);
  }, [custSearch]);

  useEffect(() => {
    if (!g1Search || g1Search.length < 2) {
      setG1SearchResults([]);
      return;
    }
    const q = g1Search.trim();
    if (!q) return;
    const cacheKey = `g1_${q.toLowerCase()}`;
    if (searchCache.current[cacheKey]) {
      setG1SearchResults(searchCache.current[cacheKey]);
      return;
    }

    setIsSearchingG1(true);
    const delay = setTimeout(async () => {
      const results = await supabaseFinance.searchCustomers(q);
      searchCache.current[cacheKey] = results;
      setG1SearchResults(results);
      setIsSearchingG1(false);
    }, 300);
    return () => clearTimeout(delay);
  }, [g1Search]);

  useEffect(() => {
    if (!g2Search || g2Search.length < 2) {
      setG2SearchResults([]);
      return;
    }
    const q = g2Search.trim();
    if (!q) return;
    const cacheKey = `g2_${q.toLowerCase()}`;
    if (searchCache.current[cacheKey]) {
      setG2SearchResults(searchCache.current[cacheKey]);
      return;
    }

    setIsSearchingG2(true);
    const delay = setTimeout(async () => {
      const results = await supabaseFinance.searchCustomers(q);
      searchCache.current[cacheKey] = results;
      setG2SearchResults(results);
      setIsSearchingG2(false);
    }, 300);
    return () => clearTimeout(delay);
  }, [g2Search]);

  // Form State - Documents Checklist
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

  // Form State - Collateral Location
  const [locAddress, setLocAddress] = useState('');
  const [locVillage, setLocVillage] = useState('');
  const [locMandal, setLocMandal] = useState('');
  const [locDistrict, setLocDistrict] = useState('');
  const [locState, setLocState] = useState('');
  const [locPincode, setLocPincode] = useState('');
  const [locLandmark, setLocLandmark] = useState('');
  const [locLatitude, setLocLatitude] = useState('');
  const [locLongitude, setLocLongitude] = useState('');
  const [locMapsLink, setLocMapsLink] = useState('');
  const [collateralImage, setCollateralImage] = useState<string | null>(null);

  // Form State - Remarks & Extra
  const [remarks, setRemarks] = useState('');
  const [extraDetails, setExtraDetails] = useState('');

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const prts = await supabaseFinance.getPartnerBasics();
      setPartners(prts);

      const loans = await supabaseFinance.getRecentLoans(5);
      setActiveLoans(loans);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reference data');
    } finally {
      setLoading(false);
    }
  };

  const handleExistingCdLookup = async (cdAcNo: string) => {
    if (!cdAcNo.trim()) return;
    try {
      const { data: loanData, error: loanErr } = await supabase
        .from('finance_loans')
        .select('*, customer:finance_customers!customer_id(*)')
        .eq('loan_id', cdAcNo.trim())
        .maybeSingle();

      if (loanErr) throw loanErr;

      if (!loanData) {
        toast.error('NO EXISTING ACCOUNT FOUND WITH THIS CD NUMBER');
        return;
      }

      setIsLookupMode(true);
      
      const cust = loanData.customer;
      if (cust) {
        setCustName(cust.name || '');
        setCustPhone(cust.phone_1 || cust.phone || '');
        setCustPresentAddress(cust.address || cust.present_address || '');
        setCustAadhaar(cust.aadhaar || '');
        setCustPhoto(cust.customer_photo_url || null);
        setCustFatherName(cust.father_name || cust.father_husband_name || '');
        setCustVillage(cust.village || '');
        setCustMandal(cust.mandal || '');
        setCustDistrict(cust.district || '');
        setCustAadhaarAddress(cust.aadhaar_address || '');
        setCustPresentAddress(cust.present_address || '');
      }

      setLoanId(loanData.loan_id);
      setLoanCategory(loanData.loan_category || 'CD');
      setAmount(String(loanData.amount));
      setInterestRate(String(loanData.interest_rate));
      setDurationMonths(String(loanData.duration_months));
      setDueType(loanData.due_type);
      setDocCharges(String(loanData.document_charges || 0));
      setPenaltyPercent(String(loanData.penalty_percent || 0.75));

      setG1Name(loanData.surety_name || '');
      setG1Phone(loanData.surety_phone || '');
      setG1Aadhaar(loanData.surety_aadhaar || '');
      setG1AadhaarAddress(loanData.surety_aadhaar_address || '');
      setG1PresentAddress(loanData.surety_present_address || '');
      setG1Photo(loanData.surety_photo_url || null);
      setG1FingerprintTemplate(loanData.surety_fingerprint_template || null);
      setG1FingerprintUrl(loanData.surety_fingerprint_image_url || null);
      setG1FingerprintAdded(!!loanData.surety_fingerprint_added);

      const { data: colLogs } = await supabase
        .from('finance_edited_logs')
        .select('*')
        .eq('table_name', 'finance_loans_collateral')
        .eq('record_id', loanData.id)
        .order('edited_at', { ascending: false })
        .limit(1);
      if (colLogs && colLogs.length > 0) {
        const cLog = colLogs[0].new_values;
        setCollateralImage(cLog.collateral_image || null);
        setLocAddress(cLog.collateral_address || '');
        setLocVillage(cLog.village || '');
        setLocMandal(cLog.mandal || '');
        setLocDistrict(cLog.district || '');
        setLocState(cLog.state || '');
        setLocPincode(cLog.pincode || '');
        setLocLandmark(cLog.landmark || '');
        setLocLatitude(cLog.gps_latitude || '');
        setLocLongitude(cLog.gps_longitude || '');
        setLocMapsLink(cLog.google_maps_link || '');
        setParticulars(cLog.particulars || '');
        setExtraDetails(cLog.extraDetails || '');
      }

      const { data: dbDocs } = await supabase
        .from('finance_loan_documents')
        .select('*')
        .eq('loan_id', loanData.id);

      if (dbDocs) {
        setDocuments(prev => prev.map(d => {
          const matched = dbDocs.find(x => x.document_name.toUpperCase().includes(d.label.toUpperCase()));
          if (matched) {
            return {
              ...d,
              checked: matched.is_submitted,
              refNo: matched.remarks || '',
              fileUrl: matched.file_url
            };
          }
          return d;
        }));
      }

      toast.success('EXISTING ACCOUNT LOADED IN VIEW MODE');
    } catch (err: any) {
      console.error(err);
      toast.error('FAILED TO LOOKUP EXISTING CD ACCOUNT');
    }
  };

  const handleClearLookup = () => {
    setExistingCdSearch('');
    setIsLookupMode(false);
    setCustName('');
    setCustPhone('');
    setCustPresentAddress('');
    setCustAadhaar('');
    setCustPhoto(null);
    setCustFatherName('');
    setCustVillage('');
    setCustMandal('');
    setCustDistrict('');
    setCustAadhaarAddress('');
    setCustPresentAddress('');
    setAmount('');
    setInterestRate('3');
    setDurationMonths('');
    setDueType('Daily');
    setDocCharges('');
    setPenaltyPercent('0.75');
    setG1Name('');
    setG1Phone('');
    setG1Aadhaar('');
    setG1AadhaarAddress('');
    setG1PresentAddress('');
    setG1Photo(null);
    setG1FingerprintUrl(null);
    setG1FingerprintTemplate(null);
    setG1FingerprintAdded(false);
    
    setG2Name('');
    setG2Phone('');
    setG2Aadhaar('');
    setG2AadhaarAddress('');
    setG2PresentAddress('');
    setG2Photo(null);
    setG2FingerprintUrl(null);
    setG2FingerprintTemplate(null);
    setG2FingerprintAdded(false);
    setCollateralImage(null);
    setLocAddress('');
    setLocVillage('');
    setLocMandal('');
    setLocDistrict('');
    setLocState('');
    setLocPincode('');
    setLocLandmark('');
    setLocLatitude('');
    setLocLongitude('');
    setLocMapsLink('');
    setParticulars('');
    setExtraDetails('');
    setDocuments(prev => prev.map(d => ({ ...d, checked: false, refNo: '', fileUrl: null })));
    generateSequentialId(activeLoans, loanCategory);
  };

  const handleSearchChange = async (val: string) => {
    const upperVal = val.toUpperCase();
    setExistingCdSearch(upperVal);
    if (!upperVal.trim()) {
      handleClearLookup();
      setCdSuggestions([]);
      setShowCdSuggestions(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('finance_loans')
        .select('loan_id')
        .ilike('loan_id', `${upperVal}%`)
        .limit(10);
      if (!error && data) {
        setCdSuggestions(data.map(l => l.loan_id));
        setShowCdSuggestions(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCdSuggestion = (val: string) => {
    setExistingCdSearch(val);
    setShowCdSuggestions(false);
    handleExistingCdLookup(val);
  };

  // Generate Auto sequential Loan ID
  const generateSequentialId = (loansList: any[], category: string) => {
    const prefix = category === 'L' ? 'L' : category;
    const matchingLoans = loansList.filter(l => {
      const lid = (l.loan_id || '').toUpperCase();
      return lid.startsWith(prefix);
    });
    
    let maxNum = 0;
    matchingLoans.forEach(l => {
      const lid = (l.loan_id || '').toUpperCase();
      const suffix = lid.slice(prefix.length);
      const num = parseInt(suffix, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const paddedCount = String(nextNum).padStart(3, '0');
    setLoanId(`${prefix}${paddedCount}`);
  };

  useEffect(() => {
    if (activeLoans.length > 0 || !loading) {
      generateSequentialId(activeLoans, loanCategory);
    }
  }, [loanCategory, activeLoans, loading]);

  // Autofill customer data
  useEffect(() => {
    const checkNPA = async (id: string, aadhaar: string) => {
        try {
            const { data } = await supabase.from('finance_npa_records').select('*').or(`customer_id.eq.${id},aadhaar.eq.${aadhaar}`).limit(1);
            if (data && data.length > 0) {
                setNpaWarning(data[0]);
                toast.error(`WARNING: This customer has an NPA record closed on ${new Date(data[0].closed_at).toLocaleDateString('en-IN')}`, { duration: 6000 });
            } else {
                setNpaWarning(null);
            }
        } catch (e) {
            setNpaWarning(null);
        }
    };

    const fetchCustomer = async () => {
      if (!selectedCustomerId) return;
      const selected = await supabaseFinance.getCustomerById(selectedCustomerId);
      if (selected) {
        setCustName(selected.name);
        setCustFatherName(selected.father_name || selected.father_husband_name || '');
        setCustPhone(selected.phone_1 || selected.phone || '');
        setCustPhone2(selected.phone_2 || selected.phone2 || '');
        setCustAadhaar(selected.aadhaar || '');
        setCustPhoto(selected.customer_photo_url || null);
        setCustFingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setCustFingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setCustFingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        
        setCustVillage(selected.village || '');
        setCustMandal(selected.mandal || '');
        setCustDistrict(selected.district || '');
        setCustAadhaarAddress(selected.aadhaar_address || '');
        setCustPresentAddress(selected.present_address || selected.address || '');
        
        checkNPA(selected.id, selected.aadhaar || '');

        if (selected.partner_name) {
          const matchPartner = partners.find(p => p.name === selected.partner_name);
          if (matchPartner) {
            setSelectedPartnerId(matchPartner.id as string);
            setPartnerName(matchPartner.name as string);
          } else {
            setPartnerName(selected.partner_name);
          }
        }
      }
    };

    fetchCustomer();
  }, [selectedCustomerId, partners]);

  // Autofill guarantor 1 data
  useEffect(() => {
    const fetchG1 = async () => {
      if (!g1SelectedId) return;
      const selected = await supabaseFinance.getCustomerById(g1SelectedId);
      if (selected) {
        setG1Name(selected.name);
        setG1Phone(selected.phone_1 || selected.phone || '');
        setG1Aadhaar(selected.aadhaar || '');
        setG1AadhaarAddress(selected.aadhaar_address || '');
        setG1PresentAddress(selected.present_address || selected.address || '');
        setG1Photo(selected.customer_photo_url || null);
        setG1FingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setG1FingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setG1FingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        setG1Village(selected.aadhaar_village || selected.village || '');
        setG1Mandal(selected.aadhaar_mandal || selected.mandal || '');
        setG1District(selected.aadhaar_district || selected.district || '');
        setG1PermanentAddress(selected.aadhaar_address || '');
        setG1CurrentAddress(selected.present_address || selected.address || '');
        setG1CurrentVillage(selected.present_village || selected.village || '');
        setG1CurrentMandal(selected.present_mandal || selected.mandal || '');
        setG1CurrentDistrict(selected.present_district || selected.district || '');
      }
    };
    fetchG1();
  }, [g1SelectedId]);

  // Autofill guarantor 2 data
  useEffect(() => {
    const fetchG2 = async () => {
      if (!g2SelectedId) return;
      const selected = await supabaseFinance.getCustomerById(g2SelectedId);
      if (selected) {
        setG2Name(selected.name);
        setG2Phone(selected.phone_1 || selected.phone || '');
        setG2Aadhaar(selected.aadhaar || '');
        setG2AadhaarAddress(selected.aadhaar_address || '');
        setG2PresentAddress(selected.present_address || selected.address || '');
        setG2Photo(selected.customer_photo_url || null);
        setG2FingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setG2FingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setG2FingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        setG2Village(selected.aadhaar_village || selected.village || '');
        setG2Mandal(selected.aadhaar_mandal || selected.mandal || '');
        setG2District(selected.aadhaar_district || selected.district || '');
        setG2PermanentAddress(selected.aadhaar_address || '');
        setG2CurrentAddress(selected.present_address || selected.address || '');
        setG2CurrentVillage(selected.present_village || selected.village || '');
        setG2CurrentMandal(selected.present_mandal || selected.mandal || '');
        setG2CurrentDistrict(selected.present_district || selected.district || '');
      }
    };
    fetchG2();
  }, [g2SelectedId]);

  // Autofill partner name
  useEffect(() => {
    if (selectedPartnerId) {
      const selected = partners.find(p => p.id === selectedPartnerId);
      if (selected && selected.name) {
        setPartnerName(selected.name);
      }
    } else {
      setPartnerName('');
    }
  }, [selectedPartnerId, partners]);

  // Handle Location Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    const loadingToast = toast.loading('Retrieving GPS satellite coordinates...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss(loadingToast);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocLatitude(String(lat));
        setLocLongitude(String(lng));
        setLocMapsLink(`https://www.google.com/maps/place/${lat},${lng}`);
        toast.success('Collateral GPS localized successfully!');
      },
      (error) => {
        toast.dismiss(loadingToast);
        console.error(error);
        toast.error('Failed to resolve coordinates: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Upload checklist document to storage
  const handleChecklistUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: true } : doc));
    
    try {
      const fileObj = new File([file], `doc-${loanId}-${key}-${Date.now()}-${file.name}`, { type: file.type });
      
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, checked: true, fileUrl: publicUrl, uploading: false } : doc));
      toast.success('Document uploaded and attached successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Document upload failed');
      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: false } : doc));
    }
  };

  const removeChecklistUpload = (key: string) => {
    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, fileUrl: null } : doc));
    toast.success('Attachment detached');
  };

  const handleCollateralImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `collateral-${Date.now()}.${fileExt}`;
      const filePath = `collateral/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('finance-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('finance-photos')
        .getPublicUrl(filePath);

      setCollateralImage(data.publicUrl);
      toast.success('Collateral image uploaded successfully');
    } catch (err) {
      console.error('Error uploading collateral image:', err);
      toast.error('Failed to upload collateral image');
    }
  };

  const removeCollateralImage = () => {
    setCollateralImage(null);
  };

  // Helper to format currency properly as Indian Rupees
  const formatRupee = (value: number) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Live Calculations
  const liveCalculations = useMemo(() => {
    const P = Number(amount);
    const R = Number(interestRate);
    const D = Number(durationMonths);
    const docFees = Number(docCharges) || 0;

    if (isNaN(P) || P <= 0 || isNaN(R) || R < 0 || isNaN(D) || D <= 0) {
      return null;
    }

    let interestAmount = 0;
    const penalty = 0; // Explicitly 0 during new loan creation
    let duesCount = 0;
    let dueAmount = 0;

    if (loanCategory === 'CD') {
      interestAmount = P * (R / 100) * (D / 30);
      duesCount = D;
    } else {
      interestAmount = P * (R / 100) * D;
      if (dueType === 'Daily') {
        duesCount = D * 30;
      } else if (dueType === 'Weekly') {
        duesCount = Math.round(D * 4.33);
      } else {
        duesCount = D;
      }
      dueAmount = duesCount > 0 ? ((P + interestAmount) / duesCount) : 0;
    }

    const payableAmount = loanCategory === 'CD' ? P - interestAmount - docFees : P - docFees;
    const netDisbursed = P - docFees;
    const totalRenewal = interestAmount + penalty;
    const totalClose = P + interestAmount + penalty;

    return {
      principal: P,
      interestAmount: parseFloat(interestAmount.toFixed(2)),
      penalty: penalty,
      totalRenewal: parseFloat(totalRenewal.toFixed(2)),
      totalClose: parseFloat(totalClose.toFixed(2)),
      totalRepayment: parseFloat(totalClose.toFixed(2)),
      duesCount,
      dueAmount: parseFloat(dueAmount.toFixed(2)),
      docFees,
      netDisbursed: parseFloat(netDisbursed.toFixed(2)),
      payableAmount: parseFloat(payableAmount.toFixed(2))
    };
  }, [amount, interestRate, durationMonths, dueType, docCharges, loanCategory]);

  // Form Reset / Clear
  const handleClearForm = () => {
    if (!window.confirm('Are you sure you want to clear the form? All details will be reset.')) return;
    
    setDate(getLocalBusinessDateISO());
    setLoanCategory('CD');
    setSelectedCustomerId('');
    setCustName('');
    setCustFatherName('');
    setCustPhone('');
    setCustPhone2('');
    setCustAadhaar('');
    setCustPhoto(null);
    setCustFingerprintUrl(null);
    setCustFingerprintTemplate(null);
    setCustFingerprintAdded(false);
    setCustVillage('');
    setCustMandal('');
    setCustDistrict('');
    setCustAadhaarAddress('');
    setCustPresentAddress('');
    setCustSearch('');
    setCustDropdownOpen(false);
    setNpaWarning(null);

    setG1SelectedId('');
    setG1Name('');
    setG1Phone('');
    setG1Aadhaar('');
    setG1AadhaarAddress('');
    setG1PresentAddress('');
    setG1Photo(null);
    setG1FingerprintUrl(null);
    setG1FingerprintTemplate(null);
    setG1FingerprintAdded(false);
    setG1Search('');
    setG1DropdownOpen(false);
    setG1Village('');
    setG1Mandal('');
    setG1District('');
    setG1PermanentAddress('');
    setG1CurrentAddress('');
    setG1CurrentVillage('');
    setG1CurrentMandal('');
    setG1CurrentDistrict('');

    setG2SelectedId('');
    setG2Name('');
    setG2Phone('');
    setG2Aadhaar('');
    setG2AadhaarAddress('');
    setG2PresentAddress('');
    setG2Photo(null);
    setG2FingerprintUrl(null);
    setG2FingerprintTemplate(null);
    setG2FingerprintAdded(false);
    setG2Search('');
    setG2DropdownOpen(false);
    setG2Village('');
    setG2Mandal('');
    setG2District('');
    setG2PermanentAddress('');
    setG2CurrentAddress('');
    setG2CurrentVillage('');
    setG2CurrentMandal('');
    setG2CurrentDistrict('');

    setAmount('');
    setDocCharges('');
    setInterestRate('3');
    setDurationMonths('');
    setPenaltyPercent('0.75');
    setDueType('Daily');
    setParticulars('');

    setSelectedPartnerId('');
    setPartnerName('');

    setLocAddress('');
    setLocVillage('');
    setLocMandal('');
    setLocDistrict('');
    setLocState('');
    setLocPincode('');
    setLocLandmark('');
    setLocLatitude('');
    setLocLongitude('');
    setLocMapsLink('');

    setRemarks('');
    setExtraDetails('');

    setDocuments(prev => prev.map(doc => ({ ...doc, checked: false, refNo: '', fileUrl: null })));
    toast.success('Form cleared successfully');
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();

    const fields: ValidationField[] = [
      { name: 'date', label: 'Date', value: date, required: true, ref: dateRef },
      { name: 'loanId', label: 'Loan Number', value: loanId, required: true, ref: loanIdRef },
      { name: 'custName', label: 'Customer Name', value: custName, required: true, ref: custNameRef },
      { name: 'custPhone', label: 'Customer Phone', value: custPhone, required: true, ref: custPhoneRef },
      { name: 'amount', label: 'Loan Amount', value: amount, required: true, ref: amountRef },
      { name: 'interestRate', label: 'Rate of Interest', value: interestRate, required: true, ref: interestRateRef },
      { name: 'durationMonths', label: 'Period', value: durationMonths, required: true, ref: durationMonthsRef },
      { name: 'particulars', label: 'Particulars', value: particulars, required: true, ref: particularsRef },
    ];

    if (g1Name || g1SelectedId) {
      fields.push({ name: 'g1Name', label: 'Guarantor Name', value: g1Name, required: true, ref: g1NameRef });
      fields.push({ name: 'g1Phone', label: 'Guarantor Phone', value: g1Phone, required: true, ref: g1PhoneRef });
    }
    
    if (locVillage || locMandal || locDistrict || locState || locPincode || locLandmark || locLatitude || locLongitude || collateralImage) {
      fields.push({ name: 'locAddress', label: 'Collateral Address / Location', value: locAddress, required: true, ref: locAddressRef });
    }
    
    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);
    if (!isValid) return;

    if (!liveCalculations) {
      toast.error('Please enter valid loan terms (Amount, Rate, Duration)');
      return;
    }

    // Validate customer Aadhaar format and duplicate if creating inline
    if (!selectedCustomerId) {
      const cleanAadhaar = custAadhaar.trim();
      if (cleanAadhaar) {
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          toast.error('Aadhaar must be exactly 12 digits.');
          return;
        }

        // Query database directly to check for duplicate Aadhaar
        try {
          const { data: existingCustomers, error: checkError } = await supabase
            .from('finance_customers')
            .select('name, customer_id')
            .eq('aadhaar', cleanAadhaar)
            .limit(1);

          if (checkError) {
            console.error('Error checking duplicate Aadhaar:', checkError);
          } else if (existingCustomers && existingCustomers.length > 0) {
            const dup = existingCustomers[0];
            toast.error(`Customer with this Aadhaar already exists (Name: ${dup.name}, ID: ${dup.customer_id || 'N/A'}).`);
            return;
          }
        } catch (err) {
          console.error('Exception checking duplicate Aadhaar:', err);
        }
      }
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';

      // 1. Resolve Customer ID
      let resolvedCustomerId = selectedCustomerId;
      if (!resolvedCustomerId) {
        // Check if customer already exists by Aadhaar, Phone, or exact Name + Father match
        const match = customerSearchResults.find(c => 
          (c.aadhaar && custAadhaar && c.aadhaar === custAadhaar) ||
          (c.phone_1 && custPhone && c.phone_1 === custPhone) ||
          (c.phone && custPhone && c.phone === custPhone) ||
          (c.name && c.name.toLowerCase() === custName.toLowerCase().trim() && 
           ((c.father_name || c.father_husband_name || '').toLowerCase() === custFatherName.toLowerCase().trim()))
        );

        if (match && match.id) {
          resolvedCustomerId = match.id;
        } else {
          // Create new customer
          const newCust = await supabaseFinance.createCustomer({
            name: custName.trim().toUpperCase(),
            phone: custPhone || null,
            phone2: custPhone2 || null,
            address: custPresentAddress ? custPresentAddress.trim().toUpperCase() : null,
            aadhaar: custAadhaar || null,
            customer_photo_url: custPhoto,
            father_husband_name: custFatherName ? custFatherName.trim().toUpperCase() : null,
            father_name: custFatherName ? custFatherName.trim().toUpperCase() : null,
            village: custVillage ? custVillage.trim().toUpperCase() : null,
            mandal: custMandal ? custMandal.trim().toUpperCase() : null,
            district: custDistrict ? custDistrict.trim().toUpperCase() : null,
            aadhaar_address: custAadhaarAddress ? custAadhaarAddress.trim().toUpperCase() : null,
            present_address: custPresentAddress ? custPresentAddress.trim().toUpperCase() : null,
            phone_1: custPhone || null,
            phone_2: custPhone2 || null,
            fingerprint_url: custFingerprintUrl || null,
            fingerprint_template: custFingerprintTemplate || null,
            fingerprint_added: custFingerprintAdded
          });
          if (newCust) {
            resolvedCustomerId = newCust.id;
          } else {
            toast.error('Failed to create new customer record.');
            setSaving(false);
            return;
          }
        }
      }

      // 2. Resolve Guarantor 1 ID
      let resolvedG1Id = g1SelectedId;
      if (!resolvedG1Id && g1Name.trim()) {
        const matchG1 = g1SearchResults.find(g => 
          (g.aadhaar && g1Aadhaar && g.aadhaar === g1Aadhaar) ||
          (g.phone_1 && g1Phone && g.phone_1 === g1Phone) ||
          (g.phone && g1Phone && g.phone === g1Phone) ||
          (g.name && g.name.toLowerCase() === g1Name.toLowerCase().trim())
        );

        if (matchG1 && matchG1.id) {
          resolvedG1Id = matchG1.id;
        } else {
          const newGuar = await supabaseFinance.createCustomer({
            name: g1Name.trim(),
            aadhaar: g1Aadhaar || null,
            phone: g1Phone || null,
            phone2: null,
            aadhaar_address: g1AadhaarAddress || null,
            aadhaar_village: g1Village || null,
            aadhaar_mandal: g1Mandal || null,
            aadhaar_district: g1District || null,
            present_address: g1PresentAddress || null,
            present_village: g1CurrentVillage || null,
            present_mandal: g1CurrentMandal || null,
            present_district: g1CurrentDistrict || null,
            customer_photo_url: g1Photo || null,
            customer_fingerprint_template: g1FingerprintTemplate || null,
            customer_fingerprint_image_url: g1FingerprintUrl || null,
            customer_fingerprint_added: g1FingerprintAdded,
            father_name: null,
            father_husband_name: null,
            phone_1: g1Phone || null,
            phone_2: null,
            address: g1PresentAddress || null,
            village: g1CurrentVillage || null,
            mandal: g1CurrentMandal || null,
            district: g1CurrentDistrict || null
          });
          if (newGuar) {
            resolvedG1Id = newGuar.id;
          } else {
            toast.error('Failed to create Guarantor 1 record.');
            setSaving(false);
            return;
          }
        }
      }

      // 3. Resolve Guarantor 2 ID
      let resolvedG2Id = g2SelectedId;
      if (!resolvedG2Id && g2Name.trim()) {
        const matchG2 = g2SearchResults.find(g => 
          (g.aadhaar && g2Aadhaar && g.aadhaar === g2Aadhaar) ||
          (g.phone_1 && g2Phone && g.phone_1 === g2Phone) ||
          (g.phone && g2Phone && g.phone === g2Phone) ||
          (g.name && g.name.toLowerCase() === g2Name.toLowerCase().trim())
        );

        if (matchG2 && matchG2.id) {
          resolvedG2Id = matchG2.id;
        } else {
          const newGuar = await supabaseFinance.createCustomer({
            name: g2Name.trim(),
            aadhaar: g2Aadhaar || null,
            phone: g2Phone || null,
            phone2: null,
            aadhaar_address: g2AadhaarAddress || null,
            aadhaar_village: g2Village || null,
            aadhaar_mandal: g2Mandal || null,
            aadhaar_district: g2District || null,
            present_address: g2PresentAddress || null,
            present_village: g2CurrentVillage || null,
            present_mandal: g2CurrentMandal || null,
            present_district: g2CurrentDistrict || null,
            customer_photo_url: g2Photo || null,
            customer_fingerprint_template: g2FingerprintTemplate || null,
            customer_fingerprint_image_url: g2FingerprintUrl || null,
            customer_fingerprint_added: g2FingerprintAdded,
            father_name: null,
            father_husband_name: null,
            phone_1: g2Phone || null,
            phone_2: null,
            address: g2PresentAddress || null,
            village: g2CurrentVillage || null,
            mandal: g2CurrentMandal || null,
            district: g2CurrentDistrict || null
          });
          if (newGuar) {
            resolvedG2Id = newGuar.id;
          } else {
            toast.error('Failed to create Guarantor 2 record.');
            setSaving(false);
            return;
          }
        }
      }

      // 4. Create dues schedule
      const duesList: any[] = [];
      const start = new Date(date);
      for (let i = 1; i <= liveCalculations.duesCount; i++) {
        const dDate = new Date(start);
        if (dueType === 'Daily') {
          dDate.setDate(start.getDate() + i);
        } else if (dueType === 'Weekly') {
          dDate.setDate(start.getDate() + i * 7);
        } else {
          dDate.setMonth(start.getMonth() + i);
        }
        duesList.push({
          due_date: getLocalBusinessDateISO(dDate),
          amount: liveCalculations.dueAmount
        });
      }

      // Combined Guarantors Surety details for backward compat
      const combinedSuretyName = [g1Name, g2Name].filter(Boolean).join(' / ') || null;
      const combinedSuretyPhone = [g1Phone, g2Phone].filter(Boolean).join(' / ') || null;
      const combinedSuretyAadhaar = [g1Aadhaar, g2Aadhaar].filter(Boolean).join(' / ') || null;
      const combinedSuretyAadhaarAddress = [g1AadhaarAddress, g2AadhaarAddress].filter(Boolean).join(' / ') || null;
      const combinedSuretyPresentAddress = [g1PresentAddress, g2PresentAddress].filter(Boolean).join(' / ') || null;

      const finalRemarks = [
         remarks,
        `Collateral: ${locAddress || 'N/A'}, GPS: ${locLatitude && locLongitude ? `${locLatitude},${locLongitude}` : 'N/A'}`,
        `Extra: ${extraDetails || 'N/A'}`
      ].filter(Boolean).join(' | ');

      const customerPayload = {
        id: resolvedCustomerId,
        customer_photo_url: custPhoto,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        father_husband_name: custFatherName || null,
        partner_name: partnerName || null
      };

      const loanPayload = {
        loan_id: loanId,
        customer_id: resolvedCustomerId,
        date,
        amount: liveCalculations.principal,
        interest_rate: Number(interestRate),
        duration_months: Number(durationMonths),
        due_type: dueType,
        due_amount: liveCalculations.dueAmount,
        surety_name: combinedSuretyName,
        surety_phone: combinedSuretyPhone,
        surety_aadhaar: combinedSuretyAadhaar,
        surety_aadhaar_address: combinedSuretyAadhaarAddress,
        surety_present_address: combinedSuretyPresentAddress,
        remarks: finalRemarks,
        customer_photo_url: custPhoto,
        surety_photo_url: g1Photo || g2Photo || null,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        surety_fingerprint_template: g1FingerprintTemplate || g2FingerprintTemplate || null,
        surety_fingerprint_image_url: g1FingerprintUrl || g2FingerprintUrl || null,
        surety_fingerprint_added: g1FingerprintAdded || g2FingerprintAdded || false,
        father_husband_name: custFatherName || null,
        loan_category: loanCategory,
        guarantor_1_id: resolvedG1Id || null,
        guarantor_2_id: resolvedG2Id || null,
        penalty_percent: Number(penaltyPercent) || 0.75,
        document_charges: Number(docCharges) || 0,
        period_days: loanCategory === 'CD' ? (Number(durationMonths) || 30) : null
      };

      const photosArray: any[] = [];
      if (custPhoto) photosArray.push({ photo_type: 'Customer', photo_url: custPhoto });

      const linkedDocs = documents.filter(doc => doc.checked || doc.fileUrl).map(doc => ({
        category: doc.category,
        document_name: doc.label,
        remarks: doc.refNo || null,
        file_url: doc.fileUrl || null,
        is_submitted: doc.checked
      }));

      const savedLoan = await supabaseFinance.createLoan(
        loanPayload,
        customerPayload,
        duesList,
        photosArray,
        linkedDocs,
        staffName
      );

      if (savedLoan) {

        // Save collateral info in logs
        const collateralJSON = {
          collateral_address: locAddress,
          village: locVillage,
          mandal: locMandal,
          district: locDistrict,
          state: locState,
          pincode: locPincode,
          landmark: locLandmark,
          gps_latitude: locLatitude,
          gps_longitude: locLongitude,
          google_maps_link: locMapsLink,
          collateral_image: collateralImage,
          particulars,
          extraDetails,
          document_charges: liveCalculations.docFees
        };

        try {
          await supabase.from('finance_edited_logs').insert([{
            table_name: 'finance_loans_collateral',
            record_id: savedLoan.id,
            old_values: {},
            new_values: collateralJSON,
            edited_by: staffName
          }]);
        } catch (err) {
          console.warn('Could not record collateral JSON metadata', err);
        }

        toast.success(`Loan Account ${loanId} created and disbursed successfully!`);
        navigate('/finance');
      } else {
        toast.error('Disbursal failed. Duplicate Loan Number.');
      }
    } catch (err: any) {
      console.error('Save loan error details:', err);
      const errorMsg = err.message || '';
      if (err.code === '42703' || errorMsg.includes('column') || errorMsg.includes('schema cache')) {
        toast.error('Customer table setup is incomplete. Please run migration.');
      } else if (err.code === '23505' || errorMsg.includes('duplicate') || errorMsg.includes('unique constraint')) {
        if (errorMsg.toLowerCase().includes('loan_id') || errorMsg.toLowerCase().includes('loans')) {
          toast.error('Disbursal failed. Duplicate Loan Number.');
        } else if (errorMsg.toLowerCase().includes('aadhaar')) {
          toast.error('Customer with this Aadhaar already exists.');
        } else {
          toast.error(`Duplicate entry error: ${errorMsg}`);
        }
      } else {
        toast.error(`Disbursal failed: ${errorMsg || 'Check database connection or RLS rules.'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPreview = () => {
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms to preview statement');
      return;
    }
    setShowPrintPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none print:p-0 print:bg-white">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="peek-h1">NEW LOAN ENTRY</h1>
          <p className="mt-1 peek-small-10 uppercase">
            CAPTURE & DISBURSE GENERAL — LEDGER — DUES CALCULATIONS PREVIEW & FILE
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm peek-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <Link
            to="/finance/calculator"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm peek-button uppercase"
          >
            <Calculator className="w-3.5 h-3.5" />
            CALCULATOR
          </Link>
          <button
            onClick={handlePrintPreview}
            disabled={!liveCalculations}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 peek-button uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            PREVIEW & PRINT
          </button>
          <button
            onClick={isLookupMode ? handleClearLookup : handleClearForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm peek-button uppercase"
          >
            <X className="w-3.5 h-3.5" />
            CLEAR
          </button>
          <button
            onClick={handleSaveLoan}
            disabled={saving || isLookupMode}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 peek-button uppercase"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE LOAN'}
          </button>
        </div>
      </div>

      {isLookupMode && (
        <div className="bg-blue-50 border-2 border-blue-500 text-blue-900 p-4 rounded-xl flex items-center justify-between shadow-md print:hidden animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="font-bold text-sm tracking-wider uppercase">VIEW MODE - EXISTING ACCOUNT LOADED</span>
          </div>
          <button
            type="button"
            onClick={handleClearLookup}
            className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1.5 rounded-lg font-bold uppercase transition-colors"
          >
            EXIT VIEW MODE
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form entries */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: BASICS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 peek-h3 uppercase">
              BASICS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="peek-label uppercase">
                  DATE <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="date"
                  ref={dateRef}
                  value={date}
                  disabled={isLookupMode}
                  onChange={(e) => { setDate(e.target.value); setErrors(p => ({...p, date: false})) }}
                  className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none peek-caption-12 ${errors.date ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                  required
                />
              </div>

              <div>
                <label className="peek-label uppercase">
                  LEDGER TYPE <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  value={loanCategory}
                  disabled={isLookupMode}
                  onChange={(e) => setLoanCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                  style={{ fontFamily: 'Times New Roman', fontSize: '15px', fontWeight: 'bold' }}
                  required
                >
                  <option value="CD">CD LEDGER</option>
                  <option value="STBD">STBD LEDGER</option>
                  <option value="HP">HP LEDGER</option>
                  <option value="TBD">TBD LEDGER</option>
                </select>
                <span className="text-[9px] text-slate-400 mt-1.5 block peek-button uppercase">
                  CD, HP, STBD, TBD
                </span>
              </div>

              <div>
                <label className="peek-label uppercase">
                  LOAN NUMBER <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  ref={loanIdRef}
                  value={loanId}
                  disabled={isLookupMode}
                  onChange={(e) => { setLoanId(e.target.value); setErrors(p => ({...p, loanId: false})) }}
                  placeholder="e.g. CD001"
                  className={`w-full bg-slate-50 border rounded-lg p-2 text-slate-700 focus:outline-none font-mono peek-caption-12 ${errors.loanId ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200'}`}
                  required
                />
                <span className="text-[9px] text-slate-400 mt-1.5 block peek-button uppercase">
                  AUTO-GENERATED
                </span>
              </div>

              <div>
                <label className="peek-label uppercase">
                  SEARCH
                </label>
                <div ref={cdSearchDropdownRef} className="relative flex gap-2">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      value={existingCdSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => {
                        if (existingCdSearch.trim()) {
                          setShowCdSuggestions(true);
                        }
                      }}
                      placeholder="E.G. CD001"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none font-mono peek-caption-12 uppercase"
                    />
                    {showCdSuggestions && cdSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {cdSuggestions.map((suggestion) => (
                          <div
                            key={suggestion}
                            onClick={() => handleSelectCdSuggestion(suggestion)}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-slate-800 font-mono text-xs border-b border-slate-50 last:border-0 uppercase"
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExistingCdLookup(existingCdSearch)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold text-xs uppercase shadow-sm flex-shrink-0"
                  >
                    SEARCH
                  </button>
                </div>
              </div>
            </div>
          </div>

          <fieldset disabled={isLookupMode} className="space-y-6">

          {/* NPA Warning Banner */}
          {npaWarning && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 uppercase">
                    NPA Record Found
                  </h3>
                  <div className="mt-2 text-sm text-red-700 space-y-1">
                    <p>
                      This customer had a previous Non-Performing Asset (NPA) closed on <strong>{new Date(npaWarning.closed_at).toLocaleDateString('en-IN')}</strong>. 
                      Reason: {npaWarning.reason || 'N/A'}.
                    </p>
                    <p className="font-bold flex flex-wrap gap-x-6 gap-y-1 mt-1">
                      <span>TOTAL LIABILITY: ₹{
                        (
                          npaWarning.total_liability !== undefined && npaWarning.total_liability !== null && Number(npaWarning.total_liability) > 0
                            ? Number(npaWarning.total_liability) 
                            : (Number(npaWarning.balance_amount || 0) + Number(npaWarning.interest_due || 0) + Number(npaWarning.penalty_due || 0))
                        ).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                      }</span>
                      <span>SETTLEMENT AMOUNT: ₹{(npaWarning.settlement_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span>WAIVED AMOUNT: ₹{
                        (
                          npaWarning.waived_amount !== undefined && npaWarning.waived_amount !== null && Number(npaWarning.waived_amount) > 0
                            ? Number(npaWarning.waived_amount)
                            : Math.max(0, 
                                (
                                  npaWarning.total_liability !== undefined && npaWarning.total_liability !== null && Number(npaWarning.total_liability) > 0
                                    ? Number(npaWarning.total_liability) 
                                    : (Number(npaWarning.balance_amount || 0) + Number(npaWarning.interest_due || 0) + Number(npaWarning.penalty_due || 0))
                                ) - Number(npaWarning.settlement_amount || 0)
                              )
                        ).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                      }</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 2: CUSTOMER */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 peek-h3 uppercase">
                CUSTOMER DETAILS
              </h3>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('');
                    setCustName('');
                    setCustFatherName('');
                    setCustPhone('');
                    setCustPhone2('');
                    setCustAadhaar('');
                    setCustPhoto(null);
                    setCustFingerprintUrl(null);
                    setCustFingerprintTemplate(null);
                    setCustFingerprintAdded(false);
                    setCustVillage('');
                    setCustMandal('');
                    setCustDistrict('');
                    setCustAadhaarAddress('');
                    setCustPresentAddress('');
                    setNpaWarning(null);
                  }}
                  className="text-red-650 hover:underline peek-small-10 uppercase"
                >
                  CLEAR SELECTION
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Search input for existing customer */}
              <div ref={dropdownRef} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 print:hidden">
                <label className="peek-label uppercase">
                  SELECT EXISTING CUSTOMER (OR TYPE DETAILS DIRECTLY BELOW)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={custSearch}
                    onChange={(e) => {
                      setCustSearch(e.target.value);
                      setCustDropdownOpen(true);
                    }}
                    onFocus={() => setCustDropdownOpen(true)}
                    placeholder="Search by customer name, ID, phone, or Aadhaar..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                  />
                  
                  {isSearchingCust && (
                    <div className="absolute inset-y-0 right-10 pr-3 flex items-center pointer-events-none">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-400"></div>
                    </div>
                  )}
                  {custDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {customerSearchResults.length === 0 && !isSearchingCust ? (
                        <div className="px-4 py-3 text-slate-400 text-center peek-h3 uppercase">
                          No matching customers found
                        </div>
                      ) : (
                        customerSearchResults.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              if (c.id) setSelectedCustomerId(c.id);
                              setCustDropdownOpen(false);
                              setCustSearch('');
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                          >
                            <div>
                              <div className="text-slate-900 peek-caption-12">{c.name}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5 peek-button uppercase">
                                ID: #{c.customer_id || 'N/A'} | Aadhaar: {c.aadhaar || 'N/A'}
                              </div>
                            </div>
                            {(c.phone_1 || c.phone) ? (
                              <div className="text-slate-500 font-mono peek-small-10">
                                {c.phone_1 || c.phone}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Inputs Panel */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-4">
                <div className="flex justify-between items-center pb-2">
                  <span className="bg-[#0b1329] text-white text-[9px] px-2 py-1 rounded peek-button uppercase">
                    {selectedCustomerId ? `ID: SELECTED` : 'NEW ENTRY'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Customer Name" 
                    ref={custNameRef} error={errors.custName} value={custName} onChange={(val) => { setCustName(val); setErrors(p => ({...p, custName: false})) }} 
                    placeholder="Full Name" 
                    readOnly={!!selectedCustomerId} 
                    required 
                  />
                  <Input 
                    label="Father Name" 
                    value={custFatherName} 
                    onChange={setCustFatherName} 
                    placeholder="Father Name" 
                    readOnly={!!selectedCustomerId} 
                    required
                  />
                  <Input 
                    label="Aadhaar UID" 
                    value={custAadhaar} 
                    onChange={setCustAadhaar} 
                    placeholder="12-digit Aadhaar UID" 
                    readOnly={!!selectedCustomerId} 
                    required
                  />
                  <Input 
                    label="Phone 1" 
                    ref={custPhoneRef} error={errors.custPhone} value={custPhone} onChange={(val) => { setCustPhone(val); setErrors(p => ({...p, custPhone: false})) }} 
                    placeholder="Primary contact" 
                    readOnly={!!selectedCustomerId} 
                    required
                  />
                  <Input 
                    label="Phone 2" 
                    value={custPhone2} 
                    onChange={setCustPhone2} 
                    placeholder="Secondary contact" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Village (Aadhaar Address)" 
                    value={custVillage} 
                    onChange={setCustVillage} 
                    placeholder="Village" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Mandal (Aadhaar Address)" 
                    value={custMandal} 
                    onChange={setCustMandal} 
                    placeholder="Mandal" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="District (Aadhaar Address)" 
                    value={custDistrict} 
                    onChange={setCustDistrict} 
                    placeholder="District" 
                    readOnly={!!selectedCustomerId} 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 peek-button uppercase">
                      Aadhaar Address
                    </label>
                    <textarea
                      value={custAadhaarAddress}
                      onChange={(e) => setCustAadhaarAddress(e.target.value)}
                      placeholder="Address printed on Aadhaar"
                      rows={2}
                      disabled={!!selectedCustomerId}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 disabled:bg-slate-50 focus:outline-none resize-none peek-caption-12"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 peek-button uppercase">
                      Present Address
                    </label>
                    <textarea
                      value={custPresentAddress}
                      onChange={(e) => setCustPresentAddress(e.target.value)}
                      placeholder="Current residential address"
                      rows={2}
                      disabled={!!selectedCustomerId}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 disabled:bg-slate-50 focus:outline-none resize-none peek-caption-12"
                    />
                  </div>
                </div>

                {/* Photo & Biometrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-150">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3 shadow-sm">
                    <span className="peek-label uppercase text-slate-500 font-semibold mb-1">Customer Photo</span>
                    <div className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {custPhoto ? (
                        <>
                          <img src={custPhoto} alt="Customer" className="w-full h-full object-cover" />
                          {!isLookupMode && (
                            <button
                              type="button"
                              onClick={() => setCustPhoto(null)}
                              className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-5 h-5 mb-1" />
                              <span className="peek-small-10 uppercase">REMOVE</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1">
                          <User className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] peek-button uppercase">NO PHOTO</span>
                        </div>
                      )}
                    </div>
                    {!isLookupMode && (
                      <label className="text-[10px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer shadow-sm peek-button uppercase inline-flex items-center gap-1.5 transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        {custPhoto ? 'REPLACE PHOTO' : 'CAPTURE / UPLOAD'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setCustPhoto(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <BiometricScanner
                    label="Customer Fingerprint Capture"
                    existingTemplate={custFingerprintTemplate}
                    existingImageUrl={custFingerprintUrl}
                    disabled={isLookupMode}
                    onFingerprintSaved={(url, template, added) => {
                      setCustFingerprintUrl(url);
                      setCustFingerprintTemplate(template);
                      setCustFingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: GUARANTORS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 peek-h3 uppercase">
              GUARANTORS
            </h3>
            
            {/* Guarantor 1 */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="text-slate-400 peek-small-10 uppercase">
                  GUARANTOR 1
                </h4>
                {g1SelectedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setG1SelectedId('');
                      setG1Name('');
                      setG1Phone('');
                      setG1Aadhaar('');
                      setG1AadhaarAddress('');
                      setG1PresentAddress('');
                      setG1Photo(null);
                    }}
                    className="text-[9px] text-red-650 hover:underline peek-button uppercase"
                  >
                    CLEAR SELECTION
                  </button>
                )}
              </div>

              {/* Search select existing guarantor 1 */}
              <div ref={g1DropdownRef} className="relative print:hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={g1Search}
                  onChange={(e) => {
                    setG1Search(e.target.value);
                    setG1DropdownOpen(true);
                  }}
                  onFocus={() => setG1DropdownOpen(true)}
                  placeholder="Type to search guarantor 1..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                />
                
                {isSearchingG1 && (
                  <div className="absolute inset-y-0 right-10 pr-3 flex items-center pointer-events-none">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-400"></div>
                  </div>
                )}
                {g1DropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {g1SearchResults.length === 0 && !isSearchingG1 ? (
                      <div className="px-4 py-3 text-slate-400 text-center peek-h3 uppercase">
                        No matching guarantors
                      </div>
                    ) : (
                      g1SearchResults.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            if (g.id) setG1SelectedId(g.id);
                            setG1DropdownOpen(false);
                            setG1Search('');
                          }}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="text-slate-900 peek-caption-12">{g.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 peek-button uppercase">
                              ID: #{g.customer_id || 'N/A'} | Aadhaar: {g.aadhaar || 'N/A'}
                            </div>
                          </div>
                          {(g.phone || g.phone_1) && (
                            <div className="text-[9px] text-slate-500 font-mono peek-button">
                              {g.phone || g.phone_1}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor 1 details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Name" ref={g1NameRef} error={errors.g1Name} value={g1Name} onChange={(val) => { setG1Name(val); setErrors(p => ({...p, g1Name: false})) }} placeholder="Full Name" readOnly={!!g1SelectedId} />
                <Input label="Aadhaar" value={g1Aadhaar} onChange={setG1Aadhaar} placeholder="Aadhaar UID" readOnly={!!g1SelectedId} required={!!g1Name} />
                <Input label="Phone" ref={g1PhoneRef} error={errors.g1Phone} value={g1Phone} onChange={(val) => { setG1Phone(val); setErrors(p => ({...p, g1Phone: false})) }} placeholder="Phone No" readOnly={!!g1SelectedId} required={!!g1Name} />

                <div className="sm:col-span-2 space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <h5 className="text-[10px] text-slate-500 font-semibold uppercase mb-2">Permanent Address</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Permanent Address *" value={g1PermanentAddress} onChange={setG1PermanentAddress} placeholder="Permanent Address" readOnly={!!g1SelectedId} required={!!g1Name} />
                      <Input label="Permanent Village" value={g1Village} onChange={setG1Village} placeholder="Village" readOnly={!!g1SelectedId} />
                      <Input label="Permanent Mandal" value={g1Mandal} onChange={setG1Mandal} placeholder="Mandal" readOnly={!!g1SelectedId} />
                      <Input label="Permanent District" value={g1District} onChange={setG1District} placeholder="District" readOnly={!!g1SelectedId} />
                    </div>
                  </div>
                  <div>
                    <h5 className="text-[10px] text-slate-500 font-semibold uppercase mb-2">Current Address</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Current Address *" value={g1CurrentAddress} onChange={setG1CurrentAddress} placeholder="Current Address" readOnly={!!g1SelectedId} required={!!g1Name} />
                      <Input label="Current Village" value={g1CurrentVillage} onChange={setG1CurrentVillage} placeholder="Village" readOnly={!!g1SelectedId} />
                      <Input label="Current Mandal" value={g1CurrentMandal} onChange={setG1CurrentMandal} placeholder="Mandal" readOnly={!!g1SelectedId} />
                      <Input label="Current District" value={g1CurrentDistrict} onChange={setG1CurrentDistrict} placeholder="District" readOnly={!!g1SelectedId} />
                    </div>
                  </div>
                </div>

                {/* Guarantor 1 Photo & Biometrics */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-150">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3">
                    <span className="peek-label uppercase text-slate-500 font-semibold mb-1">Guarantor 1 Photo</span>
                    <div className="w-24 h-24 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {g1Photo ? (
                        <>
                          <img src={g1Photo} alt="Guarantor 1" className="w-full h-full object-cover" />
                          {!isLookupMode && (
                            <button
                              type="button"
                              onClick={() => setG1Photo(null)}
                              className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-5 h-5 mb-1" />
                              <span className="peek-small-10 uppercase">REMOVE</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1">
                          <User className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] peek-button uppercase">NO PHOTO</span>
                        </div>
                      )}
                    </div>
                    {!isLookupMode && (
                      <label className="text-[10px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer shadow-sm peek-button uppercase inline-flex items-center gap-1.5 transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        {g1Photo ? 'REPLACE PHOTO' : 'CAPTURE / UPLOAD'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setG1Photo(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <BiometricScanner
                    label="Guarantor 1 Fingerprint Capture"
                    existingTemplate={g1FingerprintTemplate}
                    existingImageUrl={g1FingerprintUrl}
                    disabled={isLookupMode}
                    onFingerprintSaved={(url, template, added) => {
                      setG1FingerprintUrl(url);
                      setG1FingerprintTemplate(template);
                      setG1FingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Guarantor 2 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-slate-400 peek-small-10 uppercase">
                  GUARANTOR 2
                </h4>
                {g2SelectedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setG2SelectedId('');
                      setG2Name('');
                      setG2Phone('');
                      setG2Aadhaar('');
                      setG2AadhaarAddress('');
                      setG2PresentAddress('');
                      setG2Photo(null);
                    }}
                    className="text-[9px] text-red-650 hover:underline peek-button uppercase"
                  >
                    CLEAR SELECTION
                  </button>
                )}
              </div>

              {/* Search select existing guarantor 2 */}
              <div ref={g2DropdownRef} className="relative print:hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={g2Search}
                  onChange={(e) => {
                    setG2Search(e.target.value);
                    setG2DropdownOpen(true);
                  }}
                  onFocus={() => setG2DropdownOpen(true)}
                  placeholder="Type to search guarantor 2..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                />
                
                {isSearchingG2 && (
                  <div className="absolute inset-y-0 right-10 pr-3 flex items-center pointer-events-none">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-400"></div>
                  </div>
                )}
                {g2DropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {g2SearchResults.length === 0 && !isSearchingG2 ? (
                      <div className="px-4 py-3 text-slate-400 text-center peek-h3 uppercase">
                        No matching guarantors
                      </div>
                    ) : (
                      g2SearchResults.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            if (g.id) setG2SelectedId(g.id);
                            setG2DropdownOpen(false);
                            setG2Search('');
                          }}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="text-slate-900 peek-caption-12">{g.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 peek-button uppercase">
                              ID: #{g.customer_id || 'N/A'} | Aadhaar: {g.aadhaar || 'N/A'}
                            </div>
                          </div>
                          {(g.phone || g.phone_1) && (
                            <div className="text-[9px] text-slate-500 font-mono peek-button">
                              {g.phone || g.phone_1}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor 2 details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Name" value={g2Name} onChange={setG2Name} placeholder="Full Name" readOnly={!!g2SelectedId} />
                <Input label="Aadhaar" value={g2Aadhaar} onChange={setG2Aadhaar} placeholder="Aadhaar UID" readOnly={!!g2SelectedId} required={!!g2Name} />
                <Input label="Phone" value={g2Phone} onChange={setG2Phone} placeholder="Phone No" readOnly={!!g2SelectedId} />

                <div className="sm:col-span-2 space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <h5 className="text-[10px] text-slate-500 font-semibold uppercase mb-2">Permanent Address</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Permanent Address *" value={g2PermanentAddress} onChange={setG2PermanentAddress} placeholder="Permanent Address" readOnly={!!g2SelectedId} required={!!g2Name} />
                      <Input label="Permanent Village" value={g2Village} onChange={setG2Village} placeholder="Village" readOnly={!!g2SelectedId} />
                      <Input label="Permanent Mandal" value={g2Mandal} onChange={setG2Mandal} placeholder="Mandal" readOnly={!!g2SelectedId} />
                      <Input label="Permanent District" value={g2District} onChange={setG2District} placeholder="District" readOnly={!!g2SelectedId} />
                    </div>
                  </div>
                  <div>
                    <h5 className="text-[10px] text-slate-500 font-semibold uppercase mb-2">Current Address</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Current Address *" value={g2CurrentAddress} onChange={setG2CurrentAddress} placeholder="Current Address" readOnly={!!g2SelectedId} required={!!g2Name} />
                      <Input label="Current Village" value={g2CurrentVillage} onChange={setG2CurrentVillage} placeholder="Village" readOnly={!!g2SelectedId} />
                      <Input label="Current Mandal" value={g2CurrentMandal} onChange={setG2CurrentMandal} placeholder="Mandal" readOnly={!!g2SelectedId} />
                      <Input label="Current District" value={g2CurrentDistrict} onChange={setG2CurrentDistrict} placeholder="District" readOnly={!!g2SelectedId} />
                    </div>
                  </div>
                </div>

                {/* Guarantor 2 Photo & Biometrics */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-150">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-3">
                    <span className="peek-label uppercase text-slate-500 font-semibold mb-1">Guarantor 2 Photo</span>
                    <div className="w-24 h-24 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {g2Photo ? (
                        <>
                          <img src={g2Photo} alt="Guarantor 2" className="w-full h-full object-cover" />
                          {!isLookupMode && (
                            <button
                              type="button"
                              onClick={() => setG2Photo(null)}
                              className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-5 h-5 mb-1" />
                              <span className="peek-small-10 uppercase">REMOVE</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-1">
                          <User className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] peek-button uppercase">NO PHOTO</span>
                        </div>
                      )}
                    </div>
                    {!isLookupMode && (
                      <label className="text-[10px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 cursor-pointer shadow-sm peek-button uppercase inline-flex items-center gap-1.5 transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        {g2Photo ? 'REPLACE PHOTO' : 'CAPTURE / UPLOAD'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setG2Photo(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <BiometricScanner
                    label="Guarantor 2 Fingerprint Capture"
                    existingTemplate={g2FingerprintTemplate}
                    existingImageUrl={g2FingerprintUrl}
                    disabled={isLookupMode}
                    onFingerprintSaved={(url, template, added) => {
                      setG2FingerprintUrl(url);
                      setG2FingerprintTemplate(template);
                      setG2FingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: LOAN TERMS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-slate-800 font-bold text-base tracking-wide uppercase">
                LOAN TERMS
              </h3>
              <p className="text-slate-800 text-xs uppercase font-extrabold mt-1 tracking-wider">
                CASH DEPOSIT (CD) — DEFAULT RATE 3% / MONTH
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {/* Row 1 */}
              <div>
                <label className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-2 block">LOAN AMOUNT (₹) <span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="number"
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrors(p => ({...p, amount: false})) }}
                  className={`w-full bg-white border rounded-lg p-2 text-sm text-slate-800 focus:outline-none h-[42px] ${errors.amount ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-2 block">RATE OF INTEREST (% / MONTH)</label>
                <input
                  type="number"
                  ref={interestRateRef}
                  value={interestRate}
                  onChange={(e) => { setInterestRate(e.target.value); setErrors(p => ({...p, interestRate: false})) }}
                  className={`w-full bg-white border rounded-lg p-2 text-sm text-slate-800 focus:outline-none h-[42px] ${errors.interestRate ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                />
                <span className="text-[10px] font-extrabold tracking-wider text-slate-800 mt-2 block uppercase">DEFAULT: 3%</span>
              </div>

              {/* Row 2 */}
              <div>
                <label className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-2 block">PERIOD (DAYS)</label>
                <input
                  type="number"
                  ref={durationMonthsRef}
                  value={durationMonths}
                  onChange={(e) => { setDurationMonths(e.target.value); setErrors(p => ({...p, durationMonths: false})) }}
                  className={`w-full bg-white border rounded-lg p-2 text-sm text-slate-800 focus:outline-none h-[42px] ${errors.durationMonths ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                />
                <span className="text-[10px] font-extrabold tracking-wider text-slate-800 mt-2 block uppercase leading-relaxed">DAYS FOR CD/OD</span>
              </div>
              <div>
                <label className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-2 block">DOCUMENT CHARGES (₹)</label>
                <input
                  type="number"
                  value={docCharges}
                  onChange={(e) => setDocCharges(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[42px]"
                />
              </div>

              {/* Row 3 */}
              <div>
                <label className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-2 block">PENALTY PERCENT (0.75% DEFAULT)</label>
                <input
                  type="number"
                  value={penaltyPercent}
                  onChange={(e) => setPenaltyPercent(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[42px]"
                />
              </div>
              <div className="hidden sm:block"></div>

              {/* Row 4 */}
              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-800 tracking-wider uppercase mb-2 block">PARTICULARS</label>
                <textarea
                  ref={particularsRef}
                  value={particulars}
                  onChange={(e) => { setParticulars(e.target.value); setErrors(p => ({...p, particulars: false})) }}
                  rows={3}
                  className={`w-full bg-white border rounded-lg p-3 text-sm text-slate-800 focus:outline-none resize-none ${errors.particulars ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                />
              </div>
            </div>
          </div>

          {/* Card 5: PARTNER */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 peek-h3 uppercase">
              PARTNER
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="peek-label uppercase">
                  SELECT PARTNER
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                  style={{ fontFamily: 'Times New Roman', fontSize: '15px', fontWeight: 'bold' }}
                >
                  <option value="">-- SELECT PARTNER --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="PARTNER NAME (READONLY)"
                value={partnerName}
                placeholder="Partner Name"
              />
            </div>
          </div>

          {/* Card 6: DOCUMENTS SUBMITTED */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-slate-800 font-bold text-sm uppercase">
                  DOCUMENTS SUBMITTED
                </h3>
                <p className="text-slate-500 text-xs uppercase mt-0.5">
                  RECORD WHAT THE CUSTOMER HAS PHYSICALLY HANDED OVER
                </p>
              </div>
              <div className="flex gap-2">
                <span className="text-xs text-blue-500 bg-white border border-blue-200 px-3 py-1 rounded-full font-bold">
                  FIN - {documents.filter(d => d.category === 'Financial' && (d.checked || d.fileUrl)).length}
                </span>
                <span className="text-xs text-blue-500 bg-white border border-blue-200 px-3 py-1 rounded-full font-bold">
                  ORIG - {documents.filter(d => d.category === 'Original' && (d.checked || d.fileUrl)).length}
                </span>
                <span className="text-xs text-blue-500 bg-white border border-blue-200 px-3 py-1 rounded-full font-bold">
                  REG - {documents.filter(d => d.category === 'Registration' && (d.checked || d.fileUrl)).length}
                </span>
              </div>
            </div>

            {/* Checklist Category Groups */}
            {(['Financial', 'Original', 'Registration'] as const).map((cat, catIdx) => {
              let subtitle = '';
              if (cat === 'Financial') subtitle = 'BANK STATEMENTS, INCOME PROOF, IT RETURNS, GST FILINGS';
              if (cat === 'Original') subtitle = 'PATTAS, DEEDS, VEHICLE PAPERS, JEWELLERY RECEIPTS';
              if (cat === 'Registration') subtitle = 'JOINT REGISTRATION ON THE FINANCE COMPANY, STAMP PAPERS, BONDS';
              
              let headerTitle = `${catIdx + 1}. ${cat.toUpperCase()} DOCUMENTS`;
              if (cat === 'Original') headerTitle += ' (LAND, ASSETS, ETC.)';
              if (cat === 'Registration') headerTitle += ' (JOINT REGISTRATION, ETC.)';

              return (
                <div key={catIdx} className="space-y-4 pt-4 first:pt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-slate-800 text-sm font-bold uppercase">
                        {headerTitle}
                      </h4>
                      <p className="text-slate-500 text-[11px] uppercase mt-0.5">
                        {subtitle}
                      </p>
                    </div>
                    {!isLookupMode && (
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
                        + ADD
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {documents.filter(doc => doc.category === cat).map((doc) => (
                      <div key={doc.key} className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={doc.checked}
                          disabled={isLookupMode}
                          onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, checked: e.target.checked } : d))}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-600 shrink-0 ml-4 disabled:opacity-50"
                        />
                        <div className="w-[240px] shrink-0">
                          {doc.isCustom ? (
                            <input
                              type="text"
                              value={doc.label}
                              disabled={isLookupMode}
                              onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, label: e.target.value } : d))}
                              placeholder="DOCUMENT NAME"
                              className="w-full bg-white border border-slate-200 rounded-md px-4 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:border-slate-300 uppercase h-[42px] disabled:bg-slate-50"
                            />
                          ) : (
                            <div className="w-full bg-white border border-slate-200 rounded-md px-4 py-2 text-sm text-slate-800 font-bold uppercase truncate select-none flex items-center h-[42px]">
                              {doc.label}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 shrink-0 min-w-0">
                          <input
                            type="text"
                            value={doc.refNo}
                            disabled={isLookupMode}
                            onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, refNo: e.target.value } : d))}
                            placeholder="REF NO., AUTHORITY, REMARKS..."
                            className="w-full bg-white border border-slate-200 rounded-md px-4 py-2 text-sm text-slate-600 uppercase focus:outline-none focus:border-slate-300 placeholder:text-slate-300 h-[42px] disabled:bg-slate-50"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {doc.fileUrl ? (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 text-xs font-bold bg-white text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors uppercase h-[42px] flex items-center justify-center min-w-[100px]"
                            >
                              VIEW
                            </a>
                          ) : !isLookupMode ? (
                            <label className="px-4 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer rounded-md transition-colors select-none flex items-center justify-center gap-2 uppercase h-[42px] min-w-[100px]">
                              <Upload className="w-3.5 h-3.5 text-slate-500" />
                              {doc.uploading ? 'UPLOADING...' : 'UPLOAD'}
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => handleChecklistUpload(doc.key, e)}
                                className="hidden"
                                disabled={doc.uploading}
                              />
                            </label>
                          ) : null}

                          {!isLookupMode && (
                            <button
                              type="button"
                              onClick={() => {
                                if (doc.isCustom) {
                                  // For custom rows, remove the row completely
                                  setDocuments(prev => prev.filter(d => d.key !== doc.key));
                                } else {
                                  // For default rows, reset them
                                  if (doc.fileUrl) {
                                    removeChecklistUpload(doc.key);
                                  }
                                  setDocuments(prev => prev.map(d => 
                                    d.key === doc.key ? { ...d, checked: false, refNo: '', fileUrl: null } : d
                                  ));
                                }
                              }}
                              className="w-[42px] h-[42px] text-red-400 hover:text-red-500 hover:bg-red-50 border border-red-100 rounded-md transition-colors shrink-0 flex items-center justify-center"
                              title="Remove or Reset Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card 7: ASSET / COLLATERAL LOCATION */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 peek-h3 uppercase">
                ASSET / COLLATERAL LOCATION
              </h3>
              <button
                type="button"
                onClick={handleDetectGPS}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 rounded transition-colors shadow-sm peek-small-10"
              >
                <Navigation className="w-3.5 h-3.5 text-slate-600 animate-pulse" />
                DETECT GPS
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="ADDRESS"
                ref={locAddressRef} error={errors.locAddress} value={locAddress} onChange={(val) => { setLocAddress(val); setErrors(p => ({...p, locAddress: false})) }}
                placeholder="DOOR NO, STREET, VILLAGE / TOWN"
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="VILLAGE/TOWN" value={locVillage} onChange={setLocVillage} placeholder="Village/Town" />
                <Input label="MANDAL" value={locMandal} onChange={setLocMandal} placeholder="Mandal" />
                <Input label="DISTRICT" value={locDistrict} onChange={setLocDistrict} placeholder="District" />
                <Input label="STATE" value={locState} onChange={setLocState} placeholder="State" />
                <Input label="PINCODE" value={locPincode} onChange={setLocPincode} placeholder="Pincode" />
                <Input label="LANDMARK" value={locLandmark} onChange={setLocLandmark} placeholder="e.g. Near Ramalayam temple" />
                <Input label="LATITUDE" value={locLatitude} onChange={setLocLatitude} placeholder="GPS Latitude" readOnly />
                <Input label="LONGITUDE" value={locLongitude} onChange={setLocLongitude} placeholder="GPS Longitude" readOnly />
              </div>

              <Input
                label="GOOGLE MAPS GPS LINK"
                value={locMapsLink}
                onChange={setLocMapsLink}
                placeholder="PASTE THE GOOGLE MAPS LINK"
              />
              
              <div className="pt-2 border-t border-slate-100">
                <label className="peek-label uppercase block mb-2">
                  COLLATERAL PHOTO (OPTIONAL)
                </label>
                <div className="flex items-center gap-4">
                  {collateralImage ? (
                    <div className="relative w-32 h-32 rounded-xl border-2 border-slate-200 overflow-hidden group">
                      <img
                        src={collateralImage}
                        alt="Collateral"
                        className="w-full h-full object-cover"
                      />
                      {!isLookupMode && (
                        <button
                          type="button"
                          onClick={removeCollateralImage}
                          className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-5 h-5 mb-1" />
                          <span className="peek-small-10 uppercase">REMOVE</span>
                        </button>
                      )}
                    </div>
                  ) : !isLookupMode ? (
                    <label className="w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50/50">
                      <Camera className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="peek-small-10 uppercase text-slate-500 text-center px-2">
                        UPLOAD PHOTO
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCollateralImageUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="w-32 h-32 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/20 text-slate-400 peek-small-10 uppercase">
                      NO PHOTO
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 8: DESCRIPTION & EXTRA FEATURES */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 peek-h3 uppercase">
              DESCRIPTION & EXTRA FEATURES
            </h3>
            <div className="space-y-4">
              <div>
                <label className="peek-label uppercase">
                  REMARKS
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="REASON FOR BORROWING, REPAYMENT ARRANGEMENT..."
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                />
              </div>

              <div>
                <label className="peek-label uppercase">
                  EXTRA DETAILS
                </label>
                <textarea
                  value={extraDetails}
                  onChange={(e) => setExtraDetails(e.target.value)}
                  placeholder="SPECIAL CONDITIONS, ETC."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-slate-900 focus:outline-none peek-caption-12"
                />
              </div>
            </div>
          </div>
          </fieldset>

        </div>

        {/* Right Column: Live Calculation and Recent Loans */}
        <div className="space-y-6">
          
          {/* Card 9: LIVE CALCULATION */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-slate-900 peek-h3 uppercase">
                LIVE CALCULATION
              </h3>
              <span className="text-[9px] text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded peek-button uppercase">
                {dueType}
              </span>
            </div>

            {!liveCalculations ? (
              <div className="py-8 text-center text-slate-800 font-extrabold peek-h3 uppercase" style={{ fontFamily: 'Times New Roman' }}>
                FILL IN THE LOAN AMOUNT TO SEE THE CALCULATION PREVIEW.
              </div>
            ) : loanCategory === 'CD' ? (
              <div className="space-y-4 text-slate-700 finance-caption">
                <div className="grid grid-cols-2 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Loan Amount (Principal):</span>
                  <span className="text-right text-slate-950 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.principal)}</span>

                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Document Charges:</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.docFees)}</span>

                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Interest:</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.interestAmount)}</span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 border-t pt-2.5 items-center">
                  <span className="text-slate-900 text-[14px] uppercase font-black tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Payable Amount:</span>
                  <span className="text-right text-emerald-800 text-[22px] font-black" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.payableAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-slate-700 finance-caption">
                <div className="grid grid-cols-2 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Loan Amount (Principal):</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.principal)}</span>

                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Document Charges:</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.docFees)}</span>

                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Net Disbursement:</span>
                  <span className="text-right text-blue-700 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.netDisbursed)}</span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 border-t pt-2.5 items-center">
                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Interest Component:</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.interestAmount)}</span>

                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Total Repayment:</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.totalRepayment)}</span>

                  <span className="text-slate-800 text-[13px] uppercase font-extrabold tracking-wider" style={{ fontFamily: 'Times New Roman' }}>Instalment Count:</span>
                  <span className="text-right text-slate-955 text-[17px] font-bold" style={{ fontFamily: 'Times New Roman' }}>{liveCalculations.duesCount} {dueType} Dues</span>

                  <span className="text-slate-900 text-[14px] uppercase font-black tracking-wider mt-1" style={{ fontFamily: 'Times New Roman' }}>Instalment Amount:</span>
                  <span className="text-right text-emerald-800 text-[22px] font-black" style={{ fontFamily: 'Times New Roman' }}>₹{formatRupee(liveCalculations.dueAmount)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 10: RECENT LOANS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 peek-h3 uppercase">
              RECENT LOANS
            </h3>
            
            {activeLoans.length === 0 ? (
              <div className="py-8 text-center text-slate-400 peek-h3 uppercase">
                NO LOANS YET
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {activeLoans.slice(0, 5).map(loan => (
                  <div key={loan.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-all flex justify-between items-center bg-slate-50/20">
                    <div>
                      <div className="text-slate-900 peek-caption-12">{loan.customer?.name}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5 peek-button uppercase">{loan.due_type} Mode</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-slate-700 peek-caption-12">{loan.loan_id}</div>
                      <div className="text-slate-900 mt-0.5 peek-caption-12">₹{Number(loan.amount).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Loan Entry - Preview"
        documentTitle="LOAN ENTRY FORM"
      >
        <div className="space-y-6">
          {/* Top Header */}
          <div className="text-center border-b pb-4">
            <h1 className="peek-h1">THIRUMALA GROUP - LOAN ENTRY</h1>
            <p className="text-slate-500 mt-1 finance-sidebar-link">Date: {date} | Loan Type: {loanCategory}</p>
          </div>
          
          {/* Customer Info */}
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 peek-caption-12">NAME:</span> {custName}</div>
               <div><span className="text-gray-500 peek-caption-12">F/W/H:</span> {custFatherName}</div>
               <div><span className="text-gray-500 peek-caption-12">PHONE:</span> {custPhone}</div>
               <div><span className="text-gray-500 peek-caption-12">AADHAAR:</span> {custAadhaar}</div>
               <div className="col-span-2"><span className="text-gray-500 peek-caption-12">ADDRESS:</span> {custPresentAddress}</div>
            </div>
          </div>

          {/* Guarantors */}
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Guarantor Details</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 peek-caption-12">G1 NAME:</span> {g1Name}</div>
               <div><span className="text-gray-500 peek-caption-12">G1 PHONE:</span> {g1Phone}</div>
               {g2Name && <div><span className="text-gray-500 peek-caption-12">G2 NAME:</span> {g2Name}</div>}
               {g2Phone && <div><span className="text-gray-500 peek-caption-12">G2 PHONE:</span> {g2Phone}</div>}
            </div>
          </div>

          {/* Loan Terms */}
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Loan Terms</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 peek-caption-12">PRINCIPAL:</span> ₹{formatRupee(Number(amount) || 0)}</div>
               <div><span className="text-gray-500 peek-caption-12">INTEREST RATE:</span> {interestRate}% / MONTH</div>
               <div><span className="text-gray-500 peek-caption-12">DURATION:</span> {durationMonths} MONTHS</div>
               <div><span className="text-gray-500 peek-caption-12">DUE TYPE:</span> {dueType}</div>
               <div><span className="text-gray-500 peek-caption-12">DOC CHARGES:</span> ₹{formatRupee(Number(docCharges) || 0)}</div>
               <div className="col-span-2"><span className="text-gray-500 peek-caption-12">PARTICULARS:</span> {particulars}</div>
            </div>
          </div>

          {/* Live Calculation */}
          {liveCalculations && (
          <div>
            <h3 className="bg-slate-100 p-2 finance-sidebar-link uppercase">Calculations</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="text-gray-500 peek-caption-12">NET DISBURSED:</span> ₹{formatRupee(liveCalculations.netDisbursed)}</div>
               <div><span className="text-gray-500 peek-caption-12">TOTAL REPAYMENT:</span> ₹{formatRupee(liveCalculations.totalRepayment)}</div>
               <div><span className="text-gray-500 peek-caption-12">INSTALMENT COUNT:</span> {liveCalculations.duesCount}</div>
               <div><span className="text-gray-500 peek-caption-12">INSTALMENT AMOUNT:</span> ₹{formatRupee(liveCalculations.dueAmount)}</div>
            </div>
          </div>
          )}
          
          {/* Signatures */}
          <div className="pt-24 grid grid-cols-2 gap-10 text-center text-slate-500 finance-sidebar-link">
            <div>
              <div className="border-t border-slate-300 pt-2 w-48 mx-auto">Customer Signature</div>
            </div>
            <div>
              <div className="border-t border-slate-300 pt-2 w-48 mx-auto">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default LoanEntry;
