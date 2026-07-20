"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { markNewWordLearned, updateProgress } from "@/lib/progress";
import { speakJapanese } from "@/lib/speech";
import SpeakButton from "@/components/ui/SpeakButton";
import HandwritingCanvas from "@/components/dictionary/HandwritingCanvas";
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
  status?: string;
  courseId?: string;
  courseName?: string;
  lessonId?: string;
  lessonTitle?: string;
};

type Step =
  | "flashcard"
  | "meaning-to-word"
  | "listening"
  | "kanji"
  | "write-kanji"
  | "result";

function KanjiStrokeImage({ char, className, width, height }: { char: string; className?: string; width: number; height: number }) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!char) return;
    setLoading(true);
    fetch(`/api/kanji/${encodeURIComponent(char)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.text();
      })
      .then((text) => {
        // Loại bỏ thẻ <?xml ...> để tránh warning React
        const cleanSvg = text.replace(/<\?xml.*?\?>/i, "").trim();
        setSvgContent(cleanSvg);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [char]);

  if (loading) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <div className="w-4 h-4 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "var(--primary)" }} />
      </div>
    );
  }

  if (!svgContent) return null;

  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ width, height, color: "var(--text)" }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

function getKanjiChars(text: string): string[] {
  const kanjiRegex = /[\u4e00-\u9faf]/g;
  const found = text.match(kanjiRegex);
  return found ? Array.from(new Set(found)) : [];
}



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


interface StudySessionProps {
  words: Vocabulary[];
  courseId: string;
  learnedWordIds?: Set<string>;
  isRandomOrder?: boolean;
  totalWordsInLesson?: number;
}

export default function StudySession({
  words,
  courseId,
  learnedWordIds = new Set(),
  isRandomOrder = false,
  totalWordsInLesson,
}: StudySessionProps) {
  const [sessionWords, setSessionWords] = useState<Vocabulary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<Step>("flashcard");
  const [isFlipped, setIsFlipped] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [learnedCount, setLearnedCount] = useState(0);
  const [recognizedCandidates, setRecognizedCandidates] = useState<string[]>([]);
  const [showKanjiHint, setShowKanjiHint] = useState<string | null>(null);
  const [showFurigana, setShowFurigana] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (words.length === 0) return;
    // Lọc bỏ từ đã học
    const newWords = words.filter((w) => !learnedWordIds.has(w.id));
    // Chỉ random nếu là khoá học N5, N4 giữ thứ tự
    const ordered = isRandomOrder
      ? [...newWords].sort(() => Math.random() - 0.5)
      : newWords;
    setSessionWords(ordered);
    setLoading(false);
    setCurrentIndex(0);
    setCurrentStep("flashcard");
    setIsFlipped(false);
    setSelectedAnswer(null);
    setAnswerStatus("idle");
    setRecognizedCandidates([]);
    setShowKanjiHint(null);
    setLearnedCount(0);
  }, [words, learnedWordIds, isRandomOrder]);

  useEffect(() => {
    if (sessionWords.length === 0) return;
    const current = sessionWords[0];
    const timer = window.setTimeout(() => speakJapanese(current.word, false), 500);
    return () => window.clearTimeout(timer);
  }, [sessionWords]);

  const currentWord = sessionWords[currentIndex];

  const prepareChoices = useCallback(
    (step: Step, word: Vocabulary) => {
      if (step === "meaning-to-word") {
        setChoices(generateChoices(word, sessionWords, "word"));
        setShowFurigana(true);
      } else if (step === "listening") {
        setChoices(generateChoices(word, sessionWords, "meaning"));
      }
      setSelectedAnswer(null);
      setAnswerStatus("idle");
      setRecognizedCandidates([]);
      setShowKanjiHint(null);
    },
    [sessionWords]
  );

  const getNextStep = (current: Step, word: Vocabulary): Step | "done" => {
    if (current === "flashcard") return "meaning-to-word";
    if (current === "meaning-to-word") return "listening";
    if (current === "listening") return hasKanji(word.word) ? "kanji" : "done";
    if (current === "kanji") return hasKanji(word.word) ? "write-kanji" : "done";
    if (current === "write-kanji") return "done";
    return "done";
  };

  const goNextWord = async () => {
    const user = auth.currentUser;
    if (user && currentWord) {
      await markNewWordLearned(user.uid, currentWord.id);
      await updateProgress(user.uid, 1);
    }
    setLearnedCount((prev) => prev + 1);
    if (currentIndex + 1 >= sessionWords.length) {
      setCurrentStep("result");
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setCurrentStep("flashcard");
    setIsFlipped(false);
    setSelectedAnswer(null);
    setAnswerStatus("idle");
    setRecognizedCandidates([]);
    setShowKanjiHint(null);
    const nextWord = sessionWords[nextIndex];
    setTimeout(() => speakJapanese(nextWord.word, false), 300);
  };

  const nextStep = async () => {
    if (!currentWord) return;
    const next = getNextStep(currentStep, currentWord);
    if (next === "done") {
      await goNextWord();
    } else {
      setCurrentStep(next);
      prepareChoices(next, currentWord);
      setIsFlipped(false);
      if (next === "listening") setTimeout(() => speakJapanese(currentWord.word, false), 300);
    }
  };

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || currentIndex >= sessionWords.length) return;

      // Nhấn Enter
      if (e.key === "Enter") {
        if (currentStep === "flashcard") {
          // Bấm Enter ở flashcard thì lật thẻ, hoặc bấm nút Tiếp tục dưới
          if (!isFlipped) setIsFlipped(true);
          else nextStep();
        } else if (currentStep === "meaning-to-word" || currentStep === "listening") {
          if (answerStatus !== "idle") {
            nextStep();
          }
        } else if (currentStep === "kanji") {
          nextStep();
        } else if (currentStep === "write-kanji") {
          if (answerStatus !== "idle") {
            nextStep();
          } else {
            if (recognizedCandidates.length > 0) checkDrawingKanji();
          }
        }
        return;
      }

      // Nhấn phím 1, 2, 3, 4 ở các step trắc nghiệm
      if (
        !loading &&
        answerStatus === "idle" &&
        ["1", "2", "3", "4"].includes(e.key) &&
        (currentStep === "meaning-to-word" || currentStep === "listening")
      ) {
        const idx = parseInt(e.key) - 1;
        if (choices[idx]) {
          handleChoice(choices[idx]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentIndex, sessionWords, currentStep, isFlipped, answerStatus, choices, recognizedCandidates]);

  const handleSkipWord = async () => {
    await goNextWord();
  };

  const handleChoice = (choice: string) => {
    if (answerStatus !== "idle") return;
    setSelectedAnswer(choice);
    const correct =
      currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning;
    setAnswerStatus(choice === correct ? "correct" : "wrong");
  };

  const checkDrawingKanji = () => {
    if (!currentWord) return;
    const kanjiChars = getKanjiChars(currentWord.word);
    
    // Yêu cầu: Số lượng ký tự người dùng vẽ phải bằng số lượng Kanji trong từ,
    // và từng vị trí trong mảng recognizedCandidates phải khớp hoàn toàn với kanjiChars theo đúng thứ tự.
    const isCorrect = kanjiChars.length === recognizedCandidates.length && 
      kanjiChars.every((char, index) => recognizedCandidates[index] === char);

    setAnswerStatus(isCorrect ? "correct" : "wrong");
  };

  const getChoiceStyle = (choice: string): React.CSSProperties => {
    if (!currentWord) return {};
    const correct =
      currentStep === "meaning-to-word" ? currentWord.word : currentWord.meaning;
    if (answerStatus === "idle") return {};
    if (choice === correct) return { background: "var(--primary)", color: "#0d1f14", borderColor: "var(--primary)" };
    if (choice === selectedAnswer) return { background: "#ef4444", color: "#fff", borderColor: "#ef4444" };
    return { opacity: 0.35 };
  };

  const kanjisInWord = currentWord ? getKanjiChars(currentWord.word) : [];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang chuẩn bị bài học...</p>
        </div>
      </div>
    );
  }

  const alreadyLearnedCount = learnedWordIds.size;
  const total = totalWordsInLesson ?? words.length;

  // Tất cả từ trong bài đã học hết
  if (!loading && sessionWords.length === 0 && words.length > 0) {
    return (
      <div className="card p-12 text-center animate-scale-in rounded-3xl">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
          Bài học đã hoàn thành!
        </h2>
        <p className="mb-2" style={{ color: "var(--text-muted)" }}>
          Bạn đã học hết{" "}
          <span className="font-bold" style={{ color: "var(--primary)" }}>
            {alreadyLearnedCount} / {total} từ
          </span>
          {" "}trong bài này.
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          Các từ đã học sẽ xuất hiện trong phần ôn tập SRS.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/review" className="btn btn-primary py-3 rounded-2xl">📖 Ôn tập ngay</Link>
          <Link href={`/learn/${encodeURIComponent(courseId)}`} className="btn btn-ghost py-3 rounded-2xl">← Quay về bài học</Link>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="card p-10 text-center rounded-3xl">
        <div className="text-3xl font-bold mb-3">Không tìm thấy bài học</div>
        <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
          Bài học này chưa có từ vựng. Hãy kiểm tra lại dữ liệu hoặc chọn bài khác.
        </p>
        <div className="flex flex-col gap-3">
          <Link href={`/learn/${encodeURIComponent(courseId)}`} className="btn btn-primary py-3 rounded-2xl">← Bài học</Link>
        </div>
      </div>
    );
  }

  // Tính phần trăm tiến độ tổng quan buổi học
  const overallProgressPct = sessionWords.length > 0 
    ? Math.round((currentIndex / sessionWords.length) * 100) 
    : 0;

  return (
    <div className="pb-24">
      {/* Duolingo Header: Nút pause màu vàng + Thanh tiến độ */}
      <div className="flex items-center gap-4 mb-8">
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
              width: `${overallProgressPct || 5}%`, 
              background: "linear-gradient(90deg, var(--primary), #4ade80)" 
            }}
          />
        </div>

        {/* Số câu */}
        <span className="text-sm font-bold tabular" style={{ color: "var(--text-muted)" }}>
          {currentIndex + 1}/{sessionWords.length}
        </span>
      </div>

      {/* Ẩn tiến trình bước nhỏ phức tạp để giao diện tập trung và tối giản */}

      {currentStep === "flashcard" && (
        <div className="animate-scale-in">
          <div
            className="flip-card cursor-pointer select-none mx-auto"
            style={{ width: "100%", maxWidth: "360px", aspectRatio: "1 / 1", minHeight: "360px" }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>
              <div className="flip-card-front card flex flex-col rounded-3xl h-full overflow-hidden">
                <div className="flex gap-2 p-3 justify-center">
                  <SpeakButton text={currentWord.word} size="sm" />
                  <SpeakButton text={currentWord.word} slow size="sm" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-5 text-center min-h-0">
                  <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
                    Bấm để xem nghĩa
                  </p>
                  {currentWord.word !== currentWord.reading && (
                    <div
                      className="text-sm mb-2 font-jp font-semibold max-w-full break-words"
                      style={{
                        color: "var(--primary)",
                        fontSize: "clamp(0.85rem, 2.5vw, 1.2rem)",
                        lineHeight: 1.1,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {currentWord.reading}
                    </div>
                  )}
                  <div
                    className="font-jp font-bold leading-tight max-w-full break-words"
                    style={{
                      color: "var(--text)",
                      fontSize: "clamp(1.8rem, 6vw, 3.8rem)",
                      lineHeight: 1.05,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {currentWord.word}
                  </div>
                </div>
              </div>
              <div className="flip-card-back card flex flex-col rounded-3xl h-full overflow-hidden">
                <div className="flex gap-2 p-3 justify-center">
                  <SpeakButton text={currentWord.word} size="sm" />
                  <SpeakButton text={currentWord.word} slow size="sm" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-5 text-center min-h-0">
                  <div
                    className="font-bold mb-3 max-w-full break-words"
                    style={{
                      color: "var(--text)",
                      fontSize: "clamp(1.6rem, 5.5vw, 2.6rem)",
                      lineHeight: 1.1,
                    }}
                  >
                    {currentWord.meaning}
                  </div>
                  <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {currentWord.type}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 mx-auto" style={{ maxWidth: "360px" }}>
            <button
              onClick={nextStep}
              className="btn btn-primary w-full py-3 rounded-2xl text-sm"
            >
              Tiếp tục →
            </button>
            <button
              onClick={handleSkipWord}
              className="w-full py-3 rounded-2xl border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)/10] transition-colors text-sm"
            >
              Mình đã biết từ này
            </button>
          </div>
          {!isFlipped && (
            <p className="text-center text-xs mt-3" style={{ color: "var(--text-faint)" }}>
              💡 Bấm vào thẻ để xem nghĩa
            </p>
          )}
        </div>
      )}

      {currentStep === "meaning-to-word" && (
        <div className="card p-6 animate-scale-in rounded-3xl">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                Chọn từ tiếng Nhật đúng
              </p>
              <button
                type="button"
                onClick={() => setShowFurigana((prev) => !prev)}
                className="text-xs font-semibold underline"
                style={{ color: "var(--primary)" }}
              >
                {showFurigana ? "Ẩn furigana" : "Hiện furigana"}
              </button>
            </div>
            <div className="text-3xl font-bold" style={{ color: "var(--text)" }}>{currentWord.meaning}</div>
            <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>[{currentWord.type}]</div>
          </div>
          <div className="flex flex-col gap-3">
            {choices.map((choice, index) => {
              const choiceWord = sessionWords.find((w) => w.word === choice);
              return (
                <button
                  key={index}
                  onClick={() => handleChoice(choice)}
                  className="w-full py-4 px-5 rounded-2xl text-left flex flex-col gap-2 transition-all duration-200"
                  style={{
                    background: "var(--surface-2)",
                    border: "2px solid var(--border-color)",
                    color: "var(--text)",
                    ...getChoiceStyle(choice),
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                      {index + 1}
                    </span>
                    <div className="flex flex-col items-start gap-1">
                      {showFurigana && choiceWord?.reading && (
                        <span className="text-xs text-[var(--text-muted)]">{choiceWord.reading}</span>
                      )}
                      <span className="font-jp text-lg font-medium">{choice}</span>
                    </div>
                  </div>
                </button>
              );
            })}
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

      {currentStep === "listening" && (
        <div className="card p-6 animate-scale-in rounded-3xl">
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-faint)" }}>
              Nghe và chọn nghĩa đúng
            </p>
            <div className="flex justify-center gap-4 mb-3">
              <SpeakButton text={currentWord.word} size="lg" />
              <SpeakButton text={currentWord.word} slow size="lg" />
            </div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nghe từ và chọn nghĩa phù hợp
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleChoice(choice)}
                className="w-full py-4 px-5 rounded-2xl text-left flex items-center gap-3 transition-all duration-200"
                style={{
                  background: "var(--surface-2)",
                  border: "2px solid var(--border-color)",
                  color: "var(--text)",
                  ...getChoiceStyle(choice),
                }}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {index + 1}
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

      {currentStep === "kanji" && (
        <div className="card p-6 text-center animate-scale-in rounded-3xl">
          <p className="text-xs uppercase tracking-widest mb-5" style={{ color: "var(--text-faint)" }}>
            Ghi nhớ cách viết Kanji
          </p>
          <div className="flex justify-center gap-3 mb-5 flex-wrap">
            {kanjisInWord.length > 0 ? kanjisInWord.map((kanji, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setShowKanjiHint(kanji)}
                className="w-20 h-20 rounded-3xl flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: "var(--surface-2)",
                  border: "2px solid var(--border-strong)",
                }}
                title="Bấm để xem nét vẽ"
              >
                <span className="font-jp text-4xl font-black" style={{ color: "var(--text)" }}>
                  {kanji}
                </span>
              </button>
            )) : (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Từ này chưa có Kanji để học.
              </div>
            )}
          </div>

          <div className="rounded-2xl p-4 mb-5 border relative" style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)" }}>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              {showKanjiHint ? `Thứ tự nét viết chữ ${showKanjiHint}` : "Chọn chữ Kanji để xem thứ tự nét"}
            </div>
            {showKanjiHint ? (
              <div className="flex justify-center rounded-xl p-2 mx-auto border" style={{ maxWidth: "140px", backgroundColor: "#ffffff", borderColor: "var(--border-color)" }}>
                <KanjiStrokeImage
                  char={showKanjiHint}
                  width={112}
                  height={112}
                  className="rounded-lg"
                />
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">Chọn một chữ trên bên trên để xem hướng nét vẽ.</div>
            )}
          </div>
          {showKanjiHint && (
            <button
              onClick={() => setShowKanjiHint(null)}
              className="btn btn-ghost py-2 rounded-2xl text-sm"
            >
              Đóng
            </button>
          )}

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

          <button onClick={nextStep} className="btn btn-primary w-full py-4 rounded-2xl text-base">
            Tiếp tục luyện viết →
          </button>
        </div>
      )}

      {currentStep === "write-kanji" && (
        <div className="card p-6 animate-scale-in rounded-3xl flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: "var(--text-faint)" }}>
              Thử thách viết chữ Hán
            </p>
            <h3 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Hãy viết chữ Hán của:
            </h3>
            <p className="text-lg font-bold mt-2" style={{ color: "var(--primary)" }}>
              {currentWord.meaning} <span className="text-sm font-jp" style={{ color: "var(--text-muted)" }}>（{currentWord.reading}）</span>
            </p>
          </div>

          <div className="relative">
            <HandwritingCanvas
              onSelectWord={(char) => setRecognizedCandidates((prev) => Array.from(new Set([...prev, char])))}
              onClose={() => {}}
            />
          </div>

          {recognizedCandidates.length > 0 && (
            <div className="p-3 rounded-xl flex flex-wrap gap-2 items-center" style={{ background: "var(--surface-2)" }}>
              <span className="text-[10px] uppercase font-bold" style={{ color: "var(--text-faint)" }}>Bạn đã chọn viết:</span>
              {recognizedCandidates.map((char) => (
                <span key={char} className="font-jp font-bold text-lg px-2 py-0.5 rounded bg-[var(--surface-3)]" style={{ color: "var(--text)" }}>
                  {char}
                </span>
              ))}
              <button
                onClick={() => setRecognizedCandidates([])}
                className="text-[10px] ml-auto underline"
                style={{ color: "var(--text-muted)" }}
              >
                Làm lại
              </button>
            </div>
          )}

          {answerStatus === "wrong" && (
            <div className="p-5 rounded-3xl border flex flex-col gap-3 bg-red-500/5" style={{ borderColor: "rgba(239,68,68,0.25)" }}>
              <div className="text-sm font-bold text-red-600">❌ Viết chưa chính xác! Cách viết đúng là:</div>
              <div className="grid grid-cols-2 gap-4 justify-items-center pt-2">
                {kanjisInWord.map((kanji) => (
                  <div key={kanji} className="flex flex-col items-center rounded-3xl p-3 border shadow-sm" style={{ backgroundColor: "#ffffff", borderColor: "var(--border-color)" }}>
                    <KanjiStrokeImage
                      char={kanji}
                      width={96}
                      height={96}
                      className="w-24 h-24"
                    />
                    <span className="font-jp text-lg font-bold mt-2" style={{ color: "#000000" }}>{kanji}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {answerStatus === "correct" && (
            <div className="p-3 rounded-xl text-center text-sm font-semibold" style={{ background: "rgba(34,197,94,0.1)", color: "var(--primary)" }}>
              🎉 Chính xác! Bạn viết rất tốt!
            </div>
          )}

          {answerStatus === "idle" ? (
            <button
              onClick={checkDrawingKanji}
              disabled={recognizedCandidates.length === 0}
              className="btn btn-primary w-full py-3.5 rounded-2xl"
            >
              Kiểm tra nét chữ
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="btn w-full py-3.5 rounded-2xl font-semibold"
              style={answerStatus === "correct"
                ? { background: "var(--primary)", color: "#0d1f14" }
                : { background: "#ef4444", color: "#fff" }
              }
            >
              Tiếp tục
            </button>
          )}
        </div>
      )}

      {currentStep === "result" && (
        <div className="card p-12 text-center animate-scale-in rounded-3xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
            Hoàn thành buổi học!
          </h2>
          <p className="mb-3" style={{ color: "var(--text-muted)" }}>
            Bạn vừa học được{" "}
            <span className="font-bold" style={{ color: "var(--primary)" }}>{learnedCount} từ mới</span>
          </p>
          {/* Tiến độ tổng bài */}
          <div className="rounded-2xl p-4 mb-8" style={{ background: "var(--surface-2)" }}>
            <div className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Tiến độ bài học</div>
            <div className="text-2xl font-bold mb-1" style={{ color: "var(--primary)" }}>
              {alreadyLearnedCount + learnedCount} / {total} từ
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden mt-2" style={{ background: "var(--surface-3)" }}>
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.round(((alreadyLearnedCount + learnedCount) / total) * 100))}%`,
                  background: "var(--primary)"
                }}
              />
            </div>
            {alreadyLearnedCount + learnedCount >= total && (
              <p className="text-xs mt-2 font-semibold" style={{ color: "var(--primary)" }}>✅ Hoàn thành 100% bài học!</p>
            )}
          </div>
        </div>
      )}

      {/* ===== EXIT CONFIRM MODAL (DUOLINGO STYLE) ===== */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border" style={{ borderColor: "var(--border-color)" }}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🍊</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Tạm dừng học?</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Tiến trình học bài này của bạn sẽ không được lưu nếu bạn thoát ra lúc này.
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
                onClick={() => window.location.href = `/learn/${encodeURIComponent(courseId)}`}
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
