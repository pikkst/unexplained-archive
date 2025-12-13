import { supabase } from '../lib/supabase';

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  is_locked: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
  replies: number;
}

export interface ForumComment {
  id: string;
  thread_id: string;
  content: string;
  parent_id: string | null;
  likes: number;
  user_liked?: boolean;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
}

export class ForumService {
  static async getThreads(category?: string): Promise<ForumThread[]> {
    let query = supabase
      .from('forum_threads')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user:profiles!forum_threads_user_id_fkey (
          username,
          avatar_url
        ),
        replies:forum_posts(count)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data, error } = await query;

    if (error) throw error;

    return data?.map(item => ({
      id: item.id,
      title: item.title,
      content: '',
      category: 'general',
      is_pinned: false,
      is_locked: false,
      views: 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
      user: Array.isArray(item.user) ? item.user[0] : item.user,
      replies: Array.isArray(item.replies) ? item.replies[0]?.count || 0 : 0
    })) || [];
  }

  static async createThread(threadData: {
    title: string;
    content: string;
    category: string;
  }): Promise<ForumThread> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('forum_threads')
      .insert({
        user_id: user.id,
        title: threadData.title
      })
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user:profiles!forum_threads_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      content: '',
      category: 'general',
      is_pinned: false,
      is_locked: false,
      views: 0,
      user: Array.isArray(data.user) ? data.user[0] : data.user,
      replies: 0
    };
  }

  static async getThread(id: string): Promise<ForumThread | null> {
    const { data, error } = await supabase
      .from('forum_threads')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        user:profiles!forum_threads_user_id_fkey (
          username,
          avatar_url
        ),
        replies:forum_posts(count)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      ...data,
      content: '',
      category: 'general',
      is_pinned: false,
      is_locked: false,
      views: 0,
      user: Array.isArray(data.user) ? data.user[0] : data.user,
      replies: Array.isArray(data.replies) ? data.replies[0]?.count || 0 : 0
    };
  }

  static async incrementViews(id: string): Promise<void> {
    // Function does not exist in database - skipping view increment
    // TODO: Create increment_forum_thread_views function in database if needed
    return;
  }

  static async getComments(threadId: string): Promise<ForumComment[]> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('forum_posts')
      .select(`
        id,
        thread_id,
        body,
        parent_post_id,
        created_at,
        user:profiles!forum_posts_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get like counts and user likes for all posts
    const postIds = data?.map(item => item.id) || [];
    
    // Get like counts
    const { data: likesData } = await supabase
      .from('forum_post_likes')
      .select('post_id')
      .in('post_id', postIds);
    
    const likeCounts = (likesData || []).reduce((acc, like) => {
      acc[like.post_id] = (acc[like.post_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get user's likes if authenticated
    let userLikes: Set<string> = new Set();
    if (currentUser) {
      const { data: userLikesData } = await supabase
        .from('forum_post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', currentUser.id);
      
      userLikes = new Set((userLikesData || []).map(like => like.post_id));
    }

    return data?.map(item => ({
      id: item.id,
      thread_id: item.thread_id,
      content: item.body,
      parent_id: item.parent_post_id,
      likes: likeCounts[item.id] || 0,
      user_liked: userLikes.has(item.id),
      created_at: item.created_at,
      user: Array.isArray(item.user) ? item.user[0] : item.user
    })) || [];
  }

  static async createComment(threadId: string, content: string, parentId?: string): Promise<ForumComment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        thread_id: threadId,
        user_id: user.id,
        body: content,
        parent_post_id: parentId || null
      })
      .select(`
        id,
        thread_id,
        body,
        parent_post_id,
        likes,
        created_at,
        user:profiles!forum_posts_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      thread_id: data.thread_id,
      content: data.body,
      parent_id: data.parent_post_id,
      likes: data.likes || 0,
      created_at: data.created_at,
      user: Array.isArray(data.user) ? data.user[0] : data.user
    };
  }

  static async getStats(): Promise<{ totalThreads: number; totalPosts: number; online: number }> {
    const { count: threadsCount } = await supabase
      .from('forum_threads')
      .select('*', { count: 'exact', head: true });

    const { count: commentsCount } = await supabase
      .from('forum_posts')
      .select('*', { count: 'exact', head: true });

    return {
      totalThreads: threadsCount || 0,
      totalPosts: commentsCount || 0,
      online: 0 // Placeholder - see subscribeToOnlineUsers for real-time count
    };
  }

  static async toggleLike(commentId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('forum_post_likes')
      .select('id')
      .eq('post_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLike) {
      // Unlike
      const { error } = await supabase
        .from('forum_post_likes')
        .delete()
        .eq('post_id', commentId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    } else {
      // Like
      const { error } = await supabase
        .from('forum_post_likes')
        .insert({
          post_id: commentId,
          user_id: user.id
        });
      
      if (error) throw error;
    }
  }

  static async updateThread(id: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('forum_threads')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  static async updateComment(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('forum_posts')
      .update({ body: content, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  static async deleteComment(id: string): Promise<void> {
    const { error } = await supabase
      .from('forum_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static subscribeToOnlineUsers(callback: (count: number) => void) {
    const channel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        callback(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
