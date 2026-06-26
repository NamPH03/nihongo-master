// src/components/ui/SpeakButton.tsx
// Nút bấm để nghe phát âm — dùng lại ở nhiều trang

"use client";

import { useState, useEffect } from "react";
import { speakJapanese, isSpeechSupported } from "@/lib/speech";

type Props = {
  text: string;       // Từ cần đọc
  slow?: boolean;     // Đọc chậm không?
  size?: "sm" | "md" | "lg"; // Kích thước nút
};

export default function SpeakButton({ text, slow = false, size = "md" }: Props) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(isSpeechSupported());
  }, []);

  if (!supported) return null;

  const sizeClass = {
    sm: "w-8 h-8 text-base",
    md: "w-12 h-12 text-xl",
    lg: "w-16 h-16 text-2xl",
  }[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Không lật flashcard khi bấm
    setSpeaking(true);
    speakJapanese(text, slow);
    setTimeout(() => setSpeaking(false), slow ? 3000 : 1500);
  };

  return (
    <button
      onClick={handleClick}
      className={`${sizeClass} rounded-full flex items-center justify-center transition ${
        speaking
          ? "bg-red-100 text-red-500 scale-110"
          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
      }`}
      title={slow ? "Phát âm chậm" : "Phát âm"}
    >
      {slow ? (speaking ? "🐢" : "🐢") : (speaking ? "🔈" : "🔊")}
    </button>
  );
}