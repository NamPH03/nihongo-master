// scripts/check-duplicates.js
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
  const snap = await db.collection("vocabulary").get();
  const n5Words = new Map();
  const gtWords = new Map();

  snap.forEach((d) => {
    const data = d.data();
    if (data.courseId === "jlpt-n5") n5Words.set(data.word, d.id);
    if (data.courseId === "tu-vung-giao-tiep") gtWords.set(data.word, d.id);
  });

  const dups = [];
  n5Words.forEach((id, word) => {
    if (gtWords.has(word)) dups.push(word);
  });

  console.log("\n==========================================");
  console.log("📊 N5 total words:", n5Words.size);
  console.log("📊 Giao tiếp total words:", gtWords.size);
  console.log("⚠️ Number of duplicate words:", dups.length);
  console.log("==========================================\n");
  console.log("Sample 20 duplicates:");
  console.log(dups.slice(0, 20).join(", "));
}

main().catch(console.error);
