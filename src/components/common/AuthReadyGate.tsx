import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthReadyGateProps {
  children: React.ReactNode;
}

export const AuthReadyGate: React.FC<AuthReadyGateProps> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const finishAuthCheck = async () => {
      try {
        await supabase.auth.getSession();
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    finishAuthCheck();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF8FC] flex items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-purple-700">
          <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
          <span class="text-xs font-bold" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
            Memuat YUKU...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
