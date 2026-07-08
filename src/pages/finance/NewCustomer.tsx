import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  RotateCcw, 
  Save, 
  Camera, 
  FileImage, 
  X, 
  RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BiometricScanner } from '../../components/finance/BiometricScanner';
import { validateFinanceForm, ValidationField } from '../../utils/financeValidation';
import { compressToWebP } from '../../utils/imageCompressor';

const NewCustomer: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [estimatedId, setEstimatedId] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const aadhaarRef = useRef<HTMLInputElement>(null);
  const aadhaarAddressRef = useRef<HTMLTextAreaElement>(null);
  const presentAddressRef = useRef<HTMLTextAreaElement>(null);
  const phone1Ref = useRef<HTMLInputElement>(null);

  // Form State
  const [aadhaar, setAadhaar] = useState('');
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [aadhaarVillage, setAadhaarVillage] = useState('');
  const [aadhaarMandal, setAadhaarMandal] = useState('');
  const [aadhaarDistrict, setAadhaarDistrict] = useState('');
  const [presentVillage, setPresentVillage] = useState('');
  const [presentMandal, setPresentMandal] = useState('');
  const [presentDistrict, setPresentDistrict] = useState('');
  const [aadhaarAddress, setAadhaarAddress] = useState('');
  const [presentAddress, setPresentAddress] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Fingerprint State
  const [fingerprintUrl, setFingerprintUrl] = useState<string | null>(null);
  const [fingerprintTemplate, setFingerprintTemplate] = useState<string | null>(null);
  const [fingerprintAdded, setFingerprintAdded] = useState(false);

  // Camera Capture State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  useEffect(() => {
    if (editId) {
      loadCustomerDetails(editId);
    } else {
      fetchNextId();
    }
    return () => {
      stopCamera();
    };
  }, [editId]);

  const loadCustomerDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        setEstimatedId(data.customer_id || 1);
        setAadhaar(data.aadhaar || '');
        setName(data.name || '');
        setFatherName(data.father_name || data.father_husband_name || '');
        setAadhaarVillage(data.aadhaar_village || data.village || '');
        setAadhaarMandal(data.aadhaar_mandal || data.mandal || '');
        setAadhaarDistrict(data.aadhaar_district || data.district || '');
        setPresentVillage(data.present_village || data.village || '');
        setPresentMandal(data.present_mandal || data.mandal || '');
        setPresentDistrict(data.present_district || data.district || '');
        setAadhaarAddress(data.aadhaar_address || '');
        setPresentAddress(data.present_address || data.address || '');
        setPhone1(data.phone_1 || data.phone || '');
        setPhone2(data.phone_2 || data.phone2 || '');
        setPhotoUrl(data.customer_photo_url || null);
        setCapturedImage(data.customer_photo_url || null);
        setFingerprintUrl(data.fingerprint_url || null);
        setFingerprintTemplate(data.fingerprint_template || null);
        setFingerprintAdded(data.fingerprint_added || false);
      }
    } catch (err) {
      console.error('Error loading customer details:', err);
      toast.error('Failed to load customer details');
    }
  };

  const fetchNextId = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('customer_id')
        .order('customer_id', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setEstimatedId((data[0].customer_id || 0) + 1);
      } else {
        setEstimatedId(1);
      }
    } catch (err) {
      console.error('Error fetching next customer ID:', err);
    }
  };

  // Webcam Helpers
  const startCamera = async () => {
    try {
      setCapturedImage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Could not access camera. Please check device permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        stopCamera();
        uploadPhoto(dataUrl);
      }
    }
  };

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const uploadPhoto = async (base64Data: string) => {
    setUploading(true);
    try {
      const fileObj = dataURLtoFile(base64Data, `capture-${Date.now()}.jpg`);
      const compressedBlob = await compressToWebP(fileObj, 1280, 0.78);
      const filename = `capture-${Date.now()}.webp`;

      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`photos/${filename}`, compressedBlob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: true
        });

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setPhotoUrl(publicUrl);
      toast.success('Photo uploaded successfully!');
    } catch (err) {
      console.error('Upload failed, falling back to direct base64:', err);
      // Fallback to storing base64 directly
      setPhotoUrl(base64Data);
      toast('Photo saved in database fallback.', { icon: '⚠️' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('File is too large. Max allowed size is 15MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      setUploading(true);
      try {
        const compressedBlob = await compressToWebP(file, 1280, 0.78);
        const filename = `upload-${Date.now()}.webp`;

        const { data, error } = await supabase.storage
          .from('finance-photos')
          .upload(`photos/${filename}`, compressedBlob, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: true
          });

        if (error) throw error;

        const publicUrl = supabase.storage
          .from('finance-photos')
          .getPublicUrl(data.path).data.publicUrl;

        setPhotoUrl(publicUrl);
        toast.success('Image uploaded successfully!');
      } catch (err) {
        console.error('File upload failed, falling back to base64:', err);
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          setPhotoUrl(base64Reader.result as string);
        };
        base64Reader.readAsDataURL(file);
        toast('Using base64 image encoding fallback.', { icon: '⚠️' });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleClearPhoto = () => {
    stopCamera();
    setCapturedImage(null);
    setPhotoUrl(null);
  };

  const handleResetForm = () => {
    if (!window.confirm('Are you sure you want to clear the form?')) return;
    if (editId) {
      loadCustomerDetails(editId);
    } else {
      setAadhaar('');
      setName('');
      setFatherName('');
      setAadhaarVillage('');
      setAadhaarMandal('');
      setAadhaarDistrict('');
      setPresentVillage('');
      setPresentMandal('');
      setPresentDistrict('');
      setAadhaarAddress('');
      setPresentAddress('');
      setPhone1('');
      setPhone2('');
      handleClearPhoto();
      setFingerprintUrl(null);
      setFingerprintTemplate(null);
      setFingerprintAdded(false);
      fetchNextId();
    }
    toast.success('Form reset successfully');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAadhaar = aadhaar.trim();

    const fields: ValidationField[] = [
      { name: 'name', label: 'Customer Name', value: name, required: true, ref: nameRef },
      { name: 'aadhaarAddress', label: 'Aadhaar Address', value: aadhaarAddress, required: true, ref: aadhaarAddressRef },
      { name: 'presentAddress', label: 'Present Address', value: presentAddress, required: true, ref: presentAddressRef },
      { name: 'phone1', label: 'Phone 1', value: phone1, required: true, ref: phone1Ref },
      { 
        name: 'aadhaar', 
        label: 'Aadhaar', 
        value: cleanAadhaar, 
        required: false, 
        ref: aadhaarRef,
        customValidation: (val) => /^\d{12}$/.test(val) ? null : 'Aadhaar must be exactly 12 digits'
      }
    ];

    const { isValid, errors: newErrors } = validateFinanceForm(fields);
    setErrors(newErrors);

    if (!isValid) return;

    setSaving(true);
    try {
      // 1. Check duplicate Aadhaar if entered
      if (cleanAadhaar) {
        let query = supabase
          .from('finance_customers')
          .select('name, customer_id')
          .eq('aadhaar', cleanAadhaar);
        
        if (editId) {
          query = query.neq('id', editId);
        }

        const { data: existingCustomers, error: checkError } = await query.limit(1);

        if (checkError) {
          console.error('Error checking duplicate Aadhaar:', checkError);
        } else if (existingCustomers && existingCustomers.length > 0) {
          const dup = existingCustomers[0];
          toast.error(`Customer with this Aadhaar already exists (Name: ${dup.name}, ID: ${dup.customer_id || 'N/A'}).`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: name.trim(),
        phone: phone1.trim() || null,
        phone2: phone2.trim() || null,
        partner_name: null,
        address: presentAddress.trim() || null,
        aadhaar: cleanAadhaar || null,
        customer_photo_url: photoUrl || null,
        father_husband_name: fatherName.trim() || null,
        
        // Redesign columns
        father_name: fatherName.trim() || null,
        village: presentVillage.trim() || null,
        mandal: presentMandal.trim() || null,
        district: presentDistrict.trim() || null,
        aadhaar_address: aadhaarAddress.trim() || null,
        aadhaar_village: aadhaarVillage.trim() || null,
        aadhaar_mandal: aadhaarMandal.trim() || null,
        aadhaar_district: aadhaarDistrict.trim() || null,
        present_address: presentAddress.trim() || null,
        present_village: presentVillage.trim() || null,
        present_mandal: presentMandal.trim() || null,
        present_district: presentDistrict.trim() || null,
        phone_1: phone1.trim() || null,
        phone_2: phone2.trim() || null,

        // Fingerprints (only send standard ones which exist in current schema)
        fingerprint_url: fingerprintUrl || null,
        fingerprint_template: fingerprintTemplate || null,
        fingerprint_added: fingerprintAdded
      };

      let result;
      if (editId) {
        // Edit mode
        const staffName = sessionStorage.getItem('thirumala_user') 
          ? JSON.parse(sessionStorage.getItem('thirumala_user')!).username 
          : 'Staff';
        result = await supabaseFinance.updateCustomer(editId, payload, staffName);
      } else {
        // Create mode
        result = await supabaseFinance.createCustomer(payload);
      }

      if (result) {
        toast.success(editId ? 'Customer details updated successfully.' : 'Customer registered successfully.');
        
        if (!editId) {
          // Reset form state on success
          setAadhaar('');
          setName('');
          setFatherName('');
          setAadhaarVillage('');
          setAadhaarMandal('');
          setAadhaarDistrict('');
          setPresentVillage('');
          setPresentMandal('');
          setPresentDistrict('');
          setAadhaarAddress('');
          setPresentAddress('');
          setPhone1('');
          setPhone2('');
          handleClearPhoto();
          setFingerprintUrl(null);
          setFingerprintTemplate(null);
          setFingerprintAdded(false);
          fetchNextId();
        }

        // Redirect
        navigate('/finance/customers');
      } else {
        toast.error(editId ? 'Failed to update customer details.' : 'Failed to register customer. Check console.');
      }
    } catch (err: any) {
      console.error('Customer save error details:', err);
      const errorMsg = err.message || '';
      if (err.code === '23505' || errorMsg.includes('duplicate') || errorMsg.includes('unique constraint')) {
        toast.error('Customer with this Aadhaar already exists.');
      } else {
        toast.error(`Failed to save customer: ${errorMsg || 'Check database connection.'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none print:p-0">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="text-slate-400 finance-small-label uppercase">
            DASHBOARD / CUSTOMERS / {editId ? 'EDIT' : 'NEW'}
          </div>
          <h1 className="mt-1 finance-h1">{editId ? 'EDIT CUSTOMER' : 'NEW CUSTOMER'}</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            {editId ? 'MODIFY CUSTOMER MASTER LIST RECORD' : 'REGISTER A NEW CUSTOMER IN THE MASTER LIST'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 finance-button uppercase"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* Two-Column Grid Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer Details Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              CUSTOMER DETAILS
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="finance-caption uppercase">
                    CUSTOMER ID
                  </label>
                  <input
                    type="text"
                    value={estimatedId}
                    readOnly
                    disabled
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-500 focus:outline-none cursor-not-allowed finance-header-time"
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block finance-input uppercase">
                    AUTO-GENERATED
                  </span>
                </div>

                <div>
                  <label className="finance-caption uppercase">
                    AADHAAR
                  </label>
                  <input
                    type="text"
                    ref={aadhaarRef}
                    value={aadhaar}
                    onChange={(e) => { setAadhaar(e.target.value); setErrors(p => ({...p, aadhaar: false})) }}
                    placeholder="12-digit Aadhaar UID"
                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none finance-header-time ${errors.aadhaar ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                  />
                </div>
              </div>

              <div>
                <label className="finance-caption uppercase">
                  NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  ref={nameRef}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors(p => ({...p, name: false})) }}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none finance-header-time ${errors.name ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  FATHER
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Father's or Husband's name"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
              </div>

              {/* Permanent / Aadhaar Address Details */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h4 className="text-sm font-bold text-slate-950 uppercase tracking-wide">
                  Permanent Address (Aadhaar)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="finance-caption uppercase">
                      AADHAAR ADDRESS <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      ref={aadhaarAddressRef}
                      value={aadhaarAddress}
                      onChange={(e) => { setAadhaarAddress(e.target.value); setErrors(p => ({...p, aadhaarAddress: false})) }}
                      placeholder="Address details as printed on Aadhaar card"
                      rows={2}
                      required
                      className={`w-full bg-white border rounded-lg p-2.5 text-slate-800 focus:outline-none resize-y finance-header-time ${errors.aadhaarAddress ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">
                      AADHAAR VILLAGE
                    </label>
                    <input
                      type="text"
                      value={aadhaarVillage}
                      onChange={(e) => setAadhaarVillage(e.target.value)}
                      placeholder="Village"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                    />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">
                      AADHAAR MANDAL
                    </label>
                    <input
                      type="text"
                      value={aadhaarMandal}
                      onChange={(e) => setAadhaarMandal(e.target.value)}
                      placeholder="Mandal"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="finance-caption uppercase">
                      AADHAAR DISTRICT
                    </label>
                    <input
                      type="text"
                      value={aadhaarDistrict}
                      onChange={(e) => setAadhaarDistrict(e.target.value)}
                      placeholder="District"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                    />
                  </div>
                </div>
              </div>

              {/* Present Address Details */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h4 className="text-sm font-bold text-slate-950 uppercase tracking-wide">
                  Present Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="finance-caption uppercase">
                      PRESENT ADDRESS <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      ref={presentAddressRef}
                      value={presentAddress}
                      onChange={(e) => { setPresentAddress(e.target.value); setErrors(p => ({...p, presentAddress: false})) }}
                      placeholder="Current residential address details"
                      rows={2}
                      required
                      className={`w-full bg-white border rounded-lg p-2.5 text-slate-800 focus:outline-none resize-y finance-header-time ${errors.presentAddress ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">
                      PRESENT VILLAGE
                    </label>
                    <input
                      type="text"
                      value={presentVillage}
                      onChange={(e) => setPresentVillage(e.target.value)}
                      placeholder="Village"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                    />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">
                      PRESENT MANDAL
                    </label>
                    <input
                      type="text"
                      value={presentMandal}
                      onChange={(e) => setPresentMandal(e.target.value)}
                      placeholder="Mandal"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="finance-caption uppercase">
                      PRESENT DISTRICT
                    </label>
                    <input
                      type="text"
                      value={presentDistrict}
                      onChange={(e) => setPresentDistrict(e.target.value)}
                      placeholder="District"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="finance-caption uppercase">
                    PHONE 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    ref={phone1Ref}
                    value={phone1}
                    onChange={(e) => { setPhone1(e.target.value); setErrors(p => ({...p, phone1: false})) }}
                    placeholder="Primary 10-digit number"
                    required
                    className={`w-full bg-white border rounded-lg p-2 text-slate-800 focus:outline-none finance-header-time ${errors.phone1 ? 'border-red-500 bg-red-50 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:ring-1 focus:ring-slate-900'}`}
                  />
                </div>

                <div>
                  <label className="finance-caption uppercase">
                    PHONE 2
                  </label>
                  <input
                    type="text"
                    value={phone2}
                    onChange={(e) => setPhone2(e.target.value)}
                    placeholder="Secondary contact number"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Photo Card */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-slate-900 finance-header-time uppercase">
                CUSTOMER PHOTO
              </h3>
              <p className="text-slate-400 mt-0.5 finance-small-label uppercase">
                UPLOAD OR CAPTURE. SAVED WITH CUSTOMER RECORD.
              </p>
            </div>

            {/* Photo Box Container */}
            <div className="relative border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 flex flex-col items-center justify-center min-h-[240px] overflow-hidden shadow-inner">
              
              {/* Camera Active State */}
              {cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute bottom-4 flex gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 flex items-center gap-1 finance-header-time"
                    >
                      <Camera className="w-4 h-4" />
                      CAPTURE
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg shadow hover:bg-slate-700 finance-header-time"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {/* Preview State */}
              {capturedImage && !cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-2">
                  <img
                    src={capturedImage}
                    alt="Preview"
                    className="w-full h-full object-contain rounded-lg"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-900"></div>
                    </div>
                  )}
                  <div className="absolute bottom-4 flex gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg shadow-sm hover:bg-orange-100 flex items-center gap-1 finance-small-label"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      RETAKE
                    </button>
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="px-3 py-1.5 bg-red-50 text-red-650 border border-red-200 rounded-lg shadow-sm hover:bg-red-100 flex items-center gap-1 finance-small-label"
                    >
                      <X className="w-3.5 h-3.5" />
                      CLEAR
                    </button>
                  </div>
                </div>
              )}

              {/* Default Empty State */}
              {!cameraActive && !capturedImage && (
                <div className="text-center space-y-4 w-full flex flex-col items-center">
                  <div 
                    onClick={startCamera}
                    className="cursor-pointer group flex flex-col items-center space-y-2 p-4"
                  >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-orange-500 group-hover:scale-105 transition-all">
                      <Camera className="w-6 h-6 stroke-1.5" />
                    </div>
                    <span className="text-[11px] text-slate-800 block pt-1 finance-input uppercase">
                      CUSTOMER PHOTO
                    </span>
                    <span className="text-[9px] text-slate-400 block finance-input uppercase">
                      CLICK TO CAPTURE PHOTO
                    </span>
                  </div>

                  <div className="w-full flex items-center justify-center gap-2 pt-2 border-t border-slate-100/60">
                    <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5 finance-small-label uppercase">
                      <FileImage className="w-3.5 h-3.5 text-slate-500" />
                      OR SELECT FROM DEVICE
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden elements */}
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          </div>

          {/* Fingerprint Capture Card */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <BiometricScanner
              label="Customer Fingerprint Capture"
              existingTemplate={fingerprintTemplate}
              existingImageUrl={fingerprintUrl}
              onFingerprintSaved={(url, template, added) => {
                setFingerprintUrl(url);
                setFingerprintTemplate(template);
                setFingerprintAdded(added);
              }}
            />
          </div>
        </div>

      </form>
    </div>
  );
};

export default NewCustomer;
