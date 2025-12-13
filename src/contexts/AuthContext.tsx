import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, accountType?: 'USER' | 'INVESTIGATOR') => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to profile changes (e.g., when role is updated by admin)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile updated:', payload.new);
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchProfile = async (userId: string, retries = 3): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setProfile(data);
      } else if (retries > 0) {
        // Profile not found, retry after delay (trigger might still be running)
        await new Promise(resolve => setTimeout(resolve, 500));
        return fetchProfile(userId, retries - 1);
      } else {
        // Profile still not found after retries - create it manually
        console.warn('Profile not found after retries, attempting to create it...');
        await createProfileManually(userId);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProfileManually = async (userId: string): Promise<void> => {
    try {
      // Get user data from auth
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('Cannot create profile: user not found');
        return;
      }

      // Generate username from email
      const email = user.email || '';
      const baseUsername = email.split('@')[0];
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const username = user.user_metadata?.username || `${baseUsername}_${randomSuffix}`;

      // Create profile
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          full_name: user.user_metadata?.full_name || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          role: 'user',
          bio: '',
          reputation: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create profile manually:', error);
        return;
      }

      if (newProfile) {
        console.log('Profile created manually:', newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Error creating profile manually:', error);
    }
  };

  const signUp = async (email: string, password: string, username: string, accountType: 'USER' | 'INVESTIGATOR' = 'USER') => {
    try {
      const role = accountType === 'INVESTIGATOR' ? 'investigator' : 'user';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: '',
            role,
          },
        },
      });

      if (error) return { error };

      // Profile is automatically created by database trigger (handle_new_user)
      // Wait for trigger to complete, then fetch profile with retries
      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchProfile(data.user.id, 5); // Try up to 5 times
      }

      return { error: null };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      console.log('Sign in successful:', data.user?.email);
      return { error: null };
    } catch (error) {
      console.error('Sign in exception:', error);
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
