import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { ForumService } from '../services/forumService';

interface CreateForumThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThreadCreated: () => void;
}

export const CreateForumThreadModal: React.FC<CreateForumThreadModalProps> = ({
  isOpen,
  onClose,
  onThreadCreated
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Please fill in both title and content');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ForumService.createThread(formData);
      onThreadCreated();
      setFormData({ title: '', content: '', category: 'GENERAL' });
    } catch (error: any) {
      setError(error.message || 'Failed to create thread');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-mystery-800 w-full max-w-2xl rounded-xl border border-mystery-600 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 bg-mystery-900 border-b border-mystery-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="text-mystery-accent" />
            Start New Discussion
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Thread Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
              placeholder="What's your discussion about?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none"
            >
              <option value="GENERAL">General Discussion</option>
              <option value="UFO">UFO / Aerial Phenomenon</option>
              <option value="CRYPTID">Cryptid (Bigfoot, etc.)</option>
              <option value="PARANORMAL">Paranormal / Ghost</option>
              <option value="EVIDENCE">Evidence Analysis</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Content
            </label>
            <textarea
              rows={8}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none resize-none"
              placeholder="Share your thoughts, theories, or questions..."
              required
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-mystery-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-mystery-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-mystery-500 hover:bg-mystery-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg shadow-mystery-500/25 transition-all"
            >
              {loading ? 'Creating...' : 'Create Thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
