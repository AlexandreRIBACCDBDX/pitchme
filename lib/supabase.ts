import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing env vars — copy .env.example to .env and fill in your credentials.');
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────
// Supabase sessions can exceed the 4 KB per-cookie limit, so we split into
// chunks and reassemble on read. Cookie names are normalised to [a-z0-9_].

const CHUNK = 3600; // safe margin below the 4 096-byte cookie limit
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

function cookieName(key: string) {
  return 'sb_' + key.replace(/[^a-zA-Z0-9]/g, '_');
}

function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  return Object.fromEntries(
    document.cookie.split(';').map(c => {
      const idx = c.indexOf('=');
      return idx < 0 ? [c.trim(), ''] : [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    })
  );
}

function cookieGet(key: string): string | null {
  try {
    const base = cookieName(key);
    const all  = parseCookies();
    const n    = parseInt(all[`${base}_n`] ?? '0', 10);
    if (!n) return null;
    let value = '';
    for (let i = 0; i < n; i++) {
      const chunk = all[`${base}_${i}`];
      if (chunk === undefined) return null;
      value += decodeURIComponent(chunk);
    }
    return value;
  } catch { return null; }
}

function cookieSet(key: string, value: string): void {
  try {
    const base    = cookieName(key);
    const expires = new Date(Date.now() + ONE_YEAR).toUTCString();
    const encoded = encodeURIComponent(value);
    const total   = Math.ceil(encoded.length / CHUNK);

    for (let i = 0; i < total; i++) {
      document.cookie =
        `${base}_${i}=${encoded.slice(i * CHUNK, (i + 1) * CHUNK)}` +
        `; expires=${expires}; path=/; SameSite=Lax`;
    }
    document.cookie = `${base}_n=${total}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function cookieRemove(key: string): void {
  try {
    const base = cookieName(key);
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
    for (const name of Object.keys(parseCookies())) {
      if (name.startsWith(base)) {
        document.cookie = `${name}=; expires=${past}; path=/; SameSite=Lax`;
      }
    }
  } catch {}
}

// ─── Hybrid storage: localStorage primary, cookies fallback ──────────────────
// Both are written on every setItem so either can restore the session alone.
// This survives corporate proxies that block localStorage and plain F5 refreshes.

const hybridStorage = typeof window !== 'undefined' ? {
  getItem(key: string): string | null {
    try {
      const ls = window.localStorage.getItem(key);
      if (ls) return ls;
    } catch {}
    return cookieGet(key);
  },
  setItem(key: string, value: string): void {
    try { window.localStorage.setItem(key, value); } catch {}
    cookieSet(key, value);
  },
  removeItem(key: string): void {
    try { window.localStorage.removeItem(key); } catch {}
    cookieRemove(key);
  },
} : undefined;

// ─── Supabase client ──────────────────────────────────────────────────────────

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? hybridStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
  },
});
