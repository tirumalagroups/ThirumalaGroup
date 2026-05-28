import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import SearchableSelect from '../components/UI/SearchableSelect';
import { supabaseDB } from '../lib/supabaseDatabase';
import { supabase } from '../lib/supabase';
import { getTableName } from '../lib/tableNames';
import { useAuth } from '../contexts/AuthContext';
import { useTableMode } from '../contexts/TableModeContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface ReplaceFormData {
  oldCompanyName: string;
  newCompanyName: string;
  oldAccountName: string;
  oldSubAccount: string;
  newAccountName: string;
  newSubAccount: string;
}

const ReplaceForm: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { mode: tableMode } = useTableMode();
  const queryClient = useQueryClient();

  const [replaceData, setReplaceData] = useState<ReplaceFormData>({
    oldCompanyName: '',
    newCompanyName: '',
    oldAccountName: '',
    oldSubAccount: '',
    newAccountName: '',
    newSubAccount: '',
  });

  const [entries, setEntries] = useState<any[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dropdown data
  const [accounts, setAccounts] = useState<{ value: string; label: string }[]>(
    []
  );
  const [subAccounts, setSubAccounts] = useState<
    { value: string; label: string }[]
  >([]);
  const [newAccounts, setNewAccounts] = useState<
    { value: string; label: string }[]
  >([]);
  const [newSubAccounts, setNewSubAccounts] = useState<
    { value: string; label: string }[]
  >([]);
  const [companies, setCompanies] = useState<
    { value: string; label: string }[]
  >([]);

  // Summary data
  const [summary, setSummary] = useState({
    totalRecords: 0,
    totalCredit: 0,
    totalDebit: 0,
  });

  // Dynamic entry counts for previews
  const companyCounts = useMemo(() => {
    const oldVal = replaceData.oldCompanyName?.trim();
    const newVal = replaceData.newCompanyName?.trim();
    
    let oldCompanyEntriesCount = 0;
    let newCompanyEntriesCount = 0;
    
    if (oldVal || newVal) {
      entries.forEach(entry => {
        const entryCompany = entry.company_name?.trim();
        if (oldVal && entryCompany === oldVal) {
          oldCompanyEntriesCount++;
        }
        if (newVal && entryCompany === newVal) {
          newCompanyEntriesCount++;
        }
      });
    }
    
    return {
      oldReady: oldCompanyEntriesCount,
      newExisting: newCompanyEntriesCount,
      newAdded: oldCompanyEntriesCount,
      newTotal: newCompanyEntriesCount + oldCompanyEntriesCount
    };
  }, [entries, replaceData.oldCompanyName, replaceData.newCompanyName]);

  const accountCounts = useMemo(() => {
    const oldVal = replaceData.oldAccountName?.trim();
    const newVal = replaceData.newAccountName?.trim();
    
    let oldAccountEntriesCount = 0;
    let newAccountEntriesCount = 0;
    
    if (oldVal || newVal) {
      entries.forEach(entry => {
        const entryAccount = entry.acc_name?.trim();
        if (oldVal && entryAccount === oldVal) {
          oldAccountEntriesCount++;
        }
        if (newVal && entryAccount === newVal) {
          newAccountEntriesCount++;
        }
      });
    }
    
    return {
      oldReady: oldAccountEntriesCount,
      newExisting: newAccountEntriesCount,
      newAdded: oldAccountEntriesCount,
      newTotal: newAccountEntriesCount + oldAccountEntriesCount
    };
  }, [entries, replaceData.oldAccountName, replaceData.newAccountName]);

  const subAccountCounts = useMemo(() => {
    const oldVal = replaceData.oldSubAccount?.trim();
    const newVal = replaceData.newSubAccount?.trim();
    
    let oldSubAccountEntriesCount = 0;
    let newSubAccountEntriesCount = 0;
    
    if (oldVal || newVal) {
      entries.forEach(entry => {
        const entrySubAccount = entry.sub_acc_name?.trim();
        if (oldVal && entrySubAccount === oldVal) {
          oldSubAccountEntriesCount++;
        }
        if (newVal && entrySubAccount === newVal) {
          newSubAccountEntriesCount++;
        }
      });
    }
    
    return {
      oldReady: oldSubAccountEntriesCount,
      newExisting: newSubAccountEntriesCount,
      newAdded: oldSubAccountEntriesCount,
      newTotal: newSubAccountEntriesCount + oldSubAccountEntriesCount
    };
  }, [entries, replaceData.oldSubAccount, replaceData.newSubAccount]);

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied. Only admins can use the replace form.');
      return;
    }
    loadDropdownData();
    loadEntries();
  }, [isAdmin, tableMode]); // Reload when mode changes

  useEffect(() => {
    applyFilters();
  }, [entries, replaceData]);

  // Update summary immediately when filtered entries change
  useEffect(() => {
    updateSummary(filteredEntries);
  }, [filteredEntries]);

  const loadDropdownData = async () => {
    try {
      // Load companies
      const companiesList = await supabaseDB.getCompanies();
      const companiesData = companiesList.map(company => ({
        value: company.company_name,
        label: company.company_name,
      }));
      setCompanies(companiesData);

      // Load all unique account names from 67k cash_book records
      const accountNames = await supabaseDB.getDistinctAccountNames();
      const allAccounts = accountNames.map(accountName => ({ 
        value: accountName, 
        label: accountName 
      }));
      setAccounts(allAccounts);
      setNewAccounts(allAccounts);

      // Load all unique sub accounts from 67k cash_book records
      const subAccountNames = await supabaseDB.getDistinctSubAccountNames();
      const allSubAccounts = subAccountNames.map(subAccountName => ({ 
        value: subAccountName, 
        label: subAccountName 
      }));
      setSubAccounts(allSubAccounts);
      setNewSubAccounts(allSubAccounts);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      toast.error('Failed to load dropdown data');
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      toast.loading('Loading entries...', { id: 'load-entries' });
      
      const allEntries = await supabaseDB.getAllCashBookEntries();
      setEntries(allEntries);
      
      toast.success(`Loaded ${allEntries.length} entries`, { id: 'load-entries' });
      
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load entries', { id: 'load-entries' });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Filter by company name (case-insensitive and trimmed)
    if (replaceData.oldCompanyName) {
      filtered = filtered.filter(entry => {
        const entryCompany = entry.company_name?.trim() || '';
        const oldCompany = replaceData.oldCompanyName?.trim() || '';
        return entryCompany === oldCompany;
      });
    }

    // Filter by old account name (case-insensitive and trimmed)
    if (replaceData.oldAccountName) {
      filtered = filtered.filter(entry => {
        const entryAccount = entry.acc_name?.trim() || '';
        const oldAccount = replaceData.oldAccountName?.trim() || '';
        return entryAccount === oldAccount;
      });
    }

    // Filter by old sub account (case-insensitive and trimmed)
    if (replaceData.oldSubAccount) {
      filtered = filtered.filter(entry => {
        const entrySubAccount = entry.sub_acc_name?.trim() || '';
        const oldSubAccount = replaceData.oldSubAccount?.trim() || '';
        return entrySubAccount === oldSubAccount;
      });
    }

    setFilteredEntries(filtered);
    // Summary will be updated by useEffect when filteredEntries changes
  };

  const updateSummary = (filtered: any[]) => {
    // Check if any filter is selected (company, account, or sub-account)
    const hasSelection = replaceData.oldCompanyName || replaceData.oldAccountName || replaceData.oldSubAccount;
    
    // If selection is made, show filtered count; otherwise show all entries count
    const totalRecords = hasSelection ? filtered.length : entries.length;
    
    // Use filtered entries for calculations when selection is made
    const recordsForCalculation = hasSelection ? filtered : entries;
    
    // Safely calculate totals, handling null/undefined values
    const totalCredit = recordsForCalculation.reduce((sum, entry) => {
      const credit = parseFloat(entry.credit) || 0;
      return sum + credit;
    }, 0);
    
    const totalDebit = recordsForCalculation.reduce((sum, entry) => {
      const debit = parseFloat(entry.debit) || 0;
      return sum + debit;
    }, 0);

    setSummary({
      totalRecords,
      totalCredit,
      totalDebit,
    });
  };

  const handleInputChange = (field: keyof ReplaceFormData, value: string) => {
    setReplaceData(prev => {
      // If selecting a filter (oldCompanyName, oldAccountName, or oldSubAccount),
      // clear the other two filters to ensure only one is active at a time.
      // Also, if the new selection matches the newly selected old value, clear the new selection.
      if (field === 'oldCompanyName' && value) {
        return {
          ...prev,
          oldCompanyName: value,
          newCompanyName: prev.newCompanyName === value ? '' : prev.newCompanyName,
          oldAccountName: '', // Clear account name
          oldSubAccount: '', // Clear sub account
        };
      } else if (field === 'oldAccountName' && value) {
        return {
          ...prev,
          oldAccountName: value,
          newAccountName: prev.newAccountName === value ? '' : prev.newAccountName,
          oldCompanyName: '', // Clear company name
          oldSubAccount: '', // Clear sub account
        };
      } else if (field === 'oldSubAccount' && value) {
        return {
          ...prev,
          oldSubAccount: value,
          newSubAccount: prev.newSubAccount === value ? '' : prev.newSubAccount,
          oldCompanyName: '', // Clear company name
          oldAccountName: '', // Clear account name
        };
      } else {
        // For other fields (newCompanyName, newAccountName, newSubAccount), update normally
        return {
          ...prev,
          [field]: value,
        };
      }
    });
  };


  const handleReplaceAccountName = async () => {
    if (!replaceData.oldAccountName || !replaceData.newAccountName) {
      toast.error('Please select both old and new account names');
      return;
    }

    // Verify that the new account name exists in the listed accounts
    const newAccountExists = newAccounts.some(
      account => account.value.trim() === replaceData.newAccountName.trim()
    );

    if (!newAccountExists) {
      toast.error(
        `Account "${replaceData.newAccountName}" does not exist. Please select an existing account from the list.`
      );
      return;
    }

    // Find all matching entries
    const matchingEntries = entries.filter(entry => {
      const entryAccount = entry.acc_name?.trim() || '';
      const oldAccount = replaceData.oldAccountName?.trim() || '';
      return entryAccount === oldAccount;
    });

    if (matchingEntries.length === 0) {
      toast.error(`No records found with account name "${replaceData.oldAccountName}"`);
      return;
    }

    const confirmMessage = 
      `Are you sure you want to replace Old Account Name: "${replaceData.oldAccountName}" with New Account Name: "${replaceData.newAccountName}"?\n\n` +
      `This will update ${matchingEntries.length} cash book entries.\n\n` +
      `This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        // Use bulk update for better performance
        const ids = matchingEntries.map(entry => entry.id);
        const result = await supabaseDB.bulkUpdateCashBookEntriesByIds(
          ids,
          { acc_name: replaceData.newAccountName.trim() },
          user?.username || 'admin'
        );

        if (result.success && result.updatedCount > 0) {
          await loadEntries();
          
          // After successful replacement, delete the old account name from company_main_accounts
          console.log(`Deleting old account name "${replaceData.oldAccountName}" from company_main_accounts...`);
          try {
            // Delete all entries with the old account name from company_main_accounts table
            // Since we've already replaced all cash_book entries, it's safe to delete
            const { error: deleteError } = await supabase
              .from(getTableName('company_main_accounts'))
              .delete()
              .eq('acc_name', replaceData.oldAccountName.trim());

            if (deleteError) {
              console.warn('Warning: Could not delete old account name from company_main_accounts:', deleteError);
              // Don't fail the whole operation if deletion fails - it's a cleanup step
              toast(
                `${result.updatedCount} account names replaced successfully, but could not delete old account from reference table.`,
                { icon: '⚠️', duration: 4000 }
              );
            } else {
              console.log('✅ Old account name deleted from company_main_accounts');
              // Also delete related sub accounts if any
              const { error: subDeleteError } = await supabase
                .from(getTableName('company_main_sub_acc'))
                .delete()
                .eq('acc_name', replaceData.oldAccountName.trim());

              if (subDeleteError) {
                console.warn('Warning: Could not delete old sub accounts:', subDeleteError);
              } else {
                console.log('✅ Old sub accounts deleted');
              }
              
              toast.success(
                `${result.updatedCount} account names replaced and old account "${replaceData.oldAccountName}" deleted successfully!`,
                { duration: 4000 }
              );
            }
          } catch (deleteErr) {
            console.error('Error deleting old account name:', deleteErr);
            // Continue with success message even if deletion fails
            toast.success(`${result.updatedCount} account names replaced successfully!`);
          }
          
          // Refresh dropdown data to reflect the changes
          await loadDropdownData();
          
          // Invalidate and refetch React Query cache to refresh recent transactions in New Entry
          // This ensures that updated entries show up in the recent transactions section automatically
          console.log('🔄 Refreshing recent entries queries to update New Entry recent transactions...');
          
          // Invalidate all relevant queries
          queryClient.invalidateQueries({ queryKey: ['recentEntries'] }); // Invalidate all date-specific recent entries
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'recentEntries'] }); // Invalidate general recent entries
          queryClient.invalidateQueries({ queryKey: ['cashBook'] }); // Invalidate all cash book queries
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }); // Invalidate dashboard stats
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'companyBalances'] }); // Invalidate company balances
          
          // Force refetch all recent entries queries to update immediately
          // This ensures New Entry page shows updated data without manual refresh
          await queryClient.refetchQueries({ queryKey: ['recentEntries'] });
          await queryClient.refetchQueries({ queryKey: ['dashboard', 'recentEntries'] });
          await queryClient.refetchQueries({ queryKey: ['cashBook'] });
          
          // Invalidate and refetch accounts dropdown to update account list in New Entry
          // This ensures the dropdown shows updated account names after replacement
          queryClient.invalidateQueries({ queryKey: ['dropdowns', 'accounts'] });
          await queryClient.refetchQueries({ queryKey: ['dropdowns', 'accounts'] });
          queryClient.invalidateQueries({ queryKey: ['dropdowns', 'subAccounts'] });
          await queryClient.refetchQueries({ queryKey: ['dropdowns', 'subAccounts'] });
          
          console.log('✅ Recent entries and dropdowns refreshed - New Entry will update automatically');
          
          setReplaceData(prev => ({
            ...prev,
            oldAccountName: '',
            newAccountName: '',
          }));
          
          // Trigger dashboard refresh
          localStorage.setItem('dashboard-refresh', Date.now().toString());
          window.dispatchEvent(new CustomEvent('dashboard-refresh'));
        } else {
          toast.error(`Failed to replace account names: ${result.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error replacing account names:', error);
        toast.error('Failed to replace account names');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReplaceSubAccount = async () => {
    if (!replaceData.oldSubAccount || !replaceData.newSubAccount) {
      toast.error('Please select both old and new sub account names');
      return;
    }

    // Verify that the new sub account name exists in the listed sub accounts
    const newSubAccountExists = newSubAccounts.some(
      subAccount => subAccount.value.trim() === replaceData.newSubAccount.trim()
    );

    if (!newSubAccountExists) {
      toast.error(
        `Sub Account "${replaceData.newSubAccount}" does not exist. Please select an existing sub account from the list.`
      );
      return;
    }

    // Find all matching entries
    const matchingEntries = entries.filter(entry => {
      const entrySubAccount = entry.sub_acc_name?.trim() || '';
      const oldSubAccount = replaceData.oldSubAccount?.trim() || '';
      return entrySubAccount === oldSubAccount;
    });

    if (matchingEntries.length === 0) {
      toast.error(`No records found with sub account name "${replaceData.oldSubAccount}"`);
      return;
    }

    const confirmMessage = 
      `Are you sure you want to replace Old Sub Account: "${replaceData.oldSubAccount}" with New Sub Account: "${replaceData.newSubAccount}"?\n\n` +
      `This will update ${matchingEntries.length} cash book entries.\n\n` +
      `This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        // Use bulk update for better performance
        const ids = matchingEntries.map(entry => entry.id);
        const result = await supabaseDB.bulkUpdateCashBookEntriesByIds(
          ids,
          { sub_acc_name: replaceData.newSubAccount.trim() },
          user?.username || 'admin'
        );

        if (result.success && result.updatedCount > 0) {
          await loadEntries();
          
          // After successful replacement, delete the old sub account from reference table
          try {
            const { error: subRefDeleteError } = await supabase
              .from(getTableName('company_main_sub_acc'))
              .delete()
              .eq('sub_acc', replaceData.oldSubAccount.trim());

            if (subRefDeleteError) {
              console.warn('Warning: Could not delete old sub account from company_main_sub_acc:', subRefDeleteError);
            } else {
              console.log('✅ Old sub account deleted from company_main_sub_acc');
            }
          } catch (subRefDeleteErr) {
            console.warn('Warning: Error while deleting old sub account reference:', subRefDeleteErr);
          }

          // Invalidate and refetch React Query cache to refresh recent transactions in New Entry
          // This ensures that updated entries show up in the recent transactions section automatically
          console.log('🔄 Refreshing recent entries queries to update New Entry recent transactions...');
          
          // Invalidate all relevant queries
          queryClient.invalidateQueries({ queryKey: ['recentEntries'] }); // Invalidate all date-specific recent entries
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'recentEntries'] }); // Invalidate general recent entries
          queryClient.invalidateQueries({ queryKey: ['cashBook'] }); // Invalidate all cash book queries
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }); // Invalidate dashboard stats
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'companyBalances'] }); // Invalidate company balances
          
          // Force refetch all recent entries queries to update immediately
          // This ensures New Entry page shows updated data without manual refresh
          await queryClient.refetchQueries({ queryKey: ['recentEntries'] });
          await queryClient.refetchQueries({ queryKey: ['dashboard', 'recentEntries'] });
          await queryClient.refetchQueries({ queryKey: ['cashBook'] });
          
          // Invalidate and refetch sub accounts dropdown to update sub account list in New Entry
          queryClient.invalidateQueries({ queryKey: ['dropdowns', 'subAccounts'] });
          await queryClient.refetchQueries({ queryKey: ['dropdowns', 'subAccounts'] });
          // Also invalidate related dropdowns so all forms reload fresh lists
          queryClient.invalidateQueries({ queryKey: ['dropdowns', 'accounts'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.dropdowns.companies() });
          
          console.log('✅ Recent entries and dropdowns refreshed - New Entry will update automatically');
          
          toast.success(
            `${result.updatedCount} sub account names replaced successfully!`
          );
          setReplaceData(prev => ({
            ...prev,
            oldSubAccount: '',
            newSubAccount: '',
          }));
          
          // Trigger dashboard refresh
          localStorage.setItem('dashboard-refresh', Date.now().toString());
          window.dispatchEvent(new CustomEvent('dashboard-refresh'));
        } else {
          toast.error(`Failed to replace sub account names: ${result.error?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error replacing sub account names:', error);
        toast.error('Failed to replace sub account names');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReplaceCompanyName = async () => {
    if (!replaceData.oldCompanyName || !replaceData.newCompanyName) {
      toast.error('Please select both old and new company names');
      return;
    }

    console.log('Starting company name replacement...');
    console.log('Old company name:', replaceData.oldCompanyName);
    console.log('New company name:', replaceData.newCompanyName);
    console.log('Total entries in database:', entries.length);

    // Debug: Show all unique company names in the database
    const uniqueCompanies = [
      ...new Set(entries.map(entry => entry.company_name).filter(Boolean)),
    ];
    console.log('All unique company names in database:', uniqueCompanies);

    // Get all entries that match the old company name from the full database
    const matchingEntries = entries.filter(entry => {
      const entryCompany = entry.company_name?.trim();
      const oldCompany = replaceData.oldCompanyName?.trim();
      return entryCompany === oldCompany;
    });

    console.log('Matching entries found:', matchingEntries.length);
    console.log('Sample matching entries:', matchingEntries.slice(0, 3));

    if (matchingEntries.length === 0) {
      toast.error(
        `No records found with company name "${replaceData.oldCompanyName}"`
      );
      return;
    }

    // Count main accounts and sub accounts that will be affected
    let mainAccountsCount = 0;
    let subAccountsCount = 0;
    
    try {
      const { data: mainAccountsData } = await supabase
        .from(getTableName('company_main_accounts'))
        .select('id')
        .eq('company_name', replaceData.oldCompanyName.trim());
      mainAccountsCount = mainAccountsData?.length || 0;

      const { data: subAccountsData } = await supabase
        .from(getTableName('company_main_sub_acc'))
        .select('id')
        .eq('company_name', replaceData.oldCompanyName.trim());
      subAccountsCount = subAccountsData?.length || 0;
    } catch (err) {
      console.warn('Could not count accounts before replacement:', err);
    }

    const confirmMessage = 
      `Are you sure you want to replace Old Company Name: "${replaceData.oldCompanyName}" with New Company Name: "${replaceData.newCompanyName}"?\n\n` +
      `This will update:\n` +
      `• ${matchingEntries.length} cash book entries\n` +
      `• ${mainAccountsCount} main accounts\n` +
      `• ${subAccountsCount} sub accounts\n\n` +
      `This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        // Verify that the new company name exists in the companies table
        const allCompanies = await supabaseDB.getCompanies();
        const newCompanyExists = allCompanies.some(
          company =>
            company.company_name.trim() === replaceData.newCompanyName.trim()
        );

        // The new company must already exist in the companies table
        if (!newCompanyExists) {
          toast.error(
            `Company "${replaceData.newCompanyName}" does not exist. Please select an existing company from the list.`
          );
          setLoading(false);
          return;
        }

        console.log(
          `Company "${replaceData.newCompanyName}" exists in companies table`
        );

        const oldCompanyName = replaceData.oldCompanyName.trim();
        const newCompanyName = replaceData.newCompanyName.trim();

        // STEP 1: Update company_main_accounts table
        // Handle duplicate accounts - check which accounts would create duplicates
        console.log('Checking for duplicate accounts before updating company_main_accounts...');
        
        // Get all accounts from old company
        const { data: oldCompanyAccounts, error: fetchOldError } = await supabase
          .from(getTableName('company_main_accounts'))
          .select('id, acc_name')
          .eq('company_name', oldCompanyName);

        if (fetchOldError) {
          console.error('Error fetching old company accounts:', fetchOldError);
          toast.error(`Failed to fetch old company accounts: ${fetchOldError.message}`);
          setLoading(false);
          return;
        }

        // Get all accounts from new company to check for duplicates
        const { data: newCompanyAccounts, error: fetchNewError } = await supabase
          .from(getTableName('company_main_accounts'))
          .select('acc_name')
          .eq('company_name', newCompanyName);

        if (fetchNewError) {
          console.error('Error fetching new company accounts:', fetchNewError);
          toast.error(`Failed to fetch new company accounts: ${fetchNewError.message}`);
          setLoading(false);
          return;
        }

        const newCompanyAccountNames = new Set((newCompanyAccounts || []).map(acc => acc.acc_name?.trim()).filter(Boolean));
        const accountsToUpdate: string[] = [];
        const accountsToDelete: string[] = [];
        const duplicateAccountNames: string[] = [];

        // Separate accounts into those that can be updated vs those that need to be deleted
        (oldCompanyAccounts || []).forEach(account => {
          const accName = account.acc_name?.trim();
          if (!accName) return;

          if (newCompanyAccountNames.has(accName)) {
            // Duplicate - the new company already has this account
            accountsToDelete.push(account.id);
            duplicateAccountNames.push(accName);
          } else {
            // No duplicate - safe to update
            accountsToUpdate.push(account.id);
          }
        });

        console.log(`📊 Accounts to update: ${accountsToUpdate.length}, Accounts to delete (duplicates): ${accountsToDelete.length}`);
        
        if (duplicateAccountNames.length > 0) {
          console.log(`⚠️ Duplicate accounts found: ${duplicateAccountNames.join(', ')}`);
          console.log('These will be deleted from old company since new company already has them');
        }

        // Delete duplicate accounts first (accounts that new company already has)
        let deletedCount = 0;
        if (accountsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from(getTableName('company_main_accounts'))
            .delete()
            .in('id', accountsToDelete);

          if (deleteError) {
            console.error('Error deleting duplicate accounts:', deleteError);
            toast(`Warning: Could not delete ${accountsToDelete.length} duplicate accounts: ${deleteError.message}`, { icon: '⚠️' });
          } else {
            deletedCount = accountsToDelete.length;
            console.log(`✅ Deleted ${deletedCount} duplicate accounts`);
          }
        }

        // Update non-duplicate accounts
        let updatedCount = 0;
        if (accountsToUpdate.length > 0) {
          const { data: updatedMainAccounts, error: mainAccountsError } = await supabase
            .from(getTableName('company_main_accounts'))
            .update({ company_name: newCompanyName })
            .in('id', accountsToUpdate)
            .select();

          if (mainAccountsError) {
            console.error('Error updating company_main_accounts:', mainAccountsError);
            toast.error(`Failed to update main accounts: ${mainAccountsError.message}`);
            setLoading(false);
            return;
          }

          updatedCount = updatedMainAccounts?.length || 0;
          console.log(`✅ Updated ${updatedCount} main accounts`);
        }

        const mainAccountsUpdated = updatedCount + deletedCount;
        if (duplicateAccountNames.length > 0) {
          toast.success(
            `${duplicateAccountNames.length} duplicate account(s) were deleted (new company already has them): ${duplicateAccountNames.slice(0, 3).join(', ')}${duplicateAccountNames.length > 3 ? '...' : ''}`,
            { duration: 5000 }
          );
        }

        // STEP 2: Update company_main_sub_acc table
        // Handle duplicate sub accounts - check which sub accounts would create duplicates
        console.log('Checking for duplicate sub accounts before updating company_main_sub_acc...');
        
        // Get all sub accounts from old company
        const { data: oldCompanySubAccounts, error: fetchOldSubError } = await supabase
          .from(getTableName('company_main_sub_acc'))
          .select('id, acc_name, sub_acc')
          .eq('company_name', oldCompanyName);

        if (fetchOldSubError) {
          console.error('Error fetching old company sub accounts:', fetchOldSubError);
          toast.error(`Failed to fetch old company sub accounts: ${fetchOldSubError.message}`);
          setLoading(false);
          return;
        }

        // Get all sub accounts from new company to check for duplicates
        const { data: newCompanySubAccounts, error: fetchNewSubError } = await supabase
          .from(getTableName('company_main_sub_acc'))
          .select('acc_name, sub_acc')
          .eq('company_name', newCompanyName);

        if (fetchNewSubError) {
          console.error('Error fetching new company sub accounts:', fetchNewSubError);
          toast.error(`Failed to fetch new company sub accounts: ${fetchNewSubError.message}`);
          setLoading(false);
          return;
        }

        // Create a set of (acc_name, sub_acc) combinations for the new company
        const newCompanySubAccountKeys = new Set(
          (newCompanySubAccounts || []).map(sub => {
            const accName = sub.acc_name?.trim();
            const subAcc = sub.sub_acc?.trim();
            return accName && subAcc ? `${accName}|||${subAcc}` : null;
          }).filter(Boolean)
        );

        const subAccountsToUpdate: string[] = [];
        const subAccountsToDelete: string[] = [];
        const duplicateSubAccountKeys: string[] = [];

        // Separate sub accounts into those that can be updated vs those that need to be deleted
        (oldCompanySubAccounts || []).forEach(subAccount => {
          const accName = subAccount.acc_name?.trim();
          const subAcc = subAccount.sub_acc?.trim();
          if (!accName || !subAcc) return;

          const key = `${accName}|||${subAcc}`;
          if (newCompanySubAccountKeys.has(key)) {
            // Duplicate - the new company already has this sub account
            subAccountsToDelete.push(subAccount.id);
            duplicateSubAccountKeys.push(`${accName} - ${subAcc}`);
          } else {
            // No duplicate - safe to update
            subAccountsToUpdate.push(subAccount.id);
          }
        });

        console.log(`📊 Sub accounts to update: ${subAccountsToUpdate.length}, Sub accounts to delete (duplicates): ${subAccountsToDelete.length}`);

        // Delete duplicate sub accounts first
        let deletedSubCount = 0;
        if (subAccountsToDelete.length > 0) {
          const { error: deleteSubError } = await supabase
            .from(getTableName('company_main_sub_acc'))
            .delete()
            .in('id', subAccountsToDelete);

          if (deleteSubError) {
            console.error('Error deleting duplicate sub accounts:', deleteSubError);
            toast(`Warning: Could not delete ${subAccountsToDelete.length} duplicate sub accounts: ${deleteSubError.message}`, { icon: '⚠️' });
          } else {
            deletedSubCount = subAccountsToDelete.length;
            console.log(`✅ Deleted ${deletedSubCount} duplicate sub accounts`);
          }
        }

        // Update non-duplicate sub accounts
        let updatedSubCount = 0;
        if (subAccountsToUpdate.length > 0) {
          const { data: updatedSubAccounts, error: subAccountsError } = await supabase
            .from(getTableName('company_main_sub_acc'))
            .update({ company_name: newCompanyName })
            .in('id', subAccountsToUpdate)
            .select();

          if (subAccountsError) {
            console.error('Error updating company_main_sub_acc:', subAccountsError);
            toast.error(`Failed to update sub accounts: ${subAccountsError.message}`);
            setLoading(false);
            return;
          }

          updatedSubCount = updatedSubAccounts?.length || 0;
          console.log(`✅ Updated ${updatedSubCount} sub accounts`);
        }

        const subAccountsUpdated = updatedSubCount + deletedSubCount;

        // STEP 3: Update ALL cash_book entries with the old company name
        // Using direct database update to ensure ALL entries are updated, not just those in memory
        console.log(`Updating ALL cash_book entries with company_name = "${oldCompanyName}"...`);
        const { data: updatedCashBookEntries, error: cashBookError } = await supabase
          .from(getTableName('cash_book'))
          .update({ company_name: newCompanyName })
          .eq('company_name', oldCompanyName)
          .select('id');

        if (cashBookError) {
          console.error('Error updating cash_book entries:', cashBookError);
          toast.error(`Failed to update cash book entries: ${cashBookError.message}`);
          toast(
            `However, ${mainAccountsUpdated} main accounts and ${subAccountsUpdated} sub accounts were updated. ` +
            `You may need to manually update cash book entries.`,
            { icon: '⚠️' }
          );
          setLoading(false);
          return;
        }

        const cashBookEntriesUpdated = updatedCashBookEntries?.length || 0;
        console.log(`✅ Updated ${cashBookEntriesUpdated} cash book entries`);

        if (cashBookEntriesUpdated > 0 || mainAccountsUpdated > 0 || subAccountsUpdated > 0) {
          // STEP 4: Delete the old company name from companies table
          // Since all entries have been moved to the new company name, it's safe to delete
          console.log(`Deleting old company name "${oldCompanyName}" from companies table...`);
          let oldCompanyDeleted = false;
          
          try {
            const { error: companyDeleteError } = await supabase
              .from(getTableName('companies'))
              .delete()
              .eq('company_name', oldCompanyName);

            if (companyDeleteError) {
              console.warn('Warning: Could not delete old company name from companies table:', companyDeleteError);
              // Don't fail the whole operation if deletion fails - it's a cleanup step
              toast(
                `Company name replaced successfully, but could not delete old company "${oldCompanyName}" from companies list.`,
                { icon: '⚠️', duration: 4000 }
              );
            } else {
              console.log('✅ Old company name deleted from companies table');
              oldCompanyDeleted = true;
            }
          } catch (deleteErr) {
            console.error('Error deleting old company name:', deleteErr);
            // Continue with success message even if deletion fails
          }

          await loadEntries();
          await loadDropdownData(); // Refresh dropdown data
          
          // Invalidate and refetch React Query cache to refresh recent transactions in New Entry
          // This ensures that updated entries show up in the recent transactions section automatically
          // WITHOUT showing them as deleted - they are UPDATED, not deleted
          console.log('🔄 Refreshing recent entries queries to update New Entry recent transactions...');
          
          // Invalidate all relevant queries
          queryClient.invalidateQueries({ queryKey: ['recentEntries'] }); // Invalidate all date-specific recent entries
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'recentEntries'] }); // Invalidate general recent entries
          queryClient.invalidateQueries({ queryKey: ['cashBook'] }); // Invalidate all cash book queries
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }); // Invalidate dashboard stats
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'companyBalances'] }); // Invalidate company balances
          
          // Force refetch all recent entries queries to update immediately
          // This ensures New Entry page shows updated data without manual refresh
          // The records are UPDATED (not deleted), so they will show with new company name
          await queryClient.refetchQueries({ queryKey: ['recentEntries'] });
          await queryClient.refetchQueries({ queryKey: ['dashboard', 'recentEntries'] });
          await queryClient.refetchQueries({ queryKey: ['cashBook'] });
          
          // Invalidate and refetch companies dropdown to update company list in New Entry
          // This ensures the dropdown shows updated company names after replacement
          queryClient.invalidateQueries({ queryKey: queryKeys.dropdowns.companies() });
          await queryClient.refetchQueries({ queryKey: queryKeys.dropdowns.companies() });
          
          console.log('✅ Recent entries and companies dropdown refreshed - New Entry will update automatically with new company names');
          
          const successMessage = oldCompanyDeleted
            ? `Company name replaced successfully! ` +
              `${cashBookEntriesUpdated} cash book entries, ` +
              `${mainAccountsUpdated} main accounts, ` +
              `${subAccountsUpdated} sub accounts updated. ` +
              `Old company "${oldCompanyName}" deleted from companies list.`
            : `Company name replaced successfully! ` +
              `${cashBookEntriesUpdated} cash book entries, ` +
              `${mainAccountsUpdated} main accounts, ` +
              `${subAccountsUpdated} sub accounts updated.`;
          
          toast.success(successMessage, { duration: 5000 });
          
          setReplaceData(prev => ({
            ...prev,
            oldCompanyName: '',
            newCompanyName: '',
          }));
          
          // Trigger dashboard refresh
          localStorage.setItem('dashboard-refresh', Date.now().toString());
          window.dispatchEvent(new CustomEvent('dashboard-refresh'));
        } else {
          toast('No records were updated. Please check if the company name exists in the database.', { icon: '⚠️' });
        }
      } catch (error) {
        console.error('Error replacing company names:', error);
        toast.error('Failed to replace company names');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setReplaceData({
      oldCompanyName: '',
      newCompanyName: '',
      oldAccountName: '',
      oldSubAccount: '',
      newAccountName: '',
      newSubAccount: '',
    });
    setFilteredEntries([]);
    toast.success('Form reset');
  };

  if (!isAdmin) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='text-center'>
          <AlertCircle className='w-16 h-16 text-red-500 mx-auto mb-4' />
          <h2 className='text-xl font-semibold text-gray-900 mb-2'>
            Access Denied
          </h2>
          <p className='text-gray-600'>
            Only administrators can access the replace form.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-3 mb-1'>
            <h1 className='text-3xl font-bold text-gray-900'>Replace Form</h1>
            <ModeLabel />
          </div>
          <p className='text-gray-600'>
            Bulk replace account names and sub-accounts across all records
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Button variant='secondary' onClick={loadEntries}>
            Refresh
          </Button>
          <Button variant='secondary' onClick={resetForm}>
            Reset
          </Button>
        </div>
      </div>

      {/* Replace Form */}
      <Card className='bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'>
        <div className='space-y-6'>
          {/* Company Name Replacement */}
          <div className={`bg-white p-6 rounded-lg border border-gray-200 ${replaceData.oldAccountName || replaceData.oldSubAccount ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              Replace Company Name
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <SearchableSelect
                  label='Old Company Name'
                  value={replaceData.oldCompanyName}
                  onChange={value => handleInputChange('oldCompanyName', value)}
                  options={[
                    { value: '', label: 'Select old company...' },
                    ...companies,
                  ]}
                  placeholder='Select old company...'
                  disabled={!!replaceData.oldAccountName || !!replaceData.oldSubAccount}
                />
                {replaceData.oldCompanyName && (
                  <div className='mt-2 text-xs font-semibold text-gray-700 bg-gray-55 p-2 rounded border border-gray-200'>
                    Entries ready to move: <span className='text-red-600 font-bold'>{companyCounts.oldReady}</span>
                  </div>
                )}
              </div>
              <div>
                <SearchableSelect
                  label='New Company Name'
                  value={replaceData.newCompanyName}
                  onChange={value => handleInputChange('newCompanyName', value)}
                  options={[
                    { value: '', label: 'Select new company...' },
                    ...companies.filter(c => c.value !== replaceData.oldCompanyName),
                  ]}
                  placeholder='Select new company...'
                  disabled={!!replaceData.oldAccountName || !!replaceData.oldSubAccount}
                />
                {replaceData.newCompanyName && (
                  <div className='mt-2 text-xs text-gray-700 bg-gray-55 p-2 rounded border border-gray-200 space-y-1'>
                    <div>Existing entries: <span className='font-semibold text-gray-900'>{companyCounts.newExisting}</span></div>
                    <div>Entries being added: <span className='font-semibold text-green-600'>+{companyCounts.newAdded}</span></div>
                    <div className='border-t border-gray-300 pt-1 font-bold text-gray-900'>
                      Total after replace: {companyCounts.newTotal}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='mt-4 flex justify-center'>
              <Button
                onClick={handleReplaceCompanyName}
                disabled={
                  !replaceData.oldCompanyName ||
                  !replaceData.newCompanyName ||
                  loading ||
                  replaceData.oldCompanyName.trim() === replaceData.newCompanyName.trim() ||
                  !!replaceData.oldAccountName ||
                  !!replaceData.oldSubAccount
                }
                className='bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Replace Company Name
              </Button>
            </div>
          </div>

          {/* Account Name Replacement */}
          <div className={`bg-white p-6 rounded-lg border border-gray-200 ${replaceData.oldCompanyName || replaceData.oldSubAccount ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              Replace Account Name
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <SearchableSelect
                  label='Old Account Name'
                  value={replaceData.oldAccountName}
                  onChange={value => handleInputChange('oldAccountName', value)}
                  options={[
                    { value: '', label: 'Select old account...' },
                    ...accounts,
                  ]}
                  placeholder='Select old account...'
                  disabled={!!replaceData.oldCompanyName || !!replaceData.oldSubAccount}
                />
                {replaceData.oldAccountName && (
                  <div className='mt-2 text-xs font-semibold text-gray-700 bg-gray-55 p-2 rounded border border-gray-200'>
                    Entries ready to move: <span className='text-red-600 font-bold'>{accountCounts.oldReady}</span>
                  </div>
                )}
              </div>
              <div>
                <SearchableSelect
                  label='New Account Name'
                  value={replaceData.newAccountName}
                  onChange={value => handleInputChange('newAccountName', value)}
                  options={[
                    { value: '', label: 'Select new account...' },
                    ...newAccounts.filter(a => a.value !== replaceData.oldAccountName),
                  ]}
                  placeholder='Select new account...'
                  disabled={!!replaceData.oldCompanyName || !!replaceData.oldSubAccount}
                />
                {replaceData.newAccountName && (
                  <div className='mt-2 text-xs text-gray-700 bg-gray-55 p-2 rounded border border-gray-200 space-y-1'>
                    <div>Existing entries: <span className='font-semibold text-gray-900'>{accountCounts.newExisting}</span></div>
                    <div>Entries being added: <span className='font-semibold text-green-600'>+{accountCounts.newAdded}</span></div>
                    <div className='border-t border-gray-300 pt-1 font-bold text-gray-900'>
                      Total after replace: {accountCounts.newTotal}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='mt-4 flex justify-center'>
              <Button
                onClick={handleReplaceAccountName}
                disabled={
                  !replaceData.oldAccountName ||
                  !replaceData.newAccountName ||
                  loading ||
                  replaceData.oldAccountName.trim() === replaceData.newAccountName.trim() ||
                  !!replaceData.oldCompanyName ||
                  !!replaceData.oldSubAccount
                }
                className='bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Replace Account Name
              </Button>
            </div>
          </div>

          {/* Sub Account Replacement */}
          <div className={`bg-white p-6 rounded-lg border border-gray-200 ${replaceData.oldCompanyName || replaceData.oldAccountName ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              Replace Sub Account
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <SearchableSelect
                  label='Old Sub Account'
                  value={replaceData.oldSubAccount}
                  onChange={value => handleInputChange('oldSubAccount', value)}
                  options={[
                    { value: '', label: 'Select old sub account...' },
                    ...subAccounts,
                  ]}
                  placeholder='Select old sub account...'
                  disabled={!!replaceData.oldCompanyName || !!replaceData.oldAccountName}
                />
                {replaceData.oldSubAccount && (
                  <div className='mt-2 text-xs font-semibold text-gray-700 bg-gray-55 p-2 rounded border border-gray-200'>
                    Entries ready to move: <span className='text-red-600 font-bold'>{subAccountCounts.oldReady}</span>
                  </div>
                )}
              </div>
              <div>
                <SearchableSelect
                  label='New Sub Account'
                  value={replaceData.newSubAccount}
                  onChange={value => handleInputChange('newSubAccount', value)}
                  options={[
                    { value: '', label: 'Select new sub account...' },
                    ...newSubAccounts.filter(s => s.value !== replaceData.oldSubAccount),
                  ]}
                  placeholder='Select new sub account...'
                  disabled={!!replaceData.oldCompanyName || !!replaceData.oldAccountName}
                />
                {replaceData.newSubAccount && (
                  <div className='mt-2 text-xs text-gray-700 bg-gray-55 p-2 rounded border border-gray-200 space-y-1'>
                    <div>Existing entries: <span className='font-semibold text-gray-900'>{subAccountCounts.newExisting}</span></div>
                    <div>Entries being added: <span className='font-semibold text-green-600'>+{subAccountCounts.newAdded}</span></div>
                    <div className='border-t border-gray-300 pt-1 font-bold text-gray-900'>
                      Total after replace: {subAccountCounts.newTotal}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='mt-4 flex justify-center'>
              <Button
                onClick={handleReplaceSubAccount}
                disabled={
                  !replaceData.oldSubAccount ||
                  !replaceData.newSubAccount ||
                  loading ||
                  replaceData.oldSubAccount.trim() === replaceData.newSubAccount.trim() ||
                  !!replaceData.oldCompanyName ||
                  !!replaceData.oldAccountName
                }
                className='bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Replace Sub Account
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card className='bg-gradient-to-r from-blue-500 to-blue-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm font-medium'>Total Records</p>
              <p className='text-2xl font-bold'>{summary.totalRecords.toLocaleString()}</p>
              <p className='text-blue-200 text-xs mt-1'>
                {replaceData.oldCompanyName || replaceData.oldAccountName || replaceData.oldSubAccount
                  ? 'Matching selected criteria'
                  : 'All entries in database'}
              </p>
            </div>
            <FileText className='w-8 h-8 text-blue-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-green-500 to-green-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm font-medium'>Total Credit</p>
              <p className='text-xl font-bold'>
{summary.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className='w-8 h-8 text-green-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-red-500 to-red-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm font-medium'>Total Debit</p>
              <p className='text-xl font-bold'>
{summary.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingDown className='w-8 h-8 text-red-200' />
          </div>
        </Card>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <Card>
          <div className='flex items-center justify-center p-8'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
              <p className='text-gray-600'>Loading entries...</p>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
};

export default ReplaceForm;
