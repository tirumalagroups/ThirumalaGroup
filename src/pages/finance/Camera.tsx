import React, { useEffect, useState, useRef } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinancePhoto } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Camera as CameraIcon, Trash2, Check, Video, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Camera: React.FC = () => {
  const [loans, setLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [photoType, setPhotoType] = useState<'Customer' | 'Surety'>('Customer');
  const [existingPhotos, setExistingPhotos] = useState<FinancePhoto[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchLoans();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (selectedLoanId) {
      fetchExistingPhotos();
    } else {
      setExistingPhotos([]);
    }
  }, [selectedLoanId]);

  const fetchLoans = async () => {
    try {
      const data = await supabaseFinance.getLoans();
      setLoans(data.filter(l => l.status === 'Active'));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load active loans list');
    }
  };

  const fetchExistingPhotos = async () => {
    try {
      const loanData = await supabaseFinance.getLoanById(selectedLoanId);
      if (loanData) {
        setExistingPhotos(loanData.photos || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleSavePhoto = async () => {
    if (!selectedLoanId) {
      toast.error('Please select a loan');
      return;
    }
    if (!capturedImage) {
      toast.error('No captured image found');
      return;
    }

    try {
      const result = await supabaseFinance.addPhoto({
        loan_id: selectedLoanId,
        photo_type: photoType,
        photo_url: capturedImage
      });

      if (result) {
        toast.success(`${photoType} photo attached to loan successfully`);
        setCapturedImage(null);
        fetchExistingPhotos();
      } else {
        toast.error('Failed to save photo');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Delete this photo record?')) return;
    try {
      // In migrations we enabled cascade, we can delete the photo
      const { error } = await supabase
        .from('finance_photos')
        .delete()
        .eq('id', photoId);

      if (!error) {
        toast.success('Photo deleted');
        fetchExistingPhotos();
      } else {
        toast.error('Delete failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="finance-h1">Camera Attachment</h1>
          <p className="finance-small-label uppercase">Capture customer/surety photos and link them to active loan records</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Camera Capture Area */}
        <Card title="Live Camera Capture" subtitle="Record customer profile or surety details">
          <div className="space-y-4">
            <div>
              <label className="finance-caption uppercase" >
                Select Active Loan *
              </label>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800 finance-brand"
                
              >
                <option value="">-- Choose Loan (Customer Name) --</option>
                {loans.map(l => (
                  <option key={l.id} value={l.id}>{l.loan_id} - {l.customer?.name} (₹{Number(l.amount).toLocaleString('en-IN')})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="finance-caption uppercase" >
                Photo Category *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoType('Customer')}
                  className={`py-2 px-4 rounded-lg border transition-all ${ photoType === 'Customer' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' } finance-sidebar-link`}
                >
                  Customer Photo
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoType('Surety')}
                  className={`py-2 px-4 rounded-lg border transition-all ${ photoType === 'Surety' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' } finance-sidebar-link`}
                >
                  Surety Photo
                </button>
              </div>
            </div>

            {/* Video Viewport / Capture Panel */}
            <div className="relative aspect-video w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
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
                  alt="Captured Preview"
                  className="w-full h-full object-cover"
                />
              )}

              {!cameraActive && !capturedImage && (
                <div className="text-center p-4 text-gray-400">
                  <CameraIcon className="w-12 h-12 mx-auto stroke-1 mb-2 text-gray-500" />
                  <p className="finance-section-heading">Camera is stopped</p>
                  <p className="mt-1 finance-caption">Click Start Camera below to begin capturing</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {!cameraActive ? (
                <Button
                  onClick={startCamera}
                  variant="success"
                  className="flex-1"
                  icon={Video}
                >
                  Start Camera
                </Button>
              ) : (
                <Button
                  onClick={capturePhoto}
                  variant="primary"
                  className="flex-1"
                  icon={CameraIcon}
                >
                  Capture Frame
                </Button>
              )}

              {capturedImage && (
                <Button
                  onClick={handleSavePhoto}
                  variant="success"
                  className="flex-1"
                  icon={Check}
                >
                  Save Photo
                </Button>
              )}
            </div>

            {/* Hidden canvas for capturing */}
            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          </div>
        </Card>

        {/* Right: Existing Photos for Loan */}
        <Card title="Linked Images" subtitle="Uploaded customer or surety documentation">
          {!selectedLoanId ? (
            <div className="flex flex-col items-center justify-center border border-dashed rounded-lg py-16 px-4 bg-gray-50/50">
              <AlertCircle className="w-10 h-10 text-gray-400 stroke-1 mb-2" />
              <p className="finance-small-label uppercase">No loan selected</p>
              <p className="finance-small-label uppercase">Select an active loan to inspect attached documents</p>
            </div>
          ) : existingPhotos.length === 0 ? (
            <div className="text-center py-8 text-gray-400 finance-input">No photos attached to this loan yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {existingPhotos.map(photo => (
                <div key={photo.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                  <div className="aspect-square relative bg-gray-100">
                    <img
                      src={photo.photo_url}
                      alt={photo.photo_type}
                      className="w-full h-full object-cover"
                    />
                    <span className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-white shadow ${ photo.photo_type === 'Customer' ? 'bg-green-600' : 'bg-blue-600' } finance-header-time`}>
                      {photo.photo_type}
                    </span>
                  </div>
                  <div className="p-3 border-t flex justify-between items-center bg-gray-50">
                    <span className="text-gray-400 font-mono finance-small-label">
                      {new Date(photo.created_at).toLocaleDateString('en-IN')}
                    </span>
                    <Button
                      onClick={() => handleDeletePhoto(photo.id)}
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Camera;
