// scripts/fix-n5-courseid.js
// Fix nhanh: cập nhật lại courseId = "jlpt-n5" cho TẤT CẢ từ vựng N5
// bị sai courseId do lệch cột khi parse CSV có dấu phẩy trong câu ví dụ tiếng Việt.
// Chạy sau khi Firestore quota reset (sau 14:00-15:00 giờ VN).
//
// CÁCH CHẠY:
//   node scripts/fix-n5-courseid.js

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

async function main() {
  console.log("\n=======================================================");
  console.log("🔧 FIX N5 courseId — Đặt lại courseId = 'jlpt-n5' cho TẤT CẢ từ vựng N5");
  console.log("=======================================================\n");

  // Lấy tất cả document N5 từ vocab collection
  console.log("📦 Đang lấy tất cả vocabulary level N5 từ Firestore...");
  const snap = await db.collection("vocabulary").get();

  console.log(`📊 Tìm thấy ${snap.size} documents N5 trong Firestore.`);

  const badDocs = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.courseId !== "jlpt-n5" && data.courseName === "Tiếng Nhật N5 (Sơ cấp 1)") {
      badDocs.push({ id: d.id, oldCourseId: data.courseId });
    }
  });

  console.log(`⚠️  Số documents bị courseId sai: ${badDocs.length}`);
  if (badDocs.length > 0) {
    console.log("   Ví dụ 5 documents lỗi:");
    badDocs.slice(0, 5).forEach((d) =>
      console.log(`   - ${d.id}: courseId = "${d.oldCourseId}"`)
    );
  }

  if (badDocs.length === 0) {
    console.log("\n✅ Tất cả N5 đã có courseId đúng. Không cần fix!\n");
    process.exit(0);
  }

  console.log("\n🚀 Đang fix courseId cho các documents lỗi...\n");

  const BATCH_SIZE = 400;
  let fixed = 0;

  for (let i = 0; i < badDocs.length; i += BATCH_SIZE) {
    const chunk = badDocs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const d of chunk) {
      const ref = db.collection("vocabulary").doc(d.id);
      batch.update(ref, {
        courseId: "jlpt-n5",
        courseName: "Tiếng Nhật N5 (Sơ cấp 1)",
      });
    }
    await batch.commit();
    fixed += chunk.length;
    console.log(`   ⚡ Đã fix [${fixed}/${badDocs.length}] documents`);
  }

  console.log("\n=======================================================");
  console.log(`🎉 Hoàn tất! Đã fix ${fixed} documents về courseId = 'jlpt-n5'`);
  console.log("=======================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi:", err);
  process.exit(1);
});
