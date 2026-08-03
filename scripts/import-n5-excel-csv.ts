// scripts/import-n5-excel-csv.ts
// Script import từ vựng N5 từ file Excel (chứa chuỗi CSV) vào Firebase Firestore
// Đường dẫn file mặc định: Vocabulary/N5_vocab/N5_vocab.xlsx
//
// CÁCH CHẠY:
//   1. Thử nghiệm / Dry-run (chỉ đọc và kiểm tra 10 dòng đầu, KHÔNG ghi Firebase):
//        node -r esm scripts/import-n5-excel-csv.ts  (hoặc dùng npx tsx)
//        node scripts/import-n5-excel-csv.js --dry-run
//
//   2. Import toàn bộ vào Firebase:
//        node_modules\.bin\tsx scripts\import-n5-excel-csv.ts --import
//        HOẶC: node -r ts-node/register scripts/import-n5-excel-csv.ts --import
//        HOẶC: npx tsx scripts/import-n5-excel-csv.ts --import

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
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

// Khởi tạo Firebase
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

// Hàm parse 1 dòng CSV hỗ trợ dấu ngoặc kép (dấu comma bên trong "")
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Tạo document ID duy nhất cho từ vựng
function makeWordId(word: string, level: string, lessonId?: string): string {
  const cleanWord = word.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_");
  const suffix = lessonId ? `_${lessonId}` : "";
  return `${level}_${cleanWord}${suffix}`;
}

interface VocabRecord {
  word: string;
  reading: string;
  meaning: string;
  type: string;
  level: string;
  example: string;
  exampleMeaning: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  source: string;
  updatedAt: Date;
}

async function main() {
  const args = process.argv.slice(2);
  const isImportMode = args.includes("--import");
  const isDryRun = args.includes("--dry-run") || !isImportMode;

  console.log("\n=======================================================");
  console.log("📚 IMPORT TỪ VỰNG N5 TỪ FILE EXCEL (NỘI DUNG CSV)");
  console.log(`📌 Chế độ: ${isImportMode ? "🚀 THỰC THI (Ghi vào Firestore)" : "🔍 KIỂM THỬ (Dry-run)"}`);
  console.log("=======================================================\n");

  const filePath = path.join(process.cwd(), "Vocabulary", "N5_vocab", "N5_vocab.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file tại: ${filePath}`);
    process.exit(1);
  }

  console.log(`📖 Đang đọc file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  console.log(`📊 Tổng số dòng trong file Excel: ${rawRows.length}`);

  if (rawRows.length <= 1) {
    console.error("❌ File rỗng hoặc không có dữ liệu!");
    process.exit(1);
  }

  const parsedVocabList: VocabRecord[] = [];
  let invalidCount = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const rawLine = rawRows[i]?.[0];
    if (!rawLine || typeof rawLine !== "string" || rawLine.trim() === "") continue;

    const fields = parseCSVLine(rawLine);
    if (fields.length < 10) {
      console.warn(`⚠️ Dòng ${i + 1} thiếu trường (${fields.length}/10): ${rawLine.slice(0, 60)}...`);
      invalidCount++;
      continue;
    }

    const [
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
    ] = fields;

    if (!word) {
      invalidCount++;
      continue;
    }

    parsedVocabList.push({
      word,
      reading: reading || word,
      meaning: meaning || "",
      type: type || "N",
      level: (level || "N5").toUpperCase(),
      example: example || "",
      exampleMeaning: exampleMeaning || "",
      courseId: courseId || "jlpt-n5",
      lessonId: lessonId || "",
      lessonTitle: lessonTitle || "",
      source: "n5_excel_import",
      updatedAt: new Date(),
    });
  }

  console.log(`✅ Đã parse thành công: ${parsedVocabList.length} từ vựng`);
  if (invalidCount > 0) {
    console.log(`⚠️ Số dòng lỗi/bỏ qua: ${invalidCount}`);
  }

  console.log("\n--- MẪU 3 TỪ ĐẦU TIÊN PARSE ĐƯỢC ---");
  console.log(JSON.stringify(parsedVocabList.slice(0, 3), null, 2));
  console.log("------------------------------------\n");

  if (isDryRun) {
    console.log("💡 Bạn đang ở chế độ Dry-run (chỉ xem trước).");
    console.log("👉 Để import chính thức vào Firestore, chạy lệnh:");
    console.log("   node_modules\\.bin\\tsx scripts/import-n5-excel-csv.ts --import\n");
    return;
  }

  // TIẾN HÀNH GHI VÀO FIRESTORE
  console.log("🚀 Đang tiến hành ghi dữ liệu vào Firebase Firestore (collection: 'vocabulary')...");

  // Kiểm tra danh sách hiện tại
  const existingSnap = await getDocs(query(collection(db, "vocabulary"), where("level", "==", "N5")));
  console.log(`🔍 Hiện có ${existingSnap.size} từ vựng N5 trong Firestore.`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < parsedVocabList.length; i++) {
    const item = parsedVocabList[i];
    const docId = makeWordId(item.word, item.level, item.lessonId);
    const docRef = doc(db, "vocabulary", docId);

    try {
      await setDoc(docRef, item, { merge: true });
      successCount++;
      if ((i + 1) % 50 === 0 || i === parsedVocabList.length - 1) {
        console.log(`   [${i + 1}/${parsedVocabList.length}] Đã lưu: ${item.word} (${item.meaning})`);
      }
    } catch (err) {
      errorCount++;
      console.error(`❌ Lỗi khi ghi từ '${item.word}':`, err);
    }
  }

  console.log("\n=======================================================");
  console.log(`🎉 HOÀN THÀNH IMPORT N5!`);
  console.log(`✅ Thành công: ${successCount} từ`);
  if (errorCount > 0) console.log(`❌ Thất bại: ${errorCount} từ`);
  console.log("=======================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi Script:", err);
  process.exit(1);
});
