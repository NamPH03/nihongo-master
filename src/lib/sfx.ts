// src/lib/sfx.ts
// Hiệu ứng âm thanh Web Audio API — hoàn toàn non-blocking, không ảnh hưởng UI thread
// Sử dụng queueMicrotask để không block state updates

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) _ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return _ctx;
}

function playSynth(setup: (ctx: AudioContext, now: number) => void): void {
  // Non-blocking: chờ sau khi React state update xong mới phát âm
  queueMicrotask(() => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().then(() => setup(ctx, ctx.currentTime)).catch(() => {/* ignore */});
      } else {
        setup(ctx, ctx.currentTime);
      }
    } catch {
      // ignore
    }
  });
}

// Âm "Ting" trong trẻo — 2 nốt Sine (E5 + B5)
export const sfx = {
  playCorrect(): void {
    playSynth((ctx, now) => {
      [659.25, 987.77].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    });
  },

  // Âm "Pip" nhẹ — Triangle wave xuống dần (A3 → A2)
  playWrong(): void {
    playSynth((ctx, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.22);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    });
  },
};
