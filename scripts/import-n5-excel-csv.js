// scripts/import-n5-excel-csv.js
// Script Node.js sử dụng Firebase Admin SDK để ghi trực tiếp từ vựng N5 vào Firestore
// File Excel: C:\Users\NamPH's PC\Projects\nihongo-master\Vocabulary\N5_vocab\N5_vocab.xlsx

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const dotenv = require("dotenv");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Nạp biến môi trường từ .env.local
dotenv.config({ path: ".env.local" });

// Khởi tạo Firebase Admin SDK
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error("❌ Thiếu cấu hình Firebase Admin SDK trong .env.local!");
  process.exit(1);
}

let formattedKey = privateKey;
if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
  formattedKey = formattedKey.slice(1, -1);
}
formattedKey = formattedKey.replace(/\\n/g, "\n");

const adminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
      })
    : getApps()[0];

const db = getFirestore(adminApp);

function parseCSVLine(line) {
  const result = [];
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

function makeWordId(word, level, lessonId) {
  const cleanWord = word.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_");
  const suffix = lessonId ? `_${lessonId}` : "";
  return `${level}_${cleanWord}${suffix}`;
}

async function main() {
  const filePath = path.join(process.cwd(), "Vocabulary", "N5_vocab", "N5_vocab.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file Excel tại: ${filePath}`);
    process.exit(1);
  }

  console.log(`📖 Đang đọc file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rawRows.length <= 1) {
    console.error("❌ File không có dữ liệu!");
    process.exit(1);
  }

  const parsedVocabList = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rawLine = rawRows[i]?.[0];
    if (!rawLine || typeof rawLine !== "string" || rawLine.trim() === "") continue;

    let fields = parseCSVLine(rawLine);

    // Xử lý trường hợp thiếu cột reading (từ Katakana như パート)
    if (fields.length === 9) {
      fields.splice(1, 0, fields[0]);
    }

    if (fields.length < 10) continue;

    // === RIGHT-ANCHORED PARSING ===
    // Một số câu ví dụ/nghĩa tiếng Việt chứa dấu phẩy làm tăng số cột.
    // Giải pháp: lấy 3 trường ổn định từ phải (courseId, lessonId, lessonTitle),
    // rồi rejoin phần còn lại ở giữa cho exampleMeaning.
    const word        = fields[0];
    const reading     = fields[1];
    // type và level không có dấu phẩy, nằm ở vị trí cố định từ trái
    const type        = fields[3];
    const level       = fields[4];
    const example     = fields[5]; // tiếng Nhật, không có dấu phẩy ASCII
    // Từ phải: courseId (-3), lessonId (-2), lessonTitle (-1)
    const lessonTitle     = fields[fields.length - 1];
    const lessonId        = fields[fields.length - 2];
    const courseId        = fields[fields.length - 3];
    // meaning nằm ở fields[2], exampleMeaning là tất cả phần còn lại giữa example và courseId
    const meaning         = fields[2];
    const exampleMeaning  = fields.slice(6, fields.length - 3).join(",");

    if (!word) continue;

    parsedVocabList.push({
      word,
      reading: reading || word,
      meaning: meaning || "",
      type: type || "N",
      level: (level || "N5").toUpperCase(),
      example: example || "",
      exampleMeaning: exampleMeaning || "",
      courseId: courseId || "jlpt-n5",
      courseName: "Tiếng Nhật N5 (Sơ cấp 1)",
      lessonId: lessonId || "",
      lessonTitle: lessonTitle || "",
      source: "n5_excel_csv_import",
      updatedAt: new Date(),
    });
  }

  console.log(`🚀 Đang cập nhật courseName và lessonTitle cho ${parsedVocabList.length} từ vựng...`);

  const BATCH_SIZE = 400;
  let successCount = 0;

  for (let i = 0; i < parsedVocabList.length; i += BATCH_SIZE) {
    const chunk = parsedVocabList.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      const docId = makeWordId(item.word, item.level, item.lessonId);
      const docRef = db.collection("vocabulary").doc(docId);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();
    successCount += chunk.length;
  }

  console.log(`✅ Hoàn tất cập nhật ${successCount} từ!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi Script:", err);
  process.exit(1);
});
