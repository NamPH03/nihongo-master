// scripts/clear-and-reimport-n4.ts
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, query, where } from "firebase/firestore";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

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

// Đọc file Excel N4 và chuẩn hóa thông tin bài học dựa vào tên file (tránh lỗi dữ liệu gõ sai trong Excel)
function readN4Excel(filePath: string, fileName: string): VocabRow[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

  // Trích xuất phần hậu tố (ví dụ: "15A", "23C") từ tên file "TuVung_23C.xlsx"
  const fileMatch = fileName.match(/TuVung_(\d+[A-Za-z]+)\.xlsx/i);
  const suffix = fileMatch ? fileMatch[1].toUpperCase() : ""; // "23C", "15A", ...
  const lessonIdFromFileName = suffix ? `ID_${suffix.toLowerCase()}` : ""; // "ID_23c", ...
  const lessonTitleFromFileName = suffix ? suffix : ""; // "23C", ...

  return rows
    .slice(1) // bỏ header
    .filter((row) => row[4]?.toString().trim()) // cột E = Word phải có
    .map((row) => {
      const originalLessonId = String(row[2] || "").trim();
      const originalLessonTitle = String(row[3] || "").trim();

      // Nếu tên file chứa hậu tố hợp lệ, ưu tiên sử dụng để sửa lỗi dữ liệu Excel
      const finalLessonId = lessonIdFromFileName || originalLessonId;
      const finalLessonTitle = lessonTitleFromFileName || originalLessonTitle;

      return {
        courseId:       String(row[0]  || "").trim(),
        courseName:     String(row[1]  || "").trim(),
        lessonId:       finalLessonId,
        lessonTitle:    finalLessonTitle,
        word:           String(row[4]  || "").trim(),
        reading:        String(row[5]  || row[4] || "").trim(),
        type:           String(row[6]  || "N").trim(),
        meaning:        String(row[7]  || "").trim(),
        example:        String(row[8]  || "").trim(),
        exampleMeaning: String(row[9]  || "").trim(),
        level:          String(row[10] || "N4").trim(),
      };
    });
}

function makeCleanDocId(courseId: string, lessonId: string, word: string): string {
  const cleanWord = word.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_");
  return `course_${courseId}_lesson_${lessonId}_word_${cleanWord}`;
}

async function execute() {
  try {
    console.log("🔥 BƯỚC 1: XÓA TOÀN BỘ TỪ VỰNG N4 HIỆN TẠI TRONG DB...");
    const snap = await getDocs(
      query(collection(db, "vocabulary"), where("level", "==", "N4"))
    );
    
    console.log(`🔎 Tìm thấy ${snap.size} từ vựng N4 đang có trong Firebase.`);
    
    let deleteCount = 0;
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, "vocabulary", docSnap.id));
      deleteCount++;
      if (deleteCount % 50 === 0 || deleteCount === snap.size) {
        console.log(`   🗑️ Đã xóa ${deleteCount}/${snap.size} từ...`);
      }
    }
    console.log("✅ Hoàn thành xóa toàn bộ từ vựng N4!");

    console.log("\n📥 BƯỚC 2: TIẾN HÀNH THÊM LẠI TỪ EXCEL TRONG FOLDER N4_vocab/ ...");
    const vocabDir = path.join(process.cwd(), "N4_vocab");
    const allFiles = fs.readdirSync(vocabDir)
      .filter((f) => f.endsWith(".xlsx"))
      .sort();

    console.log(`Tìm thấy ${allFiles.length} file Excel trong thư mục N4_vocab.`);
    
    let importCount = 0;
    
    for (const fileName of allFiles) {
      const filePath = path.join(vocabDir, fileName);
      const rows = readN4Excel(filePath, fileName);
      
      if (rows.length === 0) continue;
      
      const { lessonTitle, lessonId, courseId } = rows[0];
      console.log(`👉 Đang import: ${fileName} (${lessonTitle}) - ${rows.length} từ`);
      
      for (const row of rows) {
        if (!row.word || !row.meaning) continue;
        
        const docId = makeCleanDocId(row.courseId, row.lessonId, row.word);
        
        await setDoc(doc(db, "vocabulary", docId), {
          wordId: docId,
          word:           row.word,
          reading:        row.reading,
          type:           row.type,
          meaning:        row.meaning,
          level:          "N4",
          courseId:       row.courseId,
          courseName:     row.courseName,
          lessonId:       row.lessonId,
          lessonTitle:    row.lessonTitle,
          example:        row.example || "",
          exampleMeaning: row.exampleMeaning || "",
          status:         "new",
          createdAt:      new Date().toISOString(),
        });
        
        importCount++;
      }
    }
    
    console.log(`\n🎉 THÀNH CÔNG! Đã import lại toàn bộ ${importCount} từ vựng N4 sạch vào database.`);
  } catch (err) {
    console.error("Lỗi trong quá trình xử lý:", err);
  }
}

execute();
