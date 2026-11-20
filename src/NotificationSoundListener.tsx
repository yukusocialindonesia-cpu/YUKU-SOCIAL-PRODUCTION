import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { installSoundUnlock, playNotificationSound } from '../../lib/notificationSound';

interface IncomingMessage {
  sender_id?: string;
}

/**
 * Listener global (tidak merender apa pun):
 *  - membuka kunci audio pada interaksi pertama;
 *  - membunyikan "pop" saat ada pesan chat booking baru dari lawan bicara,
 *    di halaman mana pun (RLS memastikan hanya pesan dari booking milik user).
 * Bunyi notifikasi lonceng (booking, uang masuk, dll) ada di NotificationBell.
 */
export const NotificationSoundListener: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    installSoundUnlock();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channelName = `chat-sound-${userId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_messages' },
        (payload) => {
          const incoming = payload.new as IncomingMessage;
          if (incoming?.sender_id && incoming.sender_id !== userId) {
            playNotificationSound('chat');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
};
