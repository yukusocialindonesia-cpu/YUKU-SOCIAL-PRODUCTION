import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const DEFAULT_LOGO = '/yuku-logo-transparent.png';
export const DEFAULT_ICON = '/yuku-app-icon-transparent.png';

export interface Branding {
  logoUrl: string;
  iconUrl: string;
}

export interface BrandingState extends Branding {
  isLoaded: boolean;
}

let current: Branding = { logoUrl: DEFAULT_LOGO, iconUrl: DEFAULT_ICON };
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<(branding: Branding, isLoaded: boolean) => void>();

const toUrl = (path: string | null | undefined, fallback: string) =>
  path ? supabase.storage.from('branding').getPublicUrl(path).data.publicUrl : fallback;

export async function refreshBranding(): Promise<void> {
  try {
    const { data, error } = await (supabase as any)
      .from('site_branding')
      .select('logo_path, icon_path')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return;
    current = {
      logoUrl: toUrl(data.logo_path, DEFAULT_LOGO),
      iconUrl: toUrl(data.icon_path, DEFAULT_ICON),
    };
  } catch {
    // Gagal memuat: tetap pakai logo bawaan.
  } finally {
    loaded = true;
    listeners.forEach((listener) => listener(current, true));
  }
}

export function useBranding(): BrandingState {
  const [state, setState] = useState<BrandingState>({
    ...current,
    isLoaded: loaded,
  });

  useEffect(() => {
    const listener = (branding: Branding, isLoaded: boolean) => {
      setState({ ...branding, isLoaded });
    };
    listeners.add(listener);
    setState({ ...current, isLoaded: loaded });
    if (!loaded && !inflight) inflight = refreshBranding();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
