import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getScans } from '../../firebase/firestore';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  AlertCircle,
  PieChart as PieChartIcon
} from 'lucide-react';

const Analytics = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalScans: 0,
    diseaseBreakdown: {},
    recentTrend: [],
    healthyPercentage: 0,
    mostCommonDisease: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [currentUser]);

  const loadAnalytics = async () => {
    if (!currentUser) return;

    try {
      const scans = await getScans(currentUser.uid);
      
      // Disease breakdown
      const diseaseCount = {};
      scans.forEach(scan => {
        const disease = scan.label || 'Unknown';
        diseaseCount[disease] = (diseaseCount[disease] || 0) + 1;
      });

      // Calculate healthy percentage
      const healthyCount = diseaseCount['healthy'] || 0;
      const healthyPercentage = scans.length > 0 
        ? (healthyCount / scans.length) * 100 
        : 0;

      // Find most common disease
      let mostCommon = null;
      let maxCount = 0;
      Object.entries(diseaseCount).forEach(([disease, count]) => {
        if (disease !== 'healthy' && count > maxCount) {
          maxCount = count;
          mostCommon = disease;
        }
      });

      // Recent trend (last 7 days)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const recentScans = scans.filter(scan => {
        const scanDate = scan.createdAt?.toDate?.() || new Date(scan.createdAtMs || 0);
        return scanDate.getTime() > sevenDaysAgo;
      });

      setStats({
        totalScans: scans.length,
        diseaseBreakdown: diseaseCount,
        recentTrend: recentScans,
        healthyPercentage,
        mostCommonDisease: mostCommon,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiseaseColor = (label) => {
    const colors = {
      healthy: '#10b981',
      algal: '#3b82f6',
      anthracnose: '#ef4444',
      'bird eye spot': '#eab308',
      'brown blight': '#f97316',
      'gray light': '#6b7280',
      magnesium: '#a855f7',
      nitrogen: '#6366f1',
      'red spot': '#f43f5e',
    };
    return colors[label?.toLowerCase()] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Insights and trends from your scans</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Scans</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalScans}
              </h3>
            </div>
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Health Rate</p>
              <h3 className="text-3xl font-bold text-green-600 mt-1">
                {stats.healthyPercentage.toFixed(1)}%
              </h3>
            </div>
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">
                {stats.recentTrend.length}
              </h3>
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-7 h-7 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Diseases Found</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">
                {Object.keys(stats.diseaseBreakdown).length}
              </h3>
            </div>
            <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Disease Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <PieChartIcon className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Disease Distribution</h2>
        </div>

        {Object.keys(stats.diseaseBreakdown).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(stats.diseaseBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([disease, count]) => {
                const percentage = (count / stats.totalScans) * 100;
                return (
                  <div key={disease}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: getDiseaseColor(disease) }}
                        />
                        <span className="font-medium text-gray-900">
                          {disease.charAt(0).toUpperCase() + disease.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {count} scan{count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: getDiseaseColor(disease),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Health Status */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Health Status</h3>
          <div className="space-y-3">
            {stats.healthyPercentage >= 70 ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">✓</span>
                  </div>
                  <p className="text-gray-900">Great! Most plants are healthy</p>
                </div>
                <p className="text-sm text-gray-700 ml-10">
                  {stats.healthyPercentage.toFixed(0)}% of your scans show healthy plants. 
                  Keep up the good work!
                </p>
              </>
            ) : stats.healthyPercentage >= 40 ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">!</span>
                  </div>
                  <p className="text-gray-900">Moderate health detected</p>
                </div>
                <p className="text-sm text-gray-700 ml-10">
                  {stats.healthyPercentage.toFixed(0)}% healthy plants. 
                  Consider reviewing disease prevention strategies.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">⚠</span>
                  </div>
                  <p className="text-gray-900">Action needed</p>
                </div>
                <p className="text-sm text-gray-700 ml-10">
                  Only {stats.healthyPercentage.toFixed(0)}% healthy plants detected. 
                  Immediate attention recommended.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Most Common Issue */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Most Common Issue</h3>
          <div className="space-y-3">
            {stats.mostCommonDisease ? (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getDiseaseColor(stats.mostCommonDisease) }}
                  >
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-gray-900 font-semibold">
                    {stats.mostCommonDisease.charAt(0).toUpperCase() + 
                     stats.mostCommonDisease.slice(1)}
                  </p>
                </div>
                <p className="text-sm text-gray-700 ml-10">
                  This disease appears in {stats.diseaseBreakdown[stats.mostCommonDisease]} of 
                  your scans. Consider targeted treatment.
                </p>
              </>
            ) : (
              <p className="text-gray-600">No disease issues detected yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity (7 days)</h2>
        {stats.recentTrend.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No activity in the last 7 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentTrend.slice(0, 5).map((scan, index) => {
              const date = scan.createdAt?.toDate?.() || new Date(scan.createdAtMs || 0);
              return (
                <div key={scan.id || index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getDiseaseColor(scan.label) + '20' }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getDiseaseColor(scan.label) }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {scan.label?.charAt(0).toUpperCase() + scan.label?.slice(1) || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {scan.confidence && (
                    <span className="text-sm font-medium text-gray-700">
                      {(scan.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;