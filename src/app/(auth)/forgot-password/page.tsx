"use client";

// Trang quên mật khẩu — gửi email reset qua Firebase

import { useState } from "react";
import { sendPasswordReset } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const result = await sendPasswordReset(email);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
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
            Quên mật khẩu?
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nhập email để nhận link đặt lại mật khẩu
          </p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.1)" }}>
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
              Đã gửi email!
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Kiểm tra hộp thư <strong>{email}</strong> và nhấn link để đặt mật khẩu mới.
              Nhớ xem cả thư mục Spam.
            </p>
            <Link href="/login" className="btn btn-primary px-6 py-2.5 rounded-xl text-sm">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <>
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Email đã đăng ký
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    required
                    className="input pl-10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 mt-1 rounded-xl text-base"
              >
                {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </main>
  );
}
