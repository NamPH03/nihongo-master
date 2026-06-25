"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { promoteWord, demoteWord, updateProgress } from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Vocabulary = {
  id: string;
  word: string;
  reading: string;
  type: string;
  meaning: string;
  level: string;
  status: string;
  srLevel: number;
  nextReview: string;
};

type ReviewStep = "meaning-to-word" | "word-to-meaning" | "type-reading";

const ALL_STEPS: ReviewStep[] = ["meaning-to-word", "word-to-meaning", "type-reading"];

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

function pickRandom(arr: ReviewStep[]): ReviewStep {
  return arr[Math.floor(Math.random() * arr.length)];
}

const srLevelColor: Record<number, string> = {
  1: "bg-red-100 text-red-600",
  2: "bg-orange-100 text-orange-600",
  3: "bg-yellow-100 text-yellow-600",
  4: "bg-blue-100 text-blue-600",
  5: "bg-green-100 text-green-600",
};

const stepLabel: Record<ReviewStep, string> = {
  "meaning-to-word": "Nhìn nghĩa → Chọn từ",
  "word-to-meaning": "Nhìn từ → Chọn nghĩa",
  "type-reading": "Gõ cách đọc",
};

export default function ReviewPage() {
  const [dueWords, setDueWords] = useState<Vocabulary[]>([]);
  const [allWords, setAllWords] = useState<Vocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<ReviewStep>("meaning-to-word");
  const [remainingSteps, setRemainingSteps] = useState<ReviewStep[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [forgotThisWord, setForgotThisWord] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
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
    const fetchData = async () => {
      try {
        const now = new Date().toISOString();
        const snap = await getDocs(
          query(collection(db, "vocabulary"), where("status", "==", "learned"))
        );
        const due = snap.docs
          .filter((d) => { const nr = d.data().nextReview; return !nr || nr <= now; })
          .map((d) => ({ id: d.id, ...d.data() })) as Vocabulary[];

        const allSnap = await getDocs(query(collection(db, "vocabulary")));
        const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vocabulary[];

        setAllWords(all);
        setDueWords(due.slice(0, 20));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Khởi tạo bước đầu cho từ
  const initWord = useCallback((word: Vocabulary, usedSoFar: ReviewStep[]) => {
    const available = ALL_STEPS.filter((s) => !usedSoFar.includes(s));
    const picked = pickRandom(available);
    const remaining = available.filter((s) => s !== picked);

    setCurrentStep(picked);
    setRemainingSteps(remaining);
    setSelectedAnswer(null);
    setAnswerStatus("idle");
    setTypedAnswer("");
    setForgotThisWord(false);

    if (picked === "meaning-to-word") {
      setChoices(generateChoices(word, allWords, "word"));
    } else if (picked === "word-to-meaning") {
      setChoices(generateChoices(word, allWords, "meaning"));
    }
  }, [allWords]);

  // Khởi tạo từ đầu tiên khi có data
  useEffect(() => {
    if (dueWords.length > 0 && allWords.length > 0) {
      initWord(dueWords[0], []);
    }
  }, [dueWords, allWords, initWord]);

  const currentWord = dueWords[currentIndex];

  // Xử lý kết quả đúng/sai
  const handleResult = async (remembered: boolean) => {
    if (!remembered) {
      setForgotThisWord(true);
      if (remainingSteps.length > 0) {
        // Còn bước → ôn thêm
        const next = pickRandom(remainingSteps);
        const newRemaining = remainingSteps.filter((s) => s !== next);
        setCurrentStep(next);
        setRemainingSteps(newRemaining);
        setSelectedAnswer(null);
        setAnswerStatus("idle");
        setTypedAnswer("");
        if (next === "meaning-to-word") {
          setChoices(generateChoices(currentWord, allWords, "word"));
        } else if (next === "word-to-meaning") {
          setChoices(generateChoices(currentWord, allWords, "meaning"));
        }
      } else {
        // Hết bước → kết thúc, giảm mức
        await finishWord(false);
      }
    } else {
      // Nhớ → kết thúc
      // Nếu đã quên lần nào → không tăng mức
      await finishWord(!forgotThisWord);
    }
  };

  const finishWord = async (promote: boolean) => {
    if (promote) {
      await promoteWord(currentWord.id, currentWord.srLevel || 1);
    } else {
      await demoteWord(currentWord.id, currentWord.srLevel || 1);
    }
    const user = auth.currentUser;
    if (user) await updateProgress(user.uid, 0);
    setDoneCount((p) => p + 1);

    if (currentIndex + 1 >= dueWords.length) {
      setFinished(true);
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      initWord(dueWords[nextIdx], []);
    }
  };

  // Style nút trắc nghiệm
  const choiceStyle = (choice: string) => {
    const correct = currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning;
    if (answerStatus === "idle") {
      return "border-2 border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50";
    }
    if (choice === correct) return "border-2 border-green-400 bg-green-50 text-green-700 font-bold";
    if (choice === selectedAnswer) return "border-2 border-red-400 bg-red-50 text-red-600";
    return "border-2 border-gray-100 bg-white text-gray-300";
  };

  const handleChoice = (choice: string) => {
    if (answerStatus !== "idle") return;
    setSelectedAnswer(choice);
    const correct = currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning;
    const isCorrect = choice === correct;
    setAnswerStatus(isCorrect ? "correct" : "wrong");
    if (!isCorrect) handleResult(false);
  };

  const checkTyped = () => {
    const correct = currentWord.reading.trim();
    const answer = typedAnswer.trim();
    const isCorrect = answer === correct;
    setAnswerStatus(isCorrect ? "correct" : "wrong");
    if (!isCorrect) handleResult(false);
  };

  // ===== LOADING =====
  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-4xl">⏳</div>
    </div>
  );

  // ===== KHÔNG CÓ TỪ CẦN ÔN =====
  if (!loading && dueWords.length === 0) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center bg-white rounded-3xl p-12 shadow-sm max-w-md">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Không có gì cần ôn!</h2>
        <p className="text-gray-500 mb-6">Bạn đã ôn hết rồi — quay lại sau nhé!</p>
        <Link href="/dashboard"
          className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition">
          Về Dashboard
        </Link>
      </div>
    </div>
  );

  // ===== XONG =====
  if (finished) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center bg-white rounded-3xl p-12 shadow-sm max-w-md">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ôn tập xong!</h2>
        <p className="text-gray-500 mb-8">
          Đã ôn <span className="font-bold text-red-600">{doneCount} từ</span>
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/learn"
            className="py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition">
            🎯 Học từ mới
          </Link>
          <Link href="/dashboard"
            className="py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition">
            Về Dashboard
          </Link>
        </div>
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
        <div className="flex items-center gap-3">
          {currentWord && (
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${srLevelColor[currentWord.srLevel || 1]}`}>
              Mức {currentWord.srLevel || 1}
            </span>
          )}
          <span className="text-gray-400 text-sm">{currentIndex + 1} / {dueWords.length}</span>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6">

        {/* Tiến độ + tên bước */}
        <div className="mb-5">
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(doneCount / dueWords.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{stepLabel[currentStep]}</span>
            {forgotThisWord && (
              <span className="text-xs text-orange-500">
                ⚠️ Ôn thêm {remainingSteps.length} bước
              </span>
            )}
          </div>
        </div>

        {/* ===== NHÌN NGHĨA → CHỌN TỪ ===== */}
        {currentStep === "meaning-to-word" && currentWord && (
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                Chọn từ tiếng Nhật đúng
              </div>
              <div className="text-3xl font-bold text-gray-900">{currentWord.meaning}</div>
              <div className="text-sm text-gray-400 mt-1">[{currentWord.type}]</div>
            </div>
            <div className="flex flex-col gap-3">
              {choices.map((choice, i) => (
                <button key={i} onClick={() => handleChoice(choice)}
                  className={`w-full py-4 px-5 rounded-2xl text-left transition flex items-center gap-3 ${choiceStyle(choice)}`}>
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-lg">{choice}</span>
                </button>
              ))}
            </div>
            {answerStatus === "correct" && (
              <button onClick={() => handleResult(true)}
                className="w-full mt-5 py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition">
                ✅ Tiếp tục
              </button>
            )}
          </div>
        )}

        {/* ===== NHÌN TỪ → CHỌN NGHĨA ===== */}
        {currentStep === "word-to-meaning" && currentWord && (
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                Chọn nghĩa đúng của từ
              </div>
              {currentWord.word !== currentWord.reading && (
                <div className="text-base text-red-400 mb-1">{currentWord.reading}</div>
              )}
              <div className="text-5xl font-bold text-gray-900">{currentWord.word}</div>
            </div>
            <div className="flex flex-col gap-3">
              {choices.map((choice, i) => (
                <button key={i} onClick={() => handleChoice(choice)}
                  className={`w-full py-4 px-5 rounded-2xl text-left transition flex items-center gap-3 ${choiceStyle(choice)}`}>
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{choice}</span>
                </button>
              ))}
            </div>
            {answerStatus === "correct" && (
              <button onClick={() => handleResult(true)}
                className="w-full mt-5 py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition">
                ✅ Tiếp tục
              </button>
            )}
          </div>
        )}

        {/* ===== GÕ CÁCH ĐỌC ===== */}
        {currentStep === "type-reading" && currentWord && (
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                Gõ cách đọc bằng hiragana
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{currentWord.meaning}</div>
              <div className="text-sm text-gray-400">[{currentWord.type}]</div>
            </div>

            <input
              type="text"
              value={typedAnswer}
              onChange={(e) => { setTypedAnswer(e.target.value); setAnswerStatus("idle"); }}
              onKeyDown={(e) => { if (e.key === "Enter" && typedAnswer.trim()) checkTyped(); }}
              placeholder="Ví dụ: たべる"
              disabled={answerStatus !== "idle"}
              className={`w-full px-4 py-4 border-2 rounded-2xl text-center text-xl focus:outline-none transition mb-4 ${
                answerStatus === "correct"
                  ? "border-green-400 bg-green-50 text-green-700"
                  : answerStatus === "wrong"
                  ? "border-red-400 bg-red-50 text-red-600"
                  : "border-gray-200 focus:border-red-400"
              }`}
            />

            {/* Kết quả */}
            {answerStatus === "wrong" && (
              <div className="text-center text-red-500 mb-4 text-sm">
                ❌ Chưa đúng — Đáp án: <span className="font-bold text-lg">{currentWord.reading}</span>
              </div>
            )}
            {answerStatus === "correct" && (
              <div className="text-center text-green-600 mb-4 text-sm font-semibold">
                ✅ Chính xác!
              </div>
            )}

            {answerStatus === "idle" && (
              <button
                onClick={checkTyped}
                disabled={!typedAnswer.trim()}
                className="w-full py-4 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 transition disabled:opacity-40"
              >
                Kiểm tra
              </button>
            )}
            {answerStatus !== "idle" && (
              <button
                onClick={() => handleResult(answerStatus === "correct")}
                className="w-full py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition"
              >
                Tiếp tục →
              </button>
            )}
          </div>
        )}

      </div>
    </main>
  );
}