"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { BADGES, BadgeId, getEarnedBadges } from "@/lib/leaderboard";
import { getProgress, getSRStats } from "@/lib/progress";
import { Award, Lock } from "lucide-react";

const ALL_BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export default function BadgesPage() {
  const [userEmail, setUserEmail] = useState("");
  const [earned, setEarned] = useState<BadgeId[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");

      const [prog, srStats] = await Promise.all([
        getProgress(user.uid),
        getSRStats(user.uid),
      ]);

      const masteredCount = srStats[5] || 0;
      const earnedBadges = getEarnedBadges(prog.totalLearned, prog.streak, masteredCount);
      setEarned(earnedBadges);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải danh hiệu...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail={userEmail} />

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
            <Award className="w-6 h-6" style={{ color: "#a855f7" }} />
            Danh Hiệu
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {earned.length}/{ALL_BADGE_IDS.length} danh hiệu đã mở khoá
          </p>
        </div>

        {/* Progress bar */}
        <div className="card p-4 mb-6 animate-fade-up">
          <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            <span>Tiến độ danh hiệu</span>
            <span>{earned.length}/{ALL_BADGE_IDS.length}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(earned.length / ALL_BADGE_IDS.length) * 100}%`,
                background: "linear-gradient(90deg, var(--primary), #a855f7)",
              }}
            />
          </div>
        </div>

        {/* Earned badges */}
        {earned.length > 0 && (
          <div className="mb-6 animate-fade-up">
            <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Đã mở khoá ✨
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {earned.map((bId) => {
                const badge = BADGES[bId];
                return (
                  <div
                    key={bId}
                    className="card p-4 flex items-center gap-3 animate-fade-up"
                    style={{
                      border: `1px solid ${badge.color}40`,
                      background: badge.bg,
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: badge.bg, border: `1px solid ${badge.color}40` }}
                    >
                      {badge.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm" style={{ color: badge.color }}>
                        {badge.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {badge.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Locked badges */}
        <div className="animate-fade-up">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Chưa mở khoá 🔒
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {ALL_BADGE_IDS.filter((bId) => !earned.includes(bId)).map((bId) => {
              const badge = BADGES[bId];
              return (
                <div
                  key={bId}
                  className="card p-4 flex items-center gap-3"
                  style={{ opacity: 0.5 }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <Lock className="w-5 h-5" style={{ color: "var(--text-faint)" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm" style={{ color: "var(--text)" }}>
                      {badge.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {badge.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
