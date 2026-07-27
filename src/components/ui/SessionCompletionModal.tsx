// src/components/ui/SessionCompletionModal.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RotateCcw, Home, BookOpen, Sparkles, Award } from "lucide-react";

type Props = {
  title?: string;
  totalWords: number;
  correctCount?: number;
  wrongCount?: number;
  xpEarned?: number;
  onRestart: () => void;
  nextLessonUrl?: string;
};

export default function SessionCompletionModal({
  title = "Hoàn thành buổi học!",
  totalWords,
  correctCount,
  wrongCount,
  xpEarned = totalWords * 10,
  onRestart,
  nextLessonUrl,
}: Props) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const accuracy = correctCount !== undefined && totalWords > 0 
    ? Math.round((correctCount / totalWords) * 100) 
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Hiệu ứng pháo hoa đơn giản (Confetti Particles) */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-sm animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 80}%`,
                backgroundColor: ["#22c55e", "#3b82f6", "#eab308", "#ec4899", "#8b5cf6"][i % 5],
                animationDuration: `${1 + Math.random() * 2}s`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="card w-full max-w-md p-6 rounded-3xl text-center relative z-20 shadow-2xl animate-scale-in border border-[var(--border-strong)] bg-surface">
        {/* Crown Icon */}
        <div className="w-20 h-20 mx-auto mb-3 rounded-3xl bg-[var(--primary-glow)] flex items-center justify-center text-4xl animate-bounce">
          🎉
        </div>

        <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
          {title}
        </h2>
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          Bạn đã xuất sắc vượt qua bài ôn luyện này!
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-color)]">
            <div className="flex items-center justify-center gap-1 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              <BookOpen className="w-3.5 h-3.5 text-blue-500" /> Từ vựng
            </div>
            <div className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {totalWords}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-color)]">
            <div className="flex items-center justify-center gap-1 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              <Award className="w-3.5 h-3.5 text-amber-500" /> Chính xác
            </div>
            <div className="text-xl font-bold text-green-500">
              {accuracy}%
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-color)]">
            <div className="flex items-center justify-center gap-1 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Kinh nghiệm
            </div>
            <div className="text-xl font-bold text-purple-500">
              +{xpEarned} XP
            </div>
          </div>
        </div>

        {/* Chi tiết Đúng/Sai nếu có */}
        {correctCount !== undefined && wrongCount !== undefined && (
          <div className="flex justify-center gap-6 mb-6 text-sm font-semibold">
            <span className="text-green-500 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Đúng: {correctCount}
            </span>
            <span className="text-red-400 flex items-center gap-1">
              ❌ Chưa thuộc: {wrongCount}
            </span>
          </div>
        )}

        {/* Nút hành động */}
        <div className="flex flex-col gap-2.5">
          {nextLessonUrl ? (
            <Link
              href={nextLessonUrl}
              className="btn btn-primary w-full py-3.5 rounded-2xl text-base font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              Học bài tiếp theo ➔
            </Link>
          ) : null}

          <button
            onClick={onRestart}
            className="btn w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 border transition-all"
            style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border-color)" }}
          >
            <RotateCcw className="w-4 h-4" /> Ôn lại bài này
          </button>

          <Link
            href="/dashboard"
            className="w-full py-2.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <Home className="w-3.5 h-3.5" /> Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
