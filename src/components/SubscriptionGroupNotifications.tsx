import React, { useEffect, useState } from 'react';
import { Send, Users, Mail, Bell, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NotificationGroup {
  group_code: string;
  group_name: string;
  description: string;
  member_count: number;
}

export const SubscriptionGroupNotifications: React.FC = () => {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'announcement' | 'update' | 'promotion' | 'warning' | 'reminder'>('announcement');
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'in_app' | 'both'>('both');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      loadGroups();
    }
  }, [user, profile]);

  const loadGroups = async () => {
    setLoading(true);
    
    // Load groups
    const { data: groupsData, error: groupsError } = await supabase
      .from('subscription_notification_groups')
      .select('*')
      .order('group_code');

    if (!groupsError && groupsData) {
      setGroups(groupsData);
    }

    // Update member counts
    await supabase.rpc('update_group_member_counts');
    
    // Reload with updated counts
    const { data: updatedGroups } = await supabase
      .from('subscription_notification_groups')
      .select('*')
      .order('group_code');
    
    if (updatedGroups) {
      setGroups(updatedGroups);
    }

    setLoading(false);
  };

  const loadGroupMembers = async (groupCode: string) => {
    const { data, error } = await supabase.rpc('get_subscription_group_members', {
      p_group_code: groupCode,
    });

    if (!error && data) {
      setGroupMembers(data);
    }
  };

  const handleGroupSelect = (groupCode: string) => {
    setSelectedGroup(groupCode);
    loadGroupMembers(groupCode);
    setShowPreview(false);
  };

  const handleSendNotification = async () => {
    if (!user || !selectedGroup || !subject || !message) {
      alert('Please fill in all fields');
      return;
    }

    if (!confirm(`Are you sure you want to send notification to ${groupMembers.length} users?`)) {
      return;
    }

    setSending(true);

    try {
      // Create mass notification record
      const { data, error } = await supabase
        .from('mass_notifications')
        .insert({
          subject,
          message,
          notification_type: notificationType,
          target_group_code: selectedGroup,
          delivery_method: deliveryMethod,
          total_recipients: groupMembers.length,
          sent_by: user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Call Edge Function to send notifications
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-mass-notification', {
        body: { notificationId: data.id },
      });

      if (sendError) throw sendError;

      console.log('Send result:', sendResult);
      
      // Log errors in detail
      if (sendResult?.errors) {
        console.error('ERRORS:', JSON.stringify(sendResult.errors, null, 2));
        sendResult.errors.forEach((err: any, idx: number) => {
          console.error(`Error ${idx}:`, err);
        });
      }

      // Check if there were any failures
      if (sendResult?.failedCount > 0) {
        console.error('Failed to send to some recipients:', sendResult);
        
        let errorMessage = `Sent to ${sendResult.sentCount}/${sendResult.totalRecipients} recipients.\n\n`;
        
        if (sendResult.errors && sendResult.errors.length > 0) {
          errorMessage += 'Errors:\n';
          sendResult.errors.forEach((err: any) => {
            errorMessage += `- ${err.recipient}: ${err.error?.message || JSON.stringify(err.error)}\n`;
          });
        }
        
        if (sendResult.debug) {
          errorMessage += `\nDebug info:\n${JSON.stringify(sendResult.debug, null, 2)}`;
        }
        
        alert(errorMessage);
      } else {
        alert(`Notification sent successfully to ${sendResult?.sentCount || 0} recipients!`);
      }
      
      // Reset form
      setSubject('');
      setMessage('');
      setSelectedGroup('');
      setGroupMembers([]);
      setShowPreview(false);
    } catch (error: any) {
      console.error('Send notification error:', error);
      alert(error.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-blue-500';
      case 'update': return 'bg-green-500';
      case 'promotion': return 'bg-purple-500';
      case 'warning': return 'bg-yellow-500';
      case 'reminder': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            Group Management & Mass Notifications
          </h2>
          <p className="text-gray-400 mt-1">Send notifications to subscriber groups</p>
        </div>
        <button
          onClick={loadGroups}
          className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-all"
        >
          Refresh
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {groups.map((group) => (
          <button
            key={group.group_code}
            onClick={() => handleGroupSelect(group.group_code)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedGroup === group.group_code
                ? 'border-mystery-500 bg-mystery-500/10'
                : 'border-mystery-700 bg-mystery-800 hover:border-mystery-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">{group.group_name}</h3>
              <span className="bg-mystery-600 text-white text-sm px-2 py-1 rounded-full">
                {group.member_count}
              </span>
            </div>
            <p className="text-sm text-gray-400">{group.description}</p>
          </button>
        ))}
      </div>

      {/* Notification Form */}
      {selectedGroup && (
        <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Notification: {groups.find(g => g.group_code === selectedGroup)?.group_name}
          </h3>

          <div className="space-y-4">
            {/* Notification Type */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Notification Type
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(['announcement', 'update', 'promotion', 'warning', 'reminder'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNotificationType(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      notificationType === type
                        ? `${getNotificationTypeColor(type)} text-white`
                        : 'bg-mystery-700 text-gray-400 hover:bg-mystery-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Method */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Delivery Method
              </label>
              <div className="flex gap-4">
                {(['email', 'in_app', 'both'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setDeliveryMethod(method)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      deliveryMethod === method
                        ? 'bg-mystery-500 text-white'
                        : 'bg-mystery-700 text-gray-400 hover:bg-mystery-600'
                    }`}
                  >
                    {method === 'email' && <Mail className="w-4 h-4 inline mr-1" />}
                    {method === 'in_app' && <Bell className="w-4 h-4 inline mr-1" />}
                    {method === 'both' && <TrendingUp className="w-4 h-4 inline mr-1" />}
                    {method === 'email' ? 'Email' : method === 'in_app' ? 'In-App' : 'Both'}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. New AI Feature Available!"
                className="w-full px-4 py-2 bg-mystery-700 border border-mystery-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-mystery-500"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Write your message here..."
                className="w-full px-4 py-2 bg-mystery-700 border border-mystery-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-mystery-500"
              />
            </div>

            {/* Preview */}
            {showPreview && subject && message && (
              <div className="bg-mystery-900 rounded-lg p-4 border border-mystery-600">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Preview:</h4>
                <div className="space-y-2">
                  <div className="text-white font-semibold">{subject}</div>
                  <div className="text-gray-300 whitespace-pre-wrap">{message}</div>
                </div>
              </div>
            )}

            {/* Recipients Preview */}
            {groupMembers.length > 0 && (
              <div className="bg-mystery-900 rounded-lg p-4 border border-mystery-600">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">
                  Recipients: {groupMembers.length} users
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {groupMembers.slice(0, 10).map((member, idx) => (
                    <div key={idx} className="text-sm text-gray-400 flex items-center gap-2">
                      <span className="text-white">{member.full_name || 'Unknown'}</span>
                      <span>({member.email})</span>
                      <span className="text-xs bg-mystery-700 px-2 py-0.5 rounded">
                        {member.plan_type}
                      </span>
                    </div>
                  ))}
                  {groupMembers.length > 10 && (
                    <div className="text-sm text-gray-500 italic">
                      + {groupMembers.length - 10} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setShowPreview(!showPreview)}
                disabled={!subject || !message}
                className="flex-1 px-6 py-3 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              <button
                onClick={handleSendNotification}
                disabled={!subject || !message || sending}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-mystery-500 to-mystery-600 hover:from-mystery-600 hover:to-mystery-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Notification
                  </>
                )}
              </button>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">
                Notification will be sent to <strong>{groupMembers.length}</strong> users. 
                Please review carefully before sending!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
