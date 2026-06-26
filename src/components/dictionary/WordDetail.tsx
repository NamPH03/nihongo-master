// src/components/dictionary/WordDetail.tsx
"use client";

import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { speakJapanese } from "@/lib/speech";
import type { DictionaryWord } from "@/types/dictionary";

type Props = {
  word: DictionaryWord;
};

const levelColors: Record<string, string> = {
  N5: "bg-green-100 text-green-700",
  N4: "bg-blue-100 text-blue-700",
  N3: "bg-yellow-100 text-yellow-700",
  N2: "bg-orange-100 text-orange-700",
  N1: "bg-red-100 text-red-700",
};

export default function WordDetail({ word }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      // Kiểm tra đã lưu chưa
      const existing = await getDocs(
        query(
          collection(db, "userWords"),
          where("userId", "==", user.uid),
          where("wordId", "==", word.id)
        )
      );

      if (!existing.empty) {
        setSaved(true);
        return;
      }

      // Lưu vào Firebase
      await addDoc(collection(db, "userWords"), {
        userId: user.uid,
        wordId: word.id,
        word: word.word,
        reading: word.reading,
        meaning: word.meanings[0]?.definitions[0]?.meaning || "",
        status: "learning",
        notes: "",
        createdAt: new Date().toISOString(),
        reviewCount: 0,
      });

      setSaved(true);
    } catch (err) {
      console.error("Lỗi lưu từ:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">

      {/* Header — từ + badge level */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-5xl font-bold text-gray-900 mb-1">
            {word.word}
          </div>
          <div className="text-lg text-red-400">{word.reading}</div>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-xl ${levelColors[word.level] || "bg-gray-100 text-gray-600"}`}>
          {word.level}
        </span>
      </div>

      {word.source && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${word.source === "external" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
            {word.source === "external" ? "🌐 Tra từ API bên ngoài" : "🗂️ Từ vựng nội bộ"}
          </span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${word.language === "en-jp" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
            {word.language === "en-jp" ? "EN → JP" : "VI → JP"}
          </span>
        </div>
      )}

      {/* Nút phát âm */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={() => speakJapanese(word.word, false)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition text-sm font-medium"
        >
          🔊 Phát âm
        </button>
        <button
          onClick={() => speakJapanese(word.word, true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition text-sm font-medium"
        >
          🐢 Chậm
        </button>
      </div>

      {/* Nghĩa theo loại từ */}
      <div className="space-y-4 mb-5">
        {word.meanings.map((meaning, i) => (
          <div key={i}>
            <div className="inline-block bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-lg mb-2">
              {meaning.partOfSpeech}
            </div>
            {meaning.definitions.map((def, j) => (
              <div key={j} className="ml-2">
                <div className="text-gray-800 font-medium mb-1">
                  {j + 1}. {def.meaning}
                </div>
                {def.example && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-gray-600 text-sm">{def.example}</div>
                    {def.exampleMeaning && (
                      <div className="text-gray-400 text-xs mt-1">
                        {def.exampleMeaning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Nút lưu */}
      <button
        onClick={handleSave}
        disabled={saved || saving}
        className={`w-full py-3 font-semibold rounded-2xl transition ${
          saved
            ? "bg-green-100 text-green-600 cursor-default"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        {saved ? "✅ Đã lưu vào kho từ" : saving ? "Đang lưu..." : "📌 Lưu vào kho từ"}
      </button>
    </div>
  );
}