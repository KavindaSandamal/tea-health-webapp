import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, X, MapPin, Loader, AlertTriangle, CheckCircle, Video, Image, Download } from 'lucide-react';

const ImprovedUploadComponent = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extractedFrame, setExtractedFrame] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [uploadMode, setUploadMode] = useState('image');
  const [imageWithBoundingBoxes, setImageWithBoundingBoxes] = useState(null);
  
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const boundingBoxCanvasRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => console.error('Location error:', error)
      );
    }
  }, []);

  useEffect(() => {
    if (result && imageRef.current && imageDimensions.width > 0) {
      setTimeout(() => {
        drawBoundingBoxes();
        generateImageWithBoundingBoxes();
      }, 100);
    }
  }, [result, imageDimensions]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Please select an image or video file');
      return;
    }

    setSelectedFile(file);
    setFileType(isImage ? 'image' : 'video');
    setPreview(URL.createObjectURL(file));
    setExtractedFrame(null);
    setResult(null);
    setImageDimensions({ width: 0, height: 0 });
    setImageWithBoundingBoxes(null);
  };

  const drawBoundingBoxes = () => {
    const canvas = boundingBoxCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !result) return;

    const ctx = canvas.getContext('2d');
    canvas.width = img.offsetWidth;
    canvas.height = img.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const YOLO_SIZE = 640;
    const scaleX = canvas.width / YOLO_SIZE;
    const scaleY = canvas.height / YOLO_SIZE;

    const allDetections = [
      ...(Array.isArray(result.diseases) ? result.diseases : []),
      ...(Array.isArray(result.deficiencies) ? result.deficiencies : [])
    ];

    allDetections.forEach((detection) => {
      if (!detection?.bbox) return;

      let bbox = Array.isArray(detection.bbox) ? detection.bbox :
        ('x1' in detection.bbox) ? [detection.bbox.x1, detection.bbox.y1, detection.bbox.x2, detection.bbox.y2] : null;

      if (!bbox || bbox.length !== 4) return;

      const [x1, y1, x2, y2] = bbox;
      const color = getBoxColor(detection.disease);

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);

      const label = `${detection.disease} ${(detection.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 14px Arial';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(x1 * scaleX, y1 * scaleY - 25, textWidth + 10, 25);
      ctx.fillStyle = 'white';
      ctx.fillText(label, x1 * scaleX + 5, y1 * scaleY - 7);
    });
  };

  const generateImageWithBoundingBoxes = () => {
    const img = imageRef.current;
    const overlayCanvas = boundingBoxCanvasRef.current;
    if (!img || !overlayCanvas || !result) return;

    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = img.naturalWidth;
    mergedCanvas.height = img.naturalHeight;
    const ctx = mergedCanvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0);
    
    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(overlayCanvas, 0, 0);
    ctx.restore();
    
    setImageWithBoundingBoxes(mergedCanvas.toDataURL('image/jpeg', 0.95));
    console.log('✓ Image with bounding boxes generated');
  };

  const getBoxColor = (disease) => {
    const colors = {
      'black blight': '#1f2937', 'blister blight': '#dc2626', 'brown blight': '#ea580c',
      'grey blight': '#6b7280', 'healthy': '#16a34a', 'lichen': '#0d9488',
      'magnesium': '#9333ea', 'nitrogen': '#4f46e5', 'potassium': '#eab308',
      'sulfur': '#f59e0b', 'redrust': '#f43f5e', 'sunburn': '#f97316', 'mita': '#ec4899'
    };
    return colors[disease?.toLowerCase()] || '#6b7280';
  };

  const extractFrameFromVideo = (videoFile) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => video.currentTime = Math.min(1, video.duration / 2);
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.95) });
        }, 'image/jpeg', 0.95);
      };
      video.onerror = () => { URL.revokeObjectURL(video.src); reject(new Error('Video load failed')); };
      video.load();
    });
  };

  const detectDisease = async () => {
    if (!selectedFile) return;

    setDetecting(true);
    console.log('🔍 Starting detection...');
    
    try {
      let fileToSend = selectedFile;

      if (fileType === 'video') {
        console.log('🎬 Extracting frame...');
        const { blob, dataUrl } = await extractFrameFromVideo(selectedFile);
        setExtractedFrame(dataUrl);
        fileToSend = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
      }

      const formData = new FormData();
      formData.append('image', fileToSend);

      console.log('📡 Sending to API...');
      const response = await fetch('https://d5365df2e6a6.ngrok-free.app/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      console.log('✓ Detection result:', data);
      
      if (!data.success) throw new Error(data.error || 'Detection failed');

      const imgElement = imageRef.current;
      if (imgElement?.naturalWidth > 0) {
        setImageDimensions({ width: imgElement.naturalWidth, height: imgElement.naturalHeight });
      }

      setResult(data);
      
    } catch (error) {
      console.error('❌ Detection error:', error);
      alert('Detection failed: ' + error.message);
    } finally {
      setDetecting(false);
    }
  };

  const downloadImageWithBoxes = () => {
    if (!imageWithBoundingBoxes) return;
    const link = document.createElement('a');
    link.href = imageWithBoundingBoxes;
    link.download = `tea-scan-${Date.now()}.jpg`;
    link.click();
  };

  const saveToDatabase = async () => {
    if (!imageWithBoundingBoxes || !result) {
      alert('Please wait for processing to complete');
      return;
    }

    const allDetections = [
      ...(result.diseases || []),
      ...(result.deficiencies || [])
    ];
    const topDetection = allDetections.sort((a, b) => b.confidence - a.confidence)[0];

    const scanData = {
      imageB64: imageWithBoundingBoxes, // Image WITH bounding boxes
      label: !result.is_tea_leaf ? 'Not a Tea Leaf' : result.is_healthy ? 'Healthy' : 
             topDetection ? topDetection.disease : 'Unknown',
      confidence: !result.is_tea_leaf ? result.tea_confidence :
                 allDetections.length ? Math.max(...allDetections.map(d => d.confidence)) : result.tea_confidence,
      is_tea_leaf: result.is_tea_leaf,
      tea_confidence: result.tea_confidence,
      is_healthy: result.is_healthy,
      total_detections: result.total_detections,
      diseases: result.diseases || [],
      deficiencies: result.deficiencies || [],
      inference_time: result.inference_time,
      source: fileType,
      timestamp: new Date().toISOString()
    };

    console.log('💾 Ready to save:', scanData);
    alert('Scan ready to save! Check console.');
    // Uncomment to save: await saveScan(currentUser.uid, scanData);
  };

  const reset = () => {
    setSelectedFile(null);
    setFileType(null);
    setPreview(null);
    setExtractedFrame(null);
    setResult(null);
    setImageDimensions({ width: 0, height: 0 });
    setImageWithBoundingBoxes(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Scan</h1>
        <p className="text-gray-600">Upload image/video to detect tea plant diseases</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Upload type:</span>
          <div className="flex gap-2">
            {['image', 'video'].map(mode => (
              <button
                key={mode}
                onClick={() => setUploadMode(mode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  uploadMode === mode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mode === 'image' ? <Image className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-500 transition"
          >
            {uploadMode === 'image' ? <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" /> : 
             <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Tea Leaf {uploadMode === 'image' ? 'Image' : 'Video'}</h3>
            <p className="text-gray-600 mb-4">Click to browse or drag and drop</p>
            <p className="text-sm text-gray-500">
              {uploadMode === 'image' ? 'JPG, PNG (Max 10MB)' : 'MP4, MOV, AVI (Max 50MB)'}
            </p>
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
            <div className="relative flex justify-center">
              <div className="relative inline-block">
                {fileType === 'video' && extractedFrame && result ? (
                  <>
                    <img ref={imageRef} src={extractedFrame} alt="Frame" 
                         className="max-w-full max-h-96 object-contain rounded-lg bg-gray-100"
                         onLoad={(e) => {
                           const img = e.target;
                           if (img.naturalWidth > 0) setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                         }} />
                    <canvas ref={boundingBoxCanvasRef} className="absolute top-0 left-0 pointer-events-none"
                            style={{ width: '100%', height: '100%' }} />
                  </>
                ) : fileType === 'image' ? (
                  <>
                    <img ref={imageRef} src={preview} alt="Preview"
                         className="max-w-full max-h-96 object-contain rounded-lg bg-gray-100"
                         onLoad={(e) => {
                           const img = e.target;
                           if (img.naturalWidth > 0) setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                         }} />
                    {result && <canvas ref={boundingBoxCanvasRef} className="absolute top-0 left-0 pointer-events-none"
                                       style={{ width: '100%', height: '100%' }} />}
                  </>
                ) : (
                  <video ref={videoRef} src={preview} controls className="max-w-full max-h-96 object-contain rounded-lg bg-gray-100" />
                )}
              </div>
              <button onClick={reset} className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
              {fileType === 'image' ? (
                <div className="flex items-center gap-2"><Image className="w-4 h-4 text-green-600" /><span>Image selected</span></div>
              ) : (
                <div className="flex items-center gap-2"><Video className="w-4 h-4 text-green-600" />
                  <span>Video{extractedFrame ? ' - Frame extracted' : ''}</span></div>
              )}
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                </div>
              )}
              {imageWithBoundingBoxes && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">Ready to save!</span>
                </div>
              )}
            </div>

            {!result ? (
              <button onClick={detectDisease} disabled={detecting}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {detecting ? (
                  <><Loader className="w-5 h-5 animate-spin" />
                    {fileType === 'video' ? 'Extracting & Detecting...' : 'Detecting...'}</>
                ) : (
                  <><Camera className="w-5 h-5" />Detect Disease</>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                {!result.is_tea_leaf ? (
                  <div className="border-2 rounded-xl p-6 bg-red-50 border-red-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                      <div>
                        <h3 className="text-xl font-bold text-red-700">Not a Tea Leaf</h3>
                        <p className="text-red-600">Confidence: {(result.tea_confidence * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-xl p-4 bg-green-50 border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Tea Leaf Confirmed ({(result.tea_confidence * 100).toFixed(1)}%)</span>
                      </div>
                    </div>

                    {result.diseases?.length > 0 && (
                      <div className="border-2 rounded-xl p-4 bg-orange-50 border-orange-300">
                        <h3 className="text-lg font-bold text-orange-700 mb-2">
                          🦠 {result.diseases.length} Disease{result.diseases.length > 1 ? 's' : ''} Detected
                        </h3>
                        {result.diseases.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{d.disease}</span>
                            <span className="font-semibold text-orange-600">{(d.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.is_healthy && (
                      <div className="border-2 rounded-xl p-4 bg-green-100 border-green-300">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold">Healthy - No Issues Detected</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3">
                  <button onClick={reset}
                          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition">
                    New Scan
                  </button>
                  <button onClick={downloadImageWithBoxes} disabled={!imageWithBoundingBoxes}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" />Download
                  </button>
                  <button onClick={saveToDatabase} disabled={!imageWithBoundingBoxes}
                          className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Save to DB
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

export default ImprovedUploadComponent;