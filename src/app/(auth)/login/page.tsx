// src/app/(auth)/login/page.tsx
// Trang đăng nhập cho người đã có tài khoản

"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Gọi Firebase kiểm tra email + password
      await signInWithEmailAndPassword(auth, email, password);
      // Đúng → vào dashboard
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { code?: string };
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
            Chào mừng trở lại!
          </h1>
          <p className="text-gray-500 mt-1">Tiếp tục hành trình học tiếng Nhật</p>
        </div>

        {/* Hiển thị lỗi nếu có */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Form đăng nhập */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Quên mật khẩu */}
          <div className="text-right -mt-2">
            <span className="text-sm text-red-600 hover:underline cursor-pointer">
              Quên mật khẩu?
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Đang đăng nhập..." : "🔐 Đăng nhập"}
          </button>

        </form>

        {/* Link sang trang đăng ký */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="text-red-600 font-medium hover:underline">
            Đăng ký miễn phí
          </Link>
        </p>

      </div>
    </main>
  );
}