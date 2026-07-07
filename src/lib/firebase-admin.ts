// src/lib/firebase-admin.ts
// Firebase Admin SDK — lazy initialization (tránh lỗi build-time trên Vercel)

import type { App } from 'firebase-admin/app';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === 'admin');
  if (existing) return existing;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY is not set');

  // Vercel có thể lưu key bọc trong dấu nháy kép hoặc bị encode \n
  let formattedKey = privateKey;
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  formattedKey = formattedKey.replace(/\\n/g, '\n');

  return initializeApp(
    {
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    },
    'admin'
  );
}

// Dùng getter functions thay vì export singleton
// → firebase-admin chỉ khởi động khi route thực sự được gọi (không phải lúc build)
export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}
