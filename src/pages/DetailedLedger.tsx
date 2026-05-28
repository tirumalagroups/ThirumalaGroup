import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import SearchableSelect from '../components/UI/SearchableSelect';
import { supabaseDB } from '../lib/supabaseDatabase';
import { useAuth } from '../contexts/AuthContext';
import { useTableMode } from '../contexts/TableModeContext';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import CustomCalendar from '../components/UI/CustomCalendar';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Search, BarChart3, Plus, Database, RefreshCw, Calendar } from 'lucide-react';

interface DetailedLedgerFilters {
  fromDate: string;
  toDate: string;
  companyName: string;
  mainAccount: string;
  subAccount: string;
  staffwise: string;
  user: string;
  creditAmount: string; // keep as string for easy typing; parse on apply
  debitAmount: string;  // keep as string for easy typing; parse on apply
  betweenDates: boolean;
  paymentMode?: string;
}

interface LedgerEntry {
  id: string;
  sno: number;
  date: string;
  companyName: string;
  accountName: string;
  subAccount: string;
  particulars: string;
  credit: number;
  debit: number;
  saleQuantity: number;
  purchaseQuantity: number;
  staff: string;
  user: string;
  entryTime: string;
  approved: boolean;
  balance: number;
  runningBalance: number;
  payment_mode: string;
}

// Helper function to check if an entry matches the search term across all columns
const matchDetailedLedgerSearchTerm = (entry: LedgerEntry, searchTerm: string): boolean => {
  if (!searchTerm) return true;
  const searchLower = searchTerm.toLowerCase().trim();
  
  // Date formatting helpers
  let dateStr1 = '';
  let dateStr2 = '';
  if (entry.date) {
    try {
      const dateObj = new Date(entry.date);
      if (!isNaN(dateObj.getTime())) {
        dateStr1 = format(dateObj, 'dd/MM/yyyy');
        dateStr2 = format(dateObj, 'yyyy-MM-dd');
      }
    } catch (e) {
      // ignore
    }
  }
  
  // Amount check
  const creditStr = entry.credit != null ? String(entry.credit) : '';
  const debitStr = entry.debit != null ? String(entry.debit) : '';
  
  // Quantity check
  const saleQtyStr = entry.saleQuantity != null ? String(entry.saleQuantity) : '';
  const purchaseQtyStr = entry.purchaseQuantity != null ? String(entry.purchaseQuantity) : '';
  
  // Sno
  const snoStr = entry.sno != null ? String(entry.sno) : '';

  // Payment mode formatting for search
  const paymentModeStr = entry.payment_mode || '';
  let paymentModeDisplay = paymentModeStr;
  if (paymentModeStr === 'Online') {
    paymentModeDisplay = 'Double';
  } else if (paymentModeStr === 'Bank Transfer') {
    paymentModeDisplay = 'Bank';
  }

  return (
    (entry.companyName || '').toLowerCase().includes(searchLower) ||
    (entry.accountName || '').toLowerCase().includes(searchLower) ||
    (entry.subAccount || '').toLowerCase().includes(searchLower) ||
    (entry.particulars || '').toLowerCase().includes(searchLower) ||
    (entry.staff || '').toLowerCase().includes(searchLower) ||
    (entry.user || '').toLowerCase().includes(searchLower) ||
    paymentModeStr.toLowerCase().includes(searchLower) ||
    paymentModeDisplay.toLowerCase().includes(searchLower) ||
    creditStr.includes(searchLower) ||
    debitStr.includes(searchLower) ||
    saleQtyStr.includes(searchLower) ||
    purchaseQtyStr.includes(searchLower) ||
    snoStr.includes(searchLower) ||
    dateStr1.includes(searchLower) ||
    dateStr2.includes(searchLower)
  );
};

const DetailedLedger: React.FC = () => {
  const { user } = useAuth();
  const { mode: tableMode } = useTableMode();
  const [allLedgerEntries, setAllLedgerEntries] = useState<LedgerEntry[]>([]);

  const [filters, setFilters] = useState<DetailedLedgerFilters>({
    fromDate: '2016-10-31',
    toDate: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    mainAccount: '',
    subAccount: '',
    staffwise: '',
    user: '',
    creditAmount: '',
    debitAmount: '',
    betweenDates: true,
  });

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printAllEntries, setPrintAllEntries] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  
  // Pagination states
  const [pageSize] = useState(1000); // Show 1000 entries per page
  const [totalEntries, setTotalEntries] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, message: '' });

  // Re-load on dashboard-wide refresh events (emitted after New Entry save)
  useEffect(() => {
    const handler = () => {
      // Longer delay to ensure database has saved the entry
      setTimeout(() => {
        console.log('🔄 DetailedLedger: Refreshing after dashboard-refresh event');
        loadLedgerData();
      }, 500); // Increased delay to 500ms to ensure database save is complete
    };
    window.addEventListener('dashboard-refresh', handler);
    return () => window.removeEventListener('dashboard-refresh', handler);
  }, []);

  // 1. Get entries within the date range (fromDate to toDate)
  const entriesInRange = useMemo(() => {
    if (!filters.betweenDates) return allLedgerEntries;
    const fromStr = filters.fromDate;
    const toStr = filters.toDate;
    return allLedgerEntries.filter(entry => {
      return entry.date >= fromStr && entry.date <= toStr;
    });
  }, [allLedgerEntries, filters.fromDate, filters.toDate, filters.betweenDates]);

  // 2. Companies in range
  const companyOptions = useMemo(() => {
    const distinctCompanies = [...new Set(entriesInRange.map(e => e.companyName).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Companies' },
      ...distinctCompanies.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange]);

  // 3. Accounts in range (filtered by selected company if any)
  const accountOptions = useMemo(() => {
    if (!filters.companyName) {
      return [{ value: '', label: 'Select a company first' }];
    }
    const filtered = entriesInRange.filter(e => e.companyName === filters.companyName);
    const distinctAccounts = [...new Set(filtered.map(e => e.accountName).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Accounts' },
      ...distinctAccounts.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange, filters.companyName]);

  // 4. Sub Accounts in range (filtered by selected company and main account)
  const subAccountOptions = useMemo(() => {
    if (!filters.companyName || !filters.mainAccount) {
      return [{ value: '', label: 'Select a main account first' }];
    }
    const filtered = entriesInRange.filter(
      e => e.companyName === filters.companyName && e.accountName === filters.mainAccount
    );
    const distinctSubAccounts = [...new Set(filtered.map(e => e.subAccount).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Sub Accounts' },
      ...distinctSubAccounts.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange, filters.companyName, filters.mainAccount]);

  // 5. Staff in range
  const staffOptions = useMemo(() => {
    const distinctStaff = [...new Set(entriesInRange.map(e => e.staff).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Staff' },
      ...distinctStaff.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange]);

  // 6. Users in range
  const userOptions = useMemo(() => {
    const distinctUsers = [...new Set(entriesInRange.map(e => e.user).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Users' },
      ...distinctUsers.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange]);

  // Derived totals for top cards
  const totals = useMemo(() => {
    const totalCredit = filteredEntries.reduce((s, e) => s + (e.credit || 0), 0);
    const totalDebit = filteredEntries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalSaleQty = filteredEntries.reduce((s, e) => s + (e.saleQuantity || 0), 0);
    const totalPurchaseQty = filteredEntries.reduce((s, e) => s + (e.purchaseQuantity || 0), 0);
    return { totalCredit, totalDebit, balance: totalCredit - totalDebit, totalSaleQty, totalPurchaseQty };
  }, [filteredEntries]);

  // Local visible inputs for dd/MM/yyyy editing to prevent mm/dd flip
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');

  useEffect(() => {
    try {
      setFromDateInput(filters.fromDate ? format(new Date(filters.fromDate), 'dd/MM/yyyy') : '');
      setToDateInput(filters.toDate ? format(new Date(filters.toDate), 'dd/MM/yyyy') : '');
    } catch {
      // ignore format errors
    }
  }, [filters.fromDate, filters.toDate]);

  // Summary data (removed - using totals useMemo instead for better performance)

  useEffect(() => {
    loadLedgerData();
  }, [tableMode]);

  useEffect(() => {
    applyFilters();
  }, [ledgerEntries, filters, searchTerm]);

  // Reset child filters if their currently selected values are no longer available in the dynamically filtered lists
  useEffect(() => {
    setFilters(prev => {
      let updated = false;
      const newFilters = { ...prev };

      // 1. Company Name
      if (newFilters.companyName && !companyOptions.some(c => c.value === newFilters.companyName)) {
        newFilters.companyName = '';
        newFilters.mainAccount = '';
        newFilters.subAccount = '';
        updated = true;
      }

      // 2. Main Account
      if (newFilters.mainAccount && !accountOptions.some(a => a.value === newFilters.mainAccount)) {
        newFilters.mainAccount = '';
        newFilters.subAccount = '';
        updated = true;
      }

      // 3. Sub Account
      if (newFilters.subAccount && !subAccountOptions.some(s => s.value === newFilters.subAccount)) {
        newFilters.subAccount = '';
        updated = true;
      }

      // 4. Staffwise
      if (newFilters.staffwise && !staffOptions.some(s => s.value === newFilters.staffwise)) {
        newFilters.staffwise = '';
        updated = true;
      }

      // 5. User
      if (newFilters.user && !userOptions.some(u => u.value === newFilters.user)) {
        newFilters.user = '';
        updated = true;
      }

      return updated ? newFilters : prev;
    });
  }, [companyOptions, accountOptions, subAccountOptions, staffOptions, userOptions]);

  const loadLedgerData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading all cashbook entries...');
      
      // Load all entries for both ITR and regular modes
      const entries = await supabaseDB.getAllCashBookEntries();
      console.log('✅ All entries fetched:', entries.length);
      
      // Get total count for pagination info
      const totalCount = await supabaseDB.getCashBookEntriesCount();
      setTotalEntries(totalCount);

      // Convert to ledger format with running balance
      let runningBalance = 0;
      const ledgerData: LedgerEntry[] = entries.map((entry, index) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        // Use the normalized payment_mode from getCashBookEntries directly
        // getCashBookEntries already normalizes payment_mode from database
        // Ensure we properly extract and display the payment_mode value
        let paymentMode = '';
        if (entry.payment_mode) {
          const pmStr = String(entry.payment_mode).trim();
          if (pmStr && pmStr !== 'null' && pmStr !== 'undefined' && pmStr !== '') {
            paymentMode = pmStr;
          }
        }
        
        // Debug: Log payment_mode for first few entries to verify values are present
        if (index < 5) {
          console.log(`📋 DetailedLedger Mapping Entry ${index + 1}:`, {
            id: entry.id,
            sno: entry.sno,
            payment_mode_from_entry: entry.payment_mode,
            payment_mode_type: typeof entry.payment_mode,
            payment_mode_final: paymentMode,
            company: entry.company_name
          });
        }

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
          staff: entry.staff,
          user: entry.users || entry.staff, // Use users field (logged-in user), fallback to staff if missing
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: paymentMode, // Payment mode from NewEntry form (Cash/Bank Transfer/Online)
        };
      });

      setLedgerEntries(ledgerData);
      setAllLedgerEntries(ledgerData);
      
      // Debug: Log summary of payment_mode values
      const entriesWithPaymentMode = ledgerData.filter(e => e.payment_mode && e.payment_mode.trim());
      console.log(`✅ DetailedLedger loaded: ${ledgerData.length} entries, ${entriesWithPaymentMode.length} have payment_mode values`);
      if (entriesWithPaymentMode.length > 0) {
        // Log payment mode summary with correct labels
        console.log('📊 Payment mode summary:', {
          Cash: entriesWithPaymentMode.filter(e => e.payment_mode === 'Cash').length,
          Bank: entriesWithPaymentMode.filter(e => e.payment_mode === 'Bank Transfer').length,
          Double: entriesWithPaymentMode.filter(e => e.payment_mode === 'Online').length
        });
      }
      
      if (entries.length === 0) {
        toast.success('No entries found in database');
      } else {
        toast.success(`Loaded all ${entries.length} cashbook entries`);
      }
    } catch (error) {
      console.error('Error loading ledger data:', error);
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (isLoadingMore || ledgerEntries.length >= totalEntries) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = Math.floor(ledgerEntries.length / pageSize) + 1;
      const offset = ledgerEntries.length;
      
      console.log(`🔄 Loading more entries - Page: ${nextPage}, Offset: ${offset}`);
      
      const moreEntries = await supabaseDB.getCashBookEntries(pageSize, offset);
      console.log(`✅ Loaded ${moreEntries.length} more entries`);
      
      // Convert to ledger format with running balance
      let runningBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].runningBalance : 0;
      const moreLedgerData: LedgerEntry[] = moreEntries.map((entry) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
          staff: entry.staff,
          user: entry.users || entry.staff,
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: entry.payment_mode && String(entry.payment_mode).trim()
            ? String(entry.payment_mode).trim()
            : '',
        };
      });
      
      setLedgerEntries(prev => [...prev, ...moreLedgerData]);
      setAllLedgerEntries(prev => [...prev, ...moreLedgerData]);
      
      if (moreEntries.length === 0) {
        toast.success('No more entries to load');
      }
    } catch (error) {
      console.error('Error loading more entries:', error);
      toast.error('Failed to load more entries');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadAllEntries = async () => {
    try {
      setIsLoadingAll(true);
      setLoadingProgress({ current: 0, total: 0, message: 'Starting to load all entries...' });
      console.log('🔄 Loading ALL entries from database...');
      
      // First get the total count
      const totalCount = await supabaseDB.getCashBookEntriesCount();
      setLoadingProgress({ current: 0, total: totalCount, message: `Found ${totalCount} total records, starting to load...` });
      
      if (totalCount === 0) {
        toast.error('No records found in database');
        return;
      }
      
      // Load all entries using the pagination helper
      const allEntries = await supabaseDB.getAllCashBookEntries();
      console.log(`✅ Loaded ALL ${allEntries.length} entries`);
      
      // Convert to ledger format with running balance
      let runningBalance = 0;
      const ledgerData: LedgerEntry[] = allEntries.map((entry) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          staff: entry.staff,
          user: entry.users || entry.staff, // Use users field (logged-in user), fallback to staff if missing
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: entry.payment_mode && String(entry.payment_mode).trim()
            ? String(entry.payment_mode).trim()
            : '',
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
        };
      });
      
      setLedgerEntries(ledgerData);
      setAllLedgerEntries(ledgerData);
      setTotalEntries(ledgerData.length);
      setLoadingProgress({ current: ledgerData.length, total: totalCount, message: 'Loading complete!' });
      
      toast.success(`Loaded ALL ${ledgerData.length} entries successfully`);
    } catch (error) {
      console.error('Error loading all entries:', error);
      toast.error('Failed to load all entries: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setLoadingProgress({ current: 0, total: 0, message: 'Loading failed' });
    } finally {
      setIsLoadingAll(false);
      // Clear progress after a delay
      setTimeout(() => {
        setLoadingProgress({ current: 0, total: 0, message: '' });
      }, 3000);
    }
  };

  const applyFilters = () => {
    let filtered = [...ledgerEntries];

    // Date range filter
    if (filters.betweenDates) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);
        return entryDate >= fromDate && entryDate <= toDate;
      });
    }

    // Company filter
    if (filters.companyName) {
      filtered = filtered.filter(
        entry => entry.companyName === filters.companyName
      );
    }

    // Main Account filter
    if (filters.mainAccount) {
      filtered = filtered.filter(
        entry => entry.accountName === filters.mainAccount
      );
    }

    // Sub Account filter
    if (filters.subAccount) {
      filtered = filtered.filter(
        entry => entry.subAccount === filters.subAccount
      );
    }

    // Staff filter
    if (filters.staffwise && filters.staffwise.trim() !== '') {
      const filterStaff = filters.staffwise.trim();
      const beforeCount = filtered.length;
      filtered = filtered.filter(entry => {
        const entryStaff = String(entry.staff || '').trim();
        return entryStaff === filterStaff;
      });
      console.log(`🔍 Staff filter "${filterStaff}": ${beforeCount} -> ${filtered.length} entries`);
    }

    // User filter
    if (filters.user && filters.user.trim() !== '') {
      const filterUser = filters.user.trim();
      const beforeCount = filtered.length;
      filtered = filtered.filter(entry => {
        const entryUser = String(entry.user || '').trim();
        return entryUser === filterUser;
      });
      console.log(`🔍 User filter "${filterUser}": ${beforeCount} -> ${filtered.length} entries`);
    }

    // Credit amount filter (exact match)
    if (filters.creditAmount && filters.creditAmount.trim() !== '') {
      const n = Number(filters.creditAmount);
      if (!Number.isNaN(n)) {
        filtered = filtered.filter(entry => Number(entry.credit) === n);
      }
    }

    // Debit amount filter (exact match)
    if (filters.debitAmount && filters.debitAmount.trim() !== '') {
      const n = Number(filters.debitAmount);
      if (!Number.isNaN(n)) {
        filtered = filtered.filter(entry => Number(entry.debit) === n);
      }
    }

    // Payment mode filter
    if (filters.paymentMode) {
      filtered = filtered.filter(entry => {
        const entryPaymentMode = entry.payment_mode || '';
        return entryPaymentMode === filters.paymentMode;
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(entry => matchDetailedLedgerSearchTerm(entry, searchTerm));
    }

    // Calculate summary
    // Summary calculation (using totals useMemo instead)
    // const totalCredit = filtered.reduce((sum, entry) => sum + entry.credit, 0);
    // const totalDebit = filtered.reduce((sum, entry) => sum + entry.debit, 0);
    // const balance = totalCredit - totalDebit;
    // Summary is now calculated via totals useMemo (line 112-118)

    setFilteredEntries(filtered);
  };

  const handleFilterChange = (
    field: keyof DetailedLedgerFilters,
    value: any
  ) => {
    console.log('Filter change:', field, value);
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };

      // Reset dependent filters
      if (field === 'companyName') {
        newFilters.mainAccount = '';
        newFilters.subAccount = '';
        console.log('Reset main account and sub account');
      }
      if (field === 'mainAccount') {
        newFilters.subAccount = '';
        console.log('Reset sub account');
      }

      console.log('New filters:', newFilters);
      return newFilters;
    });
  };

  const getRecords = () => {
    applyFilters();
    toast.success(`Found ${filteredEntries.length} records`);
  };

  const loadFilteredData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading filtered data from server...');
      
      // Use server-side filtering for better performance with large datasets
      const filteredEntries = await supabaseDB.getAllFilteredCashBookEntries({
        companyName: filters.companyName || undefined,
        accountName: filters.mainAccount || undefined,
        subAccountName: filters.subAccount || undefined,
      });
      
      console.log(`📊 Filtered entries loaded: ${filteredEntries.length}`);
      
      // Convert to ledger format with running balance
      let runningBalance = 0;
      const ledgerData: LedgerEntry[] = filteredEntries.map((entry) => {
        const balance = entry.credit - entry.debit;
        runningBalance += balance;

        // Extract payment_mode
        let paymentMode = '';
        if (entry.payment_mode) {
          const pmStr = String(entry.payment_mode).trim();
          if (pmStr && pmStr !== 'null' && pmStr !== 'undefined' && pmStr !== '') {
            paymentMode = pmStr;
          }
        }

        return {
          id: entry.id,
          sno: entry.sno,
          date: entry.c_date,
          companyName: entry.company_name,
          accountName: entry.acc_name,
          subAccount: entry.sub_acc_name || '',
          particulars: entry.particulars,
          credit: entry.credit,
          debit: entry.debit,
          saleQuantity: entry.sale_qty || 0,
          purchaseQuantity: entry.purchase_qty || 0,
          staff: entry.staff,
          user: entry.users || entry.staff,
          entryTime: entry.entry_time,
          approved: entry.approved,
          balance: balance,
          runningBalance: runningBalance,
          payment_mode: paymentMode,
        };
      });
      
      setLedgerEntries(ledgerData);
      setTotalEntries(ledgerData.length);
      
      if (ledgerData.length === 0) {
        toast.success(`No entries found for the selected filters`);
      } else {
        toast.success(`Found ${ledgerData.length} entries matching your filters`);
      }
    } catch (error) {
      console.error('Error loading filtered data:', error);
      toast.error('Failed to load filtered data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      fromDate: '2016-10-31',
      toDate: format(new Date(), 'yyyy-MM-dd'),
      companyName: '',
      mainAccount: '',
      subAccount: '',
      staffwise: '',
      user: '',
      creditAmount: '',
      debitAmount: '',
      betweenDates: true,
      paymentMode: '',
    });
    setSearchTerm('');
    toast.success('Filters reset');
  };

  const generatePrintContent = (entriesToPrint: LedgerEntry[], isAllEntries: boolean) => {
    // Calculate totals
    const totalCredit = entriesToPrint.reduce((s, e) => s + (e.credit || 0), 0);
    const totalDebit = entriesToPrint.reduce((s, e) => s + (e.debit || 0), 0);
    const totalSaleQty = entriesToPrint.reduce((s, e) => s + (e.saleQuantity || 0), 0);
    const totalPurchaseQty = entriesToPrint.reduce((s, e) => s + (e.purchaseQuantity || 0), 0);
    const printTotals = {
      totalCredit,
      totalDebit,
      totalSaleQty,
      totalPurchaseQty,
      balance: totalCredit - totalDebit,
      quantityBalance: totalPurchaseQty - totalSaleQty,
    };

    // Generate all rows - browser will handle pagination naturally
    let allRows = '';
    entriesToPrint.forEach((entry, index) => {
      allRows += `
        <tr>
            <td style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${index + 1}</td>
            <td style="padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${format(new Date(entry.date), 'dd/MM/yyyy')}</td>
            <td style="padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1;">${entry.companyName}</td>
            <td style="padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${entry.accountName}</td>
            <td style="padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${entry.subAccount || '-'}</td>
            <td style="padding: 2px 1px; border: 1px solid #000; font-size: 11px; word-wrap: break-word; line-height: 1.1; font-weight: bold;">${entry.particulars}</td>
            <td style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${entry.purchaseQuantity > 0 ? entry.purchaseQuantity.toLocaleString() : '-'}</td>
            <td style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${entry.saleQuantity > 0 ? entry.saleQuantity.toLocaleString() : '-'}</td>
            <td style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${entry.credit > 0 ? `${entry.credit.toLocaleString()}` : '-'}</td>
            <td style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${entry.debit > 0 ? `${entry.debit.toLocaleString()}` : '-'}</td>
        </tr>
      `;
    });

    const totalsRow = `
      <tr style="background-color: #f0f0f0; font-weight: bold;">
          <td colspan="6" style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">TOTAL:</td>
          <td style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${printTotals.totalPurchaseQty > 0 ? printTotals.totalPurchaseQty.toLocaleString() : '-'}</td>
          <td style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; line-height: 1.1; font-weight: bold;">${printTotals.totalSaleQty > 0 ? printTotals.totalSaleQty.toLocaleString() : '-'}</td>
          <td style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1;">${printTotals.totalCredit.toLocaleString()}</td>
          <td style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1;">${printTotals.totalDebit.toLocaleString()}</td>
        </tr>
        <tr style="background-color: #e8e8e8;">
          <td colspan="6" style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1;">QUANTITY BALANCE:</td>
          <td colspan="1" style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1; color: ${printTotals.quantityBalance >= 0 ? '#059669' : '#dc2626'};">
${printTotals.quantityBalance > 0 ? printTotals.quantityBalance.toLocaleString() : printTotals.quantityBalance < 0 ? Math.abs(printTotals.quantityBalance).toLocaleString() : '-'} ${printTotals.quantityBalance >= 0 ? 'CR' : printTotals.quantityBalance < 0 ? 'DR' : ''}
        </td>
        <td colspan="1" style="text-align: right; padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1;">BALANCE:</td>
        <td colspan="2" style="text-align: center; padding: 2px 1px; border: 1px solid #000; font-size: 11px; font-weight: bold; line-height: 1.1; color: ${printTotals.balance >= 0 ? '#059669' : '#dc2626'};">
${Math.abs(printTotals.balance).toLocaleString()} ${printTotals.balance >= 0 ? 'CR' : 'DR'}
        </td>
      </tr>
    `;

    const filterInfo = !isAllEntries && (filters.subAccount || filters.staffwise || filters.user || filters.paymentMode) 
      ? `
        <div style="margin-bottom: 3px; font-size: 10px; padding: 3px 5px; background-color: #f5f5f5;">
          ${filters.subAccount ? `<span style="margin-right: 15px;">Sub Account: <strong>${filters.subAccount}</strong></span>` : ''}
          ${filters.staffwise ? `<span style="margin-right: 15px;">Staff: <strong>${filters.staffwise}</strong></span>` : ''}
          ${filters.user ? `<span style="margin-right: 15px;">User: <strong>${filters.user}</strong></span>` : ''}
          ${filters.paymentMode ? `<span>Payment Mode: <strong>${filters.paymentMode}</strong></span>` : ''}
        </div>
      ` : '';

    // Generate single page content - browser will paginate automatically
    let pagesContent = `
      <div class="print-page" style="margin: 0; padding: 0;">
        <div class="header" style="margin: 0; padding: 0;">
          <h1 style="margin: 0; padding: 0; line-height: 1;">Thirumala Group</h1>
          <h2 style="margin: 0; padding: 0; line-height: 1;">Detailed Ledger Report ${isAllEntries ? '(All Records)' : ''}</h2>
          <p style="margin: 0; padding: 0; line-height: 1;">${isAllEntries ? 'All Records' : `From ${format(new Date(filters.fromDate), 'dd/MM/yyyy')} to ${format(new Date(filters.toDate), 'dd/MM/yyyy')}`}</p>
          ${!isAllEntries ? `
            <div style="font-size: 11px; margin: 0; padding: 0; line-height: 1;">
              ${filters.companyName ? `<span style="margin-right: 15px;">Company: <strong>${filters.companyName}</strong></span>` : ''}
              ${filters.mainAccount ? `<span>Account: <strong>${filters.mainAccount}</strong></span>` : ''}
            </div>
          ` : ''}
        </div>

        ${filterInfo ? `<div style="margin: 0; padding: 0; line-height: 1;">${filterInfo}</div>` : ''}

        <table class="no-repeat-header" style="margin: 0; padding: 0; border-top: 1px solid #000;">
          <thead>
            <tr>
              <th style="width: 3%; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">S.No</th>
              <th style="width: 8%; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Date</th>
              <th style="width: 15%; padding: 2px 1px; font-size: 11px; font-weight: bold; line-height: 1.1;">Company</th>
              <th style="width: 15%; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Account</th>
              <th style="width: 12%; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Sub Account</th>
              <th style="width: 27%; padding: 2px 1px; font-size: 11px; word-wrap: break-word; line-height: 1.1; font-weight: bold;">Particulars</th>
              <th style="width: 5%; text-align: center; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Purchase Qty</th>
              <th style="width: 5%; text-align: center; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Sale Qty</th>
              <th style="width: 5%; text-align: right; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Credit</th>
              <th style="width: 5%; text-align: right; padding: 2px 1px; font-size: 11px; line-height: 1.1; font-weight: bold;">Debit</th>
            </tr>
          </thead>
          <tbody>
            ${allRows}
            ${totalsRow}
          </tbody>
        </table>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Detailed Ledger Report</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 1.2cm 1.0cm 1.2cm 1.0cm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #fff;
            }
            @media screen {
              body {
                background-color: #f3f4f6;
                padding: 20px;
              }
              .print-page {
                background: white;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                border-radius: 8px;
                padding: 1.2cm 1.0cm;
                margin: 0 auto 20px auto;
                max-width: 210mm;
                box-sizing: border-box;
              }
            }
            .header {
              text-align: center;
              margin-bottom: 2px;
              margin-top: 0;
              padding-top: 0;
              padding-bottom: 0;
            }
            .header h1 {
              font-size: 18px;
              margin: 0;
              padding: 0;
              font-weight: bold;
              line-height: 1;
            }
            .header h2 {
              font-size: 14px;
              margin: 0;
              padding: 0;
              font-weight: 600;
              line-height: 1;
            }
            .header p {
              font-size: 11px;
              margin: 0;
              padding: 0;
              line-height: 1;
            }
            .summary-section {
              margin-bottom: 3px;
              font-size: 11px;
            }
            .summary-boxes {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 8px;
            }
            .summary-box {
              text-align: center;
              padding: 6px;
              border: 2px solid #666;
            }
            .summary-label {
              font-size: 11px;
              margin-bottom: 2px;
            }
            .summary-value {
              font-size: 14px;
              font-weight: bold;
            }
            .print-page {
              page-break-after: always;
              margin: 0;
              padding: 0;
            }
            .print-page:last-child {
              page-break-after: auto;
            }
            table {
              width: 100%;
              max-width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              table-layout: fixed;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            th, td {
              border: 1px solid #000;
              padding: 2px 1px;
              word-wrap: break-word;
              line-height: 1.1;
              box-sizing: border-box;
              font-weight: bold;
            }
            th {
              background-color: #e5e5e5;
              font-weight: bold;
              text-align: left;
              font-size: 11px;
            }
            .no-repeat-header thead {
              display: table-header-group;
            }
            .no-header-table thead {
              display: none !important;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              margin-top: 5px;
              color: #666;
              font-weight: bold;
            }
            @media print {
              body { 
                margin: 0;
                padding: 0;
              }
              .print-page {
                page-break-after: always;
                margin: 0;
                padding: 0;
              }
              .print-page:last-child {
                page-break-after: auto;
              }
              table {
                margin: 0 !important;
                padding: 0 !important;
                border-spacing: 0;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
              }
              td, th {
                box-sizing: border-box !important;
                overflow: hidden;
                word-wrap: break-word;
              }
              /* Hide thead on all pages by default - prevent browser from repeating it */
              thead {
                display: none !important;
              }
              /* Show thead only on the first page */
              .print-page:first-child table thead {
                display: table-header-group !important;
              }
              .header {
                margin: 0 !important;
                padding: 0 !important;
              }
              .header h1, .header h2, .header p, .header div {
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1 !important;
              }
              * {
                box-sizing: border-box;
              }
            }
            .no-repeat-header thead {
              display: table-header-group;
            }
            .no-header-table thead {
              display: none !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          </style>
        </head>
        <body>
          ${pagesContent}
        </body>
      </html>
    `;
  };

  const printReport = () => {
    const entriesToPrint = filteredEntries;
    if (entriesToPrint.length === 0) {
      toast.error('No entries to print');
      return;
    }

    // Show print preview modal (background page stays visible)
    setShowPrintPreview(true);
    setPrintAllEntries(false);
  };

  const printAll = () => {
    const entriesToPrint = ledgerEntries;
    if (entriesToPrint.length === 0) {
      toast.error('No entries to print');
      return;
    }

    // Show print preview modal (background page stays visible)
    setShowPrintPreview(true);
    setPrintAllEntries(true);
  };

  const exportToExcel = () => {
    if (filteredEntries.length === 0) {
      toast.error('No entries to export');
      return;
    }
    
    // Helper function to get payment mode display label
    const getPaymentModeDisplayLabel = (mode: string): string => {
      if (mode === 'Online') return 'Double';
      if (mode === 'Bank Transfer') return 'Bank';
      return mode || '';
    };
    
    const exportData = filteredEntries.map((entry, index) => ({
      'S.No': index + 1,
      Date: entry.date,
      Company: entry.companyName,
      'Main Account': entry.accountName,
      'Sub Account': entry.subAccount || '',
      Particulars: entry.particulars,
      Credit: entry.credit,
      Debit: entry.debit,
      Balance: entry.balance,
      Staff: entry.staff,
      'Payment Mode': getPaymentModeDisplayLabel(entry.payment_mode),
      User: entry.user,
      'Entry Time': entry.entryTime,
      // Status removed per requirement
    }));

    // Create CSV content
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => `"${row[header as keyof typeof row]}"`).join(',')
      ),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detailed-ledger-${filters.fromDate}-to-${filters.toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ledger exported successfully!');
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-3 mb-1'>
            <h1 className='text-3xl font-bold text-gray-900'>Detailed Ledger</h1>
            <ModeLabel />
          </div>
          <p className='text-gray-600'>
            Comprehensive ledger analysis with advanced filtering
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Button
            variant='secondary'
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
          <Button variant='secondary' onClick={loadLedgerData}>
            Refresh
          </Button>
          <Button variant='secondary' onClick={exportToExcel}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className='bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'>
          <div className='space-y-6'>
            {/* Date Range Section */}
            <div className='bg-white p-4 rounded-lg border border-gray-200'>
              <div className='flex items-center gap-2 mb-4'>
                <input
                  type='checkbox'
                  id='betweenDates'
                  checked={filters.betweenDates}
                  onChange={e =>
                    handleFilterChange('betweenDates', e.target.checked)
                  }
                  className='w-4 h-4 text-blue-600 rounded focus:ring-blue-500'
                />
                <label
                  htmlFor='betweenDates'
                  className='text-sm font-medium text-gray-700'
                >
                  Between Dates
                </label>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    From
                  </label>
                  <div className='relative'>
                    <input
                      type='text'
                      value={fromDateInput}
                      onChange={e => {
                        const v = e.target.value;
                        setFromDateInput(v);
                        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (m) {
                          const [, dd, mm, yyyy] = m;
                          handleFilterChange('fromDate', `${yyyy}-${mm}-${dd}`);
                        }
                      }}
                      disabled={!filters.betweenDates}
                      placeholder='dd/MM/yyyy'
                      className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                    <button
                      type='button'
                      onClick={() => setShowFromCalendar(!showFromCalendar)}
                      className='absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded'
                    >
                      <Calendar className='w-4 h-4 text-gray-500' />
                    </button>
                    {showFromCalendar && (
                      <CustomCalendar
                        entries={ledgerEntries.map(e => ({ c_date: e.date }))}
                        onDateSelect={(date) => {
                          handleFilterChange('fromDate', date);
                          setFromDateInput(format(new Date(date), 'dd/MM/yyyy'));
                          setShowFromCalendar(false);
                        }}
                        selectedDate={filters.fromDate}
                        onClose={() => setShowFromCalendar(false)}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    To
                  </label>
                  <div className='relative'>
                    <input
                      type='text'
                      value={toDateInput}
                      onChange={e => {
                        const v = e.target.value;
                        setToDateInput(v);
                        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (m) {
                          const [, dd, mm, yyyy] = m;
                          handleFilterChange('toDate', `${yyyy}-${mm}-${dd}`);
                        }
                      }}
                      disabled={!filters.betweenDates}
                      placeholder='dd/MM/yyyy'
                      className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                    <button
                      type='button'
                      onClick={() => setShowToCalendar(!showToCalendar)}
                      className='absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded'
                    >
                      <Calendar className='w-4 h-4 text-gray-500' />
                    </button>
                    {showToCalendar && (
                      <CustomCalendar
                        entries={ledgerEntries.map(e => ({ c_date: e.date }))}
                        onDateSelect={(date) => {
                          handleFilterChange('toDate', date);
                          setToDateInput(format(new Date(date), 'dd/MM/yyyy'));
                          setShowToCalendar(false);
                        }}
                        selectedDate={filters.toDate}
                        onClose={() => setShowToCalendar(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Filters */}
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <SearchableSelect
                label='Company Name'
                value={filters.companyName}
                onChange={value => handleFilterChange('companyName', value)}
                options={companyOptions}
                placeholder='Search company...'
              />

              <SearchableSelect
                label='Main Account'
                value={filters.mainAccount}
                onChange={value => handleFilterChange('mainAccount', value)}
                options={accountOptions}
                disabled={!filters.companyName}
                placeholder={
                  !filters.companyName
                    ? 'Select a company first'
                    : 'Search main account...'
                }
              />

              <SearchableSelect
                label='Sub Account'
                value={filters.subAccount}
                onChange={value => handleFilterChange('subAccount', value)}
                options={subAccountOptions}
                disabled={!filters.mainAccount}
                placeholder={
                  !filters.mainAccount
                    ? 'Select a main account first'
                    : 'Search sub account...'
                }
              />

              <SearchableSelect
                label='Staffwise'
                value={filters.staffwise}
                onChange={value => handleFilterChange('staffwise', value)}
                options={staffOptions}
                placeholder='Search staff...'
              />

              <SearchableSelect
                label='User'
                value={filters.user}
                onChange={value => handleFilterChange('user', value)}
                options={userOptions}
                placeholder='Search user...'
              />
            </div>

            {/* Filtering guidance removed as requested */}

            {/* Amount Filters + Payment Mode */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Credit Amount (Search)
                </label>
                <input
                  type='text'
                  inputMode='decimal'
                  value={filters.creditAmount || ''}
                  onChange={e => handleFilterChange('creditAmount', e.target.value)}
                  placeholder='Enter credit amount to search...'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Debit Amount (Search)
                </label>
                <input
                  type='text'
                  inputMode='decimal'
                  value={filters.debitAmount || ''}
                  onChange={e => handleFilterChange('debitAmount', e.target.value)}
                  placeholder='Enter debit amount to search...'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>

              <SearchableSelect
                label='Payment Mode'
                value={filters.paymentMode || ''}
                onChange={value => handleFilterChange('paymentMode', value)}
                options={[
                  { value: '', label: 'All' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Bank Transfer', label: 'Bank' },
                  { value: 'Online', label: 'Double' },
                ]}
                placeholder='Search payment mode...'
              />
            </div>

            {/* Action Buttons */}
            <div className='flex flex-wrap gap-3'>
              <Button
                onClick={getRecords}
                className='bg-green-600 hover:bg-green-700'
              >
                Get Record (Client-side)
              </Button>

              <Button
                onClick={loadFilteredData}
                className='bg-blue-600 hover:bg-blue-700'
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load Filtered Data (Server-side)'}
              </Button>

              <Button variant='secondary' onClick={resetFilters}>
                Reset
              </Button>

              <Button variant='secondary' onClick={() => setShowFilters(false)}>
                Close
              </Button>

              <Button variant='secondary' onClick={printReport}>
                Print
              </Button>

              <Button variant='secondary' onClick={printAll}>
                Print All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search Bar */}
      <Card className='bg-gray-50'>
        <div className='flex items-center gap-4'>
          <div className='relative flex-1'>
            <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search in ledger entries...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div className='text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border'>
            <strong>{filteredEntries.length}</strong> records found
            {totalEntries > 0 && (
              <span className='text-xs text-gray-500 ml-2'>
                (of {totalEntries} total)
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
        <Card className='bg-gradient-to-r from-green-500 to-green-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm font-medium'>Total Credit</p>
              <p className='text-2xl font-bold'>
{totals.totalCredit.toLocaleString()}
              </p>
            </div>
            <TrendingUp className='w-8 h-8 text-green-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-red-500 to-red-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm font-medium'>Total Debit</p>
              <p className='text-2xl font-bold'>
{totals.totalDebit.toLocaleString()}
              </p>
            </div>
            <TrendingDown className='w-8 h-8 text-red-200' />
          </div>
        </Card>

        <Card
          className={`bg-gradient-to-r ${
            totals.balance >= 0
              ? 'from-blue-500 to-blue-600'
              : 'from-orange-500 to-orange-600'
          } text-white`}
        >
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm font-medium'>Balance</p>
              <p className='text-2xl font-bold'>
{Math.abs(totals.balance).toLocaleString()}
                {totals.balance >= 0 ? ' CR' : ' DR'}
              </p>
            </div>
            <BarChart3 className='w-8 h-8 text-blue-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-indigo-100 text-sm font-medium'>Total Sale Qty</p>
              <p className='text-2xl font-bold'>
                {totals.totalSaleQty.toLocaleString()}
              </p>
            </div>
            <BarChart3 className='w-8 h-8 text-indigo-200' />
          </div>
        </Card>
        <Card className='bg-gradient-to-r from-purple-500 to-purple-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-purple-100 text-sm font-medium'>Total Purchase Qty</p>
              <p className='text-2xl font-bold'>
                {totals.totalPurchaseQty.toLocaleString()}
              </p>
            </div>
            <BarChart3 className='w-8 h-8 text-purple-200' />
          </div>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card
        title='Detailed Ledger Entries'
        subtitle={`Showing ${filteredEntries.length} entries${totalEntries > 0 ? ` (of ${totalEntries} total)` : ''}`}
      >
        {loading ? (
          <div className='text-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-2 text-gray-600'>Loading ledger data...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            No entries found matching your criteria.
          </div>
        ) : (
          <>
            <div className='w-full overflow-x-auto'>
              <table className='min-w-[1300px] w-full text-[11px] table-fixed border-collapse'>
              <thead className='sticky top-0 bg-gray-50 z-10'>
                <tr className='border-b border-gray-200'>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[3%]'>
                    S.No
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[6%]'>
                    Date
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[11%]'>
                    Company
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[9%]'>
                    Account
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[10%]'>
                    Sub Account
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[8%]'>
                    Particulars
                  </th>
                  <th className='px-0.5 py-1 text-right font-medium text-gray-700 w-[6%]'>
                    Credit
                  </th>
                  <th className='px-0.5 py-1 text-right font-medium text-gray-700 w-[6%]'>
                    Debit
                  </th>
                  <th className='px-0.5 py-1 text-center font-medium text-gray-700 w-[6%]'>
                    Purchase Qty
                  </th>
                  <th className='px-0.5 py-1 text-center font-medium text-gray-700 w-[5%]'>
                    Sale Qty
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[9%]'>
                    Staff
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[7%]'>
                    Payment Mode
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[7%]'>
                    User
                  </th>
                  <th className='px-0.5 py-1 text-left font-medium text-gray-700 w-[8%]'>
                    Entry Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                    }`}
                  >
                    <td className='px-0.5 py-1 font-medium text-gray-500'>{index + 1}</td>
                    <td className='px-0.5 py-1 text-gray-900 font-medium'>
                      {format(new Date(entry.date), 'dd/MM/yyyy')}
                    </td>
                    <td className='px-0.5 py-1 text-blue-600 truncate font-semibold' title={entry.companyName}>
                      {entry.companyName}
                    </td>
                    <td className='px-0.5 py-1 text-gray-900 truncate font-medium' title={entry.accountName}>
                      {entry.accountName}
                    </td>
                    <td className='px-0.5 py-1 text-gray-500 truncate' title={entry.subAccount}>
                      {entry.subAccount || '-'}
                    </td>
                    <td className='px-0.5 py-1 text-gray-900 truncate' title={entry.particulars}>
                      {entry.particulars}
                    </td>
                    <td className='px-0.5 py-1 text-right font-semibold text-green-600'>
                      {entry.credit > 0
                        ? `${entry.credit.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className='px-0.5 py-1 text-right font-semibold text-red-600'>
                      {entry.debit > 0
                        ? `${entry.debit.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className='px-0.5 py-1 text-center text-gray-900 font-medium'>
                      {entry.purchaseQuantity > 0 ? entry.purchaseQuantity.toLocaleString() : '-'}
                    </td>
                    <td className='px-0.5 py-1 text-center text-gray-900 font-medium'>
                      {entry.saleQuantity > 0 ? entry.saleQuantity.toLocaleString() : '-'}
                    </td>
                    <td className='px-0.5 py-1 text-gray-900 truncate' title={entry.staff}>
                      {entry.staff}
                    </td>
                    <td className='px-0.5 py-1 text-gray-900 truncate' title={entry.payment_mode || 'No payment mode'}>
                      {entry.payment_mode && String(entry.payment_mode).trim() ? (entry.payment_mode === 'Online' ? 'Double' : entry.payment_mode === 'Bank Transfer' ? 'Bank' : String(entry.payment_mode).trim()) : '-'}
                    </td>
                    <td className='px-0.5 py-1 text-gray-900 truncate' title={entry.user}>
                      {entry.user}
                    </td>
                    <td className='px-0.5 py-1 text-gray-500 font-medium'>
                      {format(new Date(entry.entryTime), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className='mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border'>
            <div className='bg-green-100 p-3 rounded-lg'>
              <div className='text-sm font-medium text-green-800'>
                Total Credit:
              </div>
              <div className='text-lg font-bold text-green-900'>
                {totals.totalCredit.toLocaleString()}
              </div>
            </div>
            <div className='bg-red-100 p-3 rounded-lg'>
                <div className='text-sm font-medium text-red-800'>
                  Total Debit:
                </div>
                <div className='text-lg font-bold text-red-900'>
{totals.totalDebit.toLocaleString()}
                </div>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  totals.balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    totals.balance >= 0 ? 'text-blue-800' : 'text-orange-800'
                  }`}
                >
                  Balance:
                </div>
                <div
                  className={`text-lg font-bold ${
                    totals.balance >= 0 ? 'text-blue-900' : 'text-orange-900'
                  }`}
                >
{Math.abs(totals.balance).toLocaleString()}
                  {totals.balance >= 0 ? ' CR' : ' DR'}
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Progress Indicator */}
        {isLoadingAll && loadingProgress.total > 0 && (
          <div className='text-center py-4'>
            <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto'>
              <div className='text-sm text-blue-800 mb-2'>{loadingProgress.message}</div>
              <div className='w-full bg-blue-200 rounded-full h-2 mb-2'>
                <div 
                  className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className='text-xs text-blue-600'>
                {loadingProgress.current.toLocaleString()} / {loadingProgress.total.toLocaleString()} records
              </div>
            </div>
          </div>
        )}

        {/* Load More and Load All Buttons */}
        <div className='text-center py-4 space-x-4'>
          {ledgerEntries.length < totalEntries && (
            <Button
              onClick={loadMoreEntries}
              disabled={isLoadingMore || isLoadingAll}
              variant='secondary'
              icon={isLoadingMore ? RefreshCw : Plus}
              className='min-w-[200px]'
            >
              {isLoadingMore ? 'Loading...' : `Load More (${totalEntries - ledgerEntries.length} remaining)`}
            </Button>
          )}
          
          {ledgerEntries.length < totalEntries && (
            <Button
              onClick={loadAllEntries}
              disabled={isLoadingMore || isLoadingAll}
              variant='primary'
              icon={isLoadingAll ? RefreshCw : Database}
              className='min-w-[200px]'
            >
              {isLoadingAll ? 'Loading All...' : `Load All ${totalEntries} Records`}
            </Button>
          )}
        </div>
        
        {/* Pagination Info */}
        {totalEntries > 0 && (
          <div className='text-center text-sm text-gray-600 py-2'>
            Showing {ledgerEntries.length} of {totalEntries} entries
          </div>
        )}
      </Card>

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-6 no-print'>
                <h3 className='text-lg font-semibold'>
                  Print Preview - Detailed Ledger
                </h3>
                <div className='flex items-center gap-2'>
                  <Button 
                    size='sm' 
                    onClick={() => {
                      const entriesToPrint = printAllEntries ? ledgerEntries : filteredEntries;
                      if (entriesToPrint.length === 0) {
                        toast.error('No entries to print');
                        return;
                      }

                      const printWindow = window.open('', '_blank');
                      if (!printWindow) {
                        toast.error('Please allow popups to print');
                        return;
                      }

                      const printContent = generatePrintContent(entriesToPrint, printAllEntries);
                      printWindow.document.write(printContent);
                      printWindow.document.close();
                      printWindow.focus();

                      // Wait for content to load then print
                      setTimeout(() => {
                        printWindow.print();
                        // Don't close immediately, let user see the print dialog
                      }, 500);
                    }}
                  >
                    Print
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => setShowPrintPreview(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Print Styles */}
              <style>{`
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 0.02cm 0.3cm 0.3cm 0.3cm;
                  }
                  * {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    box-sizing: border-box;
                  }
                  html {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    background: white !important;
                    overflow: hidden !important;
                  }
                  body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    max-width: 100% !important;
                    max-height: 100% !important;
                    background: white !important;
                    overflow: hidden !important;
                    position: relative !important;
                  }
                  /* Hide everything on the page except the modal */
                  body > *:not(.fixed.inset-0),
                  #root > *:not(.fixed.inset-0),
                  [id^="root"] > *:not(.fixed.inset-0) {
                    display: none !important;
                    visibility: hidden !important;
                  }
                  
                  /* Make modal overlay full page for printing */
                  .fixed.inset-0 {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    background: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    z-index: 999999 !important;
                    display: block !important;
                    overflow: visible !important;
                  }
                  
                  /* Show all containers inside modal */
                  .fixed.inset-0 > div {
                    display: block !important;
                    visibility: visible !important;
                    width: 100% !important;
                    height: auto !important;
                    background: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  
                  .fixed.inset-0 .bg-white {
                    position: static !important;
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    max-width: 100% !important;
                    max-height: none !important;
                    overflow: visible !important;
                    background: white !important;
                    display: block !important;
                    visibility: visible !important;
                  }
                  
                  /* Remove padding from inner div */
                  .fixed.inset-0 .p-6 {
                    padding: 0 !important;
                    margin: 0 !important;
                    display: block !important;
                    visibility: visible !important;
                  }
                  
                  /* Hide buttons and UI elements */
                  .no-print,
                  button,
                  .flex.items-center,
                  .flex.items-center.justify-between,
                  h3 {
                    display: none !important;
                    visibility: hidden !important;
                  }
                  
                  /* Show print-content and ALL its children */
                  .print-content {
                    display: block !important;
                    visibility: visible !important;
                    position: relative !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    height: auto !important;
                    overflow: visible !important;
                    font-family: Arial, sans-serif !important;
                  }
                  
                  /* Ensure all print-content children are visible */
                  .print-content * {
                    visibility: visible !important;
                  }
                  
                  /* Ensure tables are visible */
                  .print-content table {
                    display: table !important;
                    visibility: visible !important;
                    width: 100% !important;
                  }
                  
                  .print-content thead {
                    display: table-header-group !important;
                    visibility: visible !important;
                  }
                  
                  .print-content tbody {
                    display: table-row-group !important;
                    visibility: visible !important;
                  }
                  
                  .print-content tr {
                    display: table-row !important;
                    visibility: visible !important;
                  }
                  
                  .print-content td,
                  .print-content th {
                    display: table-cell !important;
                    visibility: visible !important;
                  }
                  
                  .print-content div {
                    display: block !important;
                    visibility: visible !important;
                  }
                  
                  /* Ensure page divs are visible */
                  .print-content > div,
                  .print-page {
                    display: block !important;
                    visibility: visible !important;
                    width: 100% !important;
                  }
                  /* Step 7: Table elements - explicit display values */
                  .print-content table,
                  .print-content .print-table {
                    display: table !important;
                    visibility: visible !important;
                    width: 100% !important;
                    border-collapse: collapse !important;
                  }
                  .print-content thead {
                    display: table-header-group !important;
                    visibility: visible !important;
                  }
                  .print-content tbody {
                    display: table-row-group !important;
                    visibility: visible !important;
                  }
                  .print-content tr {
                    display: table-row !important;
                    visibility: visible !important;
                  }
                  .print-content td,
                  .print-content th {
                    display: table-cell !important;
                    visibility: visible !important;
                  }
                  
                  /* Step 8: Show thead only on first page */
                  .print-content .print-page:first-child .print-table thead,
                  .print-content .print-page[data-page-index="0"] .print-table thead {
                    display: table-header-group !important;
                    visibility: visible !important;
                  }
                  /* Hide thead on continuation pages */
                  .print-content .print-table.no-header-table thead,
                  .print-content .print-page:not(:first-child) .print-table thead,
                  .print-content .print-page[data-page-index]:not([data-page-index="0"]) .print-table thead {
                    display: none !important;
                    visibility: hidden !important;
                  }
                  /* Step 9: Text elements */
                  .print-content h1,
                  .print-content h2,
                  .print-content h3,
                  .print-content h4 {
                    display: block !important;
                    visibility: visible !important;
                  }
                  .print-content p {
                    display: block !important;
                    visibility: visible !important;
                  }
                  .print-content span {
                    display: inline !important;
                    visibility: visible !important;
                  }
                  .print-content div {
                    display: block !important;
                    visibility: visible !important;
                  }
                  /* FINAL OVERRIDE: Ensure ALL print-content elements are visible */
                  .print-content,
                  .print-content *,
                  .print-content * *,
                  .print-content * * *,
                  .print-content * * * *,
                  .print-content * * * * * {
                    visibility: visible !important;
                  }
                  /* Ensure proper display for all elements */
                  .print-content div {
                    display: block !important;
                    visibility: visible !important;
                  }
                  .print-content table {
                    display: table !important;
                    visibility: visible !important;
                  }
                  .print-content thead {
                    display: table-header-group !important;
                    visibility: visible !important;
                  }
                  .print-content tbody {
                    display: table-row-group !important;
                    visibility: visible !important;
                  }
                  .print-content tr {
                    display: table-row !important;
                    visibility: visible !important;
                  }
                  .print-content td,
                  .print-content th {
                    display: table-cell !important;
                    visibility: visible !important;
                  }
                  /* Ensure page divs are visible */
                  .print-content > div {
                    display: block !important;
                    visibility: visible !important;
                    width: 100% !important;
                    height: auto !important;
                    page-break-after: always !important;
                  }
                  .print-content > div:last-child {
                    page-break-after: auto !important;
                  }
                  .print-page {
                    display: block !important;
                    visibility: visible !important;
                  }
                  /* Text elements */
                  .print-content h1,
                  .print-content h2,
                  .print-content h3 {
                    display: block !important;
                    visibility: visible !important;
                  }
                  .print-content p,
                  .print-content span {
                    display: inline !important;
                    visibility: visible !important;
                  }
                  /* Ensure all nested elements are visible */
                  .print-content * * {
                    visibility: visible !important;
                  }
                  .print-content * * * {
                    visibility: visible !important;
                  }
                  .print-content * * * * {
                    visibility: visible !important;
                  }
                  /* Force ALL children to be visible */
                  .print-content * {
                    visibility: visible !important;
                  }
                  /* Ensure page divs respect page boundaries */
                  .print-content > div {
                    display: block !important;
                    visibility: visible !important;
                    position: relative !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: auto !important;
                    min-height: 0 !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    box-sizing: border-box !important;
                    /* Ensure content fits within page */
                    overflow-x: hidden !important;
                    overflow-y: visible !important;
                  }
                  .print-content > div:last-child {
                    page-break-after: auto !important;
                    break-after: auto !important;
                  }
                  .print-page {
                    display: block !important;
                    visibility: visible !important;
                    width: 100% !important;
                    max-width: 100% !important;
                  }
                  /* Ensure tables are visible and properly displayed */
                  .print-content table {
                    display: table !important;
                    visibility: visible !important;
                    width: 100% !important;
                  }
                  .print-content thead {
                    display: table-header-group !important;
                    visibility: visible !important;
                  }
                  .print-content tbody {
                    display: table-row-group !important;
                    visibility: visible !important;
                  }
                  .print-content tr {
                    display: table-row !important;
                    visibility: visible !important;
                  }
                  .print-content td,
                  .print-content th {
                    display: table-cell !important;
                    visibility: visible !important;
                  }
                  /* OVERRIDE ANY RULE THAT MIGHT HIDE CONTENT - MUST BE LAST */
                  .print-content,
                  .print-content *,
                  .print-content * *,
                  .print-content * * *,
                  .print-content * * * *,
                  .print-content * * * * * {
                    visibility: visible !important;
                    display: revert !important;
                  }
                  .print-content table {
                    display: table !important;
                  }
                  .print-content thead {
                    display: table-header-group !important;
                  }
                  .print-content tbody {
                    display: table-row-group !important;
                  }
                  .print-content tr {
                    display: table-row !important;
                  }
                  .print-content td,
                  .print-content th {
                    display: table-cell !important;
                  }
                  .print-content div {
                    display: block !important;
                  }
                  .print-content span,
                  .print-content p,
                  .print-content h1,
                  .print-content h2,
                  .print-content h3 {
                    display: block !important;
                  }
                  /* Disable browser's automatic table header repetition */
                  table {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  /* Prevent thead repetition - critical for print */
                  thead {
                    display: table-header-group !important;
                  }
                  /* Explicitly prevent header repetition on continuation pages */
                  .print-page:not(:first-child) table thead,
                  .print-page[data-page-index]:not([data-page-index="0"]) table thead,
                  .print-table.no-header thead {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    line-height: 0 !important;
                    font-size: 0 !important;
                  }
                  .print-page:not(:first-child) table thead tr,
                  .print-page[data-page-index]:not([data-page-index="0"]) table thead tr,
                  .print-table.no-header thead tr {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                  }
                  .print-page:not(:first-child) table thead th,
                  .print-page[data-page-index]:not([data-page-index="0"]) table thead th,
                  .print-table.no-header thead th {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                    font-size: 0 !important;
                    line-height: 0 !important;
                    width: 0 !important;
                  }
                  /* Consolidated print-content rules - use relative positioning for print */
                  .print-content {
                    position: relative !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    font-family: Arial, sans-serif !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    display: block !important;
                    visibility: visible !important;
                    height: auto !important;
                    overflow: visible !important;
                  }
                  .print-content > div:first-child {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                  }
                  /* Ensure no duplication - each page appears exactly once */
                  .print-content > div {
                    display: block !important;
                    position: relative !important;
                    page-break-after: always !important;
                  }
                  .print-content > div:last-child {
                    page-break-after: auto !important;
                  }
                  /* Ensure first page has no top spacing */
                  .print-page:first-child {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                  }
                  .print-page:first-child .print-page-header:first-child {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                  }
                  .print-page:first-child h1 {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                  }
                  /* Hide summary boxes on continuation pages - ensure they don't appear */
                  .print-page:not(:first-child) .summary-section,
                  .print-page[data-page-index]:not([data-page-index="0"]) .summary-section,
                  .print-page:not(:first-child) .summary-boxes,
                  .print-page[data-page-index]:not([data-page-index="0"]) .summary-boxes {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  /* Hide summary boxes on continuation pages - alternative selectors */
                  .print-page:not(:first-child) .print-page-header:has(> div[style*="gridTemplateColumns"]),
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-page-header:has(> div[style*="gridTemplateColumns"]) {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    overflow: hidden !important;
                  }
                  /* Alternative selector for summary boxes */
                  .print-page:not(:first-child) .print-page-header > div[style*="gridTemplateColumns"],
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-page-header > div[style*="gridTemplateColumns"] {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    overflow: hidden !important;
                  }
                  /* Ensure continuation header is minimal */
                  .continuation-header {
                    margin-bottom: 3px !important;
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                    padding-bottom: 2px !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .print-page {
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    display: block !important;
                    width: 100% !important;
                    min-height: 0 !important;
                    overflow: visible !important;
                    position: relative !important;
                  }
                  /* Prevent page duplication */
                  .print-page::before,
                  .print-page::after {
                    content: none !important;
                    display: none !important;
                  }
                  /* Ensure each page appears only once - show all divs with data-page-index */
                  .print-content > div[data-page-index] {
                    display: block !important;
                    visibility: visible !important;
                  }
                  .print-content > div.print-page {
                    display: block !important;
                    visibility: visible !important;
                  }
                  /* Don't hide divs - they might be page containers */
                  .print-content > div {
                    display: block !important;
                    visibility: visible !important;
                  }
                  .print-page:last-child {
                    page-break-after: auto !important;
                    break-after: auto !important;
                  }
                  .print-page-header {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                    margin-bottom: 5px !important;
                    margin-top: 0 !important;
                    padding-bottom: 3px !important;
                    padding-top: 0 !important;
                  }
                  .print-page:first-child .print-page-header:first-child {
                    margin-top: 0 !important;
                    padding-top: 0 !important;
                  }
                  .print-page-footer {
                    page-break-before: avoid !important;
                    break-before: avoid !important;
                    margin-top: 8px !important;
                    padding-top: 5px !important;
                  }
                  .print-table {
                    width: 100% !important;
                    max-width: 100% !important;
                    font-size: 11px !important;
                    border-collapse: collapse !important;
                    border-spacing: 0 !important;
                    table-layout: fixed !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    page-break-inside: auto !important;
                    /* Disable browser's automatic header repetition */
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    /* Prevent table from breaking layout */
                    display: table !important;
                    empty-cells: show !important;
                    /* Ensure table fits page width */
                    box-sizing: border-box !important;
                    /* Prevent overflow */
                    overflow: visible !important;
                    /* Fit within page margins */
                    min-width: 0 !important;
                  }
                  /* Prevent browser from repeating table headers - critical for print */
                  .print-table.no-header-table {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  /* Explicitly tell browser not to repeat headers on continuation pages */
                  .print-page:not(:first-child) table,
                  .print-page[data-page-index]:not([data-page-index="0"]) table {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  /* CRITICAL: Ensure no thead exists on continuation pages - browsers can't repeat what doesn't exist */
                  .print-table.no-header-table thead,
                  .print-page:not(:first-child) .print-table thead,
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-table thead {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    font-size: 0 !important;
                    line-height: 0 !important;
                    position: absolute !important;
                    left: -9999px !important;
                    width: 0 !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                  }
                  /* Prevent browser from creating thead automatically */
                  .print-table.no-header-table::before,
                  .print-table.no-header-table::after {
                    content: none !important;
                  }
                  /* Critical: Disable thead repetition on continuation pages */
                  .print-table.no-header,
                  .print-table.no-header-table {
                    border-collapse: collapse !important;
                  }
                  .print-table.no-header thead,
                  .print-table.no-header-table thead {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    overflow: hidden !important;
                  }
                  /* Ensure no-header-table has no thead at all */
                  .print-table.no-header-table thead,
                  .print-table.no-header-table > thead {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    font-size: 0 !important;
                    line-height: 0 !important;
                  }
                  /* Disable browser's automatic table header repetition */
                  thead {
                    display: table-header-group !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  /* Explicitly hide thead on continuation pages - multiple selectors for maximum compatibility */
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-table thead,
                  .print-page:not(:first-child) .print-table thead,
                  .print-page:nth-child(n+2) .print-table thead {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 0 !important;
                    font-size: 0 !important;
                    border: none !important;
                  }
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-table thead tr,
                  .print-page:not(:first-child) .print-table thead tr,
                  .print-page:nth-child(n+2) .print-table thead tr {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-table thead th,
                  .print-page:not(:first-child) .print-table thead th,
                  .print-page:nth-child(n+2) .print-table thead th {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                    font-size: 0 !important;
                    line-height: 0 !important;
                  }
                  /* Only show thead on first page */
                  .print-page:first-child .print-table thead,
                  .print-page[data-page-index="0"] .print-table thead {
                    display: table-header-group !important;
                    visibility: visible !important;
                  }
                  .print-table thead {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                  }
                  /* Additional aggressive rules to prevent browser header repetition */
                  .print-page:not(:first-child) .print-table::before {
                    content: "" !important;
                    display: none !important;
                  }
                  /* Ensure no thead exists on continuation pages - remove from layout completely */
                  .print-page[data-page-index]:not([data-page-index="0"]) .print-table > thead,
                  .print-page:not(:first-child) .print-table > thead,
                  .print-table.no-header > thead {
                    position: absolute !important;
                    left: -9999px !important;
                    width: 0 !important;
                    height: 0 !important;
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    font-size: 0 !important;
                    line-height: 0 !important;
                  }
                  /* Prevent browser from creating thead automatically */
                  .print-table.no-header {
                    border-collapse: separate !important;
                  }
                  /* Force remove thead from print layout on continuation pages */
                  @supports (display: table) {
                    .print-table.no-header thead {
                      display: none !important;
                    }
                  }
                  .print-table tbody {
                    display: table-row-group !important;
                    page-break-inside: auto !important;
                    /* Ensure tbody doesn't break awkwardly */
                    orphans: 3 !important;
                    widows: 3 !important;
                  }
                  /* Prevent table from breaking across pages inappropriately */
                  .print-table {
                    orphans: 3 !important;
                    widows: 3 !important;
                  }
                  .print-table tr {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-after: auto !important;
                    break-after: auto !important;
                    height: auto !important;
                    min-height: 12px !important;
                    max-height: none !important;
                    display: table-row !important;
                    border-collapse: collapse !important;
                    /* Prevent row from being cut */
                    orphans: 3 !important;
                    widows: 3 !important;
                  }
                  .print-table tbody tr {
                    border-top: 1px solid #000 !important;
                    border-bottom: 1px solid #000 !important;
                  }
                  .print-table th,
                  .print-table td {
                    padding: 4px 3px !important;
                    border-left: 1px solid #000 !important;
                    border-right: 1px solid #000 !important;
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                    hyphens: auto !important;
                    line-height: 1.2 !important;
                    vertical-align: top !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    display: table-cell !important;
                    position: relative !important;
                    /* Prevent cell content from breaking layout */
                    overflow: visible !important;
                    text-overflow: clip !important;
                    /* Ensure cells respect fixed width */
                    box-sizing: border-box !important;
                    max-width: 100% !important;
                    /* Allow text to wrap naturally */
                    white-space: normal !important;
                  }
                  .print-table th:first-child,
                  .print-table td:first-child {
                    border-left: 1px solid #000 !important;
                  }
                  .print-table th:last-child,
                  .print-table td:last-child {
                    border-right: 1px solid #000 !important;
                  }
                  .print-table th {
                    background-color: #e5e5e5 !important;
                    font-weight: bold !important;
                    font-size: 11px !important;
                    text-align: left !important;
                    position: relative !important;
                  }
                  .print-table td {
                    font-weight: bold !important;
                    font-size: 11px !important;
                  }
                  .print-table .col-particulars {
                    word-break: break-word !important;
                    overflow-wrap: break-word !important;
                    white-space: normal !important;
                    line-height: 1.3 !important;
                    /* Ensure long text wraps properly */
                    min-width: 0 !important;
                    max-width: 100% !important;
                  }
                  .print-table .col-company,
                  .print-table .col-account,
                  .print-table .col-subaccount,
                  .print-table .col-staff,
                  .print-table .col-user,
                  .print-table .col-payment {
                    white-space: normal !important;
                    word-break: break-word !important;
                    overflow-wrap: break-word !important;
                    /* Prevent column shifting */
                    min-width: 0 !important;
                    max-width: 100% !important;
                  }
                  /* Ensure numeric columns don't wrap */
                  .print-table .col-sno,
                  .print-table .col-credit,
                  .print-table .col-debit,
                  .print-table .col-saleqty,
                  .print-table .col-purchaseqty {
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                  }
                  /* Fixed column widths - prevent shifting */
                  .print-table .col-sno { 
                    width: 3% !important; 
                    min-width: 3% !important;
                    max-width: 3% !important;
                    text-align: center !important; 
                  }
                  .print-table .col-date { 
                    width: 8% !important; 
                    min-width: 8% !important;
                    max-width: 8% !important;
                  }
                  .print-table .col-company { 
                    width: 15% !important; 
                    min-width: 15% !important;
                    max-width: 15% !important;
                  }
                  .print-table .col-account { 
                    width: 15% !important; 
                    min-width: 15% !important;
                    max-width: 15% !important;
                  }
                  .print-table .col-subaccount { 
                    width: 12% !important; 
                    min-width: 12% !important;
                    max-width: 12% !important;
                  }
                  .print-table .col-particulars { 
                    width: 27% !important; 
                    min-width: 27% !important;
                    max-width: 27% !important;
                  }
                  .print-table .col-purchaseqty { 
                    width: 5% !important; 
                    min-width: 5% !important;
                    max-width: 5% !important;
                    text-align: center !important; 
                  }
                  .print-table .col-saleqty { 
                    width: 5% !important; 
                    min-width: 5% !important;
                    max-width: 5% !important;
                    text-align: center !important; 
                  }
                  .print-table .col-credit { 
                    width: 5% !important; 
                    min-width: 5% !important;
                    max-width: 5% !important;
                    text-align: right !important; 
                  }
                  .print-table .col-debit { 
                    width: 5% !important; 
                    min-width: 5% !important;
                    max-width: 5% !important;
                    text-align: right !important; 
                  }
                }
                @media screen {
                  .print-content {
                    display: block;
                    margin: 0;
                    padding: 0;
                  }
                  .print-table {
                    width: 100%;
                    font-size: 12px;
                  }
                  .print-table th,
                  .print-table td {
                    font-weight: bold !important;
                    font-size: 12px !important;
                  }
                  .print-page {
                    margin-bottom: 20px;
                    border: 1px dashed #ccc;
                    padding: 10px;
                  }
                  .print-page-header {
                    margin-bottom: 5px;
                    margin-top: 0;
                    padding-bottom: 3px;
                    padding-top: 0;
                  }
                  .print-page:first-child .print-page-header:first-child {
                    margin-top: 0;
                    padding-top: 0;
                  }
                  
                  /* FINAL OVERRIDE: Force visibility on ALL modal and print-content elements */
                  .fixed.inset-0,
                  .fixed.inset-0 *,
                  .fixed.inset-0 * *,
                  .fixed.inset-0 * * *,
                  .fixed.inset-0 * * * *,
                  .fixed.inset-0 * * * * *,
                  .fixed.inset-0 * * * * * * {
                    visibility: visible !important;
                  }
                  .print-content,
                  .print-content *,
                  .print-content * *,
                  .print-content * * *,
                  .print-content * * * *,
                  .print-content * * * * * {
                    visibility: visible !important;
                  }
                  /* Explicit display values for all print-content elements */
                  .print-content {
                    display: block !important;
                  }
                  .print-content div {
                    display: block !important;
                  }
                  .print-content table {
                    display: table !important;
                  }
                  .print-content thead {
                    display: table-header-group !important;
                  }
                  .print-content tbody {
                    display: table-row-group !important;
                  }
                  .print-content tr {
                    display: table-row !important;
                  }
                  .print-content td,
                  .print-content th {
                    display: table-cell !important;
                  }
                  .print-content h1,
                  .print-content h2,
                  .print-content h3,
                  .print-content h4 {
                    display: block !important;
                  }
                  .print-content p {
                    display: block !important;
                  }
                  .print-content span {
                    display: inline !important;
                  }
                }
              `}</style>

              {/* Print Content */}
              <div className='print-content print:block'>
                {/* Transactions Table - Split into pages of 25 rows */}
                {(() => {
                  // Use all entries if printAllEntries is true, otherwise use filtered entries
                  const entriesToPrint = printAllEntries ? ledgerEntries : filteredEntries;
                  
                  // Calculate totals for print preview
                  const totalCredit = entriesToPrint.reduce((s, e) => s + (e.credit || 0), 0);
                  const totalDebit = entriesToPrint.reduce((s, e) => s + (e.debit || 0), 0);
                  const totalSaleQty = entriesToPrint.reduce((s, e) => s + (e.saleQuantity || 0), 0);
                  const totalPurchaseQty = entriesToPrint.reduce((s, e) => s + (e.purchaseQuantity || 0), 0);
                  const printTotals = {
                    totalCredit,
                    totalDebit,
                    totalSaleQty,
                    totalPurchaseQty,
                    balance: totalCredit - totalDebit,
                    quantityBalance: totalPurchaseQty - totalSaleQty,
                  };
                  
                  const rowsPerPage = 50;
                  const totalPages = Math.ceil(entriesToPrint.length / rowsPerPage);
                  const pages = [];
                  
                  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                    const startIndex = pageIndex * rowsPerPage;
                    const endIndex = Math.min(startIndex + rowsPerPage, entriesToPrint.length);
                    const pageEntries = entriesToPrint.slice(startIndex, endIndex);
                    const isLastPage = pageIndex === totalPages - 1;
                    
                    pages.push(
                      <div key={pageIndex} className={!isLastPage ? 'print-page' : ''} data-page-index={pageIndex}>
                        {/* Main Header - Only on first page */}
                        {pageIndex === 0 && (
                          <>
                            <div className='print-page-header' style={{ marginBottom: '4px', marginTop: '0', paddingTop: '0', textAlign: 'center' }}>
                              <h1 style={{ fontSize: '20px', margin: '0 0 1px 0', paddingTop: '0', fontWeight: 'bold', lineHeight: '1.1' }}>
                                Thirumala Group
                              </h1>
                              <h2 style={{ fontSize: '18px', margin: '1px 0', fontWeight: 'bold', lineHeight: '1.1' }}>
                                Detailed Ledger Report {printAllEntries ? '(All Records)' : ''}
                              </h2>
                              <p style={{ fontSize: '13px', margin: '1px 0', lineHeight: '1.2', fontWeight: 'bold' }}>
                                {printAllEntries ? 'All Records' : `From ${format(new Date(filters.fromDate), 'dd/MM/yyyy')} to ${format(new Date(filters.toDate), 'dd/MM/yyyy')}`}
                              </p>
                              {!printAllEntries && (
                                <div style={{ fontSize: '12px', marginTop: '3px', fontWeight: 'bold' }}>
                                  {filters.companyName && (
                                    <span style={{ marginRight: '15px' }}>
                                      Company: <strong>{filters.companyName}</strong>
                                    </span>
                                  )}
                                  {filters.mainAccount && (
                                    <span>
                                      Account: <strong>{filters.mainAccount}</strong>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>


                            {/* Additional Filter Info - Only on first page */}
                            {!printAllEntries && (filters.subAccount || filters.staffwise || filters.user || filters.paymentMode) && (
                              <div className='print-page-header' style={{ marginBottom: '5px', fontSize: '10px', padding: '5px', backgroundColor: '#f5f5f5' }}>
                                {filters.subAccount && <span style={{ marginRight: '15px' }}>Sub Account: <strong>{filters.subAccount}</strong></span>}
                                {filters.staffwise && <span style={{ marginRight: '15px' }}>Staff: <strong>{filters.staffwise}</strong></span>}
                                {filters.user && <span style={{ marginRight: '15px' }}>User: <strong>{filters.user}</strong></span>}
                                {filters.paymentMode && <span>Payment Mode: <strong>{filters.paymentMode}</strong></span>}
                              </div>
                            )}
                          </>
                        )}

                        {/* Page Header for continuation pages - minimal */}
                        {pageIndex > 0 && (
                          <div className='print-page-header continuation-header' style={{ marginBottom: '3px', marginTop: '0', paddingTop: '0', fontSize: '11px', textAlign: 'center', color: '#666', fontWeight: 'bold' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>Thirumala Group - Detailed Ledger Report (Continued)</div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Page {pageIndex + 1} of {totalPages}</div>
                          </div>
                        )}
                        {pageIndex === 0 ? (
                          <table className='print-table'>
                            <thead>
                              <tr className='bg-gray-100'>
                                <th className='col-sno text-left font-bold text-sm'>S.No</th>
                                <th className='col-date text-left font-bold text-sm'>Date</th>
                                <th className='col-company text-left font-bold text-sm'>Company</th>
                                <th className='col-account text-left font-bold text-sm'>Account</th>
                                <th className='col-subaccount text-left font-bold text-sm'>Sub Account</th>
                                <th className='col-particulars text-left font-bold text-sm'>Particulars</th>
                                <th className='col-purchaseqty text-center font-bold text-sm'>Purchase Qty</th>
                                <th className='col-saleqty text-center font-bold text-sm'>Sale Qty</th>
                                <th className='col-credit text-right font-bold text-sm'>Credit</th>
                                <th className='col-debit text-right font-bold text-sm'>Debit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageEntries.map((entry, localIndex) => {
                                const globalIndex = startIndex + localIndex;
                                return (
                                  <tr key={entry.id}>
                                    <td className='col-sno font-bold text-sm'>{globalIndex + 1}</td>
                                    <td className='col-date font-bold text-sm'>{format(new Date(entry.date), 'dd/MM/yyyy')}</td>
                                    <td className='col-company font-bold text-sm'>{entry.companyName}</td>
                                    <td className='col-account font-bold text-sm'>{entry.accountName}</td>
                                    <td className='col-subaccount font-bold text-sm'>{entry.subAccount || '-'}</td>
                                    <td className='col-particulars font-bold text-sm' title={entry.particulars}>{entry.particulars}</td>
                                    <td className='col-purchaseqty text-center font-bold text-sm'>
                                      {entry.purchaseQuantity > 0 ? entry.purchaseQuantity.toLocaleString() : '-'}
                                    </td>
                                    <td className='col-saleqty text-center font-bold text-sm'>
                                      {entry.saleQuantity > 0 ? entry.saleQuantity.toLocaleString() : '-'}
                                    </td>
                                    <td className='col-credit text-right font-bold text-sm'>
                                      {entry.credit > 0 ? `${entry.credit.toLocaleString()}` : '-'}
                                    </td>
                                    <td className='col-debit text-right font-bold text-sm'>
                                      {entry.debit > 0 ? `${entry.debit.toLocaleString()}` : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                              {isLastPage && (
                                <>
                                  <tr className='bg-gray-200 font-bold'>
                                    <td colSpan={6} className='text-right font-bold text-sm' style={{ padding: '4px' }}>TOTAL:</td>
                                    <td className='text-center font-bold text-sm' style={{ padding: '4px' }}>
                                      {printTotals.totalPurchaseQty > 0 ? printTotals.totalPurchaseQty.toLocaleString() : '-'}
                                    </td>
                                    <td className='text-center font-bold text-sm' style={{ padding: '4px' }}>
                                      {printTotals.totalSaleQty > 0 ? printTotals.totalSaleQty.toLocaleString() : '-'}
                                    </td>
                                    <td className='text-right font-bold text-sm' style={{ padding: '4px' }}>
{printTotals.totalCredit.toLocaleString()}
                                    </td>
                                    <td className='text-right font-bold text-sm' style={{ padding: '4px' }}>
{printTotals.totalDebit.toLocaleString()}
                                    </td>
                                  </tr>
                                  <tr className='bg-gray-300'>
                                    <td colSpan={6} className='text-right font-bold text-sm' style={{ padding: '4px' }}>QUANTITY BALANCE:</td>
                                    <td colSpan={1} className='text-center font-bold text-sm' style={{ padding: '4px', color: printTotals.quantityBalance >= 0 ? '#059669' : '#dc2626' }}>
                                      {printTotals.quantityBalance > 0 ? printTotals.quantityBalance.toLocaleString() : printTotals.quantityBalance < 0 ? Math.abs(printTotals.quantityBalance).toLocaleString() : '-'} {printTotals.quantityBalance >= 0 ? 'CR' : printTotals.quantityBalance < 0 ? 'DR' : ''}
                                    </td>
                                    <td colSpan={1} className='text-right font-bold text-sm' style={{ padding: '4px' }}>BALANCE:</td>
                                    <td colSpan={2} className='text-center font-bold text-sm' style={{ padding: '4px', color: printTotals.balance >= 0 ? '#059669' : '#dc2626' }}>
{Math.abs(printTotals.balance).toLocaleString()} {printTotals.balance >= 0 ? 'CR' : 'DR'}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <table className='print-table no-header-table'>
                            <tbody>
                              {pageEntries.map((entry, localIndex) => {
                                const globalIndex = startIndex + localIndex;
                                return (
                                  <tr key={entry.id}>
                                    <td className='col-sno font-bold text-sm'>{globalIndex + 1}</td>
                                    <td className='col-date font-bold text-sm'>{format(new Date(entry.date), 'dd/MM/yyyy')}</td>
                                    <td className='col-company font-bold text-sm'>{entry.companyName}</td>
                                    <td className='col-account font-bold text-sm'>{entry.accountName}</td>
                                    <td className='col-subaccount font-bold text-sm'>{entry.subAccount || '-'}</td>
                                    <td className='col-particulars font-bold text-sm' title={entry.particulars}>{entry.particulars}</td>
                                    <td className='col-purchaseqty text-center font-bold text-sm'>
                                      {entry.purchaseQuantity > 0 ? entry.purchaseQuantity.toLocaleString() : '-'}
                                    </td>
                                    <td className='col-saleqty text-center font-bold text-sm'>
                                      {entry.saleQuantity > 0 ? entry.saleQuantity.toLocaleString() : '-'}
                                    </td>
                                    <td className='col-credit text-right font-bold text-sm'>
                                      {entry.credit > 0 ? `${entry.credit.toLocaleString()}` : '-'}
                                    </td>
                                    <td className='col-debit text-right font-bold text-sm'>
                                      {entry.debit > 0 ? `${entry.debit.toLocaleString()}` : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                              {isLastPage && (
                                <>
                                  <tr className='bg-gray-200 font-bold'>
                                    <td colSpan={6} className='text-right font-bold' style={{ padding: '4px' }}>TOTAL:</td>
                                    <td className='text-center font-bold' style={{ padding: '4px' }}>
                                      {printTotals.totalPurchaseQty > 0 ? printTotals.totalPurchaseQty.toLocaleString() : '-'}
                                    </td>
                                    <td className='text-center font-bold' style={{ padding: '4px' }}>
                                      {printTotals.totalSaleQty > 0 ? printTotals.totalSaleQty.toLocaleString() : '-'}
                                    </td>
                                    <td className='text-right font-bold' style={{ padding: '4px' }}>
{printTotals.totalCredit.toLocaleString()}
                                    </td>
                                    <td className='text-right font-bold' style={{ padding: '4px' }}>
{printTotals.totalDebit.toLocaleString()}
                                    </td>
                                  </tr>
                                  <tr className='bg-gray-300'>
                                    <td colSpan={6} className='text-right font-bold' style={{ padding: '4px' }}>QUANTITY BALANCE:</td>
                                    <td colSpan={1} className='text-center font-bold' style={{ padding: '4px', color: printTotals.quantityBalance >= 0 ? '#059669' : '#dc2626' }}>
                                      {printTotals.quantityBalance > 0 ? printTotals.quantityBalance.toLocaleString() : printTotals.quantityBalance < 0 ? Math.abs(printTotals.quantityBalance).toLocaleString() : '-'} {printTotals.quantityBalance >= 0 ? 'CR' : printTotals.quantityBalance < 0 ? 'DR' : ''}
                                    </td>
                                    <td colSpan={1} className='text-right font-bold' style={{ padding: '4px' }}>BALANCE:</td>
                                    <td colSpan={2} className='text-center font-bold' style={{ padding: '4px', color: printTotals.balance >= 0 ? '#059669' : '#dc2626' }}>
{Math.abs(printTotals.balance).toLocaleString()} {printTotals.balance >= 0 ? 'CR' : 'DR'}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        )}
                        {/* Page Footer */}
                        <div className='print-page-footer' style={{ textAlign: 'center', fontSize: '11px', marginTop: '8px', color: '#666', fontWeight: 'bold' }}>
                          Page {pageIndex + 1} of {totalPages}
                          {isLastPage && (
                            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #ccc', fontWeight: 'bold' }}>
                              Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')} by {user?.username} | Total Records: {entriesToPrint.length}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  return pages;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedLedger;
