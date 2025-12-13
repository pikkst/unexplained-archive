import { supabase } from '../lib/supabase';

export const geminiProxyService = {
  async generateContent(prompt: string, imageUrl?: string) {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('User must be authenticated');
      }

      const response = await fetch(
        'https://plyyjvbemdsubmnvudvr.supabase.co/functions/v1/gemini-proxy',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt,
            imageUrl: imageUrl || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate content');
      }

      const result = await response.json();
      
      // Extract text from Gemini response
      if (result.candidates && result.candidates[0]?.content?.parts) {
        const text = result.candidates[0].content.parts
          .map((part: any) => part.text || '')
          .join('');
        return text;
      }
      
      return result;
    } catch (error) {
      console.error('Gemini proxy error:', error);
      throw error;
    }
  },

  async analyzeImage(imageUrl: string, prompt: string) {
    return this.generateContent(prompt, imageUrl);
  },

  async generateDescription(prompt: string) {
    return this.generateContent(prompt);
  },
};
