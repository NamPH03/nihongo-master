"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { collection, getDocs, query, doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { promoteWord, demoteWord, markStudiedToday, getDueWords } from "@/lib/progress";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpeakButton from "@/components/ui/SpeakButton";
import { speakJapanese } from "@/lib/speech";


type Vocabulary = {
  id: string; word: string; reading: string; type: string; meaning: string; level: string;
};
type ReviewWord = Vocabulary & { wordId: string; srLevel: number; nextReview: string; };
type ReviewStep = "meaning-to-word" | "word-to-meaning" | "type-reading" | "listening";

const ALL_STEPS: ReviewStep[] = ["meaning-to-word", "word-to-meaning", "type-reading", "listening"];

const srColors: Record<number, { bg: string; text: string }> = {
  1: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  2: { bg: "rgba(249,115,22,0.12)",  text: "#f97316" },
  3: { bg: "rgba(234,179,8,0.12)",   text: "#eab308" },
  4: { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  5: { bg: "rgba(34,197,94,0.12)",   text: "#22c55e" },
};

// Kiểm tra chuỗi có chứa ký tự Nhật không (hiragana, katakana, kanji)
function hasJapanese(str: string): boolean {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}

function generateChoices(correct: ReviewWord, allWords: Vocabulary[], type: "word" | "meaning"): string[] {
  const correctValue = type === "word" ? correct.word : correct.meaning;

  // Lọc: khác từ đang hỏi, và nếu chọn nghĩa thì nghĩa phải là tiếng Việt (không có ký tự Nhật)
  const pool = allWords.filter((w) => {
    if (w.id === correct.id) return false;
    if (type === "meaning" && hasJapanese(w.meaning)) return false;
    const val = type === "word" ? w.word : w.meaning;
    return val && val !== correctValue; // loại trùng nghĩa
  });

  const others = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const otherValues = others.map((w) => type === "word" ? w.word : w.meaning);

  // Ghép lại và shuffle — luôn đủ 4 nếu pool đủ
  const choices = [correctValue, ...otherValues];
  return choices.sort(() => Math.random() - 0.5);
}

function pickRandom(arr: ReviewStep[]): ReviewStep {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ReviewPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
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
  // ===== STATE =====
  const [showExitModal, setShowExitModal] = useState(false);

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

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);

  const initWord = useCallback((word: ReviewWord, usedSoFar: ReviewStep[]) => {
    const available = ALL_STEPS.filter((s) => !usedSoFar.includes(s));
    const picked = pickRandom(available);
    const remaining = available.filter((s) => s !== picked);
    setCurrentStep(picked);
    setRemainingSteps(remaining);
    setSelectedChoice(null);
    setSelectedAnswer(null);
    setAnswerStatus("idle");
    setIsChecked(false);
    setTypedAnswer("");
    setForgotThisWord(false);
    if (picked === "meaning-to-word") setChoices(generateChoices(word, allWords, "word"));
    else if (picked === "word-to-meaning") setChoices(generateChoices(word, allWords, "meaning"));
    else if (picked === "listening") setChoices(generateChoices(word, allWords, "meaning"));
    if (picked === "listening") setTimeout(() => speakJapanese(word.word, false), 300);
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
        setSelectedChoice(null);
        setSelectedAnswer(null);
        setAnswerStatus("idle");
        setIsChecked(false);
        setTypedAnswer("");
        if (next === "meaning-to-word") setChoices(generateChoices(currentWord, allWords, "word"));
        else if (next === "word-to-meaning") setChoices(generateChoices(currentWord, allWords, "meaning"));
        else if (next === "listening") setChoices(generateChoices(currentWord, allWords, "meaning"));
        if (next === "listening") setTimeout(() => speakJapanese(currentWord.word, false), 300);
      } else { await finishWord(false); }
    } else { await finishWord(!forgotThisWord); }
  };

  const finishWord = async (promote: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    if (promote) await promoteWord(user.uid, currentWord.wordId, currentWord.srLevel || 1);
    else await demoteWord(user.uid, currentWord.wordId, currentWord.srLevel || 1);
    await markStudiedToday(user.uid);
    setDoneCount((p) => p + 1);
    if (currentIndex + 1 >= dueWords.length) { setFinished(true); }
    else { const nextIdx = currentIndex + 1; setCurrentIndex(nextIdx); initWord(dueWords[nextIdx], []); }
  };

  // Chọn tạm thời (chưa check)
  const handleSelectChoice = (choice: string) => {
    if (isChecked) return;
    setSelectedChoice(choice);
  };

  // Nhấn nút Kiểm tra hoặc Enter để check đáp án
  const handleCheckAnswer = () => {
    if (isChecked) return;
    if (currentStep === "type-reading") {
      const correct = currentWord.reading.trim();
      const isCorrect = typedAnswer.trim() === correct;
      setAnswerStatus(isCorrect ? "correct" : "wrong");
      setIsChecked(true);
    } else {
      if (!selectedChoice) return;
      let correct = "";
      if (currentStep === "meaning-to-word") correct = currentWord.word;
      else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning;
      
      setSelectedAnswer(selectedChoice);
      setAnswerStatus(selectedChoice === correct ? "correct" : "wrong");
      setIsChecked(true);
    }
  };

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || finished || dueWords.length === 0) return;

      // Nhấn Enter
      if (e.key === "Enter") {
        if (!isChecked) {
          if (currentStep === "type-reading") {
            if (typedAnswer.trim()) handleCheckAnswer();
          } else {
            if (selectedChoice) handleCheckAnswer();
          }
        } else {
          handleResult(answerStatus === "correct");
        }
        return;
      }

      // Nhấn phím 1, 2, 3, 4
      if (currentStep !== "type-reading" && !isChecked && ["1", "2", "3", "4"].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (choices[idx]) {
          handleSelectChoice(choices[idx]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, finished, dueWords, isChecked, selectedChoice, typedAnswer, currentStep, choices, answerStatus]);

  // Tự động focus vào ô input khi ở màn hình gõ chữ (đặt ở top-level)
  useEffect(() => {
    if (currentStep === "type-reading" && !isChecked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStep, isChecked, currentIndex]);

  const getChoiceStyle = (choice: string): React.CSSProperties => {
    let correct = "";
    if (currentStep === "meaning-to-word") correct = currentWord.word;
    else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning;

    if (!isChecked) {
      // Đang chọn tạm thời
      if (choice === selectedChoice) {
        return {
          borderColor: "var(--primary)",
          boxShadow: "0 0 0 1px var(--primary)",
          background: "var(--primary-glow)",
        };
      }
      return {};
    }

    // Sau khi đã kiểm tra
    if (choice === correct) {
      return { background: "rgba(34, 197, 94, 0.15)", color: "var(--text)", borderColor: "var(--primary)" };
    }
    if (choice === selectedAnswer && choice !== correct) {
      return { background: "rgba(239, 68, 68, 0.15)", color: "var(--text)", borderColor: "#ef4444" };
    }
    return { opacity: 0.5 };
  };

  const ChoiceList = () => (
    <div className="flex flex-col gap-3">
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => handleSelectChoice(choice)}
          className="w-full py-4 px-5 rounded-2xl text-left flex items-center gap-3 transition-all duration-200"
          style={{
            background: "var(--surface-2)",
            border: "2px solid var(--border-color)",
            color: "var(--text)",
            ...getChoiceStyle(choice),
          }}
        >
          <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium tabular"
            style={{ 
              background: choice === selectedChoice && !isChecked ? "var(--primary)" : "var(--surface-3)", 
              color: choice === selectedChoice && !isChecked ? "#0d1f14" : "var(--text-muted)" 
            }}>
            {i + 1}
          </span>
          <span className={currentStep === "meaning-to-word" ? "font-jp text-lg font-semibold" : "font-semibold"}>{choice}</span>
        </button>
      ))}
    </div>
  );

  const progressPct = dueWords.length > 0 ? (doneCount / dueWords.length) * 100 : 0;

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
    <div className="min-h-[100dvh] bg-page pb-32">
      {/* Duolingo style Header: Ẩn Navbar để tập trung */}
      <div className="max-w-xl mx-auto px-4 pt-6 pb-2 flex items-center gap-4">
        {/* Nút pause màu vàng */}
        <button
          onClick={() => setShowExitModal(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 transition-all text-white font-bold text-lg active:scale-90 flex-shrink-0 shadow-sm"
          title="Tạm dừng học"
        >
          ⏸
        </button>

        {/* Thanh tiến độ */}
        <div className="flex-1 h-4 rounded-full" style={{ background: "var(--surface-3)" }}>
          <div
            className="h-4 rounded-full transition-all duration-700 ease-spring"
            style={{ 
              width: `${progressPct}%`, 
              background: "linear-gradient(90deg, var(--primary), #4ade80)" 
            }}
          />
        </div>

        {/* Số đếm câu */}
        <span className="text-sm font-bold tabular" style={{ color: "var(--text-muted)" }}>
          {currentIndex + 1}/{dueWords.length}
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">

        <div className="mb-4">
          <p className="text-xs mt-1.5 font-bold uppercase tracking-wider text-[var(--primary)]" style={{ color: "var(--primary)" }}>
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
          </div>
        )}

        {/* ===== WORD → MEANING ===== */}
        {currentStep === "word-to-meaning" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
                Chọn nghĩa đúng của từ
              </p>
              <div className="font-jp text-5xl font-bold" style={{ color: "var(--text)" }}>
                {currentWord.word}
              </div>
              {/* Chỉ hiện cách đọc SAU KHI đã chọn đáp án */}
              {answerStatus !== "idle" && currentWord.word !== currentWord.reading && (
                <div className="text-base mt-2 font-jp animate-fade-in" style={{ color: "var(--primary)" }}>
                  {currentWord.reading}
                </div>
              )}
            </div>
            <ChoiceList />
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
              {answerStatus !== "idle" ? (
                // Sau khi chọn: hiện từ tiếng Nhật to rõ
                <div className="animate-fade-in mt-2">
                  <div className="font-jp text-3xl font-bold" style={{ color: "var(--text)" }}>
                    {currentWord.word}
                  </div>
                  {currentWord.word !== currentWord.reading && (
                    <div className="text-base font-jp mt-1" style={{ color: "var(--primary)" }}>
                      {currentWord.reading}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm" style={{ color: "var(--text-faint)" }}>
                  Nghe từ và chọn nghĩa phù hợp
                </div>
              )}
            </div>
            <ChoiceList />
          </div>
        )}

        {/* ===== TYPE READING ===== */}
        {currentStep === "type-reading" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
                Nhìn nghĩa — gõ cách đọc bằng hiragana
              </p>
              {/* Hiện từ tiếng Nhật + nút nghe */}
              <div className="font-jp text-4xl font-bold mb-2" style={{ color: "var(--text)" }}>
                {currentWord.word}
              </div>
              <div className="flex justify-center gap-3 mb-3">
                <SpeakButton text={currentWord.word} size="sm" />
                <SpeakButton text={currentWord.word} slow size="sm" />
              </div>
              <div className="text-xl font-semibold" style={{ color: "var(--text-muted)" }}>{currentWord.meaning}</div>
              <div className="text-sm mt-0.5" style={{ color: "var(--text-faint)" }}>[{currentWord.type}]</div>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={typedAnswer}
              onChange={(e) => { 
                if (!isChecked) {
                  setTypedAnswer(e.target.value); 
                  setAnswerStatus("idle"); 
                }
              }}
              placeholder="Ví dụ: たべる"
              disabled={isChecked}
              className="input text-center text-xl font-jp mb-4"
              style={{
                borderWidth: "2px",
                borderColor: isChecked
                  ? (answerStatus === "correct" ? "var(--primary)" : "#ef4444")
                  : "var(--border-color)",
                background: isChecked
                  ? (answerStatus === "correct" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)")
                  : "var(--surface)",
              }}
            />
          </div>
        )}

      </div>

      {/* ===== DUOLINGO BOTTOM BAR ===== */}
      <div 
        className="fixed bottom-0 left-0 right-0 py-6 px-4 z-40 transition-all duration-300 border-t"
        style={{
          background: !isChecked 
            ? "var(--surface)" 
            : (answerStatus === "correct" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"),
          borderColor: !isChecked
            ? "var(--border-color)"
            : (answerStatus === "correct" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"),
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-md mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Trạng thái kết quả */}
          <div className="flex-1 flex items-start gap-3">
            {isChecked && (
              <>
                <div className="text-4xl">
                  {answerStatus === "correct" ? "🟢" : "🔴"}
                </div>
                <div>
                  <h4 
                    className="font-bold text-lg" 
                    style={{ color: answerStatus === "correct" ? "var(--primary)" : "#ef4444" }}
                  >
                    {answerStatus === "correct" ? "Chính xác! Cố gắng lắm!" : "Chưa chính xác rồi!"}
                  </h4>
                  {answerStatus === "wrong" && (
                    <p className="text-sm mt-1" style={{ color: "var(--text)" }}>
                      Đáp án đúng: <span className="font-bold font-jp text-lg" style={{ color: "var(--primary)" }}>{currentStep === "type-reading" ? currentWord.reading : (currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning)}</span>
                    </p>
                  )}
                  {/* Giải nghĩa & Audio (nếu sai hoặc đúng đều có thể xem lại) */}
                  <div className="text-xs mt-2 space-y-1" style={{ color: "var(--text-muted)" }}>
                    <div className="font-semibold font-jp text-sm text-[var(--text)]">
                      {currentWord.word} ({currentWord.reading})
                    </div>
                    <div>Ý nghĩa: {currentWord.meaning}</div>
                  </div>
                </div>
              </>
            )}
            {!isChecked && (
              <p className="text-sm hidden sm:block" style={{ color: "var(--text-muted)" }}>
                {currentStep === "type-reading" 
                  ? "Nhập câu trả lời bằng hiragana rồi nhấn Kiểm tra" 
                  : "Chọn đáp án phù hợp nhất ở phía trên"}
              </p>
            )}
          </div>

          {/* Nút hành động */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            {!isChecked ? (
              <>
                <button
                  onClick={handleCheckAnswer}
                  disabled={currentStep === "type-reading" ? !typedAnswer.trim() : !selectedChoice}
                  className="btn w-full sm:w-auto px-10 py-4 rounded-2xl font-bold transition-all"
                  style={{
                    background: (currentStep === "type-reading" ? typedAnswer.trim() : selectedChoice)
                      ? "var(--primary)"
                      : "var(--surface-3)",
                    color: (currentStep === "type-reading" ? typedAnswer.trim() : selectedChoice)
                      ? "#0d1f14"
                      : "var(--text-faint)",
                    cursor: (currentStep === "type-reading" ? typedAnswer.trim() : selectedChoice)
                      ? "pointer"
                      : "not-allowed",
                  }}
                >
                  Kiểm tra
                </button>
                <button
                  onClick={() => {
                    setSelectedAnswer(selectedChoice || "");
                    setAnswerStatus("wrong");
                    setIsChecked(true);
                  }}
                  className="text-xs font-semibold underline py-1 transition-colors hover:text-red-500"
                  style={{ color: "var(--text-muted)" }}
                >
                  Tôi không nhớ từ này
                </button>
              </>
            ) : (
              <button
                onClick={() => handleResult(answerStatus === "correct")}
                className="btn w-full sm:w-auto px-12 py-4 rounded-2xl font-bold text-white transition-all"
                style={{
                  background: answerStatus === "correct" ? "var(--primary)" : "#ef4444",
                  color: answerStatus === "correct" ? "#0d1f14" : "#fff",
                }}
              >
                Tiếp tục
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ===== EXIT CONFIRM MODAL (DUOLINGO STYLE) ===== */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border" style={{ borderColor: "var(--border-color)" }}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🍊</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Tạm dừng học?</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Tiến trình bài ôn này sẽ không được lưu nếu bạn thoát ra lúc này.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="btn btn-primary w-full py-4 rounded-2xl font-bold text-sm"
              >
                🟢 Ở lại học tiếp
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-4 rounded-2xl font-bold text-sm border text-red-500 hover:bg-red-500/5 transition-colors"
                style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}
              >
                Thoát
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}