import { supabase } from '../lib/supabase';

interface TranslationCache {
  [key: string]: string;
}

class TranslationService {
  private cache: TranslationCache = {};
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  // Generate cache key
  private getCacheKey(text: string, targetLang: string): string {
    return `${text.substring(0, 50)}_${targetLang}`;
  }

  // Detect language of text
  async detectLanguage(text: string): Promise<string> {
    if (!this.apiKey) return 'en';

    try {
      // Use x-goog-api-key header as per Gemini API docs
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Detect the language of this text and respond with ONLY the two-letter ISO 639-1 code (e.g., en, es, fr, de, ja, zh, ru, et). Text: "${text.substring(0, 200)}"`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 10
            }
          })
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Language detection API error:', data);
        return 'en';
      }

      const langCode = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
      return langCode || 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en';
    }
  }

  // Translate text to target language
  async translate(text: string, targetLang: string = 'en', sourceLang?: string): Promise<string> {
    if (!text || text.trim().length === 0) return text;
    if (!this.apiKey) {
      console.warn('Translation API not configured');
      return text;
    }

    // Check cache
    const cacheKey = this.getCacheKey(text, targetLang);
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }

    try {
      const langNames: Record<string, string> = {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        it: 'Italian',
        pt: 'Portuguese',
        ru: 'Russian',
        ja: 'Japanese',
        zh: 'Chinese',
        ko: 'Korean',
        ar: 'Arabic',
        hi: 'Hindi',
        et: 'Estonian',
        fi: 'Finnish',
        sv: 'Swedish',
        no: 'Norwegian',
        da: 'Danish',
        nl: 'Dutch',
        pl: 'Polish',
        cs: 'Czech',
        hu: 'Hungarian',
        ro: 'Romanian',
        tr: 'Turkish',
        el: 'Greek',
        he: 'Hebrew',
        th: 'Thai',
        vi: 'Vietnamese',
        id: 'Indonesian',
        ms: 'Malay',
        tl: 'Tagalog'
      };

      const targetLanguage = langNames[targetLang] || 'English';
      const sourceHint = sourceLang && langNames[sourceLang] 
        ? `from ${langNames[sourceLang]} ` 
        : '';

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following text ${sourceHint}to ${targetLanguage}. Preserve formatting, tone, and specific details. Only provide the translation without explanations:\n\n${text}`
              }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Translation failed:', errorData);
        return text;
      }

      const data = await response.json();
      const translated = data.candidates[0]?.content?.parts[0]?.text?.trim();
      
      if (translated) {
        this.cache[cacheKey] = translated;
        return translated;
      }

      return text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }

  // Batch translate multiple texts
  async batchTranslate(texts: string[], targetLang: string = 'en'): Promise<string[]> {
    const translations = await Promise.all(
      texts.map(text => this.translate(text, targetLang))
    );
    return translations;
  }

  // Check if user has translation privileges
  async canUseTranslation(userId: string): Promise<boolean> {
    try {
      // Check user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      // Admins and investigators with subscription can use translation
      if (profile?.role === 'admin') return true;
      if (profile?.role === 'investigator') {
        // Check if investigator has active subscription
        const { count, error } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active');
        
        if (error) {
            console.error("Error checking subscription for translation", error);
            return false;
        }

        return (count || 0) > 0;
      }

      return false;
    } catch (error) {
      console.error('Error checking translation privileges:', error);
      return false;
    }
  }

  // Track translation usage for analytics
  async trackTranslation(userId: string, fromLang: string, toLang: string, charCount: number) {
    try {
      await supabase.from('ai_usage').insert({
        user_id: userId,
        feature: 'translation',
        cost: 0, // FREE for investigators/admins
        metadata: {
          from_language: fromLang,
          to_language: toLang,
          character_count: charCount
        }
      });
    } catch (error) {
      console.error('Error tracking translation:', error);
    }
  }

  // Get user's preferred language
  async getUserLanguage(userId: string): Promise<string> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .single();

      return profile?.preferred_language || 'en';
    } catch (error) {
      console.error('Error getting user language:', error);
      return 'en';
    }
  }

  // Set user's preferred language
  async setUserLanguage(userId: string, language: string): Promise<void> {
    try {
      await supabase
        .from('profiles')
        .update({ preferred_language: language })
        .eq('id', userId);
    } catch (error) {
      console.error('Error setting user language:', error);
    }
  }
}

export const translationService = new TranslationService();
