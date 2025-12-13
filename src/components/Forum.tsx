import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Pin, Clock, PlusCircle } from 'lucide-react';
import { ForumService, ForumThread } from '../services/forumService';
import { CreateForumThreadModal } from './CreateForumThreadModal';

const Forum: React.FC = () => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stats, setStats] = useState({ totalThreads: 0, totalPosts: 0, online: 0 });

  useEffect(() => {
    loadThreads();
    loadStats();

    // Subscribe to online users
    const unsubscribe = ForumService.subscribeToOnlineUsers((count) => {
      setStats(prev => ({ ...prev, online: count }));
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategory]);

  const loadStats = async () => {
    try {
      const data = await ForumService.getStats();
      setStats(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadThreads = async () => {
    try {
      setLoading(true);
      const data = await ForumService.getThreads(selectedCategory);
      setThreads(data);
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThreadCreated = () => {
    setShowCreateModal(false);
    loadThreads();
  };
  
  const categories = ['ALL', 'GENERAL', 'CASE_DISCUSSION', 'TECHNICAL', 'ANNOUNCEMENTS'];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 text-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Forum</h1>
          <div className="flex gap-4 mt-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <MessageSquare size={14} /> {stats.totalThreads} Threads
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} /> {stats.online} Online
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-mystery-500 hover:bg-mystery-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-mystery-500/25 transition-all"
        >
          <PlusCircle size={20} />
          New Thread
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-mystery-500 text-white'
                : 'bg-mystery-800 text-gray-300 hover:bg-mystery-700'
            }`}
          >
            {category.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading threads...</div>
      ) : (
        <div className="space-y-4">
          {threads.map(thread => (
            <div 
              key={thread.id} 
              onClick={() => navigate(`/forum/${thread.id}`)}
              className="bg-mystery-800 border border-mystery-700 rounded-lg p-4 shadow-md transition-shadow hover:shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {thread.title}
                  </h3>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Users size={16} />
                      <span 
                        className="hover:text-blue-400 cursor-pointer transition-colors"
                        onClick={(e) => { e.stopPropagation(); if (thread.user?.username) navigate(`/profile/${thread.user.username}`); }}
                      >{thread.user?.username || 'Anonymous'}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageSquare size={16} />
                      {thread.replies} replies
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={16} />
                      {new Date(thread.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {thread.is_pinned && (
                  <Pin size={20} className="text-yellow-400 flex-shrink-0 ml-4" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateForumThreadModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onThreadCreated={handleThreadCreated}
        />
      )}
    </div>
  );
};

export default Forum;
