import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, TrendingUp, DollarSign, XCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  transactions_today: number;
  failed_today: number;
  unresolved_webhooks: number;
  unreviewed_fraud_flags: number;
  deposits_week: number;
  expected_balance: number;
  reconciliation_status: string;
  last_reconciliation: string;
}

interface WebhookFailure {
  id: string;
  stripe_event_id: string;
  event_type: string;
  failure_reason: string;
  retry_count: number;
  last_retry_at: string;
  created_at: string;
}

export const AdminPaymentDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [failures, setFailures] = useState<WebhookFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);

    try {
      // Load dashboard stats
      const { data: statsData } = await supabase
        .from('admin_payment_dashboard' as any)
        .select('*')
        .single();

      if (statsData) setStats(statsData);

      // Load failed webhooks
      const { data: failuresData } = await (supabase.rpc as any)('get_failed_webhooks', {
        p_limit: 20,
        p_offset: 0,
      });

      if (failuresData) setFailures(failuresData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryWebhook = async (failureId: string) => {
    setRetrying(failureId);

    try {
      const { data, error } = await supabase.functions.invoke('retry-webhook', {
        body: { failureId },
      });

      if (error) throw error;

      if (data.success) {
        alert('Webhook successfully reprocessed!');
        await loadDashboardData();
      } else {
        alert(`Retry failed: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setRetrying(null);
    }
  };

  const handleRunReconciliation = async () => {
    try {
      const { data, error } = await (supabase.rpc as any)('perform_balance_reconciliation');

      if (error) throw error;

      alert('Reconciliation complete!\n' + JSON.stringify(data, null, 2));
      await loadDashboardData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Payment System Dashboard</h1>
        <p className="text-gray-400">Monitor transactions, webhooks, and system health</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Transactions */}
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Today's Transactions</h3>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.transactions_today || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Total processed</p>
        </div>

        {/* Failed Today */}
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Failed Today</h3>
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.failed_today || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Requires attention</p>
        </div>

        {/* Unresolved Webhooks */}
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Failed Webhooks</h3>
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.unresolved_webhooks || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Need retry</p>
        </div>

        {/* Week Deposits */}
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Deposits (7d)</h3>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">€{(stats?.deposits_week || 0).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
        </div>
      </div>

      {/* Reconciliation Card */}
      <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Balance Reconciliation</h3>
            <p className="text-sm text-gray-400">Verify database matches Stripe balance</p>
          </div>
          <button
            onClick={handleRunReconciliation}
            className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Run Check
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Expected Balance</p>
            <p className="text-2xl font-bold text-white">€{(stats?.expected_balance || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              {stats?.reconciliation_status === 'ok' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              )}
              <p className="text-lg font-bold text-white capitalize">{stats?.reconciliation_status || 'Unknown'}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Last Check</p>
            <p className="text-lg text-white">
              {stats?.last_reconciliation
                ? new Date(stats.last_reconciliation).toLocaleDateString()
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Failed Webhooks Table */}
      <div className="bg-mystery-800 rounded-xl border border-mystery-700">
        <div className="p-6 border-b border-mystery-700">
          <h3 className="text-lg font-bold text-white">Failed Webhooks</h3>
          <p className="text-sm text-gray-400 mt-1">Webhook events that need manual intervention</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mystery-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Event ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Retries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {failures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                    No failed webhooks. System is healthy!
                  </td>
                </tr>
              ) : (
                failures.map((failure) => (
                  <tr key={failure.id} className="border-b border-mystery-700 hover:bg-mystery-700/50">
                    <td className="px-6 py-4 text-sm text-gray-300 font-mono">{failure.stripe_event_id.substring(0, 20)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{failure.event_type}</td>
                    <td className="px-6 py-4 text-sm text-red-400 max-w-xs truncate">{failure.failure_reason}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <span className="px-2 py-1 bg-mystery-600 rounded-full">{failure.retry_count}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(failure.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRetryWebhook(failure.id)}
                        disabled={retrying === failure.id}
                        className="px-3 py-1 bg-mystery-500 hover:bg-mystery-400 disabled:bg-mystery-600 text-white text-sm rounded flex items-center gap-1 transition-colors"
                      >
                        {retrying === failure.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Retry
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
