import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { CheckSquare, Square, Save, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserItem {
  id: string;
  username: string;
  userType: string;
}

const FINANCE_FEATURES_LIST = [
  { key: 'finance_dashboard', label: 'Finance Dashboard' },
  { key: 'loan_entry', label: 'Loan Entry' },
  { key: 'edit_loan_entry', label: 'Edit Loan Entry' },
  { key: 'partners', label: 'Partners Management' },
  { key: 'search', label: 'Search / Payments Center' },
  { key: 'calculator', label: 'General Calculator' },
  { key: 'capital_entry', label: 'Capital Entry' },
  { key: 'camera', label: 'Camera Attachment' },
  { key: 'daybook', label: 'Daybook Statement' },
  { key: 'general_ledger', label: 'General Ledger' },
  { key: 'cd_ledger', label: 'CD (Chit Fund) Ledger' },
  { key: 'stbd_ledger', label: 'STBD Ledger' },
  { key: 'hp_ledger', label: 'HP Ledger' },
  { key: 'tbd_ledger', label: 'TBD Ledger' },
  { key: 'dues_ledger', label: 'Dues Ledger' },
  { key: 'pl', label: 'Profit & Loss Report' },
  { key: 'final_statement', label: 'Balance Sheet' },
  { key: 'business_report', label: 'Business Report' },
  { key: 'partner_performance', label: 'Partner Performance' },
  { key: 'new_customers', label: 'New Customers Audit' },
  { key: 'phone_editor', label: 'Phone Number Editor' },
  { key: 'aadhaar_search', label: 'Aadhaar Search Engine' },
  { key: 'logs', label: 'Audit Logs Registry' }
];

const UserAccessManagement: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, string[]>>({});
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsersAndPermissions();
  }, []);

  const fetchUsersAndPermissions = async () => {
    setLoading(true);
    try {
      // 1. Fetch users from DB
      const { data: dbUsers, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          username,
          user_types(user_type)
        `);

      if (usersError) throw usersError;

      const formattedUsers: UserItem[] = (dbUsers || [])
        .map((u: any) => ({
          id: u.id,
          username: u.username,
          userType: u.user_types?.user_type || 'User'
        }))
        // Filter out Admins as they have access to everything automatically
        .filter(u => u.userType !== 'Admin');

      setUsers(formattedUsers);

      // 2. Fetch current finance permissions map
      const map = await supabaseFinance.getFinanceUsersPermissions();
      setPermissionsMap(map);

      if (formattedUsers.length > 0) {
        setSelectedUserId(formattedUsers[0].id);
        setSelectedKeys(map[formattedUsers[0].id] || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load user permissions configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedKeys(permissionsMap[userId] || []);
  };

  const handleToggleKey = (key: string) => {
    setSelectedKeys(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(FINANCE_FEATURES_LIST.map(f => f.key));
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const success = await supabaseFinance.updateFinanceUserPermissions(selectedUserId, selectedKeys);
      if (success) {
        toast.success('Operator access permissions updated successfully!');
        
        // Update local map cache
        setPermissionsMap(prev => ({
          ...prev,
          [selectedUserId]: selectedKeys
        }));
      } else {
        toast.error('Failed to update operator permissions');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h1 className="finance-h1">OPERATOR ACCESS CONTROL</h1>
          <p className="mt-1 finance-small-label uppercase">Configure feature access rights for operators in Finance Mode (Admins bypass all rules)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-slate-900"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed rounded bg-slate-50">
          <Users className="w-12 h-12 mx-auto mb-2 text-slate-400" />
          <p className="text-slate-650 finance-input">No operators registered</p>
          <p className="mt-1 finance-caption">Access control only applies to user accounts of 'Operator' type. All admins automatically retain full access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User selection panel */}
          <Card title="Operators Registry" subtitle="Select an operator to manage feature permissions">
            <div className="space-y-2">
              {users.map(u => (
                <div
                  key={u.id}
                  onClick={() => handleUserChange(u.id)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${ selectedUserId === u.id ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50' } finance-input`}
                >
                  <span>{u.username}</span>
                  <span className={`px-2 py-0.5 rounded font-mono ${ selectedUserId === u.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700' } finance-small-label`}>
                    {u.userType}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Permissions checkbox lists */}
          <Card
            title="Finance Features Access Matrix"
            subtitle="Grant or restrict specific page menus"
            className="md:col-span-2 shadow border-slate-150"
          >
            <div className="space-y-6">
              {/* Select shortcuts */}
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-150 finance-caption">
                <span className="text-slate-400 finance-small-label uppercase">Quick Config:</span>
                <div className="flex gap-2">
                  <button onClick={handleSelectAll} className="text-slate-800 hover:underline finance-input">Select All</button>
                  <span className="text-slate-350">|</span>
                  <button onClick={handleClearAll} className="text-red-650 hover:underline finance-input">Clear All</button>
                </div>
              </div>

              {/* Grid of features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {FINANCE_FEATURES_LIST.map((feat) => {
                  const isActive = selectedKeys.includes(feat.key);
                  return (
                    <div
                      key={feat.key}
                      onClick={() => handleToggleKey(feat.key)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${
                        isActive
                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                          : 'bg-white border-slate-150 text-slate-450 hover:bg-slate-50/50'
                      }`}
                    >
                      {isActive ? (
                        <CheckSquare className="w-5 h-5 text-slate-800 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                      <span className="finance-header-time uppercase">{feat.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button onClick={handleSave} variant="success" icon={Save} disabled={saving} className="bg-[#0b1329] border-[#0b1329] hover:bg-slate-800 text-white rounded-lg px-4 py-2 finance-header-time">
                  {saving ? 'Saving updates...' : 'Save Permissions'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UserAccessManagement;
