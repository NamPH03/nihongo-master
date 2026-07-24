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
    // Dùng 20 ký tự đầu của base64 token làm document key
    const tokenKey = Buffer.from(token).toString('base64url').slice(0, 20);
    const tokenRef = adminDb.doc(`users/${userId}/fcmTokens/${tokenKey}`);

    // Ghi thẳng token — không dùng collectionGroup query để tránh yêu cầu Firestore index
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
