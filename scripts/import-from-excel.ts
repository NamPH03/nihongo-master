// scripts/import-from-excel.ts
// ===================================================
// HƯỚNG DẪN SỬ DỤNG:
//
//   Test 10 từ đầu (mặc định):
//     node_modules\.bin\tsx scripts\import-from-excel.ts
//
//   Import toàn bộ N5:
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N5 --all
//
//   Import N4:
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N4 --all
//
//   Import N3:
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N3 --all
//
//   Import KHÔNG gọi Gemini (nhanh, không tạo câu ví dụ — dùng khi bị rate limit):
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N5 --all --no-ai
//
//   Tạo lại câu ví dụ cho các từ chưa có (đã import --no-ai từ trước):
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N5 --all --regen
//
//   XÓA TẤT CẢ TỪ IMPORT CŨ VÀ IMPORT LẠI TỪ EXCEL (GIỮ TỪ ĐIỂN):
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N5 --all --no-ai --clear-reimport
//     (sau đó chạy --regen để tạo câu ví dụ dần dần)
//
//   Xóa từ trong Firebase không còn trong Excel:
//     node_modules\.bin\tsx scripts\import-from-excel.ts --level=N5 --all --sync-delete
//
// ===================================================
// FILE EXCEL QUY ƯỚC:
//   scripts/n5vocab.xlsx   → cấp N5
//   scripts/n4vocab.xlsx   → cấp N4
//   scripts/n3vocab.xlsx   → cấp N3
//
// CẤU TRÚC CỘT TRONG MỖI FILE EXCEL (dòng 1 là tiêu đề, bỏ qua):
//   Cột A: Từ (tiếng Nhật)
//   Cột B: Cách đọc (furigana)
//   Cột C: Loại từ (N=danh từ, V=động từ, Adj=tính từ, Adv=trạng từ...)
//   Cột D: Nghĩa (tiếng Việt)
// ===================================================

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
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

// ===== PARSE ARGUMENTS =====
const args = process.argv.slice(2);
const levelArg = args.find((a) => a.startsWith("--level="))?.split("=")[1]?.toUpperCase() || "N5";
const runAll        = args.includes("--all");
const noAi          = args.includes("--no-ai");          // Bỏ qua Gemini, import không có câu ví dụ
const regenAi       = args.includes("--regen");          // Chỉ tạo lại ví dụ cho từ chưa có
const syncDelete    = args.includes("--sync-delete");     // Xóa từ không còn trong Excel
const clearReimport = args.includes("--clear-reimport"); // Xóa TẤT CẢ từ import cũ, giữ từ điển
const LEVEL = levelArg as "N5" | "N4" | "N3";
const TEST_LIMIT = 10;

// ===== KHỞI ĐỘNG GEMINI =====
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
  } as object,
});

// ===== KHỞI ĐỘNG FIREBASE =====
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ===== HELPER: DELAY =====
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===== HELPER: TRÍCH THỜI GIAN RETRY TỪ LỖI 429 =====
function extractRetryDelay(errMsg: string): number {
  const match = errMsg.match(/retry in ([\d.]+)s/);
  if (match) return Math.ceil(parseFloat(match[1])) * 1000 + 2000; // +2s buffer
  return 30000; // mặc định 30s
}

// ===== TẠO ID ĐỘC NHẤT CHO MỖI TỪ =====
// Dùng làm document ID trong Firestore để tránh trùng khi re-import
function makeWordId(word: string, level: string): string {
  // Loại ký tự đặc biệt, dùng word + level làm ID
  return `${level}_${word.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_")}`;
}

// ===== ĐỌC FILE EXCEL =====
function readExcelFile(filePath: string): string[][] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
}

// ===== TẠO CÂU VÍ DỤ BẰNG GEMINI (CÓ RETRY KHI BỊ 429) =====
async function generateExample(
  word: string,
  reading: string,
  meaning: string,
  level: string,
  maxRetries = 4
): Promise<{ example: string; exampleMeaning: string }> {
  const difficultyNote =
    level === "N5" ? "rất đơn giản, dùng từ cơ bản nhất" :
    level === "N4" ? "tương đối đơn giản, có thể dùng thì て形" :
    "bình thường, có thể dùng thì phức tạp hơn";

  const prompt = `Bạn là giáo viên dạy tiếng Nhật ${level}. Hãy tạo 1 câu ví dụ TỰ NHIÊN, ĐÚNG NGỮ PHÁP cho từ vựng sau:

Từ: ${word}
Cách đọc: ${reading}
Nghĩa: ${meaning}
Trình độ: ${level} (câu nên ${difficultyNote})

Yêu cầu bắt buộc:
- Câu phải TỰ NHIÊN, đúng ngữ pháp tiếng Nhật
- Câu phải chứa từ "${word}"
- KHÔNG dùng mẫu câu máy móc như "〇〇を使います" hoặc "〇〇があります"
- Câu nên có chủ thể rõ ràng và hành động/mô tả cụ thể

Ví dụ tốt cho "日本" (Nhật Bản): {"example": "私は日本に住んでいます。", "exampleMeaning": "Tôi đang sống ở Nhật Bản."}
Ví dụ tốt cho "食べる" (ăn): {"example": "毎朝パンを食べます。", "exampleMeaning": "Mỗi sáng tôi ăn bánh mì."}

Trả về JSON với đúng 2 trường:
{"example": "câu tiếng Nhật", "exampleMeaning": "nghĩa tiếng Việt"}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.example?.includes("を使います") && !word.includes("使")) {
        console.warn(`  ⚠️  Câu ví dụ có vẻ không tự nhiên: ${parsed.example}`);
      }

      return parsed;

    } catch (err) {
      const errMsg = (err as Error).message || "";
      const is429 = errMsg.includes("429") || errMsg.includes("Too Many Requests");

      if (is429 && attempt < maxRetries) {
        const waitMs = extractRetryDelay(errMsg);
        console.warn(`  ⏱️  Rate limit 429 — thử lại sau ${waitMs / 1000}s (lần ${attempt}/${maxRetries - 1})...`);
        await sleep(waitMs);
        continue;
      }

      if (is429) {
        console.error(`  ❌ Đã hết ${maxRetries - 1} lần retry, dùng câu fallback.`);
      } else {
        console.error(`  ❌ Lỗi Gemini: ${errMsg.slice(0, 100)}`);
      }
      break;
    }
  }

  // Fallback — không có câu ví dụ
  return {
    example: "",
    exampleMeaning: "",
  };
}

// ===== HÀM CHÍNH =====
async function main() {
  console.log(`\n${"=".repeat(55)}`);
  console.log(`📚 NHẬP TỪ VỰNG ${LEVEL} VÀO FIREBASE`);
  console.log(`   Chế độ  : ${runAll ? "TOÀN BỘ" : `TEST ${TEST_LIMIT} TỪ ĐẦU`}`);
  console.log(`   Gemini  : ${noAi ? "❌ TẮT (--no-ai)" : regenAi ? "♻️  Chỉ regen câu trống" : "✅ BẬT"}`);
  if (clearReimport) console.log(`   🗑️  Clear-reimport: BẬT — sẽ XÓA từ import cũ, giữ từ điển`);
  if (syncDelete)    console.log(`   🗑️  Sync-delete   : BẬT — xóa từ không còn trong Excel`);
  console.log(`${"=".repeat(55)}\n`);

  // ===== BƯỚC 0: CLEAR-REIMPORT — xóa từ import cũ =====
  if (clearReimport) {
    console.log(`🗑️  CLEAR-REIMPORT: Đang xóa tất cả từ import cũ level ${LEVEL}...`);
    console.log(`   (Chỉ xóa từ KHÔNG có source="dictionary" — từ điển của bạn được giữ nguyên)\n`);

    const allSnap = await getDocs(
      query(collection(db, "vocabulary"), where("level", "==", LEVEL))
    );

    let deletedCount = 0;
    let keptCount = 0;
    for (const d of allSnap.docs) {
      const data = d.data();
      if (data.source === "dictionary") {
        keptCount++;
        // Giữ lại — đây là từ người dùng tự lưu từ từ điển
      } else {
        await deleteDoc(doc(db, "vocabulary", d.id));
        deletedCount++;
      }
    }

    console.log(`   ✅ Đã xóa ${deletedCount} từ import cũ`);
    console.log(`   🔒 Giữ lại ${keptCount} từ từ điển (source="dictionary")\n`);
  }

  // Kiểm tra file Excel
  const excelFileName = `${LEVEL.toLowerCase()}vocab.xlsx`;
  const excelPath = path.join(process.cwd(), "scripts", excelFileName);

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Không tìm thấy file Excel: ${excelPath}`);
    console.error(`   → Copy file vào thư mục scripts/ với tên: ${excelFileName}`);
    process.exit(1);
  }

  // Đọc file Excel
  console.log(`📖 Đọc file: ${excelFileName}`);
  const rows = readExcelFile(excelPath);
  const allDataRows = rows
    .slice(1)
    .filter((row) => row[0] && row[0].toString().trim() !== "");

  const dataRows = runAll ? allDataRows : allDataRows.slice(0, TEST_LIMIT);
  console.log(`📊 Tổng số từ trong Excel: ${allDataRows.length}`);
  console.log(`📝 Sẽ xử lý: ${dataRows.length} từ\n`);

  // Lấy danh sách từ đang có trong Firebase (chỉ level này)
  console.log(`🔍 Đang kiểm tra Firebase hiện tại...`);
  const existingSnap = await getDocs(
    query(collection(db, "vocabulary"), where("level", "==", LEVEL))
  );
  // Map: wordId → { docId, hasExample }
  const existingMap = new Map<string, { docId: string; hasExample: boolean }>();
  existingSnap.forEach((d) => {
    const data = d.data();
    if (data.wordId) {
      existingMap.set(data.wordId, {
        docId: d.id,
        hasExample: !!(data.example && data.example.trim() !== ""),
      });
    }
  });
  console.log(`   → Đang có ${existingMap.size} từ ${LEVEL} trong Firebase\n`);

  // Bắt đầu nhập
  let countNew = 0;
  let countUpdate = 0;
  let countSkip = 0;
  let countError = 0;
  const processedWordIds = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const word    = row[0]?.toString().trim() || "";
    const reading = row[1]?.toString().trim() || word;
    const type    = row[2]?.toString().trim() || "N";
    const meaning = row[3]?.toString().trim() || "";

    if (!word || !meaning) continue;

    const wordId = makeWordId(word, LEVEL);
    processedWordIds.add(wordId);

    const existing = existingMap.get(wordId);
    const isExisting = !!existing;
    const totalLabel = runAll ? allDataRows.length : TEST_LIMIT;
    console.log(`--------------------------------------------------`);
    console.log(`⏳ [${i + 1}/${totalLabel}] "${word}" — ${isExisting ? "🔄 Cập nhật" : "✨ Từ mới"}`);

    // Chế độ --regen: chỉ xử lý từ chưa có câu ví dụ
    if (regenAi && isExisting && existing?.hasExample) {
      console.log(`   ⏭️  Bỏ qua (đã có câu ví dụ)`);
      countSkip++;
      continue;
    }

    try {
      let example = "";
      let exampleMeaning = "";

      const needGemini = !noAi && (!isExisting || (regenAi && !existing?.hasExample));

      if (needGemini) {
        console.log(`   Đang gọi Gemini AI...`);
        const result = await generateExample(word, reading, meaning, LEVEL);
        example = result.example;
        exampleMeaning = result.exampleMeaning;
        console.log(`   📝 Ví dụ: ${example || "(không có)"}`);
        console.log(`   📝 Nghĩa: ${exampleMeaning || "(không có)"}`);
      } else if (noAi) {
        console.log(`   ⏭️  Bỏ qua Gemini (--no-ai)`);
        if (isExisting) countSkip++;
      } else {
        console.log(`   ⏭️  Bỏ qua Gemini (từ đã tồn tại)`);
        countSkip++;
      }

      // UPSERT bằng setDoc với ID cố định → không bao giờ bị trùng
      const docRef = doc(db, "vocabulary", wordId);

      if (regenAi && isExisting) {
        // Chỉ cập nhật câu ví dụ, giữ nguyên status và dữ liệu học của người dùng
        await setDoc(docRef, { example, exampleMeaning, updatedAt: new Date() }, { merge: true });
        countUpdate++;
        console.log(`   ✅ Đã cập nhật câu ví dụ`);
      } else if (isExisting) {
        // Cập nhật thông tin cơ bản (word/reading/meaning có thể đã sửa trong Excel)
        await setDoc(docRef, {
          wordId, word, reading,
          type: type || "N",
          meaning, level: LEVEL,
          updatedAt: new Date(),
        }, { merge: true });
        countUpdate++;
        console.log(`   ✅ Đã cập nhật thông tin`);
      } else {
        // Từ mới hoàn toàn
        await setDoc(docRef, {
          wordId, word, reading,
          type: type || "N",
          meaning, level: LEVEL,
          example,
          exampleMeaning,
          status: "new",
          createdAt: new Date(),
        });
        countNew++;
        console.log(`   ✅ Đã thêm mới`);
        // Delay 5s sau mỗi từ mới gọi Gemini
        if (!noAi) await sleep(5000);
      }

    } catch (error) {
      countError++;
      console.error(`   ❌ Lỗi hệ thống: ${(error as Error).message?.slice(0, 80)}`);
    }
  }

  // SYNC DELETE: xóa các từ trong Firebase không còn trong Excel
  if (syncDelete && runAll) {
    console.log(`\n${"=".repeat(55)}`);
    console.log(`🗑️  SYNC DELETE: Tìm từ cần xóa...`);
    const toDelete: string[] = [];
    existingMap.forEach((entry, wId) => {
      if (!processedWordIds.has(wId)) toDelete.push(entry.docId);
    });

    if (toDelete.length === 0) {
      console.log(`   ✅ Không có từ nào cần xóa.`);
    } else {
      console.log(`   ⚠️  Sẽ xóa ${toDelete.length} từ không còn trong Excel:`);
      for (const docId of toDelete) {
        await deleteDoc(doc(db, "vocabulary", docId));
        console.log(`   🗑️  Đã xóa doc: ${docId}`);
      }
    }
  }

  // TỔNG KẾT
  console.log(`\n${"=".repeat(55)}`);
  console.log(`🎉 HOÀN THÀNH!`);
  console.log(`   ✨ Thêm mới    : ${countNew} từ`);
  console.log(`   🔄 Cập nhật   : ${countUpdate} từ`);
  console.log(`   ⏭️  Bỏ qua     : ${countSkip} từ (đã có Gemini)`);
  console.log(`   ❌ Lỗi        : ${countError} từ`);
  if (!runAll) {
    console.log(`\n💡 Để import toàn bộ, chạy lệnh:`);
    console.log(`   node_modules\\.bin\\tsx scripts\\import-from-excel.ts --level=${LEVEL} --all`);
  }
  console.log(`${"=".repeat(55)}\n`);
  process.exit(0);
}

main();