import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, MessageSquare, Clock, Eye, Trash2, RefreshCw, Bell, Reply } from 'lucide-react';
import { markMessageRead, markNotificationRead, getNotifications, Notification } from '../services/notificationService';
import { supabase } from '../lib/supabase';
import { DirectMessageModal } from './DirectMessageModal';

interface MessageWithDetails {
  id: string;
  case_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  attachment_url?: string;
  read_at?: string;
  created_at: string;
  sender?: {
    username: string;
    avatar_url?: string;
  };
  case?: {
    title: string;
  };
}

type InboxItem = 
  | { type: 'message'; data: MessageWithDetails }
  | { type: 'notification'; data: Notification };

export const Inbox: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [sentMessages, setSentMessages] = useState<MessageWithDetails[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithDetails | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'sent' | 'notifications'>('notifications');
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyToUser, setReplyToUser] = useState<{ id: string; username: string } | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  useEffect(() => {
    if (user) {
      loadAllMessages();
      loadSentMessages();
      loadAllNotifications();
    }
  }, [user]);

  const loadAllMessages = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get all messages where user is recipient
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(username, avatar_url),
          case:cases(title)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSentMessages = async () => {
    if (!user) return;
    
    try {
      // Get all messages where user is sender
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          recipient:profiles!messages_recipient_id_fkey(username, avatar_url),
          case:cases(title)
        `)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSentMessages(data || []);
    } catch (error) {
      console.error('Failed to load sent messages:', error);
    }
  };

  const loadAllNotifications = async () => {
    if (!user) return;
    
    try {
      const data = await getNotifications(user.id, 50);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    if (!user) return;
    
    try {
      await markMessageRead(messageId, user.id);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, read_at: new Date().toISOString() }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('recipient_id', user.id);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this notification?')) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (selectedNotification?.id === notificationId) {
        setSelectedNotification(null);
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      alert('Failed to delete notification');
    }
  };

  const handleClearReadNotifications = async () => {
    if (!user) return;
    
    const readNotifications = notifications.filter(n => n.read_at);
    if (readNotifications.length === 0) {
      alert('No read notifications to clear');
      return;
    }
    
    if (!confirm(`Delete ${readNotifications.length} read notification(s)?`)) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .not('read_at', 'is', null);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !n.read_at));
      setSelectedNotification(null);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      alert('Failed to clear notifications');
    }
  };

  const handleSelectMessage = async (message: MessageWithDetails) => {
    setSelectedMessage(message);
    setSelectedNotification(null);
    setShowMobileDetail(true);
    
    // Mark as read when opened
    if (!message.read_at && user) {
      await handleMarkAsRead(message.id);
    }
  };

  const handleSelectNotification = async (notification: Notification) => {
    setSelectedNotification(notification);
    setSelectedMessage(null);
    setShowMobileDetail(true);
    
    // Mark as read
    if (!notification.read_at && user) {
      await markNotificationRead(notification.id, user.id);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
    }
  };

  const unreadMessagesCount = messages.filter(msg => !msg.read_at).length;
  const unreadNotificationsCount = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-mystery-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mystery-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-mystery-700 p-2 sm:p-3 rounded-lg">
                <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-mystery-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Inbox</h1>
                <p className="text-sm sm:text-base text-gray-400 mt-1">
                  {unreadNotificationsCount > 0 || unreadMessagesCount > 0 ? (
                    <span className="text-green-400 font-semibold">
                      {unreadNotificationsCount + unreadMessagesCount} unread
                    </span>
                  ) : (
                    'All caught up'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                loadAllMessages();
                loadAllNotifications();
              }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-col sm:flex-row gap-2 bg-mystery-800 rounded-lg border border-mystery-700 p-1">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${
              activeTab === 'notifications'
                ? 'bg-mystery-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
            {unreadNotificationsCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${
              activeTab === 'messages'
                ? 'bg-mystery-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            Received
            {unreadMessagesCount > 0 && (
              <span className="bg-green-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {unreadMessagesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${
              activeTab === 'sent'
                ? 'bg-mystery-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Sent ({sentMessages.length})
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List (Notifications or Messages) - Hide on mobile when detail is shown */}
          <div className={`lg:col-span-1 ${showMobileDetail ? 'hidden lg:block' : 'block'}`}>
            <div className="bg-mystery-800 rounded-lg border border-mystery-700 overflow-hidden">
              <div className="p-4 border-b border-mystery-700 flex justify-between items-center">
                <h2 className="font-bold text-white">
                  {activeTab === 'notifications' 
                    ? `Notifications (${notifications.length})` 
                    : activeTab === 'sent'
                    ? `Sent Messages (${sentMessages.length})`
                    : `Received Messages (${messages.length})`
                  }
                </h2>
                {activeTab === 'notifications' && notifications.some(n => n.read_at) && (
                  <button
                    onClick={handleClearReadNotifications}
                    className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                    title="Delete all read notifications"
                  >
                    Clear Read
                  </button>
                )}
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {activeTab === 'notifications' ? (
                  // Notifications List
                  notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-mystery-700">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`relative group ${
                            selectedNotification?.id === notification.id ? 'bg-mystery-700' : ''
                          } ${
                            !notification.read_at ? 'bg-blue-900/20 border-l-4 border-blue-500' : ''
                          }`}
                        >
                          <button
                            onClick={() => handleSelectNotification(notification)}
                            className="w-full text-left p-4 hover:bg-mystery-700 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-mystery-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bell className="w-5 h-5 text-mystery-400" />
                              </div>
                              
                              <div className="flex-1 min-w-0 pr-8">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className={`font-semibold truncate ${
                                    !notification.read_at ? 'text-white' : 'text-gray-300'
                                  }`}>
                                    {notification.title}
                                  </p>
                                  {!notification.read_at && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                  )}
                                </div>
                                
                                <p className="text-sm text-gray-400 line-clamp-2 mb-1">
                                  {notification.message}
                                </p>
                                
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  {new Date(notification.created_at).toLocaleString('en-US')}
                                </div>
                              </div>
                            </div>
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(notification.id);
                            }}
                            className="absolute top-2 right-2 p-2 text-red-400 hover:text-red-300 hover:bg-mystery-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete notification"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : activeTab === 'sent' ? (
                  // Sent Messages List
                  sentMessages.length === 0 ? (
                    <div className="p-8 text-center">
                      <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No sent messages</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-mystery-700">
                      {sentMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`relative group ${
                            selectedMessage?.id === message.id ? 'bg-mystery-700' : ''
                          }`}
                        >
                          <button
                            onClick={() => handleSelectMessage(message)}
                            className="w-full text-left p-4 hover:bg-mystery-700 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              {message.recipient?.avatar_url ? (
                                <img 
                                  src={message.recipient.avatar_url} 
                                  alt="" 
                                  className="w-10 h-10 rounded-full flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-mystery-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <MessageSquare className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0 pr-8">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p 
                                    className="font-semibold truncate hover:text-blue-400 cursor-pointer transition-colors text-gray-300"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/profile/${message.recipient?.username}`); }}
                                  >
                                    To: {message.recipient?.username || 'Unknown'}
                                  </p>
                                </div>
                                
                                {message.case && (
                                  <p className="text-xs text-mystery-400 mb-1 truncate">
                                    Case: {message.case.title}
                                  </p>
                                )}
                                
                                <p className="text-sm text-gray-400 line-clamp-2 mb-1">
                                  {message.content}
                                </p>
                                
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  {new Date(message.created_at).toLocaleString('en-US')}
                                </div>
                              </div>
                            </div>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(message.id);
                            }}
                            className="absolute top-2 right-2 p-2 text-red-400 hover:text-red-300 hover:bg-mystery-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Received Messages List
                  messages.length === 0 ? (
                    <div className="p-8 text-center">
                      <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No messages</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-mystery-700">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`relative group ${
                            selectedMessage?.id === message.id ? 'bg-mystery-700' : ''
                          } ${
                            !message.read_at ? 'bg-blue-900/20 border-l-4 border-blue-500' : ''
                          }`}
                        >
                          <button
                            onClick={() => handleSelectMessage(message)}
                            className="w-full text-left p-4 hover:bg-mystery-700 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              {message.sender?.avatar_url ? (
                                <img 
                                  src={message.sender.avatar_url} 
                                  alt="" 
                                  className="w-10 h-10 rounded-full flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-mystery-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <MessageSquare className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0 pr-8">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p 
                                    className={`font-semibold truncate hover:text-blue-400 cursor-pointer transition-colors ${
                                      !message.read_at ? 'text-white' : 'text-gray-300'
                                    }`}
                                    onClick={(e) => { e.stopPropagation(); navigate(`/profile/${message.sender?.username}`); }}
                                  >
                                    {message.sender?.username || 'Unknown'}
                                  </p>
                                  {!message.read_at && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                  )}
                                </div>
                                
                                {message.case && (
                                  <p className="text-xs text-mystery-400 mb-1 truncate">
                                    Case: {message.case.title}
                                  </p>
                                )}
                                
                                <p className="text-sm text-gray-400 line-clamp-2 mb-1">
                                  {message.content}
                                </p>
                                
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  {new Date(message.created_at).toLocaleString('en-US')}
                                </div>
                              </div>
                            </div>
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(message.id);
                            }}
                            className="absolute top-2 right-2 p-2 text-red-400 hover:text-red-300 hover:bg-mystery-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Detail View (Notification or Message) - Show on mobile when detail is selected */}
          <div className={`lg:col-span-2 ${!showMobileDetail && !selectedMessage && !selectedNotification ? 'hidden lg:block' : 'block'}`}>
            {/* Back button for mobile */}
            {showMobileDetail && (selectedMessage || selectedNotification) && (
              <button
                onClick={() => setShowMobileDetail(false)}
                className="lg:hidden mb-4 flex items-center gap-2 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to list
              </button>
            )}
            
            {selectedNotification ? (
              // Notification Detail
              <div className="bg-mystery-800 rounded-lg border border-mystery-700 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-mystery-700">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mystery-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-mystery-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-white mb-2 break-words">
                          {selectedNotification.title}
                        </h2>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="truncate">{new Date(selectedNotification.created_at).toLocaleString('en-US')}</span>
                          </div>
                          {selectedNotification.read_at && (
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                              Read
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteNotification(selectedNotification.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-mystery-700 rounded-lg transition-colors flex-shrink-0"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm sm:text-base text-gray-300 whitespace-pre-wrap break-words">
                      {selectedNotification.message}
                    </p>
                  </div>
                </div>
              </div>
            ) : selectedMessage ? (
              // Message Detail
              <div className="bg-mystery-800 rounded-lg border border-mystery-700 overflow-hidden">
                {/* Message Header */}
                <div className="p-4 sm:p-6 border-b border-mystery-700">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      {activeTab === 'sent' ? (
                        // Sent message - show recipient
                        selectedMessage.recipient?.avatar_url ? (
                          <img 
                            src={selectedMessage.recipient.avatar_url} 
                            alt="" 
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mystery-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                          </div>
                        )
                      ) : (
                        // Received message - show sender
                        selectedMessage.sender?.avatar_url ? (
                          <img 
                            src={selectedMessage.sender.avatar_url} 
                            alt="" 
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mystery-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                          </div>
                        )
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {activeTab === 'sent' ? (
                          <h2 
                            className="text-lg sm:text-xl font-bold text-white mb-1 hover:text-blue-400 cursor-pointer transition-colors truncate"
                            onClick={() => navigate(`/profile/${selectedMessage.recipient?.username}`)}
                          >
                            To: {selectedMessage.recipient?.username || 'Unknown'}
                          </h2>
                        ) : (
                          <h2 
                            className="text-lg sm:text-xl font-bold text-white mb-1 hover:text-blue-400 cursor-pointer transition-colors truncate"
                            onClick={() => navigate(`/profile/${selectedMessage.sender?.username}`)}
                          >
                            {selectedMessage.sender?.username || 'Unknown'}
                          </h2>
                        )}
                        {selectedMessage.case && (
                          <p className="text-xs sm:text-sm text-mystery-400 mb-2 truncate">
                            Case: <span className="text-white">{selectedMessage.case.title}</span>
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="truncate">{new Date(selectedMessage.created_at).toLocaleString('en-US')}</span>
                          </div>
                          {selectedMessage.read_at && (
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Read: </span>
                              <span className="truncate">{new Date(selectedMessage.read_at).toLocaleString('en-US')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteMessage(selectedMessage.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-mystery-700 rounded-lg transition-colors flex-shrink-0"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                {/* Message Content */}
                <div className="p-4 sm:p-6">
                  <div className="bg-mystery-900 rounded-lg p-4 sm:p-6 border border-mystery-700">
                    <p className="text-sm sm:text-base text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                      {selectedMessage.content}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6">
                    {activeTab !== 'sent' && !selectedMessage.read_at && (
                      <button
                        onClick={() => handleMarkAsRead(selectedMessage.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors text-sm sm:text-base"
                      >
                        <Eye className="w-4 h-4" />
                        Mark as Read
                      </button>
                    )}
                    {activeTab !== 'sent' && (
                      <button
                        onClick={() => {
                          if (selectedMessage.sender?.username) {
                            setReplyToUser({
                              id: selectedMessage.sender_id,
                              username: selectedMessage.sender.username
                            });
                            setShowReplyModal(true);
                          }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm sm:text-base"
                      >
                        <Reply className="w-4 h-4" />
                        Reply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-12 text-center">
                <Mail className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Select a message from the left to read it</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      {replyToUser && (
        <DirectMessageModal
          isOpen={showReplyModal}
          onClose={() => {
            setShowReplyModal(false);
            setReplyToUser(null);
          }}
          recipientId={replyToUser.id}
          recipientName={replyToUser.username}
          onMessageSent={() => {
            loadAllMessages();
            loadSentMessages();
            loadAllNotifications();
          }}
        />
      )}
    </div>
  );
};
