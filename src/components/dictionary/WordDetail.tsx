// src/components/dictionary/WordDetail.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, query,
  where
} from "firebase/firestore";
import { speakJapanese } from "@/lib/speech";
import type { DictionaryWord } from "@/types/dictionary";
import { saveWordToSchedule } from "@/lib/progress";

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

type SaveStatus = "idle" | "saving" | "saved" | "already_learning";

export default function WordDetail({ word }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Kiểm tra từ đã được lưu/học chưa khi component load
  useEffect(() => {
    const checkSaved = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Tìm trong vocabulary collection theo word + reading
      const vocabSnap = await getDocs(
        query(
          collection(db, "vocabulary"),
          where("word", "==", word.word),
          where("reading", "==", word.reading)
        )
      );

      if (!vocabSnap.empty) {
        const wordId = vocabSnap.docs[0].id;
        // Kiểm tra user đã có trong userProgress chưa
        const progressSnap = await getDocs(
          collection(db, "userProgress", user.uid, "words")
        );
        const alreadyLearning = progressSnap.docs.some(
          (d) => d.id === wordId
        );
        if (alreadyLearning) setSaveStatus("already_learning");
      }
    };

    checkSaved();
  }, [word]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaveStatus("saving");

    try {
      // BƯỚC 1: Kiểm tra từ có trong vocabulary chưa
      const vocabSnap = await getDocs(
        query(
          collection(db, "vocabulary"),
          where("word", "==", word.word),
          where("reading", "==", word.reading)
        )
      );

      let wordId: string;

      if (!vocabSnap.empty) {
        // Từ đã có trong database → lấy ID
        wordId = vocabSnap.docs[0].id;
      } else {
        // Từ chưa có → thêm vào vocabulary collection
        const meaning = word.meanings[0]?.definitions[0]?.meaning || "";
        const type = word.meanings[0]?.partOfSpeech || "N";
        const example = word.meanings[0]?.definitions[0]?.example || "";
        const exampleMeaning = word.meanings[0]?.definitions[0]?.exampleMeaning || "";

        const newDocRef = await addDoc(collection(db, "vocabulary"), {
          word: word.word,
          reading: word.reading,
          meaning,
          type,
          level: word.level || "N5",
          example,
          exampleMeaning,
          status: "new",
          createdAt: new Date().toISOString(),
          source: "dictionary", // Đánh dấu từ này đến từ từ điển
        });

        wordId = newDocRef.id;
      }

      // BƯỚC 2: Tạo userProgress cho từ này → vào luồng SR
      await saveWordToSchedule(user.uid, wordId);

      setSaveStatus("saved");

    } catch (err) {
      console.error("Lỗi lưu từ:", err);
      setSaveStatus("idle");
    }
  };

  const buttonConfig = {
    idle: {
      text: "📌 Lưu vào kho từ & lịch học",
      className: "bg-red-600 text-white hover:bg-red-700",
    },
    saving: {
      text: "Đang lưu...",
      className: "bg-gray-200 text-gray-500 cursor-wait",
    },
    saved: {
      text: "✅ Đã thêm vào lịch học!",
      className: "bg-green-100 text-green-600 cursor-default",
    },
    already_learning: {
      text: "📚 Đang trong lịch học rồi",
      className: "bg-blue-100 text-blue-600 cursor-default",
    },
  };

  const btn = buttonConfig[saveStatus];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-5xl font-bold text-gray-900 mb-1">
            {word.word}
          </div>
          <div className="text-lg text-red-400">{word.reading}</div>
        </div>
        {word.level && (
          <span className={`text-sm font-bold px-3 py-1 rounded-xl ${levelColors[word.level] || "bg-gray-100 text-gray-600"}`}>
            {word.level}
          </span>
        )}
      </div>

      {/* Nút phát âm */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={() => speakJapanese(word.word, false)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition text-sm font-medium"
        >
          🔊 Phát âm
        </button>
        <button
          onClick={() => speakJapanese(word.word, true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition text-sm font-medium"
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
                  <div className="bg-gray-50 rounded-xl p-3 mt-1">
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
        disabled={saveStatus === "saving" || saveStatus === "saved" || saveStatus === "already_learning"}
        className={`w-full py-3 font-semibold rounded-2xl transition ${btn.className}`}
      >
        {btn.text}
      </button>

      {/* Giải thích */}
      {saveStatus === "saved" && (
        <p className="text-center text-xs text-gray-400 mt-2">
          Từ này sẽ xuất hiện trong &quot;Học từ mới&quot; của bạn!
        </p>
      )}
      {saveStatus === "already_learning" && (
        <p className="text-center text-xs text-gray-400 mt-2">
          Từ này đã có trong lịch học của bạn rồi.
        </p>
      )}

    </div>
  );
}