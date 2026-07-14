"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import {
  fetchLeaderboard,
  LeaderboardEntry,
  BADGES,
  BadgeId,
} from "@/lib/leaderboard";
import { Trophy, Flame, BookOpen, Zap, RefreshCw } from "lucide-react";

const rankColors: Record<number, { text: string; bg: string; border: string }> = {
  1: { text: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)" },
  2: { text: "#94a3b8", bg: "rgba(148,163,184,0.15)", border: "rgba(148,163,184,0.4)" },
  3: { text: "#f97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.4)" },
};

const rankEmoji = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [currentUid, setCurrentUid] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchLeaderboard();
    setEntries(data);
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      setCurrentUid(user.uid);
      await loadData();
    });
    return () => unsubscribe();
  }, [router, loadData]);

  if (loading) return (
    <div className="min-h-[100dvh] bg-page pb-20 md:pb-6">
      <nav className="navbar border-b sticky top-0 z-40 bg-[var(--surface)] h-14" style={{ borderColor: "var(--border-color)" }} />
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6 animate-pulse">
        {/* Title */}
        <div className="h-8 w-48 rounded bg-[var(--surface-3)]" />
        
        {/* Podium Skeleton */}
        <div className="grid grid-cols-3 items-end gap-3 h-48 bg-[var(--surface-2)]/40 p-4 rounded-3xl border border-[var(--border-color)]">
          <div className="h-28 rounded bg-[var(--surface)]" />
          <div className="h-36 rounded bg-[var(--surface-3)]" />
          <div className="h-24 rounded bg-[var(--surface)]" />
        </div>
        
        {/* Table Rows Skeleton */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 h-14 bg-[var(--surface)] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );

  const myEntry = entries.find((e) => e.uid === currentUid);

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail={userEmail} />

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6 animate-fade-up flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
              <Trophy className="w-6 h-6" style={{ color: "#f59e0b" }} />
              Bảng Xếp Hạng
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Xếp hạng theo điểm XP — tiếp tục học để leo thứ hạng!
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-2 rounded-xl transition-all"
            style={{ background: "var(--surface-2)" }}
            title="Làm mới"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              style={{ color: "var(--text-muted)" }}
            />
          </button>
        </div>

        {/* My rank card */}
        {myEntry && (
          <div
            className="card p-4 mb-6 animate-fade-up"
            style={{
              background: "var(--primary-glow)",
              border: "1px solid var(--primary)",
            }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--primary)" }}>
              VỊ TRÍ CỦA BẠN
            </p>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
                style={{ background: "var(--primary)", color: "#0d1f14" }}
              >
                #{myEntry.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold" style={{ color: "var(--text)" }}>{myEntry.displayName}</div>
                <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{myEntry.xp} XP</span>
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{myEntry.streak} ngày</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{myEntry.totalLearned} từ</span>
                </div>
              </div>
              {myEntry.badges.length > 0 && (
                <div className="flex gap-1 flex-wrap justify-end">
                  {myEntry.badges.slice(0, 4).map((bId) => (
                    <span key={bId} title={BADGES[bId].name} className="text-lg leading-none">{BADGES[bId].emoji}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard list */}
        <div className="space-y-2 animate-fade-up">
          {entries.length === 0 ? (
            <div className="card p-10 text-center" style={{ color: "var(--text-muted)" }}>
              Chưa có dữ liệu xếp hạng
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isMe = entry.uid === currentUid;
              const isTop3 = idx < 3;
              const rc = rankColors[idx + 1];

              return (
                <div
                  key={entry.uid}
                  className="card p-4 flex items-center gap-4 transition-all"
                  style={{
                    border: isMe ? "1.5px solid var(--primary)" : isTop3 ? `1px solid ${rc.border}` : "1px solid var(--border-color)",
                    background: isMe ? "var(--primary-glow)" : isTop3 ? rc.bg : "var(--surface)",
                  }}
                >
                  {/* Rank */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={isTop3
                      ? { background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }
                      : { background: "var(--surface-2)", color: "var(--text-muted)" }}
                  >
                    {isTop3 ? rankEmoji[idx] : `#${entry.rank}`}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
                        {entry.displayName}
                        {isMe && <span className="ml-1 text-xs font-normal" style={{ color: "var(--primary)" }}>(bạn)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3" style={{ color: "#f97316" }} />
                        {entry.streak}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {entry.totalLearned}
                      </span>
                      {entry.badges.slice(0, 3).map((bId: BadgeId) => (
                        <span key={bId} title={BADGES[bId].name}>{BADGES[bId].emoji}</span>
                      ))}
                    </div>
                  </div>

                  {/* XP */}
                  <div className="flex-shrink-0 text-right">
                    <div className="font-bold tabular" style={{ color: isTop3 ? rc.text : "var(--text)" }}>
                      {entry.xp.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>XP</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* XP Formula explanation */}
        <div className="card p-4 mt-6 animate-fade-up">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
            CÁCH TÍNH ĐIỂM XP
          </p>
          <div className="flex gap-4 text-sm" style={{ color: "var(--text)" }}>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span>1 từ = <strong>10 XP</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4" style={{ color: "#f97316" }} />
              <span>1 ngày streak = <strong>50 XP</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
