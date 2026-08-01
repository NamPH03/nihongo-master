# 🌸 Nihongo Master — Comprehensive System Audit & Documentation

> **Live Demo:** [https://nihongo-master-eight.vercel.app/](https://nihongo-master-eight.vercel.app/)  
> **Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Firebase (Auth, Firestore, Storage, FCM), Vercel.

Nihongo Master là ứng dụng học từ vựng tiếng Nhật từ N5–N1 tích hợp thuật toán Spaced Repetition (SRS), Flashcard 3D, Tra cứu từ điển Nhật-Việt-Anh, nhận diện nét vẽ Kanji (Handwriting Recognition), cùng các tính năng Gamification (Streak, XP, Leaderboard, Badges).

---

## 📊 1. Báo Cáo Đánh Giá Chất Lượng Toàn Diện (System Audit Report)
   

### 🏆 Bảng Điểm Đánh Giá Thành Phần

| Hạng mục | Điểm | Đánh giá nhanh |
| :--- | :---: | :--- |
| **UI Design & Aesthetics** | **8.0 / 10** | Giao diện hiện đại, CSS custom design system xanh ngọc tươi tắn, hỗ trợ Dark/Light mode chống flash theme, hiệu ứng mượt. |
| **UX Experience** | **7.2 / 10** | Luồng học tập trung vào Review Dashboard. Tuy nhiên giao diện Mobile Bottom Bar bị quá tải biểu tượng. |
| **Performance** | **8.5 / 10** | Build tĩnh/động hoàn hảo (24/24 pages PASS). Tích hợp Client-side `sessionStorage` cache (TTL 5 phút) cho Firestore. |
| **Accessibility (a11y)** | **6.0 / 10** | Thiếu hệ thống ARIA attributes đầy đủ, độ tương phản text muted ở một số nơi chưa đạt WCAG AA. |
| **Code Quality & Architecture**| **8.2 / 10** | Cấu trúc Next.js App Router sạch sẻ, phân tách `lib/`, `hooks/`, `components/`. Có Firebase Admin SDK server-side. |
| **Product & Gamification** | **7.0 / 10** | Đã có SRS, Streak, Leaderboard, nhưng cần thêm Daily Goal, Pitch Accent, và thuật toán FSRS cá nhân hóa hơn. |
| **OVERALL RATING** | **7.5 / 10** | **Khởi đầu ấn tượng — Cần Refactor tối ưu Firestore Read & Mobile Navigation trước khi Public Release.** |


---

## 🛠️ 2. Khởi Động & Cấu Trúc Dự Án (Developer Guide)

### Cấu Trúc Thư Mục
```text
nihongo-master/
├── src/
│   ├── app/                # Next.js 14 App Router (Pages, APIs, Layouts)
│   │   ├── (auth)/         # Login, Register, Forgot Password
│   │   ├── (dashboard)/    # Dashboard, Learn, Review, Flashcard, Dictionary, Leaderboard, Progress, Profile
│   │   └── api/            # Serverless API routes (Dictionary, Vocab Save, Notifications, Cron)
│   ├── components/         # Reusable UI components & Feature modules
│   ├── hooks/              # Custom React Hooks (useDictionary, etc.)
│   ├── lib/                # Core logic (Firebase, Auth, SRS Progress, Leaderboard, Vocab Cache, SFX)
│   └── types/              # TypeScript definitions
├── public/                 # Static assets, PWA Manifest, Service Worker (FCM)
└── scripts/                # Utility scripts for data import (Excel/Quizlet)
```

### Cài Đặt Cục Bộ

1. **Clone repository & cài đặt dependencies:**
   ```bash
   git clone https://github.com/NamPH03/nihongo-master.git
   cd nihongo-master
   npm install
   ```

2. **Cấu hình biến môi trường (`.env.local`):**
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=
   FIREBASE_PRIVATE_KEY=
   FIREBASE_CLIENT_EMAIL=
   CRON_SECRET=
   ```

3. **Chạy Server Phát Triển:**
   ```bash
   npm run dev
   ```
   Truy cập [http://localhost:3000](http://localhost:3000)

4. **Các Lệnh Build & Check:**
   - `npm run build`: Tạo bản build production tối ưu.
   - `npm run start`: Khởi chạy ứng dụng production sau khi build.
   - `npm run lint`: Kiểm tra syntax & coding standards.

---

## 📜 License
Dự án được bảo hộ bản quyền. Mọi sự đóng góp và phát triển vui lòng tạo Pull Request hoặc liên hệ với đội ngũ phát triển.
