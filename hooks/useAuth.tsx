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
    // Safety net: if onAuthStateChange never fires (Supabase init hang), unblock after 8s
    const safetyTimeout = setTimeout(() => setLoading(false), 8000);

    // onAuthStateChange fires INITIAL_SESSION on startup (reads localStorage — no network call).
    // It is the single source of truth; no separate init() needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      clearTimeout(safetyTimeout);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    // Per-call safety timer so a hanging network request can't block the UI forever
    const safetyTimer = setTimeout(() => setLoading(false), 8000);
    try {
      const { data } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data as any);
        return;
      }

      // Profile missing — create it using auth metadata as source of truth
      const { data: { user: u } } = await supabase.auth.getUser();
      const meta = u?.user_metadata ?? {};
      const newProfile = {
        id: userId,
        email: u?.email ?? '',
        first_name: meta.first_name ?? '',
        last_name: meta.last_name ?? '',
        phone: meta.phone ?? '',
        role: 'candidate' as const,
      };

      const { data: created } = await (supabase.from('profiles') as any)
        .insert(newProfile)
        .select()
        .maybeSingle();

      setProfile(created ?? { ...newProfile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('[Auth] fetchProfile failed:', e);
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        const meta = u?.user_metadata ?? {};
        setProfile({
          id: userId,
          email: u?.email ?? '',
          first_name: meta.first_name ?? '',
          last_name: meta.last_name ?? '',
          phone: meta.phone ?? '',
          role: 'candidate',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch {}
    } finally {
      clearTimeout(safetyTimer);
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
