import React, { useState, useEffect } from 'react';
import { Fingerprint, Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface FingerprintCaptureProps {
  label: string;
  existingFingerprintUrl?: string | null;
  existingTemplate?: string | null;
  onFingerprintSaved: (url: string | null, template: string | null) => void;
}

export const FingerprintCapture: React.FC<FingerprintCaptureProps> = ({
  label,
  existingFingerprintUrl = null,
  existingTemplate = null,
  onFingerprintSaved
}) => {
  const [scanning, setScanning] = useState(false);
  const [fingerprintAdded, setFingerprintAdded] = useState(!!existingFingerprintUrl || !!existingTemplate);
  const [fingerprintTemplate, setFingerprintTemplate] = useState<string | null>(existingTemplate);
  const [uploading, setUploading] = useState(false);

  // Sync state if props change
  useEffect(() => {
    setFingerprintAdded(!!existingFingerprintUrl || !!existingTemplate);
    setFingerprintTemplate(existingTemplate);
  }, [existingFingerprintUrl, existingTemplate]);

  // Simulated Fingerprint Scanner Capture
  const handleSimulatedScan = () => {
    setScanning(true);
    setFingerprintAdded(false);
    
    // Simulate biometric acquisition (Mantra / SecuGen device)
    setTimeout(() => {
      setScanning(false);
      setFingerprintAdded(true);
      
      const mockTemplate = JSON.stringify({
        device: "Mantra MFS100 Biometric",
        status: "Success",
        qualityScore: "96%",
        fingerIndex: "Right Thumb",
        capturedAt: new Date().toISOString(),
        templateBase64: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7...MOCK_TEMPLATE_DATA"
      });

      setFingerprintTemplate(mockTemplate);
      // We don't have a file URL for simulated scan, just the template data
      
      onFingerprintSaved("biometric://simulated-right-thumb", mockTemplate);
      toast.success("Fingerprint Captured (Simulated Mantra MFS100)");
    }, 2000);
  };

  // Upload Fingerprint image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const { data, error } = await supabase.storage
          .from('finance-photos')
          .upload(`fingerprints/fp-${Date.now()}-${file.name}`, file);

        if (error) throw error;

        const publicUrl = supabase.storage
          .from('finance-photos')
          .getPublicUrl(data.path).data.publicUrl;

        const template = JSON.stringify({
          device: "Biometric Upload",
          status: "Image Attached",
          originalFilename: file.name,
          uploadedAt: new Date().toISOString(),
          imageUrl: publicUrl
        });

        setFingerprintTemplate(template);
        setFingerprintAdded(true);
        onFingerprintSaved(publicUrl, template);
        toast.success("Fingerprint image uploaded and linked");
      } catch (err) {
        console.error('Biometric file upload failed, using base64 fallback:', err);
        // Fallback to Base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          const template = JSON.stringify({
            device: "Biometric Upload (Local)",
            status: "Base64 Fallback",
            originalFilename: file.name,
            uploadedAt: new Date().toISOString()
          });

          setFingerprintTemplate(template);
          setFingerprintAdded(true);
          onFingerprintSaved(base64Url, template);
          toast("Saved fingerprint image locally.", { icon: '⚠️' });
        };
        reader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleClear = () => {
    setFingerprintAdded(false);
    setFingerprintTemplate(null);
    onFingerprintSaved(null, null);
  };

  return (
    <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="flex justify-between items-center">
        <label className="finance-caption uppercase" >
          {label}
        </label>
        {fingerprintAdded && (
          <button
            type="button"
            onClick={handleClear}
            className="text-red-500 hover:text-red-700 finance-small-label"
          >
            Clear Fingerprint
          </button>
        )}
      </div>

      {/* Biometric Status Box */}
      <div className="border border-gray-300 rounded-lg p-3 bg-white flex flex-col items-center justify-center min-h-[90px] shadow-inner text-center">
        {scanning ? (
          <div className="space-y-2 flex flex-col items-center text-green-600 animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p className="font-mono finance-header-time">Place Finger on Scanner...</p>
          </div>
        ) : fingerprintAdded ? (
          <div className="space-y-1.5 flex flex-col items-center text-green-700">
            <CheckCircle2 className="w-8 h-8 fill-green-50 text-green-600" />
            <div className="finance-header-time">Fingerprint Added</div>
            {fingerprintTemplate && (
              <span className="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-mono max-w-[200px] truncate finance-input">
                {JSON.parse(fingerprintTemplate).device || 'Attached'}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 flex flex-col items-center text-gray-400">
            <Fingerprint className="w-8 h-8 stroke-1 text-gray-400" />
            <p className="finance-caption">Biometric Verification Pending</p>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSimulatedScan}
          disabled={scanning || uploading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-all finance-header-time"
        >
          <Fingerprint className="w-3.5 h-3.5" />
          {scanning ? 'Scanning...' : 'Scan Finger'}
        </button>

        <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50 transition-all text-center finance-header-time">
          <Upload className="w-3.5 h-3.5 text-gray-500" />
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={scanning || uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Future Biometric Software Hooks comment hook for developer review */}
      <div className="hidden">
        {/*
          DEVELOPER NOTE: Biometric Device API Integration Hook.
          To hook up physical USB reader (e.g. Mantra MFS100 / SecuGen Hamster Pro):
          1. Install Mantra/SecuGen local websocket service (usually runs on http://localhost:11100 or http://localhost:8000)
          2. Replace `handleSimulatedScan` with fetch query:
             fetch("http://localhost:11100/mfs100/capture")
               .then(res => res.json())
               .then(data => {
                  if (data.ErrorCode === 0) {
                     setFingerprintTemplate(data.AnsiTemplate);
                     setFingerprintUrl("data:image/bmp;base64," + data.FingerImage);
                     onFingerprintSaved("data:image/bmp;base64," + data.FingerImage, data.AnsiTemplate);
                  }
               })
        */}
      </div>
    </div>
  );
};
