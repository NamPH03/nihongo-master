"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";

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
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "auth/user-not-found") setError("Email này chưa được đăng ký.");
      else if (e.code === "auth/wrong-password") setError("Mật khẩu không đúng.");
      else if (e.code === "auth/invalid-credential") setError("Email hoặc mật khẩu không đúng.");
      else setError("Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-page flex items-center justify-center px-4 relative overflow-hidden">

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary-light), transparent 70%)" }} />
      </div>

      {/* Theme toggle top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] card p-8 animate-scale-in relative z-10">

        {/* Logo */}
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-lg" style={{ color: "var(--primary)" }}>
              Nihongo Master
            </span>
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
            Chào mừng trở lại
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Tiếp tục hành trình học tiếng Nhật
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              required
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 mt-1 rounded-xl text-base"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang đăng nhập...
              </span>
            ) : "Đăng nhập"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </main>
  );
}