"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProgress, getSRStats, getDueWords, ProgressData } from "@/lib/progress";

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [srStats, setSrStats] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      const [prog, stats, due] = await Promise.all([
        getProgress(user.uid),
        getSRStats(),
        getDueWords(),
      ]);
      setProgress(prog);
      setSrStats(stats);
      setDueCount(due.length);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const totalLearned = Object.values(srStats).reduce((a, b) => a + b, 0);
  const maxSR = Math.max(...Object.values(srStats), 1);

  const srColors: Record<number, string> = {
    1: "bg-red-400",
    2: "bg-orange-400",
    3: "bg-yellow-400",
    4: "bg-blue-400",
    5: "bg-green-500",
  };

  const srLabels: Record<number, string> = {
    1: "1 tiếng",
    2: "1 ngày",
    3: "3 ngày",
    4: "1 tuần",
    5: "2 tháng",
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-4xl">⏳</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Menu */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">👤 {userEmail}</span>
          <button onClick={handleLogout}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition text-sm">
            Đăng xuất
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ===== STATS HÀNG ĐẦU ===== */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">🔥</div>
            <div className="text-2xl font-bold text-orange-500">{progress?.streak || 0}</div>
            <div className="text-xs text-gray-400 mt-1">Streak</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">📚</div>
            <div className="text-2xl font-bold text-blue-500">{totalLearned}</div>
            <div className="text-xs text-gray-400 mt-1">Đã học</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">⭐</div>
            <div className="text-2xl font-bold text-green-500">
              {progress?.dailyHistory?.[new Date().toISOString().split("T")[0]] || 0}
            </div>
            <div className="text-xs text-gray-400 mt-1">Hôm nay</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <div className="text-3xl mb-1">⏰</div>
            <div className="text-2xl font-bold text-red-500">{dueCount}</div>
            <div className="text-xs text-gray-400 mt-1">Cần ôn</div>
          </div>
        </div>

        {/* ===== BIỂU ĐỒ 5 MỨC SR ===== */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-gray-700 mb-1">📊 Phân bố từ vựng theo mức ghi nhớ</h2>
          <p className="text-xs text-gray-400 mb-5">Spaced Repetition — càng lên cao càng nhớ lâu</p>

          <div className="flex items-end justify-around gap-3 h-40">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = srStats[level] || 0;
              const height = maxSR > 0 ? (count / maxSR) * 100 : 0;
              return (
                <div key={level} className="flex flex-col items-center gap-2 flex-1">
                  {/* Số từ */}
                  <span className="text-xs font-bold text-gray-600">
                    {count > 0 ? count : ""}
                  </span>
                  {/* Cột */}
                  <div className="w-full flex items-end" style={{ height: "100px" }}>
                    <div
                      className={`w-full rounded-t-xl transition-all ${srColors[level]} ${count === 0 ? "opacity-20" : ""}`}
                      style={{ height: count === 0 ? "4px" : `${Math.max(height, 8)}%` }}
                    />
                  </div>
                  {/* Label */}
                  <div className="text-center">
                    <div className="text-sm font-bold text-gray-700">Mức {level}</div>
                    <div className="text-xs text-gray-400">{srLabels[level]}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
            <span>Tổng đã học: <span className="font-bold text-gray-600">{totalLearned} từ</span></span>
            <span>Chưa học: <span className="font-bold text-gray-600">{968 - totalLearned} từ</span></span>
          </div>
        </div>

        {/* ===== CÁC TÍNH NĂNG ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: "🎯", label: "Học từ mới", sub: "10 từ mỗi buổi", href: "/learn", active: true, highlight: false },
            { icon: "🔁", label: "Ôn tập", sub: dueCount > 0 ? `${dueCount} từ cần ôn` : "Chưa có từ cần ôn", href: "/review", active: dueCount > 0, highlight: dueCount > 0 },
            { icon: "📚", label: "Từ vựng", sub: "968 từ N5", href: "/vocabulary", active: true, highlight: false },
            { icon: "📈", label: "Tiến độ", sub: "Xem chi tiết", href: "/progress", active: true, highlight: false },
            { icon: "✍️", label: "Trắc nghiệm", sub: "Sắp có", href: "#", active: false, highlight: false },
            { icon: "📱", label: "Mobile App", sub: "Sắp có", href: "#", active: false, highlight: false },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-2xl p-5 shadow-sm transition ${
                item.highlight
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : item.active
                  ? "bg-white hover:shadow-md"
                  : "bg-white opacity-50 pointer-events-none"
              }`}
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className={`font-semibold ${item.highlight ? "text-white" : "text-gray-700"}`}>
                {item.label}
              </div>
              <div className={`text-xs mt-1 ${item.highlight ? "text-red-100" : "text-gray-400"}`}>
                {item.sub}
              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}