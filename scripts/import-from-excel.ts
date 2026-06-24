// scripts/import-from-excel.ts
// Đọc Excel → tạo câu ví dụ bằng Gemini AI → nhập vào Firebase

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

// ===== KHỞI ĐỘNG GEMINI =====
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

// ===== ĐỌC FILE EXCEL =====
function readExcelFile(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
  return data;
}

// ===== TẠO CÂU VÍ DỤ BẰNG GEMINI =====
async function generateExample(
  word: string,
  reading: string,
  meaning: string
): Promise<{ example: string; exampleMeaning: string }> {
  try {
    const prompt = `Tạo 1 câu ví dụ tiếng Nhật đơn giản (trình độ N5) cho từ sau:
- Từ: ${word}
- Cách đọc: ${reading}  
- Nghĩa: ${meaning}

Yêu cầu:
- Câu ngắn gọn, đơn giản, phù hợp N5
- Phải dùng từ "${word}" trong câu
- Chỉ trả về JSON, không giải thích thêm

Định dạng trả về:
{"example": "câu tiếng Nhật ở đây", "exampleMeaning": "nghĩa tiếng Việt ở đây"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Xử lý trường hợp Gemini trả về markdown code block
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return parsed;

  } catch {
    // Nếu lỗi → dùng câu mặc định đơn giản
    return {
      example: `${word}を使います。`,
      exampleMeaning: `Tôi sử dụng ${meaning}.`,
    };
  }
}

// ===== XÓA DỮ LIỆU CŨ =====
async function deleteOldData() {
  console.log("🗑️  Xóa dữ liệu cũ trong Firebase...");
  const snapshot = await getDocs(collection(db, "vocabulary"));
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "vocabulary", document.id));
  }
  console.log(`✅ Đã xóa ${snapshot.size} từ cũ\n`);
}

// ===== HÀM CHÍNH =====
async function main() {
  // Kiểm tra file Excel
  const excelPath = path.join(process.cwd(), "scripts", "n5vocab.xlsx");

  if (!fs.existsSync(excelPath)) {
    console.error("❌ Không tìm thấy file Excel!");
    console.error(`   Copy file vào đây: ${excelPath}`);
    process.exit(1);
  }

  // Đọc file Excel
  console.log("📖 Đang đọc file Excel...");
  const rows = readExcelFile(excelPath);

  // Bỏ dòng tiêu đề → lọc dòng có dữ liệu
  const dataRows = rows
    .slice(1)
    .filter((row) => row[0] && row[0].toString().trim() !== "");

  console.log(`✅ Tìm thấy ${dataRows.length} từ vựng trong file\n`);

  // Xóa dữ liệu cũ
  await deleteOldData();

  // Nhập từng từ
  console.log("🚀 Bắt đầu nhập từ vựng vào Firebase...\n");
  let count = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    const word    = row[0]?.toString().trim() || "";
    const reading = row[1]?.toString().trim() || "";
    const type    = row[2]?.toString().trim() || "N";
    const meaning = row[3]?.toString().trim() || "";

    // Bỏ qua dòng không có từ hoặc nghĩa
    if (!word || !meaning) continue;

    try {
      // Tạo câu ví dụ bằng Gemini
      process.stdout.write(
        `⏳ [${i + 1}/${dataRows.length}] ${word} — đang tạo ví dụ...`
      );

      const { example, exampleMeaning } = await generateExample(
        word, reading, meaning
      );

      // Lưu vào Firebase
      await addDoc(collection(db, "vocabulary"), {
        word,
        reading: reading || word,
        type: type || "N",
        meaning,
        level: "N5",
        example,
        exampleMeaning,
        status: "new",      // new = chưa học lần nào
        createdAt: new Date(),
      });

      count++;
      process.stdout.write(
        `\r✅ [${count}/${dataRows.length}] ${word} — ${meaning}\n`
      );

      // Nghỉ 0.5 giây giữa các từ — tránh bị Gemini chặn
      await new Promise((r) => setTimeout(r, 500));

    } catch (error) {
      errors++;
      console.error(`\r❌ Lỗi tại từ: ${word}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`🎉 HOÀN THÀNH!`);
  console.log(`   ✅ Nhập thành công : ${count} từ`);
  console.log(`   ❌ Lỗi            : ${errors} từ`);
  console.log(`${"=".repeat(50)}`);
  process.exit(0);
}

main();