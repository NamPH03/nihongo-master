"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { promoteWord, demoteWord, updateProgress, getDueWords } from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpeakButton from "@/components/ui/SpeakButton";
import { speakJapanese } from "@/lib/speech";
import Navbar from "@/components/ui/Navbar";

type Vocabulary = {
  id: string; word: string; reading: string; type: string; meaning: string; level: string;
};
type ReviewWord = Vocabulary & { wordId: string; srLevel: number; nextReview: string; };
type ReviewStep = "meaning-to-word" | "word-to-meaning" | "type-reading" | "listening";

const ALL_STEPS: ReviewStep[] = ["meaning-to-word", "word-to-meaning", "type-reading", "listening"];
const stepLabel: Record<ReviewStep, string> = {
  "meaning-to-word": "Nhìn nghĩa → Chọn từ",
  "word-to-meaning": "Nhìn từ → Chọn nghĩa",
  "type-reading": "Gõ cách đọc",
  "listening": "Nghe → Chọn nghĩa",
};

const srColors: Record<number, { bg: string; text: string }> = {
  1: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  2: { bg: "rgba(249,115,22,0.12)",  text: "#f97316" },
  3: { bg: "rgba(234,179,8,0.12)",   text: "#eab308" },
  4: { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  5: { bg: "rgba(34,197,94,0.12)",   text: "#22c55e" },
};

function generateChoices(correct: ReviewWord, allWords: Vocabulary[], type: "word" | "meaning"): string[] {
  const others = allWords.filter((w) => w.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = type === "word"
    ? [correct.word, ...others.map((w) => w.word)]
    : [correct.meaning, ...others.map((w) => w.meaning)];
  return choices.sort(() => Math.random() - 0.5);
}

function pickRandom(arr: ReviewStep[]): ReviewStep {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ReviewPage() {
  const [dueWords, setDueWords] = useState<ReviewWord[]>([]);
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
        const user = auth.currentUser;
        if (!user) return;
        const dueProgress = await getDueWords(user.uid, 20);
        const reviewWords: ReviewWord[] = [];
        for (const progress of dueProgress) {
          const wordSnap = await getDoc(doc(db, "vocabulary", progress.id));
          if (wordSnap.exists()) {
            const data = wordSnap.data();
            reviewWords.push({
              id: wordSnap.id, wordId: progress.id,
              word: data.word || "", reading: data.reading || "",
              type: data.type || "", meaning: data.meaning || "",
              level: data.level || "N5", srLevel: progress.srLevel || 1,
              nextReview: progress.nextReview || "",
            });
          }
        }
        const allSnap = await getDocs(query(collection(db, "vocabulary")));
        const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vocabulary[];
        setAllWords(all);
        setDueWords(reviewWords);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const initWord = useCallback((word: ReviewWord, usedSoFar: ReviewStep[]) => {
    const available = ALL_STEPS.filter((s) => !usedSoFar.includes(s));
    const picked = pickRandom(available);
    const remaining = available.filter((s) => s !== picked);
    setCurrentStep(picked);
    setRemainingSteps(remaining);
    setSelectedAnswer(null);
    setAnswerStatus("idle");
    setTypedAnswer("");
    setForgotThisWord(false);
    if (picked === "meaning-to-word") setChoices(generateChoices(word, allWords, "word"));
    else if (picked === "word-to-meaning") setChoices(generateChoices(word, allWords, "meaning"));
    else if (picked === "listening") setChoices(generateChoices(word, allWords, "meaning"));
    setTimeout(() => speakJapanese(word.word, false), 300);
  }, [allWords]);

  useEffect(() => {
    if (dueWords.length > 0 && allWords.length > 0) initWord(dueWords[0], []);
  }, [dueWords, allWords, initWord]);

  const currentWord = dueWords[currentIndex];

  const handleResult = async (remembered: boolean) => {
    if (!remembered) {
      setForgotThisWord(true);
      if (remainingSteps.length > 0) {
        const next = pickRandom(remainingSteps);
        const newRemaining = remainingSteps.filter((s) => s !== next);
        setCurrentStep(next);
        setRemainingSteps(newRemaining);
        setSelectedAnswer(null);
        setAnswerStatus("idle");
        setTypedAnswer("");
        if (next === "meaning-to-word") setChoices(generateChoices(currentWord, allWords, "word"));
        else if (next === "word-to-meaning") setChoices(generateChoices(currentWord, allWords, "meaning"));
        else if (next === "listening") setChoices(generateChoices(currentWord, allWords, "meaning"));
        setTimeout(() => speakJapanese(currentWord.word, false), 300);
      } else { await finishWord(false); }
    } else { await finishWord(!forgotThisWord); }
  };

  const finishWord = async (promote: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    if (promote) await promoteWord(user.uid, currentWord.wordId, currentWord.srLevel || 1);
    else await demoteWord(user.uid, currentWord.wordId, currentWord.srLevel || 1);
    await updateProgress(user.uid, 0);
    setDoneCount((p) => p + 1);
    if (currentIndex + 1 >= dueWords.length) { setFinished(true); }
    else { const nextIdx = currentIndex + 1; setCurrentIndex(nextIdx); initWord(dueWords[nextIdx], []); }
  };

  const getChoiceStyle = (choice: string): React.CSSProperties => {
    let correct = "";
    if (currentStep === "meaning-to-word") correct = currentWord.word;
    else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning;
    if (answerStatus === "idle") return {};
    if (choice === correct) return { background: "var(--primary)", color: "#0d1f14", borderColor: "var(--primary)" };
    if (choice === selectedAnswer) return { background: "#ef4444", color: "#fff", borderColor: "#ef4444" };
    return { opacity: 0.35 };
  };

  const handleChoice = (choice: string) => {
    if (answerStatus !== "idle") return;
    setSelectedAnswer(choice);
    let correct = "";
    if (currentStep === "meaning-to-word") correct = currentWord.word;
    else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning;
    setAnswerStatus(choice === correct ? "correct" : "wrong");
  };

  const checkTyped = () => {
    const correct = currentWord.reading.trim();
    setAnswerStatus(typedAnswer.trim() === correct ? "correct" : "wrong");
  };

  const progressPct = dueWords.length > 0 ? (doneCount / dueWords.length) * 100 : 0;
  const srInfo = currentWord ? srColors[currentWord.srLevel || 1] : srColors[1];

  const ContinueButton = () => (
    <button
      onClick={() => handleResult(answerStatus === "correct")}
      className="btn w-full py-4 mt-5 rounded-2xl font-semibold"
      style={answerStatus === "correct"
        ? { background: "var(--primary)", color: "#0d1f14" }
        : { background: "#ef4444", color: "#fff" }
      }
    >
      {answerStatus === "correct" ? "✅ Tiếp tục" : "❌ Tiếp tục"}
    </button>
  );

  const ChoiceList = () => (
    <div className="flex flex-col gap-3">
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => handleChoice(choice)}
          className="w-full py-4 px-5 rounded-2xl text-left flex items-center gap-3 transition-all duration-200"
          style={{
            background: "var(--surface-2)",
            border: "2px solid var(--border-color)",
            color: "var(--text)",
            ...getChoiceStyle(choice),
          }}
        >
          <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium tabular"
            style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
            {i + 1}
          </span>
          <span className={currentStep === "meaning-to-word" ? "font-jp text-lg" : ""}>{choice}</span>
        </button>
      ))}
    </div>
  );

  // ===== LOADING =====
  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải từ cần ôn...</p>
      </div>
    </div>
  );

  // ===== KHÔNG CÓ TỪ =====
  if (!loading && dueWords.length === 0) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4">
      <div className="card p-12 text-center max-w-md animate-scale-in">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Không có gì cần ôn!
        </h2>
        <p className="mb-6" style={{ color: "var(--text-muted)" }}>
          Bạn đã ôn hết rồi — quay lại sau nhé.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/learn" className="btn btn-primary py-3 rounded-xl">🎯 Học từ mới</Link>
          <Link href="/dashboard" className="btn btn-ghost py-3 rounded-xl">Về Dashboard</Link>
        </div>
      </div>
    </div>
  );

  // ===== XONG =====
  if (finished) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4">
      <div className="card p-12 text-center max-w-md animate-scale-in">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Ôn tập xong!</h2>
        <p className="mb-8" style={{ color: "var(--text-muted)" }}>
          Đã ôn{" "}
          <span className="font-bold" style={{ color: "var(--primary)" }}>{doneCount} từ</span>
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/learn" className="btn btn-primary py-3 rounded-xl">🎯 Học từ mới</Link>
          <Link href="/progress" className="btn btn-ghost py-3 rounded-xl">📈 Xem tiến độ</Link>
          <Link href="/dashboard" className="py-3 text-sm text-center"
            style={{ color: "var(--text-muted)" }}>
            Về Dashboard
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail="" />

      <div className="max-w-md mx-auto px-4 py-6">

        {/* Header row */}
        <div className="flex justify-between items-center mb-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Ôn tập
            </span>
            {currentWord && (
              <span className="badge" style={{ background: srInfo.bg, color: srInfo.text }}>
                Mức {currentWord.srLevel || 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {forgotThisWord && (
              <span className="text-xs" style={{ color: "#f97316" }}>
                ⚠️ Ôn thêm {remainingSteps.length} bước
              </span>
            )}
            <span className="text-xs font-medium tabular" style={{ color: "var(--text-muted)" }}>
              {currentIndex + 1} / {dueWords.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
            <div
              className="h-1.5 rounded-full transition-all duration-700 ease-spring"
              style={{ width: `${progressPct}%`, background: "var(--primary)" }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-faint)" }}>
            {stepLabel[currentStep]}
          </p>
        </div>

        {/* ===== MEANING → WORD ===== */}
        {currentStep === "meaning-to-word" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
                Chọn từ tiếng Nhật đúng
              </p>
              <div className="text-3xl font-bold" style={{ color: "var(--text)" }}>{currentWord.meaning}</div>
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>[{currentWord.type}]</div>
            </div>
            <ChoiceList />
            {answerStatus !== "idle" && <ContinueButton />}
          </div>
        )}

        {/* ===== WORD → MEANING ===== */}
        {currentStep === "word-to-meaning" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
                Chọn nghĩa đúng của từ
              </p>
              {currentWord.word !== currentWord.reading && (
                <div className="text-base mb-1 font-jp" style={{ color: "var(--primary)" }}>
                  {currentWord.reading}
                </div>
              )}
              <div className="font-jp text-5xl font-bold" style={{ color: "var(--text)" }}>
                {currentWord.word}
              </div>
            </div>
            <ChoiceList />
            {answerStatus !== "idle" && <ContinueButton />}
          </div>
        )}

        {/* ===== LISTENING ===== */}
        {currentStep === "listening" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-faint)" }}>
                Nghe và chọn nghĩa đúng
              </p>
              <div className="flex justify-center gap-4 mb-3">
                <SpeakButton text={currentWord.word} size="lg" />
                <SpeakButton text={currentWord.word} slow size="lg" />
              </div>
              {answerStatus !== "idle" && (
                <div className="text-sm font-jp animate-fade-in" style={{ color: "var(--text-muted)" }}>
                  {currentWord.word} · {currentWord.reading}
                </div>
              )}
            </div>
            <ChoiceList />
            {answerStatus !== "idle" && <ContinueButton />}
          </div>
        )}

        {/* ===== TYPE READING ===== */}
        {currentStep === "type-reading" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
                Gõ cách đọc bằng hiragana
              </p>
              <div className="text-3xl font-bold" style={{ color: "var(--text)" }}>{currentWord.meaning}</div>
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>[{currentWord.type}]</div>
            </div>

            <input
              type="text"
              value={typedAnswer}
              onChange={(e) => { setTypedAnswer(e.target.value); setAnswerStatus("idle"); }}
              onKeyDown={(e) => { if (e.key === "Enter" && typedAnswer.trim()) checkTyped(); }}
              placeholder="Ví dụ: たべる"
              disabled={answerStatus !== "idle"}
              className="input text-center text-xl font-jp mb-4"
              style={{
                borderWidth: "2px",
                borderColor: answerStatus === "correct"
                  ? "var(--primary)" : answerStatus === "wrong"
                  ? "#ef4444" : "var(--border-color)",
                background: answerStatus === "correct"
                  ? "rgba(34,197,94,0.08)" : answerStatus === "wrong"
                  ? "rgba(239,68,68,0.06)" : "var(--surface)",
              }}
            />

            {answerStatus === "wrong" && (
              <div className="text-center text-sm mb-4" style={{ color: "#ef4444" }}>
                Đáp án đúng:{" "}
                <span className="font-bold text-lg font-jp" style={{ color: "var(--text)" }}>
                  {currentWord.reading}
                </span>
              </div>
            )}
            {answerStatus === "correct" && (
              <div className="text-center text-sm font-semibold mb-4" style={{ color: "var(--primary)" }}>
                ✅ Chính xác!
              </div>
            )}

            {answerStatus === "idle" ? (
              <button
                onClick={checkTyped}
                disabled={!typedAnswer.trim()}
                className="btn btn-primary w-full py-4 rounded-2xl"
              >
                Kiểm tra
              </button>
            ) : <ContinueButton />}
          </div>
        )}

      </div>
    </div>
  );
}