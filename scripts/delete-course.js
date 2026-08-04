// scripts/delete-course.js
// Xóa toàn bộ từ vựng thuộc một courseId hoặc courseName cụ thể khỏi Firestore
// (Chỉ xóa từ do import, không xóa từ điển cá nhân - source="dictionary")
//
// CÁCH CHẠY:
//   node scripts/delete-course.js --courseName="Từ vựng N5"
//   node scripts/delete-course.js --courseId=tu-vung-n5

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
  const args = process.argv.slice(2);
  const courseNameArg = args.find((a) => a.startsWith("--courseName="))?.split("=").slice(1).join("=");
  const courseIdArg   = args.find((a) => a.startsWith("--courseId="))?.split("=").slice(1).join("=");

  if (!courseNameArg && !courseIdArg) {
    console.error("❌ Cần truyền --courseName=... hoặc --courseId=...");
    console.error('   Ví dụ: node scripts/delete-course.js --courseName="Từ vựng N5"');
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log("🗑️  XÓA KHÓA HỌC KHỎI FIRESTORE");
  if (courseNameArg) console.log(`📌 courseName = "${courseNameArg}"`);
  if (courseIdArg)   console.log(`📌 courseId   = "${courseIdArg}"`);
  console.log("=======================================================\n");

  // Tìm docs theo courseName hoặc courseId
  let snap;
  if (courseIdArg) {
    snap = await db.collection("vocabulary").where("courseId", "==", courseIdArg).get();
  } else {
    snap = await db.collection("vocabulary").where("courseName", "==", courseNameArg).get();
  }

  console.log(`📊 Tìm thấy ${snap.size} từ vựng thuộc khóa học này.`);

  if (snap.size === 0) {
    console.log("✅ Không có gì để xóa.\n");
    process.exit(0);
  }

  // In mẫu 3 từ để confirm
  let count = 0;
  console.log("\n--- MẪU 5 TỪ ĐẦU ---");
  snap.forEach((d) => {
    if (count < 5) {
      const data = d.data();
      console.log(`  [${d.id}] word="${data.word}" courseId="${data.courseId}" courseName="${data.courseName}" source="${data.source}"`);
    }
    count++;
  });
  console.log("--------------------\n");

  // Xóa theo batch
  const BATCH_SIZE = 400;
  const docs = snap.docs.filter((d) => d.data().source !== "dictionary"); // giữ từ điển cá nhân
  const skipped = snap.size - docs.length;

  console.log(`🗑️  Sẽ xóa: ${docs.length} documents (bỏ qua ${skipped} từ điển cá nhân)`);

  let deleted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const d of chunk) {
      batch.delete(db.collection("vocabulary").doc(d.id));
    }
    await batch.commit();
    deleted += chunk.length;
    console.log(`   ⚡ Đã xóa [${deleted}/${docs.length}] documents`);
  }

  console.log("\n=======================================================");
  console.log(`🎉 Hoàn tất! Đã xóa ${deleted} từ vựng khỏi Firestore.`);
  console.log("=======================================================\n");

  process.exit(0);
}

main().catch((err) => {
  if (err.code === 8 || (err.details || "").includes("Quota")) {
    console.error("\n❌ Firebase Quota exceeded — hạn ngạch Firestore hôm nay đã hết.");
    console.error("   Chạy lại lệnh sau ~14:00-15:00 giờ VN khi quota reset.\n");
  } else {
    console.error("❌ Lỗi:", err.message || err);
  }
  process.exit(1);
});
