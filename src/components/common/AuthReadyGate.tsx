import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthReadyGateProps {
  children: React.ReactNode;
}

/** Prevents the app (including navigation) from rendering until Supabase has restored the saved session. */
export const AuthReadyGate: React.FC<AuthReadyGateProps> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Resolve the role before showing role-dependent navigation.
          await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
        }
      } catch (error) {
        // Do not leave the application stuck on the loading screen if auth is unavailable.
        console.error('Failed to restore the YUKU session:', error);
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF8FC] flex items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-purple-700">
          <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
          <span className="text-xs font-bold">Memuat YUKU...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
