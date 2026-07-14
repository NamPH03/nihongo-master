// src/app/api/debug/progress-audit/route.ts
// Audit toàn bộ users: tìm progress docs mà wordId không tồn tại trong vocabulary
// Trả về thống kê để biết scale của vấn đề
// GET /api/debug/progress-audit?uid=<uid>

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const db = getAdminDb();

    // Lấy tất cả progress docs của user
    const progressSnap = await db
      .collection("users").doc(uid).collection("progress")
      .get();

    const docs = progressSnap.docs.filter(d => d.id !== "stats");

    if (docs.length === 0) {
      return NextResponse.json({ uid, total: 0, found: 0, missing: 0, missingEntries: [], foundSample: [] });
    }

    // Batch check vocabulary existence
    const results = await Promise.all(
      docs.map(async (pd) => {
        const data = pd.data();
        const wordId = pd.id; // document ID = wordId
        const vocabDoc = await db.collection("vocabulary").doc(wordId).get();
        return {
          progressDocId: pd.id,
          hasWordIdField: !!data.wordId,
          wordIdField: data.wordId || null,
          srLevel: data.srLevel ?? 0,
          status: data.status ?? "unknown",
          nextReview: data.nextReview || null,
          vocabExists: vocabDoc.exists,
          vocabWord: vocabDoc.exists ? (vocabDoc.data()?.word ?? null) : null,
          vocabLevel: vocabDoc.exists ? (vocabDoc.data()?.level ?? null) : null,
        };
      })
    );

    const missing = results.filter(r => !r.vocabExists);
    const found = results.filter(r => r.vocabExists);

    // Thống kê theo srLevel
    const srDistrib: Record<number, number> = {};
    for (const r of results) {
      const lv = r.srLevel;
      srDistrib[lv] = (srDistrib[lv] || 0) + 1;
    }

    const srDistribFound: Record<number, number> = {};
    for (const r of found) {
      const lv = r.srLevel;
      srDistribFound[lv] = (srDistribFound[lv] || 0) + 1;
    }

    return NextResponse.json({
      uid,
      total: results.length,
      found: found.length,
      missing: missing.length,
      srDistribAll: srDistrib,     // srLevel distribution trong toàn bộ progress
      srDistribFound: srDistribFound, // srLevel distribution của progress có vocab
      missingEntries: missing.slice(0, 30),
      foundSample: found.slice(0, 5),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
