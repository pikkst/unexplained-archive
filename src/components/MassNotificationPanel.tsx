import React, { useState, useEffect } from 'react';
import { Send, Users, UserCheck, Crown, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RecipientGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const RECIPIENT_GROUPS: RecipientGroup[] = [
  {
    id: 'all_users',
    label: 'All Users',
    icon: <Users className="w-5 h-5" />,
    description: 'Send to all registered users'
  },
  {
    id: 'investigators',
    label: 'All Investigators',
    icon: <UserCheck className="w-5 h-5" />,
    description: 'Send to users with investigator role'
  },
  {
    id: 'free_tier',
    label: 'Free Tier Users',
    icon: <Users className="w-5 h-5" />,
    description: 'Users without active subscription'
  },
  {
    id: 'pro_tier',
    label: 'Pro Subscribers',
    icon: <Crown className="w-5 h-5 text-blue-400" />,
    description: 'Users with Pro subscription'
  },
  {
    id: 'premium_tier',
    label: 'Premium Subscribers',
    icon: <Crown className="w-5 h-5 text-purple-400" />,
    description: 'Users with Premium subscription'
  }
];

export const MassNotificationPanel: React.FC = () => {
  const { user } = useAuth();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);
  const [recipientCount, setRecipientCount] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    loadRecipientCounts();
  }, []);

  const loadRecipientCounts = async () => {
    try {
      // Get counts for each group
      const counts: { [key: string]: number } = {};

      // All users
      const { count: allCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      counts['all_users'] = allCount || 0;

      // Investigators
      const { count: investigatorCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'investigator');
      counts['investigators'] = investigatorCount || 0;

      // Free tier (users without active subscription)
      const { data: subscribedUsers } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active');
      
      const subscribedUserIds = subscribedUsers?.map(s => s.user_id) || [];
      
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      counts['free_tier'] = (totalUsers || 0) - subscribedUserIds.length;

      // Pro tier (investigator_pro or user_premium basic tier)
      const { count: proCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .in('plan_type', ['investigator_basic', 'investigator_pro']);
      counts['pro_tier'] = proCount || 0;

      // Premium tier (user_premium)
      const { count: premiumCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('plan_type', 'user_premium');
      counts['premium_tier'] = premiumCount || 0;

      setRecipientCount(counts);
    } catch (error) {
      console.error('Failed to load recipient counts:', error);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    );
  };

  const getTotalRecipients = () => {
    if (selectedGroups.includes('all_users')) {
      return recipientCount['all_users'] || 0;
    }
    
    // Calculate unique recipients (avoid duplicates)
    let total = 0;
    selectedGroups.forEach(group => {
      total += recipientCount[group] || 0;
    });
    return total;
  };

  const handleSendNotifications = async () => {
    if (!user || !title.trim() || !message.trim() || selectedGroups.length === 0) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      // Get all user IDs for selected groups
      const userIds: string[] = [];
      
      for (const groupId of selectedGroups) {
        let query = supabase.from('profiles').select('id');
        
        switch (groupId) {
          case 'all_users':
            // All registered users
            break;
          case 'investigators':
            query = query.eq('role', 'investigator');
            break;
          case 'free_tier':
            // Users without active subscription
            query = query.not('id', 'in', 
              supabase.from('subscriptions')
                .select('user_id')
                .in('status', ['active', 'trialing'])
            );
            break;
          case 'pro_tier':
            // Users with Pro subscription
            const { data: proUsers } = await supabase
              .from('subscriptions')
              .select('user_id')
              .eq('plan_type', 'pro')
              .in('status', ['active', 'trialing']);
            if (proUsers) {
              userIds.push(...proUsers.map(s => s.user_id));
            }
            continue;
          case 'premium_tier':
            // Users with Premium subscription
            const { data: premiumUsers } = await supabase
              .from('subscriptions')
              .select('user_id')
              .eq('plan_type', 'premium')
              .in('status', ['active', 'trialing']);
            if (premiumUsers) {
              userIds.push(...premiumUsers.map(s => s.user_id));
            }
            continue;
        }
        
        const { data: users } = await query;
        if (users) {
          userIds.push(...users.map(u => u.id));
        }
      }

      // Remove duplicates
      const uniqueUserIds = Array.from(new Set(userIds));

      console.log(`Found ${uniqueUserIds.length} unique recipients for groups:`, selectedGroups);

      if (uniqueUserIds.length === 0) {
        throw new Error('No recipients found for selected groups');
      }

      // Create mass notification record
      const { data: notificationRecord, error: createError } = await supabase
        .from('mass_notifications')
        .insert({
          subject: title,
          message: message,
          notification_type: 'announcement',
          target_user_ids: uniqueUserIds,
          delivery_method: 'in_app',
          total_recipients: uniqueUserIds.length,
          sent_by: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create notification record:', createError);
        throw createError;
      }

      console.log('Created notification record:', notificationRecord.id);

      // Call Edge Function to send notifications
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-mass-notification', {
        body: { notificationId: notificationRecord.id },
      });

      if (sendError) {
        console.error('Edge Function error:', sendError);
        throw sendError;
      }

      console.log('Send result:', sendResult);

      if (sendResult?.failedCount > 0) {
        setResult({ 
          success: false, 
          count: sendResult.sentCount,
          error: `Sent to ${sendResult.sentCount}/${sendResult.totalRecipients} users. ${sendResult.failedCount} failed.`
        });
      } else {
        setResult({ success: true, count: sendResult?.sentCount || 0 });
      }
      
      // Reset form
      setTitle('');
      setMessage('');
      setActionUrl('');
      setSelectedGroups([]);
      
    } catch (error: any) {
      console.error('Failed to send mass notification:', error);
      setResult({ success: false, count: 0, error: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <Mail className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Mass Notifications</h2>
          <p className="text-sm text-gray-400">Send notifications to multiple user groups</p>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`mb-6 p-4 rounded-lg border ${
          result.success 
            ? 'bg-green-500/10 border-green-500/50' 
            : 'bg-red-500/10 border-red-500/50'
        }`}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Notifications Sent Successfully!' : 'Failed to Send Notifications'}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                {result.success 
                  ? `Sent to ${result.count} user${result.count !== 1 ? 's' : ''}`
                  : result.error || 'An error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recipient Groups */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-3">
          Select Recipient Groups
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RECIPIENT_GROUPS.map(group => (
            <button
              key={group.id}
              onClick={() => toggleGroup(group.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedGroups.includes(group.id)
                  ? 'border-mystery-500 bg-mystery-500/20'
                  : 'border-mystery-700 hover:border-mystery-600 bg-mystery-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 ${selectedGroups.includes(group.id) ? 'text-mystery-400' : 'text-gray-500'}`}>
                  {group.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-white">{group.label}</p>
                    <span className="text-xs text-mystery-400 font-mono">
                      {recipientCount[group.id] || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{group.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {selectedGroups.length > 0 && (
          <div className="mt-3 p-3 bg-mystery-900 rounded-lg border border-mystery-700">
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-mystery-400">Total Recipients: </span>
              <span className="text-white font-bold">{getTotalRecipients()}</span> user{getTotalRecipients() !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Notification Title */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-white mb-2">
          Notification Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Platform Update, New Feature Announcement"
          className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-mystery-500"
          maxLength={100}
        />
        <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
      </div>

      {/* Notification Message */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-white mb-2">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your notification message..."
          rows={5}
          className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-mystery-500 resize-none"
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
      </div>

      {/* Action URL (Optional) */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-2">
          Action URL (Optional)
        </label>
        <input
          type="text"
          value={actionUrl}
          onChange={(e) => setActionUrl(e.target.value)}
          placeholder="/explore or /profile or leave empty"
          className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-mystery-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Users will be redirected here when clicking the notification
        </p>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSendNotifications}
        disabled={sending || !title.trim() || !message.trim() || selectedGroups.length === 0}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-mystery-500 hover:bg-mystery-600 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {sending ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Sending...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Send to {getTotalRecipients()} User{getTotalRecipients() !== 1 ? 's' : ''}
          </>
        )}
      </button>
    </div>
  );
};
