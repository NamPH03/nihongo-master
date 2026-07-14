// src/lib/firebase.ts
// File này là "cầu nối" giữa website và Firebase
// Mọi tính năng (đăng nhập, database, lưu file) đều đi qua đây

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Đọc chìa khóa từ file .env.local — không hard-code trực tiếp
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Khởi động Firebase — kiểm tra nếu chưa khởi động thì mới tạo mới
// (tránh lỗi khởi động 2 lần trong Next.js)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Khởi tạo Firestore với Local Cache hỗ trợ chế độ Offline và đồng bộ hóa nhiều Tab
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Các "công cụ" Firebase — import ở file khác khi cần dùng
export const auth = getAuth(app);         // Dùng cho: đăng nhập, đăng ký
export const storage = getStorage(app);   // Dùng cho: lưu ảnh, file

export default app;