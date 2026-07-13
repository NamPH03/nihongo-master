"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getProgress, ProgressData } from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      const data = await getProgress(user.uid);
      setProgress(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const getLast30Days = () => {
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      // Dùng giờ Việt Nam (UTC+7)
      const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
    </div>
  );

  const last30Days = getLast30Days();
  const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
  const todayCount = progress?.dailyHistory?.[todayStr] || 0;

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail={userEmail} />

      <div className="max-w-2xl mx-auto px-4 py-6">

        <h1 className="text-2xl font-bold mb-6 animate-fade-up" style={{ color: "var(--text)" }}>
          Tiến độ học tập
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
          {[
            { emoji: "🔥", value: progress?.streak || 0,         label: "Ngày liên tiếp", color: "#f97316" },
            { emoji: "📚", value: progress?.totalLearned || 0,   label: "Tổng từ đã học", color: "#3b82f6" },
            { emoji: "⭐", value: todayCount,                     label: "Từ hôm nay",     color: "var(--primary)" },
          ].map(({ emoji, value, label, color }) => (
            <div key={label} className="card p-5 text-center">
              <div className="text-3xl mb-2">{emoji}</div>
              <div className="tabular text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 30 day heatmap */}
        <div className="card p-6 mb-6 animate-fade-up delay-75">
          <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>
            30 ngày gần nhất
          </h2>
          <div className="grid grid-cols-10 gap-1.5">
            {last30Days.map((day) => {
              const count = progress?.dailyHistory?.[day] || 0;
              const isToday = day === todayStr;
              let bg = "var(--surface-2)";
              if (count >= 10) bg = "var(--primary)";
              else if (count >= 5) bg = "var(--primary-dim)";
              else if (count > 0) bg = "var(--primary-light)";

              return (
                <div
                  key={day}
                  title={`${day}: ${count} từ`}
                  className="aspect-square rounded-md transition-all duration-200"
                  style={{
                    background: bg,
                    opacity: count === 0 ? 0.35 : 1,
                    outline: isToday ? `2px solid var(--primary)` : "none",
                    outlineOffset: "1px",
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Ít</span>
            {["var(--surface-2)", "var(--primary-light)", "var(--primary-dim)", "var(--primary)"].map((c) => (
              <div key={c} className="w-3 h-3 rounded" style={{ background: c }} />
            ))}
            <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Nhiều</span>
          </div>
        </div>

        {/* CTA */}
        <Link href="/learn"
          className="btn btn-primary w-full py-3 rounded-2xl text-base animate-fade-up delay-150"
        >
          🚀 Học từ mới ngay
        </Link>
      </div>
    </div>
  );
}