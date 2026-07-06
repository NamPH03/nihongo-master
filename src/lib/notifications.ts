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
export function sendNotification(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "nihongo-master",
  });
}

// Kiểm tra và gửi thông báo ôn tập
export function checkAndNotify(dueCount: number, streak: number, studiedToday: boolean) {
  if (Notification.permission !== "granted") return;

  if (dueCount > 0) {
    sendNotification(
      "📚 Đến giờ ôn tập rồi!",
      `Bạn có ${dueCount} từ cần ôn tập. Học ngay để không quên nhé!`
    );
    return;
  }

  if (!studiedToday && streak > 0) {
    sendNotification(
      `🔥 Streak ${streak} ngày sắp mất!`,
      "Bạn chưa học hôm nay! Chỉ cần 1 từ thôi để giữ streak nhé!"
    );
    return;
  }

  // Test notification — luôn gửi dù không có từ cần ôn
  sendNotification(
    "🌿 Nihongo Master",
    "Hãy dành 5 phút ôn từ vựng tiếng Nhật hôm nay nhé!"
  );
}

// Lưu thời gian thông báo cuối để tránh spam
export function getLastNotifyTime(): string {
  try { return localStorage.getItem("lastNotifyTime") || ""; }
  catch { return ""; }
}

export function setLastNotifyTime(): void {
  try { localStorage.setItem("lastNotifyTime", new Date().toISOString()); }
  catch { /* ignore */ }
}

// Kiểm tra đã thông báo trong vòng N phút chưa
// TEST MODE: 5 phút — sau khi xác nhận hoạt động, đổi lại 60 phút
const NOTIFY_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

export function canNotifyNow(): boolean {
  const last = getLastNotifyTime();
  if (!last) return true;
  const diff = Date.now() - new Date(last).getTime();
  return diff > NOTIFY_INTERVAL_MS;
}