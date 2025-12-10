import React, { useState, useRef } from 'react';
import { Upload, Camera, X, MapPin, Loader, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { saveScan, createGeoPoint } from '../../firebase/firestore';
import { compressImage } from '../../utils/imageUtils';
import { toast } from 'react-toastify';


const UploadComponent = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState(null);
  const fileInputRef = useRef(null);
  const { currentUser } = useAuth();

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);

    // Get user location
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

  // Function to generate a label from detection results
  const generateLabel = (data) => {
    if (!data.is_tea_leaf) {
      return 'Not a Tea Leaf';
    }
    
    if (data.is_healthy) {
      return 'Healthy';
    }

    // Get the highest confidence disease or deficiency
    const allDetections = [
      ...(data.diseases || []),
      ...(data.deficiencies || [])
    ];

    if (allDetections.length === 0) {
      return 'Unknown';
    }

    // Sort by confidence and get the top one
    allDetections.sort((a, b) => b.confidence - a.confidence);
    const topDetection = allDetections[0];
    
    // Format the label
    return topDetection.disease.charAt(0).toUpperCase() + topDetection.disease.slice(1);
  };

  // Function to calculate overall confidence
  const calculateOverallConfidence = (data) => {
    if (!data.is_tea_leaf) {
      return data.tea_confidence;
    }

    if (data.is_healthy) {
      return data.tea_confidence;
    }

    const allDetections = [
      ...(data.diseases || []),
      ...(data.deficiencies || [])
    ];

    if (allDetections.length === 0) {
      return 0;
    }

    // Return the highest confidence
    return Math.max(...allDetections.map(d => d.confidence));
  };

  const detectDisease = async () => {
    if (!selectedFile) return;

    setDetecting(true);
    try {
      // Compress image for Firestore
      const base64Image = await compressImage(selectedFile);

      // Create FormData for API
      const formData = new FormData();
      formData.append('image', selectedFile);

      // Call disease detection API
      const response = await fetch('https://81d9383c2d7e.ngrok-free.app/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const data = await response.json();
      
      // Use actual API response
      if (!data.success) {
        throw new Error(data.error || 'Detection failed');
      }

      setResult(data);

      // Generate label and confidence for backward compatibility
      const label = generateLabel(data);
      const confidence = calculateOverallConfidence(data);

      // Save to Firestore
      const scanData = {
        imageB64: base64Image,
        label: label, // Primary label for history display
        confidence: confidence, // Overall confidence
        is_tea_leaf: data.is_tea_leaf,
        tea_confidence: data.tea_confidence,
        is_healthy: data.is_healthy,
        total_detections: data.total_detections,
        diseases: data.diseases || [],
        deficiencies: data.deficiencies || [],
        inference_time: data.inference_time,
        inference_engine: data.inference_engine,
        source: 'image',
        locName: location ? await getLocationName(location.lat, location.lng) : 'Unknown',
        geo: location ? createGeoPoint(location.lat, location.lng) : null,
        timestamp: new Date(),
      };

      await saveScan(currentUser.uid, scanData);
      toast.success('Scan saved successfully!');

      console.log('Detection result:', data);
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to detect disease. Please try again.');
    } finally {
      setDetecting(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setLocation(null);
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
        recommendations: ['Urgent treatment needed', 'Apply systemic fungicide', 'Remove and destroy infected leaves', 'Improve drainage'],
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
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tea Disease Detection</h1>
        <p className="text-gray-600 mt-1">Upload an image to detect tea plant diseases</p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-500 transition"
          >
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Preview */}
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-96 object-contain rounded-lg bg-gray-100"
              />
              <button
                onClick={reset}
                className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-green-600" />
                <span>
                  Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              </div>
            )}

            {/* Detect Button */}
            {!result && (
              <button
                onClick={detectDisease}
                disabled={detecting}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {detecting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Detect Disease
                  </>
                )}
              </button>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-4">
                {/* Tea Leaf Status */}
                {!result.is_tea_leaf ? (
                  <div className="border-2 rounded-xl p-6 bg-red-50 text-red-700 border-red-300">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6" />
                      <div>
                        <h3 className="text-xl font-bold">Not a Tea Leaf</h3>
                        <p className="text-sm">
                          The image does not appear to be a tea leaf (Confidence: {(result.tea_confidence * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Tea Leaf Confirmed */}
                    <div className="border rounded-xl p-4 bg-green-50 border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">
                          Tea Leaf Confirmed ({(result.tea_confidence * 100).toFixed(1)}% confidence)
                        </span>
                      </div>
                    </div>

                    {/* Health Status */}
                    <div className={`border-2 rounded-xl p-6 ${result.is_healthy ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-50 text-red-700 border-red-300'}`}>
                      <h3 className="text-xl font-bold mb-2">
                        {result.is_healthy ? '✓ Healthy Leaf' : '⚠ Issues Detected'}
                      </h3>
                      <p className="text-sm">
                        {result.is_healthy 
                          ? 'No diseases or deficiencies detected'
                          : `Found ${result.total_detections} issue(s)`
                        }
                      </p>
                    </div>

                    {/* Diseases */}
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

                    {/* Deficiencies */}
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

                    {/* Inference Info */}
                    {result.inference_time && (
                      <div className="text-sm text-gray-500 text-center">
                        Analysis completed in {result.inference_time}s using {result.inference_engine}
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={reset}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
                  >
                    New Scan
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    Save Report
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