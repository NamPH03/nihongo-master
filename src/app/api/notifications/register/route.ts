// src/app/api/notifications/register/route.ts
// Nhận FCM token từ client → lưu vào Firestore

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const tokenString = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    const { userId, token, origin } = await req.json();

    if (!userId || !token) {
      return NextResponse.json({ error: 'Thiếu userId hoặc token' }, { status: 400 });
    }

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    
    let verifiedUid: string | null = null;
    if (tokenString) {
      try {
        const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n');
        const adminApp = getApps().find(a => a.name === 'auth-admin') || initializeApp({
          credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          })
        }, 'auth-admin');
        const decodedToken = await getAuth(adminApp).verifyIdToken(tokenString);
        verifiedUid = decodedToken.uid;
      } catch (e) {
        console.warn('[register-token] Invalid ID token, fallback to provided userId if dev/valid:', e);
      }
    }

    // Nếu verifyIdToken thành công thì bắt buộc dùng verifiedUid để lưu token (chống mạo danh userId)
    const targetUid = verifiedUid || userId;

    const adminDb = getAdminDb();
    // Dùng 20 ký tự đầu của base64 token làm document key
    const tokenKey = Buffer.from(token).toString('base64url').slice(0, 20);
    const tokenRef = adminDb.doc(`users/${targetUid}/fcmTokens/${tokenKey}`);

    // Ghi thẳng token
    await tokenRef.set(
      {
        token,
        origin: origin || 'unknown',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[register-token]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
