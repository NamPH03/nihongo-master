// src/components/dictionary/WordDetail.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { speakJapanese } from "@/lib/speech";
import type { DictionaryWord } from "@/types/dictionary";
import { saveWordToSchedule } from "@/lib/progress";

type Props = { word: DictionaryWord };

const levelStyle: Record<string, { bg: string; color: string }> = {
  N5: { bg: "rgba(34,197,94,0.1)",   color: "#22c55e" },
  N4: { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6" },
  N3: { bg: "rgba(234,179,8,0.1)",   color: "#eab308" },
  N2: { bg: "rgba(249,115,22,0.1)",  color: "#f97316" },
  N1: { bg: "rgba(239,68,68,0.1)",   color: "#ef4444" },
};

type SaveStatus = "idle" | "saving" | "saved" | "already_learning";

export default function WordDetail({ word }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    const checkSaved = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const vocabSnap = await getDocs(
        query(collection(db, "vocabulary"), where("word", "==", word.word), where("reading", "==", word.reading))
      );
      if (!vocabSnap.empty) {
        const wordId = vocabSnap.docs[0].id;
        const progressSnap = await getDocs(collection(db, "userProgress", user.uid, "words"));
        if (progressSnap.docs.some((d) => d.id === wordId)) setSaveStatus("already_learning");
      }
    };
    checkSaved();
  }, [word]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaveStatus("saving");
    try {
      const vocabSnap = await getDocs(
        query(collection(db, "vocabulary"), where("word", "==", word.word), where("reading", "==", word.reading))
      );
      let wordId: string;
      if (!vocabSnap.empty) {
        wordId = vocabSnap.docs[0].id;
      } else {
        const meaning = word.meanings[0]?.definitions[0]?.meaning || "";
        const type = word.meanings[0]?.partOfSpeech || "N";
        const example = word.meanings[0]?.definitions[0]?.example || "";
        const exampleMeaning = word.meanings[0]?.definitions[0]?.exampleMeaning || "";
        const newDocRef = await addDoc(collection(db, "vocabulary"), {
          word: word.word, reading: word.reading, meaning, type,
          level: word.level || "N5", example, exampleMeaning,
          status: "new", createdAt: new Date().toISOString(), source: "dictionary",
        });
        wordId = newDocRef.id;
      }
      await saveWordToSchedule(user.uid, wordId);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Lỗi lưu từ:", err);
      setSaveStatus("idle");
    }
  };

  const lvl = levelStyle[word.level || ""] || { bg: "var(--surface-2)", color: "var(--text-muted)" };

  return (
    <div className="card p-6 rounded-2xl animate-fade-up">

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-jp text-5xl font-bold mb-1" style={{ color: "var(--text)" }}>
            {word.word}
          </div>
          <div className="text-lg font-jp" style={{ color: "var(--primary)" }}>{word.reading}</div>
        </div>
        {word.level && (
          <span className="badge" style={{ background: lvl.bg, color: lvl.color }}>
            {word.level}
          </span>
        )}
      </div>

      {/* Speak buttons */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={() => speakJapanese(word.word, false)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          🔊 Phát âm
        </button>
        <button
          onClick={() => speakJapanese(word.word, true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          🐢 Chậm
        </button>
      </div>

      {/* Meanings */}
      <div className="space-y-4 mb-5">
        {word.meanings.map((meaning, i) => (
          <div key={i}>
            <div className="inline-block badge mb-2"
              style={{ background: "var(--primary-glow)", color: "var(--primary)" }}>
              {meaning.partOfSpeech}
            </div>
            {meaning.definitions.map((def, j) => (
              <div key={j} className="ml-2">
                <div className="font-medium mb-1" style={{ color: "var(--text)" }}>
                  {j + 1}. {def.meaning}
                </div>
                {def.example && (
                  <div className="rounded-xl p-3 mt-1" style={{ background: "var(--surface-2)" }}>
                    <div className="text-sm font-jp" style={{ color: "var(--text-muted)" }}>{def.example}</div>
                    {def.exampleMeaning && (
                      <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
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

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveStatus !== "idle"}
        className="btn w-full py-3 rounded-2xl"
        style={
          saveStatus === "idle"
            ? { background: "var(--primary)", color: "#0d1f14" }
            : saveStatus === "saving"
            ? { background: "var(--surface-2)", color: "var(--text-muted)", cursor: "wait" }
            : saveStatus === "saved"
            ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
            : { background: "rgba(59,130,246,0.1)", color: "#3b82f6" }
        }
      >
        {saveStatus === "idle" && "📌 Lưu vào kho từ & lịch học"}
        {saveStatus === "saving" && "Đang lưu..."}
        {saveStatus === "saved" && "✅ Đã thêm vào lịch học"}
        {saveStatus === "already_learning" && "📚 Đang trong lịch học rồi"}
      </button>

      {saveStatus === "saved" && (
        <p className="text-center text-xs mt-2" style={{ color: "var(--text-faint)" }}>
          Từ này sẽ xuất hiện trong &quot;Học từ mới&quot; của bạn
        </p>
      )}
    </div>
  );
}