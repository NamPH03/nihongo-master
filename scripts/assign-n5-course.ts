// scripts/assign-n5-course.ts
// ===================================================
// Gán courseId / lessonId cho toàn bộ từ N5 chưa có khoá học
// Kết quả: hiện thị như khoá học "Từ vựng N5" trên trang /learn
//
// Sử dụng:
//   Xem preview (không ghi gì):
//     npx tsx scripts/assign-n5-course.ts
//
//   Thực hiện gán:
//     npx tsx scripts/assign-n5-course.ts --apply
// ===================================================

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const args = process.argv.slice(2);
const apply = args.includes("--apply");

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

// Mỗi Firestore batch tối đa 500 writes
const BATCH_SIZE = 400;

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("📚 GÁN KHOÁ HỌC CHO TỪ VỰNG N5");
  console.log(`   Chế độ: ${apply ? "✅ APPLY (ghi vào Firebase)" : "👀 PREVIEW (chỉ xem, không ghi)"}`);
  console.log("=".repeat(60) + "\n");

  // Lấy tất cả từ N5 chưa có courseId
  console.log("🔍 Đang tìm từ N5 chưa có courseId...");
  const snap = await getDocs(
    query(collection(db, "vocabulary"), where("level", "==", "N5"))
  );

  const toAssign: { id: string; lessonId: string }[] = [];

  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data.courseId) {
      toAssign.push({ id: d.id, lessonId: "" });
    }
  });

  console.log(`   → Tìm thấy ${toAssign.length} từ N5 chưa có courseId`);

  if (toAssign.length === 0) {
    console.log("\n✅ Tất cả từ N5 đã được gán khoá học rồi!");
    process.exit(0);
  }

  console.log(`\n📋 Sẽ gán vào:`);
  console.log(`   courseId   : "ID_n5_vocab"`);
  console.log(`   courseName : "Từ vựng N5"`);
  console.log(`   lessonId   : "ID_n5_all"`);
  console.log(`   lessonTitle: "Tất cả từ vựng N5"`);

  if (!apply) {
    console.log(`\n💡 Để thực sự gán, chạy lại với --apply:`);
    console.log(`   npx tsx scripts/assign-n5-course.ts --apply`);
    process.exit(0);
  }

  // Gán theo batch
  console.log(`\n⏳ Đang gán ${toAssign.length} từ N5...`);
  let done = 0;

  for (let i = 0; i < toAssign.length; i += BATCH_SIZE) {
    const chunk = toAssign.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(({ id }) => {
      batch.update(doc(db, "vocabulary", id), {
        courseId:    "ID_n5_vocab",
        courseName:  "Từ vựng N5",
        lessonId:    "ID_n5_all",
        lessonTitle: "Tất cả từ vựng N5",
      });
    });

    await batch.commit();
    done += chunk.length;
    console.log(`   ✅ ${done} / ${toAssign.length} từ đã gán`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎉 HOÀN THÀNH! Đã gán ${done} từ N5 vào khoá học "Từ vựng N5"`);
  console.log(`   Vào trang /learn để kiểm tra.`);
  console.log("=".repeat(60) + "\n");
  process.exit(0);
}

main();
