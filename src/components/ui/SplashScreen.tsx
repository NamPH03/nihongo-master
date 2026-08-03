"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [isDark, setIsDark] = useState(true); // default dark để tránh flash

  useEffect(() => {
    // Đọc theme từ localStorage ngay lập tức (trước khi render)
    try {
      const savedTheme = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const darkMode = savedTheme === "dark" || (!savedTheme && prefersDark);
      setIsDark(darkMode);
    } catch {
      setIsDark(true);
    }

    // Chỉ hiển thị splash màn hình khi mở app lần đầu trong phiên
    const hasSeenSplash = sessionStorage.getItem("has_seen_splash");
    if (hasSeenSplash) {
      setVisible(false);
      return;
    }

    let isAppReady = (window as unknown as { __APP_READY__?: boolean }).__APP_READY__ || false;
    let minTimePassed = false;

    const tryDismiss = () => {
      if (isAppReady && minTimePassed) {
        setFadeOut(true);
        setTimeout(() => {
          setVisible(false);
          sessionStorage.setItem("has_seen_splash", "true");
        }, 500);
      }
    };

    // 1. Thời gian hiển thị tối thiểu (1.2s)
    const minTimer = setTimeout(() => {
      minTimePassed = true;
      tryDismiss();
    }, 1200);

    // 2. Timeout an toàn tối đa 4s
    const maxTimer = setTimeout(() => {
      isAppReady = true;
      minTimePassed = true;
      tryDismiss();
    }, 4000);

    // 3. Lắng nghe sự kiện "app-ready" khi Dashboard tải xong
    const handleReady = () => {
      isAppReady = true;
      tryDismiss();
    };

    window.addEventListener("app-ready", handleReady);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      window.removeEventListener("app-ready", handleReady);
    };
  }, []);

  if (!visible) return null;

  const bgColor = isDark ? "#0c1410" : "#f6fdf8";
  const textColor = isDark ? "#e4f4eb" : "#0d1f14";
  const subColor = isDark ? "#7aad8e" : "#4a7a61";
  const trackColor = isDark ? "#1a2620" : "#e0f2e8";

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ease-out select-none ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: bgColor }}
    >
      {/* Logo & App Icon với hiệu ứng Glow */}
      <div className="flex flex-col items-center gap-4 animate-scale-in">
        <div
          className="relative w-28 h-28 rounded-3xl p-[2px] overflow-hidden animate-pulse"
          style={{ boxShadow: "0 0 60px rgba(34,197,94,0.4)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt="Nihongo Master Logo"
            className="w-full h-full object-cover rounded-3xl"
          />
        </div>

        <div className="flex flex-col items-center text-center">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: textColor }}
          >
            Nihongo Master
          </h1>
          <p
            className="text-xs tracking-widest uppercase mt-1"
            style={{ color: subColor }}
          >
            Chinh phục tiếng Nhật
          </p>
        </div>
      </div>

      {/* Progress bar ở dưới cùng */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div
          className="w-24 h-1 rounded-full overflow-hidden"
          style={{ background: trackColor }}
        >
          <div
            className="h-full rounded-full animate-pulse"
            style={{
              width: "80%",
              background: "linear-gradient(to right, #22c55e, #4ade80)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
