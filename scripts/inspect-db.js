// scripts/inspect-db.js
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
  console.log("\n==========================================");
  console.log("📊 TOTAL DOCS IN VOCABULARY:", snap.size);
  console.log("==========================================\n");

  const courses = {};
  const courseNames = {};

  snap.forEach((d) => {
    const data = d.data();
    const cId = data.courseId || "NO_COURSE_ID";
    const cName = data.courseName || "NO_COURSE_NAME";
    courses[cId] = (courses[cId] || 0) + 1;
    courseNames[cName] = (courseNames[cName] || 0) + 1;
  });

  console.log("📌 Group by courseId:");
  console.dir(courses);

  console.log("\n📌 Group by courseName:");
  console.dir(courseNames);
}

main().catch(console.error);
