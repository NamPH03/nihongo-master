// src/components/dictionary/VocabularyList.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { speakJapanese } from "@/lib/speech";
import type { UserWord } from "@/types/dictionary";

export default function VocabularyList() {
  const [words, setWords] = useState<UserWord[]>([]);
  const [filter, setFilter] = useState<"all" | "learning" | "mastered">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWords = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const snap = await getDocs(
          query(
            collection(db, "userWords"),
            where("userId", "==", user.uid)
          )
        );
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as UserWord[];
        setWords(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, []);

  const toggleStatus = async (wordId: string, current: "learning" | "mastered") => {
    const newStatus = current === "learning" ? "mastered" : "learning";
    await updateDoc(doc(db, "userWords", wordId), { status: newStatus });
    setWords((prev) =>
      prev.map((w) => w.id === wordId ? { ...w, status: newStatus } : w)
    );
  };

  const filtered = words.filter((w) =>
    filter === "all" ? true : w.status === filter
  );

  if (loading) return (
    <div className="text-center py-8 text-gray-400">⏳ Đang tải...</div>
  );

  return (
    <div>
      {/* Bộ lọc */}
      <div className="flex gap-2 mb-4">
        {(["all", "learning", "mastered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === f
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? `Tất cả (${words.length})`
              : f === "learning" ? `Đang học (${words.filter(w => w.status === "learning").length})`
              : `Đã thuộc (${words.filter(w => w.status === "mastered").length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Chưa có từ nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((word) => (
            <div key={word.id}
              className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">

              {/* Từ */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xl font-bold text-gray-900">{word.word}</span>
                  <span className="text-red-400 text-sm">{word.reading}</span>
                </div>
                <div className="text-gray-500 text-sm">{word.meaning}</div>
              </div>

              {/* Nút nghe */}
              <button
                onClick={() => speakJapanese(word.word, false)}
                className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition"
              >
                🔊
              </button>

              {/* Toggle status */}
              <button
                onClick={() => toggleStatus(word.id, word.status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  word.status === "mastered"
                    ? "bg-green-100 text-green-600 hover:bg-green-200"
                    : "bg-orange-100 text-orange-600 hover:bg-orange-200"
                }`}
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