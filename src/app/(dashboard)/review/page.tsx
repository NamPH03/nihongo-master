"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { promoteWord, demoteWord, markStudiedToday, getDueWordsWithVocab } from "@/lib/progress";
import { useRouter } from "next/navigation";
import SpeakButton from "@/components/ui/SpeakButton";
import { speakJapanese } from "@/lib/speech";
import type { CachedVocabItem } from "@/lib/vocabCache";
import { sfx } from "@/lib/sfx";
import SessionCompletionModal from "@/components/ui/SessionCompletionModal";

// ===== TYPES =====
type Vocabulary = {
  id: string; word: string; reading: string; type: string; meaning: string; level: string;
  example?: string; exampleMeaning?: string;
};
type ReviewWord = CachedVocabItem & { wordId: string; srLevel: number; nextReview: string; };
type ReviewStep = "meaning-to-word" | "word-to-meaning" | "type-reading" | "listening";

const BASE_STEPS: ReviewStep[] = ["meaning-to-word", "word-to-meaning", "listening"];

const stepLabel: Record<ReviewStep, string> = {
  "meaning-to-word": "Nhìn nghĩa → Chọn từ",
  "word-to-meaning": "Nhìn từ → Chọn nghĩa",
  "type-reading": "Gõ cách đọc",
  "listening": "Nghe → Chọn nghĩa",
};

// ===== HELPERS =====
function hasJapanese(str: string): boolean {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}

function getKanjiChars(str: string): string[] {
  return (str || "").split("").filter((c) => /[\u4e00-\u9faf\u3400-\u4dbf]/.test(c));
}

/** Tạo danh sách bước ôn phù hợp cho từng từ */
function getStepsForWord(word: ReviewWord): ReviewStep[] {
  const steps: ReviewStep[] = [...BASE_STEPS];
  // Chỉ thêm type-reading nếu từ THỰC SỰ có chứa Kanji
  const kanjiCount = getKanjiChars(word.word || "").length;
  if (kanjiCount > 0) {
    steps.push("type-reading");
  }
  return steps;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanStr(s: string): string {
  return (s || "").replace(/\s*[\(（].*?[\)）]/g, "").trim();
}

function generateChoices(correct: ReviewWord, allWords: Vocabulary[], type: "word" | "meaning"): string[] {
  const correctValue = type === "word" ? cleanStr(correct.word) : correct.meaning.trim();

  // Pool: lọc bỏ chính từ hiện tại và các giá trị trùng với đáp án đúng
  const pool = allWords
    .filter((w) => {
      const wVal = type === "word" ? cleanStr(w.word) : w.meaning.trim();
      if (wVal === correctValue) return false;
      if (type === "meaning" && hasJapanese(w.meaning)) return false;
      return wVal.length > 0;
    })
    .map((w) => (type === "word" ? cleanStr(w.word) : w.meaning.trim()))
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedup

  // Xào trộn pool và lấy 3 lựa chọn sai
  const shuffledPool = pool.sort(() => Math.random() - 0.5);
  const others = shuffledPool.slice(0, 3);

  // Đảm bảo luôn có đúng 4 đáp án, correctValue luôn nằm trong danh sách
  const allChoices = [correctValue, ...others];

  // Nếu không đủ 4 (pool quá nhỏ), pad bằng các giá trị dummy
  while (allChoices.length < 4) {
    allChoices.push(`― (khác)`);
  }

  // Xào trộn vị trí các đáp án
  return allChoices.sort(() => Math.random() - 0.5);
}

// ===== MAIN COMPONENT =====
export default function ReviewPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ─── State ───
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
  const [showExitModal, setShowExitModal] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  // Track từ đã sai và đã tái chèn vào queue để không tái chèn lần 2
  const [reinsertedWordIds, setReinsertedWordIds] = useState<Set<string>>(new Set());

  const router = useRouter();
  // Track đã gọi markStudiedToday trong phiên này chưa
  const studiedTodayRef = useRef(false);
  // Lock để chống double-click / double-Enter trong khi đang xử lý async
  const isProcessingRef = useRef(false);

  // ─── Auth + Fetch data (gộp 1 useEffect) ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }

      try {
        // getDueWordsWithVocab đọc vocabulary 1 lần (cache) + progress song song
        const { dueWords: dueProgress, allVocab } = await getDueWordsWithVocab(user.uid, 50);

        // Build vocabulary map O(1) lookup
        const vocabMap = new Map(allVocab.map((v) => [v.id, v]));

        // Lấy chi tiết từng từ đến hạn — dùng map thay vì N getDoc calls
        const reviewWords: ReviewWord[] = [];
        for (const progress of dueProgress) {
          const vocab = vocabMap.get(progress.id);
          if (vocab) {
            reviewWords.push({
              ...vocab,
              wordId: progress.id,
              srLevel: progress.srLevel || 1,
              nextReview: progress.nextReview || "",
            });
          }
        }

        setAllWords(allVocab as Vocabulary[]);
        setDueWords(reviewWords);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router]);

  // ─── Init word ───
  const initWord = useCallback((word: ReviewWord, usedSoFar: ReviewStep[]) => {
    const available = getStepsForWord(word).filter((s) => !usedSoFar.includes(s));
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
    else if (picked === "word-to-meaning" || picked === "listening") setChoices(generateChoices(word, allWords, "meaning"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWords]);

  // Chỉ initWord[0] một lần duy nhất khi mới load xong dữ liệu
  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (!isInitializedRef.current && dueWords.length > 0 && allWords.length > 0) {
      isInitializedRef.current = true;
      initWord(dueWords[0], []);
    }
  }, [dueWords, allWords, initWord]);

  const currentWord = dueWords[currentIndex];

  // Tự động phát âm:
  // - Khi bước là "listening" (trước khi check)
  // - Khi vừa check xong (isChecked = true) → phát âm để người học nghe lại từ đúng
  useEffect(() => {
    if (!currentWord) return;
    if (currentStep === "listening" && !isChecked) {
      const t = setTimeout(() => speakJapanese(currentWord.word, false), 300);
      return () => clearTimeout(t);
    }
    if (isChecked) {
      const t = setTimeout(() => speakJapanese(currentWord.word, false), 200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, currentWord?.wordId, isChecked]);



  // ─── Handle result (khi bấm nút "Tiếp tục" ở bottom bar) ───
  const handleResult = async (remembered: boolean) => {
    // Chống double-click/double-Enter trong khi đang xử lý async Firestore
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    const isRecheck = reinsertedWordIds.has(currentWord.wordId);

    if (!remembered) {
      setForgotThisWord(true);
      // Lần đầu sai → finishWord(false) để trừ điểm SRS & chèn vào vị trí ngẫu nhiên phía sau, rồi chuyển sang từ khác ngay
      if (!isRecheck) {
        await finishWord(false);
        return;
      }

      // Nếu gặp lại (recheck) mà vẫn sai → không bị trừ điểm SRS nữa, mà tiếp tục đổi dạng câu hỏi cho từ này ngay tại chỗ đến khi làm đúng mới thôi
      const allPossibleSteps = getStepsForWord(currentWord);
      let available = remainingSteps.length > 0 ? remainingSteps : allPossibleSteps.filter(s => s !== currentStep);
      if (available.length === 0) available = allPossibleSteps;

      const next = pickRandom(available);
      const newRemaining = available.filter((s) => s !== next);

      setCurrentStep(next);
      setRemainingSteps(newRemaining);
      setSelectedChoice(null);
      setSelectedAnswer(null);
      setAnswerStatus("idle");
      setIsChecked(false);
      setTypedAnswer("");

      if (next === "meaning-to-word") setChoices(generateChoices(currentWord, allWords, "word"));
      else if (next === "word-to-meaning" || next === "listening") setChoices(generateChoices(currentWord, allWords, "meaning"));
      isProcessingRef.current = false;
    } else {
      // Khi đã trả lời ĐÚNG → chuyển sang từ tiếp theo
      await finishWord(!forgotThisWord);
      isProcessingRef.current = false;
    }
  };

  const finishWord = async (promote: boolean) => {
    const user = auth.currentUser; if (!user) return;
    const isRecheck = reinsertedWordIds.has(currentWord.wordId);

    // Chỉ áp dụng SRS lần đầu tiên gặp từ (không áp dụng lại khi ôn lại)
    if (!isRecheck) {
      if (promote) await promoteWord(user.uid, currentWord.wordId, currentWord.srLevel || 1);
      else await demoteWord(user.uid, currentWord.wordId, currentWord.srLevel || 1);
    }
    // markStudiedToday chỉ gọi 1 lần/phiên — tránh 20 Firestore reads thừa
    if (!studiedTodayRef.current) {
      await markStudiedToday(user.uid);
      studiedTodayRef.current = true;
    }

    // Nếu sai lần đầu & còn từ phía sau → tái chèn vào vị trí ngẫu nhiên (cách ít nhất 2-3 từ nếu còn đủ)
    if (!promote && !isRecheck) {
      const remaining = dueWords.length - (currentIndex + 1);
      if (remaining > 0) {
        setReinsertedWordIds((prev) => new Set(Array.from(prev).concat(currentWord.wordId)));
        // Ưu tiên chèn cách ít nhất 2 vị trí nếu số từ còn lại >= 3, ngược lại chèn ở cuối
        const minOffset = remaining >= 3 ? 2 : (remaining >= 2 ? 1 : 0);
        const randomOffset = minOffset + Math.floor(Math.random() * (remaining - minOffset));
        const insertAt = currentIndex + 1 + randomOffset;
        const newQueue = [...dueWords];
        newQueue.splice(insertAt, 0, currentWord);
        setDueWords(newQueue);
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        initWord(newQueue[nextIdx], []);
        return;
      }
    }

    setDoneCount((p) => p + 1);
    if (currentIndex + 1 >= dueWords.length) { setFinished(true); }
    else { const nextIdx = currentIndex + 1; setCurrentIndex(nextIdx); initWord(dueWords[nextIdx], []); }
  };

  // ─── Chọn tạm thời (chưa check) ───
  const handleSelectChoice = (choice: string) => {
    if (isChecked) return;
    setSelectedChoice(choice);
  };

  const canAdvanceRef = useRef<number>(0);

  // ─── Kiểm tra đáp án ───
  const handleCheckAnswer = () => {
    if (isChecked) return;
    // Set canAdvanceRef TRƯỚC khi setState để đảm bảo lock kịp thời
    canAdvanceRef.current = Date.now() + 500;
    if (currentStep === "type-reading") {
      const correct = currentWord.reading.trim();
      const isRight = typedAnswer.trim() === correct;
      setAnswerStatus(isRight ? "correct" : "wrong");
      setIsChecked(true);
      if (isRight) sfx.playCorrect();
      else sfx.playWrong();
    } else {
      if (!selectedChoice) return;
      let correct = "";
      if (currentStep === "meaning-to-word") correct = cleanStr(currentWord.word);
      else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning.trim();
      const isRight = selectedChoice === correct;
      setSelectedAnswer(selectedChoice);
      setAnswerStatus(isRight ? "correct" : "wrong");
      setIsChecked(true);
      if (isRight) sfx.playCorrect();
      else sfx.playWrong();
    }
  };

  // ─── Phím tắt (re-register khi state thay đổi để không bị stale closure) ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || finished || dueWords.length === 0) return;

      // Khi type-reading chưa check, để ô input tự bắt Enter qua onKeyDown của nó
      if (e.key === "Enter" && currentStep === "type-reading" && !isChecked) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (!isChecked) {
          if (selectedChoice) handleCheckAnswer();
        } else {
          // Chỉ cho phép chuyển từ nếu đã qua debounce 500ms VÀ không đang xử lý
          if (Date.now() >= canAdvanceRef.current && !isProcessingRef.current) {
            handleResult(answerStatus === "correct");
          }
        }
        return;
      }

      if (currentStep !== "type-reading" && !isChecked && ["1","2","3","4"].includes(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (choices[idx]) handleSelectChoice(choices[idx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, finished, dueWords.length, isChecked, selectedChoice, currentStep, choices, answerStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto focus input ───
  useEffect(() => {
    if (currentStep === "type-reading" && !isChecked && inputRef.current) inputRef.current.focus();
  }, [currentStep, isChecked, currentIndex]);



  // ─── Choice styles ───
  const getChoiceStyle = (choice: string): React.CSSProperties => {
    let correct = "";
    if (currentStep === "meaning-to-word") correct = cleanStr(currentWord.word);
    else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning.trim();
    if (!isChecked) {
      if (choice === selectedChoice) return { borderColor: "var(--primary)", boxShadow: "0 0 0 1px var(--primary)", background: "var(--primary-glow)" };
      return {};
    }
    if (choice === correct) return { background: "rgba(34, 197, 94, 0.15)", color: "var(--text)", borderColor: "var(--primary)" };
    if (choice === selectedAnswer && choice !== correct) return { background: "rgba(239, 68, 68, 0.15)", color: "var(--text)", borderColor: "#ef4444" };
    return { opacity: 0.5 };
  };

  const ChoiceList = () => (
    <div className="flex flex-col gap-3">
      {choices.map((choice, i) => {
        // Tìm thông tin reading của từ tương ứng nếu đây là chọn từ tiếng Nhật
        const matchedWord = currentStep === "meaning-to-word" ? allWords.find((w) => w.word === choice) : null;
        const hasFurigana = matchedWord && matchedWord.reading && matchedWord.word !== matchedWord.reading;

        return (
          <button
            key={i}
            onClick={() => handleSelectChoice(choice)}
            className="w-full py-4 px-5 rounded-2xl text-left flex items-center gap-3 transition-all duration-200"
            style={{ background: "var(--surface-2)", border: "2px solid var(--border-color)", color: "var(--text)", ...getChoiceStyle(choice) }}
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium"
              style={{ background: choice === selectedChoice && !isChecked ? "var(--primary)" : "var(--surface-3)", color: choice === selectedChoice && !isChecked ? "#0d1f14" : "var(--text-muted)" }}>
              {i + 1}
            </span>
            <div className="flex flex-col items-start gap-0.5">
              {hasFurigana && (
                <span className="text-xs font-jp" style={{ color: "var(--primary)" }}>
                  {matchedWord.reading}
                </span>
              )}
              <span className={currentStep === "meaning-to-word" ? "font-jp text-lg font-semibold" : "font-semibold"}>
                {choice}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );

  const progressPct = dueWords.length > 0 ? Math.min(100, Math.round(((currentIndex + 1) / dueWords.length) * 100)) : 0;

  // ===== SCREENS =====
  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải từ cần ôn...</p>
      </div>
    </div>
  );

  if (finished || (!loading && dueWords.length === 0)) return (
    <div className="min-h-[100dvh] bg-page">
      <SessionCompletionModal
        title={dueWords.length === 0 ? "Không có từ cần ôn!" : "Đã hoàn thành buổi ôn tập!"}
        totalWords={doneCount || dueWords.length}
        onRestart={() => window.location.reload()}
      />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-page pb-32">
      {/* ===== HEADER ===== */}
      <div className="max-w-xl mx-auto px-4 pt-6 pb-2 flex items-center gap-4">
        <button
          onClick={() => setShowExitModal(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 transition-all text-white font-bold text-lg active:scale-90 flex-shrink-0 shadow-sm"
          title="Tạm dừng học"
        >⏸</button>
        <div className="flex-1 h-4 rounded-full" style={{ background: "var(--surface-3)" }}>
          <div className="h-4 rounded-full transition-all duration-700 ease-spring"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--primary), #4ade80)" }} />
        </div>
        <span className="text-sm font-bold tabular" style={{ color: "var(--text-muted)" }}>
          {currentIndex + 1}/{dueWords.length}
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-4">
          <p className="text-xs mt-1.5 font-bold uppercase tracking-wider" style={{ color: "var(--primary)" }}>
            {stepLabel[currentStep]}
          </p>
        </div>

        {/* ===== MEANING → WORD ===== */}
        {currentStep === "meaning-to-word" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>Chọn từ tiếng Nhật đúng</p>
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-left" style={{ color: "var(--text-faint)" }}>Chọn nghĩa đúng của từ</p>
                {currentWord.word !== currentWord.reading && (
                  <button
                    type="button"
                    onClick={() => setShowFurigana((prev) => !prev)}
                    className="text-xs font-semibold underline"
                    style={{ color: "var(--primary)" }}
                  >
                    {showFurigana ? "Ẩn furigana" : "Hiện furigana"}
                  </button>
                )}
              </div>
              
              {showFurigana && currentWord.word !== currentWord.reading && (
                <div className="text-sm font-jp font-semibold mb-1 animate-fade-in" style={{ color: "var(--primary)" }}>
                  {currentWord.reading}
                </div>
              )}
              <div className="font-jp text-5xl font-bold" style={{ color: "var(--text)" }}>{currentWord.word}</div>
            </div>
            <ChoiceList />
          </div>
        )}

        {/* ===== LISTENING ===== */}
        {currentStep === "listening" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-faint)" }}>Nghe và chọn nghĩa đúng</p>
              <div className="flex justify-center gap-4 mb-3">
                <SpeakButton text={currentWord.word} size="lg" />
                <SpeakButton text={currentWord.word} slow size="lg" />
              </div>
              {answerStatus !== "idle" ? (
                <div className="animate-fade-in mt-2">
                  <div className="font-jp text-3xl font-bold" style={{ color: "var(--text)" }}>{currentWord.word}</div>
                  {currentWord.word !== currentWord.reading && (
                    <div className="text-base font-jp mt-1" style={{ color: "var(--primary)" }}>{currentWord.reading}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm" style={{ color: "var(--text-faint)" }}>Nghe từ và chọn nghĩa phù hợp</div>
              )}
            </div>
            <ChoiceList />
          </div>
        )}

        {/* ===== TYPE READING (chỉ từ có Kanji) ===== */}
        {currentStep === "type-reading" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>Nhìn nghĩa — gõ cách đọc bằng hiragana</p>
              <div className="font-jp text-4xl font-bold mb-2" style={{ color: "var(--text)" }}>{currentWord.word}</div>
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
              onChange={(e) => { if (!isChecked) { setTypedAnswer(e.target.value); setAnswerStatus("idle"); } }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!isChecked) {
                    if (typedAnswer.trim()) handleCheckAnswer();
                  } else {
                    if (Date.now() >= canAdvanceRef.current) {
                      handleResult(answerStatus === "correct");
                    }
                  }
                }
              }}
              placeholder="Ví dụ: たべる"
              disabled={isChecked}
              className="input text-center text-xl font-jp mb-4"
              style={{
                borderWidth: "2px",
                borderColor: isChecked ? (answerStatus === "correct" ? "var(--primary)" : "#ef4444") : "var(--border-color)",
                background: isChecked ? (answerStatus === "correct" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)") : "var(--surface)",
              }}
            />
          </div>
        )}


      </div>

      {/* ===== BOTTOM BAR ===== */}
      <div
        className="fixed bottom-0 left-0 right-0 py-6 px-4 z-40 transition-all duration-300 border-t"
        style={{
          background: !isChecked ? "var(--surface)" : (answerStatus === "correct" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"),
          borderColor: !isChecked ? "var(--border-color)" : (answerStatus === "correct" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"),
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-md mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Kết quả */}
          <div className="flex-1 flex items-start gap-3">
            {isChecked && (
              <>
                <div className="text-4xl">{answerStatus === "correct" ? "🟢" : "🔴"}</div>
                <div>
                  <h4 className="font-bold text-lg" style={{ color: answerStatus === "correct" ? "var(--primary)" : "#ef4444" }}>
                    {answerStatus === "correct" ? "Chính xác! Cố gắng lắm!" : "Chưa chính xác rồi!"}
                  </h4>
                  {answerStatus === "wrong" && (
                    <p className="text-sm mt-1" style={{ color: "var(--text)" }}>
                      Đáp án đúng:{" "}
                      <span className="font-bold font-jp text-lg" style={{ color: "var(--primary)" }}>
                        {currentStep === "type-reading" ? currentWord.reading
                          : currentStep === "meaning-to-word" ? currentWord.word
                          : currentWord.meaning}
                      </span>
                    </p>
                  )}
                  <div className="text-xs mt-2 space-y-1" style={{ color: "var(--text-muted)" }}>
                    <div className="font-semibold font-jp text-sm" style={{ color: "var(--text)" }}>
                      {currentWord.word} ({currentWord.reading})
                    </div>
                    <div>Ý nghĩa: {currentWord.meaning}</div>
                    {currentWord.example && (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
                        <div className="font-jp text-sm leading-relaxed" style={{ color: "var(--text)" }}>{currentWord.example}</div>
                        {currentWord.exampleMeaning && (
                          <div className="text-xs mt-0.5 italic" style={{ color: "var(--text-muted)" }}>{currentWord.exampleMeaning}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {!isChecked ? (
              <>
                <button
                  onClick={handleCheckAnswer}
                  disabled={currentStep === "type-reading" ? !typedAnswer.trim() : !selectedChoice}
                  className="btn w-full sm:w-auto px-10 py-4 rounded-2xl font-bold transition-all"
                  style={{
                    background: (currentStep === "type-reading" ? typedAnswer.trim() : selectedChoice) ? "var(--primary)" : "var(--surface-3)",
                    color: (currentStep === "type-reading" ? typedAnswer.trim() : selectedChoice) ? "#0d1f14" : "var(--text-faint)",
                    cursor: (currentStep === "type-reading" ? typedAnswer.trim() : selectedChoice) ? "pointer" : "not-allowed",
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
                onClick={() => {
                  if (Date.now() >= canAdvanceRef.current && !isProcessingRef.current) {
                    handleResult(answerStatus === "correct");
                  }
                }}
                disabled={isProcessingRef.current}
                className="btn w-full sm:w-auto px-12 py-4 rounded-2xl font-bold transition-all"
                style={{ background: answerStatus === "correct" ? "var(--primary)" : "#ef4444", color: answerStatus === "correct" ? "#0d1f14" : "#fff" }}
              >
                Tiếp tục
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== EXIT MODAL ===== */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border" style={{ borderColor: "var(--border-color)" }}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🍊</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Tạm dừng học?</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Tiến trình bài ôn này sẽ không được lưu nếu bạn thoát ra lúc này.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => setShowExitModal(false)} className="btn btn-primary w-full py-4 rounded-2xl font-bold text-sm">
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