import React, { useEffect, useState } from 'react';
import { Send, Paperclip, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getCaseMessages, 
  sendMessage, 
  markMessageRead, 
  subscribeToMessages,
  Message 
} from '../services/notificationService';

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseTitle: string;
  recipientId: string;
  recipientName: string;
}

export const MessagesModal: React.FC<MessagesModalProps> = ({
  isOpen,
  onClose,
  caseId,
  caseTitle,
  recipientId,
  recipientName
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadMessages();
      
      // Subscribe to real-time messages
      const unsubscribe = subscribeToMessages(caseId, (message) => {
        setMessages(prev => [...prev, message]);
        
        // Mark as read if it's for me
        if (message.recipient_id === user.id) {
          markMessageRead(message.id, user.id);
        }
      });

      return () => unsubscribe();
    }
  }, [isOpen, caseId, user]);

  const loadMessages = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await getCaseMessages(caseId, user.id);
      setMessages(data);
      
      // Mark all received messages as read
      data.forEach((msg) => {
        if (msg.recipient_id === user.id && !msg.read_at) {
          markMessageRead(msg.id, user.id);
        }
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      const result = await sendMessage(caseId, user.id, recipientId, newMessage);
      
      if (result.success) {
        setNewMessage('');
        // Message will appear via real-time subscription
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-mystery-900 rounded-xl border border-mystery-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mystery-700">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              Message with {recipientName}
            </h3>
            <p className="text-sm text-gray-400">About: {caseTitle}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-center text-gray-400">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isMe
                        ? 'bg-blue-600 text-white'
                        : 'bg-mystery-800 text-gray-200'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-xs font-bold mb-1 text-blue-400">
                        {msg.sender_name}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.attachment_url && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline mt-2 block"
                      >
                        View Attachment
                      </a>
                    )}
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-mystery-700 p-4">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              rows={3}
              className="flex-1 bg-mystery-800 text-white rounded-lg p-3 border border-mystery-700 focus:border-blue-500 focus:outline-none resize-none"
              disabled={sending}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
              <button
                className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                title="Attach file (coming soon)"
                disabled
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Private messages are only visible to you and {recipientName}
          </p>
        </div>
      </div>
    </div>
  );
};

// ========================================
// MESSAGE INBOX COMPONENT (For Navbar)
// ========================================

interface ConversationPreview {
  case_id: string;
  case_title: string;
  case_status: string;
  last_message_at: string;
  unread_count: number;
}

export const MessageInbox: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  const loadConversations = async () => {
    // This would be a custom query to get conversation previews
    // For now, just a placeholder
    setLoading(false);
  };

  return (
    <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-4 max-w-md">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Your Conversations
      </h3>
      
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : conversations.length === 0 ? (
        <p className="text-gray-400 text-sm">No messages yet</p>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.case_id}
              className="p-3 bg-mystery-900 rounded border border-mystery-700 hover:border-blue-500 cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white font-medium text-sm">{conv.case_title}</p>
                  <p className="text-xs text-gray-400">{conv.case_status}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Last message: {new Date(conv.last_message_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
