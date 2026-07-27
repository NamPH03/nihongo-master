// src/components/ui/JapaneseText.tsx
"use client";

type Props = {
  word: string;
  reading?: string;
  showFurigana?: boolean;
  className?: string;
  kanjiClassName?: string;
  furiganaClassName?: string;
};

function hasKanji(str: string): boolean {
  return /[\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}

export default function JapaneseText({
  word,
  reading,
  showFurigana = true,
  className = "",
  kanjiClassName = "",
  furiganaClassName = "",
}: Props) {
  if (!word) return null;

  // Nếu không có Kanji hoặc từ và reading trùng nhau -> Hiện plain text
  if (!hasKanji(word) || !reading || word === reading) {
    return <span className={`font-jp ${className}`}>{word}</span>;
  }

  return (
    <ruby className={`font-jp inline-flex flex-col items-center leading-none ${className}`}>
      <span className={kanjiClassName}>{word}</span>
      {showFurigana && (
        <rt className={`text-xs font-normal mb-0.5 select-none ${furiganaClassName}`} style={{ color: "var(--primary)" }}>
          {reading}
        </rt>
      )}
    </ruby>
  );
}
