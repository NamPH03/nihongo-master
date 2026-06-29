// src/app/page.tsx
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";

const features = [
  {
    icon: "📚",
    label: "Từ vựng N5–N1",
    desc: "Kho từ đầy đủ theo từng cấp JLPT, có ví dụ câu thực tế do AI biên soạn.",
  },
  {
    icon: "🃏",
    label: "Flashcard thông minh",
    desc: "Lật thẻ 3D mượt mà — nhìn từ, nghe phát âm, chọn nghĩa, gõ reading.",
  },
  {
    icon: "🔁",
    label: "Ôn tập ngắt quãng",
    desc: "Thuật toán SRS tự động lên lịch từ cần ôn đúng lúc não sắp quên.",
  },
  {
    icon: "📈",
    label: "Theo dõi streak",
    desc: "Biểu đồ học tập hàng ngày, duy trì chuỗi ngày không bỏ lỡ.",
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
            <span className="text-xl">🌿</span>
            <span className="text-base font-bold" style={{ color: "var(--primary)" }}>
              Nihongo Master
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
            {features.map((f, i) => (
              <div
                key={f.label}
                className="card p-6 animate-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text)" }}>
                  {f.label}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
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
          <div className="text-4xl mb-4">🌿</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
            Sẵn sàng bắt đầu?
          </h2>
          <p className="mb-6" style={{ color: "var(--text-muted)" }}>
            Chỉ cần 10 phút mỗi ngày. Hoàn toàn miễn phí.
          </p>
          <Link href="/register" className="btn btn-primary px-8 py-3 text-base rounded-2xl">
            Tạo tài khoản miễn phí →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 text-center py-6 text-xs border-t border-theme"
        style={{ color: "var(--text-faint)" }}
      >
        © 2026 Nihongo Master — Học tiếng Nhật mỗi ngày 🌿
      </footer>

    </main>
  );
}