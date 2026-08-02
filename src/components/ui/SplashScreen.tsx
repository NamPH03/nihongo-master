"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Chỉ hiển thị splash màn hình đen khi mở app lần đầu trong phiên
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

    // 1. Thời gian hiển thị tối thiểu để người dùng xem hiệu ứng logo (1.2s)
    const minTimer = setTimeout(() => {
      minTimePassed = true;
      tryDismiss();
    }, 1200);

    // 2. Timeout an toàn (tối đa 4s) để phòng trường hợp mất mạng/lỗi mạng không bị kẹt màn hình đen
    const maxTimer = setTimeout(() => {
      isAppReady = true;
      minTimePassed = true;
      tryDismiss();
    }, 4000);

    // 3. Lắng nghe sự kiện "app-ready" khi Dashboard tải xong dữ liệu
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

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white transition-opacity duration-500 ease-out select-none ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Logo & App Icon với hiệu ứng Glow trên nền đen */}
      <div className="flex flex-col items-center gap-4 animate-scale-in">
        <div className="relative w-28 h-28 rounded-3xl p-[2px] shadow-[0_0_60px_rgba(34,197,94,0.4)] animate-pulse overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt="Nihongo Master Logo"
            className="w-full h-full object-cover rounded-3xl"
          />
        </div>

        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
            Nihongo Master
          </h1>
          <p className="text-xs text-neutral-400 tracking-widest uppercase mt-1">
            Chinh phục tiếng Nhật
          </p>
        </div>
      </div>

      {/* Progress bar nhỏ ở dưới cùng */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div className="w-24 h-1 bg-neutral-900 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full animate-pulse" style={{ width: "80%" }} />
        </div>
      </div>
    </div>
  );
}
