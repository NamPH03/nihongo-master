"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, limit, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Vocabulary = {
  id: string;
  word: string;
  reading: string;
  type: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  level: string;
  status: string;
};

// Bước học
type Step = "flashcard" | "listening" | "kanji" | "result";

export default function LearnPage() {
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>("flashcard");
  const [isFlipped, setIsFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [loading, setLoading] = useState(true);
  const [learnedCount, setLearnedCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  // Lấy 10 từ chưa học
  useEffect(() => {
    const fetchWords = async () => {
      try {
        const q = query(
          collection(db, "vocabulary"),
          where("status", "==", "new"),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Vocabulary[];
        setWords(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, []);

  const currentWord = words[currentIndex];

  // Đánh dấu từ đã học trong Firebase
  const markAsLearned = async (wordId: string) => {
    try {
      await updateDoc(doc(db, "vocabulary", wordId), {
        status: "learned",
      });
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
    }
  };

  // Chuyển sang bước tiếp theo
  const nextStep = async () => {
    if (currentStep === "flashcard") {
      setCurrentStep("listening");
      setTypedAnswer("");
      setAnswerStatus("idle");
    } else if (currentStep === "listening") {
      setCurrentStep("kanji");
    } else if (currentStep === "kanji") {
      // Xong 3 bước → đánh dấu đã học
      await markAsLearned(currentWord.id);
      setLearnedCount((p) => p + 1);

      if (currentIndex + 1 >= words.length) {
        setCurrentStep("result");
      } else {
        setCurrentIndex((p) => p + 1);
        setCurrentStep("flashcard");
        setIsFlipped(false);
        setTypedAnswer("");
        setAnswerStatus("idle");
      }
    }
  };

  // Kiểm tra đáp án phần nghe
  const checkAnswer = () => {
    const correct = currentWord.reading.trim();
    const answer = typedAnswer.trim();
    if (answer === correct) {
      setAnswerStatus("correct");
    } else {
      setAnswerStatus("wrong");
    }
  };

  // Highlight từ trong câu ví dụ
  const highlightWord = (example: string, word: string) => {
    if (!example.includes(word)) return <span>{example}</span>;
    const parts = example.split(word);
    return (
      <>
        {parts[0]}
        <span className="font-bold underline decoration-2 decoration-red-400">{word}</span>
        {parts[1]}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Đang tải bài học...</p>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl p-12 shadow-sm max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tuyệt vời!</h2>
          <p className="text-gray-500 mb-6">Bạn đã học hết tất cả từ vựng mới!</p>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
          >
            Về Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">

      {/* Thanh menu */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </Link>
        <span className="text-gray-400 text-sm">
          {currentIndex + 1} / {words.length} từ
        </span>
      </nav>

      <div className="max-w-md mx-auto px-4 py-8">

        {/* Thanh tiến độ tổng */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Tiến độ buổi học</span>
            <span>{learnedCount}/{words.length} từ</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-red-500 h-2 rounded-full transition-all"
              style={{ width: `${(learnedCount / words.length) * 100}%` }}
            />
          </div>

          {/* 3 bước indicator */}
          <div className="flex justify-center gap-3 mt-4">
            {(["flashcard", "listening", "kanji"] as Step[]).map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  currentStep === step
                    ? "bg-red-600 text-white scale-110"
                    : i < ["flashcard", "listening", "kanji"].indexOf(currentStep)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}>
                  {i < ["flashcard", "listening", "kanji"].indexOf(currentStep) ? "✓" : i + 1}
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-12 mt-1">
            <span className="text-xs text-gray-400">Flashcard</span>
            <span className="text-xs text-gray-400">Nghe</span>
            <span className="text-xs text-gray-400">Kanji</span>
          </div>
        </div>

        {/* ===== BƯỚC 1: FLASHCARD ===== */}
        {currentStep === "flashcard" && (
          <div>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="cursor-pointer select-none"
              style={{ perspective: "1000px" }}
            >
              <div style={{
                transition: "transform 0.5s",
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                position: "relative",
                height: "340px",
              }}>
                {/* Mặt trước */}
                <div className="bg-white rounded-3xl shadow-sm absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
                  style={{ backfaceVisibility: "hidden" }}>
                  <div className="text-xs text-gray-300 mb-6 uppercase tracking-wide">Bấm để xem nghĩa</div>
                  <div className="text-2xl text-gray-700 leading-relaxed mb-2">
                    {highlightWord(currentWord.example, currentWord.word)}
                  </div>
                  <div className="text-gray-400 text-sm">{currentWord.exampleMeaning}</div>
                </div>

                {/* Mặt sau */}
                <div className="bg-white rounded-3xl shadow-sm absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <div className="text-5xl font-bold text-gray-900 mb-3">{currentWord.word}</div>
                  <div className="text-xl text-red-400 mb-2">{currentWord.reading}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl text-gray-700">{currentWord.meaning}</span>
                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-lg">{currentWord.type}</span>
                  </div>
                </div>
              </div>
            </div>

            {isFlipped && (
              <button
                onClick={nextStep}
                className="w-full mt-6 py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition"
              >
                Tiếp tục → Nghe & Gõ lại
              </button>
            )}
            {!isFlipped && (
              <p className="text-center text-gray-400 text-sm mt-4">
                💡 Bấm vào thẻ để xem nghĩa
              </p>
            )}
          </div>
        )}

        {/* ===== BƯỚC 2: NGHE & GÕ LẠI ===== */}
        {currentStep === "listening" && (
          <div className="bg-white rounded-3xl shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-4">
                Bước 2 — Nghe & Gõ lại
              </div>

              {/* Hiển thị nghĩa — người dùng phải gõ cách đọc */}
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {currentWord.meaning}
              </div>
              <div className="text-gray-400 text-sm mb-2">[{currentWord.type}]</div>

              {/* Nút nghe */}
              <div className="flex justify-center gap-4 my-6">
                <button className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl hover:bg-gray-200 transition">
                  🔊
                </button>
                <button className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl hover:bg-gray-200 transition">
                  🐢
                </button>
              </div>
            </div>

            {/* Ô gõ đáp án */}
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block text-center">
                Gõ cách đọc bằng hiragana:
              </label>
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => {
                  setTypedAnswer(e.target.value);
                  setAnswerStatus("idle");
                }}
                placeholder="Ví dụ: たべる"
                className={`w-full px-4 py-3 border-2 rounded-xl text-center text-lg focus:outline-none transition ${
                  answerStatus === "correct"
                    ? "border-green-400 bg-green-50"
                    : answerStatus === "wrong"
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200 focus:border-red-400"
                }`}
              />
            </div>

            {/* Kết quả kiểm tra */}
            {answerStatus === "correct" && (
              <div className="text-center text-green-600 font-semibold mb-4">
                ✅ Chính xác! — {currentWord.word} ({currentWord.reading})
              </div>
            )}
            {answerStatus === "wrong" && (
              <div className="text-center text-red-500 mb-4">
                ❌ Chưa đúng — Đáp án: <span className="font-bold">{currentWord.reading}</span>
              </div>
            )}

            {/* Nút kiểm tra / tiếp tục */}
            {answerStatus === "idle" && (
              <button
                onClick={checkAnswer}
                disabled={!typedAnswer.trim()}
                className="w-full py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition disabled:opacity-40"
              >
                Kiểm tra
              </button>
            )}
            {answerStatus !== "idle" && (
              <button
                onClick={nextStep}
                className="w-full py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition"
              >
                Tiếp tục → Xem Kanji
              </button>
            )}
          </div>
        )}

        {/* ===== BƯỚC 3: XEM NÉT KANJI ===== */}
        {currentStep === "kanji" && (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-6">
              Bước 3 — Ghi nhớ cách viết
            </div>

            {/* Chữ Kanji lớn */}
            <div className="text-9xl font-bold text-gray-900 mb-4 py-8 border-2 border-dashed border-gray-200 rounded-2xl">
              {currentWord.word}
            </div>

            {/* Thông tin từ */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{currentWord.word}</span>
                <span className="text-red-400">{currentWord.reading}</span>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded-lg text-gray-500">{currentWord.type}</span>
              </div>
              <div className="text-gray-700 font-medium">{currentWord.meaning}</div>
              <div className="text-gray-400 text-sm mt-2">{currentWord.example}</div>
              <div className="text-gray-400 text-xs">{currentWord.exampleMeaning}</div>
            </div>

            <button
              onClick={nextStep}
              className="w-full py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition"
            >
              ✅ Đã ghi nhớ — Từ tiếp theo
            </button>
          </div>
        )}

        {/* ===== KẾT QUẢ ===== */}
        {currentStep === "result" && (
          <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Hoàn thành buổi học!</h2>
            <p className="text-gray-500 mb-8">
              Bạn vừa học được <span className="font-bold text-red-600">{learnedCount} từ mới</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/learn"
                onClick={() => window.location.reload()}
                className="py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition"
              >
                🚀 Học tiếp 10 từ nữa
              </Link>
              <Link
                href="/flashcard"
                className="py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                🃏 Ôn tập Flashcard
              </Link>
              <Link
                href="/dashboard"
                className="py-3 text-gray-400 hover:text-gray-600 transition"
              >
                Về Dashboard
              </Link>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}