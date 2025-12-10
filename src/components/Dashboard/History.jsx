import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToScans, deleteScan } from '../../firebase/firestore';
import { toast } from 'react-toastify';
import { 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Trash2, 
  X,
  ChevronDown,
  Image as ImageIcon
} from 'lucide-react';

const History = () => {
  const { currentUser } = useAuth();
  const [scans, setScans] = useState([]);
  const [filteredScans, setFilteredScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('all');
  const [selectedScan, setSelectedScan] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToScans(currentUser.uid, (data) => {
      setScans(data);
      setFilteredScans(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    let filtered = scans;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(scan =>
        scan.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scan.locName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by disease
    if (selectedDisease !== 'all') {
      filtered = filtered.filter(scan => scan.label === selectedDisease);
    }

    setFilteredScans(filtered);
  }, [searchQuery, selectedDisease, scans]);

  const handleDelete = async (scanId) => {
    if (!window.confirm('Are you sure you want to delete this scan?')) return;

    try {
      await deleteScan(currentUser.uid, scanId);
      toast.success('Scan deleted successfully');
    } catch (error) {
      console.error('Error deleting scan:', error);
      toast.error('Failed to delete scan');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDiseaseColor = (label) => {
  const colors = {
    healthy: 'bg-green-100 text-green-700 border-green-300',
    'not a tea leaf': 'bg-red-100 text-red-700 border-red-300',

    'black blight': 'bg-gray-900 text-white border-gray-800',
    'blister blight': 'bg-red-100 text-red-700 border-red-300',
    'brown blight': 'bg-orange-100 text-orange-700 border-orange-300',
    'grey blight': 'bg-gray-100 text-gray-700 border-gray-300',

    redrust: 'bg-rose-100 text-rose-700 border-rose-300',
    sunburn: 'bg-orange-200 text-orange-800 border-orange-400',
    lichen: 'bg-teal-100 text-teal-700 border-teal-300',
    mita: 'bg-pink-100 text-pink-700 border-pink-300',

    magnesium: 'bg-purple-100 text-purple-700 border-purple-300',
    nitrogen: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    potassium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    sulfur: 'bg-amber-100 text-amber-700 border-amber-300',
  };

  return colors[label?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-300';
};


  const uniqueDiseases = ['all', ...new Set(scans.map(s => s.label).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scan History</h1>
        <p className="text-gray-600 mt-1">View and manage your previous scans</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by disease or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <Filter className="w-5 h-5" />
            <span>Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Disease
            </label>
            <div className="flex flex-wrap gap-2">
              {uniqueDiseases.map(disease => (
                <button
                  key={disease}
                  onClick={() => setSelectedDisease(disease)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedDisease === disease
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {disease === 'all' ? 'All' : disease.charAt(0).toUpperCase() + disease.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Showing <span className="font-semibold">{filteredScans.length}</span> of{' '}
          <span className="font-semibold">{scans.length}</span> scans
        </p>
      </div>

      {/* Scan List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScans.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No scans found</p>
            <p className="text-gray-500 text-sm mt-2">
              {searchQuery || selectedDisease !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by uploading your first scan'}
            </p>
          </div>
        ) : (
          filteredScans.map((scan) => (
            <div
              key={scan.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition cursor-pointer"
              onClick={() => setSelectedScan(scan)}
            >
              {/* Image */}
              <div className="relative h-48 bg-gray-100">
                {scan.imageB64 ? (
                  <img
                    src={`data:image/jpeg;base64,${scan.imageB64}`}
                    alt={scan.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(scan.id);
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border mb-3 ${getDiseaseColor(scan.label)}`}>
                  {scan.label || 'Unknown'}
                </div>
                
                {scan.confidence != null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Confidence</span>
                      <span className="font-semibold text-gray-900">
                        {(scan.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${scan.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{formatDate(scan.createdAt)}</span>
                  </div>
                  {scan.locName && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{scan.locName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedScan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Scan Details</h3>
              <button
                onClick={() => setSelectedScan(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Image */}
              {selectedScan.imageB64 && (
                <img
                  src={`data:image/jpeg;base64,${selectedScan.imageB64}`}
                  alt={selectedScan.label}
                  className="w-full rounded-xl"
                />
              )}

              {/* Disease Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detected Disease
                </label>
                <div className={`inline-block px-4 py-2 rounded-lg text-base font-medium border ${getDiseaseColor(selectedScan.label)}`}>
                  {selectedScan.label || 'Unknown'}
                </div>
              </div>

              {/* Confidence */}
              {selectedScan.confidence != null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Level
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all"
                          style={{ width: `${selectedScan.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {(selectedScan.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scan Date
                </label>
                <div className="flex items-center gap-2 text-gray-900">
                  <Calendar className="w-5 h-5" />
                  <span>{formatDate(selectedScan.createdAt)}</span>
                </div>
              </div>

              {/* Location */}
              {selectedScan.locName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="flex items-center gap-2 text-gray-900">
                    <MapPin className="w-5 h-5" />
                    <span>{selectedScan.locName}</span>
                  </div>
                  {selectedScan.geo && (
                    <p className="text-sm text-gray-600 mt-1 ml-7">
                      {selectedScan.geo.latitude.toFixed(4)}, {selectedScan.geo.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
              )}

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source
                </label>
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {selectedScan.source === 'video' ? 'Video Capture' : 'Image Upload'}
                </span>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => {
                  handleDelete(selectedScan.id);
                  setSelectedScan(null);
                }}
                className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;