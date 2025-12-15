import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Globe, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { translationService } from '../services/translationService';
import { supabase } from '../lib/supabase';

interface Comment {
  id: string;
  user_id: string;
  case_id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
    role: string;
  };
  original_language?: string;
}

interface TranslatedComment extends Comment {
  translated_content?: string;
  is_translated?: boolean;
  detected_language?: string;
}

interface CaseCommentsProps {
  caseId: string;
}

export const CaseComments: React.FC<CaseCommentsProps> = ({ caseId }) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<TranslatedComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canTranslate, setCanTranslate] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [userLanguage, setUserLanguage] = useState('en');

  useEffect(() => {
    if (user) {
      checkTranslationPrivileges();
      loadUserLanguage();
    }
    loadComments();
  }, [caseId, user]);

  const checkTranslationPrivileges = async () => {
    if (!user) return;
    const hasAccess = await translationService.canUseTranslation(user.id);
    setCanTranslate(hasAccess);
  };

  const loadUserLanguage = async () => {
    if (!user) return;
    const lang = await translationService.getUserLanguage(user.id);
    setUserLanguage(lang);
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles (
            username,
            avatar_url,
            role
          )
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithTranslation = data as TranslatedComment[];
      
      // Auto-translate if enabled and user has access
      if (canTranslate && autoTranslate && userLanguage !== 'en') {
        await translateComments(commentsWithTranslation);
      } else {
        setComments(commentsWithTranslation);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const translateComments = async (commentsToTranslate: TranslatedComment[]) => {
    const translated = await Promise.all(
      commentsToTranslate.map(async (comment) => {
        try {
          const detectedLang = await translationService.detectLanguage(comment.content);
          
          // Skip translation if already in target language
          if (detectedLang === userLanguage) {
            return { ...comment, detected_language: detectedLang };
          }

          const translatedContent = await translationService.translate(
            comment.content,
            userLanguage,
            detectedLang
          );

          return {
            ...comment,
            translated_content: translatedContent,
            is_translated: true,
            detected_language: detectedLang
          };
        } catch (error) {
          console.error('Translation error:', error);
          return comment;
        }
      })
    );

    setComments(translated);
  };

  const toggleCommentTranslation = async (commentId: string) => {
    setTranslating({ ...translating, [commentId]: true });

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    try {
      if (comment.is_translated) {
        // Show original
        setComments(comments.map(c => 
          c.id === commentId ? { ...c, is_translated: false } : c
        ));
      } else {
        // Translate
        const detectedLang = await translationService.detectLanguage(comment.content);
        const translatedContent = await translationService.translate(
          comment.content,
          userLanguage,
          detectedLang
        );

        setComments(comments.map(c => 
          c.id === commentId 
            ? { ...c, translated_content: translatedContent, is_translated: true, detected_language: detectedLang }
            : c
        ));
      }
    } finally {
      setTranslating({ ...translating, [commentId]: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);

    try {
      // Detect language of comment
      const detectedLang = await translationService.detectLanguage(newComment);

      const { error } = await supabase.from('comments').insert({
        case_id: caseId,
        user_id: user.id,
        content: newComment,
        original_language: detectedLang
      });

      if (error) throw error;

      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const getLanguageFlag = (langCode: string): string => {
    const flags: Record<string, string> = {
      en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹',
      pt: '🇵🇹', ru: '🇷🇺', ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷',
      ar: '🇸🇦', hi: '🇮🇳', et: '🇪🇪', fi: '🇫🇮', sv: '🇸🇪',
      no: '🇳🇴', da: '🇩🇰', nl: '🇳🇱', pl: '🇵🇱', cs: '🇨🇿'
    };
    return flags[langCode] || '🌐';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-mystery-500" />
      </div>
    );
  }

  return (
    <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments ({comments.length})
        </h3>
        
        {canTranslate && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoTranslate}
              onChange={(e) => {
                setAutoTranslate(e.target.checked);
                if (e.target.checked) {
                  loadComments();
                }
              }}
              className="w-4 h-4 rounded bg-mystery-900 border-mystery-700 text-mystery-500"
            />
            <span className="text-sm text-gray-400">
              <Globe className="w-4 h-4 inline mr-1" />
              Auto-translate
            </span>
          </label>
        )}
      </div>

      {/* Comments List */}
      <div className="space-y-4 mb-6">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-mystery-900 rounded-lg p-4 border border-mystery-700">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {comment.profiles.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt={comment.profiles.username} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-white font-bold">{comment.profiles.username[0].toUpperCase()}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{comment.profiles.username}</span>
                    {comment.profiles.role === 'admin' && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Admin</span>
                    )}
                    {comment.profiles.role === 'investigator' && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Investigator</span>
                    )}
                    {comment.detected_language && (
                      <span className="text-xs">{getLanguageFlag(comment.detected_language)}</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-gray-300 whitespace-pre-wrap">
                    {comment.is_translated ? comment.translated_content : comment.content}
                  </p>
                  
                  {canTranslate && comment.detected_language !== userLanguage && (
                    <button
                      onClick={() => toggleCommentTranslation(comment.id)}
                      disabled={translating[comment.id]}
                      className="mt-2 text-xs text-mystery-400 hover:text-mystery-300 flex items-center gap-1"
                    >
                      {translating[comment.id] ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Translating...
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3" />
                          {comment.is_translated ? 'Show original' : 'Translate'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="border-t border-mystery-700 pt-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... (any language)"
            rows={3}
            className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 focus:border-transparent outline-none resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Post Comment
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-gray-500 text-center py-4 border-t border-mystery-700">
          Please sign in to comment
        </p>
      )}
    </div>
  );
};
