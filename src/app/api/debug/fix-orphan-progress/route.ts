// src/app/api/debug/fix-orphan-progress/route.ts
// Fix orphan progress docs: tìm lại vocabulary bằng word content và re-link
// POST /api/debug/fix-orphan-progress  { uid: "..." }

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const { uid } = await req.json();
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const db = getAdminDb();

    // 1. Lấy toàn bộ progress docs của user
    const progressSnap = await db
      .collection("users").doc(uid).collection("progress")
      .get();
    const progressDocs = progressSnap.docs.filter(d => d.id !== "stats");

    // 2. Tìm orphan docs (wordId không có trong vocabulary)
    const orphans: { id: string; data: FirebaseFirestore.DocumentData }[] = [];
    for (const pd of progressDocs) {
      const data = pd.data();
      const wordId = pd.id;
      const vocabDoc = await db.collection("vocabulary").doc(wordId).get();
      if (!vocabDoc.exists) {
        orphans.push({ id: pd.id, data });
      }
    }

    if (orphans.length === 0) {
      return NextResponse.json({ message: "No orphan docs found", fixed: 0, deleted: 0 });
    }

    // 3. Load toàn bộ vocabulary vào memory để tra cứu nhanh
    // Nhưng vocabulary có thể rất lớn — dùng Map theo (word, reading)
    const vocabSnap = await db.collection("vocabulary").get();
    const vocabMap = new Map<string, string>(); // key = "word|reading" → docId
    for (const vd of vocabSnap.docs) {
      const v = vd.data();
      const key = `${v.word || ""}|${v.reading || ""}`;
      if (!vocabMap.has(key)) {
        vocabMap.set(key, vd.id);
      }
    }

    // 4. Với mỗi orphan: tìm vocab bằng wordId (có thể chứa word content)
    // Vì orphan progress doc lưu wordId = Firestore docId (không có word/reading)
    // Cần thử cách khác: tìm trong userWords collection (cũ) hoặc dùng wordId string pattern
    // Dựa vào audit: foundSample có docId dạng "N4_ID_15a___を_..." → structured ID
    // orphan có docId dạng random "02tIV3lK2K7IGtnd2T8t" → từ import cũ bị xóa
    //
    // Không thể recover nếu không có word content trong progress doc
    // → Cần xóa orphan docs để stats chính xác

    const batch = db.batch();
    let deleted = 0;

    for (const orphan of orphans) {
      const progressRef = db
        .collection("users").doc(uid).collection("progress").doc(orphan.id);
      batch.delete(progressRef);
      deleted++;
    }

    await batch.commit();

    // 5. Recalculate stats
    const newProgressSnap = await db
      .collection("users").doc(uid).collection("progress")
      .get();
    const remaining = newProgressSnap.docs.filter(d => d.id !== "stats");
    
    const srDistrib: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalLearned = 0;
    for (const d of remaining) {
      const lv = d.data().srLevel ?? 0;
      if (lv >= 1 && lv <= 5) {
        srDistrib[lv] = (srDistrib[lv] || 0) + 1;
        totalLearned++;
      }
    }

    // Update stats doc
    const statsRef = db.collection("users").doc(uid).collection("progress").doc("stats");
    const statsSnap = await statsRef.get();
    if (statsSnap.exists) {
      await statsRef.update({ totalLearned });
    }

    return NextResponse.json({
      message: `Deleted ${deleted} orphan progress docs`,
      deleted,
      remainingTotal: remaining.length,
      newSrDistrib: srDistrib,
      newTotalLearned: totalLearned,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
