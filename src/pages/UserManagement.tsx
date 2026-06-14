import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseDB } from '../lib/supabaseDatabase';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Card from '../components/UI/Card';
import toast from 'react-hot-toast';
import bcrypt from 'bcryptjs';
import { useAuth } from '../contexts/AuthContext';
import { useTableMode } from '../contexts/TableModeContext';
import ModeLabel from '../components/UI/ModeLabel';
import { format } from 'date-fns';
import {
  UserIcon,
  Shield,
  X,
  Save,
  Edit,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Briefcase,
  Clock,
} from 'lucide-react';

type ModeKey = 'regular' | 'itr';
const MODE_VALUES: ModeKey[] = ['regular', 'itr'];
const MODE_LABELS: Record<ModeKey, string> = {
  regular: 'Regular Mode',
  itr: 'ITR Mode',
};
const MODE_BADGES: Record<
  ModeKey,
  { badge: string; text: string; gradient: string }
> = {
  regular: {
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
    text: 'text-blue-700',
    gradient: 'from-blue-500 to-blue-600',
  },
  itr: {
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    text: 'text-orange-700',
    gradient: 'from-orange-500 to-red-600',
  },
};
const USER_ACCESS_MODE_SQL =
  "ALTER TABLE user_access ADD COLUMN mode TEXT CHECK (mode IN ('regular','itr')) DEFAULT 'regular';";
const isUserAccessModeError = (error?: { message?: string; code?: string }) => {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? '';
  return (
    msg.includes('column "mode"') ||
    msg.includes('mode') ||
    msg.includes('does not exist') ||
    error.code === '42703'
  );
};

const emptyModeFeatures = (): Record<ModeKey, string[]> => ({
  regular: [],
  itr: [],
});
const normalizeFeatures = (items?: string[]) =>
  [...new Set((items || []).map(item => item?.trim()).filter(Boolean))] as string[];
const mapFeaturesByMode = (featuresByMode: Record<ModeKey, string[]>) =>
  MODE_VALUES.map(mode => ({
    mode,
    features: normalizeFeatures(featuresByMode?.[mode] || []),
  }));


interface Feature {
  key: string;
  name: string;
}

interface UserRow {
  id: string;
  username: string;
  is_admin: boolean;
  features: string[];
  featuresByMode?: Record<ModeKey, string[]>;
  mode?: 'regular' | 'itr' | null;
  created_at?: string;
  address?: string;
  aadhaar_number?: string;
  phone?: string;
  email?: string;
  full_name?: string;
  date_of_birth?: string;
  other_details?: string;
}

interface NewUserFormState {
  username: string;
  password: string;
  is_admin: boolean;
  mode: ModeKey;
  featuresByMode: Record<ModeKey, string[]>;
  address?: string;
  aadhaar_number?: string;
  phone?: string;
  email?: string;
  full_name?: string;
  date_of_birth?: string;
  other_details?: string;
}

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { mode: rawMode } = useTableMode();
  const currentMode: ModeKey = rawMode === 'itr' ? 'itr' : 'regular';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [newUser, setNewUser] = useState<NewUserFormState>(() => ({
    username: '',
    password: '',
    is_admin: false,
    featuresByMode: emptyModeFeatures(),
    mode: currentMode,
    address: '',
    aadhaar_number: '',
    phone: '',
    email: '',
    full_name: '',
    date_of_birth: '',
    other_details: '',
  }));
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFeaturesByMode, setEditFeaturesByMode] = useState<Record<ModeKey, string[]>>(emptyModeFeatures());
  const [userAccessModeSupported, setUserAccessModeSupported] = useState<boolean | null>(null);
  const [modeWarningShown, setModeWarningShown] = useState(false);

  // Check if user was created recently (within last 7 days)
  const isRecentlyCreated = (createdAt: string | null | undefined): boolean => {
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  };

  useEffect(() => {
    loadUsers();
    loadFeatures();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [currentMode]);

useEffect(() => {
  setEditFeaturesByMode(emptyModeFeatures());
  setNewUser(prev => ({ ...prev, mode: currentMode }));
}, [currentMode]);


  // Debug: Log when features are loaded
  useEffect(() => {
    console.log('📋 Features state updated:', {
      featuresCount: features.length,
      features: features
    });
  }, [features]);

  // Debug: Log when newUser state changes
  useEffect(() => {
    console.log('👤 New user state:', {
      username: newUser.username,
      is_admin: newUser.is_admin,
      featuresByMode: newUser.featuresByMode,
    });
  }, [newUser]);

  const loadUsers = async () => {
    // Migration: Enable delete_entry by default for existing users who have edit_entry
    try {
      const { data: featRecord } = await supabase
        .from('features')
        .select('key')
        .eq('key', 'delete_entry')
        .maybeSingle();
      
      if (!featRecord) {
        console.log('🔄 First-time run: Migrating delete_entry features for existing users...');
        const supportsMode = await ensureUserAccessModeSupport();
        
        let query = supabase.from('user_access').select('user_id, feature_key' + (supportsMode ? ', mode' : ''));
        const { data: allAccess } = await query as any;
        
        if (allAccess) {
          const editAccessRows = allAccess.filter((row: any) => row.feature_key === 'edit_entry');
          const deleteAccessRows = allAccess.filter((row: any) => row.feature_key === 'delete_entry');
          
          const insertsToMake: any[] = [];
          
          for (const editRow of editAccessRows) {
            const hasDelete = deleteAccessRows.some(
              (delRow: any) => delRow.user_id === editRow.user_id && (!supportsMode || delRow.mode === editRow.mode)
            );
            if (!hasDelete) {
              const payload: any = {
                user_id: editRow.user_id,
                feature_key: 'delete_entry'
              };
              if (supportsMode) {
                payload.mode = editRow.mode || 'regular';
              }
              insertsToMake.push(payload);
            }
          }
          
          if (insertsToMake.length > 0) {
            console.log(`Inserting ${insertsToMake.length} delete_entry records...`, insertsToMake);
            await supabase.from('user_access').insert(insertsToMake);
          }
        }
        
        // Ensure delete_entry exists in features table to flag migration as done
        await supabase.from('features').upsert({
          key: 'delete_entry',
          name: 'Delete Entry'
        }, { onConflict: 'key' });
        console.log('✅ delete_entry migration finished');
      }
    } catch (migError) {
      console.error('Error running delete_entry migration:', migError);
    }

    // Try to select mode column - if it doesn't exist, we'll handle it
    let userRows: any[] = [];
    let hasModeColumn = true;
    
    // Start with minimal required fields - try without join first
    let { data: dataBase, error: errorBase } = await supabase
      .from('users')
      .select('id, username, created_at, user_type_id')
      .order('created_at', { ascending: false });
    
    if (errorBase) {
      console.error('Error loading users:', errorBase);
      toast.error(`Error loading users: ${errorBase.message || 'Unknown error'}`);
      setUsers([]);
      return;
    }
    
    if (!dataBase || dataBase.length === 0) {
      console.log('No users found in database');
      setUsers([]);
      return;
    }
    
    // Get all unique user_type_ids
    const userTypeIds = [...new Set(dataBase.map((u: any) => u.user_type_id).filter(Boolean))];
    
    // Load all user_types at once
    const { data: allUserTypes } = await supabase
      .from('user_types')
      .select('id, user_type')
      .in('id', userTypeIds);
    
    // Create a map for quick lookup
    const userTypesMap = new Map((allUserTypes || []).map((ut: any) => [ut.id, ut.user_type]));
    
    // Now merge user_types with users
    const usersWithTypes = dataBase.map((user: any) => {
      const userType = user.user_type_id ? userTypesMap.get(user.user_type_id) : null;
      return {
        ...user,
        user_types: userType ? { user_type: userType } : null,
      };
    });
    
    // Try to load optional fields - handle gracefully if columns don't exist
    const userIds = usersWithTypes.map((u: any) => u.id);
    let dataWithOptionalFields: any[] = [];
    
    if (userIds.length > 0) {
      // Try to load optional fields, but don't fail if they don't exist
      const { data, error } = await supabase
        .from('users')
        .select('id, mode, email, address, aadhaar_number, phone, full_name, date_of_birth, other_details')
        .in('id', userIds);
      
      // Only use data if no error or if error is just about missing columns
      if (!error || (error.code !== '42703' && !error.message?.includes('does not exist'))) {
        dataWithOptionalFields = data || [];
      }
    }
    
    // Merge optional fields
    const mergedUsers = usersWithTypes.map((user: any) => {
      const optionalFields = dataWithOptionalFields?.find((u: any) => u.id === user.id);
      return {
        ...user,
        mode: optionalFields?.mode || null,
        email: optionalFields?.email || '',
        address: optionalFields?.address || '',
        aadhaar_number: optionalFields?.aadhaar_number || '',
        phone: optionalFields?.phone || '',
        full_name: optionalFields?.full_name || '',
        date_of_birth: optionalFields?.date_of_birth || '',
        other_details: optionalFields?.other_details || '',
      };
    });
    
    userRows = mergedUsers;
    hasModeColumn = dataWithOptionalFields && dataWithOptionalFields.some((u: any) => u.mode !== undefined);
    
    console.log(`✅ Loaded ${userRows.length} users from database`);

    // Load features for each user from user_access table
    const usersWithFeatures = await Promise.all(
      userRows.map(async (u: any) => {
        const isAdmin = u.user_types?.user_type === 'Admin';
        
        // If admin, they have all features (handled in AuthContext)
        // If not admin, load their features from user_access table
        let features: string[] = [];
        let featuresByMode = emptyModeFeatures();
        if (!isAdmin) {
          const { data: accessData, error: accessError } = await supabase
            .from('user_access')
            .select('feature_key, mode')
            .eq('user_id', u.id);

          let rows = accessData || [];
          if (accessError && isUserAccessModeError(accessError)) {
            const { data: fallbackData } = await supabase
              .from('user_access')
              .select('feature_key')
              .eq('user_id', u.id);
            rows =
              fallbackData?.map(item => ({
                feature_key: item.feature_key,
                mode: 'regular',
              })) || [];
          }

          const grouped = emptyModeFeatures();
          rows.forEach(item => {
            const key = item?.feature_key;
            if (!key) return;
            const modeKey: ModeKey = item?.mode === 'itr' ? 'itr' : 'regular';
            if (!grouped[modeKey].includes(key)) {
              grouped[modeKey].push(key);
            }
          });
          featuresByMode = grouped;
          features = grouped[currentMode] || [];
        }


        return {
          id: u.id,
          username: u.username,
          is_admin: isAdmin,
          features,
          featuresByMode,
          mode: hasModeColumn ? (u.mode || null) : null,
          created_at: u.created_at || null,
          email: u.email || '',
          address: u.address || '',
          aadhaar_number: u.aadhaar_number || '',
          phone: u.phone || '',
          full_name: u.full_name || '',
          date_of_birth: u.date_of_birth || '',
          other_details: u.other_details || '',
        };
      })
    );
    
    // Sort by created_at (most recent first)
    usersWithFeatures.sort((a, b) => {
      if (!a.created_at && !b.created_at) return 0;
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    setUsers(usersWithFeatures);
  };

  const ensureUserAccessModeSupport = async () => {
    if (userAccessModeSupported !== null) return userAccessModeSupported;
    const { error } = await supabase.from('user_access').select('mode').limit(1);
    if (error && isUserAccessModeError(error)) {
      if (!modeWarningShown) {
        toast.error(
          `User access table is missing the mode column. Please run:\n${USER_ACCESS_MODE_SQL}`,
          { duration: 12000 }
        );
        setModeWarningShown(true);
      }
      setUserAccessModeSupported(false);
      return false;
    }
    setUserAccessModeSupported(true);
    return true;
  };
const upsertUserAccess = async (
  payload: Record<string, any>,
  supportsMode: boolean
) => {
  const result = await supabase
    .from('user_access')
    .upsert(payload, {
      onConflict: supportsMode ? 'user_id,feature_key,mode' : 'user_id,feature_key',
    })
    .select();

  if (
    result.error &&
    result.error.message?.toLowerCase().includes('no unique or exclusion constraint')
  ) {
    return await supabase.from('user_access').insert(payload).select();
  }

  return result;
};
  const applyModeFilter = (builder: any, supportsMode: boolean, modeOverride?: ModeKey) => {
    if (supportsMode) {
      return builder.eq('mode', modeOverride ?? currentMode);
    }
    return builder;
  };

  const loadFeatures = async () => {
    // Define features manually - must match all sidebar menu items (except admin-only 'users')
    const defaultFeatures = [
      { key: 'dashboard', name: 'Dashboard' },
      { key: 'new_entry', name: 'New Entry' },
      { key: 'edit_entry', name: 'Edit Entry' },
      { key: 'delete_entry', name: 'Delete Entry' },
      { key: 'daily_report', name: 'Daily Report' },
      { key: 'detailed_ledger', name: 'Detailed Ledger' },
      { key: 'ledger_summary', name: 'Ledger Summary' },
      { key: 'approve_records', name: 'Approve Records' },
      { key: 'edited_records', name: 'Edited Records' },
      { key: 'deleted_records', name: 'Deleted Records' },
      { key: 'replace_form', name: 'Replace Form' },
      { key: 'export', name: 'Export' },
      { key: 'csv_upload', name: 'CSV Upload' },
      { key: 'balance_sheet', name: 'Balance Sheet' },
      { key: 'vehicles', name: 'Vehicles' },
      { key: 'reminders', name: 'Reminders' },
      { key: 'sync_center', name: 'Sync Center' },
      { key: 'bank_guarantees', name: 'Bank Guarantees' },
      { key: 'drivers', name: 'Drivers' },
      { key: 'book_management', name: 'Book Management' },
    ];
    console.log('📋 Loading features:', defaultFeatures.length, 'features:', defaultFeatures.map(f => f.name).join(', '));
    setFeatures(defaultFeatures);
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Delete this user?')) return;
    await supabase.from('users').delete().eq('id', id);
    toast.success('User deleted');
    loadUsers();
  };

  const handleModalChange = (field: string, value: any) => {
    setNewUser(prev => ({ ...prev, [field]: value }));
  };

  const handleModalFeatureToggle = (modeKey: ModeKey, featureKey: string) => {
    console.log('🔄 Toggling feature:', featureKey, 'for mode:', modeKey);
    setNewUser(prev => {
      const currentFeaturesByMode = prev.featuresByMode || emptyModeFeatures();
      const currentFeatures = currentFeaturesByMode?.[modeKey] || [];
      let updatedFeatures = currentFeatures.includes(featureKey)
        ? currentFeatures.filter(f => f !== featureKey)
        : [...currentFeatures, featureKey];

      // Auto-toggle delete_entry ON if edit_entry is toggled ON
      if (featureKey === 'edit_entry' && !currentFeatures.includes('edit_entry')) {
        if (!updatedFeatures.includes('delete_entry')) {
          updatedFeatures.push('delete_entry');
        }
      }

      const updatedFeaturesByMode = {
        ...currentFeaturesByMode,
        [modeKey]: updatedFeatures,
      };

      return {
        ...prev,
        featuresByMode: updatedFeaturesByMode,
      };
    });
  };

  const handleEditFeatureToggle = (modeKey: ModeKey, featureKey: string) => {
    console.log('🔄 Toggling edit feature:', featureKey, 'for mode:', modeKey);
    setEditFeaturesByMode(prev => {
      const currentFeatures = prev?.[modeKey] || [];
      let updatedFeatures = currentFeatures.includes(featureKey)
        ? currentFeatures.filter(f => f !== featureKey)
        : [...currentFeatures, featureKey];

      // Auto-toggle delete_entry ON if edit_entry is toggled ON
      if (featureKey === 'edit_entry' && !currentFeatures.includes('edit_entry')) {
        if (!updatedFeatures.includes('delete_entry')) {
          updatedFeatures.push('delete_entry');
        }
      }

      return {
        ...prev,
        [modeKey]: updatedFeatures,
      };
    });
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast.error('Username and password required');
      return;
    }
    setLoading(true);
    try {
      const password_hash = await bcrypt.hash(newUser.password, 10);

      // Get the appropriate user type ID
      const userType = newUser.is_admin ? 'Admin' : 'Operator';
      const { data: userTypeData } = await supabase
        .from('user_types')
        .select('id')
        .eq('user_type', userType)
        .single();

      if (!userTypeData) {
        throw new Error('User type not found');
      }

      // Try to insert with mode first - include all personal details
      let insertData: any = {
        username: newUser.username,
        password_hash,
        user_type_id: userTypeData.id,
        email: newUser.email || `${newUser.username}@thirumala.com`,
        mode: newUser.mode,
        // Personal details
        full_name: newUser.full_name || null,
        address: newUser.address || null,
        aadhaar_number: newUser.aadhaar_number || null,
        phone: newUser.phone || null,
        date_of_birth: newUser.date_of_birth || null,
        other_details: newUser.other_details || null,
      };

      let createdUser: any = null;
      let finalUser: any = null;
      
      // First, try to insert with mode
      const { data: userData, error } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        // Check if error is about missing columns (mode, aadhaar_number, address, or other personal details)
        const isColumnError = error.message?.includes('column') || 
                              error.message?.includes('does not exist') ||
                              error.code === '42703' || 
                              error.code === 'PGRST116';
        
        if (isColumnError) {
          console.log('Column error detected, trying to create user without problematic columns...');
          
          // Extract the column name from error message
          const errorMessage = error.message || '';
          const columnMatch = errorMessage.match(/column ['"]([^'"]+)['"]/i) || 
                             errorMessage.match(/column\s+([a-z_]+)/i);
          const missingColumn = columnMatch ? columnMatch[1]?.toLowerCase() : null;
          
          console.log(`⚠️ Missing column detected: ${missingColumn}`);
          
          // Check which specific columns are missing
          const isModeError = missingColumn === 'mode' || errorMessage.includes('mode');
          const isAadhaarError = missingColumn === 'aadhaar_number' || missingColumn === 'aadhaar' || errorMessage.includes('aadhaar');
          const isAddressError = missingColumn === 'address' || errorMessage.includes('address');
          const isPhoneError = missingColumn === 'phone' || errorMessage.includes('phone');
          const isFullNameError = missingColumn === 'full_name' || errorMessage.includes('full_name');
          const isDateOfBirthError = missingColumn === 'date_of_birth' || errorMessage.includes('date_of_birth');
          const isOtherDetailsError = missingColumn === 'other_details' || errorMessage.includes('other_details');
          const isEmailError = missingColumn === 'email' || errorMessage.includes('email');
          
          // Create a clean insert data object with only required fields
          // Email is required (NOT NULL constraint), so always include it
          const cleanInsertData: any = {
            username: insertData.username,
            password_hash: insertData.password_hash,
            user_type_id: insertData.user_type_id,
            email: insertData.email || `${insertData.username}@thirumala.com`, // Always include email with default if needed
          };
          
          if (!isModeError && insertData.mode) {
            cleanInsertData.mode = insertData.mode;
          }
          
          // Include personal details only if the columns exist
          if (!isFullNameError && insertData.full_name) {
            cleanInsertData.full_name = insertData.full_name;
          }
          if (!isAddressError && insertData.address) {
            cleanInsertData.address = insertData.address;
          }
          if (!isAadhaarError && insertData.aadhaar_number) {
            cleanInsertData.aadhaar_number = insertData.aadhaar_number;
          }
          if (!isPhoneError && insertData.phone) {
            cleanInsertData.phone = insertData.phone;
          }
          if (!isDateOfBirthError && insertData.date_of_birth) {
            cleanInsertData.date_of_birth = insertData.date_of_birth;
          }
          if (!isOtherDetailsError && insertData.other_details) {
            cleanInsertData.other_details = insertData.other_details;
          }
          

          
          const { data: retryUser, error: retryError } = await supabase
            .from('users')
            .insert(cleanInsertData)
            .select()
            .single();
          
          if (retryError) {
            console.error('❌ Error creating user after retry:', retryError);
            // If retry also fails, try with only absolutely required fields
            // Email is required (NOT NULL constraint), so always include it
            const minimalData = {
              username: insertData.username,
              password_hash: insertData.password_hash,
              user_type_id: insertData.user_type_id,
              email: insertData.email || `${insertData.username}@thirumala.com`, // Always include email with default
            };
            
            const { data: minimalUser, error: minimalError } = await supabase
              .from('users')
              .insert(minimalData)
              .select()
              .single();
            
            if (minimalError) {
              console.error('❌ Error creating user with minimal data:', minimalError);
              throw minimalError;
            }
            
            if (!minimalUser || !minimalUser.id) {
              throw new Error('User was created but no ID was returned. Please try again.');
            }
            
            finalUser = minimalUser;
            createdUser = minimalUser;
            toast('User created with minimal data. Some personal details could not be saved due to missing database columns.', { 
              duration: 7000,
              icon: '⚠️',
              style: {
                background: '#f59e0b',
                color: '#fff',
              },
            });
          } else {
            if (!retryUser || !retryUser.id) {
              throw new Error('User was created but no ID was returned. Please try again.');
            }
            
            finalUser = retryUser;
            createdUser = retryUser;
            
            // Show warnings for missing columns
            const missingColumns: string[] = [];
            if (isModeError) missingColumns.push('mode');
            if (isAadhaarError) missingColumns.push('aadhaar_number');
            if (isAddressError) missingColumns.push('address');
            if (isPhoneError) missingColumns.push('phone');
            if (isFullNameError) missingColumns.push('full_name');
            if (isDateOfBirthError) missingColumns.push('date_of_birth');
            if (isOtherDetailsError) missingColumns.push('other_details');
            if (isEmailError) missingColumns.push('email');
            
            if (missingColumns.length > 0) {
              toast(`User created, but these columns don't exist in database: ${missingColumns.join(', ')}. Related data was not saved.`, { 
                duration: 7000,
                icon: '⚠️',
                style: {
                  background: '#f59e0b',
                  color: '#fff',
                },
              });
            }
          }
        } else {
          console.error('❌ Error creating user:', error);
          throw error;
        }
      } else {
        createdUser = userData;
        finalUser = userData;
        // User created successfully with mode - column exists!
      }

      if (!createdUser || !createdUser.id || !finalUser || !finalUser.id) {
        throw new Error('User was created but no ID was returned. Please try again.');
      }

      console.log('✅ User created with ID:', finalUser.id);

      // CRITICAL: Verify user exists in database with aggressive retry logic
      // This is essential because foreign key constraints require the user to exist
      let verifyUser = null;
      let verifyError = null;
      const maxRetries = 10; // Increased retries
      
      console.log('🔍 Verifying user exists in database before inserting features...');
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Increasing delays: 500ms, 700ms, 900ms, etc.
        await new Promise(resolve => setTimeout(resolve, 500 + (attempt * 200)));
        
        const { data, error: checkError } = await supabase
          .from('users')
          .select('id, username')
          .eq('id', finalUser.id)
          .single();
        
        if (data && !checkError) {
          verifyUser = data;
          console.log(`✅ User verified in database on attempt ${attempt + 1}:`, verifyUser.id);
          break;
        }
        
        verifyError = checkError;
        console.log(`⏳ User verification attempt ${attempt + 1}/${maxRetries} failed, retrying...`, checkError);
      }

      if (!verifyUser) {
        console.error('❌ User verification failed after', maxRetries, 'attempts:', verifyError);
        throw new Error(`User was created but cannot be verified in database after ${maxRetries} attempts. The user ID is ${finalUser.id}. This might be a database issue. Please check the database and try again.`);
      }

      // Additional wait to ensure database has fully committed the user
      console.log('⏳ Waiting for database to fully commit user...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const newUserFeatureSets = mapFeaturesByMode(newUser.featuresByMode);
      const totalSelectedFeatures = newUserFeatureSets.reduce(
        (sum, set) => sum + set.features.length,
        0
      );

      // Save feature access for non-admin users
      if (!newUser.is_admin && totalSelectedFeatures > 0) {
        const supportsUserAccessMode = await ensureUserAccessModeSupport();
        const featureBatches = supportsUserAccessMode
          ? newUserFeatureSets.filter(batch => batch.features.length > 0)
          : [
              {
                mode: 'regular' as ModeKey,
                features: normalizeFeatures(
                  newUserFeatureSets.flatMap(batch => batch.features)
                ),
              },
            ];

        const allFeatureKeys = normalizeFeatures(
          featureBatches.flatMap(batch => batch.features)
        );

        if (allFeatureKeys.length === 0) {
          console.warn('⚠️ No valid features to save');
          toast.error('User created but no valid features to save.');
        } else {
          console.log('🔧 Saving features for user:', {
            userId: finalUser.id,
            username: finalUser.username,
            featuresByMode: featureBatches,
          });

          // STEP 1: Ensure all features exist in the features table
          const featureDefinitions = features.filter(f => allFeatureKeys.includes(f.key));

          for (const featureDef of featureDefinitions) {
            try {
              const { error: featureError } = await supabase
                .from('features')
                .upsert(
                  {
                    key: featureDef.key,
                    name: featureDef.name,
                  },
                  {
                    onConflict: 'key',
                  }
                );

              if (
                featureError &&
                featureError.code !== '23505' &&
                featureError.code !== 'PGRST116'
              ) {
                console.warn(`⚠️ Could not ensure feature "${featureDef.key}" exists:`, featureError);
              } else {
                console.log(`✅ Feature "${featureDef.key}" ensured in database`);
              }
            } catch (err) {
              console.warn(`⚠️ Exception ensuring feature "${featureDef.key}":`, err);
            }
          }

          // STEP 2: Wait for features to be committed
          await new Promise(resolve => setTimeout(resolve, 400));

          // STEP 3: Final user verification before inserting features
          const { data: finalUserCheck, error: finalCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', finalUser.id)
            .single();

          if (!finalUserCheck || finalCheckError) {
            console.error('❌ Final user check failed before inserting features:', {
              error: finalCheckError,
              userId: finalUser.id,
            });

            // Try one more time after waiting longer
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: retryCheck } = await supabase
              .from('users')
              .select('id')
              .eq('id', finalUser.id)
              .single();

            if (!retryCheck) {
              toast.error(
                'User created but database is not ready. Features cannot be saved. Please edit the user to add features manually.'
              );
              console.error('❌ User still not found after extended wait. Foreign key constraint may be broken.');
              console.error('💡 SOLUTION: Run the SQL fix in fix-foreign-key-immediate.sql file to fix the database constraint.');
            }
          }

          // STEP 4: Insert user_access records per mode with retry logic
          console.log('💾 Inserting user_access records per mode...');
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          for (const batch of featureBatches) {
            for (const featureKey of batch.features) {
            const trimmedKey = featureKey.trim();
            if (!trimmedKey) continue;
            
            let saved = false;
            let lastError = null;
            
            // Try up to 3 times per feature
            for (let retry = 0; retry < 3; retry++) {
              if (retry > 0) {
                // Wait longer between retries
                await new Promise(resolve => setTimeout(resolve, 300 * retry));
                
                // Re-verify user exists before each retry
                const { data: userCheck } = await supabase
                  .from('users')
                  .select('id')
                  .eq('id', finalUser.id)
                  .single();
                
                if (!userCheck) {
                  console.error(`❌ User ${finalUser.id} not found before retry ${retry + 1} for feature "${trimmedKey}"`);
                  lastError = new Error('User not found in database');
                  continue;
                }
              }
              
              try {
                const accessPayload: Record<string, any> = {
                  user_id: finalUser.id,
                  feature_key: trimmedKey,
                };
                if (supportsUserAccessMode) {
                  accessPayload.mode = batch.mode;
                }
                const { error: singleError, data: singleData } = await upsertUserAccess(
                  accessPayload,
                  supportsUserAccessMode
                );
                
                if (singleError) {
                  lastError = singleError;
                  
                  // Check if it's a foreign key error
                  if (singleError.code === '23503') {
                    const errorMsg = singleError.message || '';
                    const isUserssError = errorMsg.includes('userss');
                    
                    if (isUserssError) {
                      console.error(`❌ FOREIGN KEY CONSTRAINT ERROR for "${trimmedKey}": The database constraint points to wrong table "userss" instead of "users"`);
                      console.error(`💡 FIX REQUIRED: Run the SQL in fix-foreign-key-immediate.sql to fix the database constraint.`);
                      errors.push(`"${trimmedKey}" - Database constraint error (see console for SQL fix)`);
                      errorCount++;
                      break; // Don't retry, it won't work until constraint is fixed
                    }
                  }
                  
                  console.error(`❌ Failed to save feature "${trimmedKey}" (attempt ${retry + 1}/3):`, singleError);
                  
                  if (retry === 2) {
                    // Last retry failed
                    errorCount++;
                    errors.push(`"${trimmedKey}" - ${singleError.message || 'Unknown error'}`);
                  }
                } else {
                  // Success!
                  if (singleData && singleData.length > 0) {
                    console.log(`✅ Feature "${trimmedKey}" saved successfully${retry > 0 ? ` (on retry ${retry + 1})` : ''}`);
                    successCount++;
                    saved = true;
                    break;
                  } else {
                    // No error but no data - might still be saved, verify
                    await new Promise(resolve => setTimeout(resolve, 200));
                    let verifyQuery = supabase
                      .from('user_access')
                      .select('id')
                      .eq('user_id', finalUser.id)
                      .eq('feature_key', trimmedKey);
                    verifyQuery = applyModeFilter(verifyQuery, supportsUserAccessMode, batch.mode);
                    const { data: verify } = await verifyQuery.maybeSingle();
                    
                    if (verify) {
                      console.log(`✅ Feature "${trimmedKey}" verified as saved`);
                      successCount++;
                      saved = true;
                      break;
                    }
                  }
                }
              } catch (err: any) {
                lastError = err;
                console.error(`❌ Exception saving feature "${trimmedKey}" (attempt ${retry + 1}/3):`, err);
                
                if (retry === 2) {
                  errorCount++;
                  errors.push(`"${trimmedKey}" - ${err.message || 'Exception'}`);
                }
              }
            }
            
            if (!saved && lastError) {
              console.error(`❌ Feature "${trimmedKey}" failed after all retries`);
            }
            
            // Small delay between features
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          
          // Show results
          if (errorCount > 0) {
            const errorDetails = errors.length > 0 ? ` Errors: ${errors.join(', ')}` : '';
            
            if (errors.some(e => e.includes('Database constraint error'))) {
              toast.error(
                `User created but ${errorCount} feature(s) failed due to database constraint issue. ${successCount} saved.${errorDetails}\n\n⚠️ DATABASE FIX REQUIRED: Run fix-foreign-key-immediate.sql in Supabase SQL Editor.`,
                { duration: 15000 }
              );
            } else {
              toast.error(`User created but ${errorCount} feature(s) failed to save. ${successCount} saved successfully.${errorDetails}`);
            }
          } else if (successCount > 0) {
            toast.success(`User created! All ${successCount} feature(s) saved successfully.`);
          }
          
          // Always verify what was actually saved
          for (const batch of featureBatches) {
            await new Promise(resolve => setTimeout(resolve, 300));
            let verifySavedQuery = supabase
              .from('user_access')
              .select('feature_key')
              .eq('user_id', finalUser.id);
            verifySavedQuery = applyModeFilter(verifySavedQuery, supportsUserAccessMode, batch.mode);
            const { data: verifyData, error: verifyError } = await verifySavedQuery;
            
            if (!verifyError && verifyData) {
              const savedFeatures = verifyData.map(d => d.feature_key).filter(Boolean);
              console.log(`✅ Final verification (${batch.mode}) - Saved features:`, savedFeatures);
              
              if (savedFeatures.length < batch.features.length) {
                const missing = batch.features.filter(f => !savedFeatures.includes(f));
                if (missing.length > 0) {
                  console.warn(`⚠️ Missing features for ${batch.mode}:`, missing);
                }
              }
            }
          }
        }
      }
    } else if (!newUser.is_admin && totalSelectedFeatures === 0) {
        console.warn('⚠️ User created without any feature access assigned');
        toast.error('User created but no features were selected. User will only see Dashboard.');
      }

      // Save credentials to database and localStorage for Dashboard display
      const combinedFeatureList = normalizeFeatures(
        MODE_VALUES.flatMap(modeKey => newUser.featuresByMode[modeKey] || [])
      );
      const credentialsData = {
        username: newUser.username,
        password: newUser.password,
        is_admin: newUser.is_admin,
        features: combinedFeatureList,
        featuresByMode: newUser.featuresByMode,
        created_at: new Date().toISOString(),
      };
      
      // Save to database (will work if table exists, otherwise falls back to localStorage only)
      await supabaseDB.saveUserCredentials(credentialsData);
      
      // Also save to localStorage as fallback
      const existingCredentials = JSON.parse(localStorage.getItem('user_credentials') || '[]');
      existingCredentials.push(credentialsData);
      // Keep only last 10 credentials
      const recentCredentials = existingCredentials.slice(-10);
      localStorage.setItem('user_credentials', JSON.stringify(recentCredentials));
      
      // Show detailed success message with credentials
      const featuresList = newUser.is_admin
        ? 'All Features (Admin)'
        : (() => {
            const parts = MODE_VALUES.map(modeKey => {
              const modeFeatures = normalizeFeatures(newUser.featuresByMode[modeKey]);
              if (!modeFeatures.length) return null;
              const named = modeFeatures
                .map(f => features.find(fe => fe.key === f)?.name || f)
                .join(', ');
              return `${MODE_LABELS[modeKey]}: ${named}`;
            }).filter(Boolean);
            return parts.length > 0 ? parts.join(' | ') : 'None (Dashboard only)';
          })();
      
      toast.success(
        `✅ Login Credentials Created!\n\nUsername: ${newUser.username}\nPassword: ${newUser.password}\n\nAccess Features: ${featuresList}`,
        { duration: 12000 }
      );
      
      setShowAddForm(false);
      setNewUser({
        username: '',
        password: '',
        is_admin: false,
        featuresByMode: emptyModeFeatures(),
        mode: currentMode,
        address: '',
        aadhaar_number: '',
        phone: '',
        email: '',
        full_name: '',
        date_of_birth: '',
        other_details: '',
      });
      loadUsers();
      
      // Trigger dashboard refresh to show new credentials
      window.dispatchEvent(new Event('dashboard-refresh'));
    } catch (err: any) {
      toast.error(err.message || 'Error creating user');
    }
    setLoading(false);
  };

  if (!user?.is_admin) {
    return (
      <div className='p-8 text-center text-red-600 text-xl font-bold'>
        You are not authorized to view this page.
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col'>
      <div className='max-w-7xl w-full mx-auto py-8 px-4'>
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <h1 className='text-3xl font-bold text-gray-900'>
                User Management
              </h1>
              <ModeLabel />
            </div>
            <p className='text-gray-600'>
              Create login credentials and manage feature access for your organization members
            </p>
            <div className='mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold'
              data-current-mode={currentMode}
              style={{ borderColor: currentMode === 'itr' ? '#fb923c' : '#3b82f6' }}
            >
              <span
                className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full border text-xs font-semibold ${MODE_BADGES[currentMode].badge}`}
              >
                {currentMode === 'itr' ? <FileCheck className='w-3 h-3' /> : <Briefcase className='w-3 h-3' />}
                {MODE_LABELS[currentMode]}
              </span>
              <span className='text-gray-500 text-xs'>
                Feature access settings update when you switch modes.
              </span>
            </div>
            <div className='text-sm text-gray-500 mt-2 flex flex-wrap items-center gap-3'>
              <span>
                Total Users: <span className='font-semibold text-gray-700'>{users.length}</span>
              </span>
            </div>
          </div>
          <Button
            size='lg'
            className='bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg'
            onClick={() => setShowAddForm(v => !v)}
          >
            {showAddForm ? 'Close Add User' : 'Create Login Credentials'}
          </Button>
        </div>

        {showAddForm && (
          <Card className='mb-8 p-0 overflow-visible'>
            <div className='bg-gradient-to-r from-blue-500 to-indigo-600 px-4 sm:px-8 py-4 sm:py-5 flex items-center gap-3 rounded-t-2xl'>
              <UserIcon className='w-7 h-7 sm:w-8 sm:h-8 text-white' />
              <h2 className='text-xl sm:text-2xl font-bold text-white flex-1'>
                Create Login Credentials
              </h2>
            </div>
            <form
              onSubmit={handleModalSubmit}
              ref={formRef}
              className='space-y-6 sm:space-y-8 px-4 sm:px-10 py-6 sm:py-10'
            >
              {/* Info Banner */}
              <div className='bg-blue-50 border-l-4 border-blue-500 p-4 rounded'>
                <p className='text-sm text-blue-800'>
                  <strong>Note:</strong> Creating a user here will generate login credentials. The member can use the username and password to log in to the system.
                </p>
              </div>

              {/* User Info Section */}
              <div className='grid grid-cols-1 gap-3 sm:gap-4'>
                <Input
                  label='Full Name'
                  value={newUser?.full_name || ''}
                  onChange={v => handleModalChange('full_name', v)}
                  placeholder='Enter full name'
                />
                <Input
                  label='Username (Login ID)'
                  value={newUser?.username || ''}
                  onChange={v => handleModalChange('username', v)}
                  placeholder='Enter username for login'
                  required
                />
                <Input
                  label='Password (Login Password)'
                  type='password'
                  value={newUser?.password || ''}
                  onChange={v => handleModalChange('password', v)}
                  placeholder='Enter password for login'
                  required
                />
                <Input
                  label='Email'
                  type='email'
                  value={newUser?.email || ''}
                  onChange={v => handleModalChange('email', v)}
                  placeholder='Enter email address'
                />
                <Input
                  label='Phone Number'
                  type='tel'
                  value={newUser?.phone || ''}
                  onChange={v => handleModalChange('phone', v)}
                  placeholder='Enter phone number'
                />
                <Input
                  label='Address'
                  value={newUser?.address || ''}
                  onChange={v => handleModalChange('address', v)}
                  placeholder='Enter address'
                />
                <Input
                  label='Aadhaar Number'
                  type='text'
                  value={newUser?.aadhaar_number || ''}
                  onChange={v => handleModalChange('aadhaar_number', v)}
                  placeholder='Enter Aadhaar number (12 digits)'
                  maxLength={12}
                />
                <Input
                  label='Date of Birth'
                  type='date'
                  value={newUser?.date_of_birth || ''}
                  onChange={v => handleModalChange('date_of_birth', v)}
                  placeholder='Select date of birth'
                />
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Other Personal Details
                  </label>
                  <textarea
                    value={newUser?.other_details || ''}
                    onChange={e => handleModalChange('other_details', e.target.value)}
                    placeholder='Enter any other personal details...'
                    rows={3}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <label className='flex items-center gap-2 mt-2 cursor-pointer select-none'>
                  <input
                    type='checkbox'
                    checked={newUser?.is_admin || false}
                    onChange={e => {
                      const isAdmin = e.target.checked;
                      handleModalChange('is_admin', isAdmin);
                      // If admin is checked, clear features (admin has all access)
                      if (isAdmin) {
                        setNewUser(prev => ({
                          ...prev,
                          featuresByMode: emptyModeFeatures(),
                        }));
                        console.log('🔐 Admin mode enabled - clearing features');
                      }
                    }}
                    className='accent-blue-600 w-5 h-5'
                  />
                  <span className='text-blue-800 font-medium'>Admin (has access to all features)</span>
                </label>
              </div>
              {/* Divider */}
              <div className='border-t border-blue-100 my-2' />
              {/* Feature Access Section */}
              <div className={newUser?.is_admin ? 'opacity-50 pointer-events-none' : ''}>
                <div className='font-semibold mb-4 text-blue-800'>
                  Feature Access by Mode
                </div>
                {newUser?.is_admin ? (
                  <div className='text-blue-600 text-sm p-4 bg-blue-50 rounded border border-blue-200'>
                    Admin users have access to all features automatically. No need to select individual features.
                  </div>
                ) : features.length === 0 ? (
                  <div className='text-red-600 text-sm p-4 bg-red-50 rounded border border-red-200'>
                    No features available. Please refresh the page.
                  </div>
                ) : (
                  <div className='space-y-6'>
                    {MODE_VALUES.map(modeKey => {
                      const selected = newUser.featuresByMode[modeKey] || [];
                      return (
                        <div
                          key={modeKey}
                          className='border border-gray-200 rounded-2xl shadow-sm overflow-hidden'
                        >
                          <div
                            className={`px-4 py-3 flex items-center justify-between text-white bg-gradient-to-r ${MODE_BADGES[modeKey].gradient}`}
                          >
                            <div className='flex items-center gap-2 text-base font-semibold'>
                              {modeKey === 'itr' ? (
                                <FileCheck className='w-5 h-5' />
                              ) : (
                                <Briefcase className='w-5 h-5' />
                              )}
                              {MODE_LABELS[modeKey]}
                            </div>
                            <span className='text-sm font-medium bg-white/20 px-3 py-1 rounded-full'>
                              {selected.length} selected
                            </span>
                          </div>
                          <div className='p-4'>
                            <div className='flex flex-wrap gap-2 sm:gap-3'>
                              {features.map(f => {
                                const isSelected = selected.includes(f.key);
                                return (
                                  <label
                                    key={`${modeKey}-${f.key}`}
                                    className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow border-2 transition-all cursor-pointer select-none text-xs sm:text-sm font-medium
                                    ${
                                      isSelected
                                        ? 'bg-gradient-to-r from-blue-200 to-indigo-200 text-blue-900 border-blue-400 scale-105'
                                        : 'bg-blue-50 text-blue-800 border-blue-100 hover:border-blue-300 hover:bg-blue-100'
                                    }
                                  `}
                                  >
                                    <input
                                      type='checkbox'
                                      checked={isSelected}
                                      onChange={e => {
                                        e.stopPropagation();
                                        handleModalFeatureToggle(modeKey, f.key);
                                      }}
                                      onClick={e => e.stopPropagation()}
                                      className='accent-blue-600 w-5 h-5 cursor-pointer'
                                    />
                                    <span className='cursor-pointer'>{f.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <p className='mt-3 text-xs text-gray-500'>
                              Select the features this user should have in {MODE_LABELS[modeKey]}. They will only see these options when using this mode.
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button
                type='submit'
                disabled={loading}
                className='w-full mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg text-base sm:text-lg py-2.5 sm:py-3'
              >
                {loading ? 'Creating Login Credentials...' : 'Create Login Credentials'}
              </Button>
            </form>
          </Card>
        )}

        {/* Users List as Cards */}
        <div className='flex flex-col gap-6'>
          {/* Admins Section */}
          {users.filter(u => u.is_admin).length > 0 && (
            <div>
              <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center gap-2'>
                <Shield className='w-5 h-5 text-green-600' />
                Admins ({users.filter(u => u.is_admin).length})
              </h2>
              <div className='flex flex-col gap-6'>
                {users.filter(u => u.is_admin).map(u => {

                  return (
            <div
              key={u.id}
              className={`group flex flex-col border rounded-xl shadow-md px-10 py-8 transition-shadow hover:shadow-lg bg-white relative w-full overflow-visible ${expandedUserId === u.id ? 'ring-2 ring-blue-200' : 'bg-white border-gray-200'}`}
              onMouseEnter={() =>
                setExpandedUserId(expandedUserId === u.id ? null : u.id)
              }
              onMouseLeave={() => {}}
            >
              {/* Main Row (always visible) */}
              <div
                className='flex flex-col md:flex-row items-center md:items-center justify-between gap-4 cursor-pointer w-full'
                onClick={() =>
                  setExpandedUserId(expandedUserId === u.id ? null : u.id)
                }
              >
                <div className='flex items-center gap-5 flex-1 min-w-0'>
                  {/* Avatar */}
                  <div className='w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg border-4 border-white'>
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className='flex flex-col min-w-0'>
                    <div className='flex items-center gap-2 mb-2'>
                      <span className='text-xl font-semibold text-blue-900 truncate max-w-[200px]'>
                        {u.username}
                      </span>
                      {u.is_admin && (
                        <span className='inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold'>
                          <Shield className='w-4 h-4' />
                          Admin
                        </span>
                      )}
                      {isRecentlyCreated(u.created_at) && (
                        <span className='inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold animate-pulse'>
                          <Clock className='w-3 h-3' />
                          New
                        </span>
                      )}
                      {u.mode && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          u.mode === 'itr'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.mode === 'itr' ? (
                            <>
                              <FileCheck className='w-3 h-3' />
                              ITR
                            </>
                          ) : (
                            <>
                              <Briefcase className='w-3 h-3' />
                              Regular
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className='flex flex-wrap gap-2 items-center'>
                      {u.is_admin ? (
                        <span className='inline-block bg-gradient-to-r from-green-100 to-green-300 text-green-900 px-3 py-1 rounded-full text-xs font-semibold border border-green-200 shadow-sm'>
                          All Access (Admin)
                        </span>
                      ) : u.features.length === 0 ? (
                        <span className='inline-block bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-medium border border-gray-200'>
                          No access
                        </span>
                      ) : (
                        u.features.slice(0, 2).map(fk => {
                          const f = features.find(ff => ff.key === fk);
                          return f ? (
                            <span
                              key={fk}
                              className='flex items-center gap-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 shadow-sm'
                            >
                              {/* Optionally add an icon here */}
                              {f.name}
                            </span>
                          ) : null;
                        })
                      )}
                      {!u.is_admin && u.features.length > 2 && (
                        <span className='bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-200'>
                          +{u.features.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Actions and expand/collapse */}
                <div className='flex flex-col items-end gap-2'>
                  <span
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteUser(u.id);
                    }}
                    className='w-full'
                  >
                    <Button
                      variant='danger'
                      size='sm'
                      disabled={u.username === user?.username}
                      className='mt-2'
                    >
                      Delete
                    </Button>
                  </span>
                  <button
                    className='text-gray-400 hover:text-blue-600 transition-colors'
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedUserId(expandedUserId === u.id ? null : u.id);
                    }}
                    aria-label={
                      expandedUserId === u.id
                        ? 'Collapse details'
                        : 'Expand details'
                    }
                    type='button'
                  >
                    {expandedUserId === u.id ? (
                      <ChevronUp className='w-5 h-5' />
                    ) : (
                      <ChevronDown className='w-5 h-5' />
                    )}
                  </button>
                </div>
              </div>
              {/* Expanded Details (on click) */}
              <div
                className={`transition-all duration-200 ${editingUserId === u.id ? 'overflow-visible' : 'overflow-hidden'} ${expandedUserId === u.id ? (editingUserId === u.id ? 'max-h-none opacity-100 py-3 px-0' : 'max-h-96 opacity-100 py-3 px-0') : 'max-h-0 opacity-0 py-0 px-0'} w-full bg-gray-50 rounded-b-2xl border-t border-gray-100`}
                style={{
                  pointerEvents: expandedUserId === u.id ? 'auto' : 'none',
                }}
              >
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 px-2 md:px-6 ${editingUserId === u.id ? 'overflow-visible' : ''}`}>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Full Name</div>
                    <div className='text-gray-800 font-medium'>
                      {u.full_name || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Username</div>
                    <div className='text-gray-800 font-medium'>
                      {u.username}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Email</div>
                    <div className='text-gray-800 font-medium'>
                      {u.email || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Phone</div>
                    <div className='text-gray-800 font-medium'>
                      {u.phone || '-'}
                    </div>
                  </div>
                  <div className='md:col-span-2'>
                    <div className='mb-1 text-xs text-gray-500'>Address</div>
                    <div className='text-gray-800 font-medium'>
                      {u.address || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Aadhaar Number</div>
                    <div className='text-gray-800 font-medium'>
                      {u.aadhaar_number || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Date of Birth</div>
                    <div className='text-gray-800 font-medium'>
                      {u.date_of_birth ? format(new Date(u.date_of_birth), 'dd/MM/yyyy') : '-'}
                    </div>
                  </div>
                  {u.other_details && (
                    <div className='md:col-span-2'>
                      <div className='mb-1 text-xs text-gray-500'>Other Details</div>
                      <div className='text-gray-800 font-medium text-sm'>
                        {u.other_details}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>
                      Admin Status
                    </div>
                    <div className='text-gray-800 font-medium'>
                      {u.is_admin ? 'Admin' : 'User'}
                    </div>
                  </div>
                  <div className={`md:col-span-2 ${editingUserId === u.id ? 'overflow-visible' : ''}`}>
                    <div className='mb-1 text-xs text-gray-500 flex items-center gap-2'>
                      Feature Access
                      {!u.is_admin &&
                        (editingUserId === u.id ? (
                          <>
                            <button
                              className='ml-2 text-gray-500 hover:text-blue-700 text-xs flex items-center gap-1'
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Save current scroll position
                                const scrollY = window.scrollY;
                                setEditingUserId(null);
                                setEditFeaturesByMode(emptyModeFeatures());
                                // Restore scroll position after state update
                                requestAnimationFrame(() => {
                                  window.scrollTo(0, scrollY);
                                });
                              }}
                              type='button'
                            >
                              <X className='w-4 h-4' /> Cancel
                            </button>
                            <button
                              className='ml-2 text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1'
                              onClick={async () => {
                                // Save feature access changes
                                setLoading(true);
                                try {
                                  const supportsMode = await ensureUserAccessModeSupport();
                                  
                                  // STEP 1: Ensure all features exist in the features table
                                  const allFeatureKeys = MODE_VALUES.flatMap(modeKey => 
                                    normalizeFeatures(editFeaturesByMode[modeKey] || [])
                                  );
                                  const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
                                  
                                  console.log('🔧 Ensuring all features exist in features table...');
                                  for (const featureKey of uniqueFeatureKeys) {
                                    const trimmedKey = featureKey.trim();
                                    if (!trimmedKey) continue;
                                    
                                    const featureDef = features.find(f => f.key === trimmedKey);
                                    if (featureDef) {
                                      const { error: featureError } = await supabase
                                        .from('features')
                                        .upsert(
                                          { key: featureDef.key, name: featureDef.name },
                                          { onConflict: 'key' }
                                        );
                                      
                                      if (featureError && featureError.code !== '23505' && featureError.code !== 'PGRST116') {
                                        console.warn(`⚠️ Could not ensure feature "${trimmedKey}":`, featureError);
                                      }
                                    }
                                    await new Promise(resolve => setTimeout(resolve, 50));
                                  }
                                  
                                  // STEP 2: Remove all current access for this user
                                  const { error: deleteError } = await supabase
                                    .from('user_access')
                                    .delete()
                                    .eq('user_id', u.id);
                                  
                                  if (deleteError) {
                                    console.error('Error deleting existing access:', deleteError);
                                  }
                                  
                                  // STEP 3: Add new access grouped by mode
                                  let successCount = 0;
                                  let errorCount = 0;
                                  
                                  for (const modeKey of MODE_VALUES) {
                                    const modeFeatures = normalizeFeatures(editFeaturesByMode[modeKey] || []);
                                    
                                    for (const featureKey of modeFeatures) {
                                      const trimmedKey = featureKey.trim();
                                      if (!trimmedKey) continue;
                                      
                                      try {
                                        const editPayload: Record<string, any> = {
                                          user_id: u.id,
                                          feature_key: trimmedKey,
                                        };
                                        if (supportsMode) {
                                          editPayload.mode = modeKey;
                                        }
                                        
                                        const { error: insertError, data: insertData } = await upsertUserAccess(
                                          editPayload,
                                          supportsMode
                                        );
                                        
                                        if (insertData && insertData.length > 0) {
                                          console.log(`✅ Feature "${trimmedKey}" saved for ${modeKey} mode`);
                                          successCount++;
                                        } else if (insertError) {
                                          console.error(`❌ Error inserting feature "${trimmedKey}" for ${modeKey}:`, insertError);
                                          errorCount++;
                                        } else {
                                          successCount++;
                                        }
                                        
                                        await new Promise(resolve => setTimeout(resolve, 50));
                                      } catch (err: any) {
                                        console.error(`❌ Exception inserting feature "${trimmedKey}" for ${modeKey}:`, err);
                                        errorCount++;
                                      }
                                    }
                                  }
                                  
                                  // Show result
                                  if (successCount > 0) {
                                    const message = errorCount > 0
                                      ? `Feature access updated! ${successCount} feature(s) saved. ${errorCount} failed.`
                                      : `Feature access updated! ${successCount} feature(s) saved successfully.`;
                                    toast.success(message);
                                  } else if (errorCount > 0) {
                                    toast.error(`Failed to update features. ${errorCount} error(s) occurred. Check console for details.`);
                                  } else {
                                    toast.success('Feature access cleared.');
                                  }
                                  
                                  setEditingUserId(null);
                                  setEditFeaturesByMode(emptyModeFeatures());
                                  
                                  // Wait a bit for database to commit changes before reloading
                                  await new Promise(resolve => setTimeout(resolve, 300));
                                  await loadUsers();
                                } catch (err: any) {
                                  console.error('Error updating features:', err);
                                  toast.error(err.message || 'Error updating feature access');
                                }
                                setLoading(false);
                              }}
                              type='button'
                              disabled={loading}
                            >
                              <Save className='w-4 h-4' /> Save
                            </button>
                          </>
                        ) : (
                          <button
                            className='ml-2 text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Save current scroll position
                              const scrollY = window.scrollY;
                              setEditingUserId(u.id);
                              // Load features by mode from user's current access
                              // Ensure both regular and itr keys exist by merging with emptyModeFeatures
                              const baseFeatures = emptyModeFeatures();
                              const userFeatures = u.featuresByMode || emptyModeFeatures();
                              // Ensure both keys exist and are arrays
                              const featuresByMode: Record<ModeKey, string[]> = {
                                regular: Array.isArray(userFeatures.regular) ? userFeatures.regular : baseFeatures.regular,
                                itr: Array.isArray(userFeatures.itr) ? userFeatures.itr : baseFeatures.itr,
                              };
                              console.log('📝 Loading edit features for user:', u.username, {
                                featuresByMode,
                                regular: featuresByMode.regular?.length || 0,
                                itr: featuresByMode.itr?.length || 0,
                                totalFeaturesAvailable: features.length,
                                hasRegularKey: 'regular' in featuresByMode,
                                hasItrKey: 'itr' in featuresByMode,
                                MODE_VALUES: MODE_VALUES
                              });
                              // Force ensure both keys exist before setting state
                              const finalFeaturesByMode: Record<ModeKey, string[]> = {
                                regular: Array.isArray(featuresByMode.regular) ? featuresByMode.regular : [],
                                itr: Array.isArray(featuresByMode.itr) ? featuresByMode.itr : [],
                              };
                              console.log('✅ Setting editFeaturesByMode with both modes:', finalFeaturesByMode);
                              setEditFeaturesByMode(finalFeaturesByMode);
                              // Restore scroll position after state update
                              requestAnimationFrame(() => {
                                window.scrollTo(0, scrollY);
                              });
                            }}
                            type='button'
                          >
                            <Edit className='w-4 h-4' /> Edit
                          </button>
                        ))}
                    </div>
                    {u.is_admin ? (
                      <span className='inline-block bg-gradient-to-r from-green-100 to-green-300 text-green-900 px-3 py-1 rounded-full text-xs font-semibold border border-green-200 shadow-sm'>
                        All Access (Admin)
                      </span>
                    ) : editingUserId === u.id ? (
                      <div className='mt-4 space-y-6 w-full overflow-visible'>
                        <div className='font-semibold mb-4 text-blue-800'>
                          Feature Access by Mode
                        </div>
                        {features.length === 0 ? (
                          <div className='text-red-600 text-sm p-4 bg-red-50 rounded border border-red-200'>
                            No features available. Please refresh the page.
                          </div>
                        ) : (
                          <div className='space-y-6 w-full overflow-visible'>
                            {MODE_VALUES.map(modeKey => {
                              // Ensure both regular and itr keys exist in editFeaturesByMode
                              const safeEditFeatures = {
                                regular: editFeaturesByMode?.regular || [],
                                itr: editFeaturesByMode?.itr || [],
                              };
                              const selected = safeEditFeatures[modeKey] || [];
                              return (
                                <div
                                  key={modeKey}
                                  className='border border-gray-200 rounded-2xl shadow-sm overflow-visible'
                                >
                                  <div
                                    className={`px-4 py-3 flex items-center justify-between text-white bg-gradient-to-r ${MODE_BADGES[modeKey].gradient}`}
                                  >
                                    <div className='flex items-center gap-2 text-base font-semibold'>
                                      {modeKey === 'itr' ? (
                                        <FileCheck className='w-5 h-5' />
                                      ) : (
                                        <Briefcase className='w-5 h-5' />
                                      )}
                                      {MODE_LABELS[modeKey]}
                                    </div>
                                    <span className='text-sm font-medium bg-white/20 px-3 py-1 rounded-full'>
                                      {selected.length} selected
                                    </span>
                                  </div>
                                  <div className='p-4'>
                                    <div className='flex flex-wrap gap-2 sm:gap-3'>
                                      {features.map(f => {
                                        const isSelected = selected.includes(f.key);
                                        return (
                                          <label
                                            key={`${modeKey}-${f.key}`}
                                            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow border-2 transition-all cursor-pointer select-none text-xs sm:text-sm font-medium
                                            ${
                                              isSelected
                                                ? 'bg-gradient-to-r from-blue-200 to-indigo-200 text-blue-900 border-blue-400 scale-105'
                                                : 'bg-blue-50 text-blue-800 border-blue-100 hover:border-blue-300 hover:bg-blue-100'
                                            }
                                          `}
                                          >
                                            <input
                                              type='checkbox'
                                              checked={isSelected}
                                              onChange={e => {
                                                e.stopPropagation();
                                                handleEditFeatureToggle(modeKey, f.key);
                                              }}
                                              onClick={e => e.stopPropagation()}
                                              className='accent-blue-600 w-5 h-5 cursor-pointer'
                                            />
                                            <span className='cursor-pointer'>{f.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <p className='mt-3 text-xs text-gray-500'>
                                      Select the features this user should have in {MODE_LABELS[modeKey]}. They will only see these options when using this mode.
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : u.features.length === 0 ? (
                      <span className='inline-block bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-medium border border-gray-200'>
                        No access assigned
                      </span>
                    ) : (
                      <div className='flex flex-wrap gap-2'>
                        {u.features.map(fk => {
                          const f = features.find(ff => ff.key === fk);
                          return f ? (
                            <span
                              key={fk}
                              className='flex items-center gap-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 shadow-sm'
                            >
                              {f.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
                );
                })}
              </div>
            </div>
          )}

          {/* Regular Users Section */}
          {users.filter(u => !u.is_admin).length > 0 && (
            <div>
              <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center gap-2'>
                <UserIcon className='w-5 h-5 text-blue-600' />
                Users ({users.filter(u => !u.is_admin).length})
              </h2>
              <div className='flex flex-col gap-6'>
                {users.filter(u => !u.is_admin).map(u => {

                  return (
            <div
              key={u.id}
              className={`group flex flex-col border rounded-xl shadow-md px-10 py-8 transition-shadow hover:shadow-lg bg-white relative w-full overflow-visible ${expandedUserId === u.id ? 'ring-2 ring-blue-200' : 'bg-white border-gray-200'}`}
              onMouseEnter={() =>
                setExpandedUserId(expandedUserId === u.id ? null : u.id)
              }
              onMouseLeave={() => {}}
            >
              {/* Main Row (always visible) */}
              <div
                className='flex flex-col md:flex-row items-center md:items-center justify-between gap-4 cursor-pointer w-full'
                onClick={() =>
                  setExpandedUserId(expandedUserId === u.id ? null : u.id)
                }
              >
                <div className='flex items-center gap-5 flex-1 min-w-0'>
                  {/* Avatar */}
                  <div className='w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg border-4 border-white'>
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className='flex flex-col min-w-0'>
                    <div className='flex items-center gap-2 mb-2'>
                      <span className='text-xl font-semibold text-blue-900 truncate max-w-[200px]'>
                        {u.username}
                      </span>
                      {u.is_admin && (
                        <span className='inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold'>
                          <Shield className='w-4 h-4' />
                          Admin
                        </span>
                      )}
                      {isRecentlyCreated(u.created_at) && (
                        <span className='inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold animate-pulse'>
                          <Clock className='w-3 h-3' />
                          New
                        </span>
                      )}
                      {u.mode && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          u.mode === 'itr'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.mode === 'itr' ? (
                            <>
                              <FileCheck className='w-3 h-3' />
                              ITR
                            </>
                          ) : (
                            <>
                              <Briefcase className='w-3 h-3' />
                              Regular
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className='flex flex-wrap gap-2 items-center'>
                      {u.is_admin ? (
                        <span className='inline-block bg-gradient-to-r from-green-100 to-green-300 text-green-900 px-3 py-1 rounded-full text-xs font-semibold border border-green-200 shadow-sm'>
                          All Access (Admin)
                        </span>
                      ) : u.features.length === 0 ? (
                        <span className='inline-block bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-medium border border-gray-200'>
                          No access
                        </span>
                      ) : (
                        u.features.slice(0, 2).map(fk => {
                          const f = features.find(ff => ff.key === fk);
                          return f ? (
                            <span
                              key={fk}
                              className='flex items-center gap-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 shadow-sm'
                            >
                              {/* Optionally add an icon here */}
                              {f.name}
                            </span>
                          ) : null;
                        })
                      )}
                      {!u.is_admin && u.features.length > 2 && (
                        <span className='bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-200'>
                          +{u.features.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Actions and expand/collapse */}
                <div className='flex flex-col items-end gap-2'>
                  <span
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteUser(u.id);
                    }}
                    className='w-full'
                  >
                    <Button
                      variant='danger'
                      size='sm'
                      disabled={u.username === user?.username}
                      className='mt-2'
                    >
                      Delete
                    </Button>
                  </span>
                  <button
                    className='text-gray-400 hover:text-blue-600 transition-colors'
                    onClick={e => {
                      e.stopPropagation();
                      setExpandedUserId(expandedUserId === u.id ? null : u.id);
                    }}
                    aria-label={
                      expandedUserId === u.id
                        ? 'Collapse details'
                        : 'Expand details'
                    }
                    type='button'
                  >
                    {expandedUserId === u.id ? (
                      <ChevronUp className='w-5 h-5' />
                    ) : (
                      <ChevronDown className='w-5 h-5' />
                    )}
                  </button>
                </div>
              </div>
              {/* Expanded Details (on click) */}
              <div
                className={`transition-all duration-200 ${editingUserId === u.id ? 'overflow-visible' : 'overflow-hidden'} ${expandedUserId === u.id ? (editingUserId === u.id ? 'max-h-none opacity-100 py-3 px-0' : 'max-h-96 opacity-100 py-3 px-0') : 'max-h-0 opacity-0 py-0 px-0'} w-full bg-gray-50 rounded-b-2xl border-t border-gray-100`}
                style={{
                  pointerEvents: expandedUserId === u.id ? 'auto' : 'none',
                }}
              >
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 px-2 md:px-6 ${editingUserId === u.id ? 'overflow-visible' : ''}`}>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Full Name</div>
                    <div className='text-gray-800 font-medium'>
                      {u.full_name || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Username</div>
                    <div className='text-gray-800 font-medium'>
                      {u.username}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Email</div>
                    <div className='text-gray-800 font-medium'>
                      {u.email || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Phone</div>
                    <div className='text-gray-800 font-medium'>
                      {u.phone || '-'}
                    </div>
                  </div>
                  <div className='md:col-span-2'>
                    <div className='mb-1 text-xs text-gray-500'>Address</div>
                    <div className='text-gray-800 font-medium'>
                      {u.address || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Aadhaar Number</div>
                    <div className='text-gray-800 font-medium'>
                      {u.aadhaar_number || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>Date of Birth</div>
                    <div className='text-gray-800 font-medium'>
                      {u.date_of_birth ? format(new Date(u.date_of_birth), 'dd/MM/yyyy') : '-'}
                    </div>
                  </div>
                  {u.other_details && (
                    <div className='md:col-span-2'>
                      <div className='mb-1 text-xs text-gray-500'>Other Details</div>
                      <div className='text-gray-800 font-medium text-sm'>
                        {u.other_details}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className='mb-1 text-xs text-gray-500'>
                      Admin Status
                    </div>
                    <div className='text-gray-800 font-medium'>
                      {u.is_admin ? 'Admin' : 'User'}
                    </div>
                  </div>
                  <div className={`md:col-span-2 ${editingUserId === u.id ? 'overflow-visible' : ''}`}>
                    <div className='mb-1 text-xs text-gray-500 flex items-center gap-2'>
                      Feature Access
                      {!u.is_admin &&
                        (editingUserId === u.id ? (
                          <>
                            <button
                              className='ml-2 text-gray-500 hover:text-blue-700 text-xs flex items-center gap-1'
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Save current scroll position
                                const scrollY = window.scrollY;
                                setEditingUserId(null);
                                setEditFeaturesByMode(emptyModeFeatures());
                                // Restore scroll position after state update
                                requestAnimationFrame(() => {
                                  window.scrollTo(0, scrollY);
                                });
                              }}
                              type='button'
                            >
                              <X className='w-4 h-4' /> Cancel
                            </button>
                            <button
                              className='ml-2 text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1'
                              onClick={async () => {
                                // Save feature access changes
                                setLoading(true);
                                try {
                                  const supportsMode = await ensureUserAccessModeSupport();
                                  
                                  // STEP 1: Ensure all features exist in the features table
                                  const allFeatureKeys = MODE_VALUES.flatMap(modeKey => 
                                    normalizeFeatures(editFeaturesByMode[modeKey] || [])
                                  );
                                  const uniqueFeatureKeys = [...new Set(allFeatureKeys)];
                                  
                                  console.log('🔧 Ensuring all features exist in features table...');
                                  for (const featureKey of uniqueFeatureKeys) {
                                    const trimmedKey = featureKey.trim();
                                    if (!trimmedKey) continue;
                                    
                                    const featureDef = features.find(f => f.key === trimmedKey);
                                    if (featureDef) {
                                      const { error: featureError } = await supabase
                                        .from('features')
                                        .upsert(
                                          { key: featureDef.key, name: featureDef.name },
                                          { onConflict: 'key' }
                                        );
                                      
                                      if (featureError && featureError.code !== '23505' && featureError.code !== 'PGRST116') {
                                        console.warn(`⚠️ Could not ensure feature "${trimmedKey}":`, featureError);
                                      }
                                    }
                                    await new Promise(resolve => setTimeout(resolve, 50));
                                  }
                                  
                                  // STEP 2: Remove all current access for this user
                                  const { error: deleteError } = await supabase
                                    .from('user_access')
                                    .delete()
                                    .eq('user_id', u.id);
                                  
                                  if (deleteError) {
                                    console.error('Error deleting existing access:', deleteError);
                                  }
                                  
                                  // STEP 3: Add new access grouped by mode
                                  let successCount = 0;
                                  let errorCount = 0;
                                  
                                  for (const modeKey of MODE_VALUES) {
                                    const modeFeatures = normalizeFeatures(editFeaturesByMode[modeKey] || []);
                                    
                                    for (const featureKey of modeFeatures) {
                                      const trimmedKey = featureKey.trim();
                                      if (!trimmedKey) continue;
                                      
                                      try {
                                        const editPayload: Record<string, any> = {
                                          user_id: u.id,
                                          feature_key: trimmedKey,
                                        };
                                        if (supportsMode) {
                                          editPayload.mode = modeKey;
                                        }
                                        
                                        const { error: insertError, data: insertData } = await upsertUserAccess(
                                          editPayload,
                                          supportsMode
                                        );
                                        
                                        if (insertData && insertData.length > 0) {
                                          console.log(`✅ Feature "${trimmedKey}" saved for ${modeKey} mode`);
                                          successCount++;
                                        } else if (insertError) {
                                          console.error(`❌ Error inserting feature "${trimmedKey}" for ${modeKey}:`, insertError);
                                          errorCount++;
                                        } else {
                                          successCount++;
                                        }
                                        
                                        await new Promise(resolve => setTimeout(resolve, 50));
                                      } catch (err: any) {
                                        console.error(`❌ Exception inserting feature "${trimmedKey}" for ${modeKey}:`, err);
                                        errorCount++;
                                      }
                                    }
                                  }
                                  
                                  // Show result
                                  if (successCount > 0) {
                                    const message = errorCount > 0
                                      ? `Feature access updated! ${successCount} feature(s) saved. ${errorCount} failed.`
                                      : `Feature access updated! ${successCount} feature(s) saved successfully.`;
                                    toast.success(message);
                                  } else if (errorCount > 0) {
                                    toast.error(`Failed to update features. ${errorCount} error(s) occurred. Check console for details.`);
                                  } else {
                                    toast.success('Feature access cleared.');
                                  }
                                  
                                  setEditingUserId(null);
                                  setEditFeaturesByMode(emptyModeFeatures());
                                  
                                  // Wait a bit for database to commit changes before reloading
                                  await new Promise(resolve => setTimeout(resolve, 300));
                                  await loadUsers();
                                } catch (err: any) {
                                  console.error('Error updating features:', err);
                                  toast.error(err.message || 'Error updating feature access');
                                }
                                setLoading(false);
                              }}
                              type='button'
                              disabled={loading}
                            >
                              <Save className='w-4 h-4' /> Save
                            </button>
                          </>
                        ) : (
                          <button
                            className='ml-2 text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Save current scroll position
                              const scrollY = window.scrollY;
                              setEditingUserId(u.id);
                              // Load features by mode from user's current access
                              // Ensure both regular and itr keys exist by merging with emptyModeFeatures
                              const baseFeatures = emptyModeFeatures();
                              const userFeatures = u.featuresByMode || emptyModeFeatures();
                              // Ensure both keys exist and are arrays
                              const featuresByMode: Record<ModeKey, string[]> = {
                                regular: Array.isArray(userFeatures.regular) ? userFeatures.regular : baseFeatures.regular,
                                itr: Array.isArray(userFeatures.itr) ? userFeatures.itr : baseFeatures.itr,
                              };
                              console.log('📝 Loading edit features for user:', u.username, {
                                featuresByMode,
                                regular: featuresByMode.regular?.length || 0,
                                itr: featuresByMode.itr?.length || 0,
                                totalFeaturesAvailable: features.length,
                                hasRegularKey: 'regular' in featuresByMode,
                                hasItrKey: 'itr' in featuresByMode,
                                MODE_VALUES: MODE_VALUES
                              });
                              // Force ensure both keys exist before setting state
                              const finalFeaturesByMode: Record<ModeKey, string[]> = {
                                regular: Array.isArray(featuresByMode.regular) ? featuresByMode.regular : [],
                                itr: Array.isArray(featuresByMode.itr) ? featuresByMode.itr : [],
                              };
                              console.log('✅ Setting editFeaturesByMode with both modes:', finalFeaturesByMode);
                              setEditFeaturesByMode(finalFeaturesByMode);
                              // Restore scroll position after state update
                              requestAnimationFrame(() => {
                                window.scrollTo(0, scrollY);
                              });
                            }}
                            type='button'
                          >
                            <Edit className='w-4 h-4' /> Edit
                          </button>
                        ))}
                    </div>
                    {u.is_admin ? (
                      <span className='inline-block bg-gradient-to-r from-green-100 to-green-300 text-green-900 px-3 py-1 rounded-full text-xs font-semibold border border-green-200 shadow-sm'>
                        All Access (Admin)
                      </span>
                    ) : editingUserId === u.id ? (
                      <div className='mt-4 space-y-6 w-full overflow-visible'>
                        <div className='font-semibold mb-4 text-blue-800'>
                          Feature Access by Mode
                        </div>
                        {features.length === 0 ? (
                          <div className='text-red-600 text-sm p-4 bg-red-50 rounded border border-red-200'>
                            No features available. Please refresh the page.
                          </div>
                        ) : (
                          <div className='space-y-6 w-full overflow-visible'>
                            {MODE_VALUES.map(modeKey => {
                              // Ensure both regular and itr keys exist in editFeaturesByMode
                              const safeEditFeatures = {
                                regular: editFeaturesByMode?.regular || [],
                                itr: editFeaturesByMode?.itr || [],
                              };
                              const selected = safeEditFeatures[modeKey] || [];
                              return (
                                <div
                                  key={modeKey}
                                  className='border border-gray-200 rounded-2xl shadow-sm overflow-visible'
                                >
                                  <div
                                    className={`px-4 py-3 flex items-center justify-between text-white bg-gradient-to-r ${MODE_BADGES[modeKey].gradient}`}
                                  >
                                    <div className='flex items-center gap-2 text-base font-semibold'>
                                      {modeKey === 'itr' ? (
                                        <FileCheck className='w-5 h-5' />
                                      ) : (
                                        <Briefcase className='w-5 h-5' />
                                      )}
                                      {MODE_LABELS[modeKey]}
                                    </div>
                                    <span className='text-sm font-medium bg-white/20 px-3 py-1 rounded-full'>
                                      {selected.length} selected
                                    </span>
                                  </div>
                                  <div className='p-4'>
                                    <div className='flex flex-wrap gap-2 sm:gap-3'>
                                      {features.map(f => {
                                        const isSelected = selected.includes(f.key);
                                        return (
                                          <label
                                            key={`${modeKey}-${f.key}`}
                                            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow border-2 transition-all cursor-pointer select-none text-xs sm:text-sm font-medium
                                            ${
                                              isSelected
                                                ? 'bg-gradient-to-r from-blue-200 to-indigo-200 text-blue-900 border-blue-400 scale-105'
                                                : 'bg-blue-50 text-blue-800 border-blue-100 hover:border-blue-300 hover:bg-blue-100'
                                            }
                                          `}
                                          >
                                            <input
                                              type='checkbox'
                                              checked={isSelected}
                                              onChange={e => {
                                                e.stopPropagation();
                                                handleEditFeatureToggle(modeKey, f.key);
                                              }}
                                              onClick={e => e.stopPropagation()}
                                              className='accent-blue-600 w-5 h-5 cursor-pointer'
                                            />
                                            <span className='cursor-pointer'>{f.name}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <p className='mt-3 text-xs text-gray-500'>
                                      Select the features this user should have in {MODE_LABELS[modeKey]}. They will only see these options when using this mode.
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : u.features.length === 0 ? (
                      <span className='inline-block bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-medium border border-gray-200'>
                        No access assigned
                      </span>
                    ) : (
                      <div className='flex flex-wrap gap-2'>
                        {u.features.map(fk => {
                          const f = features.find(ff => ff.key === fk);
                          return f ? (
                            <span
                              key={fk}
                              className='flex items-center gap-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 shadow-sm'
                            >
                              {f.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
