// src/components/ui/SpeakButton.tsx
"use client";

import { useState, useEffect } from "react";
import { speakJapanese, isSpeechSupported } from "@/lib/speech";

type Props = {
  text: string;
  slow?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function SpeakButton({ text, slow = false, size = "md" }: Props) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => { setSupported(isSpeechSupported()); }, []);
  if (!supported) return null;

  const sizeClass = { sm: "w-8 h-8 text-sm", md: "w-11 h-11 text-lg", lg: "w-16 h-16 text-2xl" }[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpeaking(true);
    speakJapanese(text, slow);
    setTimeout(() => setSpeaking(false), slow ? 3000 : 1500);
  };

  return (
    <button
      onClick={handleClick}
      className={`${sizeClass} rounded-full flex items-center justify-center transition-all duration-200 ease-spring`}
      style={
        speaking
          ? { background: "var(--primary-glow)", color: "var(--primary)", transform: "scale(1.1)" }
          : { background: "var(--surface-2)", color: "var(--text-muted)" }
      }
      title={slow ? "Phát âm chậm" : "Phát âm"}
    >
      {slow ? "🐢" : (speaking ? "🔈" : "🔊")}
    </button>
  );
}