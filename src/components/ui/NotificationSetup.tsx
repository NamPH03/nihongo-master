// src/components/ui/NotificationSetup.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  requestNotificationPermission,
  sendNotification,
  canNotifyNow,
  setLastNotifyTime,
} from "@/lib/notifications";

// Gửi 1 thông báo test ngay lập tức
function sendTestNotification() {
  if (Notification.permission !== "granted") return;
  if (!canNotifyNow()) return;
  sendNotification(
    "🌿 Nihongo Master — Nhắc học!",
    "Đây là thông báo test (mỗi 5 phút). Bạn đang online và app đang mở."
  );
  setLastNotifyTime();
}

export default function NotificationSetup() {
  const [show, setShow] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Khởi động vòng lặp 5 phút nếu đã có quyền
  const startInterval = () => {
    if (intervalRef.current) return; // tránh duplicate
    // Gửi ngay lần đầu
    sendTestNotification();
    // Sau đó cứ 5 phút 1 lần
    intervalRef.current = setInterval(() => {
      sendTestNotification();
    }, 5 * 60 * 1000);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      // Đã có quyền → bắt đầu interval ngay
      startInterval();
    } else if (Notification.permission === "default") {
      // Chưa hỏi → hiện banner sau 3 giây
      setTimeout(() => setShow(true), 3000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAllow = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setShow(false);
      startInterval();
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 rounded-2xl p-5 z-50 animate-fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">🔔</div>
        <div className="flex-1">
          <div className="font-bold mb-1" style={{ color: "var(--text)" }}>
            Bật thông báo nhắc học?
          </div>
          <div className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Nhận thông báo khi có từ cần ôn tập và nhắc giữ streak hàng ngày.
          </div>
          <div className="flex gap-2">
            <button onClick={handleAllow} className="btn btn-primary flex-1 py-2 text-sm rounded-xl">
              Bật thông báo
            </button>
            <button
              onClick={() => setShow(false)}
              className="btn btn-ghost px-4 py-2 text-sm rounded-xl"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}