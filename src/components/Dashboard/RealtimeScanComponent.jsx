import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveScan, createGeoPoint } from '../../firebase/firestore';
import { compressImage } from '../../utils/imageUtils';
import { toast } from 'react-toastify';
import { 
  Camera, 
  X, 
  Loader,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Scan
} from 'lucide-react';

const RealtimeScanComponent = () => {
  const { currentUser } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [fps, setFps] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastDetectionTime = useRef(0);
  const fpsCounter = useRef({ frames: 0, lastTime: Date.now() });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error('Error getting location:', error)
      );
    }

    return () => {
      // Cleanup directly to avoid dependency issues
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      isScanningRef.current = false;
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };

      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('Camera access granted!', stream.getVideoTracks());
      
      // Store stream first
      streamRef.current = stream;
      
      // Set scanning to true to render video element
      setIsScanning(true);
      isScanningRef.current = true;
      
      console.log('Waiting for video element to render...');
      
      // Wait for video element to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!videoRef.current) {
        console.error('Video ref is still null after waiting!');
        toast.error('Failed to create video element');
        return;
      }

      const video = videoRef.current;
      
      // Set stream to video
      video.srcObject = stream;
      
      console.log('Stream assigned to video element');
      
      // Wait for video to be ready and play
      try {
        await video.play();
        console.log('Video is now playing!');
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        
        // Start detection loop
        setTimeout(() => {
          startDetectionLoop();
        }, 100);
        
        toast.success('Camera started successfully!');
      } catch (playError) {
        console.error('Failed to play video:', playError);
        toast.error('Failed to start video: ' + playError.message);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      let errorMessage = 'Failed to access camera. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on your device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setCameraError(errorMessage);
      toast.error(errorMessage);
      setIsScanning(false);
      isScanningRef.current = false;
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    
    isScanningRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsScanning(false);
    setIsPaused(false);
    setResult(null);
  };

  const startDetectionLoop = () => {
    const detectFrame = async () => {
      if (!isScanningRef.current || isPaused) {
        if (isScanningRef.current) {
          animationRef.current = requestAnimationFrame(detectFrame);
        }
        return;
      }

      const now = Date.now();
      
      // Detect every 1000ms (1 FPS) to avoid overwhelming API
      if (now - lastDetectionTime.current > 1000) {
        await performDetection();
        lastDetectionTime.current = now;
      }

      // Update FPS counter
      fpsCounter.current.frames++;
      if (now - fpsCounter.current.lastTime > 1000) {
        setFps(fpsCounter.current.frames);
        fpsCounter.current.frames = 0;
        fpsCounter.current.lastTime = now;
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();
  };

  const performDetection = async () => {
    if (!videoRef.current || !canvasRef.current || isDetecting) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    setIsDetecting(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsDetecting(false);
        return;
      }

      try {
        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('https://ed547b766da6.ngrok-free.app/predict', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            setResult(data);
            drawBoundingBoxes(data);
          }
        }
      } catch (error) {
        console.error('Detection error:', error);
      } finally {
        setIsDetecting(false);
      }
    }, 'image/jpeg', 0.7);
  };

  const drawBoundingBoxes = (data) => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    
    if (!overlay || !video) return;

    const ctx = overlay.getContext('2d');
    overlay.width = video.offsetWidth;
    overlay.height = video.offsetHeight;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const YOLO_SIZE = 640;
    const scaleX = overlay.width / YOLO_SIZE;
    const scaleY = overlay.height / YOLO_SIZE;

    const diseases = Array.isArray(data.diseases) ? data.diseases : [];
    const deficiencies = Array.isArray(data.deficiencies) ? data.deficiencies : [];
    const allDetections = [...diseases, ...deficiencies];

    allDetections.forEach((detection) => {
      if (!detection || !detection.bbox) return;

      let bbox;
      if (Array.isArray(detection.bbox)) {
        bbox = detection.bbox;
      } else if (typeof detection.bbox === 'object' && 'x1' in detection.bbox) {
        bbox = [detection.bbox.x1, detection.bbox.y1, detection.bbox.x2, detection.bbox.y2];
      }

      if (!bbox || bbox.length !== 4) return;

      const [x1, y1, x2, y2] = bbox;
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;
      const scaledX2 = x2 * scaleX;
      const scaledY2 = y2 * scaleY;
      const width = scaledX2 - scaledX1;
      const height = scaledY2 - scaledY1;

      const color = getBoxColor(detection.disease);

      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, width, height);

      const label = `${detection.disease} ${(detection.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 14px Arial';
      const textMetrics = ctx.measureText(label);
      const padding = 5;
      const textHeight = 20;

      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.fillRect(scaledX1, scaledY1 - textHeight - padding, textMetrics.width + padding * 2, textHeight + padding);

      ctx.fillStyle = 'white';
      ctx.fillText(label, scaledX1 + padding, scaledY1 - padding - 3);
    });
  };

  const getBoxColor = (disease) => {
    const colorMap = {
      'black blight': '#1f2937',
      'blister blight': '#dc2626',
      'brown blight': '#ea580c',
      'grey blight': '#6b7280',
      'healthy': '#16a34a',
      'lichen': '#0d9488',
      'magnesium': '#9333ea',
      'nitrogen': '#4f46e5',
      'potassium': '#eab308',
      'sulfur': '#f59e0b',
      'redrust': '#f43f5e',
      'sunburn': '#f97316',
      'mita': '#ec4899',
    };
    return colorMap[disease?.toLowerCase()] || '#6b7280';
  };

  const captureAndSave = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    setIsPaused(true);

    toast.info('Saving scan...');

    try {
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        const base64Image = await compressImage(file);

        const scanData = {
          imageB64: base64Image,
          label: generateLabel(result),
          confidence: calculateConfidence(result),
          is_tea_leaf: result?.is_tea_leaf || false,
          tea_confidence: result?.tea_confidence || 0,
          is_healthy: result?.is_healthy || false,
          total_detections: result?.total_detections || 0,
          diseases: result?.diseases || [],
          deficiencies: result?.deficiencies || [],
          inference_time: result?.inference_time || 0,
          inference_engine: result?.inference_engine || 'ONNX',
          source: 'realtime',
          locName: location ? await getLocationName(location.lat, location.lng) : 'Unknown',
          geo: location ? createGeoPoint(location.lat, location.lng) : null,
        };

        await saveScan(currentUser.uid, scanData);
        toast.success('Scan saved successfully!');
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save scan');
    }
  };

  const generateLabel = (data) => {
    if (!data || !data.is_tea_leaf) return 'Not a Tea Leaf';
    if (data.is_healthy) return 'Healthy';

    const allDetections = [
      ...(Array.isArray(data.diseases) ? data.diseases : []),
      ...(Array.isArray(data.deficiencies) ? data.deficiencies : [])
    ];

    if (allDetections.length === 0) return 'Unknown';
    allDetections.sort((a, b) => b.confidence - a.confidence);
    return allDetections[0].disease.charAt(0).toUpperCase() + allDetections[0].disease.slice(1);
  };

  const calculateConfidence = (data) => {
    if (!data || !data.is_tea_leaf) return data?.tea_confidence || 0;
    if (data.is_healthy) return data.tea_confidence;

    const allDetections = [
      ...(Array.isArray(data.diseases) ? data.diseases : []),
      ...(Array.isArray(data.deficiencies) ? data.deficiencies : [])
    ];

    if (allDetections.length === 0) return 0;
    return Math.max(...allDetections.map(d => d.confidence));
  };

  const getLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await response.json();
      return data.display_name || 'Unknown Location';
    } catch (error) {
      return 'Unknown Location';
    }
  };

  const resumeScanning = () => {
    setCapturedImage(null);
    setIsPaused(false);
  };

  const downloadCapture = () => {
    if (!capturedImage) return;
    
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `tea-scan-${Date.now()}.jpg`;
    link.click();
    toast.success('Image downloaded!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Real-Time Scan</h1>
        <p className="text-gray-600 mt-1">Point your camera at tea leaves for instant disease detection</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {!isScanning ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <Camera className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Start Real-Time Detection
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Use your camera to scan tea leaves in real-time. Allow camera access when prompted.
            </p>
            
            {cameraError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left max-w-md mx-auto">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">{cameraError}</div>
                </div>
              </div>
            )}
            
            <button
              onClick={startCamera}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition inline-flex items-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Start Camera
            </button>
            
            <div className="mt-6 text-sm text-gray-500">
              <p>💡 Tip: Allow camera permissions when prompted by your browser</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                style={{ display: 'block', minHeight: '400px' }}
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
              
              <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm font-mono">
                {fps} FPS {isDetecting && <Loader className="w-3 h-3 inline animate-spin ml-2" />}
              </div>

              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-sm font-medium">{isPaused ? 'Paused' : 'Live'}</span>
              </div>

              {capturedImage && (
                <div className="absolute inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4">
                  <img src={capturedImage} alt="Captured" className="max-w-full max-h-full object-contain rounded" />
                </div>
              )}
            </div>

            <div className="flex gap-3 flex-wrap">
              {!isPaused ? (
                <>
                  <button
                    onClick={captureAndSave}
                    disabled={!result}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Scan className="w-5 h-5" />
                    Capture & Save
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-6 bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition inline-flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={resumeScanning}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition inline-flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Resume
                  </button>
                  <button
                    onClick={downloadCapture}
                    className="px-6 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition inline-flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download
                  </button>
                </>
              )}
            </div>

            {result && (
              <div className="space-y-3">
                {!result.is_tea_leaf ? (
                  <div className="border-2 rounded-xl p-4 bg-red-50 border-red-300">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div>
                        <h3 className="font-bold text-red-700">Not a Tea Leaf</h3>
                        <p className="text-sm text-red-600">
                          Confidence: {(result.tea_confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-xl p-4 bg-green-50 border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">
                          Tea Leaf ({(result.tea_confidence * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {result.diseases && result.diseases.length > 0 && (
                      <div className="border rounded-xl p-4 bg-orange-50 border-orange-200">
                        <h4 className="font-bold text-orange-700 mb-2">
                          🦠 {result.diseases.length} Disease{result.diseases.length > 1 ? 's' : ''}
                        </h4>
                        <div className="space-y-2">
                          {result.diseases.slice(0, 3).map((disease, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-700">{disease.disease}</span>
                              <span className="text-orange-600">{(disease.confidence * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.is_healthy && (
                      <div className="border rounded-xl p-4 bg-green-100 border-green-300">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">Healthy - No Issues</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default RealtimeScanComponent;