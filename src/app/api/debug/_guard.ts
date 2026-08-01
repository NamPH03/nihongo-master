// src/app/api/debug/_guard.ts
// Guard tập trung cho tất cả debug API routes.
// - Yêu cầu ?secret=<CRON_SECRET> hoặc header X-Debug-Secret
// - Không có bypass isDev để tránh lộ thông tin ngay cả trên localhost nếu public
// - Trả về headers X-Robots-Tag để block crawler

import { NextRequest, NextResponse } from "next/server";

export function debugGuard(req: NextRequest): NextResponse | null {
  const secret =
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("x-debug-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !secret || secret !== cronSecret) {
    return NextResponse.json(
      { error: "Unauthorized — debug routes require a valid secret." },
      {
        status: 401,
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-store",
        },
      }
    );
  }
  return null; // Passed
}
