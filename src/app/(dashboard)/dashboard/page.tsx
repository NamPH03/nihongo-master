"use client";

// src/app/(dashboard)/dashboard/page.tsx
// Dashboard tập trung vào Ôn tập (Review) làm mặc định và hiển thị phân bố mức ghi nhớ

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getProgress, getSRStats, getDueWords,
  ProgressData
} from "@/lib/progress";
import { fetchLeaderboard, LeaderboardEntry } from "@/lib/leaderboard";
import NotificationSetup from "@/components/ui/NotificationSetup";
import Navbar from "@/components/ui/Navbar";

import { 
  Flame, 
  Sparkles, 
  Clock, 
  BookCheck,
  Trophy,
  ArrowRight,
  Play
} from "lucide-react";

const srColors: Record<number, string> = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#3b82f6", 5: "#22c55e",
};
const srLabels: Record<number, string> = {
  1: "1 tiếng", 2: "1 ngày", 3: "3 ngày", 4: "1 tuần", 5: "2 tháng",
};

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [srStats, setSrStats] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topEntries, setTopEntries] = useState<LeaderboardEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      const [prog, stats, due, lb] = await Promise.all([
        getProgress(user.uid), getSRStats(user.uid),
        getDueWords(user.uid, 50),
        fetchLeaderboard(),
      ]);
      setProgress(prog); 
      setSrStats(stats);
      setDueCount(due.length); 
      setTopEntries(lb.slice(0, 3));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const totalLearned = Object.values(srStats).reduce((a, b) => a + b, 0);
  const maxSR = Math.max(...Object.values(srStats), 1);
  const todayStr = new Date().toISOString().split("T")[0];
  const todayCount = progress?.dailyHistory?.[todayStr] || 0;

  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-page pb-20 md:pb-6">
      <Navbar userEmail={userEmail} />

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Greeting & Streak */}
        <div className="mb-6 animate-fade-up flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              こんにちは, {userEmail.split("@")[0]} 👋
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Hôm nay học {todayCount} từ · Tổng tích luỹ {totalLearned} từ
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 font-bold text-sm">
            <Flame size={18} className="fill-orange-500 animate-pulse" />
            <span>{progress?.streak || 0} ngày</span>
          </div>
        </div>

        {/* TRỌNG TÂM: MÀN HÌNH ÔN TẬP MẶC ĐỊNH (REVIEW DASHBOARD) */}
        <div className="card p-6 mb-6 animate-fade-up border-2 border-[var(--primary)]/30 relative overflow-hidden"
             style={{ 
               background: "linear-gradient(135deg, var(--surface), rgba(34, 197, 94, 0.05))"
             }}>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-[var(--primary)] px-2.5 py-1 rounded-full bg-[var(--primary)]/10">
                Lịch trình hôm nay
              </span>
              <h2 className="text-xl font-bold mt-3 mb-1" style={{ color: "var(--text)" }}>
                {dueCount > 0 ? "Đến giờ ôn tập từ vựng!" : "Bạn đã hoàn thành ôn tập!"}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {dueCount > 0 
                  ? `Có ${dueCount} từ vựng Spaced Repetition đến thời điểm ôn tập.`
                  : "Tuyệt vời! Hiện tại không có từ vựng nào cần ôn tập. Hãy học thêm từ mới nhé."
                }
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {dueCount > 0 ? (
                <Link href="/review" 
                      className="btn btn-primary px-6 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-green active:scale-95 transition-all">
                  <Play size={16} fill="currentColor" />
                  Ôn ngay ({dueCount} từ)
                </Link>
              ) : (
                <Link href="/learn" 
                      className="btn btn-primary px-6 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm active:scale-95 transition-all">
                  Học từ mới
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>

          {/* Trang trí góc thẻ */}
          <div className="absolute right-[-20px] bottom-[-20px] text-[var(--primary)]/10 pointer-events-none">
            <Clock size={120} />
          </div>
        </div>

        {/* Bảng phân bố mức ghi nhớ (SR Chart) */}
        <div className="card p-5 mb-6 animate-fade-up">
          <h2 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
            Phân bố mức ghi nhớ
          </h2>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
            Mức cao hơn = nhớ lâu hơn
          </p>
          <div className="flex items-end justify-around gap-2 h-28">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = srStats[level] || 0;
              const pct = maxSR > 0 ? (count / maxSR) * 100 : 0;
              return (
                <div key={level} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="tabular text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                    {count > 0 ? count : ""}
                  </span>
                  <div className="w-full flex items-end" style={{ height: "60px" }}>
                    <div
                      className="w-full rounded-t-lg transition-all duration-700 ease-spring"
                      style={{
                        height: count === 0 ? "4px" : `${Math.max(pct, 8)}%`,
                        background: count === 0
                          ? "var(--surface-3)"
                          : `linear-gradient(180deg, ${srColors[level]}, ${srColors[level]}88)`,
                      }}
                    />
                  </div>
                  <div className="text-center mt-1">
                    <div className="text-[10px] font-bold" style={{ color: "var(--text)" }}>
                      Mức {level}
                    </div>
                    <div className="text-[8px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {srLabels[level]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up delay-75">
          {[
            { icon: BookCheck, value: totalLearned, label: "Đã học", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
            { icon: Sparkles,  value: todayCount,   label: "Hôm nay", color: "var(--primary)", bg: "var(--primary-glow)" },
            { icon: Clock,     value: dueCount,     label: "Đến hạn", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
          ].map(({ icon: Icon, value, label, color, bg }) => (
            <div key={label} className="card p-4 flex flex-col items-center justify-center text-center">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-2" style={{ background: bg }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="tabular text-lg font-bold" style={{ color }}>{value}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider mt-0.5" style={{ color: "var(--text-faint)" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Mini Leaderboard */}
        {topEntries.length > 0 && (
          <div className="card p-5 mb-6 animate-fade-up delay-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>🏆 Bảng Xếp Hạng</h2>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Top học viên tuần này</p>
              </div>
              <Link href="/leaderboard" className="text-xs font-semibold px-3 py-1 rounded-xl"
                style={{ color: "var(--primary)", background: "var(--primary-glow)" }}>
                Xem thêm
              </Link>
            </div>
            <div className="space-y-2">
              {topEntries.map((entry, idx) => {
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div key={entry.uid} className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border-color)" }}>
                    <span className="text-base w-6 text-center">{medals[idx]}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-xs" style={{ color: "var(--text)" }}>
                        {entry.displayName}
                      </span>
                    </div>
                    <span className="font-bold tabular text-xs" style={{ color: "var(--primary)" }}>
                      {entry.xp.toLocaleString()} XP
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <NotificationSetup />
    </div>
  );
}