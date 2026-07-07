"use client";

// src/app/(dashboard)/vocabulary/page.tsx
// Trang Kho Từ Vựng Gộp: Hiển thị từ vựng kèm theo bộ lọc thông minh & Mức ghi nhớ (Spaced Repetition)

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { speakJapanese } from "@/lib/speech";
import { getSRStats, getUserWordStatuses, UserWordStatus } from "@/lib/progress";

type Vocabulary = {
  id: string; word: string; reading: string; meaning: string;
  level: string; type: string; example: string; exampleMeaning: string;
};

const levelColors: Record<string, { bg: string; color: string }> = {
  N5: { bg: "rgba(34,197,94,0.1)",   color: "#22c55e" },
  N4: { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6" },
  N3: { bg: "rgba(234,179,8,0.1)",   color: "#eab308" },
  N2: { bg: "rgba(249,115,22,0.1)",  color: "#f97316" },
  N1: { bg: "rgba(239,68,68,0.1)",   color: "#ef4444" },
};

const srColors: Record<number, string> = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#3b82f6", 5: "#22c55e",
};

const srLabels: Record<number, string> = {
  1: "Mức 1 (1h)", 2: "Mức 2 (1 ngày)", 3: "Mức 3 (3 ngày)", 4: "Mức 4 (1 tuần)", 5: "Mức 5 (2 tháng)",
};

const srBg: Record<number, string> = {
  1: "rgba(239,68,68,0.1)", 2: "rgba(249,115,22,0.1)", 3: "rgba(234,179,8,0.1)",
  4: "rgba(59,130,246,0.1)", 5: "rgba(34,197,94,0.1)",
};

export default function VocabularyPage() {
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [userWords, setUserWords] = useState<UserWordStatus[]>([]);
  const [srStats, setSrStats] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [filtered, setFiltered] = useState<Vocabulary[]>([]);
  
  // Bộ lọc
  const [selectedLevel, setSelectedLevel] = useState("Tất cả");
  const [selectedMemoryLevel, setSelectedMemoryLevel] = useState<string>("Tất cả");
  const [search, setSearch] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email || "");
        // Lấy thông tin mức nhớ của user
        const [stats, statuses] = await Promise.all([
          getSRStats(user.uid),
          getUserWordStatuses(user.uid)
        ]);
        setSrStats(stats);
        setUserWords(statuses);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchVocab = async () => {
      try {
        const q = query(collection(db, "vocabulary"), orderBy("level"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vocabulary[];
        setWords(data);
        setFiltered(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchVocab();
  }, []);

  useEffect(() => {
    let res = words;

    // Lọc theo N5-N1
    if (selectedLevel !== "Tất cả") {
      res = res.filter((w) => w.level === selectedLevel);
    }

    // Lọc theo Mức Nhớ (Spaced Repetition Level)
    if (selectedMemoryLevel !== "Tất cả") {
      const targetLevel = parseInt(selectedMemoryLevel);
      // Lọc ra các wordId đang ở mức nhớ này
      const targetWordIds = new Set(
        userWords
          .filter((uw) => uw.srLevel === targetLevel)
          .map((uw) => uw.id)
      );
      res = res.filter((w) => targetWordIds.has(w.id));
    }

    // Lọc theo từ khóa tìm kiếm
    if (search) {
      const q = search.toLowerCase();
      res = res.filter((w) =>
        w.word.includes(search) ||
        w.reading.includes(search) ||
        w.meaning.toLowerCase().includes(q)
      );
    }

    setFiltered(res);
  }, [selectedLevel, selectedMemoryLevel, search, words, userWords]);

  return (
    <div className="min-h-[100dvh] bg-page pb-20 md:pb-6">
      <Navbar userEmail={userEmail} />

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Kho từ vựng</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Hiển thị {filtered.length} từ vựng
          </p>
        </div>

        {/* Spaced Repetition Stats - Mức nhớ của tôi */}
        <div className="card p-5 mb-6 animate-fade-up">
          <h2 className="font-semibold text-sm mb-3" style={{ color: "var(--text)" }}>
            🧠 Phân phối mức nhớ của tôi
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = srStats[level] || 0;
              const isSelected = selectedMemoryLevel === String(level);
              return (
                <button
                  key={level}
                  onClick={() => setSelectedMemoryLevel(isSelected ? "Tất cả" : String(level))}
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
                    {count} từ
                  </span>
                </button>
              );
            })}
          </div>
          {selectedMemoryLevel !== "Tất cả" && (
            <div className="mt-3 flex justify-between items-center text-xs">
              <span style={{ color: "var(--text-muted)" }}>
                Đang lọc: <strong style={{ color: srColors[parseInt(selectedMemoryLevel)] }}>{srLabels[parseInt(selectedMemoryLevel)]}</strong>
              </span>
              <button 
                onClick={() => setSelectedMemoryLevel("Tất cả")}
                className="text-[var(--primary)] font-bold hover:underline"
              >
                Xóa lọc mức nhớ
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-col md:flex-row gap-4 items-stretch md:items-center animate-fade-up">
          <input
            type="text"
            placeholder="🔍 Tìm từ vựng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1"
          />
          <div className="flex gap-1.5 flex-wrap">
            {["Tất cả", "N5", "N4", "N3", "N2", "N1"].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ease-spring"
                style={
                  selectedLevel === level
                    ? { background: "var(--primary)", color: "#0d1f14" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }
                }
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Word grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-40 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 card">
            <div className="text-5xl mb-4">🔍</div>
            <p style={{ color: "var(--text-muted)" }}>Không tìm thấy từ vựng nào phù hợp bộ lọc</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((word, i) => {
              const lvl = levelColors[word.level] || { bg: "var(--surface-2)", color: "var(--text-muted)" };
              // Tìm trạng thái mức nhớ của từ này
              const memoryInfo = userWords.find(uw => uw.id === word.id);
              
              return (
                <div
                  key={word.id}
                  className="card p-5 animate-fade-up flex flex-col justify-between"
                  style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-jp text-2xl font-bold" style={{ color: "var(--text)" }}>
                          {word.word}
                        </div>
                        <div className="text-sm mt-0.5" style={{ color: "var(--primary)" }}>
                          {word.reading}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="badge text-[10px]" style={{ background: lvl.bg, color: lvl.color }}>
                          {word.level}
                        </span>
                        
                        {/* Huy hiệu Mức Nhớ */}
                        {memoryInfo && (
                          <span className="badge text-[9px] font-bold" 
                                style={{ 
                                  background: srBg[memoryInfo.srLevel], 
                                  color: srColors[memoryInfo.srLevel] 
                                }}>
                            Mức {memoryInfo.srLevel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-medium text-sm mb-3" style={{ color: "var(--text)" }}>
                      {word.meaning}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold" style={{ color: "var(--text-faint)" }}>
                        [{word.type}]
                      </span>
                      <button
                        onClick={() => speakJapanese(word.word)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-neutral-500/10"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                        title="Phát âm"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
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