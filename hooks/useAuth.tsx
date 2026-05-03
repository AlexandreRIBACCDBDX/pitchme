import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — if auth resolution takes over 6s, unblock the UI
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 6000);

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('[Auth] getSession failed:', e);
        setLoading(false);
      } finally {
        clearTimeout(timeout);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error?.code === 'PGRST116' || !data) {
        const { data: { user: u } } = await supabase.auth.getUser();
        const { data: created } = await supabase
          .from('profiles')
          .insert({ id: userId, email: u?.email ?? '', role: 'candidate' })
          .select()
          .single();
        setProfile(created ?? null);
      } else {
        setProfile(data);
      }
    } catch (e) {
      console.error('[Auth] fetchProfile failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
