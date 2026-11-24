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
export type AccountStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';
export type AdminPermission = 'talent' | 'booking' | 'finance' | 'support';

export interface AdminAccess {
  adminLevel: 'super_admin' | 'admin';
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
}

interface AuthContextValue {
  /** Pengguna Supabase saat ini, atau null jika Guest. Hanya valid jika isAuthLoading === false. */
  user: User | null;
  /** Role dari tabel public.users. null untuk Guest atau jika role tidak ditemukan. */
  role: UserRole | null;
  /** Hak menu Admin yang dikonfirmasi database; null berarti tidak punya akses Admin. */
  adminAccess: AdminAccess | null;
  /** Status akun dari public.users. */
  accountStatus: AccountStatus | null;
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

const normalizeAccountStatus = (value: unknown): AccountStatus | null =>
  value === 'pending_verification' || value === 'active' || value === 'suspended' || value === 'banned' ? value : null;

const normalizeAdminAccess = (value: unknown): AdminAccess | null => {
  if (!value || typeof value !== 'object') return null;
  const access = value as { is_admin?: boolean; is_super_admin?: boolean; permissions?: unknown };
  if (access.is_admin !== true) return null;
  const allowed = new Set<AdminPermission>(['talent', 'booking', 'finance', 'support']);
  const permissions = Array.isArray(access.permissions)
    ? access.permissions.filter((item): item is AdminPermission => typeof item === 'string' && allowed.has(item as AdminPermission))
    : [];
  const isSuperAdmin = access.is_super_admin === true;
  if (isSuperAdmin) {
    return { adminLevel: 'super_admin', isSuperAdmin: true, permissions: ['talent', 'booking', 'finance', 'support'] };
  }
  return { adminLevel: 'admin', isSuperAdmin: false, permissions };
};

async function fetchAdminAccess(): Promise<AdminAccess | null> {
  try {
    const { data, error } = await supabase.rpc('get_admin_access');
    if (error) throw error;
    return normalizeAdminAccess(data);
  } catch (error) {
    console.error('YUKU: gagal memuat izin Admin', error);
    return null;
  }
}

async function fetchUserAccess(userId: string): Promise<{ role: UserRole | null; accountStatus: AccountStatus | null }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role,account_status')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return { role: normalizeRole(data?.role), accountStatus: normalizeAccountStatus(data?.account_status) };
  } catch (error) {
    console.error('YUKU: gagal memuat status dan role pengguna', error);
    return { role: null, accountStatus: null };
  }
}

/**
 * SATU-SATUNYA tempat aplikasi memeriksa sesi Supabase.
 * Komponen lain wajib memakai useAuth(), bukan supabase.auth.getSession() / onAuthStateChange().
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
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
      setAdminAccess(null);
      setAccountStatus(null);
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

    const nextAccess = await fetchUserAccess(nextUser.id);
    const nextRole = nextAccess.role;
    const nextAdminAccess = nextRole === 'admin' ? await fetchAdminAccess() : null;
    if (requestId !== requestIdRef.current) return; // sudah ada permintaan yang lebih baru

    if (nextAccess.accountStatus !== 'active' && nextAccess.accountStatus !== 'pending_verification') {
      // Tolak sesi jika akun dibatasi, record tidak ada, atau status gagal diverifikasi.
      await supabase.auth.signOut({ scope: 'global' });
      currentUserIdRef.current = null;
      setUser(null);
      setRole(null);
      setAdminAccess(null);
      setAccountStatus(nextAccess.accountStatus);
      setIsAuthLoading(false);
      return;
    }

    setUser(nextUser);
    setRole(nextRole);
    setAdminAccess(nextAdminAccess);
    setAccountStatus(nextAccess.accountStatus);
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

    // Muat ulang izin saat pengguna kembali ke tab aplikasi.
    // Ini membuat perubahan izin/nonaktif Admin segera tercermin tanpa harus logout.
    const handleWindowFocus = () => {
      if (!isMounted) return;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (isMounted) void applySession(session?.user ?? null, true);
      }).catch((error) => {
        console.error('YUKU: gagal memperbarui izin Admin saat aplikasi aktif', error);
      });
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleWindowFocus);
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
      adminAccess,
      accountStatus,
      isAuthLoading,
      isAuthenticated: Boolean(user),
      signOut,
      refreshRole,
    }),
    [user, role, adminAccess, accountStatus, isAuthLoading, signOut, refreshRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
