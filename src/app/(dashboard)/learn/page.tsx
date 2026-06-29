"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  getLearnedWordIds,
  getNewSavedWordIds,
  markNewWordLearned,
  updateProgress,
} from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpeakButton from "@/components/ui/SpeakButton";
import { speakJapanese } from "@/lib/speech";
import Navbar from "@/components/ui/Navbar";

type Vocabulary = {
  id: string; word: string; reading: string; type: string;
  meaning: string; example: string; exampleMeaning: string;
  level: string; status: string;
};

type Step = "flashcard" | "meaning-to-word" | "listening" | "kanji" | "result";

function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

function generateChoices(correct: Vocabulary, allWords: Vocabulary[], type: "word" | "meaning"): string[] {
  const others = allWords.filter((w) => w.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = type === "word"
    ? [correct.word, ...others.map((w) => w.word)]
    : [correct.meaning, ...others.map((w) => w.meaning)];
  return choices.sort(() => Math.random() - 0.5);
}

const stepLabel: Record<Step, string> = {
  flashcard: "Thẻ", "meaning-to-word": "Chọn từ", listening: "Nghe", kanji: "Kanji", result: "",
};

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

  useEffect(() => {
    const fetchWords = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const allVocabSnap = await getDocs(query(collection(db, "vocabulary"), limit(300)));
        const allVocab = allVocabSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Vocabulary[];
        const learnedIds = await getLearnedWordIds(user.uid);
        const savedNewIds = await getNewSavedWordIds(user.uid);
        const savedWords = allVocab.filter((w) => savedNewIds.has(w.id)).slice(0, 10);
        const brandNewWords = allVocab
          .filter((w) => !learnedIds.has(w.id) && !savedNewIds.has(w.id))
          .slice(0, Math.max(0, 10 - savedWords.length));
        const wordsToLearn = [...savedWords, ...brandNewWords].slice(0, 10);
        setWords(wordsToLearn);
        setAllWords(allVocab);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchWords();
  }, []);

  useEffect(() => {
    if (words.length > 0) setTimeout(() => speakJapanese(words[0].word, false), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  const currentWord = words[currentIndex];

  const prepareChoices = useCallback((step: Step, word: Vocabulary) => {
    if (step === "meaning-to-word") setChoices(generateChoices(word, allWords, "word"));
    else if (step === "listening") setChoices(generateChoices(word, allWords, "meaning"));
    setSelectedAnswer(null);
    setAnswerStatus("idle");
  }, [allWords]);

  const getNextStep = (current: Step, word: Vocabulary): Step | "done" => {
    if (current === "flashcard") return "meaning-to-word";
    if (current === "meaning-to-word") return "listening";
    if (current === "listening") return hasKanji(word.word) ? "kanji" : "done";
    if (current === "kanji") return "done";
    return "done";
  };

  const goNextWord = async () => {
    const user = auth.currentUser;
    if (user && currentWord) {
      await markNewWordLearned(user.uid, currentWord.id);
      await updateProgress(user.uid, 1);
    }
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
      setTimeout(() => speakJapanese(words[nextIdx].word, false), 300);
    }
  };

  const nextStep = async () => {
    const next = getNextStep(currentStep, currentWord);
    if (next === "done") { await goNextWord(); }
    else {
      setCurrentStep(next);
      prepareChoices(next, currentWord);
      setIsFlipped(false);
      if (next === "listening") setTimeout(() => speakJapanese(currentWord.word, false), 300);
    }
  };

  const handleChoice = (choice: string) => {
    if (answerStatus !== "idle") return;
    setSelectedAnswer(choice);
    const correct = currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning;
    setAnswerStatus(choice === correct ? "correct" : "wrong");
  };

  // Choice button style using CSS vars
  const getChoiceStyle = (choice: string): React.CSSProperties => {
    const correct = currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning;
    if (answerStatus === "idle") return {};
    if (choice === correct) return { background: "var(--primary)", color: "#0d1f14", borderColor: "var(--primary)" };
    if (choice === selectedAnswer) return { background: "#ef4444", color: "#fff", borderColor: "#ef4444" };
    return { opacity: 0.35 };
  };

  const stepList = (word: Vocabulary): Step[] => {
    const steps: Step[] = ["flashcard", "meaning-to-word", "listening"];
    if (word && hasKanji(word.word)) steps.push("kanji");
    return steps;
  };

  const progress = words.length > 0 ? (learnedCount / words.length) * 100 : 0;

  // ===== LOADING =====
  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải bài học...</p>
      </div>
    </div>
  );

  // ===== HẾT TỪ =====
  if (words.length === 0) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4">
      <div className="card p-12 text-center max-w-md animate-scale-in">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Tuyệt vời!</h2>
        <p className="mb-6" style={{ color: "var(--text-muted)" }}>
          Bạn đã học hết tất cả từ mới rồi. Hãy quay lại ôn tập!
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/review" className="btn btn-primary py-3 rounded-xl">🔁 Ôn tập ngay</Link>
          <Link href="/dashboard" className="btn btn-ghost py-3 rounded-xl">Về Dashboard</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail="" showBackToDashboard />

      <div className="max-w-md mx-auto px-4 py-6">

        {/* Progress bar */}
        <div className="mb-5 animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {currentIndex + 1} / {words.length} từ
            </span>
            <span className="text-xs font-medium tabular" style={{ color: "var(--primary)" }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
            <div
              className="h-1.5 rounded-full transition-all duration-700 ease-spring"
              style={{ width: `${progress}%`, background: "var(--primary)" }}
            />
          </div>

          {/* Step indicators */}
          {currentStep !== "result" && currentWord && (
            <div className="flex justify-center items-center gap-2 mt-3">
              {stepList(currentWord).map((step, i) => {
                const stepIdx = stepList(currentWord).indexOf(currentStep);
                const isPast = stepIdx > i;
                const isCurrent = currentStep === step;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300"
                      style={
                        isCurrent
                          ? { background: "var(--primary)", color: "#0d1f14" }
                          : isPast
                          ? { background: "rgba(34,197,94,0.15)", color: "var(--primary)" }
                          : { background: "var(--surface-2)", color: "var(--text-faint)" }
                      }
                    >
                      {isPast ? "✓" : i + 1}
                      <span className="ml-0.5">{stepLabel[step]}</span>
                    </div>
                    {i < stepList(currentWord).length - 1 && (
                      <div className="w-4 h-px" style={{ background: "var(--border-color)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== FLASHCARD ===== */}
        {currentStep === "flashcard" && currentWord && (
          <div className="animate-scale-in">
            <div
              className="flip-card cursor-pointer select-none"
              style={{ height: "320px" }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>

                {/* Front */}
                <div className="flip-card-front card flex flex-col rounded-3xl">
                  <div className="flex gap-2 p-4">
                    <SpeakButton text={currentWord.word} size="sm" />
                    <SpeakButton text={currentWord.word} slow size="sm" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-faint)" }}>
                      Bấm để xem nghĩa
                    </p>
                    {currentWord.word !== currentWord.reading && (
                      <div className="text-lg mb-2" style={{ color: "var(--primary)" }}>
                        {currentWord.reading}
                      </div>
                    )}
                    <div className="font-jp text-6xl font-bold" style={{ color: "var(--text)" }}>
                      {currentWord.word}
                    </div>
                  </div>
                </div>

                {/* Back */}
                <div className="flip-card-back card flex flex-col rounded-3xl">
                  <div className="flex gap-2 p-4">
                    <SpeakButton text={currentWord.word} size="sm" />
                    <SpeakButton text={currentWord.word} slow size="sm" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <div className="text-4xl font-bold mb-3" style={{ color: "var(--text)" }}>
                      {currentWord.meaning}
                    </div>
                    <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                      {currentWord.type}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {isFlipped ? (
              <button
                onClick={nextStep}
                className="btn btn-primary w-full py-4 mt-5 rounded-2xl text-base"
              >
                Tiếp tục →
              </button>
            ) : (
              <p className="text-center text-sm mt-4" style={{ color: "var(--text-faint)" }}>
                💡 Bấm vào thẻ để xem nghĩa
              </p>
            )}
          </div>
        )}

        {/* ===== MEANING TO WORD ===== */}
        {currentStep === "meaning-to-word" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
                Chọn từ tiếng Nhật đúng
              </p>
              <div className="text-3xl font-bold" style={{ color: "var(--text)" }}>{currentWord.meaning}</div>
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>[{currentWord.type}]</div>
            </div>
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
                  <span className="font-jp text-lg">{choice}</span>
                </button>
              ))}
            </div>
            {answerStatus !== "idle" && (
              <button
                onClick={nextStep}
                className="btn w-full py-4 mt-5 rounded-2xl font-semibold"
                style={answerStatus === "correct"
                  ? { background: "var(--primary)", color: "#0d1f14" }
                  : { background: "#ef4444", color: "#fff" }
                }
              >
                {answerStatus === "correct" ? "✅ Tiếp tục" : "❌ Tiếp tục"}
              </button>
            )}
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
              <div className="text-sm font-jp" style={{ color: "var(--text-muted)" }}>
                {currentWord.word} · {currentWord.reading}
              </div>
            </div>
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
                  <span>{choice}</span>
                </button>
              ))}
            </div>
            {answerStatus !== "idle" && (
              <button
                onClick={nextStep}
                className="btn w-full py-4 mt-5 rounded-2xl font-semibold"
                style={answerStatus === "correct"
                  ? { background: "var(--primary)", color: "#0d1f14" }
                  : { background: "#ef4444", color: "#fff" }
                }
              >
                {answerStatus === "correct" ? "✅ Tiếp tục" : "❌ Tiếp tục"}
              </button>
            )}
          </div>
        )}

        {/* ===== KANJI ===== */}
        {currentStep === "kanji" && currentWord && (
          <div className="card p-8 text-center animate-scale-in rounded-3xl">
            <p className="text-xs uppercase tracking-widest mb-6" style={{ color: "var(--text-faint)" }}>
              Ghi nhớ cách viết Kanji
            </p>
            <div className="flex justify-center gap-4 mb-6 flex-wrap">
              {currentWord.word
                .split("")
                .filter((char) => /[\u4e00-\u9faf]/.test(char))
                .map((kanji, i) => (
                  <div
                    key={i}
                    className="w-32 h-32 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "var(--surface-2)",
                      border: "2px solid var(--border-strong)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    <span className="font-jp text-6xl font-black" style={{ color: "var(--text)" }}>
                      {kanji}
                    </span>
                  </div>
                ))}
            </div>
            <div className="rounded-2xl p-4 text-left mb-6" style={{ background: "var(--surface-2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-jp font-medium" style={{ color: "var(--primary)" }}>
                  {currentWord.reading}
                </span>
                <span className="badge" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {currentWord.type}
                </span>
              </div>
              <div className="font-semibold" style={{ color: "var(--text)" }}>{currentWord.meaning}</div>
            </div>
            <button
              onClick={nextStep}
              className="btn btn-primary w-full py-4 rounded-2xl text-base"
            >
              ✅ Đã ghi nhớ — Từ tiếp theo
            </button>
          </div>
        )}

        {/* ===== RESULT ===== */}
        {currentStep === "result" && (
          <div className="card p-12 text-center animate-scale-in rounded-3xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              Hoàn thành buổi học!
            </h2>
            <p className="mb-8" style={{ color: "var(--text-muted)" }}>
              Bạn vừa học được{" "}
              <span className="font-bold" style={{ color: "var(--primary)" }}>{learnedCount} từ mới</span>
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/learn"
                onClick={() => window.location.reload()}
                className="btn btn-primary py-3 rounded-xl"
              >
                🚀 Học tiếp 10 từ nữa
              </Link>
              <Link href="/review" className="btn btn-ghost py-3 rounded-xl">
                🔁 Ôn tập ngay
              </Link>
              <Link href="/dashboard" className="py-3 text-sm text-center transition-colors"
                style={{ color: "var(--text-muted)" }}>
                Về Dashboard
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}