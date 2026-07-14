"use client";

// src/app/(dashboard)/vocabulary/page.tsx
// Sổ Tay — Hiển thị TỪ ĐÃ LƯU / ĐÃ HỌC của user theo mức ghi nhớ 1-5

import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { speakJapanese } from "@/lib/speech";
import { getSRStats } from "@/lib/progress";
import { BookOpen, Volume2, Search, SlidersHorizontal } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
type NoteWord = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  level: string;
  type: string;
  srLevel: number;
  nextReview: string | null;
  status: "learned" | "new";
};

// ─── Màu sắc ─────────────────────────────────────────────────
const levelColors: Record<string, { bg: string; color: string }> = {
  N5: { bg: "rgba(34,197,94,0.1)",  color: "#22c55e" },
  N4: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  N3: { bg: "rgba(234,179,8,0.1)",  color: "#eab308" },
  N2: { bg: "rgba(249,115,22,0.1)", color: "#f97316" },
  N1: { bg: "rgba(239,68,68,0.1)",  color: "#ef4444" },
};

const srColors: Record<number, string> = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#3b82f6", 5: "#22c55e",
};

const srBg: Record<number, string> = {
  1: "rgba(239,68,68,0.1)", 2: "rgba(249,115,22,0.1)", 3: "rgba(234,179,8,0.1)",
  4: "rgba(59,130,246,0.1)", 5: "rgba(34,197,94,0.1)",
};

const srLabels: Record<number, string> = {
  1: "Mức 1 — Ôn lại sau 1 giờ",
  2: "Mức 2 — Ôn lại sau 1 ngày",
  3: "Mức 3 — Ôn lại sau 3 ngày",
  4: "Mức 4 — Ôn lại sau 1 tuần",
  5: "Mức 5 — Ôn lại sau 2 tháng",
};

// ─── Helpers ─────────────────────────────────────────────────
function formatNextReview(iso: string | null): string {
  if (!iso) return "Chưa có lịch";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Đến hạn ôn ngay";
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `Còn ${d} ngày`;
  if (h > 0) return `Còn ${h} giờ`;
  return "Còn < 1 giờ";
}

// ─── Page ────────────────────────────────────────────────────
export default function NotebookPage() {
  const [allWords, setAllWords] = useState<NoteWord[]>([]);
  const [filtered, setFiltered]  = useState<NoteWord[]>([]);
  const [srStats, setSrStats]   = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Tất cả");
  const [selectedSR, setSelectedSR]   = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  // ── Tải dữ liệu progress + vocabulary của user ──────────
  const loadUserNotebook = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      // Bước 1: Lấy toàn bộ progress của user
      const progressSnap = await getDocs(collection(db, "users", uid, "progress"));
      const progressDocs = progressSnap.docs.filter((d) => d.id !== "stats");

      if (progressDocs.length === 0) {
        setAllWords([]);
        setFiltered([]);
        setSrStats({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        return;
      }

      // Bước 2: Lấy chi tiết từ vựng song song (batch getDoc)
      const wordDetails = await Promise.all(
        progressDocs.map(async (pd) => {
          const data = pd.data();
          const wordId = data.wordId || pd.id;
          try {
            const vocabSnap = await getDoc(doc(db, "vocabulary", wordId));
            if (!vocabSnap.exists()) return null;
            const v = vocabSnap.data();
            return {
              id: wordId,
              word: v.word || "",
              reading: v.reading || "",
              meaning: v.meaning || "",
              level: v.level || "N5",
              type: v.type || "",
              srLevel: data.srLevel ?? 0,
              nextReview: data.nextReview || null,
              status: data.status || "new",
            } as NoteWord;
          } catch {
            return null;
          }
        })
      );

      // Bước 3: Chỉ giữ từ có srLevel >= 1 (mức 1-5)
      const validWords = wordDetails.filter(
        (w): w is NoteWord => w !== null && w.srLevel >= 1
      );
      validWords.sort((a, b) => a.srLevel - b.srLevel);
      setAllWords(validWords);
      setFiltered(validWords);

      // Bước 4: Cập nhật stats
      const stats = await getSRStats(uid);
      setSrStats(stats);
    } catch (e) {
      console.error("Lỗi tải sổ tay:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email || "");
        await loadUserNotebook(user.uid);
      }
    });
    return () => unsubscribe();
  }, [router, loadUserNotebook]);

  // ── Lọc ──────────────────────────────────────────────────
  useEffect(() => {
    let res = allWords;

    if (selectedSR !== null) {
      res = res.filter((w) => w.srLevel === selectedSR);
    }
    if (selectedLevel !== "Tất cả") {
      res = res.filter((w) => w.level === selectedLevel);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (w) =>
          w.word.includes(search) ||
          w.reading.includes(search) ||
          w.meaning.toLowerCase().includes(q)
      );
    }

    setFiltered(res);
  }, [allWords, selectedSR, selectedLevel, search]);

  const totalWords = allWords.length;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-page pb-24 md:pb-8">
      <Navbar userEmail={userEmail} />

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Header ─────────────────────────────────── */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-6 h-6" style={{ color: "var(--primary)" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Sổ tay</h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {loading ? "Đang tải..." : `${totalWords} từ đã lưu · Đang hiển thị ${filtered.length} từ`}
          </p>
        </div>

        {/* ── Mức ghi nhớ (SR levels) ────────────────── */}
        <div className="card p-5 mb-5 animate-fade-up">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5" style={{ color: "var(--text)" }}>
            🧠 Mức ghi nhớ
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = srStats[level] || 0;
              const isSelected = selectedSR === level;
              return (
                <button
                  key={level}
                  onClick={() => setSelectedSR(isSelected ? null : level)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 active:scale-95"
                  style={{
                    background: isSelected ? srBg[level] : "var(--surface-2)",
                    borderColor: isSelected ? srColors[level] : "var(--border-color)",
                  }}
                >
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    Mức {level}
                  </span>
                  <span className="text-sm font-bold mt-1" style={{ color: srColors[level] }}>
                    {count}
                  </span>
                  <span className="text-[9px] mt-0.5" style={{ color: "var(--text-faint)" }}>từ</span>
                </button>
              );
            })}
          </div>
          {selectedSR !== null && (
            <div className="mt-3 flex justify-between items-center text-xs">
              <span style={{ color: "var(--text-muted)" }}>
                {srLabels[selectedSR]}
              </span>
              <button
                onClick={() => setSelectedSR(null)}
                className="font-bold hover:underline"
                style={{ color: "var(--primary)" }}
              >
                Bỏ lọc
              </button>
            </div>
          )}
        </div>

        {/* ── Thanh lọc ──────────────────────────────── */}
        <div className="card p-4 mb-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center animate-fade-up">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-faint)" }} />
            <input
              type="text"
              placeholder="Tìm từ trong sổ tay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>

          {/* N-level filter */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
            <div className="flex gap-1 flex-wrap">
              {["Tất cả", "N5", "N4", "N3", "N2", "N1"].map((lv) => (
                <button
                  key={lv}
                  onClick={() => setSelectedLevel(lv)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={
                    selectedLevel === lv
                      ? { background: "var(--primary)", color: "#0d1f14" }
                      : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }
                  }
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Danh sách từ ───────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : totalWords === 0 ? (
          /* Chưa có từ nào */
          <div className="card text-center py-20 flex flex-col items-center gap-4 animate-fade-up">
            <div className="text-6xl">📖</div>
            <div>
              <p className="font-semibold text-base" style={{ color: "var(--text)" }}>Sổ tay đang trống</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Lưu từ từ Từ điển hoặc hoàn thành bài học để thêm từ vào đây.
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* Lọc không có kết quả */
          <div className="card text-center py-16 animate-fade-up">
            <div className="text-5xl mb-3">🔍</div>
            <p style={{ color: "var(--text-muted)" }}>Không tìm thấy từ nào phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((word, i) => {
              const lvl = levelColors[word.level] || { bg: "var(--surface-2)", color: "var(--text-muted)" };
              const reviewText = formatNextReview(word.nextReview);
              const isOverdue = word.nextReview && new Date(word.nextReview) <= new Date();

              return (
                <div
                  key={word.id}
                  className="card p-5 flex flex-col justify-between animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
                >
                  {/* Top: word + badges */}
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-jp text-2xl font-bold" style={{ color: "var(--text)" }}>
                          {word.word}
                        </div>
                        <div className="text-sm mt-0.5 font-medium" style={{ color: "var(--primary)" }}>
                          {word.reading}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {word.level && (
                          <span className="badge text-[10px]" style={{ background: lvl.bg, color: lvl.color }}>
                            {word.level}
                          </span>
                        )}
                        <span
                          className="badge text-[10px] font-bold"
                          style={{ background: srBg[word.srLevel], color: srColors[word.srLevel] }}
                        >
                          Mức {word.srLevel}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                      {word.meaning}
                    </div>
                  </div>

                  {/* Bottom: type + review time + speak */}
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col gap-0.5">
                        {word.type && (
                          <span className="text-[10px] font-bold" style={{ color: "var(--text-faint)" }}>
                            [{word.type}]
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: isOverdue ? srColors[word.srLevel] : "var(--text-faint)" }}
                        >
                          {reviewText}
                        </span>
                      </div>
                      <button
                        onClick={() => speakJapanese(word.word)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-neutral-500/10"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                        title="Phát âm"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}