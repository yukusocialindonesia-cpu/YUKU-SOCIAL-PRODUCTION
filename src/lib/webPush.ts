const PUBLIC_VAPID_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim();

function decodeBase64Url(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export type PushSetupResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function enableYukuPush(): Promise<PushSetupResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, message: 'Browser ini belum mendukung notifikasi push.' };
  }
  if (!PUBLIC_VAPID_KEY) {
    return { ok: false, message: 'Notifikasi push belum dikonfigurasi oleh YUKU.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, message: 'Izin notifikasi belum diberikan. Periksa pengaturan browser/HP.' };
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(PUBLIC_VAPID_KEY) as BufferSource,
    });

    const { data, error } = await (await import('./supabase')).supabase.functions.invoke('yuku-push', {
      body: { action: 'subscribe', subscription: subscription.toJSON() },
    });

    if (error || !data?.ok) {
      if (!existing) await subscription.unsubscribe().catch(() => false);
      return { ok: false, message: data?.message || error?.message || 'Gagal mendaftarkan perangkat.' };
    }

    return { ok: true, message: 'Notifikasi YUKU sudah diaktifkan di perangkat ini.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat mengaktifkan notifikasi.';
    return { ok: false, message };
  }
}

export async function disableYukuPush(): Promise<PushSetupResult> {
  if (!('serviceWorker' in navigator)) {
    return { ok: false, message: 'Browser ini belum mendukung service worker.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true, message: 'Notifikasi push sudah tidak aktif.' };

    const { data, error } = await (await import('./supabase')).supabase.functions.invoke('yuku-push', {
      body: { action: 'unsubscribe', endpoint: subscription.endpoint },
    });
    if (error || !data?.ok) {
      return { ok: false, message: data?.message || error?.message || 'Gagal menonaktifkan notifikasi.' };
    }

    await subscription.unsubscribe();
    return { ok: true, message: 'Notifikasi YUKU dinonaktifkan di perangkat ini.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menonaktifkan notifikasi.';
    return { ok: false, message };
  }
}

export async function getYukuPushStatus(): Promise<'unsupported' | 'enabled' | 'disabled' | 'permission-denied'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'permission-denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription() ? 'enabled' : 'disabled';
  } catch {
    return 'disabled';
  }
}
