// src/lib/speech.ts
// TTS Engine: Ưu tiên Google Translate Audio CDN (Native Accent) -> Fallback Web Speech API

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined";
}

export function speakJapanese(text: string, slow = false): void {
  if (!text?.trim() || typeof window === "undefined") return;

  const cleanText = text.trim();

  // 1. Thử dùng Google Translate Audio CDN (giọng đọc bản xứ cực chuẩn & tự nhiên)
  try {
    const speedParam = slow ? "0.4" : "1.0";
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}&ttsspeed=${speedParam}`;
    const audio = new Audio(audioUrl);
    
    // Nếu phát âm thành công
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Nếu trình duyệt chặn autoplay hoặc CORS -> Fallback Web Speech API
        speakWebSpeech(cleanText, slow);
      });
    }
    return;
  } catch {
    // Fallback
    speakWebSpeech(cleanText, slow);
  }
}

function speakWebSpeech(text: string, slow: boolean): void {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = slow ? 0.6 : 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice = voices.find((v) => v.lang === "ja-JP" || v.lang.startsWith("ja"));
  if (japaneseVoice) utterance.voice = japaneseVoice;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}