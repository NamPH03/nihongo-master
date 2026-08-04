// scripts/import-n5-excel-csv.js
// Script đọc file Excel (dạng CSV gộp trong 1 cột) và import vào Firestore collection `vocabulary`
// Dùng Firebase Admin SDK để ghi hàng loạt (batch write).
// Hỗ trợ nhiều bộ từ vựng (N5, FnB, ...) qua tham số --course, chỉ cần khai báo thêm
// trong object COURSES bên dưới khi có file Excel mới (giữ đúng format cột như N5_vocab.xlsx).
//
// CÁCH CHẠY:
//   node scripts/import-n5-excel-csv.js --import                → xem trước + import bộ N5 (mặc định)
//   node scripts/import-n5-excel-csv.js                          → chỉ xem trước bộ N5, KHÔNG ghi Firestore
//   node scripts/import-n5-excel-csv.js --course=fnb --import    → xem trước + import bộ FnB (ăn uống)
//   node scripts/import-n5-excel-csv.js --course=fnb             → chỉ xem trước bộ FnB

const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const dotenv = require("dotenv");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

dotenv.config({ path: ".env.local" });

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "")
  .replace(/^"/, "").replace(/"$/, "")
  .replace(/\\n/g, "\n");

const adminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      })
    : getApps()[0];

const db = getFirestore(adminApp);

// ====== Cấu hình từng bộ từ vựng ======
// docPrefix dùng để tạo document ID (word + lessonId) → PHẢI giữ nguyên giá trị cũ
// của các course đã import trước đó, nếu không sẽ tạo document trùng lặp thay vì ghi đè.
const COURSES = {
  n5: {
    excelPath: path.join(__dirname, "../Vocabulary/N5_vocab/N5_vocab.xlsx"),
    courseId: "jlpt-n5",
    courseName: "Tiếng Nhật N5 (Sơ cấp 1)",
    docPrefix: "N5",
  },
  fnb: {
    excelPath: path.join(__dirname, "../Vocabulary/FnB_vocab/FnB_vocab.xlsx"),
    courseId: "tu-vung-an-uong",
    courseName: "Từ vựng Ăn uống (Nhà hàng - Ẩm thực)",
    docPrefix: "FnB",
  },
  travel: {
    excelPath: path.join(__dirname, "../Vocabulary/Travel_vocab/Travel_vocab.xlsx"),
    courseId: "tu-vung-du-lich",
    courseName: "Từ vựng Du lịch (Travel)",
    docPrefix: "Travel",
  },
  cultural: {
    excelPath: path.join(__dirname, "../Vocabulary/JP_culture_vocab/JP_culture_vocab.xlsx"),
    courseId: "van-hoa-nhat-ban",
    courseName: "Từ vựng Văn hóa (Culture)",
    docPrefix: "Cultural",
  },

};

function parseCSVLine(text) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

function getArgValue(flag) {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const courseKey = (getArgValue("course") || "n5").toLowerCase();
  const course = COURSES[courseKey];

  if (!course) {
    console.error(
      `❌ Không tìm thấy cấu hình cho course "${courseKey}". Các course hợp lệ: ${Object.keys(COURSES).join(", ")}`
    );
    process.exit(1);
  }

  if (!fs.existsSync(course.excelPath)) {
    console.error("❌ Không tìm thấy file Excel:", course.excelPath);
    process.exit(1);
  }

  console.log(`📖 [${courseKey}] Đang đọc file:`, course.excelPath);
  const workbook = xlsx.readFile(course.excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const parsedVocabList = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rawLine = rawRows[i]?.[0];
    if (!rawLine || typeof rawLine !== "string" || rawLine.trim() === "") continue;

    let fields = parseCSVLine(rawLine);
    if (fields.length < 9) continue;

    // Cấu trúc cột tiêu chuẩn từ file CSV:
    // [0] word, [1] reading, [2] meaning, [3] type, [4] level, [5] example, [6] exampleMeaning, [7] courseId, [8] lessonId, [9...] lessonTitle (có thể bị split nếu title chứa phẩy)
    const word = fields[0];
    let reading = fields[1];
    let meaning = fields[2];
    let type = fields[3];
    let level = fields[4];
    let example = fields[5];

    // Lấy lessonId bằng regex tìm "lesson-xx" từ các trường phía sau
    let lessonId = "";
    let lessonIdIdx = -1;
    for (let j = 6; j < fields.length; j++) {
      if (fields[j] && fields[j].startsWith("lesson-")) {
        lessonId = fields[j];
        lessonIdIdx = j;
        break;
      }
    }

    if (!lessonId || lessonIdIdx === -1) continue;

    // lessonTitle là tất cả phần sau lessonId
    const lessonTitle = fields.slice(lessonIdIdx + 1).join(", ");

    // exampleMeaning là tất cả phần giữa example và courseId (fields[lessonIdIdx - 1])
    const exampleMeaning = fields.slice(6, lessonIdIdx - 1).join(", ");

    if (!word || word === "word") continue;

    parsedVocabList.push({
      word,
      reading: reading || word,
      meaning: meaning || "",
      type: type || "N",
      level: (level || "N5").toUpperCase(),
      example: example || "",
      exampleMeaning: exampleMeaning || "",
      courseId: course.courseId,
      courseName: course.courseName,
      lessonId,
      lessonTitle: lessonTitle || lessonId,
      source: `${courseKey}_excel_csv_import`,
    });
  }

  console.log(`📊 [${courseKey}] Tìm thấy tổng cộng ${parsedVocabList.length} từ vựng từ Excel.\n`);

  if (!process.argv.includes("--import")) {
    console.log("ℹ️ Thêm cờ --import để tiến hành ghi vào Firestore.");
    process.exit(0);
  }

  console.log("🚀 Đang tiến hành ghi hàng loạt vào Firestore...");
  const BATCH_SIZE = 400;
  let successCount = 0;

  for (let i = 0; i < parsedVocabList.length; i += BATCH_SIZE) {
    const chunk = parsedVocabList.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      // Document ID cố định theo docPrefix (riêng cho từng course) + word + lessonId để tránh trùng lặp
      const docId = `${course.docPrefix}_${item.word.replace(/\//g, "_")}_${item.lessonId}`;
      const docRef = db.collection("vocabulary").doc(docId);
      batch.set(docRef, item, { merge: true });
    }

    await batch.commit();
    successCount += chunk.length;
    console.log(`   ⚡ Đã ghi [${successCount}/${parsedVocabList.length}] từ vựng...`);
  }

  console.log("\n=======================================================");
  console.log(`🎉 Hoàn tất! Đã ghi ${successCount} từ vựng [${courseKey}] vào Firestore.`);
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("❌ Lỗi:", err);
  process.exit(1);
});