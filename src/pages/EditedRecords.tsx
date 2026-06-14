import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Select from '../components/UI/Select';
import { supabaseDB, User } from '../lib/supabaseDatabase';
import { useTableMode } from '../contexts/TableModeContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import { useBook } from '../contexts/BookContext';
import { RefreshCw, AlertTriangle } from 'lucide-react';
type AuditLogEntry = {
  id: string;
  cash_book_id: string;
  old_values: string;
  new_values: string;
  edited_by: string;
  edited_at: string;
  action?: string;
};

const FIELDS = [
  { key: 'c_date', label: 'Date' },
  { key: 'company_name', label: 'Company' },
  { key: 'acc_name', label: 'Main A/c' },
  { key: 'sub_acc_name', label: 'SubAccount' },
  { key: 'particulars', label: 'Particulars' },
  { key: 'sale_qty', label: 'Purchase Qty' },
  { key: 'purchase_qty', label: 'Sale Qty' },
  { key: 'credit', label: 'Credit' },
  { key: 'debit', label: 'Debit' },
  { key: 'staff', label: 'Staff' },
  { key: 'users', label: 'User' },
  { key: 'entry_time', label: 'Entry Time' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

type CashBookPartial = Partial<Record<FieldKey, any>>;

const PAGE_SIZE = 20;

const highlightClass = 'bg-yellow-100 font-semibold';

const getFieldDisplay = (field: FieldKey, value: any) => {
  if (field === 'credit' || field === 'debit') {
    return value ? `${Number(value).toLocaleString()}` : '-';
  }
  if (field === 'sale_qty' || field === 'purchase_qty') {
    return value !== null && value !== undefined && value !== '' 
      ? `${Number(value).toLocaleString()}` 
      : '-';
  }
  if (field === 'c_date' && value) {
    return !isNaN(new Date(value).getTime())
      ? format(new Date(value), 'dd/MM/yyyy')
      : value;
  }
  if (field === 'entry_time' && value) {
    return !isNaN(new Date(value).getTime())
      ? format(new Date(value), 'HH:mm:ss')
      : value;
  }
  // No cleaning needed - data comes clean from database
  return value || '-';
};

const getChangedFields = (oldObj: CashBookPartial, newObj: CashBookPartial) => {
  const changed: Record<FieldKey, boolean> = {} as Record<FieldKey, boolean>;
  for (const { key } of FIELDS) {
    if ((oldObj?.[key] ?? '') !== (newObj?.[key] ?? '')) {
      changed[key] = true;
    }
  }
  return changed;
};

const EditedRecords = () => {
  const { mode: tableMode } = useTableMode();
  const { currentBook } = useBook();
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [editedDates, setEditedDates] = useState<string[]>([]);

  // Reload data when mode or book changes
  useEffect(() => {
    loadData();
  }, [tableMode, currentBook?.id]);

  // Listen for dashboard refresh events to reload data when records are deleted
  useEffect(() => {
    const onRefresh = () => {
      console.log('[EditedRecords] Dashboard refresh triggered, reloading data...');
      loadData();
    };
    window.addEventListener('dashboard-refresh', onRefresh);
    return () => window.removeEventListener('dashboard-refresh', onRefresh);
  }, []);

  // Listen for dashboard refresh events to reload data
  useEffect(() => {
    const handleDashboardRefresh = () => {
      console.log('🔄 Dashboard refresh event received, reloading Edited Records data...');
      loadData();
    };

    window.addEventListener('dashboard-refresh', handleDashboardRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleDashboardRefresh);
  }, []);

  const loadData = async () => {
    if (isLoadingData) {
      console.log('⚠️ Already loading data, ignoring duplicate call');
      return;
    }
    
    setIsLoadingData(true);
    setLoading(true);
    
    try {
      console.log('🔄 Loading Edited Records data...');
      
      // Load edit audit log, users, and distinct edited dates
      const [log, users, distinctDates] = await Promise.all([
        supabaseDB.getEditAuditLog(),
        supabaseDB.getUsers(),
        supabaseDB.getDistinctEditedDates(),
      ]);
      
      // Set the distinct edited dates for the dropdown
      setEditedDates(distinctDates);
      
      setAuditLog((log || []) as AuditLogEntry[]);
      setUsers((users || []) as User[]);
      
      console.log(`✅ Loaded Edited Records data:`, {
        editLog: (log || []).length,
        users: (users || []).length,
      });
      
      // Debug: Log the actual data structure
      if (log && log.length > 0) {
        console.log('📝 Sample audit log record:', log[0]);
        console.log('📝 Audit log record keys:', Object.keys(log[0]));
      }
      
      // Show consolidated message
      const editCount = (log || []).length;
      if (editCount > 0) {
          const isShowingRecords = (log || []).some(rec => rec.action === 'SHOWING_RECORDS' || rec.action === 'SHOWING_RECENT_ENTRIES');
          if (isShowingRecords) {
            toast(`Showing ${editCount} recent entries from cash_book (no edit history available yet)`);
          } else {
            toast.success(`Loaded ${editCount} edit records`);
          }
      } else {
        toast('No edit records found. This is normal if no records have been modified yet.');
      }
      
    } catch (error) {
      console.error('❌ Error loading Edited Records data:', error);
      setAuditLog([]);
      setUsers([]);
      toast.error('Failed to load Edited Records data. Please try again.');
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };

  // Map userId to username
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.id] = u.username;
    });
    return map;
  }, [users]);

  // Build dropdown of distinct edited dates (YYYY-MM-DD) - using dates fetched from database
  const editedDateOptions = useMemo(() => {
    // Use the dates fetched directly from database, sorted in descending order (newest first)
    const sortedDates = [...editedDates].sort((a, b) => (a < b ? 1 : -1));
    return [
      { value: '', label: 'All Dates' },
      ...sortedDates.map(d => ({ 
        value: d, 
        label: format(new Date(d), 'dd/MM/yyyy') 
      }))
    ];
  }, [editedDates]);

  // Filtered and searched log
  const filteredLog = useMemo(() => {
    console.log('🔍 Filtering audit log:', {
      totalAuditLog: auditLog.length,
      selectedDate,
      userFilter
    });
    
    const filtered = auditLog.filter(log => {
      const oldObj: CashBookPartial = log.old_values
        ? JSON.parse(log.old_values)
        : {};
      const newObj: CashBookPartial = log.new_values
        ? JSON.parse(log.new_values)
        : {};
      // Compute if any field actually changed
      const changedMap = getChangedFields(oldObj, newObj);
      const hasAnyChange = Object.values(changedMap).some(Boolean);
      
      // Date-wise filter: normalize edited_at date to YYYY-MM-DD format
      // Use the same extraction method as getDistinctEditedDates (slice(0, 10))
      let editedDate = '';
      if (log.edited_at) {
        try {
          const dateStr = String(log.edited_at);
          // Extract first 10 characters (YYYY-MM-DD) - same as getDistinctEditedDates
          editedDate = dateStr.slice(0, 10);
          
          // Validate that we got a valid date format
          if (!editedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // If slice didn't work, try regex extraction
            const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              editedDate = dateMatch[1];
            } else {
              // Fallback: try parsing as Date object
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                editedDate = format(parsedDate, 'yyyy-MM-dd');
              }
            }
          }
        } catch (error) {
          console.warn('Error parsing edited_at date:', log.edited_at, error);
        }
      }
      
      // Debug logging for date matching (only when filter is active)
      if (selectedDate && selectedDate !== '') {
        console.log('🔍 Date filter check:', {
          logId: log.id,
          edited_at_raw: log.edited_at,
          editedDate_extracted: editedDate,
          selectedDate,
          matches: editedDate === selectedDate,
          matchLength: editedDate.length,
          selectedLength: selectedDate.length
        });
      }
      
      const matchesDate = selectedDate === '' || editedDate === selectedDate;
      
      // User filter: match by username (edited_by contains username, userFilter now contains username)
      const matchesUser = userFilter === '' || log.edited_by === userFilter;
      
      // Exclude deletes and synthetic recent entries
      const isDelete = log.action === 'DELETE' || (log.new_values == null && log.old_values != null);
      const isSyntheticRecent = log.action === 'SHOWING_RECENT_ENTRIES';
      const result = matchesDate && matchesUser && !isDelete && !isSyntheticRecent && hasAnyChange;
      
      if (!result && (selectedDate || userFilter)) {
        console.log('🔍 Filtered out record:', {
          id: log.id,
          editedDate,
          selectedDate,
          matchesDate,
          editedBy: log.edited_by,
          userFilter,
          matchesUser,
          isDelete,
          isSyntheticRecent,
          hasAnyChange
        });
      }
      
      return result;
    });
    
    console.log('🔍 Filtered result:', filtered.length, 'records out of', auditLog.length);
    return filtered;
  }, [auditLog, selectedDate, userFilter, users]);


  // Pagination
  const totalPages = Math.ceil(filteredLog.length / PAGE_SIZE);
  const paginatedLog = filteredLog.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );



  // Print
  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) return;
    printWindow.document.write('<html><head><title>Edit Audit Log</title>');
    printWindow.document.write(
      '<style>table { border-collapse: collapse; width: 100%; font-size: 12px; } th, td { border: 1px solid #ccc; padding: 4px; } th { background: #f9fafb; }</style>'
    );
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>Edit Audit Log</h2>');
    printWindow.document.write('<table><thead><tr>');
    printWindow.document.write('<th>S.No</th>');
    FIELDS.forEach(f =>
      printWindow.document.write(`<th>${f.label} (Before)</th>`)
    );
    FIELDS.forEach(f =>
      printWindow.document.write(`<th>${f.label} (After)</th>`)
    );
    printWindow.document.write(
      '<th>Edited By</th><th>Edited At</th></tr></thead><tbody>'
    );
    filteredLog.forEach((log, idx) => {
      const oldObj = log.old_values ? JSON.parse(log.old_values) : {};
      const newObj = log.new_values ? JSON.parse(log.new_values) : {};
      printWindow.document.write('<tr>');
      printWindow.document.write(`<td>${idx + 1}</td>`);
      FIELDS.forEach(f =>
        printWindow.document.write(
          `<td>${getFieldDisplay(f.key, oldObj[f.key])}</td>`
        )
      );
      FIELDS.forEach(f =>
        printWindow.document.write(
          `<td>${getFieldDisplay(f.key, newObj[f.key])}</td>`
        )
      );
      printWindow.document.write(
        `<td>${userMap[log.edited_by] || log.edited_by}</td>`
      );
      printWindow.document.write(
        `<td>${log.edited_at && !isNaN(new Date(log.edited_at).getTime()) ? format(new Date(log.edited_at), 'dd/MM/yyyy HH:mm') : ''}</td>`
      );
      printWindow.document.write('</tr>');
    });
    printWindow.document.write('</tbody></table></body></html>');
    printWindow.document.close();
    printWindow.print();
  };



  // Check if we're showing recent entries instead of actual edits
  const isShowingRecentEntries = filteredLog.some(rec => rec.action === 'SHOWING_RECENT_ENTRIES');
  return (
    <div className='space-y-6'>
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
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 flex items-center gap-2.5'>
            {isShowingRecentEntries ? 'Recent Records (No Edit History Available)' : 'Edited Records'}
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
          <p className='text-gray-600 mt-1'>
            {isShowingRecentEntries ? `Showing ${filteredLog.length} recent entries` : `Edits: ${filteredLog.length}`}
          </p>
        </div>
      </div>

      <ModeLabel />
      <Card>
      <div className='flex flex-wrap gap-3 mb-4 items-end'>
        <Select
          label='Edited Date'
          value={selectedDate}
          onChange={setSelectedDate}
          options={editedDateOptions}
          className='w-48'
        />
        <Select
          label='Edited By'
          value={userFilter}
          onChange={setUserFilter}
          options={[
            { value: '', label: 'All Users' },
            ...users.map(u => ({ value: u.username, label: u.username })),
          ]}
          className='w-48'
        />
        <Button 
          onClick={loadData} 
          variant='secondary' 
          size='sm'
          disabled={loading}
          className='flex items-center gap-2'
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
        <Button onClick={handlePrint} variant='secondary' size='sm'>
          Print
        </Button>
      </div>
      {loading ? (
        <div className='text-center py-8 text-blue-600 font-semibold'>
          Loading edit history...
        </div>
      ) : filteredLog.length === 0 ? (
        <div className='text-center py-8'>
          <div className='text-gray-500 mb-2'>
            No edit history found.
          </div>
          <div className='text-sm text-gray-400'>
            This is normal if no records have been edited yet.
          </div>
        </div>
      ) : (
        <>

          <div className='overflow-x-auto'>
          <table className='w-full text-xs table-fixed border border-gray-200'>
            <thead className='sticky top-0 bg-gray-50 z-10'>
              <tr className='border-b border-gray-200'>
                <th className='w-12 px-1 py-1 text-left font-medium text-gray-700'>
                  S.No
                </th>
                <th className='w-16 px-1 py-1 text-left font-medium text-gray-700'>
                  Type
                </th>
                {FIELDS.map(f => (
                  <th key={f.key} className='w-20 px-1 py-1 text-left font-medium text-gray-700'>
                    {f.label}
                  </th>
                ))}
                <th className='w-20 px-1 py-1 text-left font-medium text-gray-700'>
                  Edited By
                </th>
                <th className='w-20 px-1 py-1 text-left font-medium text-gray-700'>
                  Edited At
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLog.map((log, idx) => {
                const oldObj = log.old_values ? JSON.parse(log.old_values) : {};
                const newObj = log.new_values ? JSON.parse(log.new_values) : {};
                const changed = getChangedFields(oldObj, newObj);
                return (
                  <React.Fragment key={log.id}>
                    {/* Before Edit Row (no background color) */}
                    <tr className='border-b border-gray-100 hover:bg-gray-50'>
                      <td className='w-12 px-1 py-1 text-center text-sm font-bold' rowSpan={1}>
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className='w-16 px-1 py-1 font-semibold text-red-600 text-sm font-bold'>
                        {log.action === 'SHOWING_RECENT_ENTRIES' ? 'Entry' : 'Before'}
                      </td>
                      {FIELDS.map(f => (
                        <td
                          key={f.key + '-before'}
                          className='w-20 px-1 py-1 text-sm truncate font-bold'
                          title={getFieldDisplay(f.key, oldObj[f.key])}
                        >
                          {getFieldDisplay(f.key, oldObj[f.key])}
                        </td>
                      ))}
                      <td className='w-20 px-1 py-1 text-sm truncate font-bold' title={userMap[log.edited_by] || log.edited_by}>
                        {userMap[log.edited_by] || log.edited_by}
                      </td>
                      <td className='w-20 px-1 py-1 text-sm font-bold'>
                        {log.edited_at &&
                        !isNaN(new Date(log.edited_at).getTime())
                          ? format(new Date(log.edited_at), 'dd/MM/yyyy HH:mm')
                          : ''}
                      </td>
                    </tr>
                    {/* After Edit Row */}
                    <tr className='border-b border-gray-100 hover:bg-gray-50'>
                      <td className='w-12 px-1 py-1 text-center text-sm'></td>
                      <td className='w-16 px-1 py-1 font-semibold text-green-700 text-sm font-bold'>
                        {log.action === 'SHOWING_RECENT_ENTRIES' ? 'Details' : 'After'}
                      </td>
                      {FIELDS.map(f => (
                        <td
                          key={f.key + '-after'}
                          className={`w-20 px-1 py-1 text-sm truncate font-bold ${changed[f.key] ? highlightClass : ''}`}
                          title={getFieldDisplay(f.key, newObj[f.key])}
                        >
                          {getFieldDisplay(f.key, newObj[f.key])}
                        </td>
                      ))}
                      <td className='w-20 px-1 py-1 text-sm truncate font-bold' title={userMap[log.edited_by] || log.edited_by}>
                        {userMap[log.edited_by] || log.edited_by}
                      </td>
                      <td className='w-20 px-1 py-1 text-sm font-bold'>
                        {log.edited_at &&
                        !isNaN(new Date(log.edited_at).getTime())
                          ? format(new Date(log.edited_at), 'dd/MM/yyyy HH:mm')
                          : ''}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex justify-center items-center gap-2 mt-4'>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className='text-sm'>
                Page {page} of {totalPages}
              </span>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
          </div>
        </>
      )}

      </Card>
    </div>
  );
};

export default EditedRecords;
