import { supabase } from '../lib/supabase';

export interface AIAnalysisResult {
  analysis: string;
  confidence: number;
  keyFindings: string[];
  suggestedActions: string[];
  relatedCases?: string[];
}

export interface ImageAnalysisResult extends AIAnalysisResult {
  detectedObjects: string[];
  anomalies: string[];
  metadata: {
    lighting: string;
    quality: string;
    timestamp?: string;
  };
}

export interface TextAnalysisResult extends AIAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  entities: string[];
}

export const aiToolsService = {
  /**
   * Analyze case image using Gemini Vision API
   * Detects objects, anomalies, and provides investigative insights
   */
  async analyzeImage(imageUrl: string, caseContext?: string): Promise<ImageAnalysisResult> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'analyze-image',
          imageUrl,
          caseContext
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Image analysis error:', error);
      throw error;
    }
  },

  /**
   * Analyze case description and witness testimonies
   * Extracts key information and identifies patterns
   */
  async analyzeText(text: string, analysisType: 'case' | 'testimony' | 'comment'): Promise<TextAnalysisResult> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'analyze-text',
          text,
          analysisType
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Text analysis error:', error);
      throw error;
    }
  },

  /**
   * Find similar cases based on description and category
   * Uses semantic search with embeddings
   */
  async findSimilarCases(caseId: string, limit = 5): Promise<any[]> {
    try {
      // Get current case details
      const { data: currentCase } = await supabase
        .from('cases')
        .select('title, description, category')
        .eq('id', caseId)
        .single();

      if (!currentCase) return [];

      // Simple keyword-based similarity (can be upgraded to vector embeddings)
      // This part is kept client-side/DB-side as it doesn't strictly require AI API key
      // unless we want to generate embeddings on the fly.
      // For now, we'll keep the basic implementation but could move to Edge Function if we add embeddings.
      
      const { data: similarCases } = await supabase
        .from('cases')
        .select('id, title, category, status, created_at')
        .eq('category', currentCase.category)
        .neq('id', caseId)
        .limit(limit);

      return similarCases || [];
    } catch (error) {
      console.error('Similar cases search error:', error);
      return [];
    }
  },

  /**
   * Generate investigative report summary
   * Combines all case data into structured report
   */
  async generateReport(caseId: string): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'generate-report',
          caseId
        }
      });

      if (error) throw error;
      return data.report;
    } catch (error) {
      console.error('Report generation error:', error);
      throw error;
    }
  },

  /**
   * Verify image authenticity
   * Checks for manipulation artifacts
   */
  async verifyImageAuthenticity(imageUrl: string): Promise<{
    authentic: boolean;
    confidence: number;
    issues: string[];
    analysis: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'verify-image',
          imageUrl
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Authenticity verification error:', error);
      throw error;
    }
  },

  /**
   * Extract timeline from case description and comments
   * Creates chronological event list
   */
  async extractTimeline(caseId: string): Promise<Array<{ time: string; event: string }>> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'extract-timeline',
          caseId
        }
      });

      if (error) throw error;
      return data.timeline || [];
    } catch (error) {
      console.error('Timeline extraction error:', error);
      return [];
    }
  },

  /**
   * Extract text from image using OCR
   * Useful for reading signs, documents, license plates, etc.
   */
  async extractTextFromImage(imageUrl: string): Promise<{
    extractedText: string[];
    textLocations: string[];
    languages: string[];
    translations?: Record<string, string>;
    confidence: number;
    notes?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'extract-text-ocr',
          imageUrl
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw error;
    }
  },

  /**
   * Analyze geographic location and environmental context
   * Provides insights about the location where incident occurred
   */
  async analyzeLocation(location: string, description: string, latitude?: number, longitude?: number): Promise<{
    coordinates?: string;
    terrain: string;
    weatherFactors: string[];
    visibility: string;
    accessibility: string;
    historicalContext: string;
    environmentalFactors: string[];
    suggestedSites: string[];
    localResources: string[];
    confidence: number;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'analyze-location',
          location,
          description,
          latitude,
          longitude
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Location analysis error:', error);
      throw error;
    }
  },

  /**
   * Verify consistency across multiple witness statements
   * Identifies contradictions and corroborating evidence
   */
  async verifyWitnessConsistency(caseId: string): Promise<{
    consistentDetails: string[];
    inconsistencies: Array<{ detail: string; sources: string[]; severity: string }>;
    uniqueInformation: Array<{ source: string; detail: string }>;
    timelineConsistency: string;
    credibilityScores: Record<string, number>;
    missingInformation: string[];
    suggestedFollowUp: string[];
    overallConsistency: number;
    analysis: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'verify-consistency',
          caseId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Consistency verification error:', error);
      throw error;
    }
  },

  /**
   * Analyze patterns across similar cases
   * Identifies trends and similarities
   */
  async analyzeCasePatterns(caseId: string): Promise<{
    recurringPatterns: string[];
    geographicClusters: string;
    temporalPatterns: string;
    behavioralPatterns: string[];
    uniqueAspects: string[];
    classification: string;
    relatedCaseIds: string[];
    hypothesis: string;
    confidence: number;
    recommendedExperts: string[];
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'analyze-patterns',
          caseId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Pattern analysis error:', error);
      throw error;
    }
  },

  /**
   * Generate investigative questions and action items
   * Suggests next steps for investigation
   */
  async suggestInvestigativeQuestions(caseId: string): Promise<{
    criticalQuestions: string[];
    witnessQuestions: string[];
    expertConsultations: Array<{ expert: string; questions: string[] }>;
    evidenceToSeek: string[];
    technicalInvestigations: string[];
    followUpActions: Array<{ action: string; priority: string; timeline: string }>;
    verificationMethods: string[];
    priorityLevel: string;
    estimatedTimeToResolve: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: { 
          action: 'suggest-questions',
          caseId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Question generation error:', error);
      throw error;
    }
  }
};