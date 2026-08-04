// scripts/inspect-n5-lessons.js
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
  const snap = await db.collection("vocabulary").where("courseId", "==", "jlpt-n5").get();
  console.log("\n==========================================");
  console.log("📊 N5 DOCS COUNT:", snap.size);
  console.log("==========================================\n");

  const lessons = {};
  snap.forEach((d) => {
    const data = d.data();
    const key = `[lessonId: ${data.lessonId || "EMPTY"}] | [lessonTitle: ${data.lessonTitle || "EMPTY"}]`;
    lessons[key] = (lessons[key] || 0) + 1;
  });

  console.log("📌 Group by lessonId & lessonTitle:");
  console.dir(lessons);
}

main().catch(console.error);
