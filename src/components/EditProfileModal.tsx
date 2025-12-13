import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, User as UserIcon, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { translationService } from '../services/translationService';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, user, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    website: profile?.website || '',
    theme_color: (profile as any)?.custom_profile_theme?.primaryColor || '#3b82f6', // Default blue
  });
  
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load preferred language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      if (user) {
        const lang = await translationService.getUserLanguage(user.id);
        setPreferredLanguage(lang);
      }
    };
    loadLanguage();
  }, [user]);

  if (!isOpen) return null;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;

    try {
      setUploading(true);
      
      // Create unique filename
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('media')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError('Failed to upload image');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSuccess(false);

    try {
      // Upload avatar if selected
      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        } else {
          throw new Error('Failed to upload avatar');
        }
      }

      // Update profile
      const { theme_color, ...profileData } = formData;
      
      const updates: any = {
        ...profileData,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      // Add custom theme if pro member
      if ((profile as any)?.is_pro_member) {
        updates.custom_profile_theme = {
          primaryColor: theme_color,
          secondaryColor: '#1e293b' // Default dark
        };
      }

      const { error: updateError } = await updateProfile(updates);

      if (updateError) throw updateError;

      // Save preferred language
      if (user) {
        await translationService.setUserLanguage(user.id, preferredLanguage);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-mystery-800 rounded-2xl border border-mystery-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-mystery-700">
          <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-mystery-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Avatar Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Profile Picture
            </label>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-12 h-12 text-gray-500" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {avatarFile ? 'Change Image' : 'Upload Image'}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white focus:outline-none focus:border-mystery-500"
              required
            />
          </div>

          {/* Full Name */}
          <div className="mb-4">
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white focus:outline-none focus:border-mystery-500"
            />
          </div>

          {/* Bio */}
          <div className="mb-4">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white focus:outline-none focus:border-mystery-500 resize-none"
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.bio.length}/500 characters
            </p>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white focus:outline-none focus:border-mystery-500"
              placeholder="City, Country"
            />
          </div>

          {/* Website */}
          <div className="mb-6">
            <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-2">
              Website
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white focus:outline-none focus:border-mystery-500"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Pro Member Theme Customization */}
          {(profile as any)?.is_pro_member && (
            <div className="mb-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Pro Profile Theme
              </h3>
              <div>
                <label htmlFor="theme_color" className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Profile Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="theme_color"
                    name="theme_color"
                    value={(formData as any).theme_color}
                    onChange={handleChange}
                    className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-gray-400 text-sm">{(formData as any).theme_color}</span>
                </div>
              </div>
            </div>
          )}

          {/* Preferred Language */}
          <div className="mb-6">
            <label htmlFor="preferredLanguage" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Preferred Language
            </label>
            <select
              id="preferredLanguage"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white focus:outline-none focus:border-mystery-500"
            >
              <option value="en">English</option>
              <option value="et">Estonian (Eesti)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="de">German (Deutsch)</option>
              <option value="ru">Russian (Русский)</option>
              <option value="zh">Chinese (中文)</option>
              <option value="ja">Japanese (日本語)</option>
              <option value="ar">Arabic (العربية)</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="pt">Portuguese (Português)</option>
              <option value="it">Italian (Italiano)</option>
              <option value="ko">Korean (한국어)</option>
              <option value="tr">Turkish (Türkçe)</option>
              <option value="pl">Polish (Polski)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This will be used as your default language for translations
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-800 rounded-lg text-green-400 text-sm">
              Profile updated successfully!
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors"
              disabled={saving || uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(saving || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
