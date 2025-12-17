import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Calendar, User, Eye, ThumbsUp, Share2, ArrowLeft } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  content: string;
  seo_keywords: string;
  slug: string;
  created_at: string;
  updated_at: string;
  views: number;
  likes: number;
}

export const ArticleDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [slug]);

  const loadArticle = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      
      // Fetch article by slug
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;

      setArticle(data);

      // Increment view count
      await supabase
        .from('blog_articles')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', data.id);

    } catch (error) {
      console.error('Failed to load article:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!article || liked) return;

    try {
      const newLikes = (article.likes || 0) + 1;
      const { error } = await supabase
        .from('blog_articles')
        .update({ likes: newLikes })
        .eq('id', article.id);

      if (error) throw error;

      setArticle({ ...article, likes: newLikes });
      setLiked(true);
    } catch (error) {
      console.error('Failed to like article:', error);
    }
  };

  const handleShareOnFacebook = () => {
    if (!article) return;
    const articleUrl = `${window.location.origin}/articles/${article.slug}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
    window.open(facebookShareUrl, '_blank', 'width=600,height=400');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center p-8 bg-mystery-800 rounded-lg border border-mystery-700">
          <h2 className="text-2xl font-bold text-white mb-4">Article Not Found</h2>
          <p className="text-gray-400 mb-6">The article you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-mystery-500 hover:bg-mystery-600 text-white rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mystery-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Article Content */}
        <article className="bg-mystery-800 rounded-lg border border-mystery-700 overflow-hidden">
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-mystery-700">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {article.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(article.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{article.views || 0} views</span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" />
                <span>{article.likes || 0} likes</span>
              </div>
            </div>

            {/* Keywords */}
            {article.seo_keywords && (
              <div className="flex flex-wrap gap-2 mt-4">
                {article.seo_keywords.split(',').map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-mystery-700 text-xs text-gray-300 rounded-full"
                  >
                    {keyword.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            <div className="prose prose-invert max-w-none">
              <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {article.content}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 md:p-8 border-t border-mystery-700 flex flex-wrap gap-4">
            <button
              onClick={handleLike}
              disabled={liked}
              className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                liked
                  ? 'bg-mystery-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              {liked ? 'Liked' : 'Like'}
            </button>

            <button
              onClick={handleShareOnFacebook}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share on Facebook
            </button>
          </div>
        </article>
      </div>
    </div>
  );
};
