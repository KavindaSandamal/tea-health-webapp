import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getScans } from '../../firebase/firestore';
import { MapPin, Layers, Navigation } from 'lucide-react';

const Map = () => {
  const { currentUser } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 7.0, lng: 80.0 }); // Sri Lanka center

  useEffect(() => {
    loadScans();
  }, [currentUser]);

  const loadScans = async () => {
    if (!currentUser) return;

    try {
      const data = await getScans(currentUser.uid);
      const scansWithLocation = data.filter(scan => scan.geo);
      setScans(scansWithLocation);
      
      // Center map on first scan with location
      if (scansWithLocation.length > 0 && scansWithLocation[0].geo) {
        setMapCenter({
          lat: scansWithLocation[0].geo.latitude,
          lng: scansWithLocation[0].geo.longitude,
        });
      }
    } catch (error) {
      console.error('Error loading scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiseaseColor = (label) => {
  const colors = {
    healthy: '#10b981',
    'not a tea leaf': '#ef4444',

    'black blight': '#111827',
    'blister blight': '#dc2626',
    'brown blight': '#f97316',
    'grey blight': '#6b7280',

    redrust: '#f43f5e',
    sunburn: '#fb923c',
    lichen: '#14b8a6',
    mita: '#ec4899',

    magnesium: '#a855f7',
    nitrogen: '#6366f1',
    potassium: '#eab308',
    sulfur: '#f59e0b',
  };

  return colors[label?.toLowerCase()] || '#6b7280';
};


  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Map View</h1>
        <p className="text-gray-600 mt-1">View your scans on an interactive map</p>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {scans.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">No location data available</p>
            <p className="text-gray-500 text-sm">
              Scans with location data will appear here
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* OpenStreetMap Embed */}
            <div className="h-[500px] bg-gray-100 relative">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 0.1},${mapCenter.lat - 0.1},${mapCenter.lng + 0.1},${mapCenter.lat + 0.1}&layer=mapnik&marker=${mapCenter.lat},${mapCenter.lng}`}
                style={{ border: 0, width: '100%', height: '100%' }}
                title="Map"
              />
              
              {/* Controls Overlay */}
              <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
                <button
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setMapCenter({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                          });
                        },
                        (error) => {
                          console.error('Error getting location:', error);
                        }
                      );
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition w-full"
                  title="My Location"
                >
                  <Navigation className="w-5 h-5 text-green-600" />
                </button>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition w-full"
                  title="Layers"
                >
                  <Layers className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Legend</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from(new Set(scans.map(s => s.label))).map(disease => (
                  <div key={disease} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getDiseaseColor(disease) }}
                    />
                    <span className="text-sm text-gray-700">
                      {disease?.charAt(0).toUpperCase() + disease?.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scan List */}
      {scans.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Scans with Location</h2>
            <p className="text-sm text-gray-600 mt-1">
              {scans.length} scan{scans.length !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="p-4 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => {
                  setSelectedScan(scan);
                  if (scan.geo) {
                    setMapCenter({
                      lat: scan.geo.latitude,
                      lng: scan.geo.longitude,
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Marker Icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getDiseaseColor(scan.label) + '20' }}
                  >
                    <MapPin
                      className="w-5 h-5"
                      style={{ color: getDiseaseColor(scan.label) }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: getDiseaseColor(scan.label) + '20',
                          color: getDiseaseColor(scan.label),
                        }}
                      >
                        {scan.label || 'Unknown'}
                      </span>
                      {scan.confidence && (
                        <span className="text-xs text-gray-500">
                          {(scan.confidence * 100).toFixed(1)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium truncate">
                      {scan.locName || 'Unknown Location'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span>{formatDate(scan.createdAt)}</span>
                      {scan.geo && (
                        <span>
                          {scan.geo.latitude.toFixed(4)}, {scan.geo.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail */}
                  {scan.imageB64 && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={`data:image/jpeg;base64,${scan.imageB64}`}
                        alt={scan.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;