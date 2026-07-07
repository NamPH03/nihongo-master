// src/lib/fcm.ts
// Quản lý FCM token phía client — lấy token, lưu lên server

'use client';

import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import app from '@/lib/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Lấy FCM token từ trình duyệt (iOS yêu cầu user grant permission trước)
export async function getFCMToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    if (!('serviceWorker' in navigator)) return null;

    const messaging = getMessaging(app);

    // Đảm bảo service worker đã đăng ký
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (err) {
    console.error('[FCM] Lỗi lấy token:', err);
    return null;
  }
}

// Lưu FCM token lên server (Firestore qua API route)
export async function saveFCMTokenToServer(userId: string, token: string): Promise<void> {
  try {
    await fetch('/api/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    });
  } catch (err) {
    console.error('[FCM] Lỗi lưu token:', err);
  }
}

// Đăng ký toàn bộ flow: xin quyền → lấy token → lưu lên server
export async function registerPushNotifications(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;

  // Xin quyền
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return false;

  const token = await getFCMToken();
  if (!token) return false;

  await saveFCMTokenToServer(userId, token);
  return true;
}

// Lắng nghe thông báo khi app đang mở (foreground)
export function listenForegroundMessages(
  callback: (payload: MessagePayload) => void
): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, callback);
    return unsubscribe;
  } catch {
    return undefined;
  }
}
