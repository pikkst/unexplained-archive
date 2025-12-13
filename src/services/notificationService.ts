/**
 * NOTIFICATION & MESSAGING SERVICE
 * Handles case following, notifications, and private messages
 */

import { supabase } from '../lib/supabase';

// ========================================
// TYPES
// ========================================

export interface Notification {
  id: string;
  user_id?: string;
  case_id?: string;
  type: 'case_update' | 'new_message' | 'dispute_created' | 'resolution_submitted' | 'vote_started' | 'escrow_released' | 'new_comment' | 'case_follow_confirm';
  title: string;
  message: string;
  action_url?: string;
  read_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  case_id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  content: string;
  attachment_url?: string;
  read_at?: string;
  created_at: string;
}

export interface CaseFollower {
  id: string;
  case_id: string;
  user_id?: string;
  guest_email?: string;
  notify_on_update: boolean;
  notify_on_comments: boolean;
  notify_on_resolution: boolean;
  followed_at: string;
}

// ========================================
// NOTIFICATIONS
// ========================================

/**
 * Get all notifications for current user (unread first)
 */
export const getNotifications = async (userId: string, limit = 50): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('read_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count || 0;
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (notificationId: string, userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
    p_user_id: userId
  });

  if (error) throw error;
  return data;
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async (userId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('mark_all_notifications_read', {
    p_user_id: userId
  });

  if (error) throw error;
  return data || 0;
};

/**
 * Subscribe to real-time notifications
 */
export const subscribeToNotifications = (
  userId: string,
  callback: (notification: Notification) => void
) => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ========================================
// CASE FOLLOWING
// ========================================

/**
 * Follow a case (authenticated user)
 */
export const followCase = async (caseId: string, userId: string): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('follow_case', {
    p_case_id: caseId,
    p_user_id: userId
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Follow a case (guest via email)
 */
export const followCaseGuest = async (caseId: string, email: string): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('follow_case_guest', {
    p_case_id: caseId,
    p_guest_email: email
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Unfollow a case
 */
export const unfollowCase = async (
  caseId: string,
  userId?: string,
  guestEmail?: string
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('unfollow_case', {
    p_case_id: caseId,
    p_user_id: userId || null,
    p_guest_email: guestEmail || null
  });

  if (error) throw error;
  return data;
};

/**
 * Check if user is following a case
 */
export const isFollowingCase = async (caseId: string, userId?: string, guestEmail?: string): Promise<boolean> => {
  let query = supabase
    .from('case_followers')
    .select('case_id')
    .eq('case_id', caseId);

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (guestEmail) {
    query = query.eq('guest_email', guestEmail);
  } else {
    return false;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
  
  return !!data;
};

/**
 * Get follower count for a case
 */
export const getFollowerCount = async (caseId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('case_followers')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', caseId);

  if (error) throw error;
  return count || 0;
};

/**
 * Update follow preferences
 */
export const updateFollowPreferences = async (
  caseId: string,
  userId: string,
  preferences: {
    notify_on_update?: boolean;
    notify_on_comments?: boolean;
    notify_on_resolution?: boolean;
  }
): Promise<boolean> => {
  const { error } = await supabase
    .from('case_followers')
    .update(preferences)
    .eq('case_id', caseId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
};

// ========================================
// PRIVATE MESSAGING
// ========================================

/**
 * Send a private message about a case or direct message
 */
export const sendMessage = async (
  caseId: string | null,
  senderId: string,
  recipientId: string,
  content: string,
  attachmentUrl?: string
): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('send_message', {
    p_case_id: caseId,
    p_sender_id: senderId,
    p_recipient_id: recipientId,
    p_content: content,
    p_attachment_url: attachmentUrl || null
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Send a direct message (not case-related)
 */
export const sendDirectMessage = async (
  recipientId: string,
  content: string
): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('send_message', {
    p_case_id: null,
    p_sender_id: null, // Will use auth.uid()
    p_recipient_id: recipientId,
    p_content: content,
    p_attachment_url: null
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Get messages for a case (conversation)
 */
export const getCaseMessages = async (caseId: string, userId: string): Promise<Message[]> => {
  const { data, error } = await supabase.rpc('get_case_messages', {
    p_case_id: caseId,
    p_user_id: userId
  });

  if (error) throw error;
  return data || [];
};

/**
 * Mark message as read
 */
export const markMessageRead = async (messageId: string, userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('mark_message_read', {
    p_message_id: messageId,
    p_user_id: userId
  });

  if (error) throw error;
  return data;
};

/**
 * Get unread message count for user
 */
export const getUnreadMessageCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count || 0;
};

/**
 * Subscribe to real-time messages for a case
 */
export const subscribeToMessages = (
  caseId: string,
  callback: (message: Message) => void
) => {
  const channel = supabase
    .channel(`messages:${caseId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `case_id=eq.${caseId}`
      },
      async (payload) => {
        // Fetch sender name
        const { data: sender } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', payload.new.sender_id)
          .single();

        callback({
          ...payload.new,
          sender_name: sender?.username || 'Unknown'
        } as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Get all conversations for a user (list of cases with messages)
 */
export const getUserConversations = async (userId: string) => {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      case_id,
      cases:case_id (
        id,
        title,
        status
      ),
      created_at
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Deduplicate by case_id (only get latest message per case)
  const uniqueCases = new Map();
  data?.forEach((msg: any) => {
    if (!uniqueCases.has(msg.case_id)) {
      uniqueCases.set(msg.case_id, msg.cases);
    }
  });

  return Array.from(uniqueCases.values());
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Create manual notification (for admin actions, etc.)
 */
export const createNotification = async (
  userId: string,
  caseId: string,
  type: Notification['type'],
  title: string,
  message: string,
  actionUrl?: string
): Promise<string> => {
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_case_id: caseId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_action_url: actionUrl || null
  });

  if (error) throw error;
  return data;
};

/**
 * Get notification preferences for a case follower
 */
export const getFollowPreferences = async (
  caseId: string,
  userId: string
): Promise<CaseFollower | null> => {
  const { data, error } = await supabase
    .from('case_followers')
    .select('*')
    .eq('case_id', caseId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};
