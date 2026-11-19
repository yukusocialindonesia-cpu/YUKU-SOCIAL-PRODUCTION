import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'talent' | 'customer';

interface AuthContextValue {
  /** Pengguna Supabase saat ini, atau null jika Guest. Hanya valid jika isAuthLoading === false. */
  user: User | null;
  /** Role dari tabel public.users. null untuk Guest atau jika role tidak ditemukan. */
  role: UserRole | null;
  /** true selama sesi DAN role belum selesai dipulihkan. Selama true, jangan render menu apa pun. */
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  /** Muat ulang role (mis. setelah pengguna mendaftar sebagai talent). */
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeRole = (value: unknown): UserRole | null =>
  value === 'admin' || value === 'talent' || value === 'customer' ? value : null;

async function fetchRole(userId: string): Promise<UserRole | null> {
  try {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    return normalizeRole(data?.role);
  } catch (error) {
    console.error('YUKU: gagal memuat role pengguna', error);
    return null;
  }
}

/**
 * SATU-SATUNYA tempat aplikasi memeriksa sesi Supabase.
 * Komponen lain wajib memakai useAuth(), bukan supabase.auth.getSession() / onAuthStateChange().
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Menghindari state usang saat dua pemuatan role bertumpuk.
  const requestIdRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);

  const applySession = useCallback(async (nextUser: User | null, forceRoleReload = false) => {
    const requestId = ++requestIdRef.current;

    if (!nextUser) {
      currentUserIdRef.current = null;
      setUser(null);
      setRole(null);
      setIsAuthLoading(false);
      return;
    }

    const sameUser = currentUserIdRef.current === nextUser.id;

    // TOKEN_REFRESHED / SIGNED_IN yang berulang untuk user yang sama:
    // jangan kembali ke loading dan jangan muat ulang role (mencegah flicker).
    if (sameUser && !forceRoleReload) {
      setUser((prev) => (prev && prev.id === nextUser.id ? prev : nextUser));
      return;
    }

    currentUserIdRef.current = nextUser.id;
    if (!sameUser) setIsAuthLoading(true);

    const nextRole = await fetchRole(nextUser.id);
    if (requestId !== requestIdRef.current) return; // sudah ada permintaan yang lebih baru

    setUser(nextUser);
    setRole(nextRole);
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Pemulihan awal dari localStorage.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (isMounted) void applySession(session?.user ?? null);
      })
      .catch((error) => {
        console.error('YUKU: gagal memulihkan sesi', error);
        if (isMounted) void applySession(null);
      });

    // Perubahan berikutnya (login, logout, refresh token).
    // Callback TIDAK boleh await panggilan Supabase secara langsung (risiko deadlock),
    // jadi pekerjaan ditunda dengan setTimeout.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // sudah ditangani getSession()
      window.setTimeout(() => {
        if (!isMounted) return;
        void applySession(session?.user ?? null, event === 'USER_UPDATED');
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await applySession(null);
  }, [applySession]);

  const refreshRole = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await applySession(session?.user ?? null, true);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      isAuthLoading,
      isAuthenticated: Boolean(user),
      signOut,
      refreshRole,
    }),
    [user, role, isAuthLoading, signOut, refreshRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
