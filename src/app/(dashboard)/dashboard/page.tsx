// src/app/(dashboard)/dashboard/page.tsx
// Trang chính sau khi đăng nhập — sẽ hoàn thiện ở các ngày sau

"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Theo dõi trạng thái đăng nhập
    // Nếu chưa đăng nhập → đuổi về trang login
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email || "");
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Thanh menu */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">👤 {userEmail}</span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </nav>

      {/* Nội dung chính */}
      <div className="max-w-4xl mx-auto px-8 py-16 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Chào mừng bạn!
        </h1>
        <p className="text-gray-500 text-lg mb-8">
          Đăng nhập thành công — Dashboard đang được xây dựng
        </p>

        {/* 4 ô tính năng */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { icon: "📚", label: "Từ vựng", status: "Xem ngay", href: "/vocabulary", active: true },
            { icon: "🃏", label: "Flashcard", status: "Học ngay", href: "/flashcard", active: true },
            { icon: "✍️", label: "Trắc nghiệm", status: "Sắp có", href: "#", active: false },
            { icon: "📈", label: "Tiến độ", status: "Sắp có", href: "#", active: false },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`bg-white rounded-2xl p-6 shadow-sm transition ${
                item.active
                  ? "hover:shadow-md cursor-pointer"
                  : "opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="font-semibold text-gray-700">{item.label}</div>
              <div className={`text-xs mt-1 ${item.active ? "text-red-500 font-medium" : "text-gray-400"}`}>
                {item.status}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
} 