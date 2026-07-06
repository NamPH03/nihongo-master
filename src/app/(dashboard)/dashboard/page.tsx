"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getProgress, getSRStats, getDueWords, getUserWordStatuses,
  ProgressData, UserWordStatus
} from "@/lib/progress";
import { fetchLeaderboard, LeaderboardEntry, BADGES } from "@/lib/leaderboard";
import NotificationSetup from "@/components/ui/NotificationSetup";
import { checkAndNotify, canNotifyNow, setLastNotifyTime } from "@/lib/notifications";
import Navbar from "@/components/ui/Navbar";

import { 
  Flame, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Repeat, 
  Search, 
  BarChart2,
  BookCheck,
  Trophy,
  Award
} from "lucide-react";

const srColors: Record<number, string> = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#3b82f6", 5: "#22c55e",
};
const srLabels: Record<number, string> = {
  1: "1 tiếng", 2: "1 ngày", 3: "3 ngày", 4: "1 tuần", 5: "2 tháng",
};
const srBg: Record<number, string> = {
  1: "rgba(239,68,68,0.1)", 2: "rgba(249,115,22,0.1)", 3: "rgba(234,179,8,0.1)",
  4: "rgba(59,130,246,0.1)", 5: "rgba(34,197,94,0.1)",
};

const navTiles = [
  { icon: Sparkles, label: "Học từ mới",  sub: "10 từ mỗi buổi",       href: "/learn",       active: true  },
  { icon: Repeat,   label: "Ôn tập",       sub: "",                       href: "/review",      active: true  },
  { icon: BookOpen, label: "Từ vựng",      sub: "968 từ N5",              href: "/vocabulary",  active: true  },
  { icon: Search,   label: "Từ điển",      sub: "Tra cứu từ vựng",        href: "/dictionary",  active: true  },
  { icon: BarChart2,label: "Tiến độ",      sub: "Xem chi tiết",           href: "/progress",    active: true  },
  { icon: Trophy,   label: "Xếp hạng",     sub: "Bảng xếp hạng XP",      href: "/leaderboard", active: true  },
  { icon: Award,    label: "Danh hiệu",    sub: "Mở khoá thành tích",     href: "/badges",      active: true  },
];

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [srStats, setSrStats] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [dueCount, setDueCount] = useState(0);
  const [userWords, setUserWords] = useState<UserWordStatus[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "memory">("overview");
  const [loading, setLoading] = useState(true);
  const [topEntries, setTopEntries] = useState<LeaderboardEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      const [prog, stats, due, words, lb] = await Promise.all([
        getProgress(user.uid), getSRStats(user.uid),
        getDueWords(user.uid), getUserWordStatuses(user.uid),
        fetchLeaderboard(),
      ]);
      setProgress(prog); setSrStats(stats);
      setDueCount(due.length); setUserWords(words);
      setTopEntries(lb.slice(0, 3));
      setLoading(false);
      if (typeof window !== "undefined" && canNotifyNow()) {
        const todayStr = new Date().toISOString().split("T")[0];
        const studiedToday = (prog.dailyHistory?.[todayStr] || 0) > 0;
        checkAndNotify(due.length, prog.streak, studiedToday);
        setLastNotifyTime();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const totalLearned = Object.values(srStats).reduce((a, b) => a + b, 0);
  const maxSR = Math.max(...Object.values(srStats), 1);
  const todayStr = new Date().toISOString().split("T")[0];
  const todayCount = progress?.dailyHistory?.[todayStr] || 0;
  const groupedWords = [1, 2, 3, 4, 5].map((level) => ({
    level, words: userWords.filter((w) => w.srLevel === level),
  }));

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
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail={userEmail} />

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Greeting */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            こんにちは, {userEmail.split("@")[0]} 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Hôm nay học {todayCount} từ · Streak {progress?.streak || 0} ngày 🔥
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 animate-fade-up">
          {(["overview", "memory"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-spring
                ${activeTab === tab
                  ? "text-[#0d1f14] shadow-green-sm"
                  : "bg-surface-2 hover:bg-surface-3"
                }`}
              style={activeTab === tab ? { background: "var(--primary)" } : { color: "var(--text-muted)" }}
            >
              {tab === "overview" ? "Tổng quan" : "Kho từ theo mức nhớ"}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
            <div className="grid grid-cols-4 gap-3 mb-6 animate-fade-up">
              {[
                { icon: Flame,        value: progress?.streak || 0, label: "Streak", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
                { icon: BookCheck,    value: totalLearned,           label: "Đã học",  color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
                { icon: Sparkles,     value: todayCount,              label: "Hôm nay", color: "var(--primary)", bg: "var(--primary-glow)" },
                { icon: Clock,        value: dueCount,                label: "Cần ôn",  color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
              ].map(({ icon: Icon, value, label, color, bg }) => (
                <div key={label} className="card p-4 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: bg }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="tabular text-xl font-bold" style={{ color }}>{value}</div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider mt-1" style={{ color: "var(--text-faint)" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* SR Chart */}
            <div className="card p-6 mb-6 animate-fade-up delay-75">
              <h2 className="font-semibold mb-0.5" style={{ color: "var(--text)" }}>
                Phân bố mức ghi nhớ
              </h2>
              <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
                Spaced Repetition — mức cao hơn = nhớ lâu hơn
              </p>
              <div className="flex items-end justify-around gap-3 h-32">
                {[1, 2, 3, 4, 5].map((level) => {
                  const count = srStats[level] || 0;
                  const pct = maxSR > 0 ? (count / maxSR) * 100 : 0;
                  return (
                    <div key={level} className="flex flex-col items-center gap-2 flex-1">
                      <span className="tabular text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                        {count > 0 ? count : ""}
                      </span>
                      <div className="w-full flex items-end" style={{ height: "80px" }}>
                        <div
                          className="w-full rounded-t-xl transition-all duration-700 ease-spring"
                          style={{
                            height: count === 0 ? "4px" : `${Math.max(pct, 8)}%`,
                            background: count === 0
                              ? "var(--surface-3)"
                              : `linear-gradient(180deg, ${srColors[level]}, ${srColors[level]}88)`,
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                          Mức {level}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {srLabels[level]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 flex justify-between text-xs" style={{ borderTop: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                <span>Đã học: <strong style={{ color: "var(--text)" }}>{totalLearned} từ</strong></span>
                <span>Còn lại: <strong style={{ color: "var(--text)" }}>{968 - totalLearned} từ</strong></span>
              </div>
            </div>

            {/* Mini Leaderboard */}
            {topEntries.length > 0 && (
              <div className="card p-5 mb-6 animate-fade-up delay-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold" style={{ color: "var(--text)" }}>🏆 Top Học Viên</h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Xếp hạng theo điểm XP</p>
                  </div>
                  <Link href="/leaderboard" className="text-xs font-medium px-3 py-1 rounded-lg"
                    style={{ color: "var(--primary)", background: "var(--primary-glow)" }}>
                    Xem tất cả
                  </Link>
                </div>
                <div className="space-y-2">
                  {topEntries.map((entry, idx) => {
                    const medals = ["🥇","🥈","🥉"];
                    return (
                      <div key={entry.uid} className="flex items-center gap-3 rounded-xl px-3 py-2"
                        style={{ background: "var(--surface-2)" }}>
                        <span className="text-lg w-7 text-center">{medals[idx]}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                            {entry.displayName}
                          </span>
                          <div className="flex gap-1 mt-0.5">
                            {entry.badges.slice(0,3).map(bId => (
                              <span key={bId} title={BADGES[bId].name} className="text-xs">{BADGES[bId].emoji}</span>
                            ))}
                          </div>
                        </div>
                        <span className="font-bold tabular text-sm" style={{ color: "var(--primary)" }}>
                          {entry.xp.toLocaleString()} XP
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nav tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up delay-150">
              {navTiles.map((tile, i) => {
                const isDue = tile.href === "/review" && dueCount > 0;
                const sub = tile.href === "/review"
                  ? (dueCount > 0 ? `${dueCount} từ cần ôn` : "Chưa có từ cần ôn")
                  : tile.sub;
                const Icon = tile.icon;

                return (
                  <Link
                    key={tile.label}
                    href={tile.href}
                    className={`card p-5 flex flex-col justify-between transition-all duration-200 ease-spring animate-fade-up
                      ${!tile.active ? "opacity-40 pointer-events-none" : ""}
                      ${isDue ? "ring-1" : ""}
                    `}
                    style={{
                      animationDelay: `${i * 60}ms`,
                      minHeight: "130px",
                      ...(isDue ? {
                        background: "var(--primary)",
                        ringColor: "var(--primary)",
                        borderColor: "var(--primary)",
                      } : {}),
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" 
                      style={{ background: isDue ? "rgba(13,31,20,0.1)" : "var(--surface-2)" }}>
                      <Icon className="w-5 h-5" style={{ color: isDue ? "#0d1f14" : "var(--primary)" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: isDue ? "#0d1f14" : "var(--text)" }}>
                        {tile.label}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: isDue ? "#0d5a22" : "var(--text-muted)" }}>
                        {sub}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          /* Memory tab */
          <div className="card p-6 animate-fade-up">
            <h2 className="font-semibold mb-1" style={{ color: "var(--text)" }}>
              Kho từ theo mức nhớ
            </h2>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              Tất cả từ đã học hoặc lưu từ từ điển
            </p>
            <div className="space-y-3">
              {groupedWords.map(({ level, words }) => (
                <div key={level} className="rounded-2xl p-4"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                        Mức {level}
                      </span>
                      <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                        ({srLabels[level]})
                      </span>
                    </div>
                    <span
                      className="badge"
                      style={{ background: srBg[level], color: srColors[level] }}
                    >
                      {words.length} từ
                    </span>
                  </div>
                  {words.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                      Chưa có từ nào ở mức này
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {words.slice(0, 5).map((word) => (
                        <div
                          key={word.id}
                          className="flex items-center justify-between rounded-xl px-3 py-2"
                          style={{ background: "var(--surface)" }}
                        >
                          <div>
                            <span className="font-jp font-medium text-sm" style={{ color: "var(--text)" }}>
                              {word.word}
                            </span>
                            <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                              {word.reading} · {word.meaning}
                            </span>
                          </div>
                          <span className="badge"
                            style={{
                              background: word.status === "mastered" ? "rgba(34,197,94,0.1)" : "rgba(249,115,22,0.1)",
                              color: word.status === "mastered" ? "#22c55e" : "#f97316",
                            }}>
                            {word.status === "mastered" ? "Thuộc" : "Đang học"}
                          </span>
                        </div>
                      ))}
                      {words.length > 5 && (
                        <p className="text-xs text-center pt-1" style={{ color: "var(--text-faint)" }}>
                          +{words.length - 5} từ khác
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <NotificationSetup />
    </div>
  );
}