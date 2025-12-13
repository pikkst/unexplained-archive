import React, { useState, useEffect } from 'react';
import { boostService } from '../services/boostService';
import { TrendingUp, Eye, MousePointer, DollarSign, Zap, Calendar } from 'lucide-react';

interface BoostAnalyticsDashboardProps {
  userId: string;
}

export const BoostAnalyticsDashboard: React.FC<BoostAnalyticsDashboardProps> = ({ userId }) => {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [userId]);

  const loadAnalytics = async () => {
    setLoading(true);
    const data = await boostService.getUserBoostAnalytics(userId);
    setAnalytics(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (analytics.length === 0) {
    return (
      <div className="text-center p-8 bg-mystery-800 rounded-lg border border-mystery-700">
        <Zap className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Boosts Yet</h3>
        <p className="text-gray-400">You haven't purchased any case boosts. Boost your cases to get more visibility!</p>
      </div>
    );
  }

  const totalSpent = analytics.reduce((sum, a) => sum + Number(a.price_paid), 0);
  const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = analytics.reduce((sum, a) => sum + a.clicks, 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Spent</p>
              <p className="text-xl font-bold text-white">€{totalSpent.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Impressions</p>
              <p className="text-xl font-bold text-white">{totalImpressions.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <MousePointer className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Clicks</p>
              <p className="text-xl font-bold text-white">{totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg CTR</p>
              <p className="text-xl font-bold text-white">{avgCTR}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analytics Table */}
      <div className="bg-mystery-800 border border-mystery-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-mystery-700">
          <h3 className="text-lg font-bold text-white">Boost History</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-mystery-900/50 border-b border-mystery-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Case</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Impressions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Clicks</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">CTR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mystery-700">
              {analytics.map((boost) => (
                <tr key={boost.case_id} className="hover:bg-mystery-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {boost.is_active && (
                        <Zap className="w-4 h-4 text-yellow-400 fill-current" />
                      )}
                      <span className="text-sm text-white font-medium">{boost.case_title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 bg-mystery-700 text-xs font-medium text-gray-300 rounded">
                      {boost.boost_type === '24h' ? '24 Hours' : boost.boost_type === '7d' ? '7 Days' : '30 Days'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                      boost.is_active 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {boost.is_active ? 'Active' : 'Expired'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-white">{boost.impressions.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-white">{boost.clicks.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-white">{boost.ctr}%</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">€{Number(boost.price_paid).toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Performance Insights
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          {avgCTR > '5.0' && (
            <p>✅ Excellent CTR! Your cases are very engaging.</p>
          )}
          {totalImpressions / analytics.length > 100 && (
            <p>✅ High visibility! Your boosts are reaching many users.</p>
          )}
          {totalClicks / totalSpent > 10 && (
            <p>✅ Great ROI! You're getting good value from your boosts.</p>
          )}
          {analytics.some(a => a.is_active) && (
            <p>⚡ You have {analytics.filter(a => a.is_active).length} active boost(s) running now.</p>
          )}
        </div>
      </div>
    </div>
  );
};
