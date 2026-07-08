// scripts/import-course-lessons.ts
// Import dữ liệu từ trang tính (XLSX/CSV) theo cấu trúc khoá học -> bài học -> từ vựng.
// Dữ liệu có thể được chuyển đổi từ PDF hoặc xuất ra từ spreadsheet.
//
// Cấu trúc file gợi ý (dòng 1 là tiêu đề):
//   Course ID | Course Name | Lesson ID | Lesson Title | Word | Reading | Type | Meaning | Example | Example Meaning | Level
//
// Sử dụng:
//   node_modules\.bin\tsx scripts\import-course-lessons.ts --file=scripts/vocab-courses.xlsx --all
//   node_modules\.bin\tsx scripts\import-course-lessons.ts --file=scripts/vocab-courses.xlsx --level=N5 --all
//   node_modules\.bin\tsx scripts\import-course-lessons.ts --file=scripts/vocab-courses.csv --all --sync-delete
//   node_modules\.bin\tsx scripts\import-course-lessons.ts --file=scripts/vocab-courses.xlsx --clear-reimport --all

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const fileArg = args.find((arg) => arg.startsWith("--file="))?.split("=")[1] || "scripts/vocab-courses.xlsx";
const runAll = args.includes("--all");
const syncDelete = args.includes("--sync-delete");
const clearReimport = args.includes("--clear-reimport");
const defaultLevel = args.find((arg) => arg.startsWith("--level="))?.split("=")[1]?.toUpperCase() || "N5";
const supportedLevels = ["N5", "N4", "N3", "N2", "N1"];
const level = supportedLevels.includes(defaultLevel) ? defaultLevel : "N5";
const DEFAULT_LIMIT = 10;

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

function normalizeHeader(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function sanitizeText(value: unknown): string {
  return String(value || "").trim();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\/\\]+/g, "_")
    .replace(/[^\w\-\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g, "_")
    .replace(/^_+|_+$/g, "_");
}

function makeVocabularyId(courseId: string, lessonId: string, word: string): string {
  return [`course`, slugify(courseId || "unknown"), `lesson`, slugify(lessonId || "unknown"), `word`, slugify(word || "untitled")].join("_");
}

function readSheet(filePath: string): string[][] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File không tồn tại: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
}

function findColumnIndex(headerRow: string[], names: string[]): number {
  const lower = headerRow.map((cell) => normalizeHeader(cell));
  return lower.findIndex((value) => names.includes(value));
}

async function clearImportedVocabulary() {
  console.log("🗑️  Xóa từ vựng import cũ...");
  const snapshot = await getDocs(collection(db, "vocabulary"));
  let deleted = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (data.source !== "dictionary") {
      await deleteDoc(doc(db, "vocabulary", document.id));
      deleted += 1;
    }
  }
  console.log(`✅ Đã xóa ${deleted} từ cũ`);
}

async function main() {
  const absoluteFile = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  console.log(`\n${"=".repeat(55)}`);
  console.log("📥 IMPORT KHOÁ HỌC / BÀI HỌC → FIREBASE");
  console.log(`   File   : ${absoluteFile}`);
  console.log(`   Level  : ${level}`);
  console.log(`   Toàn bộ: ${runAll ? "✅" : "❌ (chỉ thử ${DEFAULT_LIMIT} dòng)"}`);
  console.log(`   Sync delete: ${syncDelete ? "✅" : "❌"}`);
  console.log(`   Clear reimport: ${clearReimport ? "✅" : "❌"}`);
  console.log(`${"=".repeat(55)}\n`);

  if (clearReimport) {
    await clearImportedVocabulary();
  }

  const rows = readSheet(absoluteFile);
  if (rows.length <= 1) {
    console.error("❌ File không có dữ liệu.");
    process.exit(1);
  }

  const headerRow = rows[0].map((cell) => sanitizeText(cell));
  const columnMap = {
    courseId: findColumnIndex(headerRow, ["course id", "courseid", "course", "course_slug", "course_key"]),
    courseName: findColumnIndex(headerRow, ["course name", "course_name", "course title"]),
    lessonId: findColumnIndex(headerRow, ["lesson id", "lessonid", "lesson", "lesson_slug"]),
    lessonTitle: findColumnIndex(headerRow, ["lesson title", "lesson_title", "lesson name"]),
    word: findColumnIndex(headerRow, ["word", "vocabulary", "japanese", "term"]),
    reading: findColumnIndex(headerRow, ["reading", "furigana", "kana"]),
    type: findColumnIndex(headerRow, ["type", "part of speech", "pos"]),
    meaning: findColumnIndex(headerRow, ["meaning", "definition", "translation"]),
    example: findColumnIndex(headerRow, ["example", "sentence", "example sentence"]),
    exampleMeaning: findColumnIndex(headerRow, ["example meaning", "example meaning", "meaning of example", "translation example"]),
    level: findColumnIndex(headerRow, ["level", "jlpt", "jlpt level"]),
    courseOrder: findColumnIndex(headerRow, ["course order", "course_order", "course no"]),
    lessonOrder: findColumnIndex(headerRow, ["lesson order", "lesson_order", "lesson no"]),
  };

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => sanitizeText(cell).length > 0));
  const rowsToImport = runAll ? dataRows : dataRows.slice(0, DEFAULT_LIMIT);

  console.log(`📊 Tổng dòng: ${dataRows.length}`);
  console.log(`📥 Sẽ nhập: ${rowsToImport.length}\n`);

  const existingSnapshot = await getDocs(collection(db, "vocabulary"));
  const existingDocs = new Map<string, string>();
  existingSnapshot.forEach((docSnap) => {
    existingDocs.set(docSnap.id, docSnap.id);
  });

  const processedIds = new Set<string>();
  let countNew = 0;
  let countUpdated = 0;
  let countSkipped = 0;

  for (let index = 0; index < rowsToImport.length; index++) {
    const row = rowsToImport[index];
    const courseId = sanitizeText(row[columnMap.courseId] ?? "") || "course_1";
    const courseName = sanitizeText(row[columnMap.courseName] ?? courseId) || courseId;
    const lessonId = sanitizeText(row[columnMap.lessonId] ?? "") || `lesson_${index + 1}`;
    const lessonTitle = sanitizeText(row[columnMap.lessonTitle] ?? lessonId) || lessonId;
    const word = sanitizeText(row[columnMap.word] ?? "");
    const reading = sanitizeText(row[columnMap.reading] ?? word) || word;
    const type = sanitizeText(row[columnMap.type] ?? "N");
    const meaning = sanitizeText(row[columnMap.meaning] ?? "");
    const example = sanitizeText(row[columnMap.example] ?? "");
    const exampleMeaning = sanitizeText(row[columnMap.exampleMeaning] ?? "");
    const rowLevel = sanitizeText(row[columnMap.level] ?? level).toUpperCase() || level;
    const courseOrder = sanitizeText(row[columnMap.courseOrder] ?? "");
    const lessonOrder = sanitizeText(row[columnMap.lessonOrder] ?? "");

    if (!word || !meaning) {
      countSkipped += 1;
      continue;
    }

    const wordId = makeVocabularyId(courseId, lessonId, word);
    processedIds.add(wordId);

    const docRef = doc(db, "vocabulary", wordId);
    const isExisting = existingDocs.has(wordId);

    const payload = {
      wordId,
      courseId,
      courseName,
      lessonId,
      lessonTitle,
      word,
      reading,
      type: type || "N",
      meaning,
      example,
      exampleMeaning,
      level: supportedLevels.includes(rowLevel) ? rowLevel : level,
      source: "course-import",
      lessonOrder: lessonOrder || null,
      courseOrder: courseOrder || null,
      status: "new",
      updatedAt: new Date(),
      createdAt: new Date(),
    } as Record<string, unknown>;

    try {
      await setDoc(docRef, payload, { merge: true });
      if (isExisting) {
        countUpdated += 1;
      } else {
        countNew += 1;
      }
      console.log(`✅ [${index + 1}] ${word} — ${meaning} (${courseId} / ${lessonId})`);
    } catch (error) {
      console.error(`❌ Lỗi khi nhập: ${word} — ${(error as Error).message}`);
    }
  }

  if (syncDelete) {
    console.log(`\n🗑️  Sync delete đang chạy...`);
    let deleted = 0;
    const snapshot = await getDocs(collection(db, "vocabulary"));
    for (const document of snapshot.docs) {
      const data = document.data();
      const documentId = document.id;
      if (!processedIds.has(documentId) && data.source !== "dictionary") {
        await deleteDoc(doc(db, "vocabulary", documentId));
        deleted += 1;
      }
    }
    console.log(`✅ Đã xóa ${deleted} tài liệu không còn trong file import.`);
  }

  console.log(`\n${"=".repeat(55)}`);
  console.log("🎉 IMPORT HOÀN THÀNH!");
  console.log(`   Thêm mới: ${countNew}`);
  console.log(`   Cập nhật: ${countUpdated}`);
  console.log(`   Bỏ qua  : ${countSkipped}`);
  console.log(`${"=".repeat(55)}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Lỗi khi chạy script:", error);
  process.exit(1);
});
