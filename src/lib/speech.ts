// src/lib/speech.ts
// Web Speech API — chuẩn, offline, không bị autoplay/CORS block trên mobile
// Tự động pick giọng Nhật tốt nhất có sẵn trên thiết bị

let voiceInitialized = false;

function getBestJapaneseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Ưu tiên theo thứ tự: giọng Nhật local > giọng Nhật network > bất kỳ giọng Nhật nào
  const priorities = [
    voices.find((v) => v.lang === "ja-JP" && !v.localService === false),
    voices.find((v) => v.lang === "ja-JP"),
    voices.find((v) => v.lang.startsWith("ja")),
  ];
  return priorities.find(Boolean) ?? null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakJapanese(text: string, slow = false): void {
  if (!isSpeechSupported() || !text?.trim()) return;

  // Kích hoạt voices load (cần thiết trên mobile Safari)
  if (!voiceInitialized) {
    window.speechSynthesis.getVoices();
    voiceInitialized = true;
  }

  // Dừng nếu đang đọc dở
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = "ja-JP";
  utterance.rate = slow ? 0.6 : 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voice = getBestJapaneseVoice();
  if (voice) utterance.voice = voice;

  // Mobile Safari fix: cần setTimeout 0 để không bị block
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 0);
}

export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Pre-warm voices khi module load (giúp mobile iOS có đủ thời gian load danh sách giọng)
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voiceInitialized = true;
  };
}