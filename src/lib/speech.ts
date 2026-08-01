// src/lib/speech.ts
// Web Speech API với fix đặc biệt cho iOS Safari
// iOS yêu cầu speechSynthesis được gọi LẦN ĐẦU từ user gesture (click/tap)
// Sau lần đầu đó, các lần gọi tiếp (kể cả từ useEffect) mới hoạt động

// State: đã được iOS unlock chưa
let iosUnlocked = false;

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Gọi 1 lần trong handler click đầu tiên để unlock iOS
export function unlockSpeechSynthesis(): void {
  if (iosUnlocked || !isSpeechSupported()) return;
  // Phát utterance rỗng để unlock
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  window.speechSynthesis.speak(u);
  iosUnlocked = true;
}

function getBestJapaneseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ja-JP" && v.localService) ||
    voices.find((v) => v.lang === "ja-JP") ||
    voices.find((v) => v.lang.startsWith("ja")) ||
    null
  );
}

export function speakJapanese(text: string, slow = false): void {
  if (!isSpeechSupported() || !text?.trim()) return;

  // Cancel bất kỳ utterance đang phát
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = "ja-JP";
  utterance.rate = slow ? 0.6 : 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voice = getBestJapaneseVoice();
  if (voice) utterance.voice = voice;

  // setTimeout 0 giúp iOS Safari không bị block bởi microtask queue
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 0);
}

export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Khi voices load xong (cần cho Chrome/Android)
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices(); // trigger load
    };
  }
}