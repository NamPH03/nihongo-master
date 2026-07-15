// src/app/api/cron/test-notify/route.ts
// Endpoint TEST ONLY — gui notification truc tiep toi 1 FCM token
// Dung de debug push notification tren production
// Xoa file nay sau khi test xong neu khong can

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!secret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetToken = req.nextUrl.searchParams.get("token");
  const title = req.nextUrl.searchParams.get("title") || "Test Notification";
  const body = req.nextUrl.searchParams.get("body") || "Day la test notification tu Nihongo Master!";

  const adminDb = getAdminDb();
  const adminMessaging = getAdminMessaging();

  let tokens: string[] = [];

  if (targetToken) {
    tokens = [targetToken];
  } else {
    const tokensSnap = await adminDb.collectionGroup("fcmTokens").get();
    tokensSnap.forEach((doc) => {
      const { token } = doc.data();
      if (token) tokens.push(token);
    });
  }

  if (tokens.length === 0) {
    return NextResponse.json(
      { error: "No FCM tokens found. Enable notifications in the app first." },
      { status: 404 }
    );
  }

  try {
    const result = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "nihongo-master",
          requireInteraction: false,
        },
        fcmOptions: { link: "/dashboard" },
      },
    });

    const successTokens: string[] = [];
    const failedTokens: { token: string; error: string }[] = [];

    result.responses.forEach((resp, idx) => {
      if (resp.success) {
        successTokens.push(tokens[idx].slice(0, 20) + "...");
      } else {
        failedTokens.push({
          token: tokens[idx].slice(0, 20) + "...",
          error: resp.error?.message || "Unknown error",
        });
      }
    });

    return NextResponse.json({
      success: true,
      title,
      body,
      totalTokens: tokens.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      successTokens,
      failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
