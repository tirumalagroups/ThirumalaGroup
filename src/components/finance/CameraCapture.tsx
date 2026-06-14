import React, { useState, useRef, useEffect } from 'react';
import { Camera as CameraIcon, RefreshCw, Check, Video, FileImage } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface CameraCaptureProps {
  label: string;
  existingPhotoUrl?: string | null;
  onPhotoSaved: (url: string | null) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  label,
  existingPhotoUrl = null,
  onPhotoSaved
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(existingPhotoUrl);
  const [uploading, setUploading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Update image if existing photo url changes
  useEffect(() => {
    if (existingPhotoUrl) {
      setCapturedImage(existingPhotoUrl);
    }
  }, [existingPhotoUrl]);

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
      toast.error('Could not access camera. Please verify permissions.');
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
        // Draw the current video frame on canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Export to Base64 JPEG URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    onPhotoSaved(null);
    startCamera();
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

  const handleSavePhoto = async () => {
    if (!capturedImage) {
      toast.error('No captured image found');
      return;
    }

    // If it's already a saved URL, just call the success
    if (capturedImage.startsWith('http')) {
      toast.success('Photo saved');
      return;
    }

    setUploading(true);
    try {
      // 1. Convert Base64 data to File object
      const fileObj = dataURLtoFile(capturedImage, `capture-${Date.now()}.jpg`);
      
      // 2. Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`photos/${fileObj.name}`, fileObj);

      if (error) {
        throw error;
      }

      // 3. Get Public URL
      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      toast.success('Photo uploaded to storage successfully!');
      onPhotoSaved(publicUrl);
    } catch (err: any) {
      console.error('Storage upload failed, falling back to base64:', err);
      // Fallback: save Base64 directly
      toast('Storage bucket not accessible. Saving directly in database.', { icon: '⚠️' });
      onPhotoSaved(capturedImage);
    } finally {
      setUploading(false);
    }
  };

  // Support local file selection as well
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file directly to Supabase
      setUploading(true);
      try {
        const { data, error } = await supabase.storage
          .from('finance-photos')
          .upload(`photos/upload-${Date.now()}-${file.name}`, file);

        if (error) throw error;

        const publicUrl = supabase.storage
          .from('finance-photos')
          .getPublicUrl(data.path).data.publicUrl;

        toast.success('Uploaded to storage successfully!');
        onPhotoSaved(publicUrl);
      } catch (err) {
        console.error('File upload failed, falling back to base64:', err);
        toast('Using base64 image encoding fallback.', { icon: '⚠️' });
        // Fallback to reading file base64 data
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          onPhotoSaved(base64Reader.result as string);
        };
        base64Reader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleClear = () => {
    stopCamera();
    setCapturedImage(null);
    onPhotoSaved(null);
  };

  return (
    <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="flex justify-between items-center">
        <label className="finance-caption uppercase" >
          {label}
        </label>
        {capturedImage && (
          <button
            type="button"
            onClick={handleClear}
            className="text-red-500 hover:text-red-700 finance-small-label"
          >
            Clear Photo
          </button>
        )}
      </div>

      {/* Video stream or Image preview */}
      <div className="relative aspect-video w-full rounded-lg border border-gray-300 bg-gray-900 flex flex-col items-center justify-center overflow-hidden shadow-inner">
        {cameraActive && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
        )}

        {capturedImage && (
          <img
            src={capturedImage}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        )}

        {!cameraActive && !capturedImage && (
          <div className="text-center p-4 text-gray-400">
            <CameraIcon className="w-8 h-8 mx-auto stroke-1 mb-1 text-gray-500" />
            <p className="finance-header-time">No Photo Captured</p>
            <p className="finance-small-label">Use Camera or Choose File below</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {!cameraActive ? (
            <button
              type="button"
              onClick={startCamera}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-all finance-header-time"
            >
              <Video className="w-3.5 h-3.5" />
              Open Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={capturePhoto}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all finance-header-time"
            >
              <CameraIcon className="w-3.5 h-3.5" />
              Capture
            </button>
          )}

          {capturedImage && (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all finance-header-time"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake
              </button>
              <button
                type="button"
                onClick={handleSavePhoto}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all finance-header-time"
              >
                <Check className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Save Photo'}
              </button>
            </>
          )}
        </div>

        {/* File upload option for accessibility */}
        {!cameraActive && (
          <div className="flex items-center gap-2 border-t pt-2 border-gray-200">
            <span className="text-gray-400 font-sans finance-small-label">Or:</span>
            <label className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer transition-all finance-small-label">
              <FileImage className="w-3 h-3 text-gray-500" />
              Upload Image File
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} width="640" height="480" className="hidden" />
    </div>
  );
};
