// src/components/ui/NotificationSetup.tsx
// Banner xin quyền thông báo — hiện 1 lần duy nhất

"use client";

import { useState, useEffect } from "react";
import { requestNotificationPermission } from "@/lib/notifications";

export default function NotificationSetup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Chỉ hiện nếu chưa cấp quyền và chưa từ chối
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      // Đợi 3 giây rồi mới hỏi — không hỏi ngay khi vào
      setTimeout(() => setShow(true), 3000);
    }
  }, []);

  const handleAllow = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-lg p-5 z-50 border border-gray-100">
      <div className="flex items-start gap-3">
        <div className="text-3xl">🔔</div>
        <div className="flex-1">
          <div className="font-bold text-gray-900 mb-1">
            Bật thông báo nhắc học?
          </div>
          <div className="text-gray-500 text-sm mb-4">
            Nhận thông báo khi có từ cần ôn tập và nhắc giữ streak hàng ngày!
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAllow}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition"
            >
              Bật thông báo
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-4 py-2 bg-gray-100 text-gray-500 text-sm rounded-xl hover:bg-gray-200 transition"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}