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
      
      let word = "";
      let reading = "";
      let meaning = "";
      let type = "名詞";
      let level = "N3";
      let example = "";
      let exampleMeaning = "";
      let courseId = "tu-vung-it";
      let lessonId = "lesson-01";
      let lessonTitle = "Bài học IT";
      let courseName = "Từ vựng chuyên ngành IT";

      // Kiểm tra xem dữ liệu có bị gom thành 1 chuỗi phân tách bằng dấu phẩy không
      const keys = Object.keys(row);
      const commaHeader = keys.find(k => k.includes(",") && k.includes("word") && k.includes("reading"));
      
      if (commaHeader) {
        const rawValue = String(row[commaHeader] || "");
        const parts = rawValue.split(",");
        if (parts.length >= 10) {
          word = parts[0].trim();
          reading = parts[1].trim();
          meaning = parts[2].trim();
          type = parts[3].trim();
          level = parts[4].trim();
          example = parts[5].trim();
          exampleMeaning = parts[6].trim();
          courseId = parts[7].trim();
          lessonId = parts[8].trim();
          lessonTitle = parts[9].trim();
          // Lấy courseName dựa trên courseId hoặc lessonTitle để thân thiện với giao diện
          courseName = lessonTitle.split(":")[0]?.trim() || "Từ vựng chuyên ngành IT";
        }
      } else {
        word = String(row.word || row.Word || "").trim();
        reading = String(row.reading || row.Reading || "").trim();
        meaning = String(row.meaning || row.Meaning || "").trim();
        type = String(row.type || row.Type || "名詞").trim();
        level = String(row.level || row.Level || "N3").trim();
        example = String(row.example || row.Example || "").trim();
        exampleMeaning = String(row.exampleMeaning || row.ExampleMeaning || row.example_meaning || "").trim();
        courseId = String(row.courseId || row.CourseId || "tu-vung-it").trim();
        lessonId = String(row.lessonId || row.LessonId || "lesson-01").trim();
        lessonTitle = String(row.lessonTitle || row.LessonTitle || "Bài học IT").trim();
        courseName = String(row.courseName || row.CourseName || "Từ vựng chuyên ngành IT").trim();
      }

      if (!word || !reading) {
        errors.push(`Dòng ${i + 2}: Thiếu cột word hoặc reading hoặc parse lỗi`);
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
