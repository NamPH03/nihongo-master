"use client";

import { useState } from "react";
import { register } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";
import GoogleSignInButton from "@/components/ui/GoogleSignInButton";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await register(email, password, confirmPassword);
    setLoading(false);

    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-page flex items-center justify-center px-4 relative overflow-hidden">

      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, var(--primary-light), transparent 70%)" }} />
      </div>

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px] card p-8 animate-scale-in relative z-10">

        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <Image src="/icon-192.png" alt="Logo" width={32} height={32} className="rounded-full object-cover" />
            <span className="font-bold text-lg" style={{ color: "var(--primary)" }}>
              Nihongo Master
            </span>
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
            Tạo tài khoản mới
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Bắt đầu hành trình học tiếng Nhật
          </p>
        </div>

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

        <GoogleSignInButton onError={setError} />

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>hoặc</span>
          <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Email
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com" required className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Mật khẩu
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự" required className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Xác nhận mật khẩu
            </label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu" required className="input" />
          </div>

          <button
            type="submit" disabled={loading}
            className="btn btn-primary w-full py-3 mt-1 rounded-xl text-base"
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang tạo tài khoản...
              </span>
            ) : "Đăng ký miễn phí"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </main>
  );
}
