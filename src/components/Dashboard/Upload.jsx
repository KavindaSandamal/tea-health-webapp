import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveScan, createGeoPoint } from '../../firebase/firestore';
import { compressImage } from '../../utils/imageUtils';
import { toast } from 'react-toastify';
import { 
  Upload, 
  Camera, 
  X, 
  MapPin, 
  Loader,
  AlertTriangle,
  CheckCircle,
  Video,
  Image as ImageIcon
} from 'lucide-react';

const UploadComponent = () => {
  const { currentUser } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extractedFrame, setExtractedFrame] = useState(null); // For video frame preview
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [uploadMode, setUploadMode] = useState('image');
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file');
      return;
    }

    setSelectedFile(file);
    setFileType(isImage ? 'image' : 'video');
    setPreview(URL.createObjectURL(file));
    setExtractedFrame(null);
    setResult(null);
    setImageDimensions({ width: 0, height: 0 });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  useEffect(() => {
    if (result && canvasRef.current && imageRef.current && imageDimensions.width > 0) {
      setTimeout(() => {
        drawBoundingBoxes();
      }, 100);
    }
  }, [result, imageDimensions]);

  const drawBoundingBoxes = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !result) return;

    const ctx = canvas.getContext('2d');
    
    const displayWidth = img.offsetWidth;
    const displayHeight = img.offsetHeight;
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const YOLO_SIZE = 640;
    const scaleX = displayWidth / YOLO_SIZE;
    const scaleY = displayHeight / YOLO_SIZE;

    const diseases = Array.isArray(result.diseases) ? result.diseases : [];
    const deficiencies = Array.isArray(result.deficiencies) ? result.deficiencies : [];
    const allDetections = [...diseases, ...deficiencies];

    allDetections.forEach((detection, index) => {
      if (!detection) return;

      let bbox;
      if (Array.isArray(detection.bbox)) {
        bbox = detection.bbox;
      } else if (detection.bbox && typeof detection.bbox === 'object') {
        if ('x1' in detection.bbox && 'y1' in detection.bbox) {
          bbox = [detection.bbox.x1, detection.bbox.y1, detection.bbox.x2, detection.bbox.y2];
        } else if ('x' in detection.bbox && 'y' in detection.bbox && 'width' in detection.bbox) {
          bbox = [
            detection.bbox.x,
            detection.bbox.y,
            detection.bbox.x + detection.bbox.width,
            detection.bbox.y + detection.bbox.height
          ];
        }
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
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX1, scaledY1, width, height);

      const label = `${detection.disease} (${(detection.confidence * 100).toFixed(0)}%)`;
      ctx.font = 'bold 14px Arial';
      const textMetrics = ctx.measureText(label);
      const textHeight = 20;
      const padding = 4;

      const labelY = Math.max(textHeight + padding, scaledY1);

      ctx.fillStyle = color;
      ctx.fillRect(
        scaledX1, 
        labelY - textHeight - padding, 
        textMetrics.width + padding * 2, 
        textHeight + padding
      );

      ctx.fillStyle = 'white';
      ctx.fillText(label, scaledX1 + padding, labelY - padding - 2);
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

  const getLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await response.json();
      return data.display_name || 'Unknown Location';
    } catch (error) {
      console.error('Error getting location name:', error);
      return 'Unknown Location';
    }
  };

  const generateLabel = (data) => {
    if (!data.is_tea_leaf) return 'Not a Tea Leaf';
    if (data.is_healthy) return 'Healthy';

    const allDetections = [
      ...(Array.isArray(data.diseases) ? data.diseases : []),
      ...(Array.isArray(data.deficiencies) ? data.deficiencies : [])
    ];

    if (allDetections.length === 0) return 'Unknown';

    allDetections.sort((a, b) => b.confidence - a.confidence);
    const topDetection = allDetections[0];
    
    return topDetection.disease.charAt(0).toUpperCase() + topDetection.disease.slice(1);
  };

  const calculateOverallConfidence = (data) => {
    if (!data.is_tea_leaf) return data.tea_confidence;
    if (data.is_healthy) return data.tea_confidence;

    const allDetections = [
      ...(Array.isArray(data.diseases) ? data.diseases : []),
      ...(Array.isArray(data.deficiencies) ? data.deficiencies : [])
    ];

    if (allDetections.length === 0) return 0;
    return Math.max(...allDetections.map(d => d.confidence));
  };

  const extractFrameFromVideo = async (videoFile) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Create both blob and data URL
        canvas.toBlob((blob) => {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          URL.revokeObjectURL(video.src);
          resolve({ blob, dataUrl });
        }, 'image/jpeg', 0.95);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video'));
      };

      video.load();
    });
  };

  const detectDisease = async () => {
    if (!selectedFile) return;

    setDetecting(true);
    try {
      let fileToSend = selectedFile;
      let base64Image;

      if (fileType === 'video') {
        toast.info('Extracting frame from video...');
        const { blob, dataUrl } = await extractFrameFromVideo(selectedFile);
        
        // Set the extracted frame for display
        setExtractedFrame(dataUrl);
        
        fileToSend = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        base64Image = await compressImage(fileToSend);
      } else {
        base64Image = await compressImage(selectedFile);
      }

      const formData = new FormData();
      formData.append('image', fileToSend);

      const response = await fetch('https://indicators-membership-already-gregory.trycloudflare.com/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Detection failed');
      }

      // Set dimensions after image loads
      const imgElement = imageRef.current;
      if (imgElement && imgElement.naturalWidth > 0) {
        setImageDimensions({
          width: imgElement.naturalWidth,
          height: imgElement.naturalHeight
        });
      }

      setResult(data);

      const label = generateLabel(data);
      const confidence = calculateOverallConfidence(data);

      const scanData = {
        imageB64: base64Image,
        label: label,
        confidence: confidence,
        is_tea_leaf: data.is_tea_leaf,
        tea_confidence: data.tea_confidence,
        is_healthy: data.is_healthy,
        total_detections: data.total_detections,
        diseases: data.diseases || [],
        deficiencies: data.deficiencies || [],
        inference_time: data.inference_time,
        inference_engine: data.inference_engine,
        source: fileType,
        locName: location ? await getLocationName(location.lat, location.lng) : 'Unknown',
        geo: location ? createGeoPoint(location.lat, location.lng) : null,
      };

      await saveScan(currentUser.uid, scanData);
      toast.success('Scan saved successfully!');
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to detect disease. Please try again.');
    } finally {
      setDetecting(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setFileType(null);
    setPreview(null);
    setExtractedFrame(null);
    setResult(null);
    setLocation(null);
    setImageDimensions({ width: 0, height: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getDiseaseInfo = (label) => {
    const diseaseMap = {
      'black blight': {
        color: 'bg-gray-900 text-white border-gray-800',
        badgeColor: 'bg-gray-800 text-white',
        icon: '⚠',
        description: 'Black blight fungal infection detected',
        recommendations: ['Remove infected leaves immediately', 'Apply copper-based fungicide', 'Improve air circulation'],
      },
      'blister blight': {
        color: 'bg-red-100 text-red-700 border-red-300',
        badgeColor: 'bg-red-600 text-white',
        icon: '⚠',
        description: 'Blister blight - serious fungal disease',
        recommendations: ['Urgent treatment needed', 'Apply systemic fungicide', 'Remove and destroy infected leaves'],
      },
      'brown blight': {
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        badgeColor: 'bg-orange-600 text-white',
        icon: '⚠',
        description: 'Brown blight detected',
        recommendations: ['Remove infected parts', 'Improve ventilation', 'Apply systemic fungicide'],
      },
      'grey blight': {
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        badgeColor: 'bg-gray-600 text-white',
        icon: '⚠',
        description: 'Grey blight disease',
        recommendations: ['Improve plant nutrition', 'Ensure proper spacing', 'Monitor conditions'],
      },
      'healthy': {
        color: 'bg-green-100 text-green-700 border-green-300',
        badgeColor: 'bg-green-600 text-white',
        icon: '✓',
        description: 'Plant appears healthy',
        recommendations: ['Continue regular care', 'Monitor for changes'],
      },
      'lichen': {
        color: 'bg-teal-100 text-teal-700 border-teal-300',
        badgeColor: 'bg-teal-600 text-white',
        icon: '⚠',
        description: 'Lichen growth detected',
        recommendations: ['Not usually harmful', 'Indicates good air quality', 'Monitor plant health'],
      },
      'magnesium': {
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        badgeColor: 'bg-purple-600 text-white',
        icon: '⚠',
        description: 'Magnesium deficiency',
        recommendations: ['Apply magnesium sulfate', 'Check soil pH', 'Use balanced fertilizer'],
      },
      'nitrogen': {
        color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
        badgeColor: 'bg-indigo-600 text-white',
        icon: '⚠',
        description: 'Nitrogen deficiency',
        recommendations: ['Apply nitrogen fertilizer', 'Use compost', 'Monitor leaf color'],
      },
      'potassium': {
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        badgeColor: 'bg-yellow-600 text-white',
        icon: '⚠',
        description: 'Potassium deficiency',
        recommendations: ['Apply potassium fertilizer', 'Check soil nutrients', 'Monitor plant growth'],
      },
      'sulfur': {
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        badgeColor: 'bg-amber-600 text-white',
        icon: '⚠',
        description: 'Sulfur deficiency',
        recommendations: ['Apply sulfur supplements', 'Check soil pH', 'Use appropriate fertilizer'],
      },
      'redrust': {
        color: 'bg-rose-100 text-rose-700 border-rose-300',
        badgeColor: 'bg-rose-600 text-white',
        icon: '⚠',
        description: 'Red rust disease',
        recommendations: ['Remove affected leaves', 'Apply fungicide', 'Improve air flow'],
      },
      'sunburn': {
        color: 'bg-orange-200 text-orange-800 border-orange-400',
        badgeColor: 'bg-orange-700 text-white',
        icon: '⚠',
        description: 'Sunburn damage',
        recommendations: ['Provide shade during peak hours', 'Ensure adequate watering', 'Monitor plant recovery'],
      },
      'mita': {
        color: 'bg-pink-100 text-pink-700 border-pink-300',
        badgeColor: 'bg-pink-600 text-white',
        icon: '⚠',
        description: 'Mita infestation',
        recommendations: ['Apply appropriate pesticide', 'Monitor regularly', 'Improve plant health'],
      },
    };

    return diseaseMap[label?.toLowerCase()] || {
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      badgeColor: 'bg-gray-500 text-white',
      icon: '?',
      description: 'Unknown condition',
      recommendations: ['Consult expert', 'Monitor plant health'],
    };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Scan</h1>
        <p className="text-gray-600 mt-1">Upload an image or video to detect tea plant diseases</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Upload type:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setUploadMode('image')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                uploadMode === 'image'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Image
            </button>
            <button
              onClick={() => setUploadMode('video')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                uploadMode === 'video'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Video className="w-4 h-4" />
              Video
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-500 transition"
          >
            {uploadMode === 'image' ? (
              <>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Tea Leaf Image
                </h3>
                <p className="text-gray-600 mb-4">
                  Click to browse or drag and drop your image here
                </p>
                <p className="text-sm text-gray-500">
                  Supports: JPG, PNG (Max 10MB)
                </p>
              </>
            ) : (
              <>
                <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Tea Leaf Video
                </h3>
                <p className="text-gray-600 mb-4">
                  Click to browse or drag and drop your video here
                </p>
                <p className="text-sm text-gray-500">
                  Supports: MP4, MOV, AVI (Max 50MB)
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={uploadMode === 'image' ? 'image/*' : 'video/*'}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative flex justify-center" ref={containerRef}>
              <div className="relative inline-block">
                {/* Show extracted frame if video and results available, otherwise show original */}
                {fileType === 'video' && extractedFrame && result ? (
                  <>
                    <img
                      ref={imageRef}
                      src={extractedFrame}
                      alt="Extracted Frame"
                      className="max-w-full max-h-96 object-contain rounded-lg bg-gray-100"
                      onLoad={(e) => {
                        const img = e.target;
                        if (!imageDimensions.width && img.naturalWidth > 0) {
                          setImageDimensions({
                            width: img.naturalWidth,
                            height: img.naturalHeight
                          });
                        }
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  </>
                ) : fileType === 'image' ? (
                  <>
                    <img
                      ref={imageRef}
                      src={preview}
                      alt="Preview"
                      className="max-w-full max-h-96 object-contain rounded-lg bg-gray-100"
                      onLoad={(e) => {
                        const img = e.target;
                        if (!imageDimensions.width && img.naturalWidth > 0) {
                          setImageDimensions({
                            width: img.naturalWidth,
                            height: img.naturalHeight
                          });
                        }
                      }}
                    />
                    {result && (
                      <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 pointer-events-none"
                        style={{
                          width: '100%',
                          height: '100%'
                        }}
                      />
                    )}
                  </>
                ) : (
                  <video
                    ref={videoRef}
                    src={preview}
                    controls
                    className="max-w-full max-h-96 object-contain rounded-lg bg-gray-100"
                  />
                )}
              </div>
              <button
                onClick={reset}
                className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
              {fileType === 'image' ? (
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-green-600" />
                  <span>Image selected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-green-600" />
                  <span>Video selected{extractedFrame ? ' - Frame extracted' : ' - Frame will be extracted'}</span>
                </div>
              )}
              
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span>
                    Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>

            {!result && (
              <button
                onClick={detectDisease}
                disabled={detecting}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {detecting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    {fileType === 'video' ? 'Extracting & Detecting...' : 'Detecting...'}
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Detect Disease
                  </>
                )}
              </button>
            )}

            {result && (
              <div className="space-y-4">
                {!result.is_tea_leaf ? (
                  <div className="border-2 rounded-xl p-6 bg-red-50 border-red-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                      <div>
                        <h3 className="text-xl font-bold text-red-700 mb-1">Not a Tea Leaf</h3>
                        <p className="text-red-600">
                          The {fileType} does not appear to contain a tea leaf (Confidence: {(result.tea_confidence * 100).toFixed(1)}%)
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
                          Tea Leaf Confirmed ({(result.tea_confidence * 100).toFixed(1)}% confidence)
                        </span>
                      </div>
                    </div>

                    <div className={`border-2 rounded-xl p-6 ${result.is_healthy ? 'bg-green-100 border-green-300' : 'bg-orange-50 border-orange-300'}`}>
                      <h3 className={`text-xl font-bold mb-2 ${result.is_healthy ? 'text-green-700' : 'text-orange-700'}`}>
                        {result.is_healthy ? '✓ Healthy Leaf' : '⚠ Issues Detected'}
                      </h3>
                      <p className={`text-sm ${result.is_healthy ? 'text-green-600' : 'text-orange-600'}`}>
                        {result.is_healthy 
                          ? 'No diseases or deficiencies detected'
                          : `Found ${result.total_detections} issue(s) - see bounding boxes above`
                        }
                      </p>
                    </div>

                    {result.diseases && result.diseases.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-gray-900">
                          🦠 Diseases Detected ({result.diseases.length})
                        </h3>
                        {result.diseases.map((disease, index) => {
                          const info = getDiseaseInfo(disease.disease);
                          return (
                            <div key={index} className={`border-2 rounded-xl p-4 ${info.color}`}>
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">{info.icon}</div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${info.badgeColor}`}>
                                      {disease.disease.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-sm mb-2">{info.description}</p>
                                  <div className="mb-3">
                                    <span className="text-sm font-medium">
                                      Confidence: {(disease.confidence * 100).toFixed(1)}%
                                    </span>
                                    <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mt-1">
                                      <div
                                        className="bg-current h-2 rounded-full transition-all"
                                        style={{ width: `${disease.confidence * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-sm mb-1">Recommendations:</h5>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                      {info.recommendations.map((rec, i) => (
                                        <li key={i}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {result.deficiencies && result.deficiencies.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold text-gray-900">
                          💊 Nutrient Deficiencies ({result.deficiencies.length})
                        </h3>
                        {result.deficiencies.map((deficiency, index) => {
                          const info = getDiseaseInfo(deficiency.disease);
                          return (
                            <div key={index} className={`border-2 rounded-xl p-4 ${info.color}`}>
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">{info.icon}</div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${info.badgeColor}`}>
                                      {deficiency.disease.toUpperCase()} DEFICIENCY
                                    </span>
                                  </div>
                                  <p className="text-sm mb-2">{info.description}</p>
                                  <div className="mb-3">
                                    <span className="text-sm font-medium">
                                      Confidence: {(deficiency.confidence * 100).toFixed(1)}%
                                    </span>
                                    <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mt-1">
                                      <div
                                        className="bg-current h-2 rounded-full transition-all"
                                        style={{ width: `${deficiency.confidence * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-sm mb-1">Recommendations:</h5>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                      {info.recommendations.map((rec, i) => (
                                        <li key={i}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {result.inference_time && (
                      <div className="text-sm text-gray-500 text-center pt-2">
                        Analysis completed in {result.inference_time}s using {result.inference_engine}
                        {fileType === 'video' && ' (from extracted frame)'}
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={reset}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
                  >
                    New Scan
                  </button>
                  <button
                    onClick={() => window.location.href = '/dashboard/history'}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    View History
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadComponent;
                        