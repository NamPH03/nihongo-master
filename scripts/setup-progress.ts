// scripts/setup-progress.ts
// Tạo cấu trúc progress cho user trong Firestore

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as dotenv from "dotenv";

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

// Cấu trúc progress của 1 user:
// users/{userId}/progress/stats
// {
//   streak: 5,              ← chuỗi ngày học liên tiếp
//   lastStudyDate: "2026-06-23", ← ngày học gần nhất
//   totalLearned: 45,       ← tổng từ đã học
//   dailyHistory: {         ← lịch sử từng ngày
//     "2026-06-23": 10,
//     "2026-06-22": 8,
//   }
// }

console.log("✅ Cấu trúc progress sẽ được tạo tự động khi user học lần đầu");
console.log("   Collection: users/{userId}/progress/stats");
process.exit(0);