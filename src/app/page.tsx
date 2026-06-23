// src/app/page.tsx
// Đây là trang chủ của website - người dùng thấy đầu tiên khi vào web

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">

      {/* ===== THANH MENU TRÊN ===== */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </div>

        {/* Nút đăng nhập / đăng ký */}
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Đăng ký miễn phí
          </Link>
        </div>
      </nav>

      {/* ===== PHẦN HERO - NỘI DUNG CHÍNH ===== */}
      <section className="flex flex-col items-center text-center px-8 py-24 gap-6">

        {/* Chữ Nhật trang trí */}
        <div className="text-8xl font-bold text-red-100 select-none">
          日本語
        </div>

        {/* Tiêu đề chính */}
        <h1 className="text-5xl font-bold text-gray-900 -mt-8">
          Học tiếng Nhật <br />
          <span className="text-red-600">mỗi ngày một ít</span>
        </h1>

        {/* Mô tả */}
        <p className="text-xl text-gray-500 max-w-xl">
          Lộ trình từ N5 đến N1 — flashcard thông minh, 
          bài tập trắc nghiệm và theo dõi tiến độ mỗi ngày.
        </p>

        {/* 2 nút kêu gọi hành động */}
        <div className="flex gap-4 mt-4">
          <Link
            href="/register"
            className="px-8 py-4 bg-red-600 text-white text-lg font-semibold rounded-xl hover:bg-red-700 transition shadow-lg"
          >
            🚀 Bắt đầu miễn phí
          </Link>
          <Link
            href="#features"
            className="px-8 py-4 bg-gray-100 text-gray-700 text-lg font-semibold rounded-xl hover:bg-gray-200 transition"
          >
            Xem tính năng
          </Link>
        </div>
      </section>

      {/* ===== PHẦN TÍNH NĂNG ===== */}
      <section id="features" className="bg-gray-50 px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Tất cả những gì bạn cần
        </h2>

        {/* 4 ô tính năng */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">

          {/* Tính năng 1 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
            <div className="text-4xl mb-3">📚</div>
            <h3 className="font-bold text-gray-900 mb-2">Từ vựng N5–N1</h3>
            <p className="text-gray-500 text-sm">Kho từ vựng đầy đủ theo từng cấp độ JLPT</p>
          </div>

          {/* Tính năng 2 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
            <div className="text-4xl mb-3">🃏</div>
            <h3 className="font-bold text-gray-900 mb-2">Flashcard</h3>
            <p className="text-gray-500 text-sm">Lật thẻ học từ — ghi nhớ nhanh và hiệu quả</p>
          </div>

          {/* Tính năng 3 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
            <div className="text-4xl mb-3">✍️</div>
            <h3 className="font-bold text-gray-900 mb-2">Trắc nghiệm</h3>
            <p className="text-gray-500 text-sm">Bài tập 4 đáp án kiểm tra kiến thức mỗi ngày</p>
          </div>

          {/* Tính năng 4 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
            <div className="text-4xl mb-3">📈</div>
            <h3 className="font-bold text-gray-900 mb-2">Theo dõi tiến độ</h3>
            <p className="text-gray-500 text-sm">Biểu đồ học tập hàng ngày — duy trì streak</p>
          </div>

        </div>
      </section>

      {/* ===== CHÂN TRANG ===== */}
      <footer className="text-center py-8 text-gray-400 text-sm">
        © 2026 Nihongo Master — Học tiếng Nhật mỗi ngày 🎌
      </footer>

    </main>
  );
}