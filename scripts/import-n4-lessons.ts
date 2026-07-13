// scripts/import-n4-lessons.ts
// ===================================================
// Import toàn bộ từ vựng N4 từ thư mục N4_vocab/
// Mỗi file .xlsx = 1 bài học, đọc đầy đủ metadata từ cột A-K
//
// Sử dụng:
//   Chạy thử 1 file đầu (test):
//     npx tsx scripts/import-n4-lessons.ts
//
//   Import toàn bộ KHÔNG dùng AI (nhanh):
//     npx tsx scripts/import-n4-lessons.ts --all --no-ai
//
//   Import toàn bộ VÀ gọi Gemini tạo câu ví dụ:
//     npx tsx scripts/import-n4-lessons.ts --all
//
//   Chỉ tạo lại câu ví dụ cho từ chưa có:
//     npx tsx scripts/import-n4-lessons.ts --all --regen
// ===================================================

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

// ===== ARGS =====
const args = process.argv.slice(2);
const runAll  = args.includes("--all");
const noAi    = args.includes("--no-ai");
const regenAi = args.includes("--regen");
const TEST_FILES = 1; // Chỉ test 1 file đầu nếu không có --all

// ===== GEMINI =====
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: { responseMimeType: "application/json" } as object,
});

// ===== FIREBASE =====
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ===== HELPERS =====
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractRetryDelay(errMsg: string): number {
  const match = errMsg.match(/retry in ([\d.]+)s/);
  if (match) return Math.ceil(parseFloat(match[1])) * 1000 + 2000;
  return 30000;
}

function makeWordId(word: string, lessonId: string): string {
  const clean = word.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_");
  return `N4_${lessonId}_${clean}`;
}

// ===== GEMINI EXAMPLE =====
async function generateExample(
  word: string,
  reading: string,
  meaning: string,
  maxRetries = 4
): Promise<{ example: string; exampleMeaning: string }> {
  const prompt = `Bạn là giáo viên dạy tiếng Nhật N4. Hãy tạo 1 câu ví dụ TỰ NHIÊN, ĐÚNG NGỮ PHÁP cho từ vựng sau:

Từ: ${word}
Cách đọc: ${reading}
Nghĩa: ${meaning}
Trình độ: N4 (tương đối đơn giản, có thể dùng thì て形)

Yêu cầu:
- Câu phải TỰ NHIÊN, đúng ngữ pháp tiếng Nhật
- Câu phải chứa từ "${word}"
- KHÔNG dùng mẫu câu máy móc như "〇〇を使います" hoặc "〇〇があります"

Ví dụ tốt cho "台風" (cơn bão): {"example": "台風が来るので、外出しないほうがいいです。", "exampleMeaning": "Vì bão đến nên tốt hơn là đừng ra ngoài."}

Trả về JSON với đúng 2 trường:
{"example": "câu tiếng Nhật", "exampleMeaning": "nghĩa tiếng Việt"}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      const errMsg = (err as Error).message || "";
      const is429 = errMsg.includes("429") || errMsg.includes("Too Many Requests");
      if (is429 && attempt < maxRetries) {
        const waitMs = extractRetryDelay(errMsg);
        console.warn(`  ⏱️  Rate limit 429 — thử lại sau ${waitMs / 1000}s (lần ${attempt}/${maxRetries - 1})...`);
        await sleep(waitMs);
        continue;
      }
      if (is429) console.error(`  ❌ Hết retry, dùng fallback.`);
      else        console.error(`  ❌ Lỗi Gemini: ${errMsg.slice(0, 80)}`);
      break;
    }
  }
  return { example: "", exampleMeaning: "" };
}

// ===== ĐỌC FILE EXCEL =====
type VocabRow = {
  courseId:      string;
  courseName:    string;
  lessonId:      string;
  lessonTitle:   string;
  word:          string;
  reading:       string;
  type:          string;
  meaning:       string;
  example:       string;
  exampleMeaning: string;
  level:         string;
};

function readN4Excel(filePath: string): VocabRow[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
  return rows
    .slice(1) // bỏ header
    .filter((row) => row[4]?.toString().trim()) // cột E = Word phải có
    .map((row) => ({
      courseId:       String(row[0]  || "").trim(),
      courseName:     String(row[1]  || "").trim(),
      lessonId:       String(row[2]  || "").trim(),
      lessonTitle:    String(row[3]  || "").trim(),
      word:           String(row[4]  || "").trim(),
      reading:        String(row[5]  || row[4] || "").trim(),
      type:           String(row[6]  || "N").trim(),
      meaning:        String(row[7]  || "").trim(),
      example:        String(row[8]  || "").trim(),
      exampleMeaning: String(row[9]  || "").trim(),
      level:          String(row[10] || "N4").trim(),
    }));
}

// ===== MAIN =====
async function main() {
  const vocabDir = path.join(process.cwd(), "N4_vocab");
  const allFiles = fs.readdirSync(vocabDir)
    .filter((f) => f.endsWith(".xlsx"))
    .sort(); // thứ tự 15A, 15B, 16A...

  const filesToProcess = runAll ? allFiles : allFiles.slice(0, TEST_FILES);

  console.log("\n" + "=".repeat(60));
  console.log("📚 IMPORT TỪ VỰNG N4 THEO BÀI HỌC → FIREBASE");
  console.log(`   Chế độ  : ${runAll ? `TOÀN BỘ (${allFiles.length} file)` : `TEST ${TEST_FILES} FILE ĐẦU`}`);
  console.log(`   Gemini  : ${noAi ? "❌ TẮT (--no-ai)" : regenAi ? "♻️  Chỉ regen câu trống" : "✅ BẬT"}`);
  console.log("=".repeat(60) + "\n");

  // Lấy danh sách từ N4 đã có trong Firebase
  console.log("🔍 Đang kiểm tra Firebase...");
  const existingSnap = await getDocs(
    query(collection(db, "vocabulary"), where("level", "==", "N4"))
  );
  const existingMap = new Map<string, { hasExample: boolean }>();
  existingSnap.forEach((d) => {
    const data = d.data();
    existingMap.set(d.id, {
      hasExample: !!(data.example && data.example.trim() !== ""),
    });
  });
  console.log(`   → Đang có ${existingMap.size} từ N4 trong Firebase\n`);

  let totalNew = 0, totalUpdate = 0, totalSkip = 0, totalError = 0;

  for (let fi = 0; fi < filesToProcess.length; fi++) {
    const fileName = filesToProcess[fi];
    const filePath = path.join(vocabDir, fileName);
    const rows = readN4Excel(filePath);

    if (rows.length === 0) {
      console.log(`⚠️  [${fi + 1}/${filesToProcess.length}] ${fileName} — không có dữ liệu, bỏ qua`);
      continue;
    }

    const { lessonId, lessonTitle, courseId, courseName } = rows[0];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📂 [${fi + 1}/${filesToProcess.length}] ${fileName}`);
    console.log(`   Khoá học : ${courseName} (${courseId})`);
    console.log(`   Bài học  : ${lessonTitle} (${lessonId}) — ${rows.length} từ`);
    console.log("=".repeat(60));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.word || !row.meaning) continue;

      const wordId = makeWordId(row.word, lessonId);
      const existing = existingMap.get(wordId);
      const isExisting = !!existing;

      console.log(`\n⏳ [${i + 1}/${rows.length}] "${row.word}" — ${isExisting ? "🔄 Cập nhật" : "✨ Từ mới"}`);

      // --regen: bỏ qua từ đã có câu ví dụ
      if (regenAi && isExisting && existing?.hasExample) {
        console.log(`   ⏭️  Bỏ qua (đã có câu ví dụ)`);
        totalSkip++;
        continue;
      }

      try {
        let example        = row.example;        // Dùng câu từ Excel nếu có
        let exampleMeaning = row.exampleMeaning;

        // Gọi Gemini nếu: không có --no-ai, VÀ (từ mới hoặc đang regen từ trống)
        const needGemini = !noAi && (
          (!isExisting && !example) ||                          // Từ mới chưa có example
          (regenAi && !existing?.hasExample && !example)       // Regen từ trống
        );

        if (needGemini) {
          console.log(`   Đang gọi Gemini AI...`);
          const result = await generateExample(row.word, row.reading, row.meaning);
          // Chỉ dùng kết quả Gemini nếu thực sự có
          if (result.example) {
            example        = result.example;
            exampleMeaning = result.exampleMeaning;
          }
          console.log(`   📝 Ví dụ: ${example || "(không có)"}`);
          console.log(`   📝 Nghĩa: ${exampleMeaning || "(không có)"}`);
        }

        const docRef = doc(db, "vocabulary", wordId);

        if (regenAi && isExisting) {
          // Chỉ cập nhật example nếu thực sự có giá trị mới
          if (example) {
            await setDoc(docRef, { example, exampleMeaning, updatedAt: new Date() }, { merge: true });
            console.log(`   ✅ Đã cập nhật câu ví dụ`);
            totalUpdate++;
          } else {
            console.log(`   ⚠️  Không có câu mới — giữ nguyên`);
            totalSkip++;
          }
        } else if (isExisting) {
          // Cập nhật metadata bài học (courseId, lessonId, lessonTitle) và thông tin cơ bản
          await setDoc(docRef, {
            wordId,
            word:          row.word,
            reading:       row.reading,
            type:          row.type || "N",
            meaning:       row.meaning,
            level:         "N4",
            courseId:      row.courseId,
            courseName:    row.courseName,
            lessonId:      row.lessonId,
            lessonTitle:   row.lessonTitle,
            updatedAt:     new Date(),
          }, { merge: true });
          console.log(`   ✅ Đã cập nhật`);
          totalUpdate++;
        } else {
          // Từ mới hoàn toàn
          await setDoc(docRef, {
            wordId,
            word:           row.word,
            reading:        row.reading,
            type:           row.type || "N",
            meaning:        row.meaning,
            level:          "N4",
            courseId:       row.courseId,
            courseName:     row.courseName,
            lessonId:       row.lessonId,
            lessonTitle:    row.lessonTitle,
            example,
            exampleMeaning,
            status:         "new",
            createdAt:      new Date(),
          });
          console.log(`   ✅ Đã thêm mới`);
          totalNew++;
          if (!noAi && needGemini) await sleep(5000); // Tránh rate limit
        }
      } catch (error) {
        totalError++;
        console.error(`   ❌ Lỗi: ${(error as Error).message?.slice(0, 80)}`);
      }
    }
  }

  // TỔNG KẾT
  console.log(`\n${"=".repeat(60)}`);
  console.log("🎉 HOÀN THÀNH!");
  console.log(`   ✨ Thêm mới  : ${totalNew} từ`);
  console.log(`   🔄 Cập nhật : ${totalUpdate} từ`);
  console.log(`   ⏭️  Bỏ qua   : ${totalSkip} từ`);
  console.log(`   ❌ Lỗi      : ${totalError} từ`);
  if (!runAll) {
    console.log("\n💡 Để import toàn bộ 44 bài học N4, chạy:");
    console.log("   npx tsx scripts/import-n4-lessons.ts --all --no-ai");
    console.log("   (Sau đó regen câu ví dụ: npx tsx scripts/import-n4-lessons.ts --all --regen)");
  }
  console.log("=".repeat(60) + "\n");
  process.exit(0);
}

main();
