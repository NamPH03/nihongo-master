// src/components/ui/NotificationSetup.tsx
// Nâng cấp: tích hợp FCM Web Push (gửi được khi app đóng / iPhone tắt màn hình)
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { registerPushNotifications } from '@/lib/fcm';
import { BellRing, X } from 'lucide-react';

export default function NotificationSetup() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // Đồng bộ trạng thái hiện tại
    if (Notification.permission === 'granted') {
      setStatus('granted');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    // Lấy userId rồi hiện banner sau 3 giây
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        const dismissed = sessionStorage.getItem('notif-banner-dismissed');
        if (!dismissed) {
          setTimeout(() => setShow(true), 3000);
        }
      }
    });
    return () => unsub();
  }, []);

  // Đăng ký sau khi user đã grant
  useEffect(() => {
    if (status === 'granted' && userId) {
      registerPushNotifications(userId).catch(console.error);
    }
  }, [status, userId]);

  const handleAllow = async () => {
    if (!userId) return;
    setLoading(true);
    const success = await registerPushNotifications(userId);
    setStatus(success ? 'granted' : 'denied');
    setLoading(false);
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('notif-banner-dismissed', '1');
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 rounded-2xl p-5 z-50 animate-fade-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">🔔</div>
        <div className="flex-1">
          <div className="font-bold mb-1" style={{ color: 'var(--text)' }}>
            Bật thông báo nhắc học?
          </div>
          <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Nhận thông báo khi có từ cần ôn tập và nhắc giữ streak — kể cả khi app đóng.
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAllow}
              disabled={loading}
              className="btn btn-primary flex-1 py-2 text-sm rounded-xl flex items-center justify-center gap-2"
            >
              <BellRing size={14} />
              {loading ? 'Đang bật...' : 'Bật thông báo'}
            </button>
            <button
              onClick={handleDismiss}
              className="btn btn-ghost px-4 py-2 text-sm rounded-xl flex items-center gap-1"
            >
              <X size={14} />
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}