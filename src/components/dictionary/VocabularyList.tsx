// src/components/dictionary/VocabularyList.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { speakJapanese } from "@/lib/speech";
import type { UserWord } from "@/types/dictionary";

const filterLabels = {
  all:      (n: number) => `Tất cả (${n})`,
  learning: (n: number) => `Đang học (${n})`,
  mastered: (n: number) => `Đã thuộc (${n})`,
};

export default function VocabularyList() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [filter, setFilter] = useState<"all" | "learning" | "mastered">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWords = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDocs(query(collection(db, "userWords"), where("userId", "==", user.uid)));
        setWords(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as UserWord[]);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchWords();
  }, []);

  const toggleStatus = async (wordId: string, current: "learning" | "mastered") => {
    const next = current === "learning" ? "mastered" : "learning";
    await updateDoc(doc(db, "userWords", wordId), { status: next });
    setWords((prev) => prev.map((w) => w.id === wordId ? { ...w, status: next } : w));
  };

  const filtered = words.filter((w) => filter === "all" || w.status === filter);

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="animate-fade-up">
      {/* Filter pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "learning", "mastered"] as const).map((f) => {
          const count = f === "all" ? words.length
            : words.filter((w) => w.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-spring"
              style={
                filter === f
                  ? { background: "var(--primary)", color: "#0d1f14" }
                  : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }
              }
            >
              {filterLabels[f](count)}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <p style={{ color: "var(--text-muted)" }}>Chưa có từ nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((word, i) => (
            <div
              key={word.id}
              className="card px-4 py-3 flex items-center gap-4 animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
            >
              {/* Word info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-jp font-bold" style={{ color: "var(--text)" }}>{word.word}</span>
                  <span className="text-sm font-jp" style={{ color: "var(--primary)" }}>{word.reading}</span>
                </div>
                <div className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{word.meaning}</div>
              </div>

              {/* Speak */}
              <button
                onClick={() => speakJapanese(word.word, false)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                🔊
              </button>

              {/* Status toggle */}
              <button
                onClick={() => toggleStatus(word.id, word.status)}
                className="badge flex-shrink-0 transition-all duration-200"
                style={
                  word.status === "mastered"
                    ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" }
                    : { background: "rgba(249,115,22,0.1)", color: "#f97316" }
                }
              >
                {word.status === "mastered" ? "✅ Đã thuộc" : "📖 Đang học"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}