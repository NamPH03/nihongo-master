"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { speakJapanese } from "@/lib/speech";

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

export default function VocabularyPage() {
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [filtered, setFiltered] = useState<Vocabulary[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
      else setUserEmail(user.email || "");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const q = query(collection(db, "vocabulary"), orderBy("level"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vocabulary[];
        setWords(data); setFiltered(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  useEffect(() => {
    let res = words;
    if (selectedLevel !== "Tất cả") res = res.filter((w) => w.level === selectedLevel);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter((w) =>
        w.word.includes(search) || w.reading.includes(search) ||
        w.meaning.toLowerCase().includes(q)
      );
    }
    setFiltered(res);
  }, [selectedLevel, search, words]);

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail={userEmail} showBackToDashboard />

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Từ vựng</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {filtered.length} từ {selectedLevel !== "Tất cả" ? `cấp ${selectedLevel}` : "tất cả cấp"}
          </p>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center animate-fade-up">
          <input
            type="text"
            placeholder="🔍 Tìm từ vựng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1 min-w-48"
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
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p style={{ color: "var(--text-muted)" }}>Không tìm thấy từ vựng nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((word, i) => {
              const lvl = levelColors[word.level] || { bg: "var(--surface-2)", color: "var(--text-muted)" };
              return (
                <div
                  key={word.id}
                  className="card p-5 animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
                >
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
                      <span className="badge" style={{ background: lvl.bg, color: lvl.color }}>
                        {word.level}
                      </span>
                      <button
                        onClick={() => speakJapanese(word.word)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                        title="Phát âm"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="font-medium text-sm mb-3" style={{ color: "var(--text)" }}>
                    {word.meaning}
                  </div>
                  <div className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
                    [{word.type}]
                  </div>

                  {word.example && (
                    <div className="rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)" }}>
                      <div style={{ color: "var(--text-muted)" }}>{word.example}</div>
                      {word.exampleMeaning && (
                        <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                          {word.exampleMeaning}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}