# Nihongo Master

Nihongo Master là một ứng dụng học tiếng Nhật toàn diện được xây dựng bằng Next.js và Firebase. Ứng dụng hỗ trợ:

- Đăng ký / đăng nhập bằng email hoặc Google
- Kho từ vựng JLPT N5–N1
- Hệ thống học và ôn tập theo phương pháp Spaced Repetition (SRS)
- Flashcard tương tác, luyện nghe, gõ reading, và chọn nghĩa
- Theo dõi streak học hàng ngày
- Bảng xếp hạng và huy hiệu động lực
- Thông báo Web Push để nhắc người dùng ôn tập

## Tổng quan dự án

- `next` 14.2.x
- `react` 18
- `tailwindcss` 3.4
- Firebase Authentication, Firestore, Storage, Cloud Messaging
- Vercel Cron Job để gửi thông báo định kỳ

## Tính năng chính

1. Xác thực người dùng
   - Email/password
   - Google sign-in

2. Lộ trình từ vựng
   - Từ vựng phân theo cấp độ N5 đến N1
   - Lọc và tìm kiếm trong kho từ
   - Lưu từ mới vào lịch học cá nhân

3. Ôn tập theo SRS
   - Màn hình Review ưu tiên các từ đến hạn
   - Thuật toán nâng/downgrade SR level dựa trên trả lời đúng/sai
   - Nhiều kiểu câu hỏi: chọn nghĩa, chọn từ, gõ reading, nghe

4. Theo dõi tiến độ
   - Streak ngày học liên tiếp
   - Biểu đồ phân bố SR level
   - Thống kê số từ học hôm nay và tổng số từ đã học

5. Gamification
   - Bảng xếp hạng toàn hệ thống
   - XP và huy hiệu dựa trên tiến độ học

6. Thông báo push
   - Đăng ký FCM bằng service worker (`public/firebase-messaging-sw.js`)
   - Route cron `/api/cron/notify` chạy 2 lần/ngày

## Cấu trúc thư mục

- `src/app/` — route và giao diện chính
- `src/components/` — component UI và chức năng
- `src/hooks/` — hook tái sử dụng, bao gồm tìm kiếm từ điển
- `src/lib/` — logic Firebase, auth, progress, leaderboard, FCM
- `src/types/` — định nghĩa type TypeScript
- `public/` — assets tĩnh, service worker push notification
- `scripts/` — script import dữ liệu và chuyển file excel

## Khởi động cục bộ

1. Cài dependencies

```bash
npm install
```

2. Tạo file `.env.local` với các biến môi trường

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

3. Chạy development server

```bash
npm run dev
```

4. Mở trình duyệt và truy cập

```text
http://localhost:3000
```

## Các lệnh hữu ích

- `npm run dev` — chạy app ở chế độ phát triển
- `npm run build` — build production
- `npm run start` — chạy server production sau khi build
- `npm run lint` — kiểm tra lint

## Biến môi trường

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `CRON_SECRET`

## Triển khai trên Vercel

Project đã cấu hình cron job trong `vercel.json`:

- `/api/cron/notify` chạy vào `01:00` và `13:00` mỗi ngày

## Ghi chú kỹ thuật

- Firebase client config nằm ở `src/lib/firebase.ts`
- Firebase Admin khởi tạo trong `src/lib/firebase-admin.ts`
- Route thông báo cron: `src/app/api/cron/notify/route.ts`
- Push notification register route: `src/app/api/notifications/register/route.ts`
- Tiếng Nhật speech synthesis dùng `src/lib/speech.ts`

## Mở rộng và dữ liệu

- `scripts/import-n5-full.ts` và các file trong `scripts/` dùng để import dữ liệu từ excel/quizlet vào Firestore
- Dữ liệu từ vựng chính được lưu trong collection Firestore `vocabulary`
- Progress người dùng lưu trong `users/{uid}/progress`

## Liên hệ

Nếu cần mở rộng tính năng hoặc triển khai, bạn có thể bắt đầu từ `src/lib/auth.ts`, `src/lib/progress.ts`, và `src/app/(dashboard)/dashboard/page.tsx`.
