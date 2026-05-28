import React, { useState, useEffect } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import { useTableMode } from '../contexts/TableModeContext';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import { format, differenceInDays } from 'date-fns';
import { BankGuarantee } from '../lib/supabaseDatabase';
import { supabaseDB } from '../lib/supabaseDatabase';
import {
  CreditCard,
  AlertTriangle,
  DollarSign,
  Search,
  CheckCircle,
  Edit,
  Save,
  Trash2,
} from 'lucide-react';

const BankGuarantees: React.FC = () => {
  const { mode: tableMode } = useTableMode();
  const [bankGuarantees, setBankGuarantees] = useState<BankGuarantee[]>([]);
  const [filteredBGs, setFilteredBGs] = useState<BankGuarantee[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBG, setEditingBG] = useState<BankGuarantee | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBG, setSelectedBG] = useState<BankGuarantee | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelledBGs, setShowCancelledBGs] = useState(false);
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    expiryStatus: '',
  });

  const [newBG, setNewBG] = useState({
    bg_no: '',
    issue_date: '',
    exp_date: '',
    work_name: '',
    credit: 0,
    debit: 0,
    department: '',
    cancelled: false,
  });

  // Summary stats
  const [stats, setStats] = useState({
    totalBGs: 0,
    activeBGs: 0,
    cancelledBGs: 0,
    expiredBGs: 0,
    expiringBGs: 0,
    totalCredit: 0,
    totalDebit: 0,
  });

  useEffect(() => {
    loadBankGuarantees();
    loadCustomDepartments();
  }, [tableMode]);

  useEffect(() => {
    applyFilters();
    updateStats();
  }, [bankGuarantees, searchTerm, filters, showCancelledBGs]);

  const loadCustomDepartments = () => {
    try {
      const stored = localStorage.getItem('bg_custom_departments');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCustomDepartments(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading custom departments:', error);
    }
  };

  const saveCustomDepartments = (departments: string[]) => {
    try {
      localStorage.setItem('bg_custom_departments', JSON.stringify(departments));
      setCustomDepartments(departments);
    } catch (error) {
      console.error('Error saving custom departments:', error);
      toast.error('Failed to save department');
    }
  };

  const handleKeepDepartment = () => {
    const currentDept = editingBG ? editingBG.department : newBG.department;
    if (!currentDept || !currentDept.trim()) {
      toast.error('Please enter a department name');
      return;
    }

    const trimmed = currentDept.trim();
    if (customDepartments.includes(trimmed)) {
      toast.error('This department already exists');
      return;
    }

    const updated = [...customDepartments, trimmed];
    saveCustomDepartments(updated);
    toast.success('Department saved successfully');
  };

  const handleDeleteDepartment = (department: string) => {
    if (window.confirm(`Are you sure you want to delete "${department}"?`)) {
      const updated = customDepartments.filter(d => d !== department);
      saveCustomDepartments(updated);
      toast.success('Department deleted successfully');
    }
  };

  const loadBankGuarantees = async () => {
    setLoading(true);
    try {
      const bankGuaranteesData = await supabaseDB.getBankGuarantees();
      setBankGuarantees(bankGuaranteesData);
    } catch (error) {
      console.error('Error loading bank guarantees:', error);
      toast.error('Failed to load bank guarantees');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bankGuarantees];

    // Show/hide cancelled BGs
    if (!showCancelledBGs) {
      filtered = filtered.filter(bg => !bg.cancelled);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        bg =>
          bg.bg_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bg.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bg.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(bg => bg.department === filters.department);
    }

    // Status filter
    if (filters.status) {
      if (filters.status === 'active') {
        filtered = filtered.filter(bg => !bg.cancelled);
      } else if (filters.status === 'cancelled') {
        filtered = filtered.filter(bg => bg.cancelled);
      }
    }

    // Expiry status filter
    if (filters.expiryStatus) {
      filtered = filtered.filter(bg => {
        const status = getExpiryStatus(bg.exp_date).status;
        return status === filters.expiryStatus;
      });
    }

    setFilteredBGs(filtered);
  };

  const updateStats = () => {
    const totalBGs = bankGuarantees.length;
    const activeBGs = bankGuarantees.filter(bg => !bg.cancelled).length;
    const cancelledBGs = bankGuarantees.filter(bg => bg.cancelled).length;

    let expiredBGs = 0;
    let expiringBGs = 0;

    bankGuarantees.forEach(bg => {
      if (!bg.cancelled) {
        const status = getExpiryStatus(bg.exp_date).status;
        if (status === 'expired') expiredBGs++;
        else if (status === 'expiring') expiringBGs++;
      }
    });

    const totalCredit = bankGuarantees.reduce((sum, bg) => sum + bg.credit, 0);
    const totalDebit = bankGuarantees.reduce((sum, bg) => sum + bg.debit, 0);

    setStats({
      totalBGs,
      activeBGs,
      cancelledBGs,
      expiredBGs,
      expiringBGs,
      totalCredit,
      totalDebit,
    });
  };

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = differenceInDays(expiry, today);

    if (daysUntilExpiry < 0) {
      return {
        status: 'expired',
        color: 'bg-red-500 text-white',
        days: Math.abs(daysUntilExpiry),
      };
    } else if (daysUntilExpiry <= 30) {
      return {
        status: 'expiring',
        color: 'bg-orange-500 text-white',
        days: daysUntilExpiry,
      };
    } else {
      return {
        status: 'valid',
        color: 'bg-green-500 text-white',
        days: daysUntilExpiry,
      };
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    if (editingBG) {
      setEditingBG({ ...editingBG, [field]: value });
    } else {
      setNewBG({ ...newBG, [field]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingBG) {
        // Update existing bank guarantee
        const updatedBG = await supabaseDB.updateBankGuarantee(
          editingBG.id,
          editingBG
        );
        if (updatedBG) {
          await loadBankGuarantees();
          setEditingBG(null);
          toast.success('Bank guarantee updated successfully!');
        } else {
          toast.error('Failed to update bank guarantee');
        }
      } else {
        // Add new bank guarantee
        const newBGData = await supabaseDB.addBankGuarantee(newBG);
        if (newBGData) {
          await loadBankGuarantees();
          setNewBG({
            bg_no: '',
            issue_date: '',
            exp_date: '',
            work_name: '',
            credit: 0,
            debit: 0,
            department: '',
            cancelled: false,
          });
          setShowAddForm(false);
          toast.success('Bank guarantee added successfully!');
        } else {
          toast.error('Failed to add bank guarantee');
        }
      }
    } catch (error) {
      console.error('Error saving bank guarantee:', error);
      toast.error('Failed to save bank guarantee');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bg: BankGuarantee) => {
    setEditingBG({ ...bg });
    setShowAddForm(false);
  };

  const handleCancel = (bgId: string) => {
    if (
      window.confirm('Are you sure you want to cancel this Bank Guarantee?')
    ) {
      const updatedBGs = bankGuarantees.map(bg =>
        bg.id === bgId ? { ...bg, cancelled: true } : bg
      );
      setBankGuarantees(updatedBGs);
      toast.success('Bank Guarantee cancelled successfully!');
    }
  };

  const handleViewDetails = (bg: BankGuarantee) => {
    setSelectedBG(bg);
    setShowDetails(true);
  };

  const exportToExcel = () => {
    const exportData = filteredBGs.map(bg => ({
      'S.No': bg.sno,
      'BG Number': bg.bg_no,
      'Issue Date': bg.issue_date,
      'Expiry Date': bg.exp_date,
      'Work Name': bg.work_name,
      Department: bg.department,
      Credit: bg.credit,
      Debit: bg.debit,
      Status: bg.cancelled ? 'Cancelled' : 'Active',
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
    a.download = `bank-guarantees-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bank Guarantees exported successfully!');
  };

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...customDepartments.map(dept => ({ value: dept, label: dept })),
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const expiryStatusOptions = [
    { value: '', label: 'All Expiry Status' },
    { value: 'expired', label: 'Expired' },
    { value: 'expiring', label: 'Expiring Soon' },
    { value: 'valid', label: 'Valid' },
  ];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-3 mb-1'>
            <h1 className='text-3xl font-bold text-gray-900'>Bank Guarantees</h1>
            <ModeLabel />
          </div>
          <p className='text-gray-600'>
            Comprehensive bank guarantee management with expiry tracking
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Button variant='secondary' onClick={loadBankGuarantees}>
            Refresh
          </Button>
          <Button variant='secondary' onClick={exportToExcel}>
            Export
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingBG(null);
            }}
          >
            Add BG
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card className='bg-gradient-to-r from-blue-500 to-blue-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-blue-100 text-sm font-medium'>Total BGs</p>
              <p className='text-2xl font-bold'>{stats.totalBGs}</p>
            </div>
            <CreditCard className='w-8 h-8 text-blue-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-green-500 to-green-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-green-100 text-sm font-medium'>Active BGs</p>
              <p className='text-2xl font-bold'>{stats.activeBGs}</p>
            </div>
            <CheckCircle className='w-8 h-8 text-green-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-red-500 to-red-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-red-100 text-sm font-medium'>Expired BGs</p>
              <p className='text-2xl font-bold'>{stats.expiredBGs}</p>
            </div>
            <AlertTriangle className='w-8 h-8 text-red-200' />
          </div>
        </Card>

        <Card className='bg-gradient-to-r from-purple-500 to-purple-600 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-purple-100 text-sm font-medium'>
                Total Amount
              </p>
              <p className='text-xl font-bold'>
{(stats.totalCredit + stats.totalDebit).toLocaleString()}
              </p>
            </div>
            <DollarSign className='w-8 h-8 text-purple-200' />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className='bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200'>
        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
          <Select
            label='Department'
            value={filters.department}
            onChange={value =>
              setFilters(prev => ({ ...prev, department: value }))
            }
            options={departmentOptions}
          />

          <Select
            label='Status'
            value={filters.status}
            onChange={value => setFilters(prev => ({ ...prev, status: value }))}
            options={statusOptions}
          />

          <Select
            label='Expiry Status'
            value={filters.expiryStatus}
            onChange={value =>
              setFilters(prev => ({ ...prev, expiryStatus: value }))
            }
            options={expiryStatusOptions}
          />

          <div className='flex items-end'>
            <div className='text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-300 w-full text-center'>
              <strong>{filteredBGs.length}</strong> BGs found
            </div>
          </div>

          <div className='flex flex-col justify-end'>
            <label
              htmlFor='bg-search'
              className='text-sm font-medium text-gray-700 mb-1'
            >
              Search
            </label>
            <div className='relative'>
              <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
              <input
                id='bg-search'
                type='text'
                placeholder='Search BGs...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='pl-10 pr-4 h-12 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base'
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Add/Edit BG Form */}
      {(showAddForm || editingBG) && (
        <Card
          title={
            <div className='flex items-center gap-3'>
              <span>{editingBG ? 'Edit Bank Guarantee' : 'New Bank Guarantee Entry Form'}</span>
              {(() => {
                const count = bankGuarantees.filter(
                  bg => !bg.cancelled && getExpiryStatus(bg.exp_date).status === 'expiring'
                ).length;
                return count > 0 ? (
                  <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300'>
                    <AlertTriangle className='w-3 h-3' />
                    BG expiry due: {count}
                  </span>
                ) : null;
              })()}
            </div>
          }
        >
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <Input
                label='S.No'
                value={
                  editingBG
                    ? editingBG.sno.toString()
                    : (bankGuarantees.length + 1).toString()
                }
                onChange={() => {}}
                disabled
              />

              <Input
                label='BG No.'
                value={editingBG ? editingBG.bg_no : newBG.bg_no}
                onChange={value => handleInputChange('bg_no', value)}
                placeholder='BG/BANK/2025/001'
                required
              />

              <Input
                label='Issue Date'
                type='date'
                value={editingBG ? editingBG.issue_date : newBG.issue_date}
                onChange={value => handleInputChange('issue_date', value)}
                required
              />

              <Input
                label='Exp Date'
                type='date'
                value={editingBG ? editingBG.exp_date : newBG.exp_date}
                onChange={value => handleInputChange('exp_date', value)}
                required
              />
            </div>

            <Input
              label='Work Name'
              value={editingBG ? editingBG.work_name : newBG.work_name}
              onChange={value => handleInputChange('work_name', value)}
              placeholder='Contract or work description...'
              required
            />

            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <div className='flex flex-col'>
                <label className='text-sm font-medium text-gray-700 mb-1'>
                  Department <span className='text-red-500'>*</span>
                </label>
                <div className='flex gap-2'>
                  <Input
                    value={editingBG ? editingBG.department : newBG.department}
                    onChange={value => {
                      handleInputChange('department', value);
                    }}
                    placeholder='Enter department name...'
                    required
                    className='flex-1'
                  />
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={handleKeepDepartment}
                    title='Keep this department for future use'
                    className='px-3 shrink-0'
                  >
                    <Save className='w-4 h-4' />
                  </Button>
                  {(editingBG ? editingBG.department : newBG.department) &&
                    customDepartments.includes(
                      editingBG ? editingBG.department : newBG.department
                    ) && (
                      <Button
                        type='button'
                        variant='secondary'
                        onClick={() =>
                          handleDeleteDepartment(
                            editingBG ? editingBG.department : newBG.department
                          )
                        }
                        title='Delete this department'
                        className='px-3 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50'
                      >
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    )}
                </div>
                {customDepartments.length > 0 && (
                  <div className='mt-2 text-xs text-gray-500'>
                    Saved departments: {customDepartments.join(', ')}
                  </div>
                )}
              </div>

              <Input
                label='Credit'
                type='number'
                value={
                  editingBG
                    ? (editingBG.credit === 0 ? '' : editingBG.credit)
                    : (newBG.credit === 0 ? '' : newBG.credit)
                }
                onChange={value => {
                  if (value === '') {
                    handleInputChange('credit', 0);
                  } else {
                    const num = parseFloat(value as string);
                    handleInputChange('credit', isNaN(num) ? 0 : num);
                  }
                }}
                placeholder='0.00'
                min='0'
                step='0.01'
              />

              <Input
                label='Debit'
                type='number'
                value={
                  editingBG
                    ? (editingBG.debit === 0 ? '' : editingBG.debit)
                    : (newBG.debit === 0 ? '' : newBG.debit)
                }
                onChange={value => {
                  if (value === '') {
                    handleInputChange('debit', 0);
                  } else {
                    const num = parseFloat(value as string);
                    handleInputChange('debit', isNaN(num) ? 0 : num);
                  }
                }}
                placeholder='0.00'
                min='0'
                step='0.01'
              />
            </div>

            <div className='flex gap-4'>
              <Button type='submit' disabled={loading}>
                {loading ? 'Saving...' : editingBG ? 'Update' : 'Add'}
              </Button>

              <Button
                type='button'
                variant='secondary'
                onClick={() => {
                  setShowAddForm(false);
                  setEditingBG(null);
                }}
              >
                Close
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Cancelled BGs Toggle */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <h2 className='text-xl font-semibold text-gray-900'>
            {showCancelledBGs
              ? 'Cancelled Bank Guarantees'
              : 'Active Bank Guarantees'}
          </h2>
          <Button
            variant='secondary'
            onClick={() => setShowCancelledBGs(!showCancelledBGs)}
            className='text-sm'
          >
            {showCancelledBGs ? 'Show Active' : 'Show Cancelled'}
          </Button>
        </div>
      </div>

      {/* Bank Guarantees Table */}
      <Card
        title={
          showCancelledBGs
            ? 'Cancelled Bank Guarantees'
            : 'Bank Guarantees List'
        }
        subtitle={`${filteredBGs.length} bank guarantees`}
      >
        {loading ? (
          <div className='text-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-2 text-gray-600'>Loading bank guarantees...</p>
          </div>
        ) : filteredBGs.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            No bank guarantees found matching your criteria.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 border-b border-gray-200'>
                <tr>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    S.No
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    Number
                  </th>
                  <th className='px-3 py-2 text-center font-medium text-gray-700'>
                    Issue Date
                  </th>
                  <th className='px-3 py-2 text-center font-medium text-gray-700'>
                    Exp Date
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    Work Name
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    Department
                  </th>
                  <th className='px-3 py-2 text-right font-medium text-gray-700'>
                    Credit
                  </th>
                  <th className='px-3 py-2 text-right font-medium text-gray-700'>
                    Debit
                  </th>
                  <th className='px-3 py-2 text-center font-medium text-gray-700'>
                    Cancel
                  </th>
                  <th className='px-3 py-2 text-center font-medium text-gray-700'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBGs.map((bg, index) => {
                  const expiryStatus = getExpiryStatus(bg.exp_date);

                  return (
                    <tr
                      key={bg.id}
                      className={`border-b hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                      } ${bg.cancelled ? 'opacity-60' : ''}`}
                    >
                      <td className='px-3 py-2 font-medium'>{bg.sno}</td>
                      <td className='px-3 py-2 font-medium text-blue-600'>
                        {bg.bg_no}
                      </td>
                      <td className='px-3 py-2 text-center'>
                        {format(new Date(bg.issue_date), 'dd-MM-yyyy')}
                      </td>
                      <td className='px-3 py-2 text-center'>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${expiryStatus.color}`}
                        >
                          {format(new Date(bg.exp_date), 'dd-MM-yyyy')}
                        </span>
                      </td>
                      <td
                        className='px-3 py-2 max-w-xs truncate'
                        title={bg.work_name}
                      >
                        {bg.work_name}
                      </td>
                      <td className='px-3 py-2'>{bg.department}</td>
                      <td className='px-3 py-2 text-right font-medium text-green-600'>
                        {bg.credit > 0
                          ? ` ${bg.credit.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className='px-3 py-2 text-right font-medium text-red-600'>
                        {bg.debit > 0 ? ` ${bg.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className='px-3 py-2 text-center'>
                        {bg.cancelled ? (
                          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800'>
                            Cancelled
                          </span>
                        ) : (
                          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                            Active
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-2 text-center'>
                        <div className='flex items-center justify-center gap-2'>
                          <Button
                            size='sm'
                            variant='secondary'
                            onClick={() => handleViewDetails(bg)}
                            className='px-2'
                          >
                            View
                          </Button>
                          {!bg.cancelled && (
                            <>
                              <Button
                                size='sm'
                                variant='secondary'
                                icon={Edit}
                                onClick={() => handleEdit(bg)}
                                className='px-2'
                              >
                                Edit
                              </Button>
                              <Button
                                size='sm'
                                variant='danger'
                                onClick={() => handleCancel(bg.id)}
                                className='px-2'
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* BG Details Modal */}
      {showDetails && selectedBG && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='text-lg font-semibold flex items-center gap-2'>
                  <CreditCard className='w-5 h-5' />
                  Bank Guarantee Details - {selectedBG.bg_no}
                </h3>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </Button>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='space-y-4'>
                  <div className='bg-blue-50 p-4 rounded-lg'>
                    <h4 className='font-medium text-blue-900 mb-3'>
                      BG Information
                    </h4>
                    <div className='space-y-2 text-sm'>
                      <div>
                        <strong>S.No:</strong> {selectedBG.sno}
                      </div>
                      <div>
                        <strong>BG Number:</strong> {selectedBG.bg_no}
                      </div>
                      <div>
                        <strong>Issue Date:</strong>{' '}
                        {format(
                          new Date(selectedBG.issue_date),
                          'MMM dd, yyyy'
                        )}
                      </div>
                      <div>
                        <strong>Expiry Date:</strong>{' '}
                        {format(new Date(selectedBG.exp_date), 'MMM dd, yyyy')}
                      </div>
                      <div>
                        <strong>Department:</strong> {selectedBG.department}
                      </div>
                      <div>
                        <strong>Status:</strong>
                        <span
                          className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                            selectedBG.cancelled
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {selectedBG.cancelled ? 'Cancelled' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className='bg-green-50 p-4 rounded-lg'>
                    <h4 className='font-medium text-green-900 mb-3'>
                      Financial Details
                    </h4>
                    <div className='space-y-2 text-sm'>
                      <div>
                        <strong>Credit Amount:</strong>                         {selectedBG.credit.toLocaleString()}
                      </div>
                      <div>
                        <strong>Debit Amount:</strong>                         {selectedBG.debit.toLocaleString()}
                      </div>
                      <div>
                        <strong>Net Amount:</strong>                         {(
                          selectedBG.credit + selectedBG.debit
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='space-y-4'>
                  <div className='bg-purple-50 p-4 rounded-lg'>
                    <h4 className='font-medium text-purple-900 mb-3'>
                      Work Details
                    </h4>
                    <div className='text-sm'>
                      <div>
                        <strong>Work Name:</strong>
                      </div>
                      <div className='mt-2 p-3 bg-white rounded border'>
                        {selectedBG.work_name}
                      </div>
                    </div>
                  </div>

                  <div className='bg-orange-50 p-4 rounded-lg'>
                    <h4 className='font-medium text-orange-900 mb-3'>
                      Expiry Status
                    </h4>
                    <div className='text-sm'>
                      {(() => {
                        const status = getExpiryStatus(selectedBG.exp_date);
                        return (
                          <div className='space-y-2'>
                            <div
                              className={`px-3 py-2 rounded text-center font-medium ${status.color}`}
                            >
                              {status.status === 'expired'
                                ? 'EXPIRED'
                                : status.status === 'expiring'
                                  ? 'EXPIRING SOON'
                                  : 'VALID'}
                            </div>
                            <div className='text-center text-gray-600'>
                              {status.status === 'expired'
                                ? `Expired ${status.days} days ago`
                                : `${status.days} days remaining`}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankGuarantees;
