import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import SearchableSelect from '../components/UI/SearchableSelect';
import { supabaseDB } from '../lib/supabaseDatabase';
import { useTableMode } from '../contexts/TableModeContext';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import { format } from 'date-fns';
import { Calendar, Search, AlertTriangle } from 'lucide-react';
import CustomCalendar from '../components/UI/CustomCalendar';
import { getSharedPrintStyles } from '../utils/print';
import { useBook } from '../contexts/BookContext';

interface LedgerSummaryFilters {
  betweenDates: boolean;
  fromDate: string;
  toDate: string;
  companyName: string;
  mainAccount: string;
  subAccount: string;
  staff: string;
}

interface AccountSummary {
  accountName: string;
  credit: number;
  debit: number;
  balance: number;
  transactionCount: number;
}

interface CompanySummary {
  companyName: string;
  totalCredit: number;
  totalDebit: number;
  balance: number;
  accounts: AccountSummary[];
}

interface SubAccountSummary {
  subAccount: string;
  mainAccount: string;
  companyName?: string;
  credit: number;
  debit: number;
  balance: number;
  transactionCount: number;
}

const LedgerSummary: React.FC = () => {
  const { mode: tableMode } = useTableMode();
  const { currentBook } = useBook();

  const [filters, setFilters] = useState<LedgerSummaryFilters>({
    betweenDates: true,
    fromDate: '2016-10-31',
    toDate: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    mainAccount: '',
    subAccount: '',
    staff: '',
  });

  const [companySummaries, setCompanySummaries] = useState<CompanySummary[]>(
    []
  );
  const [mainAccountSummaries, setMainAccountSummaries] = useState<
    AccountSummary[]
  >([]);
  const [subAccountSummaries, setSubAccountSummaries] = useState<
    SubAccountSummary[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'company' | 'mainAccount' | 'subAccount'
  >('company');
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const [allEntries, setAllEntries] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');

  // 1. Get entries within the date range (fromDate to toDate)
  const entriesInRange = useMemo(() => {
    if (!filters.betweenDates) return allEntries;
    const fromStr = filters.fromDate;
    const toStr = filters.toDate;
    return allEntries.filter(entry => {
      return entry.c_date >= fromStr && entry.c_date <= toStr;
    });
  }, [allEntries, filters.fromDate, filters.toDate, filters.betweenDates]);

  // 2. Companies in range
  const companyOptions = useMemo(() => {
    const distinctCompanies = [...new Set(entriesInRange.map(e => e.company_name).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Companies' },
      ...distinctCompanies.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange]);

  // 3. Accounts in range (filtered by selected company if any)
  const accountOptions = useMemo(() => {
    let filtered = entriesInRange;
    if (filters.companyName) {
      filtered = filtered.filter(e => e.company_name === filters.companyName);
    }
    const distinctAccounts = [...new Set(filtered.map(e => e.acc_name).filter(Boolean))].sort();
    return [
      { value: '', label: 'All Accounts' },
      ...distinctAccounts.map(name => ({ value: name, label: name }))
    ];
  }, [entriesInRange, filters.companyName]);

  // 4. Sub Accounts in range (filtered by selected company and main account)
  const subAccountOptions = useMemo(() => {
    let filtered = entriesInRange;
    if (filters.companyName) {
      filtered = filtered.filter(e => e.company_name === filters.companyName);
    }
    if (filters.mainAccount) {
      filtered = filtered.filter(e => e.acc_name === filters.mainAccount);
    }
    const distinctSubAccounts = [...new Set(filtered.map(e => e.sub_acc_name).filter(Boolean))].sort();
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

  // Visible dd/MM/yyyy inputs + hidden pickers
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');

  useEffect(() => {
    try {
      setFromDateInput(filters.fromDate ? format(new Date(filters.fromDate), 'dd/MM/yyyy') : '');
      setToDateInput(filters.toDate ? format(new Date(filters.toDate), 'dd/MM/yyyy') : '');
    } catch (e) {
      console.error('Error formatting date:', e);
    }
  }, [filters.fromDate, filters.toDate]);

  // Load all entries for calendar green dots
  useEffect(() => {
    const loadAllEntries = async () => {
      try {
        console.log('📅 Loading all entries for calendar, mode:', tableMode);
        const entries = await supabaseDB.getAllCashBookEntries();
        console.log('📅 Loaded entries for calendar:', entries.length);
        setAllEntries(entries);
      } catch (error) {
        console.error('Error loading entries for calendar:', error);
      }
    };
    loadAllEntries();
  }, [tableMode, currentBook?.id]);

  // Summary totals
  const [grandTotals, setGrandTotals] = useState({
    totalCredit: 0,
    totalDebit: 0,
    balance: 0,
    recordCount: 0,
  });

  useEffect(() => {
    generateSummary();
  }, [currentBook?.id]);

  // Implement live filtering: call generateSummary automatically when filters change
  useEffect(() => {
    generateSummary();
    // eslint-disable-next-line
  }, [filters, activeTab, currentBook?.id]);

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

      // 4. Staff
      if (newFilters.staff && !staffOptions.some(s => s.value === newFilters.staff)) {
        newFilters.staff = '';
        updated = true;
      }

      return updated ? newFilters : prev;
    });
  }, [companyOptions, accountOptions, subAccountOptions, staffOptions]);

  const generateSummary = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🔄 Generating summary with filters:', filters);

      // Fast server-side filtering with pagination disabled for summaries
      const { data } = await supabaseDB.getFilteredCashBookEntries({
        companyName: filters.companyName || undefined,
        accountName: filters.mainAccount || undefined,
        subAccountName: filters.subAccount || undefined,
      }, 100000, 0);
      let entries = data || [];
      
      console.log('📊 Loaded entries:', entries.length);

      // Apply date filter
      if (filters.betweenDates) {
        entries = entries.filter(entry => {
          const entryDate = new Date(entry.c_date);
          const fromDate = new Date(filters.fromDate);
          const toDate = new Date(filters.toDate);
          return entryDate >= fromDate && entryDate <= toDate;
        });
      }

      // Apply other filters
      if (filters.companyName) {
        entries = entries.filter(
          entry => entry.company_name === filters.companyName
        );
      }
      if (filters.mainAccount) {
        entries = entries.filter(
          entry => entry.acc_name === filters.mainAccount
        );
      }
      if (filters.subAccount) {
        entries = entries.filter(
          entry => entry.sub_acc_name === filters.subAccount
        );
      }
      if (filters.staff) {
        entries = entries.filter(entry => entry.staff === filters.staff);
      }

      // Generate company-wise summary
      const companyMap = new Map<string, CompanySummary>();
      const accountMap = new Map<string, AccountSummary>();
      const subAccountMap = new Map<string, SubAccountSummary>();
      
      // Create a map for main accounts with company names (for when no company filter is applied)
      const mainAccountWithCompanyMap = new Map<string, AccountSummary & { companyName: string }>();

      let totalCredit = 0;
      let totalDebit = 0;

      entries.forEach(entry => {
        totalCredit += entry.credit;
        totalDebit += entry.debit;

        // Company summary
        if (!companyMap.has(entry.company_name)) {
          companyMap.set(entry.company_name, {
            companyName: entry.company_name,
            totalCredit: 0,
            totalDebit: 0,
            balance: 0,
            accounts: [],
          });
        }
        const companySummary = companyMap.get(entry.company_name)!;
        companySummary.totalCredit += entry.credit;
        companySummary.totalDebit += entry.debit;
        companySummary.balance =
          companySummary.totalCredit - companySummary.totalDebit;

        // Account summary
        const accountKey = `${entry.company_name}-${entry.acc_name}`;
        if (!accountMap.has(accountKey)) {
          accountMap.set(accountKey, {
            accountName: entry.acc_name,
            credit: 0,
            debit: 0,
            balance: 0,
            transactionCount: 0,
          });
        }
        const accountSummary = accountMap.get(accountKey)!;
        accountSummary.credit += entry.credit;
        accountSummary.debit += entry.debit;
        accountSummary.balance = accountSummary.credit - accountSummary.debit;
        accountSummary.transactionCount++;

        // Main account with company name (for when no company filter is applied)
        // Use composite key to track each company's account separately
        if (!filters.companyName) {
          const mainAccountKey = `${entry.company_name}-${entry.acc_name}`;
          if (!mainAccountWithCompanyMap.has(mainAccountKey)) {
            mainAccountWithCompanyMap.set(mainAccountKey, {
              accountName: entry.acc_name,
              companyName: entry.company_name,
              credit: 0,
              debit: 0,
              balance: 0,
              transactionCount: 0,
            });
          }
          const mainAccountSummary = mainAccountWithCompanyMap.get(mainAccountKey)!;
          mainAccountSummary.credit += entry.credit;
          mainAccountSummary.debit += entry.debit;
          mainAccountSummary.balance = mainAccountSummary.credit - mainAccountSummary.debit;
          mainAccountSummary.transactionCount++;
        }

        // Sub Account summary
        if (entry.sub_acc_name) {
          const subAccountKey = `${entry.company_name}-${entry.acc_name}-${entry.sub_acc_name}`;
          if (!subAccountMap.has(subAccountKey)) {
            subAccountMap.set(subAccountKey, {
              subAccount: entry.sub_acc_name,
              mainAccount: entry.acc_name,
              companyName: entry.company_name,
              credit: 0,
              debit: 0,
              balance: 0,
              transactionCount: 0,
            });
          }
          const subAccountSummary = subAccountMap.get(subAccountKey)!;
          subAccountSummary.credit += entry.credit;
          subAccountSummary.debit += entry.debit;
          subAccountSummary.balance =
            subAccountSummary.credit - subAccountSummary.debit;
          subAccountSummary.transactionCount++;
        }
      });

      // Convert maps to arrays and sort
      const companySummariesArray = Array.from(companyMap.values()).sort(
        (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
      );

      // Create company-specific summaries when company filter is active
      let mainAccountSummariesArray: AccountSummary[] = [];
      let subAccountSummariesArray: SubAccountSummary[] = [];
      
      if (filters.companyName) {
        // When company filter is active, create summaries only for the selected company
        const companyAccountMap = new Map<string, AccountSummary>();
        const companySubAccountMap = new Map<string, SubAccountSummary>();
        
        // Process only entries for the selected company
        entries.forEach(entry => {
          if (entry.company_name === filters.companyName) {
            // Account summary for this company
            const accountKey = entry.acc_name;
            if (!companyAccountMap.has(accountKey)) {
              companyAccountMap.set(accountKey, {
                accountName: entry.acc_name,
                credit: 0,
                debit: 0,
                balance: 0,
                transactionCount: 0,
              });
            }
            const accountSummary = companyAccountMap.get(accountKey)!;
            accountSummary.credit += entry.credit;
            accountSummary.debit += entry.debit;
            accountSummary.balance = accountSummary.credit - accountSummary.debit;
            accountSummary.transactionCount++;
            
            // Sub Account summary for this company
            if (entry.sub_acc_name) {
              const subAccountKey = entry.sub_acc_name;
              if (!companySubAccountMap.has(subAccountKey)) {
                companySubAccountMap.set(subAccountKey, {
                  subAccount: entry.sub_acc_name,
                  mainAccount: entry.acc_name,
                  companyName: entry.company_name,
                  credit: 0,
                  debit: 0,
                  balance: 0,
                  transactionCount: 0,
                });
              }
              const subAccountSummary = companySubAccountMap.get(subAccountKey)!;
              subAccountSummary.credit += entry.credit;
              subAccountSummary.debit += entry.debit;
              subAccountSummary.balance = subAccountSummary.credit - subAccountSummary.debit;
              subAccountSummary.transactionCount++;
            }
          }
        });
        
        mainAccountSummariesArray = Array.from(companyAccountMap.values()).sort(
          (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
        );
        
        subAccountSummariesArray = Array.from(companySubAccountMap.values()).sort(
          (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
        );
      } else {
        // When no company filter, use main accounts with company names
        mainAccountSummariesArray = Array.from(mainAccountWithCompanyMap.values()).sort(
          (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
        );
        
        subAccountSummariesArray = Array.from(subAccountMap.values()).sort(
          (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
        );
      }

      console.log('📊 Company summaries:', companySummariesArray.length);
      console.log('📊 Main account summaries:', mainAccountSummariesArray.length);
      console.log('📊 Sub account summaries:', subAccountSummariesArray.length);
      
      setCompanySummaries(companySummariesArray);
      setMainAccountSummaries(mainAccountSummariesArray);
      setSubAccountSummaries(subAccountSummariesArray);

      setGrandTotals({
        totalCredit,
        totalDebit,
        balance: totalCredit - totalDebit,
        recordCount: entries.length,
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (
    field: keyof LedgerSummaryFilters,
    value: any
  ) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };
      if (field === 'companyName') {
        newFilters.mainAccount = '';
        newFilters.subAccount = '';
      }
      if (field === 'mainAccount') {
        newFilters.subAccount = '';
      }
      return newFilters;
    });
  };



  const handleRealPrint = () => {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    const fromFormatted = format(new Date(filters.fromDate), 'dd/MM/yyyy');
    const toFormatted = format(new Date(filters.toDate), 'dd/MM/yyyy');

    const currentData = getCurrentData();

    // Calculate totals for the current data
    const totals = currentData.reduce((acc, item) => {
      const credit = activeTab === 'company' ? (item as CompanySummary).totalCredit : 
                    (item as AccountSummary | SubAccountSummary).credit;
      const debit = activeTab === 'company' ? (item as CompanySummary).totalDebit : 
                   (item as AccountSummary | SubAccountSummary).debit;
      const balance = item.balance;
      
      acc.totalCredit += credit;
      acc.totalDebit += debit;
      acc.totalBalance += balance;
      acc.recordCount += 1;
      
      return acc;
    }, { totalCredit: 0, totalDebit: 0, totalBalance: 0, recordCount: 0 });

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #1f2937; font-size: 28px; font-weight: bold; }
            .header h2 { margin: 10px 0; color: #374151; font-size: 20px; font-weight: 600; }
            .header .company-name { margin: 5px 0; color: #1f2937; font-size: 18px; font-weight: bold; }
            .header .date-time { margin: 10px 0; color: #6b7280; font-size: 16px; font-weight: 500; }
            .header .period { margin: 5px 0; color: #374151; font-size: 14px; }
            .header .from-date { font-weight: bold; font-size: 16px; color: #1f2937; }
            .totals-section { margin: 20px 0; padding: 15px; background-color: #f8fafc; border: 2px solid #e5e7eb; border-radius: 8px; }
            .totals-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 10px; text-align: center; }
            .totals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
            .total-item { text-align: center; padding: 10px; background-color: white; border-radius: 6px; border: 1px solid #d1d5db; }
            .total-label { font-size: 14px; color: #6b7280; margin-bottom: 5px; }
            .total-value { font-size: 18px; font-weight: bold; color: #1f2937; }
            .total-value.credit { color: #059669; }
            .total-value.debit { color: #dc2626; }
            .total-value.balance { color: #1f2937; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f9fafb; font-weight: bold; }
            .text-right { text-align: right; }
            .text-green { color: #059669; }
            .text-red { color: #dc2626; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #6b7280; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              @page {
                size: portrait;
                margin: 8mm;
              }
            }
            ${getSharedPrintStyles({ isLandscape: false })}
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Thirumala Group</h1>
            <h2>Ledger Summary Report</h2>
            <div class="company-name">${filters.companyName || 'All Companies'}</div>
            <div class="period">Period: <strong>${fromFormatted}</strong> to <strong>${toFormatted}</strong></div>
          </div>

          <div class="totals-section">
            <div class="totals-title">Summary Totals</div>
            <div class="totals-grid">
              <div class="total-item">
                <div class="total-label">Total Credit</div>
                <div class="total-value credit">${totals.totalCredit.toLocaleString()}</div>
              </div>
              <div class="total-item">
                <div class="total-label">Total Debit</div>
                <div class="total-value debit">${totals.totalDebit.toLocaleString()}</div>
              </div>
              <div class="total-item">
                <div class="total-label">Net Balance</div>
                <div class="total-value balance">${Math.abs(totals.totalBalance).toLocaleString()} ${totals.totalBalance >= 0 ? 'CR' : 'DR'}</div>
              </div>
              <div class="total-item">
                <div class="total-label">Total Records</div>
                <div class="total-value">${totals.recordCount}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                ${activeTab === 'subAccount' ? 
                  (!filters.companyName ? 
                    '<th class="col-company">Company Name</th><th class="col-account">Main Account</th><th class="col-sub-account">Sub Account</th>' :
                    '<th class="col-account">Main Account</th><th class="col-sub-account">Sub Account</th>') : 
                  activeTab === 'company' ? 
                    '<th class="col-company">Company Name</th>' :
                    !filters.companyName ? 
                      '<th class="col-company">Company Name</th><th class="col-account">Main Account</th>' :
                      '<th class="col-account">Main Account</th>'
                }
                <th class="col-credit text-right">Credit</th>
                <th class="col-debit text-right">Debit</th>
                <th class="col-balance text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${currentData
                .map(
                  item => {
                    const credit = activeTab === 'company' ? (item as CompanySummary).totalCredit : 
                                  (item as AccountSummary | SubAccountSummary).credit;
                    const debit = activeTab === 'company' ? (item as CompanySummary).totalDebit : 
                                 (item as AccountSummary | SubAccountSummary).debit;
                    const balance = item.balance;
                    
                    if (activeTab === 'subAccount') {
                      const subAccount = item as SubAccountSummary;
                      const companyCell = !filters.companyName && subAccount.companyName ? 
                        `<td class="col-company">${subAccount.companyName}</td>` : '';
                      return `
                <tr>
                  ${companyCell}
                  <td class="col-account">${subAccount.mainAccount || '-'}</td>
                  <td class="col-sub-account">${subAccount.subAccount}</td>
                  <td class="col-credit text-right text-green">${credit.toLocaleString()}</td>
                  <td class="col-debit text-right text-red">${debit.toLocaleString()}</td>
                  <td class="col-balance text-right ${balance >= 0 ? 'text-green' : 'text-red'}">
${Math.abs(balance).toLocaleString()}
                    ${balance >= 0 ? ' CR' : ' DR'}
                  </td>
                </tr>
              `;
                    } else {
                      if (activeTab === 'company') {
                        const company = item as CompanySummary;
                        return `
                  <tr>
                    <td class="col-company">${company.companyName}</td>
                    <td class="col-credit text-right text-green">${credit.toLocaleString()}</td>
                    <td class="col-debit text-right text-red">${debit.toLocaleString()}</td>
                    <td class="col-balance text-right ${balance >= 0 ? 'text-green' : 'text-red'}">
${Math.abs(balance).toLocaleString()}
                      ${balance >= 0 ? ' CR' : ' DR'}
                    </td>
                  </tr>
                `;
                      } else {
                        const account = item as AccountSummary;
                        if (!filters.companyName && (account as any).companyName) {
                          return `
                    <tr>
                      <td class="col-company">${(account as any).companyName}</td>
                      <td class="col-account">${account.accountName}</td>
                      <td class="col-credit text-right text-green">${credit.toLocaleString()}</td>
                      <td class="col-debit text-right text-red">${debit.toLocaleString()}</td>
                      <td class="col-balance text-right ${balance >= 0 ? 'text-green' : 'text-red'}">
${Math.abs(balance).toLocaleString()}
                        ${balance >= 0 ? ' CR' : ' DR'}
                      </td>
                    </tr>
                  `;
                        } else {
                          return `
                    <tr>
                      <td class="col-account">${account.accountName}</td>
                      <td class="col-credit text-right text-green">${credit.toLocaleString()}</td>
                      <td class="col-debit text-right text-red">${debit.toLocaleString()}</td>
                      <td class="col-balance text-right ${balance >= 0 ? 'text-green' : 'text-red'}">
${Math.abs(balance).toLocaleString()}
                        ${balance >= 0 ? ' CR' : ' DR'}
                      </td>
                    </tr>
                  `;
                        }
                      }
                    }
                  }
                )
                .join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated by Thirumala Group Business Management System</p>
            <p style="margin-top: 5px; font-weight: 500;">Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);

    toast.success('Print dialog opened');
  };

  const printSummary = () => {
    setShowPrintPreview(true);
  };

  const getCurrentData = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'company':
        data = companySummaries;
        break;
      case 'mainAccount':
        data = mainAccountSummaries;
        break;
      case 'subAccount':
        data = subAccountSummaries;
        break;
      default:
        data = [];
    }

    if (!searchTerm.trim()) {
      return data;
    }

    const searchLower = searchTerm.toLowerCase().trim();

    return data.filter(item => {
      const creditStr = item.totalCredit !== undefined ? String(item.totalCredit) : String(item.credit || 0);
      const debitStr = item.totalDebit !== undefined ? String(item.totalDebit) : String(item.debit || 0);
      const balanceStr = item.balance !== undefined ? String(item.balance) : '';

      if (activeTab === 'company') {
        const company = item as CompanySummary;
        return (
          company.companyName.toLowerCase().includes(searchLower) ||
          creditStr.includes(searchLower) ||
          debitStr.includes(searchLower) ||
          balanceStr.includes(searchLower)
        );
      } else if (activeTab === 'mainAccount') {
        const account = item as AccountSummary & { companyName?: string };
        return (
          account.accountName.toLowerCase().includes(searchLower) ||
          (account.companyName || '').toLowerCase().includes(searchLower) ||
          creditStr.includes(searchLower) ||
          debitStr.includes(searchLower) ||
          balanceStr.includes(searchLower)
        );
      } else if (activeTab === 'subAccount') {
        const subAccount = item as SubAccountSummary;
        return (
          subAccount.subAccount.toLowerCase().includes(searchLower) ||
          subAccount.mainAccount.toLowerCase().includes(searchLower) ||
          (subAccount.companyName || '').toLowerCase().includes(searchLower) ||
          creditStr.includes(searchLower) ||
          debitStr.includes(searchLower) ||
          balanceStr.includes(searchLower)
        );
      }
      return false;
    });
  };

  const renderSummaryTable = () => {
    const data = getCurrentData();

    if (activeTab === 'company') {
      return (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 border-b border-gray-200'>
              <tr>
                <th className='px-4 py-3 text-left font-medium text-gray-700'>
                  {filters.companyName ? 'Company Details' : 'Company Name'}
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Credit
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Debit
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((company, index) => (
                <tr
                  key={company.companyName}
                  className={`border-b hover:bg-gray-50 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                  }`}
                >
                  <td className='px-4 py-3 font-medium text-blue-600'>
                    {company.companyName}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-green-600'>
{company.totalCredit.toLocaleString()}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-red-600'>
{company.totalDebit.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${
                      company.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
{Math.abs(company.balance).toLocaleString()}
                    {company.balance >= 0 ? ' CR' : ' DR'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'mainAccount') {
      return (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 border-b border-gray-200'>
              <tr>
                {!filters.companyName && (
                  <th className='px-4 py-3 text-left font-medium text-gray-700'>
                    Company Name
                  </th>
                )}
                <th className='px-4 py-3 text-left font-medium text-gray-700'>
                  {filters.companyName ? `${filters.companyName} - Main Account` : 'Main Account'}
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Credit
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Debit
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((account, index) => (
                <tr
                  key={!filters.companyName && (account as any).companyName 
                    ? `${(account as any).companyName}-${account.accountName}-${index}`
                    : `${account.accountName}-${index}`}
                  className={`border-b hover:bg-gray-50 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                  }`}
                >
                  {!filters.companyName && (
                    <td className='px-4 py-3 font-medium text-gray-700'>
                      {(account as any).companyName || ''}
                    </td>
                  )}
                  <td className='px-4 py-3 font-medium text-blue-600'>
                    {account.accountName}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-green-600'>
{account.credit.toLocaleString()}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-red-600'>
{account.debit.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${
                      account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
{Math.abs(account.balance).toLocaleString()}
                    {account.balance >= 0 ? ' CR' : ' DR'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'subAccount') {
      return (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 border-b border-gray-200'>
              <tr>
                {!filters.companyName && (
                  <th className='px-4 py-3 text-left font-medium text-gray-700'>
                    Company Name
                  </th>
                )}
                <th className='px-4 py-3 text-left font-medium text-gray-700'>
                  Main Account
                </th>
                <th className='px-4 py-3 text-left font-medium text-gray-700'>
                  {filters.companyName ? `${filters.companyName} - Sub Account` : 'Sub Account'}
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Credit
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Debit
                </th>
                <th className='px-4 py-3 text-right font-medium text-gray-700'>
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((subAccount, index) => (
                <tr
                  key={`${subAccount.companyName || ''}-${subAccount.subAccount}-${index}`}
                  className={`border-b hover:bg-gray-50 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                  }`}
                >
                  {!filters.companyName && (
                    <td className='px-4 py-3 font-medium text-gray-700'>
                      {subAccount.companyName || '-'}
                    </td>
                  )}
                  <td className='px-4 py-3'>
                    {subAccount.mainAccount || '-'}
                  </td>
                  <td className='px-4 py-3 font-medium text-blue-600'>
                    {subAccount.subAccount}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-green-600'>
{subAccount.credit.toLocaleString()}
                  </td>
                  <td className='px-4 py-3 text-right font-medium text-red-600'>
{subAccount.debit.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${
                      subAccount.balance >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
{Math.abs(subAccount.balance).toLocaleString()}
                    {subAccount.balance >= 0 ? ' CR' : ' DR'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  const currentDataForPreview = getCurrentData();
  const fromFormattedForPreview = filters.fromDate ? format(new Date(filters.fromDate), 'dd/MM/yyyy') : '';
  const toFormattedForPreview = filters.toDate ? format(new Date(filters.toDate), 'dd/MM/yyyy') : '';
  
  const previewTotals = useMemo(() => {
    return currentDataForPreview.reduce((acc, item) => {
      const credit = activeTab === 'company' ? (item as CompanySummary).totalCredit : 
                    (item as AccountSummary | SubAccountSummary).credit;
      const debit = activeTab === 'company' ? (item as CompanySummary).totalDebit : 
                   (item as AccountSummary | SubAccountSummary).debit;
      const balance = item.balance;
      
      acc.totalCredit += credit;
      acc.totalDebit += debit;
      acc.totalBalance += balance;
      acc.recordCount += 1;
      
      return acc;
    }, { totalCredit: 0, totalDebit: 0, totalBalance: 0, recordCount: 0 });
  }, [currentDataForPreview, activeTab]);

  return (
    <div className='space-y-6'>
      <ModeLabel />

      {/* Locked Book Banner */}
      {currentBook?.is_locked && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm flex items-center gap-3 no-print">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-red-800">This Book Is Locked (Read Only)</h3>
            <p className="text-xs text-red-700">Writing, editing, and deletion operations are disabled for this accounting period.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 flex items-center gap-2.5'>
            Ledger Summary
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              currentBook?.is_locked 
                ? 'bg-red-100 text-red-700' 
                : tableMode === 'itr' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-blue-100 text-blue-700'
            }`}>
              {tableMode === 'itr' ? 'ITR Mode' : 'Regular Mode'} | {currentBook?.book_code || 'No Book'}
            </span>
          </h1>
          <p className='text-gray-600'>
            Comprehensive financial summary with company, account, and
            sub-account analysis
          </p>
        </div>
        <div className='flex items-center gap-3'>
          {/*
          <Button
            
            variant="secondary"
            onClick={refreshData}
          >
            Refresh
          </Button>
          */}
          <Button variant='secondary' onClick={printSummary}>
            Print
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
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
                      entries={allEntries}
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
                      entries={allEntries}
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

          {/* Filter Options */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <SearchableSelect
              label='Company Name'
              value={filters.companyName}
              onChange={value => handleFilterChange('companyName', value)}
              options={companyOptions}
              placeholder='Search company...'
              allowCopy
            />

            <SearchableSelect
              label='Main Account'
              value={filters.mainAccount}
              onChange={value => handleFilterChange('mainAccount', value)}
              options={accountOptions}
              placeholder='Search main account...'
              allowCopy
            />

            <SearchableSelect
              label='Sub Account'
              value={filters.subAccount}
              onChange={value => handleFilterChange('subAccount', value)}
              options={subAccountOptions}
              placeholder='Search sub account...'
              allowCopy
            />

            <SearchableSelect
              label='Staff'
              value={filters.staff}
              onChange={value => handleFilterChange('staff', value)}
              options={staffOptions}
              placeholder='Search staff...'
              allowCopy
            />
          </div>

          {/* Action Buttons */}
          {/*
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={generateSummary}
              className="bg-green-600 hover:bg-green-700"
            >
              Refresh
            </Button>
            
            <Button
              variant="secondary"
              onClick={resetFilters}
            >
              Reset
            </Button>
            
            <Button
              variant="secondary"
              onClick={closeFilters}
            >
              Close
            </Button>
          </div>
          */}
        </div>
      </Card>

      {/* Search Bar */}
      <Card className='bg-gray-50'>
        <div className='flex items-center gap-4'>
          <div className='relative flex-1'>
            <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search in summary entries...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div className='text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border'>
            <strong>{getCurrentData().length}</strong> records found
          </div>
        </div>
      </Card>

      {/* Summary Tabs */}
      <Card>
        {/* Company Filter Indicator */}
        {filters.companyName && (
          <div className='bg-blue-50 border-l-4 border-blue-400 p-4 mb-4'>
            <div className='flex items-center'>
              <div className='flex-shrink-0'>
                <svg className='h-5 w-5 text-blue-400' viewBox='0 0 20 20' fill='currentColor'>
                  <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z' clipRule='evenodd' />
                </svg>
              </div>
              <div className='ml-3 flex-1'>
                <p className='text-sm text-blue-700'>
                  <strong>Company Filter Active:</strong> Showing data for <span className='font-semibold'>{filters.companyName}</span>
                </p>
                <p className='text-xs text-blue-600 mt-1'>
                  All tabs below show company-specific totals. Clear the company filter to see all companies.
                </p>
              </div>
              <div className='ml-3'>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => {
                    setFilters(prev => ({ ...prev, companyName: '', mainAccount: '', subAccount: '' }));
                    toast.success('Company filter cleared');
                  }}
                  className='text-blue-600 hover:text-blue-800'
                >
                  Clear Company Filter
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8'>
            <button
              onClick={() => setActiveTab('company')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'company'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {filters.companyName ? `${filters.companyName} - Company Totals` : 'Companywise Totals'}
            </button>
            <button
              onClick={() => setActiveTab('mainAccount')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'mainAccount'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {filters.companyName ? `${filters.companyName} - Main Account Totals` : 'MainAccountwise Totals'}
            </button>
            <button
              onClick={() => setActiveTab('subAccount')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'subAccount'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {filters.companyName ? `${filters.companyName} - Sub Account` : 'Sub Account'}
            </button>
          </nav>
        </div>

        <div className='p-6'>
          {loading ? (
            <div className='text-center py-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
              <p className='mt-2 text-gray-600'>Generating summary...</p>
            </div>
          ) : (
            <>
              {renderSummaryTable()}

              {/* Summary Footer */}
              <div className='mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border'>
                <div className='bg-green-100 p-3 rounded-lg'>
                  <div className='text-sm font-medium text-green-800'>
                    Total Credit:
                  </div>
                  <div className='text-lg font-bold text-green-900'>
{grandTotals.totalCredit.toLocaleString()}
                  </div>
                </div>
                <div className='bg-red-100 p-3 rounded-lg'>
                  <div className='text-sm font-medium text-red-800'>
                    Total Debit:
                  </div>
                  <div className='text-lg font-bold text-red-900'>
{grandTotals.totalDebit.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`p-3 rounded-lg ${
                    grandTotals.balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${
                      grandTotals.balance >= 0
                        ? 'text-blue-800'
                        : 'text-orange-800'
                    }`}
                  >
                    Balance:
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      grandTotals.balance >= 0
                        ? 'text-blue-900'
                        : 'text-orange-900'
                    }`}
                  >
{Math.abs(grandTotals.balance).toLocaleString()}
                    {grandTotals.balance >= 0 ? ' CR' : ' DR'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-6 no-print'>
                <h3 className='text-lg font-semibold'>
                  Print Preview - Ledger Summary
                </h3>
                <div className='flex items-center gap-2'>
                  <Button 
                    size='sm' 
                    onClick={handleRealPrint}
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

              {/* On-screen preview container */}
              <div className='border p-8 bg-white max-w-4xl mx-auto shadow-sm text-gray-800' style={{ fontFamily: 'Arial, sans-serif' }}>
                {/* Header */}
                <div className='text-center border-b-2 border-black pb-4 mb-6'>
                  <h1 className='text-2xl font-bold uppercase'>Thirumala Group</h1>
                  <h2 className='text-lg font-semibold mt-1'>Ledger Summary Report</h2>
                  <div className='text-md font-bold mt-1'>{filters.companyName || 'All Companies'}</div>
                  <div className='text-sm mt-1'>Period: <strong>{fromFormattedForPreview}</strong> to <strong>{toFormattedForPreview}</strong></div>
                </div>

                {/* Summary Totals Section */}
                <div className='border-2 border-gray-200 bg-gray-50 rounded-lg p-4 mb-6'>
                  <div className='text-md font-bold text-center mb-3'>Summary Totals</div>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='bg-white p-3 rounded border text-center'>
                      <div className='text-xs text-gray-500 mb-1'>Total Credit</div>
                      <div className='text-lg font-bold text-green-600'>{previewTotals.totalCredit.toLocaleString()}</div>
                    </div>
                    <div className='bg-white p-3 rounded border text-center'>
                      <div className='text-xs text-gray-500 mb-1'>Total Debit</div>
                      <div className='text-lg font-bold text-red-600'>{previewTotals.totalDebit.toLocaleString()}</div>
                    </div>
                    <div className='bg-white p-3 rounded border text-center'>
                      <div className='text-xs text-gray-500 mb-1'>Net Balance</div>
                      <div className='text-lg font-bold'>{Math.abs(previewTotals.totalBalance).toLocaleString()} {previewTotals.totalBalance >= 0 ? 'CR' : 'DR'}</div>
                    </div>
                    <div className='bg-white p-3 rounded border text-center'>
                      <div className='text-xs text-gray-500 mb-1'>Total Records</div>
                      <div className='text-lg font-bold'>{previewTotals.recordCount}</div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <table className='w-full border-collapse border border-black text-sm mb-6'>
                  <thead>
                    <tr className='bg-gray-100 border border-black'>
                      {activeTab === 'subAccount' ? (
                        <>
                          {!filters.companyName && <th className='border border-black p-2 text-left font-bold'>Company Name</th>}
                          <th className='border border-black p-2 text-left font-bold'>Main Account</th>
                          <th className='border border-black p-2 text-left font-bold'>Sub Account</th>
                        </>
                      ) : activeTab === 'company' ? (
                        <th className='border border-black p-2 text-left font-bold'>Company Name</th>
                      ) : (
                        <>
                          {!filters.companyName && <th className='border border-black p-2 text-left font-bold'>Company Name</th>}
                          <th className='border border-black p-2 text-left font-bold'>Main Account</th>
                        </>
                      )}
                      <th className='border border-black p-2 text-right font-bold'>Credit</th>
                      <th className='border border-black p-2 text-right font-bold'>Debit</th>
                      <th className='border border-black p-2 text-right font-bold'>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDataForPreview.map((item, idx) => {
                      const credit = activeTab === 'company' ? (item as CompanySummary).totalCredit : 
                                    (item as AccountSummary | SubAccountSummary).credit;
                      const debit = activeTab === 'company' ? (item as CompanySummary).totalDebit : 
                                   (item as AccountSummary | SubAccountSummary).debit;
                      const balance = item.balance;

                      if (activeTab === 'subAccount') {
                        const subAccount = item as SubAccountSummary;
                        return (
                          <tr key={idx} className='border border-black'>
                            {!filters.companyName && <td className='border border-black p-2'>{subAccount.companyName}</td>}
                            <td className='border border-black p-2'>{subAccount.mainAccount || '-'}</td>
                            <td className='border border-black p-2'>{subAccount.subAccount}</td>
                            <td className='border border-black p-2 text-right text-green-700 font-medium'>{credit.toLocaleString()}</td>
                            <td className='border border-black p-2 text-right text-red-700 font-medium'>{debit.toLocaleString()}</td>
                            <td className={`border border-black p-2 text-right font-semibold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {Math.abs(balance).toLocaleString()} {balance >= 0 ? 'CR' : 'DR'}
                            </td>
                          </tr>
                        );
                      } else if (activeTab === 'company') {
                        const company = item as CompanySummary;
                        return (
                          <tr key={idx} className='border border-black'>
                            <td className='border border-black p-2'>{company.companyName}</td>
                            <td className='border border-black p-2 text-right text-green-700 font-medium'>{credit.toLocaleString()}</td>
                            <td className='border border-black p-2 text-right text-red-700 font-medium'>{debit.toLocaleString()}</td>
                            <td className={`border border-black p-2 text-right font-semibold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {Math.abs(balance).toLocaleString()} {balance >= 0 ? 'CR' : 'DR'}
                            </td>
                          </tr>
                        );
                      } else {
                        const account = item as AccountSummary;
                        return (
                          <tr key={idx} className='border border-black'>
                            {!filters.companyName && <td className='border border-black p-2'>{(account as any).companyName || ''}</td>}
                            <td className='border border-black p-2'>{account.accountName}</td>
                            <td className='border border-black p-2 text-right text-green-700 font-medium'>{credit.toLocaleString()}</td>
                            <td className='border border-black p-2 text-right text-red-700 font-medium'>{debit.toLocaleString()}</td>
                            <td className={`border border-black p-2 text-right font-semibold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {Math.abs(balance).toLocaleString()} {balance >= 0 ? 'CR' : 'DR'}
                            </td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                </table>

                {/* Footer */}
                <div className='text-center border-t border-black pt-4 mt-6 text-xs text-gray-500'>
                  <p>Generated by Thirumala Group Business Management System</p>
                  <p className='mt-1 font-semibold'>Generated on: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerSummary;
