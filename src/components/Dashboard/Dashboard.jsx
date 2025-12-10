import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getScans } from '../../firebase/firestore';
import { 
  Upload, 
  Activity, 
  TrendingUp, 
  AlertCircle,
  ArrowRight,
  Calendar,
  MapPin
} from 'lucide-react';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalScans: 0,
    recentScans: [],
    diseaseDistribution: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  const loadDashboardData = async () => {
    if (!currentUser) return;

    try {
      const scans = await getScans(currentUser.uid, 10);
      
      // Calculate stats
      const diseaseCount = {};
      scans.forEach(scan => {
        const disease = scan.label || 'Unknown';
        diseaseCount[disease] = (diseaseCount[disease] || 0) + 1;
      });

      setStats({
        totalScans: scans.length,
        recentScans: scans.slice(0, 5),
        diseaseDistribution: diseaseCount,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDiseaseColor = (label) => {
    const colors = {
      healthy: 'bg-green-100 text-green-700',
      algal: 'bg-blue-100 text-blue-700',
      anthracnose: 'bg-red-100 text-red-700',
      'bird eye spot': 'bg-yellow-100 text-yellow-700',
      'brown blight': 'bg-orange-100 text-orange-700',
      'gray light': 'bg-gray-100 text-gray-700',
      magnesium: 'bg-purple-100 text-purple-700',
      nitrogen: 'bg-indigo-100 text-indigo-700',
      'red spot': 'bg-rose-100 text-rose-700',
    };
    return colors[label?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your overview.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/dashboard/upload')}
          className="bg-green-600 text-white p-6 rounded-xl hover:bg-green-700 transition flex items-center justify-between group"
        >
          <div className="text-left">
            <p className="text-sm opacity-90">Start New</p>
            <h3 className="text-xl font-bold mt-1">Scan</h3>
          </div>
          <Upload className="w-8 h-8 group-hover:scale-110 transition" />
        </button>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Scans</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalScans}
              </h3>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Diseases Found</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {Object.keys(stats.diseaseDistribution).length}
              </h3>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {stats.recentScans.length}
              </h3>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Recent Scans</h2>
          <button
            onClick={() => navigate('/dashboard/history')}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {stats.recentScans.length === 0 ? (
            <div className="p-12 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No scans yet</p>
              <button
                onClick={() => navigate('/dashboard/upload')}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
              >
                Create First Scan
              </button>
            </div>
          ) : (
            stats.recentScans.map((scan) => (
              <div
                key={scan.id}
                className="p-4 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => navigate(`/dashboard/history?scan=${scan.id}`)}
              >
                <div className="flex items-center gap-4">
                  {/* Image */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {scan.imageB64 ? (
                      <img
                        src={`data:image/jpeg;base64,${scan.imageB64}`}
                        alt="Scan"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Activity className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDiseaseColor(scan.label)}`}>
                        {scan.label || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(scan.confidence * 100).toFixed(1)}% confidence
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(scan.createdAt)}
                      </span>
                      {scan.locName && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{scan.locName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Disease Distribution */}
      {Object.keys(stats.diseaseDistribution).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Disease Distribution</h2>
          <div className="space-y-3">
            {Object.entries(stats.diseaseDistribution).map(([disease, count]) => {
              const percentage = (count / stats.totalScans) * 100;
              return (
                <div key={disease}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDiseaseColor(disease)}`}>
                      {disease}
                    </span>
                    <span className="text-sm text-gray-600">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;