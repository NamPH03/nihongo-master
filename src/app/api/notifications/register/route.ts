// src/app/api/notifications/register/route.ts
// Nhận FCM token từ client → lưu vào Firestore

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, token, origin } = await req.json();

    if (!userId || !token) {
      return NextResponse.json({ error: 'Thiếu userId hoặc token' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    // Dùng 20 ký tự đầu của token làm key (đủ unique, tránh path quá dài)
    const tokenKey = Buffer.from(token).toString('base64url').slice(0, 20);

    const tokenRef = adminDb.doc(`users/${userId}/fcmTokens/${tokenKey}`);

    // A browser/phone keeps its FCM token after sign-out. Move the token to
    // the newly signed-in account so one device cannot receive duplicate pushes
    // from an old account and the current account.
    const matchingTokens = await adminDb
      .collectionGroup('fcmTokens')
      .where('token', '==', token)
      .get();

    const batch = adminDb.batch();
    matchingTokens.forEach((doc) => {
      const tokenOwnerId = doc.ref.parent.parent?.id;
      if (tokenOwnerId && tokenOwnerId !== userId) {
        batch.delete(doc.ref);
      }
    });

    batch.set(
      tokenRef,
      {
        token,
        // Lưu origin để cron job chỉ gửi notification tới token từ production
        origin: origin || 'unknown',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[register-token]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
