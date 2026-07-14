// src/app/api/vocabulary/save/route.ts
// API Route: Tìm hoặc tạo document vocabulary, trả về wordId
// Chạy phía server với Firebase Admin SDK → bypass Firestore rules "allow write: if false"

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { word, reading, meaning, type, level, example, exampleMeaning } = body;

    if (!word || !reading) {
      return NextResponse.json({ error: "Missing word or reading" }, { status: 400 });
    }

    const db = getAdminDb();
    const vocabRef = db.collection("vocabulary");

    // Tìm từ đã tồn tại trong vocabulary (match word + reading)
    const existing = await vocabRef
      .where("word", "==", word)
      .where("reading", "==", reading)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Từ đã tồn tại → trả về wordId luôn
      return NextResponse.json({ wordId: existing.docs[0].id });
    }

    // Từ chưa có → tạo mới (từ điển ngoài / từ không có trong DB sẵn)
    const newDoc = await vocabRef.add({
      word,
      reading,
      meaning: meaning || "",
      type: type || "N",
      level: level || "N5",
      example: example || "",
      exampleMeaning: exampleMeaning || "",
      status: "new",
      source: "dictionary",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ wordId: newDoc.id });
  } catch (err) {
    console.error("[API /vocabulary/save] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
