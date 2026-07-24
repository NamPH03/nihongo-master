// C:\Users\NamPH's PC\Projects\nihongo-master\src\app\api\debug\import-xlsx\route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Chỉ cho phép chạy với secret key hoặc truy cập qua localhost
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  const isLocal = req.headers.get("host")?.includes("localhost") || req.headers.get("host")?.includes("127.0.0.1");

  if (secret !== cronSecret && !isLocal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filePath = path.join(
    process.cwd(),
    "Vocabulary",
    "IT_vocab",
    "IT_vocab.xlsx"
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: `File not found at: ${filePath}` }, { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string | number | undefined>[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Sheet is empty" }, { status: 400 });
    }

    const db = getAdminDb();
    const vocabRef = db.collection("vocabulary");

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Chạy qua từng dòng và import vào Firestore
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const word = String(row.word || row.Word || "").trim();
      const reading = String(row.reading || row.Reading || "").trim();
      const meaning = String(row.meaning || row.Meaning || "").trim();
      const type = String(row.type || row.Type || "名詞").trim();
      const level = String(row.level || row.Level || "N3").trim();
      const example = String(row.example || row.Example || "").trim();
      const exampleMeaning = String(row.exampleMeaning || row.ExampleMeaning || row.example_meaning || "").trim();
      const courseId = String(row.courseId || row.CourseId || "tu-vung-it").trim();
      const lessonId = String(row.lessonId || row.LessonId || "lesson-01").trim();
      const lessonTitle = String(row.lessonTitle || row.LessonTitle || "Bài học IT").trim();
      const courseName = String(row.courseName || row.CourseName || "Từ vựng chuyên ngành IT").trim();

      if (!word || !reading) {
        errors.push(`Dòng ${i + 2}: Thiếu cột word hoặc reading`);
        continue;
      }

      // Check trùng
      const existing = await vocabRef
        .where("word", "==", word)
        .where("reading", "==", reading)
        .limit(1)
        .get();

      if (!existing.empty) {
        skippedCount++;
        continue;
      }

      await vocabRef.add({
        word,
        reading,
        meaning,
        type,
        level,
        example,
        exampleMeaning,
        courseId,
        lessonId,
        lessonTitle,
        courseName,
        status: "new",
        source: "import",
        createdAt: new Date().toISOString(),
      });

      importedCount++;
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      importedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
