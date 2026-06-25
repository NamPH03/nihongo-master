// src/app/(dashboard)/progress/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getProgress, ProgressData } from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      const data = await getProgress(user.uid);
      setProgress(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Tạo mảng 30 ngày gần nhất
  const getLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-4xl">⏳</div>
    </div>
  );

  const last30Days = getLast30Days();
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Menu */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </Link>
        <Link href="/dashboard" className="text-gray-500 text-sm">← Về Dashboard</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">📈 Tiến độ học tập</h1>

        {/* 3 ô thống kê */}
        <div className="grid grid-cols-3 gap-4 mb-8">

          {/* Streak */}
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="text-4xl mb-2">🔥</div>
            <div className="text-3xl font-bold text-orange-500">
              {progress?.streak || 0}
            </div>
            <div className="text-gray-400 text-sm mt-1">Ngày liên tiếp</div>
          </div>

          {/* Tổng từ đã học */}
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="text-4xl mb-2">📚</div>
            <div className="text-3xl font-bold text-blue-500">
              {progress?.totalLearned || 0}
            </div>
            <div className="text-gray-400 text-sm mt-1">Từ đã học</div>
          </div>

          {/* Hôm nay */}
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="text-4xl mb-2">⭐</div>
            <div className="text-3xl font-bold text-green-500">
              {progress?.dailyHistory?.[todayStr] || 0}
            </div>
            <div className="text-gray-400 text-sm mt-1">Từ hôm nay</div>
          </div>

        </div>

        {/* Lịch sử 30 ngày */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-4">📅 30 ngày gần nhất</h2>
          <div className="grid grid-cols-10 gap-1.5">
            {last30Days.map((day) => {
              const count = progress?.dailyHistory?.[day] || 0;
              const isToday = day === todayStr;
              return (
                <div
                  key={day}
                  title={`${day}: ${count} từ`}
                  className={`aspect-square rounded-md transition-all ${
                    isToday
                      ? "ring-2 ring-red-400"
                      : ""
                  } ${
                    count === 0
                      ? "bg-gray-100"
                      : count < 5
                      ? "bg-green-200"
                      : count < 10
                      ? "bg-green-400"
                      : "bg-green-600"
                  }`}
                />
              );
            })}
          </div>
          {/* Chú thích màu */}
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-xs text-gray-400">Ít</span>
            <div className="w-3 h-3 rounded bg-gray-100" />
            <div className="w-3 h-3 rounded bg-green-200" />
            <div className="w-3 h-3 rounded bg-green-400" />
            <div className="w-3 h-3 rounded bg-green-600" />
            <span className="text-xs text-gray-400">Nhiều</span>
          </div>
        </div>

        {/* Nút học tiếp */}
        <Link
          href="/learn"
          className="block w-full mt-6 py-4 bg-red-600 text-white font-semibold rounded-2xl text-center hover:bg-red-700 transition"
        >
          🚀 Học từ mới ngay
        </Link>

      </div>
    </main>
  );
}