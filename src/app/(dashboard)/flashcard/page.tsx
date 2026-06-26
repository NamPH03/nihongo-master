"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpeakButton from "@/components/ui/SpeakButton";

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

  // Highlight từ trong câu ví dụ
  const highlightWord = (example: string, word: string) => {
    if (!example.includes(word)) return <span>{example}</span>;
    const parts = example.split(word);
    return (
      <>
        {parts[0]}
        <span className="font-bold underline decoration-2">{word}</span>
        {parts[1]}
      </>
    );
  };

  const currentWord = words[currentIndex];

  return (
    <main className="min-h-screen bg-gray-100">

      {/* Thanh menu */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </Link>
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Về Dashboard
        </Link>
      </nav>

      <div className="max-w-md mx-auto px-4 py-8">

        {/* Chọn cấp độ */}
        <div className="flex justify-center gap-2 mb-6">
          {["N5", "N4", "N3", "N2", "N1"].map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                selectedLevel === level
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-4">⏳</div>
            <p>Đang tải flashcard...</p>
          </div>

        ) : finished ? (
          <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Hoàn thành!</h2>
            <p className="text-gray-500 mb-8">Đã học hết {words.length} từ {selectedLevel}</p>
            <div className="flex justify-center gap-12 mb-8">
              <div>
                <div className="text-4xl font-bold text-green-500">{known}</div>
                <div className="text-gray-400 text-sm mt-1">Đã biết ✅</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-red-400">{unknown}</div>
                <div className="text-gray-400 text-sm mt-1">Chưa biết ❌</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedLevel(selectedLevel)}
              className="px-8 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition"
            >
              🔄 Học lại
            </button>
          </div>

        ) : (
          <>
            {/* Thanh tiến độ */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{currentIndex + 1} / {words.length}</span>
                <span>✅ {known} &nbsp; ❌ {unknown}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(currentIndex / words.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Thẻ Flashcard */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="cursor-pointer select-none"
              style={{ perspective: "1000px" }}
            >
              <div
                style={{
                  transition: "transform 0.5s",
                  transformStyle: "preserve-3d",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  position: "relative",
                  height: "380px",
                }}
              >

                {/* ===== MẶT TRƯỚC — Câu ví dụ ===== */}
                <div
                  className="bg-white rounded-3xl shadow-sm absolute inset-0 flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  {/* Nút âm thanh */}
                  <div className="flex gap-3 p-5">
                    <SpeakButton text={currentWord?.word} size="md" />
                    <SpeakButton text={currentWord?.word} slow size="md" />
                  </div>

                  {/* Câu ví dụ */}
                  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <div className="text-2xl text-gray-800 leading-relaxed mb-3">
                      {highlightWord(currentWord?.example || "", currentWord?.word || "")}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {currentWord?.exampleMeaning}
                    </div>
                  </div>

                  {/* Gợi ý bấm */}
                  <div className="text-center pb-5 text-gray-300 text-xs">
                    Bấm để xem từ
                  </div>
                </div>

                {/* ===== MẶT SAU — Từ + nghĩa ===== */}
                <div
                  className="bg-white rounded-3xl shadow-sm absolute inset-0 flex flex-col"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  {/* Nút âm thanh */}
                  <div className="flex gap-3 p-5">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition text-xl"
                      title="Phát âm bình thường"
                    >
                      🔊
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition text-xl"
                      title="Phát âm chậm"
                    >
                      🐢
                    </button>
                  </div>

                  {/* Nội dung mặt sau */}
                  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">

                    {/* Từ chính */}
                    <div className="text-5xl font-bold text-gray-900">
                      {currentWord?.word}
                    </div>

                    {/* Cách đọc */}
                    <div className="text-xl text-red-400 font-medium">
                      {currentWord?.reading}
                    </div>

                    {/* Nghĩa + từ loại */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-semibold text-gray-800">
                        {currentWord?.meaning}
                      </span>
                      <span className="text-sm text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                        {currentWord?.type}
                      </span>
                    </div>

                  </div>

                  {/* Gợi ý bấm tiếp */}
                  <div className="text-center pb-5 text-gray-300 text-xs">
                    Bấm để quay lại
                  </div>
                </div>

              </div>
            </div>

            {/* Nút Đã biết / Chưa biết */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleUnknown}
                className="flex-1 py-4 bg-white text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition text-lg shadow-sm"
              >
                ❌ Chưa biết
              </button>
              <button
                onClick={handleKnown}
                className="flex-1 py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition text-lg shadow-sm"
              >
                ✅ Đã biết
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}   