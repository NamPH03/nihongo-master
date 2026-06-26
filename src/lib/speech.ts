// src/lib/speech.ts
// Dùng Web Speech API để đọc tiếng Nhật
// Hoàn toàn miễn phí, có sẵn trong trình duyệt

// Kiểm tra trình duyệt có hỗ trợ không
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Hàm đọc từ tiếng Nhật
export function speakJapanese(text: string, slow = false): void {
  if (!isSpeechSupported()) return;

  // Dừng nếu đang đọc dở
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Cài đặt giọng đọc
  utterance.lang = "ja-JP";          // Ngôn ngữ Nhật
  utterance.rate = slow ? 0.5 : 1.0; // 0.5 = chậm, 1.0 = bình thường
  utterance.pitch = 1.0;             // Cao độ giọng
  utterance.volume = 1.0;            // Âm lượng tối đa

  // Ưu tiên dùng giọng Nhật nếu có
  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice = voices.find(
    (v) => v.lang === "ja-JP" || v.lang.startsWith("ja")
  );
  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Dừng đọc
export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}