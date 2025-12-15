import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  X, 
  Loader,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Scan,
  Smartphone,
  Maximize,
  Minimize,
  Info,
  Wifi,
  WifiOff
} from 'lucide-react';

const EnhancedRealtimeScan = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedImageWithBoxes, setCapturedImageWithBoxes] = useState(null);
  const [fps, setFps] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [apiStatus, setApiStatus] = useState('checking');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastDetectionTime = useRef(0);
  const fpsCounter = useRef({ frames: 0, lastTime: Date.now() });
  const detectionHistoryRef = useRef([]);
  const containerRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
      return mobile;
    };
    
    checkMobile();

    // Check API status
    checkApiHealth();

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

  const checkApiHealth = async () => {
    try {
      const response = await fetch('https://d5365df2e6a6.ngrok-free.app/health', {
        method: 'GET',
      });
      setApiStatus(response.ok ? 'online' : 'offline');
    } catch (error) {
      setApiStatus('offline');
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: isMobile ? { ideal: 1280 } : { ideal: 1920 },
          height: isMobile ? { ideal: 720 } : { ideal: 1080 },
          aspectRatio: { ideal: 16/9 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      setIsScanning(true);
      isScanningRef.current = true;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!videoRef.current) {
        throw new Error('Video element not ready');
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      await video.play();
      
      setTimeout(() => {
        startDetectionLoop();
      }, 100);
      
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
      setIsScanning(false);
      isScanningRef.current = false;
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
    setIsFullscreen(false);
    detectionHistoryRef.current = [];
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
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
      const detectionInterval = isMobile ? 2000 : 1500;
      
      if (now - lastDetectionTime.current > detectionInterval) {
        await performDetection();
        lastDetectionTime.current = now;
      }

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

        const response = await fetch('https://d5365df2e6a6.ngrok-free.app/predict', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          setApiStatus('offline');
          setIsDetecting(false);
          return;
        }

        setApiStatus('online');
        const data = await response.json();
        
        if (data.success) {
          detectionHistoryRef.current.push(data);
          if (detectionHistoryRef.current.length > 3) {
            detectionHistoryRef.current.shift();
          }
          
          const stableResult = getMostConsistentResult(detectionHistoryRef.current);
          setResult(stableResult);
          drawBoundingBoxes(stableResult);
        }
      } catch (error) {
        console.error('Detection error:', error);
        setApiStatus('offline');
      } finally {
        setIsDetecting(false);
      }
    }, 'image/jpeg', isMobile ? 0.7 : 0.8);
  };

  const getMostConsistentResult = (history) => {
    if (history.length === 0) return null;
    if (history.length < 2) return history[history.length - 1];
    
    const latest = history[history.length - 1];
    const allDiseases = new Map();
    
    history.forEach(detection => {
      if (detection.diseases) {
        detection.diseases.forEach(disease => {
          const key = disease.disease.toLowerCase();
          if (!allDiseases.has(key) || allDiseases.get(key).confidence < disease.confidence) {
            allDiseases.set(key, disease);
          }
        });
      }
    });
    
    return {
      ...latest,
      diseases: Array.from(allDiseases.values()).sort((a, b) => b.confidence - a.confidence)
    };
  };

  const drawBoundingBoxes = (data) => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    
    if (!overlay || !video) return;

    const ctx = overlay.getContext('2d');
    
    const displayWidth = video.offsetWidth;
    const displayHeight = video.offsetHeight;
    
    overlay.width = displayWidth;
    overlay.height = displayHeight;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const YOLO_SIZE = 640;
    const scaleX = displayWidth / YOLO_SIZE;
    const scaleY = displayHeight / YOLO_SIZE;

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

      ctx.strokeStyle = color;
      ctx.lineWidth = isMobile ? 4 : 3;
      ctx.strokeRect(scaledX1, scaledY1, width, height);

      const label = `${detection.disease} ${(detection.confidence * 100).toFixed(0)}%`;
      ctx.font = isMobile ? 'bold 16px Arial' : 'bold 14px Arial';
      const textMetrics = ctx.measureText(label);
      const padding = isMobile ? 6 : 5;
      const textHeight = isMobile ? 24 : 20;

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

  const captureImageWithBoundingBoxes = () => {
    if (!videoRef.current || !overlayCanvasRef.current) return null;

    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    
    // Create a new canvas to merge video + bounding boxes
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = video.videoWidth;
    mergedCanvas.height = video.videoHeight;
    const ctx = mergedCanvas.getContext('2d');
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, mergedCanvas.width, mergedCanvas.height);
    
    // Scale and draw overlay
    const scaleX = video.videoWidth / video.offsetWidth;
    const scaleY = video.videoHeight / video.offsetHeight;
    
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(overlay, 0, 0);
    ctx.restore();
    
    return mergedCanvas.toDataURL('image/jpeg', 0.95);
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
    const dataUrlWithBoxes = captureImageWithBoundingBoxes();
    
    setCapturedImage(dataUrl);
    setCapturedImageWithBoxes(dataUrlWithBoxes);
    setIsPaused(true);

    // Here you would save to your backend
    console.log('Captured images ready to save:', {
      original: dataUrl,
      withBoundingBoxes: dataUrlWithBoxes,
      result: result
    });
  };

  const resumeScanning = () => {
    setCapturedImage(null);
    setCapturedImageWithBoxes(null);
    setIsPaused(false);
  };

  const downloadCapture = () => {
    if (!capturedImageWithBoxes) return;
    
    const link = document.createElement('a');
    link.href = capturedImageWithBoxes;
    link.download = `tea-scan-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 px-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Real-Time Scanner</h1>
            {isMobile && <Smartphone className="w-5 h-5 text-green-600" />}
          </div>
          <p className="text-sm text-gray-600">Point your camera at tea leaves for instant detection</p>
        </div>
        
        <div className="flex items-center gap-2">
          {apiStatus === 'online' ? (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <Wifi className="w-4 h-4" />
              <span className="hidden sm:inline">API Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <WifiOff className="w-4 h-4" />
              <span className="hidden sm:inline">API Offline</span>
            </div>
          )}
        </div>
      </div>

      {showInstructions && !isScanning && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">How to use Real-Time Scanner:</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Click "Start Camera" and allow camera permissions</li>
                <li>Hold your device steady and point at tea leaves</li>
                <li>Wait for the system to detect diseases (green pulse = scanning)</li>
                <li>Use fullscreen mode for better viewing experience</li>
                <li>Click "Capture & Save" when you see detections</li>
                <li>Saved images will include bounding boxes</li>
              </ul>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-xs text-blue-600 hover:text-blue-700 mt-2"
              >
                Hide instructions
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className={`bg-black rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'border border-gray-200'}`}
      >
        {!isScanning ? (
          <div className="bg-white text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <Camera className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Start Real-Time Detection
            </h3>
            <p className="text-base text-gray-600 mb-6 max-w-md mx-auto">
              {isMobile ? 'Optimized for mobile. Hold steady for best results.' : 'Allow camera access when prompted.'}
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
          </div>
        ) : (
          <div className={`relative ${isFullscreen ? 'h-screen' : ''}`}>
            <div className="relative bg-black" style={{ aspectRatio: isFullscreen ? 'auto' : '16/9' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full ${isFullscreen ? 'h-screen' : 'h-full'} object-contain`}
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
              
              {/* Top Controls */}
              <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                <div className="bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm font-mono">
                  {fps} FPS {isDetecting && <Loader className="w-3 h-3 inline animate-spin ml-2" />}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} />
                    <span className="text-sm font-medium">{isPaused ? 'Paused' : 'Live'}</span>
                  </div>
                  
                  <button
                    onClick={toggleFullscreen}
                    className="bg-black bg-opacity-70 text-white p-2 rounded-lg hover:bg-opacity-90 transition"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Captured Image Overlay */}
              {capturedImage && (
                <div className="absolute inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4">
                  <img src={capturedImageWithBoxes || capturedImage} alt="Captured" className="max-w-full max-h-full object-contain rounded" />
                </div>
              )}

              {/* Bottom Results Panel */}
              {result && !capturedImage && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent p-4">
                  <div className="max-w-2xl mx-auto">
                    {!result.is_tea_leaf ? (
                      <div className="bg-red-500 bg-opacity-90 rounded-lg p-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-white flex-shrink-0" />
                        <div className="text-white">
                          <p className="font-bold text-sm">Not a Tea Leaf</p>
                          <p className="text-xs opacity-90">Confidence: {(result.tea_confidence * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-green-500 bg-opacity-90 rounded-lg p-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-white" />
                          <span className="text-white text-sm font-medium">
                            Tea Leaf ({(result.tea_confidence * 100).toFixed(1)}%)
                          </span>
                        </div>

                        {result.diseases && result.diseases.length > 0 && (
                          <div className="bg-orange-500 bg-opacity-90 rounded-lg p-2">
                            <p className="text-white text-sm font-bold mb-1">
                              🦠 {result.diseases.length} Disease{result.diseases.length > 1 ? 's' : ''} Detected
                            </p>
                            <div className="space-y-1">
                              {result.diseases.slice(0, 2).map((disease, index) => (
                                <div key={index} className="flex items-center justify-between text-xs text-white">
                                  <span>{disease.disease}</span>
                                  <span className="font-semibold">{(disease.confidence * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.deficiencies && result.deficiencies.length > 0 && (
                          <div className="bg-purple-500 bg-opacity-90 rounded-lg p-2">
                            <p className="text-white text-sm font-bold mb-1">
                              💊 {result.deficiencies.length} Deficienc{result.deficiencies.length > 1 ? 'ies' : 'y'}
                            </p>
                            <div className="space-y-1">
                              {result.deficiencies.slice(0, 2).map((def, index) => (
                                <div key={index} className="flex items-center justify-between text-xs text-white">
                                  <span>{def.disease}</span>
                                  <span className="font-semibold">{(def.confidence * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className={`${isFullscreen ? 'absolute bottom-20 left-0 right-0' : ''} p-4 bg-black`}>
              <div className="max-w-2xl mx-auto flex gap-3">
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
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default EnhancedRealtimeScan;