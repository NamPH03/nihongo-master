// src/components/ui/NotificationSetup.tsx
"use client";

import { useState, useEffect } from "react";
import { requestNotificationPermission } from "@/lib/notifications";

export default function NotificationSetup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      setTimeout(() => setShow(true), 3000);
    }
  }, []);

  const handleAllow = async () => {
    const granted = await requestNotificationPermission();
    if (granted) setShow(false);
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