"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection, getDocs, query, where, limit,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { markNewWordLearned, updateProgress } from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpeakButton from "@/components/ui/SpeakButton";
import { speakJapanese } from "@/lib/speech";

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

type Step = "flashcard" | "meaning-to-word" | "listening" | "kanji" | "result";

// Kiểm tra từ có chứa chữ Kanji không
function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

// Tạo 4 đáp án (1 đúng + 3 sai)
function generateChoices(
  correct: Vocabulary,
  allWords: Vocabulary[],
  type: "word" | "meaning"
): string[] {
  const others = allWords
    .filter((w) => w.id !== correct.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const choices =
    type === "word"
      ? [correct.word, ...others.map((w) => w.word)]
      : [correct.meaning, ...others.map((w) => w.meaning)];

  return choices.sort(() => Math.random() - 0.5);
}

export default function LearnPage() {
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [allWords, setAllWords] = useState<Vocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>("flashcard");
  const [isFlipped, setIsFlipped] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [learnedCount, setLearnedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  // Lấy từ cần học + toàn bộ từ để tạo đáp án sai
  useEffect(() => {
    const fetchWords = async () => {
      try {
        // 10 từ mới để học
        const newQ = query(
          collection(db, "vocabulary"),
          where("status", "==", "new"),
          limit(10)
        );
        const newSnap = await getDocs(newQ);
        const newWords = newSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
        })) as Vocabulary[];

        // Lấy thêm từ để tạo đáp án sai
        const allQ = query(collection(db, "vocabulary"), limit(100));
        const allSnap = await getDocs(allQ);
        const all = allSnap.docs.map((d) => ({
          id: d.id, ...d.data(),
        })) as Vocabulary[];

        setWords(newWords);
        setAllWords(all);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, []);

  const currentWord = words[currentIndex];

  // Tạo choices khi chuyển bước
  const prepareChoices = useCallback((step: Step, word: Vocabulary) => {
    if (step === "meaning-to-word") {
      setChoices(generateChoices(word, allWords, "word"));
    } else if (step === "listening") {
      setChoices(generateChoices(word, allWords, "meaning"));
    }
    setSelectedAnswer(null);
    setAnswerStatus("idle");
  }, [allWords]);

  // Xác định bước tiếp theo
  const getNextStep = (current: Step, word: Vocabulary): Step | "done" => {
    if (current === "flashcard") return "meaning-to-word";
    if (current === "meaning-to-word") return "listening";
    if (current === "listening") {
      return hasKanji(word.word) ? "kanji" : "done";
    }
    if (current === "kanji") return "done";
    return "done";
  };

  // Chuyển sang từ tiếp theo hoặc kết thúc
  const goNextWord = async () => {
    await markNewWordLearned(currentWord.id);
    const user = auth.currentUser;
    if (user) await updateProgress(user.uid, 1);
    setLearnedCount((p) => p + 1);

    if (currentIndex + 1 >= words.length) {
      setCurrentStep("result");
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentStep("flashcard");
      setIsFlipped(false);
      setSelectedAnswer(null);
      setAnswerStatus("idle");

      // Tự phát âm từ mới
      setTimeout(() => speakJapanese(words[nextIdx].word, false), 300);
    }
  };
  // Tự phát âm từ đầu tiên khi load xong
  useEffect(() => {
    if (words.length > 0) {
      setTimeout(() => speakJapanese(words[0].word, false), 500);
    }
  }, [words]);
  // Chuyển bước
  const nextStep = async () => {
    const next = getNextStep(currentStep, currentWord);
    if (next === "done") {
      await goNextWord();
    } else {
      setCurrentStep(next);
      prepareChoices(next, currentWord);
      setIsFlipped(false);
    }
    if (next === "listening") {
      setTimeout(() => speakJapanese(currentWord.word, false), 300);
    }
  };

  // Chọn đáp án trắc nghiệm
  const handleChoice = (choice: string) => {
    if (answerStatus !== "idle") return;
    setSelectedAnswer(choice);
    const correct =
      currentStep === "meaning-to-word"
        ? currentWord.word
        : currentWord.meaning;
    setAnswerStatus(choice === correct ? "correct" : "wrong");
  };

  // Style nút đáp án
  const choiceStyle = (choice: string) => {
    const correct =
      currentStep === "meaning-to-word"
        ? currentWord.word
        : currentWord.meaning;
    if (answerStatus === "idle") {
      return "border-2 border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50";
    }
    if (choice === correct) return "border-2 border-green-400 bg-green-50 text-green-700 font-bold";
    if (choice === selectedAnswer) return "border-2 border-red-400 bg-red-50 text-red-600";
    return "border-2 border-gray-200 bg-white text-gray-400";
  };

  // Các bước hiển thị indicator
  const stepList = (word: Vocabulary): Step[] => {
    const steps: Step[] = ["flashcard", "meaning-to-word", "listening"];
    if (word && hasKanji(word.word)) steps.push("kanji");
    return steps;
  };

  const stepLabel: Record<Step, string> = {
    "flashcard": "Thẻ",
    "meaning-to-word": "Chọn từ",
    "listening": "Nghe",
    "kanji": "Kanji",
    "result": "",
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">⏳</div>
        <p className="text-gray-400">Đang tải bài học...</p>
      </div>
    </div>
  );

  if (words.length === 0) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center bg-white rounded-3xl p-12 shadow-sm max-w-md">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tuyệt vời!</h2>
        <p className="text-gray-500 mb-6">Bạn đã học hết tất cả từ mới!</p>
        <Link href="/dashboard"
          className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition">
          Về Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-100">

      {/* Menu */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </Link>
        <span className="text-gray-400 text-sm">{currentIndex + 1} / {words.length} từ</span>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6">

        {/* Thanh tiến độ */}
        <div className="mb-5">
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(learnedCount / words.length) * 100}%` }}
            />
          </div>

          {/* Step indicators */}
          {currentStep !== "result" && currentWord && (
            <div className="flex justify-center items-center gap-2">
              {stepList(currentWord).map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    currentStep === step
                      ? "bg-red-600 text-white"
                      : stepList(currentWord).indexOf(currentStep) > i
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}>
                    {stepList(currentWord).indexOf(currentStep) > i ? "✓" : i + 1}
                    <span className="ml-1">{stepLabel[step]}</span>
                  </div>
                  {i < stepList(currentWord).length - 1 && (
                    <div className="w-4 h-0.5 bg-gray-300" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== BƯỚC 1: FLASHCARD ===== */}
        {currentStep === "flashcard" && currentWord && (
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
                height: "320px",
              }}>

                {/* ===== MẶT TRƯỚC ===== */}
                <div
                  className="bg-white rounded-3xl shadow-sm absolute inset-0 flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  {/* Nút âm thanh góc trên trái */}
                  <div className="flex gap-2 p-4">
                    <SpeakButton text={currentWord.word} size="sm" />
                    <SpeakButton text={currentWord.word} slow size="sm" />
                  </div>

                  {/* Nội dung giữa */}
                  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <div className="text-xs text-gray-300 mb-4 uppercase tracking-wide">
                      Bấm để xem nghĩa
                    </div>
                    {currentWord.word !== currentWord.reading && (
                      <div className="text-lg text-red-400 mb-2">
                        {currentWord.reading}
                      </div>
                    )}
                    <div className="text-6xl font-bold text-gray-900">
                      {currentWord.word}
                    </div>
                  </div>
                </div>

                {/* ===== MẶT SAU ===== */}
                <div
                  className="bg-white rounded-3xl shadow-sm absolute inset-0 flex flex-col"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  {/* Nút âm thanh góc trên trái */}
                  <div className="flex gap-2 p-4">
                    <SpeakButton text={currentWord.word} size="sm" />
                    <SpeakButton text={currentWord.word} slow size="sm" />
                  </div>

                  {/* Nội dung giữa */}
                  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <div className="text-4xl font-bold text-gray-900 mb-3">
                      {currentWord.meaning}
                    </div>
                    <div className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">
                      {currentWord.type}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {isFlipped ? (
              <button
                onClick={nextStep}
                className="w-full mt-5 py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition"
              >
                Tiếp tục →
              </button>
            ) : (
              <p className="text-center text-gray-400 text-sm mt-4">
                💡 Bấm vào thẻ để xem nghĩa
              </p>
            )}
          </div>
        )}

        {/* ===== BƯỚC 2: NHÌN NGHĨA → CHỌN TỪ ===== */}
        {currentStep === "meaning-to-word" && currentWord && (
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                Chọn từ tiếng Nhật đúng
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {currentWord.meaning}
              </div>
              <div className="text-sm text-gray-400 mt-1">[{currentWord.type}]</div>
            </div>

            <div className="flex flex-col gap-3">
              {choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => handleChoice(choice)}
                  className={`w-full py-4 px-5 rounded-2xl text-left transition flex items-center gap-3 ${choiceStyle(choice)}`}
                >
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-lg">{choice}</span>
                </button>
              ))}
            </div>

            {answerStatus !== "idle" && (
              <button onClick={nextStep}
                className="w-full mt-5 py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition">
                Tiếp tục →
              </button>
            )}
          </div>
        )}

        {/* ===== BƯỚC 3: NGHE → CHỌN NGHĨA ===== */}
        {currentStep === "listening" && currentWord && (
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-4">
                Nghe và chọn nghĩa đúng
              </div>
              <div className="flex justify-center gap-4">
                <SpeakButton text={currentWord?.word} size="lg" />
                <SpeakButton text={currentWord?.word} slow size="lg" />
              </div>
              {/* Hiện từ nhỏ bên dưới nút nghe */}
              <div className="text-gray-400 text-sm mt-3">
                {currentWord.word} · {currentWord.reading}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => handleChoice(choice)}
                  className={`w-full py-4 px-5 rounded-2xl text-left transition flex items-center gap-3 ${choiceStyle(choice)}`}
                >
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{choice}</span>
                </button>
              ))}
            </div>

            {answerStatus !== "idle" && (
              <button onClick={nextStep}
                className="w-full mt-5 py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition">
                Tiếp tục →
              </button>
            )}
          </div>
        )}

        {/* ===== BƯỚC 4: XEM KANJI ===== */}
        {currentStep === "kanji" && currentWord && (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-6">
              Ghi nhớ cách viết Kanji
            </div>

            {/* Mỗi chữ Hán 1 ô vuông */}
            <div className="flex justify-center gap-4 mb-6 flex-wrap">
              {currentWord.word
                .split("")
                .filter((char) => /[\u4e00-\u9faf]/.test(char))
                .map((kanji, i) => (
                  <div
                    key={i}
                    className="w-32 h-32 border-2 border-slate-400 rounded-2xl flex items-center justify-center bg-white shadow-md"
                  >
                    <span className="text-6xl font-black text-slate-950 tracking-wide drop-shadow-sm">
                      {kanji}
                    </span>
                  </div>
                ))}
            </div>

            <div className="bg-white border border-slate-300 rounded-2xl p-4 text-left mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-600 font-semibold">{currentWord.reading}</span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">
                  {currentWord.type}
                </span>
              </div>
              <div className="text-slate-900 font-semibold">{currentWord.meaning}</div>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Hoàn thành buổi học!
            </h2>
            <p className="text-gray-500 mb-8">
              Bạn vừa học được{" "}
              <span className="font-bold text-red-600">{learnedCount} từ mới</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/learn"
                onClick={() => window.location.reload()}
                className="py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition">
                🚀 Học tiếp 10 từ nữa
              </Link>
              <Link href="/progress"
                className="py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition">
                📈 Xem tiến độ
              </Link>
              <Link href="/dashboard"
                className="py-3 text-gray-400 hover:text-gray-600 transition">
                Về Dashboard
              </Link>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}