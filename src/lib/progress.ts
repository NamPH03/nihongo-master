// src/lib/progress.ts
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs
} from "firebase/firestore";
import { getAllVocabulary, type CachedVocabItem } from "@/lib/vocabCache";
import { pushLeaderboardSnapshot } from "@/lib/leaderboard";
import {
  getProgressCache,
  setProgressCache,
  invalidateProgressCache,
  type ProgressDoc,
} from "@/lib/progressCache";

// ===== SPACED REPETITION INTERVALS =====
export const SR_INTERVALS: Record<number, number> = {
  1: 1 * 60 * 60 * 1000,              // Mức 1 → 1 giờ
  2: 1 * 24 * 60 * 60 * 1000,         // Mức 2 → 1 ngày
  3: 5 * 24 * 60 * 60 * 1000,         // Mức 3 → 5 ngày
  4: 14 * 24 * 60 * 60 * 1000,        // Mức 4 → 14 ngày
  5: 30 * 24 * 60 * 60 * 1000,        // Mức 5 → 30 ngày (ôn đầu)
};

// Hybrid Mastered: ôn đúng lần 1 tại Level 5 → +60 ngày, lần 2 → +120 ngày → MASTERED
export const SR_LEVEL5_REVIEW_INTERVALS: Record<number, number> = {
  0: 30 * 24 * 60 * 60 * 1000,        // reviewCount 0 → lần ôn đầu (đã được set khi promote lên 5)
  1: 60 * 24 * 60 * 60 * 1000,        // reviewCount 1 → ôn đúng lần 1 → +60 ngày
  2: 120 * 24 * 60 * 60 * 1000,       // reviewCount 2 → ôn đúng lần 2 → +120 ngày → MASTERED
};

// ===== TYPES =====
export type WordProgress = {
  wordId: string;
  srLevel: number;
  nextReview: string | null;
  status: "new" | "learned" | "mastered";
  lastReviewed: string | null;
  reviewCount?: number;   // Chỉ dùng ở Level 5: đếm số lần ôn đúng (0, 1, 2 → mastered)
};

export type DueWordProgress = WordProgress & {
  id: string;
};

export type ProgressData = {
  streak: number;
  lastStudyDate: string;
  totalLearned: number;
  dailyHistory: Record<string, number>;
  masteredCount?: number;
};

// ===== PATH HELPERS =====
// Tất cả đều dùng 1 collection duy nhất: users/{uid}/progress/{wordId}
function wordProgressRef(userId: string, wordId: string) {
  return doc(db, "users", userId, "progress", wordId);
}

function userProgressCollection(userId: string) {
  return collection(db, "users", userId, "progress");
}

function userStatsRef(userId: string) {
  return doc(db, "users", userId, "progress", "stats");
}

// Helper lấy danh sách progress docs (ưu tiên in-memory cache)
async function fetchUserProgressDocs(userId: string): Promise<ProgressDoc[]> {
  const cached = getProgressCache(userId);
  if (cached) return cached;

  const snap = await getDocs(userProgressCollection(userId));
  const docs: ProgressDoc[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      wordId: data.wordId || d.id,
      srLevel: Number(data.srLevel || 0),
      nextReview: data.nextReview || null,
      status: data.status || "new",
      lastReviewed: data.lastReviewed || null,
      reviewCount: Number(data.reviewCount || 0),
    };
  });

  setProgressCache(userId, docs);
  return docs;
}

// ===== WORD PROGRESS =====

// Lưu từ từ từ điển vào sổ tay → thẳng mức 1 (status: "learned")
export async function saveWordFromDictionary(
  userId: string,
  wordId: string
): Promise<void> {
  const nextReview = new Date(Date.now() + SR_INTERVALS[1]).toISOString();
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: 1,
    nextReview,
    status: "learned",
    lastReviewed: new Date().toISOString(),
  }, { merge: true });
  invalidateProgressCache(userId);
}


// Đánh dấu từ đã học xong lần đầu → mức 1
export async function markNewWordLearned(
  userId: string,
  wordId: string
): Promise<void> {
  const nextReview = new Date(Date.now() + SR_INTERVALS[1]).toISOString();
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: 1,
    nextReview,
    status: "learned",
    lastReviewed: new Date().toISOString(),
  });
  invalidateProgressCache(userId);
}

// Nâng mức sau khi ôn thành công
export async function promoteWord(
  userId: string,
  wordId: string,
  currentLevel: number,
  currentReviewCount: number = 0
): Promise<void> {
  // ── Hybrid Mastered: xử lý riêng khi đang ở Level 5 ──
  if (currentLevel === 5) {
    const newReviewCount = currentReviewCount + 1;
    if (newReviewCount >= 2) {
      // Đã ôn đúng đủ 2 lần ở Level 5 → MASTERED
      await setDoc(wordProgressRef(userId, wordId), {
        wordId,
        srLevel: 5,
        nextReview: null,
        status: "mastered",
        lastReviewed: new Date().toISOString(),
        reviewCount: newReviewCount,
      }, { merge: true });
      invalidateProgressCache(userId);
      // Tăng masteredCount trong stats
      const statsRef = userStatsRef(userId);
      const snap = await getDoc(statsRef);
      if (snap.exists()) {
        const current = snap.data().masteredCount || 0;
        await setDoc(statsRef, { masteredCount: current + 1 }, { merge: true });
      }
      return;
    }
    // Chưa đủ 2 lần → đặt lịch ôn tiếp theo
    const interval = newReviewCount === 1
      ? SR_LEVEL5_REVIEW_INTERVALS[1]   // +60 ngày
      : SR_LEVEL5_REVIEW_INTERVALS[2];  // +120 ngày (phòng trường hợp)
    const nextReview = new Date(Date.now() + interval).toISOString();
    await setDoc(wordProgressRef(userId, wordId), {
      wordId,
      srLevel: 5,
      nextReview,
      status: "learned",
      lastReviewed: new Date().toISOString(),
      reviewCount: newReviewCount,
    }, { merge: true });
    invalidateProgressCache(userId);
    return;
  }

  // ── Bình thường: tăng level 1→2→3→4→5 ──
  const newLevel = Math.min(currentLevel + 1, 5);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]).toISOString();
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: newLevel,
    nextReview,
    status: "learned",
    lastReviewed: new Date().toISOString(),
    reviewCount: 0,
  }, { merge: true });
  invalidateProgressCache(userId);
}

// Giảm mức khi quên
export async function demoteWord(
  userId: string,
  wordId: string,
  currentLevel: number
): Promise<void> {
  const newLevel = Math.max(currentLevel - 1, 1);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]).toISOString();
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: newLevel,
    nextReview,
    status: "learned",
    lastReviewed: new Date().toISOString(),
    reviewCount: 0,   // Reset reviewCount khi bị demote
  }, { merge: true });
  invalidateProgressCache(userId);
}

// Đưa từ vào mastered trực tiếp (dùng cho màn hình tổng kết sau bài học)
export async function masterWordDirectly(
  userId: string,
  wordId: string
): Promise<void> {
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: 5,
    nextReview: null,
    status: "mastered",
    lastReviewed: new Date().toISOString(),
    reviewCount: 2,
  }, { merge: true });
  invalidateProgressCache(userId);
  // Tăng masteredCount
  const statsRef = userStatsRef(userId);
  const snap = await getDoc(statsRef);
  if (snap.exists()) {
    const current = snap.data().masteredCount || 0;
    await setDoc(statsRef, { masteredCount: current + 1 }, { merge: true });
  }
}

// ===== QUERIES =====

// Lấy tất cả wordId đã có trong progress (trừ "stats") — bao gồm cả "new"
export async function getLearnedWordIds(userId: string): Promise<Set<string>> {
  const docs = await fetchUserProgressDocs(userId);
  return new Set(docs.filter((d) => d.id !== "stats").map((d) => d.id));
}

// Chỉ lấy wordId có status = "learned" (bao gồm cả các từ trùng ở khóa khác)
export async function getLearnedOnlyWordIds(userId: string): Promise<Set<string>> {
  const [docs, allVocab] = await Promise.all([
    fetchUserProgressDocs(userId),
    getAllVocabulary(),
  ]);

  // Tập hợp các ID đã có progress "learned" trực tiếp
  const directLearnedIds = new Set(
    docs.filter((d) => d.id !== "stats" && d.status === "learned").map((d) => d.id)
  );

  // Tạo tập hợp các chữ từ vựng (chữ Nhật như "お土産") đã được học
  const learnedWordTexts = new Set<string>();
  allVocab.forEach((v) => {
    if (directLearnedIds.has(v.id) && v.word) {
      learnedWordTexts.add(v.word);
    }
  });

  // Mở rộng kết quả: bất kỳ vocab ID nào có chữ Nhật thuộc learnedWordTexts cũng được coi là đã học
  const resultSet = new Set<string>(directLearnedIds);
  allVocab.forEach((v) => {
    if (v.word && learnedWordTexts.has(v.word)) {
      resultSet.add(v.id);
    }
  });

  return resultSet;
}

// Lấy wordId có status "new" (lưu từ dictionary chưa học)
export async function getNewSavedWordIds(userId: string): Promise<Set<string>> {
  const docs = await fetchUserProgressDocs(userId);
  return new Set(docs.filter((d) => d.id !== "stats" && d.status === "new").map((d) => d.id));
}

// Lấy số từ ở mỗi mức SR — CHỈ đếm từ có vocabulary tương ứng (tránh orphan inflate stats)
export async function getSRStats(
  userId: string
): Promise<Record<number, number>> {
  const stats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const [allVocab, docs] = await Promise.all([
    getAllVocabulary(),
    fetchUserProgressDocs(userId),
  ]);
  const vocabIds = new Set(allVocab.map((v) => v.id));

  docs.forEach((d) => {
    if (d.id === "stats") return;
    if (!vocabIds.has(d.id)) return;
    const level = d.srLevel;
    if (level >= 1 && level <= 5) stats[level]++;
  });
  return stats;
}

// Lấy từ đến hạn ôn tập — CHỈ trả về từ có vocabulary tương ứng (tránh orphan)
// Bỏ qua từ đã "mastered" (không cần ôn nữa)
export async function getDueWords(
  userId: string,
  limitCount = 20
): Promise<DueWordProgress[]> {
  const now = new Date().toISOString();

  const [allVocab, docs] = await Promise.all([
    getAllVocabulary(),
    fetchUserProgressDocs(userId),
  ]);
  const vocabIds = new Set(allVocab.map((v) => v.id));

  return docs
    .filter((d) => {
      if (d.id === "stats") return false;
      if (!vocabIds.has(d.id)) return false;
      if (d.status === "mastered") return false;   // Bỏ qua từ đã mastered
      if (d.status !== "learned") return false;
      const nextReview = d.nextReview;
      return !nextReview || nextReview <= now;
    })
    .map((d) => ({ ...d } as DueWordProgress))
    .slice(0, limitCount);
}

/**
 * Phiên bản tổng hợp: đọc vocabulary 1 lần duy nhất → trả về cả dueWords + allWords.
 * Dùng cho Review page để tránh N+1 và đọc collection nhiều lần.
 */
export type DueWordsResult = {
  dueWords: DueWordProgress[];
  allVocab: CachedVocabItem[];
};

export async function getDueWordsWithVocab(
  userId: string,
  limitCount = 20
): Promise<DueWordsResult> {
  const now = new Date().toISOString();

  const [allVocab, docs] = await Promise.all([
    getAllVocabulary(),
    fetchUserProgressDocs(userId),
  ]);
  const vocabIds = new Set(allVocab.map((v) => v.id));

  const dueWords = docs
    .filter((d) => {
      if (d.id === "stats") return false;
      if (!vocabIds.has(d.id)) return false;
      if (d.status === "mastered") return false;   // Bỏ qua từ đã mastered
      if (d.status !== "learned") return false;
      const nextReview = d.nextReview;
      return !nextReview || nextReview <= now;
    })
    .map((d) => ({ ...d } as DueWordProgress))
    .slice(0, limitCount);

  return { dueWords, allVocab };
}

/**
 * Hàm mới gộp cho Dashboard: Tính SRStats & đếm dueWords chỉ trong 1 lần đọc progress docs.
 */
export async function getDashboardSummary(userId: string): Promise<{
  srStats: Record<number, number>;
  dueCount: number;
  masteredCount: number;
}> {
  const now = new Date().toISOString();
  const [allVocab, docs] = await Promise.all([
    getAllVocabulary(),
    fetchUserProgressDocs(userId),
  ]);
  const vocabIds = new Set(allVocab.map((v) => v.id));

  const srStats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let dueCount = 0;
  let masteredCount = 0;

  docs.forEach((d) => {
    if (d.id === "stats") return;
    if (!vocabIds.has(d.id)) return;

    // Đếm mastered riêng, không tính vào srStats
    if (d.status === "mastered") {
      masteredCount++;
      return;
    }

    // SR Stats (chỉ từ "learned")
    const level = d.srLevel;
    if (level >= 1 && level <= 5) srStats[level]++;

    // Due Words Count
    if (d.status === "learned") {
      const nextReview = d.nextReview;
      if (!nextReview || nextReview <= now) {
        dueCount++;
      }
    }
  });

  return { srStats, dueCount, masteredCount };
}

// ===== PROGRESS & STREAK =====
function getTodayString(): string {
  const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split("T")[0];
}

function getYesterdayString(): string {
  const vnTime = new Date(Date.now() + 7 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return vnTime.toISOString().split("T")[0];
}

export async function getProgress(userId: string): Promise<ProgressData> {
  const ref = userStatsRef(userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const d: ProgressData = {
      streak: 0,
      lastStudyDate: "",
      totalLearned: 0,
      dailyHistory: {},
    };
    await setDoc(ref, d);
    return d;
  }
  const data = snap.data() as ProgressData;
  const today = getTodayString();
  const yesterday = getYesterdayString();
  
  // Kiểm tra xem user có bỏ lỡ việc học quá 1 ngày hay không
  if (data.lastStudyDate && data.lastStudyDate !== today && data.lastStudyDate !== yesterday) {
    const updated = { ...data, streak: 0 };
    await setDoc(ref, updated, { merge: true });
    return updated;
  }
  
  return data;
}

export async function updateProgress(
  userId: string,
  wordsLearned: number,
  userMeta?: { displayName?: string; email?: string }
): Promise<ProgressData> {
  const ref = userStatsRef(userId);
  const current = await getProgress(userId);
  const today = getTodayString();
  const yesterday = getYesterdayString();

  let newStreak = current.streak;
  if (current.lastStudyDate === today) {
    newStreak = current.streak;
  } else if (current.lastStudyDate === yesterday) {
    newStreak = current.streak + (wordsLearned > 0 ? 1 : 0);
  } else {
    newStreak = wordsLearned > 0 ? 1 : 0;
  }

  const todayCount = (current.dailyHistory[today] || 0) + wordsLearned;
  const updated: ProgressData = {
    streak: newStreak,
    lastStudyDate: wordsLearned > 0 ? today : current.lastStudyDate,
    totalLearned: current.totalLearned + wordsLearned,
    dailyHistory: { ...current.dailyHistory, [today]: todayCount },
  };

  await updateDoc(ref, updated);

  // Cập nhật leaderboard snapshot (1 write, không block UI)
  if (wordsLearned > 0) {
    pushLeaderboardSnapshot({
      uid: userId,
      displayName: userMeta?.displayName || "",
      email: userMeta?.email || "",
      totalLearned: updated.totalLearned,
      streak: updated.streak,
      masteredCount: (current as ProgressData & { masteredCount?: number }).masteredCount || 0,
    }).catch(() => {/* silent */});
  }

  return updated;
}

// Đánh dấu user đã học/ôn tập hôm nay mà không tăng totalLearned
// Dùng cho review session: cập nhật lastStudyDate + streak để tránh bug "999 ngày"
export async function markStudiedToday(userId: string): Promise<void> {
  const ref = userStatsRef(userId);
  const current = await getProgress(userId);
  const today = getTodayString();
  const yesterday = getYesterdayString();

  // Nếu đã cập nhật hôm nay rồi thì bỏ qua
  if (current.lastStudyDate === today) return;

  let newStreak = current.streak;
  if (current.lastStudyDate === yesterday) {
    newStreak = current.streak + 1;
  } else if (!current.lastStudyDate) {
    newStreak = 1;
  } else {
    // Đã nghỉ > 1 ngày → reset streak về 1
    newStreak = 1;
  }

  await updateDoc(ref, {
    lastStudyDate: today,
    streak: newStreak,
  });
}

// ===== USER WORD STATUS FOR DASHBOARD =====
export type UserWordStatus = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  srLevel: number;
  status: "learning" | "mastered";
};

// Lấy danh sách trạng thái từ vựng đã học của user kèm chi tiết từ vựng
export async function getUserWordStatuses(
  userId: string
): Promise<UserWordStatus[]> {
  const [docs, allVocab] = await Promise.all([
    fetchUserProgressDocs(userId),
    getAllVocabulary(),
  ]);

  const progressData = docs
    .filter((d) => d.id !== "stats")
    .map((d) => ({
      wordId: d.wordId || d.id,
      srLevel: d.srLevel || 0,
      nextReview: d.nextReview || null,
      status: (d.status || "new") as "new" | "learned",
      lastReviewed: d.lastReviewed || null,
    }));

  if (progressData.length === 0) return [];

  const vocabMap = new Map<string, CachedVocabItem>();
  allVocab.forEach((v) => vocabMap.set(v.id, v));

  const result: UserWordStatus[] = [];
  for (const prog of progressData) {
    const wordId = prog.wordId;
    const vocab = vocabMap.get(wordId);
    if (vocab) {
      result.push({
        id: wordId,
        word: vocab.word || "",
        reading: vocab.reading || "",
        meaning: vocab.meaning || "",
        srLevel: prog.srLevel || 0,
        status: prog.srLevel >= 3 ? "mastered" : "learning",
      });
    }
  }

  return result;
}