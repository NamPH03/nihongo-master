'use client';

// src/components/EnableNotificationButton.tsx
// Nút bật thông báo — iOS bắt buộc phải có user gesture (bấm nút) mới xin quyền được

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { registerPushNotifications } from '@/lib/fcm';
import { Bell, BellOff, BellRing } from 'lucide-react';

type Status = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported';

export default function EnableNotificationButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }

    // Đồng bộ trạng thái permission hiện tại
    if (Notification.permission === 'granted') setStatus('granted');
    if (Notification.permission === 'denied') setStatus('denied');

    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  const handleEnable = async () => {
    if (!userId) return;
    setStatus('loading');
    const success = await registerPushNotifications(userId);
    setStatus(success ? 'granted' : 'denied');
  };

  if (status === 'unsupported') return null;
  if (status === 'granted') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <BellRing size={16} />
        <span>Thông báo đã bật</span>
      </div>
    );
  }
  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400">
        <BellOff size={16} />
        <span>Thông báo bị chặn — vào Settings để bật lại</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={status === 'loading'}
      className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2 text-sm text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
    >
      <Bell size={16} />
      {status === 'loading' ? 'Đang bật...' : 'Bật thông báo nhắc học'}
    </button>
  );
}
