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

  // Lắng nghe thông báo khi app đang mở (foreground)
  // Dùng Service Worker registration.showNotification() với cùng tag 'nihongo-master'
  // để browser tự deduplicate (không tạo 2 notification cùng lúc)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unsubscribeForeground = listenForegroundMessages(async (payload) => {
      const title = payload.data?.title || 'Nihongo Master';
      const body = payload.data?.body || '';
      const link = payload.data?.url || '/dashboard';

      if (Notification.permission !== 'granted') return;

      // Dùng SW registration.showNotification thay vì new Notification()
      // để cùng tag với onBackgroundMessage → browser deduplicate tự động
      try {
        const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (reg) {
          await reg.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'nihongo-master', // Cùng tag với SW → không bị duplicate
            data: { url: link },
            requireInteraction: false,
          });
        }
      } catch {
        // Fallback: nếu SW không có, dùng Notification API thường
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'nihongo-master',
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
