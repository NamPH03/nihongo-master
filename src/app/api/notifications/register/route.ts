// src/app/api/notifications/register/route.ts
// Nhận FCM token từ client → lưu vào Firestore

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const tokenString = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!tokenString) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { token, origin } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Thiếu token' }, { status: 400 });
    }

    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/"/g, '').replace(/\\n/g, '\n');
    const adminApp = getApps().find(a => a.name === 'auth-admin') || initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      })
    }, 'auth-admin');

    let targetUid: string;
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(tokenString);
      targetUid = decoded.uid;
    } catch (e) {
      console.error('[register-token] Token không hợp lệ:', e);
      return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const tokenKey = Buffer.from(token).toString('base64url').slice(0, 20);
    const tokenRef = adminDb.doc(`users/${targetUid}/fcmTokens/${tokenKey}`);

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
