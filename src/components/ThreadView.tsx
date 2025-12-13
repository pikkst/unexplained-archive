import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Clock, Send, ThumbsUp, Reply, Edit2, Trash2, X, Check } from 'lucide-react';
import { ForumService, ForumThread, ForumComment } from '../services/forumService';
import { useAuth } from '../contexts/AuthContext';

const ThreadView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (id) {
      loadThread();
      loadComments();
    }
  }, [id]);

  const loadThread = async () => {
    if (!id) return;
    try {
      const data = await ForumService.getThread(id);
      setThread(data);
      // Increment views
      await ForumService.incrementViews(id);
    } catch (error) {
      console.error('Error loading thread:', error);
    }
  };

  const loadComments = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await ForumService.getComments(id);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim() || !user) return;

    try {
      setSubmitting(true);
      await ForumService.createComment(id, newComment.trim(), replyToId || undefined);
      setNewComment('');
      setReplyToId(null);
      await loadComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      alert('Please sign in to like comments');
      return;
    }
    try {
      await ForumService.toggleLike(commentId);
      await loadComments();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      await ForumService.updateComment(commentId, editContent.trim());
      setEditingId(null);
      setEditContent('');
      await loadComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await ForumService.deleteComment(commentId);
      await loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  const startEdit = (comment: ForumComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const getCommentUser = (comment: ForumComment) => {
    return comment.user?.username || 'Anonymous';
  };

  const isCommentOwner = (comment: ForumComment) => {
    return user && comment.user?.username === user.email?.split('@')[0];
  };

  if (!thread && !loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-400">Thread not found</p>
        <button
          onClick={() => navigate('/forum')}
          className="mt-4 text-mystery-400 hover:text-mystery-300"
        >
          Back to Forum
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 text-gray-100">
      <button
        onClick={() => navigate('/forum')}
        className="flex items-center gap-2 text-mystery-400 hover:text-mystery-300 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Forum
      </button>

      {thread && (
        <>
          <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-white mb-4">{thread.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
              <span
                className="hover:text-blue-400 cursor-pointer transition-colors"
                onClick={() => thread.user?.username && navigate(`/profile/${thread.user.username}`)}
              >
                {thread.user?.username || 'Anonymous'}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {new Date(thread.created_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare size={14} />
                {thread.replies} replies
              </span>
            </div>
            {thread.content && (
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 whitespace-pre-wrap">{thread.content}</p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Comments ({comments.length})
            </h2>
            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map(comment => (
                  <div
                    key={comment.id}
                    className={`bg-mystery-800 border border-mystery-700 rounded-lg p-4 ${
                      comment.parent_id ? 'ml-8 border-l-2 border-l-mystery-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="font-medium text-white hover:text-blue-400 cursor-pointer transition-colors"
                          onClick={() => comment.user?.username && navigate(`/profile/${comment.user.username}`)}
                        >
                          {getCommentUser(comment)}
                        </span>
                        <span className="text-sm text-gray-400">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      {isCommentOwner(comment) && editingId !== comment.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(comment)}
                            className="text-gray-400 hover:text-blue-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {editingId === comment.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-mystery-500 min-h-[80px] resize-y"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditComment(comment.id)}
                            className="bg-mystery-500 hover:bg-mystery-400 text-white px-3 py-1 rounded flex items-center gap-1 text-sm"
                          >
                            <Check size={14} />
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="bg-mystery-700 hover:bg-mystery-600 text-white px-3 py-1 rounded flex items-center gap-1 text-sm"
                          >
                            <X size={14} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-300 whitespace-pre-wrap mb-3">{comment.content}</p>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className={`flex items-center gap-1 text-sm transition-colors ${
                              comment.user_liked 
                                ? 'text-mystery-400' 
                                : 'text-gray-400 hover:text-mystery-400'
                            }`}
                            title={comment.user_liked ? 'Unlike' : 'Like'}
                          >
                            <ThumbsUp size={16} fill={comment.user_liked ? 'currentColor' : 'none'} />
                            <span>{comment.likes}</span>
                          </button>
                          {user && (
                            <button
                              onClick={() => setReplyToId(comment.id)}
                              className="flex items-center gap-1 text-sm text-gray-400 hover:text-mystery-400 transition-colors"
                            >
                              <Reply size={16} />
                              Reply
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <form onSubmit={handleSubmitComment} className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
              {replyToId && (
                <div className="mb-3 flex items-center justify-between bg-mystery-900 p-2 rounded">
                  <span className="text-sm text-gray-400">
                    Replying to comment
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyToId(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyToId ? "Write a reply..." : "Write a comment..."}
                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-mystery-500 min-h-[100px] resize-y"
                disabled={submitting}
              />
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className="bg-mystery-500 hover:bg-mystery-400 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Send size={18} />
                  {submitting ? 'Posting...' : replyToId ? 'Post Reply' : 'Post Comment'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-6 text-center">
              <p className="text-gray-400 mb-4">Please sign in to comment</p>
              <button
                onClick={() => navigate('/login')}
                className="bg-mystery-500 hover:bg-mystery-400 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ThreadView;
