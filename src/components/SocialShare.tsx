import React from 'react';
import { Facebook, Twitter, Linkedin, Mail, Link as LinkIcon, Check } from 'lucide-react';

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

export const SocialShare: React.FC<SocialShareProps> = ({
  url = window.location.href,
  title = 'Check out Unexplained Archive',
  description = 'Explore mysterious cases and unexplained phenomena',
  compact = false
}) => {
  const [copied, setCopied] = React.useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const link = shareLinks[platform];
    window.open(link, '_blank', 'width=600,height=400');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleShare('facebook')}
          className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors"
          title="Share on Facebook"
        >
          <Facebook className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleShare('twitter')}
          className="p-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 rounded-lg transition-colors"
          title="Share on Twitter"
        >
          <Twitter className="w-4 h-4" />
        </button>
        <button
          onClick={handleCopyLink}
          className="p-2 bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 rounded-lg transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <LinkIcon className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-400">Share this:</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleShare('facebook')}
          className="flex items-center gap-3 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg transition-colors group"
        >
          <Facebook className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-blue-300">Facebook</span>
        </button>

        <button
          onClick={() => handleShare('twitter')}
          className="flex items-center gap-3 px-4 py-3 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-600/30 rounded-lg transition-colors group"
        >
          <Twitter className="w-5 h-5 text-sky-400" />
          <span className="text-sm font-medium text-sky-300">Twitter</span>
        </button>

        <button
          onClick={() => handleShare('linkedin')}
          className="flex items-center gap-3 px-4 py-3 bg-blue-700/20 hover:bg-blue-700/30 border border-blue-700/30 rounded-lg transition-colors group"
        >
          <Linkedin className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-blue-300">LinkedIn</span>
        </button>

        <button
          onClick={() => handleShare('email')}
          className="flex items-center gap-3 px-4 py-3 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-600/30 rounded-lg transition-colors group"
        >
          <Mail className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Email</span>
        </button>
      </div>

      <div className="pt-3 border-t border-mystery-700">
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-mystery-800 hover:bg-mystery-700 border border-mystery-600 rounded-lg transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-green-400">Link copied!</span>
            </>
          ) : (
            <>
              <LinkIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Copy Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
