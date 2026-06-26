// src/app/(auth)/register/page.tsx
// Trang đăng ký tài khoản mới

"use client"; // Cho Next.js biết đây là trang có tương tác người dùng

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  // Lưu trữ giá trị người dùng gõ vào
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(""); // Thông báo lỗi
  const [loading, setLoading] = useState(false); // Đang xử lý?

  const router = useRouter(); // Dùng để chuyển trang

  // Hàm xử lý khi bấm nút Đăng ký
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); // Ngăn trang bị reload
    setError("");

    // Kiểm tra mật khẩu khớp nhau chưa
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự!");
      return;
    }

    setLoading(true);

    try {
      // Gọi Firebase tạo tài khoản mới
      await createUserWithEmailAndPassword(auth, email, password);
      // Thành công → chuyển vào dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { code?: string };
      // Xử lý các lỗi thường gặp
      if (error.code === "auth/user-not-found") {
        setError("Email này chưa được đăng ký!");
      } else if (error.code === "auth/wrong-password") {
        setError("Sai mật khẩu, thử lại nhé!");
      } else if (error.code === "auth/invalid-credential") {
        setError("Email hoặc mật khẩu không đúng!");
      } else {
        setError("Có lỗi xảy ra, thử lại nhé!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl">🎌</span>
            <span className="text-xl font-bold text-red-600">Nihongo Master</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">
            Tạo tài khoản mới
          </h1>
          <p className="text-gray-500 mt-1">Bắt đầu hành trình học tiếng Nhật</p>
        </div>

        {/* Hiển thị lỗi nếu có */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Form đăng ký */}
        <form onSubmit={handleRegister} className="flex flex-col gap-4">

          {/* Ô nhập Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Ô nhập Mật khẩu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Ô xác nhận Mật khẩu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xác nhận mật khẩu
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Nút Đăng ký */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Đang tạo tài khoản..." : "🚀 Đăng ký miễn phí"}
          </button>

        </form>

        {/* Link sang trang đăng nhập */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Đã có tài khoản?{" "}
          <Link href="/login" className="text-red-600 font-medium hover:underline">
            Đăng nhập ngay
          </Link>
        </p>

      </div>
    </main>
  );
}