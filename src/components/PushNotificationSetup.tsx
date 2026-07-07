'use client';

// src/components/PushNotificationSetup.tsx
// Component chạy ngầm — đăng ký FCM khi user đăng nhập
// Thêm vào layout để tự động bật notification cho mọi user

import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { registerPushNotifications, listenForegroundMessages } from '@/lib/fcm';

export default function PushNotificationSetup() {
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    // Không chạy nếu không có Service Worker support (hoặc đang dev HTTP)
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (!('Notification' in window)) return;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        registeredRef.current = null;
        return;
      }

      // Tránh đăng ký 2 lần cho cùng user
      if (registeredRef.current === user.uid) return;
      registeredRef.current = user.uid;

      // iOS PWA: không xin quyền ngay khi load — cần user gesture
      // Nhưng nếu đã granted rồi thì đăng ký luôn
      if (Notification.permission === 'granted') {
        await registerPushNotifications(user.uid);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Lắng nghe thông báo khi app đang mở (foreground) — hiển thị toast nhỏ
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unsubscribeForeground = listenForegroundMessages((payload) => {
      const title = payload.notification?.title || 'Nihongo Master';
      const body = payload.notification?.body || '';

      // Hiển thị notification native nếu app đang focus (thay cho toast)
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'nihongo-master-fg',
        });
      }
    });

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, []);

  // Component không render gì — chạy ngầm hoàn toàn
  return null;
}
