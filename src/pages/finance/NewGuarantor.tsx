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
import { useAuth } from '../../contexts/AuthContext';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

const NewGuarantor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [estimatedId, setEstimatedId] = useState<number>(1);

  // Form State
  const [aadhaar, setAadhaar] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [notes, setNotes] = useState('');
  
  // Permanent Address
  const [permanentAddress, setPermanentAddress] = useState('');
  const [permanentVillage, setPermanentVillage] = useState('');
  const [permanentMandal, setPermanentMandal] = useState('');
  const [permanentDistrict, setPermanentDistrict] = useState('');
  
  // Current Address
  const [currentAddress, setCurrentAddress] = useState('');
  const [currentVillage, setCurrentVillage] = useState('');
  const [currentMandal, setCurrentMandal] = useState('');
  const [currentDistrict, setCurrentDistrict] = useState('');

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


  useEffect(() => {
    if (editId) {
      loadGuarantorData(editId);
    } else {
      fetchNextId();
    }
    return () => {
      stopCamera();
    };
  }, [editId]);

  const loadGuarantorData = async (id: string) => {
    try {
      const data = await supabaseFinance.getGuarantorById(id);
      if (data) {
        setEstimatedId(data.guarantor_id || 0);
        setName(data.name || '');
        setAadhaar(data.aadhaar || '');
        setPhone(data.phone || '');
        setPhone2(data.phone_2 || '');
        setFatherName(data.father_name || '');
        setPermanentAddress(data.permanent_address || data.aadhaar_address || '');
        setPermanentVillage(data.permanent_village || data.village || '');
        setPermanentMandal(data.permanent_mandal || data.mandal || '');
        setPermanentDistrict(data.permanent_district || data.district || '');
        
        setCurrentAddress(data.current_address || data.present_address || '');
        setCurrentVillage(data.current_village || '');
        setCurrentMandal(data.current_mandal || '');
        setCurrentDistrict(data.current_district || '');
        
        setNotes(data.notes || '');
        
        if (data.photo_url) {
          setPhotoUrl(data.photo_url);
          setCapturedImage(data.photo_url);
        }
        
        setFingerprintTemplate(data.fingerprint_template || null);
        setFingerprintUrl(data.fingerprint_image_url || null);
        setFingerprintAdded(data.fingerprint_added || false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load guarantor data');
    }
  };

  const fetchNextId = async () => {
    try {
      const { data, error } = await supabase
        .from('finance_guarantors')
        .select('guarantor_id')
        .order('guarantor_id', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setEstimatedId((data[0].guarantor_id || 0) + 1);
      } else {
        setEstimatedId(1);
      }
    } catch (err) {
      console.error('Error fetching next guarantor ID:', err);
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
      const fileObj = dataURLtoFile(base64Data, `guar-capture-${Date.now()}.jpg`);
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`photos/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setPhotoUrl(publicUrl);
      toast.success('Photo uploaded successfully!');
    } catch (err) {
      console.error('Upload failed, falling back to direct base64:', err);
      setPhotoUrl(base64Data);
      toast('Photo saved in database fallback.', { icon: '⚠️' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      setUploading(true);
      try {
        const { data, error } = await supabase.storage
          .from('finance-photos')
          .upload(`photos/guar-upload-${Date.now()}-${file.name}`, file);

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
    setAadhaar('');
    setName('');
    setPhone('');
    setPhone2('');
    setFatherName('');
    setPermanentAddress('');
    setPermanentVillage('');
    setPermanentMandal('');
    setPermanentDistrict('');
    setCurrentAddress('');
    setCurrentVillage('');
    setCurrentMandal('');
    setCurrentDistrict('');
    setNotes('');
    handleClearPhoto();
    setFingerprintUrl(null);
    setFingerprintTemplate(null);
    setFingerprintAdded(false);
    toast.success('Form reset successfully');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Guarantor Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone || null,
        phone_2: phone2 || null,
        father_name: fatherName || null,
        permanent_address: permanentAddress.trim() || null,
        permanent_village: permanentVillage.trim() || null,
        permanent_mandal: permanentMandal.trim() || null,
        permanent_district: permanentDistrict.trim() || null,
        current_address: currentAddress.trim() || null,
        current_village: currentVillage.trim() || null,
        current_mandal: currentMandal.trim() || null,
        current_district: currentDistrict.trim() || null,
        aadhaar: aadhaar || null,
        photo_url: photoUrl,
        fingerprint_template: fingerprintTemplate || null,
        fingerprint_image_url: fingerprintUrl || null,
        fingerprint_added: fingerprintAdded,
        notes: notes || null
      };

      let result;
      if (editId) {
        result = await supabaseFinance.updateGuarantor(editId, payload, user?.username || 'Staff');
        if (result) toast.success(`Guarantor ${name} updated successfully!`);
      } else {
        result = await supabaseFinance.createGuarantor(payload);
        if (result) toast.success(`Guarantor ${name} registered successfully!`);
      }

      if (result) {
        navigate('/finance/guarantors');
      } else {
        toast.error('Failed to save guarantor. Check if Aadhaar is duplicate.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
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
            DASHBOARD / GUARANTORS / {editId ? 'EDIT' : 'NEW'}
          </div>
          <h1 className="mt-1 finance-h1">{editId ? 'EDIT GUARANTOR' : 'NEW GUARANTOR'}</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            {editId ? 'UPDATE EXISTING GUARANTOR MASTER RECORD' : 'REGISTER A NEW GUARANTOR IN THE MASTER LIST'}
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
        
        {/* Left Column: Guarantor Details Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-slate-900 border-b border-slate-100 pb-2 finance-header-time uppercase">
              GUARANTOR DETAILS
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="finance-caption uppercase">
                    GUARANTOR ID
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
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                    placeholder="12-digit Aadhaar UID"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                  />
                </div>
              </div>

              <div>
                <label className="finance-caption uppercase">
                  NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Anand Kumar"
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
              </div>

              <div>
                <label className="finance-caption uppercase">
                  PHONE <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Guarantor contact number"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
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
                  placeholder="Alternate contact number"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
              </div>
              
              <div>
                <label className="finance-caption uppercase">
                  FATHER / HUSBAND NAME
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Guarantor's Father/Husband"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time"
                />
              </div>

              <div className="bg-slate-50/50 border border-slate-150 rounded-lg p-4 space-y-4">
                <h4 className="text-slate-700 finance-caption uppercase font-semibold">
                  PERMANENT ADDRESS
                </h4>
                <div>
                  <label className="finance-caption uppercase">
                    ADDRESS <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="Address as per Aadhaar Card"
                    rows={2}
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none resize-y finance-header-time"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="finance-caption uppercase">VILLAGE</label>
                    <input type="text" value={permanentVillage} onChange={(e) => setPermanentVillage(e.target.value)} placeholder="Village" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time" />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">MANDAL</label>
                    <input type="text" value={permanentMandal} onChange={(e) => setPermanentMandal(e.target.value)} placeholder="Mandal" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time" />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">DISTRICT</label>
                    <input type="text" value={permanentDistrict} onChange={(e) => setPermanentDistrict(e.target.value)} placeholder="District" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 border border-slate-150 rounded-lg p-4 space-y-4">
                <h4 className="text-slate-700 finance-caption uppercase font-semibold">
                  CURRENT ADDRESS
                </h4>
                <div>
                  <label className="finance-caption uppercase">
                    ADDRESS <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e.target.value)}
                    placeholder="Current residential address"
                    rows={2}
                    required
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none resize-y finance-header-time"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="finance-caption uppercase">VILLAGE</label>
                    <input type="text" value={currentVillage} onChange={(e) => setCurrentVillage(e.target.value)} placeholder="Village" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time" />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">MANDAL</label>
                    <input type="text" value={currentMandal} onChange={(e) => setCurrentMandal(e.target.value)} placeholder="Mandal" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time" />
                  </div>
                  <div>
                    <label className="finance-caption uppercase">DISTRICT</label>
                    <input type="text" value={currentDistrict} onChange={(e) => setCurrentDistrict(e.target.value)} placeholder="District" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none finance-header-time" />
                  </div>
                </div>
              </div>

              <div>
                <label className="finance-caption uppercase">
                  NOTES / REMARKS
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none resize-y finance-header-time"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Guarantor Photo Card */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-slate-900 finance-header-time uppercase">
                GUARANTOR PHOTO
              </h3>
              <p className="text-slate-400 mt-0.5 finance-small-label uppercase">
                UPLOAD OR CAPTURE. SAVED WITH GUARANTOR RECORD.
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
                      GUARANTOR PHOTO
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
              label="Guarantor Fingerprint Capture"
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

export default NewGuarantor;
