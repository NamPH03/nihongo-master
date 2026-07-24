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

// ===== TYPES =====
type Vocabulary = {
  id: string; word: string; reading: string; type: string; meaning: string; level: string;
  example?: string; exampleMeaning?: string;
};
type ReviewWord = Vocabulary & { wordId: string; srLevel: number; nextReview: string; };
type ReviewStep = "meaning-to-word" | "word-to-meaning" | "type-reading" | "listening" | "write-kanji";

const BASE_STEPS: ReviewStep[] = ["meaning-to-word", "word-to-meaning", "listening"];

const stepLabel: Record<ReviewStep, string> = {
  "meaning-to-word": "Nhìn nghĩa → Chọn từ",
  "word-to-meaning": "Nhìn từ → Chọn nghĩa",
  "type-reading": "Gõ cách đọc",
  "listening": "Nghe → Chọn nghĩa",
  "write-kanji": "✍️ Vẽ chữ Hán",
};

// ===== HELPERS =====
function hasJapanese(str: string): boolean {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}

function hasKanji(str: string): boolean {
  return /[\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}

function getKanjiChars(str: string): string[] {
  return str.split("").filter((c) => /[\u4e00-\u9faf\u3400-\u4dbf]/.test(c));
}

/** Tạo danh sách bước ôn phù hợp cho từng từ */
function getStepsForWord(word: ReviewWord): ReviewStep[] {
  const steps: ReviewStep[] = [...BASE_STEPS];
  // Chỉ thêm type-reading nếu từ có chứa Kanji
  if (hasKanji(word.word)) steps.push("type-reading");
  // Chỉ thêm write-kanji nếu từ có Kanji
  if (hasKanji(word.word)) steps.push("write-kanji");
  return steps;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateChoices(correct: ReviewWord, allWords: Vocabulary[], type: "word" | "meaning"): string[] {
  const correctValue = type === "word" ? correct.word : correct.meaning;
  const pool = allWords.filter((w) => {
    if (w.id === correct.id) return false;
    if (type === "meaning" && hasJapanese(w.meaning)) return false;
    const val = type === "word" ? w.word : w.meaning;
    return val && val !== correctValue;
  });
  const others = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const otherValues = others.map((w) => type === "word" ? w.word : w.meaning);
  return [correctValue, ...otherValues].sort(() => Math.random() - 0.5);
}

// ===== MAIN COMPONENT =====
export default function ReviewPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const kanjiCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
  // Track từ đã sai và đã tái chèn vào queue để không tái chèn lần 2
  const [reinsertedWordIds, setReinsertedWordIds] = useState<Set<string>>(new Set());

  // ─── Kanji drawing state ───
  const [drawnChars, setDrawnChars] = useState<string[]>([]); // các ký tự đã vẽ xác nhận
  const [currentKanjiIdx, setCurrentKanjiIdx] = useState(0); // đang vẽ chữ thứ mấy
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const strokesRef = useRef<Array<Array<[number, number, number]>>>([[]]);
  const lastTimeRef = useRef<number>(0);
  const isDrawingRef = useRef(false);

  const router = useRouter();

  // ─── Auth guard ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { if (!user) router.push("/login"); });
    return () => unsub();
  }, [router]);

  // ─── Fetch data ───
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser; if (!user) return;
        const dueProgress = await getDueWords(user.uid, 20);
        const reviewWords: ReviewWord[] = [];
        for (const progress of dueProgress) {
          const snap = await getDoc(doc(db, "vocabulary", progress.id));
          if (snap.exists()) {
            const data = snap.data();
            reviewWords.push({
              id: snap.id, wordId: progress.id,
              word: data.word || "", reading: data.reading || "",
              type: data.type || "", meaning: data.meaning || "",
              level: data.level || "N5", srLevel: progress.srLevel || 1,
              nextReview: progress.nextReview || "",
              example: data.example || "",
              exampleMeaning: data.exampleMeaning || "",
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

  // ─── Handwriting logic ───
  const getCoords = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = kanjiCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { x, y } = getCoords(e.nativeEvent, canvas);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = 5; ctx.strokeStyle = "#1a1a1a";
    isDrawingRef.current = true;
    lastTimeRef.current = Date.now();
    if (strokesRef.current[strokesRef.current.length - 1].length > 0) {
      strokesRef.current.push([]);
    }
    strokesRef.current[strokesRef.current.length - 1].push([x, y, 0]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = kanjiCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { x, y } = getCoords(e.nativeEvent, canvas);
    ctx.lineTo(x, y); ctx.stroke();
    const duration = Date.now() - lastTimeRef.current;
    strokesRef.current[strokesRef.current.length - 1].push([x, y, duration]);
  };

  const stopDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    recognize();
  };

  const recognize = async () => {
    const canvas = kanjiCanvasRef.current; if (!canvas) return;
    const validStrokes = strokesRef.current.filter((s) => s.length > 0);
    if (validStrokes.length === 0) return;
    setIsRecognizing(true);
    const ink = validStrokes.map((stroke) => [
      stroke.map((pt) => Math.round(pt[0])),
      stroke.map((pt) => Math.round(pt[1])),
      stroke.map((pt) => pt[2]),
    ]);
    try {
      const res = await fetch("https://www.google.com.tw/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=utf-8", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_version: 0.4, api_level: "533.0", device: "", input_type: 0, options: "enable_pre_space",
          requests: [{ writing_area_width: canvas.width, writing_area_height: canvas.height, ink, language: "ja" }],
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data && data[0] === "SUCCESS") setCandidates((data[1][0][1] || []).slice(0, 8));
    } catch { /* silent */ }
    finally { setIsRecognizing(false); }
  };

  const clearCanvas = () => {
    const canvas = kanjiCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [[]];
    setCandidates([]);
  };

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
    setDrawnChars([]);
    setCurrentKanjiIdx(0);
    clearCanvas();
    if (picked === "meaning-to-word") setChoices(generateChoices(word, allWords, "word"));
    else if (picked === "word-to-meaning") setChoices(generateChoices(word, allWords, "meaning"));
    else if (picked === "listening") { setChoices(generateChoices(word, allWords, "meaning")); setTimeout(() => speakJapanese(word.word, false), 300); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWords]);

  useEffect(() => {
    if (dueWords.length > 0 && allWords.length > 0) initWord(dueWords[0], []);
  }, [dueWords, allWords, initWord]);

  const currentWord = dueWords[currentIndex];

  // Phát âm thanh khi vừa kiểm tra xong đáp án
  useEffect(() => {
    if (isChecked && currentWord) {
      speakJapanese(currentWord.word, false);
    }
  }, [isChecked, currentWord]);

  const kanjiChars = currentWord ? getKanjiChars(currentWord.word) : [];

  // ─── Confirm một ký tự kanji đã vẽ ───
  const confirmKanjiChar = (char: string) => {
    const newDrawn = [...drawnChars, char];
    setDrawnChars(newDrawn);
    clearCanvas();
    const nextIdx = currentKanjiIdx + 1;
    if (nextIdx >= kanjiChars.length) {
      // Đã vẽ đủ tất cả ký tự → kiểm tra
      const drawn = newDrawn.join("");
      const correct = kanjiChars.join("");
      setAnswerStatus(drawn === correct ? "correct" : "wrong");
      setIsChecked(true);
    } else {
      setCurrentKanjiIdx(nextIdx);
    }
  };

  // ─── Handle result (tiếp tục / sai) ───
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
        setDrawnChars([]);
        setCurrentKanjiIdx(0);
        clearCanvas();
        if (next === "meaning-to-word") setChoices(generateChoices(currentWord, allWords, "word"));
        else if (next === "word-to-meaning") setChoices(generateChoices(currentWord, allWords, "meaning"));
        else if (next === "listening") { setChoices(generateChoices(currentWord, allWords, "meaning")); setTimeout(() => speakJapanese(currentWord.word, false), 400); }
      } else {
        await finishWord(false);
      }
    } else {
      await finishWord(!forgotThisWord);
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
    await markStudiedToday(user.uid);

    // Nếu sai lần đầu & còn từ phía sau → tái chèn vào vị trí ngẫu nhiên
    if (!promote && !isRecheck) {
      const remaining = dueWords.length - (currentIndex + 1);
      if (remaining > 0) {
        setReinsertedWordIds((prev) => new Set(Array.from(prev).concat(currentWord.wordId)));
        const insertAt = currentIndex + 1 + Math.floor(Math.random() * remaining);
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

  // ─── Kiểm tra đáp án ───
  const handleCheckAnswer = () => {
    if (isChecked) return;
    if (currentStep === "type-reading") {
      const correct = currentWord.reading.trim();
      setAnswerStatus(typedAnswer.trim() === correct ? "correct" : "wrong");
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

  // ─── Phím tắt ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || finished || dueWords.length === 0) return;
      if (e.key === "Enter") {
        if (!isChecked) {
          if (currentStep === "type-reading") { if (typedAnswer.trim()) handleCheckAnswer(); }
          else if (currentStep !== "write-kanji") { if (selectedChoice) handleCheckAnswer(); }
        } else {
          handleResult(answerStatus === "correct");
        }
        return;
      }
      if (currentStep !== "type-reading" && currentStep !== "write-kanji" && !isChecked && ["1","2","3","4"].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (choices[idx]) handleSelectChoice(choices[idx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, finished, dueWords, isChecked, selectedChoice, typedAnswer, currentStep, choices, answerStatus]);

  // ─── Auto focus input ───
  useEffect(() => {
    if (currentStep === "type-reading" && !isChecked && inputRef.current) inputRef.current.focus();
  }, [currentStep, isChecked, currentIndex]);

  // ─── Canvas resize ───
  useEffect(() => {
    const canvas = kanjiCanvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [currentStep, currentKanjiIdx]);

  // ─── Choice styles ───
  const getChoiceStyle = (choice: string): React.CSSProperties => {
    let correct = "";
    if (currentStep === "meaning-to-word") correct = currentWord.word;
    else if (currentStep === "word-to-meaning" || currentStep === "listening") correct = currentWord.meaning;
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
      {choices.map((choice, i) => (
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
          <span className={currentStep === "meaning-to-word" ? "font-jp text-lg font-semibold" : "font-semibold"}>{choice}</span>
        </button>
      ))}
    </div>
  );

  const progressPct = dueWords.length > 0 ? (doneCount / dueWords.length) * 100 : 0;

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

  if (!loading && dueWords.length === 0) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4">
      <div className="card p-12 text-center max-w-md animate-scale-in">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Không có gì cần ôn!</h2>
        <p className="mb-6" style={{ color: "var(--text-muted)" }}>Bạn đã ôn hết rồi — quay lại sau nhé.</p>
        <div className="flex flex-col gap-3">
          <Link href="/learn" className="btn btn-primary py-3 rounded-xl">🎯 Học từ mới</Link>
          <Link href="/dashboard" className="btn btn-ghost py-3 rounded-xl">Về Dashboard</Link>
        </div>
      </div>
    </div>
  );

  if (finished) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4">
      <div className="card p-12 text-center max-w-md animate-scale-in">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Ôn tập xong!</h2>
        <p className="mb-8" style={{ color: "var(--text-muted)" }}>
          Đã ôn <span className="font-bold" style={{ color: "var(--primary)" }}>{doneCount} từ</span>
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/learn" className="btn btn-primary py-3 rounded-xl">🎯 Học từ mới</Link>
          <Link href="/progress" className="btn btn-ghost py-3 rounded-xl">📈 Xem tiến độ</Link>
          <Link href="/dashboard" className="py-3 text-sm text-center" style={{ color: "var(--text-muted)" }}>Về Dashboard</Link>
        </div>
      </div>
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
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>Chọn nghĩa đúng của từ</p>
              <div className="font-jp text-5xl font-bold" style={{ color: "var(--text)" }}>{currentWord.word}</div>
              {answerStatus !== "idle" && currentWord.word !== currentWord.reading && (
                <div className="text-base mt-2 font-jp animate-fade-in" style={{ color: "var(--primary)" }}>{currentWord.reading}</div>
              )}
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

        {/* ===== WRITE KANJI ===== */}
        {currentStep === "write-kanji" && currentWord && (
          <div className="card p-6 animate-scale-in rounded-3xl">
            {/* Header: nghĩa + cách đọc làm hint */}
            <div className="text-center mb-5">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--text-faint)" }}>
                Vẽ chữ Hán
              </p>
              <div className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>{currentWord.meaning}</div>
              <div className="font-jp text-lg" style={{ color: "var(--primary)" }}>{currentWord.reading}</div>
            </div>

            {/* Tiến độ vẽ từng ký tự */}
            {!isChecked && (
              <div className="flex items-center justify-center gap-2 mb-4">
                {kanjiChars.map((char, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-jp text-xl font-bold border-2 transition-all"
                      style={{
                        borderColor: idx < drawnChars.length ? "var(--primary)" : idx === currentKanjiIdx ? "var(--primary)" : "var(--border-color)",
                        background: idx < drawnChars.length ? "rgba(34,197,94,0.12)" : idx === currentKanjiIdx ? "var(--primary-glow)" : "var(--surface-2)",
                        color: idx < drawnChars.length ? "var(--primary)" : "var(--text-muted)",
                      }}
                    >
                      {idx < drawnChars.length ? drawnChars[idx] : (idx === currentKanjiIdx ? "?" : "·")}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>{idx + 1}/{kanjiChars.length}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Kết quả sau khi vẽ xong */}
            {isChecked && (
              <div className="flex items-center justify-center gap-3 mb-4 animate-fade-in">
                <div className="font-jp text-4xl font-bold" style={{ color: "var(--text)" }}>
                  {kanjiChars.join("")}
                </div>
                <div className="font-jp text-4xl font-bold" style={{ color: answerStatus === "correct" ? "var(--primary)" : "#ef4444" }}>
                  {drawnChars.join("")}
                </div>
              </div>
            )}

            {/* Canvas vẽ */}
            {!isChecked && (
              <>
                <div className="text-center text-xs mb-2 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Vẽ chữ thứ {currentKanjiIdx + 1}/{kanjiChars.length}
                </div>
                <div className="relative rounded-2xl overflow-hidden mx-auto shadow-inner mb-4 animate-scale-in"
                  style={{ background: "#ffffff", border: "2px solid var(--border-color)", width: "100%", maxWidth: 280, aspectRatio: "1/1" }}>
                  {/* Ảnh hướng dẫn nét vẽ mờ — chỉ hiện khi srLevel <= 4 */}
                  {currentWord.srLevel <= 4 && kanjiChars[currentKanjiIdx] && (() => {
                    const hex = kanjiChars[currentKanjiIdx].codePointAt(0)?.toString(16).padStart(5, "0");
                    if (!hex) return null;
                    const strokeSrc = `/kanji/${hex}.svg`;
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={strokeSrc} alt="" aria-hidden className="absolute inset-0 w-full h-full select-none" style={{ opacity: 0.18, objectFit: "contain", pointerEvents: "none" }} />;
                  })()}
                  <canvas
                    ref={kanjiCanvasRef}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  />
                  {isRecognizing && (
                    <div className="absolute top-2 right-2 text-[10px] font-semibold animate-pulse" style={{ color: "var(--primary)" }}>
                      Đang nhận dạng...
                    </div>
                  )}
                </div>

                {/* Nút xóa */}
                <div className="flex justify-center mb-4">
                  <button onClick={clearCanvas} className="btn btn-ghost py-1.5 px-4 text-xs rounded-xl flex items-center gap-1.5">
                    🗑 Xóa bảng
                  </button>
                </div>

                {/* Ký tự gợi ý */}
                {candidates.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
                      Chọn chữ bạn vừa vẽ:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {candidates.map((char) => (
                        <button
                          key={char}
                          onClick={() => confirmKanjiChar(char)}
                          className="font-jp text-xl font-bold w-10 h-10 rounded-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border"
                          style={{
                            background: char === kanjiChars[currentKanjiIdx] ? "rgba(34,197,94,0.1)" : "var(--surface-3)",
                            color: "var(--text)",
                            borderColor: char === kanjiChars[currentKanjiIdx] ? "var(--primary)" : "transparent",
                          }}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {candidates.length === 0 && !isRecognizing && (
                  <p className="text-xs text-center italic" style={{ color: "var(--text-faint)" }}>Hãy vẽ chữ Hán lên bảng...</p>
                )}
              </>
            )}
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
                          : currentStep === "write-kanji" ? kanjiChars.join("")
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
            {!isChecked && currentStep !== "write-kanji" && (
              <p className="text-sm hidden sm:block" style={{ color: "var(--text-muted)" }}>
                {currentStep === "type-reading" ? "Nhập câu trả lời bằng hiragana rồi nhấn Kiểm tra" : "Chọn đáp án phù hợp nhất ở phía trên"}
              </p>
            )}
            {!isChecked && currentStep === "write-kanji" && (
              <p className="text-sm hidden sm:block" style={{ color: "var(--text-muted)" }}>
                Vẽ từng chữ Hán và chọn ký tự nhận dạng được
              </p>
            )}
          </div>

          {/* Nút hành động */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            {!isChecked ? (
              <>
                {currentStep !== "write-kanji" && (
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
                )}
                <button
                  onClick={() => {
                    if (currentStep === "write-kanji") {
                      setDrawnChars([]);
                      setAnswerStatus("wrong");
                      setIsChecked(true);
                    } else {
                      setSelectedAnswer(selectedChoice || "");
                      setAnswerStatus("wrong");
                      setIsChecked(true);
                    }
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