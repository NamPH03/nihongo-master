import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: ".env.local" });

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

// Tạo câu ví dụ dựa theo loại từ — không cần AI
function generateExample(word: string, type: string, meaning: string): { example: string; exampleMeaning: string } {
  const t = type.toLowerCase();

  if (t.includes("v i") && !t.includes("v ii") && !t.includes("v iii")) {
    return {
      example: `毎日${word}ます。`,
      exampleMeaning: `Mỗi ngày tôi ${meaning}.`,
    };
  }
  if (t.includes("v ii")) {
    return {
      example: `${word}ます。`,
      exampleMeaning: `Tôi ${meaning}.`,
    };
  }
  if (t.includes("v iii")) {
    return {
      example: `毎日${word}ます。`,
      exampleMeaning: `Tôi ${meaning} mỗi ngày.`,
    };
  }
  if (t.includes("a い") || t.includes("aい")) {
    return {
      example: `とても${word}です。`,
      exampleMeaning: `Rất ${meaning}.`,
    };
  }
  if (t.includes("a な") || t.includes("aな")) {
    return {
      example: `${word}な人です。`,
      exampleMeaning: `Đây là người ${meaning}.`,
    };
  }
  if (t.includes("adv")) {
    return {
      example: `${word}勉強します。`,
      exampleMeaning: `Tôi học ${meaning}.`,
    };
  }
  // Mặc định — danh từ
  return {
    example: `これは${word}です。`,
    exampleMeaning: `Đây là ${meaning}.`,
  };
}

function readExcel(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
}

async function deleteOldData() {
  console.log("🗑️  Xóa dữ liệu cũ...");
  const snapshot = await getDocs(collection(db, "vocabulary"));
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "vocabulary", document.id));
  }
  console.log(`✅ Đã xóa ${snapshot.size} từ cũ\n`);
}

async function main() {
  const excelPath = path.join(process.cwd(), "scripts", "n5vocab.xlsx");
  console.log("📖 Đọc file Excel...");
  const rows = readExcel(excelPath);
  const dataRows = rows.slice(1).filter((row) => row[0]?.toString().trim());
  console.log(`✅ Tìm thấy ${dataRows.length} từ\n`);

  await deleteOldData();

  console.log("🚀 Nhập từ vựng vào Firebase...\n");
  let count = 0;
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const word    = row[0]?.toString().trim() || "";
    const reading = row[1]?.toString().trim() || "";
    const type    = row[2]?.toString().trim() || "N";
    const meaning = row[3]?.toString().trim() || "";

    if (!word || !meaning) { skipped++; continue; }

    const { example, exampleMeaning } = generateExample(word, type, meaning);

    try {
      await addDoc(collection(db, "vocabulary"), {
        word,
        reading: reading || word,
        type,
        meaning,
        level: "N5",
        example,
        exampleMeaning,
        status: "new",
        createdAt: new Date(),
      });
      count++;
      console.log(`✅ [${count}] ${word} — ${meaning}`);
    } catch (err) {
      console.error(`❌ Lỗi: ${word}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`🎉 HOÀN THÀNH!`);
  console.log(`   ✅ Nhập thành công : ${count} từ`);
  console.log(`   ⏭️  Bỏ qua         : ${skipped} từ`);
  console.log(`${"=".repeat(50)}`);
  process.exit(0);
}

main();