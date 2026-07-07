// src/app/api/notifications/register/route.ts
// Nhận FCM token từ client → lưu vào Firestore

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json();

    if (!userId || !token) {
      return NextResponse.json({ error: 'Thiếu userId hoặc token' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    // Dùng 20 ký tự đầu của token làm key (đủ unique, tránh path quá dài)
    const tokenKey = Buffer.from(token).toString('base64url').slice(0, 20);

    await adminDb.doc(`users/${userId}/fcmTokens/${tokenKey}`).set(
      {
        token,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[register-token]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
