// src/lib/firebase-admin.ts
// Firebase Admin SDK — chạy phía server (API routes, cron jobs)
// KHÔNG dùng ở client-side

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const adminApp =
  getApps().find((a) => a.name === 'admin') ||
  initializeApp(
    {
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    },
    'admin'
  );

export const adminDb = getFirestore(adminApp);
export const adminMessaging = getMessaging(adminApp);
