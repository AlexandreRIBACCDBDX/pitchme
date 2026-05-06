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
        // Fallback: try to recover user from localStorage directly so a network
        // hiccup (e.g. corporate SSL proxy) doesn't log the user out on F5.
        const recovered = recoverUserFromStorage();
        if (recovered) {
          setUser(recovered);
          await fetchProfile(recovered.id);
        } else {
          setLoading(false);
        }
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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
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

      // Whether insert succeeded or not, set a usable profile
      setProfile(created ?? { ...newProfile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('[Auth] fetchProfile failed:', e);
      // Last resort: build profile from JWT metadata so the app stays usable
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

// Read the Supabase user from localStorage without making any network call.
// Used as a last-resort fallback when getSession() throws (e.g. proxy errors).
function recoverUserFromStorage(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = Object.keys(window.localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}
