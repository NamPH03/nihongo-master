// src/lib/progress.ts
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs
} from "firebase/firestore";

// ===== SPACED REPETITION INTERVALS =====
export const SR_INTERVALS: Record<number, number> = {
  1: 1 * 60 * 60 * 1000,           // Mức 1 → 1 tiếng
  2: 24 * 60 * 60 * 1000,           // Mức 2 → 1 ngày
  3: 3 * 24 * 60 * 60 * 1000,       // Mức 3 → 3 ngày
  4: 7 * 24 * 60 * 60 * 1000,       // Mức 4 → 1 tuần
  5: 60 * 24 * 60 * 60 * 1000,      // Mức 5 → 2 tháng
};

// ===== TYPES =====
export type WordProgress = {
  wordId: string;
  srLevel: number;
  nextReview: string | null;
  status: "new" | "learned";
  lastReviewed: string | null;
};

export type DueWordProgress = WordProgress & {
  id: string;
};

export type ProgressData = {
  streak: number;
  lastStudyDate: string;
  totalLearned: number;
  dailyHistory: Record<string, number>;
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

// ===== WORD PROGRESS =====

// Lưu từ mới từ từ điển vào lịch học (status: "new")
export async function saveWordToSchedule(
  userId: string,
  wordId: string
): Promise<void> {
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: 0,
    nextReview: null,
    status: "new",
    lastReviewed: null,
  }, { merge: true });
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
}

// Nâng mức sau khi ôn thành công
export async function promoteWord(
  userId: string,
  wordId: string,
  currentLevel: number
): Promise<void> {
  const newLevel = Math.min(currentLevel + 1, 5);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]).toISOString();
  await setDoc(wordProgressRef(userId, wordId), {
    wordId,
    srLevel: newLevel,
    nextReview,
    status: "learned",
    lastReviewed: new Date().toISOString(),
  }, { merge: true });
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
  }, { merge: true });
}

// ===== QUERIES =====

// Lấy tất cả wordId đã có trong progress (trừ "stats") — bao gồm cả "new"
export async function getLearnedWordIds(userId: string): Promise<Set<string>> {
  const snap = await getDocs(userProgressCollection(userId));
  return new Set(
    snap.docs
      .filter((d) => d.id !== "stats")
      .map((d) => d.id)
  );
}

// Chỉ lấy wordId có status = "learned" (đã hoàn thành buổi học lần đầu)
export async function getLearnedOnlyWordIds(userId: string): Promise<Set<string>> {
  const snap = await getDocs(userProgressCollection(userId));
  return new Set(
    snap.docs
      .filter((d) => d.id !== "stats" && d.data().status === "learned")
      .map((d) => d.id)
  );
}

// Lấy wordId có status "new" (lưu từ dictionary chưa học)
export async function getNewSavedWordIds(userId: string): Promise<Set<string>> {
  const snap = await getDocs(userProgressCollection(userId));
  return new Set(
    snap.docs
      .filter((d) => d.id !== "stats" && d.data().status === "new")
      .map((d) => d.id)
  );
}

// Lấy số từ ở mỗi mức SR
export async function getSRStats(
  userId: string
): Promise<Record<number, number>> {
  const stats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const snap = await getDocs(userProgressCollection(userId));
  snap.forEach((d) => {
    if (d.id === "stats") return;
    const level = Number(d.data().srLevel || 0);
    if (level >= 1 && level <= 5) stats[level]++;
  });
  return stats;
}

// Lấy từ đến hạn ôn tập
export async function getDueWords(
  userId: string,
  limitCount = 20
): Promise<DueWordProgress[]> {
  const now = new Date().toISOString();
  const snap = await getDocs(userProgressCollection(userId));

  return snap.docs
    .filter((d) => {
      if (d.id === "stats") return false;
      const data = d.data();
      if (data.status !== "learned") return false;
      const nextReview = data.nextReview;
      return !nextReview || nextReview <= now;
    })
    .map((d) => ({ id: d.id, ...d.data() } as DueWordProgress))
    .slice(0, limitCount);
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
  return snap.data() as ProgressData;
}

export async function updateProgress(
  userId: string,
  wordsLearned: number
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
  return updated;
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
  const progressSnap = await getDocs(userProgressCollection(userId));
  const progressData = progressSnap.docs
    .filter((d) => d.id !== "stats")
    .map((d) => {
      const data = d.data();
      return {
        wordId: data.wordId || d.id,
        srLevel: data.srLevel || 0,
        nextReview: data.nextReview || null,
        status: data.status || "new",
        lastReviewed: data.lastReviewed || null,
      } as WordProgress;
    });

  if (progressData.length === 0) return [];

  // Lấy toàn bộ từ vựng để map thông tin (word, reading, meaning)
  const vocabSnap = await getDocs(collection(db, "vocabulary"));
  const vocabMap = new Map<string, { word?: string; reading?: string; meaning?: string }>();
  vocabSnap.forEach((doc) => {
    vocabMap.set(doc.id, doc.data());
  });

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