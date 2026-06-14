import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, RefreshCw, Cpu, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { financeFingerprintService } from '../../lib/financeFingerprintService';
import toast from 'react-hot-toast';

interface BiometricScannerProps {
  label: string;
  existingTemplate?: string | null;
  existingImageUrl?: string | null;
  onFingerprintSaved: (imageUrl: string | null, template: string | null, added: boolean) => void;
  disabled?: boolean;
}

export const BiometricScanner: React.FC<BiometricScannerProps> = ({
  label,
  existingTemplate = null,
  existingImageUrl = null,
  onFingerprintSaved,
  disabled = false
}) => {
  const { user } = useAuth();
  
  // Security validation
  const isAuthorized = user?.is_admin || 
                       user?.features?.includes('loan_entry') || 
                       user?.features?.includes('edit_loan_entry') ||
                       user?.features?.includes('user_access_management');

  // Scanner status states: 
  // 'not_connected' | 'connected' | 'captured' | 'saved'
  const [status, setStatus] = useState<'not_connected' | 'connected' | 'captured' | 'saved'>(
    existingTemplate || existingImageUrl ? 'saved' : 'not_connected'
  );
  
  const [connecting, setConnecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [integrationPending, setIntegrationPending] = useState(false);

  const [tempTemplate, setTempTemplate] = useState<string | null>(existingTemplate);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(existingImageUrl);

  // Sync state if props change
  useEffect(() => {
    if (existingTemplate || existingImageUrl) {
      setStatus('saved');
      setTempTemplate(existingTemplate);
      setTempImageUrl(existingImageUrl);
    }
  }, [existingTemplate, existingImageUrl]);

  const handleConnect = async () => {
    if (!isAuthorized) {
      toast.error('Permission Denied: Only Admin or authorised Finance users can access scanner.');
      return;
    }
    setConnecting(true);
    setIntegrationPending(false);
    try {
      const result = await financeFingerprintService.checkScannerConnection();
      if (result.connected) {
        setStatus('connected');
        toast.success(`Scanner Connected: ${result.message}`);
      } else {
        setStatus('not_connected');
        setIntegrationPending(true);
        toast.error('Fingerprint scanner integration pending');
      }
    } catch (err) {
      setStatus('not_connected');
      setIntegrationPending(true);
    } finally {
      setConnecting(false);
    }
  };

  const handleCapture = async () => {
    if (!isAuthorized) {
      toast.error('Permission Denied.');
      return;
    }
    setCapturing(true);
    setIntegrationPending(false);
    try {
      const result = await financeFingerprintService.captureFingerprint();
      if (result.success && result.template) {
        setTempTemplate(result.template);
        setTempImageUrl(result.imageUrl || 'biometric://captured-fingerprint-image');
        setStatus('captured');
        toast.success('Fingerprint scan captured successfully');
      } else {
        setIntegrationPending(true);
        toast.error(result.message || 'Fingerprint scanner integration pending');
      }
    } catch (err) {
      setIntegrationPending(true);
      toast.error('Fingerprint scanner integration pending');
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setTempTemplate(null);
    setTempImageUrl(null);
    setStatus('connected');
  };

  const handleSave = async () => {
    if (!isAuthorized) {
      toast.error('Permission Denied.');
      return;
    }
    if (!tempTemplate) {
      toast.error('No captured fingerprint to save');
      return;
    }
    setSaving(true);
    try {
      // If we have an image URL captured, upload it
      let finalUrl = tempImageUrl;
      if (tempImageUrl && tempImageUrl.startsWith('data:image')) {
        const uploaded = await financeFingerprintService.saveFingerprint(
          tempImageUrl, 
          `fingerprint-${Date.now()}.png`
        );
        if (uploaded) {
          finalUrl = uploaded;
        }
      }
      
      setStatus('saved');
      onFingerprintSaved(finalUrl, tempTemplate, true);
      toast.success('Fingerprint biometric saved to record.');
    } catch (err) {
      toast.error('Failed to upload/save biometric data');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Wipe fingerprint biometric from this record?')) {
      setTempTemplate(null);
      setTempImageUrl(null);
      setStatus('not_connected');
      onFingerprintSaved(null, null, false);
      toast.success('Fingerprint cleared');
    }
  };

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-3 shadow-sm">
      <div className="flex justify-between items-center">
        <label className="text-gray-700 flex items-center gap-1.5 finance-header-time" >
          <Fingerprint className="w-3.5 h-3.5 text-green-700" />
          {label}
        </label>
        
        {status === 'saved' && isAuthorized && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-red-500 hover:text-red-700 transition-colors finance-small-label"
          >
            Clear Biometric
          </button>
        )}
      </div>

      {/* Security Warning if Unauthorized */}
      {!isAuthorized ? (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-700 finance-small-label">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <div>
            <p className="finance-input">Access Restricted</p>
            <p>Only administrators or authorised finance personnel can manage biometric data.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Status Display Area */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col items-center justify-center min-h-[90px] text-center shadow-inner relative overflow-hidden">
            {connecting && (
              <div className="flex flex-col items-center text-green-600 animate-pulse space-y-1.5">
                <RefreshCw className="w-6 h-6 animate-spin text-green-600" />
                <span className="font-mono finance-small-label">Pinging External Scanner...</span>
              </div>
            )}
            
            {capturing && (
              <div className="flex flex-col items-center text-blue-600 animate-pulse space-y-1.5">
                <Cpu className="w-6 h-6 animate-bounce text-blue-600" />
                <span className="font-mono finance-small-label">Capture requested. Place finger on scanner...</span>
              </div>
            )}
            
            {!connecting && !capturing && (
              <div className="space-y-1.5 flex flex-col items-center">
                {status === 'not_connected' && (
                  <>
                    <WifiOff className="w-6 h-6 text-gray-400 stroke-1" />
                    <span className="text-gray-500 finance-header-time">Scanner not connected</span>
                  </>
                )}
                {status === 'connected' && (
                  <>
                    <Wifi className="w-6 h-6 text-green-600 stroke-1" />
                    <span className="text-green-700 finance-header-time">Scanner connected & ready</span>
                  </>
                )}
                {status === 'captured' && (
                  <>
                    <Fingerprint className="w-7 h-7 text-blue-600 animate-pulse" />
                    <span className="text-blue-700 finance-header-time">Fingerprint captured</span>
                  </>
                )}
                {status === 'saved' && (
                  <>
                    <CheckCircle2 className="w-7 h-7 text-green-600 fill-green-50" />
                    <span className="text-green-700 finance-header-time">Fingerprint Added</span>
                  </>
                )}
              </div>
            )}

            {/* Integration Pending Banner */}
            {integrationPending && !connecting && !capturing && (
              <div className="mt-2 text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded finance-input">
                Fingerprint scanner integration pending
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {status === 'not_connected' && (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || disabled}
                className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-all disabled:opacity-50 finance-header-time"
              >
                Connect Scanner
              </button>
            )}

            {status === 'connected' && (
              <button
                type="button"
                onClick={handleCapture}
                disabled={capturing || disabled}
                className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50 finance-header-time"
              >
                Capture Fingerprint
              </button>
            )}

            {status === 'captured' && (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={disabled}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all disabled:opacity-50 finance-header-time"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || disabled}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50 finance-header-time"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Fingerprint'}
                </button>
              </>
            )}

            {status === 'saved' && (
              <button
                type="button"
                onClick={() => setStatus('connected')}
                disabled={disabled}
                className="col-span-2 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 finance-header-time"
              >
                Change Fingerprint
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
