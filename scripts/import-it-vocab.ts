// scripts/import-it-vocab.ts
// ============================================================================
// HƯỚNG DẪN SỬ DỤNG:
//
//   Chạy thử 10 từ đầu (test):
//     npx tsx scripts/import-it-vocab.ts
//
//   Import toàn bộ từ vựng IT:
//     npx tsx scripts/import-it-vocab.ts --all
//
//   XÓA SẠCH từ vựng IT cũ và import lại toàn bộ:
//     npx tsx scripts/import-it-vocab.ts --all --clear
//
// ============================================================================

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

// ===== PARSE ARGUMENTS =====
const args = process.argv.slice(2);
const runAll = args.includes("--all");
const clearOld = args.includes("--clear");
const TEST_LIMIT = 10;

// ===== KHỞI ĐỘNG FIREBASE ADMIN =====
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error("❌ Thiếu cấu hình Admin SDK trong .env.local!");
  console.error("   Yêu cầu các biến: FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  process.exit(1);
}

let formattedKey = privateKey;
if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
  formattedKey = formattedKey.slice(1, -1);
}
formattedKey = formattedKey.replace(/\\n/g, '\n');

const adminApp = getApps().length === 0 
  ? initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
    })
  : getApps()[0];

const db = getFirestore(adminApp);

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📚 CLI IMPORT TỪ VỰNG IT VÀO FIREBASE (ADMIN SDK)`);
  console.log(`   Chế độ : ${runAll ? "TOÀN BỘ" : `TEST ${TEST_LIMIT} TỪ ĐẦU (thêm --all để chạy hết)`}`);
  console.log(`   Clear  : ${clearOld ? "✅ BẬT (sẽ xóa dữ liệu IT cũ trước khi import)" : "❌ TẮT"}`);
  console.log(`${"=".repeat(60)}\n`);

  const filePath = path.join(
    process.cwd(),
    "Vocabulary",
    "IT_vocab",
    "IT_vocab.xlsx"
  );

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file Excel tại: ${filePath}`);
    process.exit(1);
  }

  // Đọc file Excel
  console.log("📖 Đang đọc file Excel...");
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string | number | undefined>[];

  if (rows.length === 0) {
    console.error("❌ File Excel trống rỗng!");
    process.exit(1);
  }

  console.log(`📊 Tổng số dòng tìm thấy trong Excel: ${rows.length}`);

  const vocabRef = db.collection("vocabulary");

  // ===== BƯỚC 1: XÓA DỮ LIỆU CŨ NẾU CÓ --clear =====
  if (clearOld) {
    console.log("🗑️  Đang xóa sạch dữ liệu từ vựng IT cũ...");
    const oldDocs = await vocabRef
      .where("courseId", "in", ["tu-vung-cntt", "tu-vung-it"])
      .get();
    
    console.log(`   Tìm thấy ${oldDocs.size} tài liệu cũ cần xóa.`);
    
    let batch = db.batch();
    let count = 0;
    let totalDeleted = 0;

    for (const d of oldDocs.docs) {
      batch.delete(d.ref);
      count++;
      totalDeleted++;
      if (count === 500) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
    console.log(`   ✅ Đã xóa thành công ${totalDeleted} tài liệu IT cũ.`);
  }

  // ===== BƯỚC 2: TIẾN HÀNH IMPORT =====
  const dataRows = runAll ? rows : rows.slice(0, TEST_LIMIT);
  console.log(`📝 Bắt đầu xử lý ${dataRows.length} từ...`);

  let importedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
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
    let courseName = "Từ vựng IT";

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
    }

    if (!word || !reading) {
      errorCount++;
      console.error(`❌ Dòng ${i + 2}: Thiếu cột word hoặc reading hoặc parse lỗi.`);
      continue;
    }

    try {
      const cleanWord = word.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_");
      const docId = `IT_${lessonId}_${cleanWord}`;
      const docRef = vocabRef.doc(docId);

      // Lưu document bằng setDoc (Upsert)
      await docRef.set({
        wordId: docId,
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
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      importedCount++;
      if ((i + 1) % 50 === 0 || i + 1 === dataRows.length) {
        console.log(`   Processed: ${i + 1}/${dataRows.length} words...`);
      }
    } catch (e) {
      errorCount++;
      console.error(`❌ Lỗi ghi dòng ${i + 2} (${word}):`, (e as Error).message);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 HOÀN THÀNH CLI IMPORT!");
  console.log(`   ✨ Thành công (ghi/cập nhật) : ${importedCount} từ`);
  console.log(`   ❌ Lỗi                      : ${errorCount} từ`);
  if (!runAll) {
    console.log(`\n💡 LƯU Ý: Đây chỉ là chế độ chạy thử 10 từ.`);
    console.log(`   Chạy lệnh sau để import toàn bộ và làm sạch DB cũ:`);
    console.log(`   npx tsx scripts/import-it-vocab.ts --all --clear`);
  }
  console.log(`${"=".repeat(60)}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi hệ thống:", err);
  process.exit(1);
});
