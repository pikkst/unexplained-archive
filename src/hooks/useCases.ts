import { useState, useEffect } from 'react';
import { caseService } from '../services/caseService';
import type { Database } from '../lib/supabase';

type Case = Database['public']['Tables']['cases']['Row'];

// Transform database case to include imageUrl for frontend compatibility
function transformCase(dbCase: any) {
  return {
    ...dbCase,
    // Map media_urls[0] to imageUrl for frontend components
    imageUrl: dbCase.media_urls?.[0] || '',
    // Map database fields to frontend expected fields
    incidentDate: dbCase.date_occurred || dbCase.created_at,
    submittedDate: dbCase.created_at,
    submittedBy: dbCase.profiles,
    assignedInvestigator: dbCase.assigned_investigator,
    // Map status from database format to frontend format
    status: dbCase.status === 'pending' ? 'OPEN' : 
            dbCase.status === 'investigating' ? 'INVESTIGATING' : 
            dbCase.status === 'resolved' ? 'RESOLVED' : 
            dbCase.status?.toUpperCase() || 'OPEN',
    category: dbCase.category?.toUpperCase() || 'OTHER',
    // Include user rating and feedback for resolved cases
    userRating: dbCase.user_rating,
    userFeedback: dbCase.user_feedback
  };
}

export function useCases(filters?: {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
}) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const data = await caseService.getCases(filters);
        // Transform each case to include imageUrl
        const transformedCases = (data || []).map(transformCase);
        setCases(transformedCases);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [filters?.category, filters?.status, filters?.search, filters?.limit]);

  return { cases, loading, error };
}

export function useCase(id: string | undefined) {
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchCase = async () => {
      try {
        setLoading(true);
        const data = await caseService.getCaseById(id);
        // Transform single case to include imageUrl
        setCaseData(data ? transformCase(data) : null);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [id]);

  return { caseData, loading, error };
}
