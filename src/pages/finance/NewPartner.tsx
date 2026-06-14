import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import { supabaseFinance, FinancePartner } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { useAuth } from '../../contexts/AuthContext';

const NewPartner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  
  // Fields state
  const [partnerId, setPartnerId] = useState<number | string>('...');
  const [isMd, setIsMd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [homePhone, setHomePhone] = useState('');
  const [village, setVillage] = useState('');
  const [mdName, setMdName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const nameRef = React.useRef<HTMLInputElement>(null);

  // Fetch data on load depending on mode
  useEffect(() => {
    if (editId) {
      loadPartnerDetails(editId);
    } else {
      fetchNextPartnerId();
    }
  }, [editId]);

  const fetchNextPartnerId = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .select('partner_id')
        .order('partner_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setPartnerId((data[0].partner_id || 0) + 1);
      } else {
        setPartnerId(1);
      }
    } catch (err) {
      console.error('Error fetching next partner ID:', err);
      setPartnerId(1); // Default fallback
    }
  };

  const loadPartnerDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setPartnerId(data.partner_id || '');
        setIsMd(data.is_md || false);
        setName(data.name || '');
        setPhone(data.phone || '');
        setHomePhone(data.home_phone || '');
        setVillage(data.village || '');
        setMdName(data.md_name || '');
        setAddress(data.address || '');
      }
    } catch (err) {
      console.error('Error loading partner details:', err);
      toast.error('Failed to load partner details');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to clear the form?')) {
      setName('');
      setIsMd(false);
      setPhone('');
      setHomePhone('');
      setVillage('');
      setMdName('');
      setAddress('');
      if (editId) {
        loadPartnerDetails(editId);
      } else {
        fetchNextPartnerId();
      }
      toast.success('Form reset');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();

    const fields: ValidationField[] = [
      { name: 'name', label: 'Name', value: name, required: true, ref: nameRef }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);

    if (!isValid) return;

    setSaving(true);
    const savingToastId = toast.loading(editId ? 'Updating partner details...' : 'Registering partner...');
    try {
      const staffName = user?.username || 'Staff';
      const payload: Partial<FinancePartner> = {
        name: name.trim(),
        is_md: isMd,
        phone: phone.trim() || null,
        home_phone: homePhone.trim() || null,
        village: village.trim() || null,
        md_name: mdName.trim() || null,
        address: address.trim() || null
      };

      let result;
      if (editId) {
        result = await supabaseFinance.updatePartner(editId, payload, staffName);
      } else {
        result = await supabaseFinance.createPartner(payload as any);
      }

      if (result) {
        toast.success(editId ? 'Partner details updated!' : `Partner "${name.trim()}" registered!`, { id: savingToastId });
        navigate('/finance/partners');
      } else {
        toast.error(editId ? 'Failed to update partner' : 'Failed to register partner', { id: savingToastId });
      }
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error occurred while saving partner data';
      toast.error(errMsg, { id: savingToastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span>PARTNERS</span>
            <span>/</span>
            <span className="text-slate-600">{editId ? 'EDIT' : 'NEW'}</span>
          </div>
          <h1 className="mt-1 finance-h1">
            {editId ? 'EDIT PARTNER' : 'NEW PARTNER'}
          </h1>
          <p className="mt-0.5 finance-small-label uppercase">
            {editId ? 'MODIFY PARTNER OR MD PROFILE DETAILS' : 'REGISTER A PARTNER OR MD WHO SOURCES BUSINESS'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance/partners')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-550" />
            RESET
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="max-w-4xl">
        <form onSubmit={handleSubmit}>
          <Card 
            title={<span className="text-slate-900 finance-header-time uppercase">PARTNER DETAILS</span>}
            className="shadow-sm border-slate-150 rounded-xl"
          >
            <div className="space-y-4">
              
              {/* Partner ID & Role Checkbox Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="PARTNER ID"
                  value={partnerId}
                  readOnly={true}
                  disabled={true}
                />
                
                <div>
                  <label className="finance-caption uppercase">
                    ROLE
                  </label>
                  <div className="flex items-center h-10 px-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <label className="inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isMd}
                        onChange={(e) => setIsMd(e.target.checked)}
                        className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 focus:outline-none"
                      />
                      <span className="ml-2 text-slate-850 finance-header-time uppercase">
                        IS MD?
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Name (Full Width) */}
              <Input
                label="NAME"
                value={name}
                onChange={(val) => { setName(val); setErrors(p => ({...p, name: false})) }}
                placeholder="Full Name"
                required
                ref={nameRef}
                error={errors.name}
              />

              {/* Phones (Grid of 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="PHONE"
                  value={phone}
                  onChange={setPhone}
                  placeholder="Primary contact number"
                />
                <Input
                  label="HOME PHONE"
                  value={homePhone}
                  onChange={setHomePhone}
                  placeholder="Alternate/Home number"
                />
              </div>

              {/* Village & MD Name (Grid of 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="VILLAGE"
                  value={village}
                  onChange={setVillage}
                  placeholder="Village / Location"
                />
                <Input
                  label="MD NAME"
                  value={mdName}
                  onChange={setMdName}
                  placeholder="Managing Director Name"
                />
              </div>

              {/* Address (Textarea) */}
              <div>
                <label className="finance-caption uppercase">
                  ADDRESS
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Residential or Office address"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-855 focus:ring-1 focus:ring-slate-950 focus:outline-none h-24 finance-header-time"
                />
              </div>

            </div>
          </Card>
        </form>
      </div>

    </div>
  );
};

export default NewPartner;
