"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase"; // Import thêm db để lấy dữ liệu nếu cần
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore"; // Thêm để lấy danh sách từ trực tiếp
import Link from "next/link";
import { getProgress, getSRStats, getDueWords, ProgressData, WordProgress } from "@/lib/progress";
import NotificationSetup from "@/components/ui/NotificationSetup";
import { checkAndNotify, canNotifyNow, setLastNotifyTime } from "@/lib/notifications";

// Định nghĩa lại kiểu dữ liệu hiển thị dựa trên WordProgress thực tế của hệ thống
type DashboardWord = WordProgress & {
  id: string;
};

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [srStats, setSrStats] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [dueCount, setDueCount] = useState(0);
  const [userWords, setUserWords] = useState<DashboardWord[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "memory">("overview");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }

      setUserEmail(user.email || "");

      try {
        // 1. Lấy stats tiến độ, thống kê SR và từ đến hạn học
        const [prog, stats, due] = await Promise.all([
          getProgress(user.uid),
          getSRStats(user.uid),
          getDueWords(user.uid),
        ]);

        // 2. Thay thế getUserWordStatuses bằng cách fetch trực tiếp sub-collection progress
        const progressColRef = collection(db, "users", user.uid, "progress");
        const snap = await getDocs(progressColRef);
        const fetchedWords: DashboardWord[] = [];
        
        snap.forEach((doc) => {
          // Bỏ qua document "stats" vì nó chứa thông tin streak chứ không phải từ vựng
          if (doc.id !== "stats") {
            fetchedWords.push({
              id: doc.id,
              ...doc.data()
            } as DashboardWord);
          }
        });

        setProgress(prog);
        setSrStats(stats);
        setDueCount(due.length);
        setUserWords(fetchedWords);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu dashboard:", error);
      } finally {
        setLoading(false);
      }

      // 3. Kiểm tra thông báo tự động cho người dùng
      if (typeof window !== "undefined" && canNotifyNow()) {
        const todayStr = new Date().toISOString().split("T")[0];
        const studiedToday = (progress?.dailyHistory?.[todayStr] || 0) > 0;
        // Kiểm tra do biến progress lúc này có thể chưa cập nhật state kịp thời nên sử dụng biến cục bộ từ Promise nếu cần, ở đây giữ nguyên logic chạy sau khi load.
        checkAndNotify(dueCount, progress?.streak || 0, studiedToday);
        setLastNotifyTime();
      }
    });

    return () => unsubscribe();
  }, [router, dueCount, progress?.dailyHistory, progress?.streak]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const totalLearned = Object.values(srStats).reduce((a, b) => a + b, 0);
  const maxSR = Math.max(...Object.values(srStats), 1);
  const groupedWords = [1, 2, 3, 4, 5].map((level) => ({
    level,
    words: userWords.filter((w) => w.srLevel === level),
  }));

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
      <div className="text-4xl animate-bounce">⏳</div>
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
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">

        <div className="flex gap-2 mb-6">
          {(["overview", "memory"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {tab === "overview" ? "Tổng quan" : "Kho từ theo mức nhớ"}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
            {/* ===== STATS ===== */}
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

            {/* ===== BIỂU ĐỒ SR ===== */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
              <h2 className="font-bold text-gray-700 mb-1">📊 Phân bố từ vựng theo mức ghi nhớ</h2>
              <p className="text-xs text-gray-400 mb-5">Spaced Repetition — càng lên cao càng nhớ lâu</p>

              <div className="flex items-end justify-around gap-3 h-40">
                {[1, 2, 3, 4, 5].map((level) => {
                  const count = srStats[level] || 0;
                  const height = maxSR > 0 ? (count / maxSR) * 100 : 0;
                  return (
                    <div key={level} className="flex flex-col items-center gap-2 flex-1">
                      <span className="text-xs font-bold text-gray-600">
                        {count > 0 ? count : ""}
                      </span>
                      <div className="w-full flex items-end" style={{ height: "100px" }}>
                        <div
                          className={`w-full rounded-t-xl transition-all ${srColors[level]} ${count === 0 ? "opacity-20" : ""}`}
                          style={{ height: count === 0 ? "4px" : `${Math.max(height, 8)}%` }}
                        />
                      </div>
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

            {/* ===== TÍNH NĂNG ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: "🎯", label: "Học từ mới", sub: "10 từ mỗi buổi", href: "/learn", active: true, highlight: false },
                { icon: "🔁", label: "Ôn tập", sub: dueCount > 0 ? `${dueCount} từ cần ôn` : "Chưa có từ cần ôn", href: "/review", active: dueCount > 0, highlight: dueCount > 0 },
                { icon: "📚", label: "Từ vựng", sub: "968 từ N5", href: "/vocabulary", active: true, highlight: false },
                { icon: "📖", label: "Từ điển", sub: "Tra cứu từ vựng", href: "/dictionary", active: true, highlight: false },
                { icon: "📈", label: "Tiến độ", sub: "Xem chi tiết", href: "/progress", active: true, highlight: false },
                { icon: "✍️", label: "Trắc nghiệm", sub: "Sắp có", href: "#", active: false, highlight: false },
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
          </>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-700">🗂️ Kho từ theo mức nhớ</h2>
                <p className="text-xs text-gray-400">Tất cả từ đã học hoặc lưu từ hệ thống Spaced Repetition sẽ xuất hiện ở đây</p>
              </div>
            </div>

            <div className="space-y-4">
              {groupedWords.map(({ level, words }) => (
                <div key={level} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-700">Mức {level}</div>
                      <div className="text-xs text-gray-400">{srLabels[level]}</div>
                    </div>
                    <span className="text-sm font-bold text-gray-600">{words.length} từ</span>
                  </div>

                  {words.length === 0 ? (
                    <div className="text-sm text-gray-400 py-2">Chưa có từ nào ở mức này</div>
                  ) : (
                    <div className="space-y-2">
                      {words.map((word) => (
                        <div key={word.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                          <div>
                            {/* Do file progress.ts chỉ lưu ID từ vựng làm Doc ID để tránh trùng lặp dữ liệu, ta hiển thị ID hoặc xử lý map dữ liệu từ điển nếu cần */}
                            <div className="font-medium text-gray-700">{word.wordId}</div>
                            <div className="text-xs text-gray-400">
                              {word.lastReviewed ? `Ôn gần nhất: ${new Date(word.lastReviewed).toLocaleDateString("vi-VN")}` : "Chưa ôn tập"}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${word.status === "learned" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {word.status === "learned" ? "Đang học" : "Từ mới"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <NotificationSetup />
    </main>
  );
}