// src/app/api/debug/uid-by-email/route.ts
// Tìm UID từ email — CHỈ DÙNG ĐỂ DEBUG
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (secret !== cronSecret && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });
  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const privateKey = (() => {
      let k = process.env.FIREBASE_PRIVATE_KEY || "";
      if (k.startsWith('"') && k.endsWith('"')) k = k.slice(1, -1);
      return k.replace(/\\n/g, "\n");
    })();
    const app = getApps().find(a => a.name === "admin") || initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      })
    }, "admin");
    const { getAuth } = await import("firebase-admin/auth");
    const auth = getAuth(app);
    const user = await auth.getUserByEmail(email);
    return NextResponse.json({ uid: user.uid, email: user.email });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
