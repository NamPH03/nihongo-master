// src/lib/notifications.ts
// Xử lý Web Push Notification

// Xin quyền thông báo từ user
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("Trình duyệt không hỗ trợ thông báo");
    return false;
  }

  if (Notification.permission === "granted") return true;

  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// Gửi thông báo
export function sendNotification(title: string, body: string, icon = "🎌") {
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "nihongo-master", // Tránh spam nhiều thông báo
  });
}

// Kiểm tra và gửi thông báo ôn tập
export function checkAndNotify(dueCount: number, streak: number, studiedToday: boolean) {
  if (Notification.permission !== "granted") return;

  // Thông báo 1 — Số từ cần ôn là bội số của 30
  if (dueCount > 0 && dueCount % 30 === 0) {
    sendNotification(
      "📚 Đến giờ ôn tập rồi!",
      `Bạn có ${dueCount} từ cần ôn tập. Học ngay để không quên nhé!`
    );
    return;
  }

  // Thông báo 2 — Nhắc streak nếu chưa học hôm nay
  // Chỉ nhắc sau 20:00 tối
  const hour = new Date().getHours();
  if (hour >= 20 && !studiedToday && streak > 0) {
    sendNotification(
      `🔥 Streak ${streak} ngày sắp mất!`,
      "Bạn chưa học hôm nay! Chỉ cần 1 từ thôi để giữ streak nhé!"
    );
  }
}

// Lưu thời gian thông báo cuối để tránh spam
export function getLastNotifyTime(): string {
  return localStorage.getItem("lastNotifyTime") || "";
}

export function setLastNotifyTime(): void {
  localStorage.setItem("lastNotifyTime", new Date().toISOString());
}

// Kiểm tra đã thông báo trong 1 tiếng chưa
export function canNotifyNow(): boolean {
  const last = getLastNotifyTime();
  if (!last) return true;
  const diff = Date.now() - new Date(last).getTime();
  return diff > 60 * 60 * 1000; // 1 tiếng
}