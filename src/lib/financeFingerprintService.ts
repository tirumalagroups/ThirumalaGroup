import { supabase } from './supabase';

export interface FingerprintScanResult {
  success: boolean;
  message: string;
  template?: string;
  imageUrl?: string;
}

class FinanceFingerprintService {
  private localApiUrl = 'http://localhost:11100'; // Default local web service port for Mantra/biometric readers

  // Check if local scanner API service is running and device is connected
  async checkScannerConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200); // 1.2s timeout

      const response = await fetch(`${this.localApiUrl}/mfs100/info`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(id);

      if (response.ok) {
        const data = await response.json();
        return { 
          connected: data.connected === true, 
          message: data.message || 'Scanner connected' 
        };
      }
      return { connected: false, message: 'Fingerprint scanner integration pending' };
    } catch (err) {
      return { connected: false, message: 'Fingerprint scanner integration pending' };
    }
  }

  // Trigger capturing a fingerprint from the external device
  async captureFingerprint(): Promise<FingerprintScanResult> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000); // 15s capture timeout

      const response = await fetch(`${this.localApiUrl}/mfs100/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(id);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.template) {
          return {
            success: true,
            message: 'Fingerprint captured successfully',
            template: data.template,
            imageUrl: data.imageUrl // Base64 or local server path
          };
        }
        return {
          success: false,
          message: data.message || 'Capture failed'
        };
      }
      return { success: false, message: 'Fingerprint scanner integration pending' };
    } catch (err) {
      return { success: false, message: 'Fingerprint scanner integration pending' };
    }
  }

  // Upload captured fingerprint image to Supabase Storage
  async saveFingerprint(base64Image: string, fileName: string): Promise<string | null> {
    try {
      if (!base64Image || base64Image.startsWith('http')) return base64Image;

      const arr = base64Image.split(',');
      const mime = arr[0].match(/:(.*?);/)![1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      const file = new File([u8arr], fileName, { type: mime });
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`fingerprints/${file.name}`, file);

      if (error) throw error;

      return supabase.storage.from('finance-photos').getPublicUrl(data.path).data.publicUrl;
    } catch (err) {
      console.error('Error saving fingerprint image to storage:', err);
      return null;
    }
  }

  // Verify / match two fingerprint templates
  async verifyFingerprint(templateA: string, templateB: string): Promise<{ success: boolean; score?: number; message: string }> {
    try {
      const response = await fetch(`${this.localApiUrl}/mfs100/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateA, templateB })
      });
      if (response.ok) {
        const data = await response.json();
        return {
          success: data.match === true,
          score: data.score,
          message: data.match ? 'Verification successful' : 'Fingerprints do not match'
        };
      }
      return { success: false, message: 'Fingerprint scanner verification service not available' };
    } catch (err) {
      return { success: false, message: 'Fingerprint scanner verification service not available' };
    }
  }
}

export const financeFingerprintService = new FinanceFingerprintService();
export default financeFingerprintService;
