// src/components/dictionary/WordDetail.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { speakJapanese } from "@/lib/speech";
import type { DictionaryWord } from "@/types/dictionary";
import { saveWordFromDictionary } from "@/lib/progress";
import { Volume2, Bookmark, BookmarkCheck, Info, X } from "lucide-react";

type Props = { word: DictionaryWord };

const levelStyle: Record<string, { bg: string; color: string }> = {
  N5: { bg: "rgba(34,197,94,0.1)",   color: "#22c55e" },
  N4: { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6" },
  N3: { bg: "rgba(234,179,8,0.1)",   color: "#eab308" },
  N2: { bg: "rgba(249,115,22,0.1)",  color: "#f97316" },
  N1: { bg: "rgba(239,68,68,0.1)",   color: "#ef4444" },
};

type SaveStatus = "idle" | "saving" | "saved" | "already_learning";

type KanjiDetail = {
  kanji: string;
  meanings: string[];
  kun_readings: string[];
  on_readings: string[];
};

// Hàm chuyển chữ Kanji thành mã Unicode Hex 5 kí tự (dạng KanjiVG)
function getKanjiVGCode(char: string): string {
  const code = char.charCodeAt(0).toString(16);
  return code.padStart(5, "0");
}

export default function WordDetail({ word }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [kanjis, setKanjis] = useState<KanjiDetail[]>([]);
  const [loadingKanji, setLoadingKanji] = useState(false);
  
  // Lưu chữ Kanji được chọn để xem sơ đồ nét vẽ
  const [selectedStrokeKanji, setSelectedStrokeKanji] = useState<string | null>(null);

  useEffect(() => {
    const checkSaved = async () => {
      const user = auth.currentUser;
      if (!user) return;
      // Tìm wordId qua API (không ghi trực tiếp vào Firestore client)
      try {
        const res = await fetch("/api/vocabulary/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: word.word, reading: word.reading }),
        });
        if (!res.ok) return;
        const { wordId } = await res.json();
        if (!wordId) return;
        // Kiểm tra xem user đã có từ này trong progress chưa
        const progressSnap = await getDoc(doc(db, "users", user.uid, "progress", wordId));
        if (progressSnap.exists()) setSaveStatus("already_learning");
      } catch {
        // Bỏ qua lỗi check
      }
    };
    checkSaved();
  }, [word]);

  // Tìm và phân tích Kanji trong từ vựng (tương tự Mazii)
  useEffect(() => {
    const analyzeKanji = async () => {
      const kanjiRegex = /[\u4e00-\u9faf]/g;
      const foundKanjis = word.word.match(kanjiRegex);
      if (!foundKanjis) {
        setKanjis([]);
        return;
      }
      
      const uniqueKanjis = Array.from(new Set(foundKanjis));
      setLoadingKanji(true);
      try {
        const details = await Promise.all(
          uniqueKanjis.map(async (char) => {
            try {
              const res = await fetch(`https://kanjiapi.dev/v1/kanji/${char}`);
              if (!res.ok) return null;
              const data = await res.json();
              return {
                kanji: char,
                meanings: data.meanings || [],
                kun_readings: data.kun_readings || [],
                on_readings: data.on_readings || [],
              } as KanjiDetail;
            } catch {
              return null;
            }
          })
        );
        setKanjis(details.filter((k): k is KanjiDetail => k !== null));
      } catch (err) {
        console.error("Lỗi phân tích Kanji:", err);
      } finally {
        setLoadingKanji(false);
      }
    };

    analyzeKanji();
  }, [word.word]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSaveStatus("saving");
    try {
      const meaning = word.meanings[0]?.definitions[0]?.meaning || "";
      const type = word.meanings[0]?.partOfSpeech || "N";
      const example = word.meanings[0]?.definitions[0]?.example || "";
      const exampleMeaning = word.meanings[0]?.definitions[0]?.exampleMeaning || "";

      // Gọi API route (Admin SDK) để tìm hoặc tạo document vocabulary
      const res = await fetch("/api/vocabulary/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.word,
          reading: word.reading,
          meaning,
          type,
          level: word.level || "N5",
          example,
          exampleMeaning,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const { wordId } = await res.json();
      if (!wordId) throw new Error("No wordId returned");

      // Lưu vào sổ tay của user → mức 1 ngay
      await saveWordFromDictionary(user.uid, wordId);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Lỗi lưu từ:", err);
      setSaveStatus("idle");
    }
  };

  const lvl = levelStyle[word.level || ""] || { bg: "var(--surface-2)", color: "var(--text-muted)" };

  return (
    <div className="card p-6 rounded-2xl animate-fade-up flex flex-col gap-4 relative">

      {/* Sơ đồ nét vẽ Kanji Modal/Overlay */}
      {selectedStrokeKanji && (
        <div className="absolute inset-0 bg-page/95 rounded-2xl z-20 p-6 flex flex-col gap-4 animate-scale-in">
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border-color)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Hướng dẫn nét vẽ chữ Hán: <span className="font-jp text-lg font-bold" style={{ color: "var(--text)" }}>{selectedStrokeKanji}</span>
            </span>
            <button
              onClick={() => setSelectedStrokeKanji(null)}
              className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-xl p-4 border" style={{ borderColor: "var(--border-strong)" }}>
            {/* SVG KanjiVG hiển thị nét vẽ động/tĩnh cùng số thứ tự nét viết */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://raw.githubusercontent.com/KanjiVG/KanjiVG/master/kanji/0${getKanjiVGCode(selectedStrokeKanji)}.svg`}
              alt={`Nét vẽ chữ ${selectedStrokeKanji}`}
              className="w-36 h-36 filter dark:invert"
            />
            <p className="text-[10px] mt-4 text-center" style={{ color: "var(--text-faint)" }}>
              Thứ tự viết được ghi theo số thứ tự từ 1 trên từng nét vẽ.
            </p>
          </div>
        </div>
      )}

      {/* Thông tin từ vựng */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-jp text-4xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              {word.word}
            </span>
            {word.word !== word.reading && (
              <span className="text-sm font-jp" style={{ color: "var(--text-muted)" }}>
                （{word.reading}）
              </span>
            )}
          </div>
          <div className="text-sm font-medium mt-1" style={{ color: "var(--primary)" }}>
            {word.reading}
          </div>
        </div>
        {word.level && (
          <span className="badge font-bold" style={{ background: lvl.bg, color: lvl.color }}>
            {word.level}
          </span>
        )}
      </div>

      {/* Cụm nút phát âm */}
      <div className="flex gap-2">
        <button
          onClick={() => speakJapanese(word.word, false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <Volume2 className="w-3.5 h-3.5" />
          Phát âm
        </button>
        <button
          onClick={() => speakJapanese(word.word, true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          🐢 Chậm
        </button>
      </div>

      {/* Định nghĩa nghĩa & Ví dụ */}
      <div className="space-y-4 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
        {word.meanings.map((meaning, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded"
                style={{ background: "var(--primary-glow)", color: "var(--primary)" }}>
                {meaning.partOfSpeech || "Từ loại khác"}
              </span>
            </div>
            {meaning.definitions.map((def, j) => (
              <div key={j} className="pl-2 flex flex-col gap-1.5">
                <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                  {meaning.definitions.length > 1 ? `${j + 1}. ` : ""}{def.meaning}
                </div>
                {def.example && (
                  <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                    <div className="text-xs font-jp" style={{ color: "var(--text-muted)" }}>{def.example}</div>
                    {def.exampleMeaning && (
                      <div className="text-[10px] mt-1" style={{ color: "var(--text-faint)" }}>
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

      {/* KHU VỰC PHÂN TÍCH CHỮ HÁN KANJI (MAZII STYLE) */}
      {kanjis.length > 0 && (
        <div className="pt-4 border-t flex flex-col gap-3" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Chữ Hán liên quan ({kanjis.length}) (Bấm vào chữ để xem cách viết)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kanjis.map((k) => (
              <div
                key={k.kanji}
                onClick={() => setSelectedStrokeKanji(k.kanji)}
                className="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer hover:bg-[var(--surface-3)] active:scale-[0.98] transition-all"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-color)" }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-jp text-2xl font-bold"
                  style={{ background: "var(--surface-3)", color: "var(--text)" }}>
                  {k.kanji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate capitalize" style={{ color: "var(--text)" }}>
                    Nghĩa: {k.meanings.slice(0, 3).join(", ")}
                  </div>
                  {k.on_readings.length > 0 && (
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      <span className="font-semibold text-red-400">On:</span> {k.on_readings.join(" · ")}
                    </div>
                  )}
                  {k.kun_readings.length > 0 && (
                    <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                      <span className="font-semibold text-green-400">Kun:</span> {k.kun_readings.join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingKanji && (
        <div className="text-[10px] animate-pulse" style={{ color: "var(--text-faint)" }}>
          Đang phân tích chữ Hán...
        </div>
      )}

      {/* Nút hành động */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saveStatus !== "idle"}
          className="btn w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200"
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
          {saveStatus === "idle" ? (
            <>
              <Bookmark className="w-4 h-4" />
              Lưu vào sổ tay
            </>
          ) : saveStatus === "saving" ? (
            "Đang lưu..."
          ) : saveStatus === "saved" ? (
            <>
              <BookmarkCheck className="w-4 h-4" />
              Đã thêm vào lịch học thành công!
            </>
          ) : (
            <>
              <BookmarkCheck className="w-4 h-4" />
              Đã có trong lịch học
            </>
          )}
        </button>
      </div>

    </div>
  );
}