// src/lib/progressCache.ts
// Module-level in-memory cache cho progress subcollection của user.
// Giải quyết vấn đề N+1: nhiều component cùng trang đọc progress riêng lẻ.
// TTL 2 phút — đủ để share giữa các component trong cùng page load,
// ngắn đủ để phản ánh thay đổi khi user học/ôn xong.

export type ProgressDoc = {
  id: string;      // document id (= wordId, hoặc "stats")
  wordId: string;
  srLevel: number;
  nextReview: string | null;
  status: string;  // "learned" | "new"
  lastReviewed: string | null;
};

const CACHE_TTL = 2 * 60 * 1000; // 2 phút

const store = new Map<string, { ts: number; docs: ProgressDoc[] }>();

/** Lấy progress docs từ cache. Trả về null nếu cache miss hoặc hết hạn. */
export function getProgressCache(uid: string): ProgressDoc[] | null {
  const entry = store.get(uid);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    store.delete(uid);
    return null;
  }
  return entry.docs;
}

/** Lưu progress docs vào cache. */
export function setProgressCache(uid: string, docs: ProgressDoc[]): void {
  store.set(uid, { ts: Date.now(), docs });
}

/**
 * Xóa cache của user — gọi ngay sau mỗi write operation (markLearned, promote, demote, updateProgress…)
 * để lần đọc tiếp theo luôn lấy dữ liệu mới nhất.
 */
export function invalidateProgressCache(uid: string): void {
  store.delete(uid);
}
