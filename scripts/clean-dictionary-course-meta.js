// scripts/clean-dictionary-course-meta.js
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
  const snap = await db.collection("vocabulary").where("courseId", "==", "ID_n5_vocab").get();
  console.log(`Tìm thấy ${snap.size} từ cá nhân dán nhãn nhầm course ID_n5_vocab.`);
  const batch = db.batch();
  snap.forEach((d) => {
    batch.update(d.ref, { courseId: "", courseName: "" });
  });
  await batch.commit();
  console.log("✅ Đã gỡ bỏ courseId/courseName khỏi các từ cá nhân!");
}

main().catch(console.error);
