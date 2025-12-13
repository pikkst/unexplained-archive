import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { sendDirectMessage } from '../services/notificationService';

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  onMessageSent?: () => void;
}

export const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  onMessageSent
}) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim() || !user) return;

    setSending(true);
    try {
      const result = await sendDirectMessage(recipientId, message.trim());
      
      if (result.success) {
        setMessage('');
        onClose();
        if (onMessageSent) {
          onMessageSent();
        }
        alert(`Message sent successfully to ${recipientName}!`);
      } else {
        alert(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-mystery-800 rounded-lg border border-mystery-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mystery-700">
          <div>
            <h2 className="text-xl font-bold text-white">Send Message</h2>
            <p className="text-sm text-gray-400 mt-1">To: {recipientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-mystery-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Message Input */}
        <div className="flex-1 p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Write your message..."
            className="w-full h-40 bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-mystery-500 resize-none"
            disabled={sending}
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-mystery-700 bg-mystery-900/50">
          <p className="text-sm text-gray-400">
            Recipient will receive a notification
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
