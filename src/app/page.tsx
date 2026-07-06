// src/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { BookOpen, Layers, Repeat, Flame } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    label: "Từ vựng N5–N1",
    desc: "Kho từ đầy đủ theo từng cấp JLPT, có ví dụ câu thực tế do AI biên soạn.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.1)"
  },
  {
    icon: Layers,
    label: "Flashcard thông minh",
    desc: "Lật thẻ 3D mượt mà — nhìn từ, nghe phát âm, chọn nghĩa, gõ reading.",
    color: "var(--primary)",
    bg: "var(--primary-glow)"
  },
  {
    icon: Repeat,
    label: "Ôn tập ngắt quãng",
    desc: "Thuật toán SRS tự động lên lịch từ cần ôn đúng lúc não sắp quên.",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.1)"
  },
  {
    icon: Flame,
    label: "Theo dõi streak",
    desc: "Biểu đồ học tập hàng ngày, duy trì chuỗi ngày không bỏ lỡ.",
    color: "#f97316",
    bg: "rgba(249,115,22,0.1)"
  },
];

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-page relative overflow-x-hidden">

      {/* Ambient glow background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-20 dark:opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary-light), transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full opacity-10 dark:opacity-5 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
        />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-theme"
        style={{ background: "var(--nav-bg)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/icon-192.png" alt="Logo" width={24} height={24} className="rounded-full object-cover" />
            <span className="text-base font-bold" style={{ color: "var(--text)" }}>
              Nihongo <span style={{ color: "var(--primary)" }}>Master</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn btn-ghost text-sm px-3 py-1.5">
              Đăng nhập
            </Link>
            <Link href="/register" className="btn btn-primary text-sm px-4 py-1.5">
              Bắt đầu
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 pt-20 pb-24 gap-6">

        {/* Eyebrow badge */}
        <div
          className="badge text-xs uppercase tracking-widest animate-fade-in"
          style={{
            background: "var(--primary-glow)",
            color: "var(--primary)",
            border: "1px solid var(--border-strong)",
          }}
        >
          🌸 Học tiếng Nhật — Từ N5 đến N1
        </div>

        {/* Decorative kanji */}
        <div
          className="font-jp text-[7rem] sm:text-[10rem] font-bold leading-none select-none -mb-6 animate-fade-in delay-75"
          style={{ color: "var(--primary)", opacity: 0.08 }}
        >
          日本語
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-6xl font-bold tracking-tight text-balance -mt-2 animate-fade-up delay-150"
          style={{ color: "var(--text)" }}
        >
          Học tiếng Nhật<br />
          <span style={{ color: "var(--primary)" }}>mỗi ngày một ít</span>
        </h1>

        {/* Subheading */}
        <p
          className="text-lg sm:text-xl max-w-md text-balance animate-fade-up delay-225"
          style={{ color: "var(--text-muted)" }}
        >
          Lộ trình bài bản — flashcard thông minh, ôn tập ngắt quãng,
          và theo dõi tiến độ mỗi ngày.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2 animate-fade-up delay-300">
          <Link href="/register"
            className="btn btn-primary text-base px-7 py-3 rounded-2xl"
          >
            🚀 Bắt đầu miễn phí
          </Link>
          <Link href="#features"
            className="btn btn-ghost text-base px-7 py-3 rounded-2xl"
          >
            Xem tính năng
          </Link>
        </div>

        {/* Floating stats */}
        <div
          className="grid grid-cols-3 gap-3 mt-8 w-full max-w-sm animate-fade-up delay-400"
        >
          {[
            { num: "968", label: "Từ N5" },
            { num: "5",   label: "Mức SR" },
            { num: "∞",   label: "Miễn phí" },
          ].map(({ num, label }) => (
            <div key={label} className="card p-3 text-center">
              <div className="tabular text-2xl font-bold" style={{ color: "var(--primary)" }}>
                {num}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-4 pb-24">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl sm:text-3xl font-bold text-center mb-10 text-balance"
            style={{ color: "var(--text)" }}
          >
            Tất cả những gì bạn cần
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.label}
                  className="card p-6 animate-fade-up flex flex-col gap-3"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: f.bg }}>
                    <Icon className="w-6 h-6" style={{ color: f.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text)" }}>
                      {f.label}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="relative z-10 px-4 pb-24">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-10 text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text)" }}>
            Sẵn sàng chinh phục tiếng Nhật?
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
            Bắt đầu bài học đầu tiên hoàn toàn miễn phí ngay hôm nay.
          </p>
          <Link href="/register" className="btn btn-primary px-8 py-3 rounded-xl text-sm font-semibold">
            🎯 Đăng ký tài khoản ngay
          </Link>
        </div>
      </section>
    </main>
  );
}