"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import SpeakButton from "@/components/ui/SpeakButton";
import Navbar from "@/components/ui/Navbar";

type Vocabulary = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  level: string;
  type: string;
  example: string;
  exampleMeaning: string;
};

export default function FlashcardPage() {
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("N5");
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchWords = async () => {
      setLoading(true);
      setCurrentIndex(0);
      setIsFlipped(false);
      setKnown(0);
      setUnknown(0);
      setFinished(false);
      try {
        const q = query(collection(db, "vocabulary"), where("level", "==", selectedLevel));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Vocabulary[];
        setWords(data.sort(() => Math.random() - 0.5));
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, [selectedLevel]);

  const handleKnown = () => { setKnown((p) => p + 1); nextCard(); };
  const handleUnknown = () => { setUnknown((p) => p + 1); nextCard(); };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex + 1 >= words.length) setFinished(true);
      else setCurrentIndex((p) => p + 1);
    }, 300);
  };

  const highlightWord = (example: string, word: string) => {
    if (!example.includes(word)) return <span>{example}</span>;
    const parts = example.split(word);
    return (
      <>
        {parts[0]}
        <span className="font-bold underline decoration-2" style={{ color: "var(--primary)" }}>{word}</span>
        {parts[1]}
      </>
    );
  };

  const currentWord = words[currentIndex];
  const progressPct = words.length > 0 ? (currentIndex / words.length) * 100 : 0;

  return (
    <main className="min-h-[100dvh] bg-page">
      <Navbar userEmail="" />

      <div className="max-w-md mx-auto px-4 py-8">
        {/* Chọn cấp độ */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {["N5", "N4", "N3", "N2", "N1"].map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
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

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          </div>
        ) : finished ? (
          <div className="card p-12 text-center animate-scale-in rounded-3xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Hoàn thành!</h2>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>Đã học hết {words.length} từ {selectedLevel}</p>
            <div className="flex justify-center gap-12 mb-8">
              <div>
                <div className="text-4xl font-bold text-green-500">{known}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Đã biết ✅</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-red-400">{unknown}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Chưa biết ❌</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedLevel(selectedLevel)}
              className="btn btn-primary px-8 py-3 rounded-xl"
            >
              🔄 Học lại
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Thanh tiến độ */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                <span>{currentIndex + 1} / {words.length}</span>
                <span>✅ {known} &nbsp; ❌ {unknown}</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, background: "var(--primary)" }}
                />
              </div>
            </div>

            {/* Thẻ Flashcard */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="flip-card cursor-pointer select-none mx-auto"
              style={{ width: "100%", maxWidth: "380px", aspectRatio: "1 / 1" }}
            >
              <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
                {/* MẶT TRƯỚC — Câu ví dụ */}
                <div className="flip-card-front card flex flex-col rounded-3xl">
                  <div className="flex gap-2 p-4">
                    <SpeakButton text={currentWord?.word} size="sm" />
                    <SpeakButton text={currentWord?.word} slow size="sm" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="text-xl text-tx leading-relaxed mb-3 font-jp">
                      {highlightWord(currentWord?.example || "", currentWord?.word || "")}
                    </div>
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {currentWord?.exampleMeaning}
                    </div>
                  </div>
                  <div className="text-center pb-5 text-xs" style={{ color: "var(--text-faint)" }}>
                    Bấm để xem từ
                  </div>
                </div>

                {/* MẶT SAU — Từ + nghĩa */}
                <div className="flip-card-back card flex flex-col rounded-3xl">
                  <div className="flex gap-2 p-4">
                    <SpeakButton text={currentWord?.word} size="sm" />
                    <SpeakButton text={currentWord?.word} slow size="sm" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
                    <div className="text-5xl font-bold font-jp" style={{ color: "var(--text)" }}>
                      {currentWord?.word}
                    </div>
                    <div className="text-xl font-medium font-jp" style={{ color: "var(--primary)" }}>
                      {currentWord?.reading}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
                        {currentWord?.meaning}
                      </span>
                      <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                        {currentWord?.type}
                      </span>
                    </div>
                  </div>
                  <div className="text-center pb-5 text-xs" style={{ color: "var(--text-faint)" }}>
                    Bấm để quay lại
                  </div>
                </div>
              </div>
            </div>

            {/* Nút Đã biết / Chưa biết */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleUnknown}
                className="btn btn-ghost flex-1 py-4 rounded-2xl text-lg shadow-sm"
              >
                ❌ Chưa biết
              </button>
              <button
                onClick={handleKnown}
                className="btn btn-primary flex-1 py-4 rounded-2xl text-lg shadow-sm"
              >
                ✅ Đã biết
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}