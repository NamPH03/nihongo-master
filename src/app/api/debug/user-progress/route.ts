// src/app/api/debug/user-progress/route.ts
// Debug route: Kiểm tra progress của user và xem wordId nào không join được vocabulary
// CHỈ DÙNG ĐỂ DEBUG — Xóa sau khi fix xong

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const db = getAdminDb();

  // Lấy tất cả progress của user
  const progressSnap = await db.collection("users").doc(uid).collection("progress").get();
  const progressDocs = progressSnap.docs.filter((d) => d.id !== "stats");

  const results = await Promise.all(
    progressDocs.map(async (pd) => {
      const data = pd.data();
      const wordId = data.wordId || pd.id;
      // Tìm trong vocabulary
      const vocabSnap = await db.collection("vocabulary").doc(wordId).get();
      return {
        progressDocId: pd.id,
        wordIdField: data.wordId || null,
        resolvedWordId: wordId,
        srLevel: data.srLevel ?? null,
        status: data.status ?? null,
        vocabExists: vocabSnap.exists,
        vocabWord: vocabSnap.exists ? vocabSnap.data()?.word : null,
      };
    })
  );

  const missing = results.filter((r) => !r.vocabExists);
  const found = results.filter((r) => r.vocabExists);

  return NextResponse.json({
    total: results.length,
    found: found.length,
    missing: missing.length,
    missingEntries: missing,
    foundEntries: found,
  });
}
