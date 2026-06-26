// src/lib/progress.ts
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, where
} from "firebase/firestore";

// ===== SPACED REPETITION =====
// Thời gian ôn tập theo từng mức (milliseconds)
export const SR_INTERVALS: Record<number, number> = {
  1: 1 * 60 * 60 * 1000,          // Mức 1 → 1 tiếng
  2: 24 * 60 * 60 * 1000,          // Mức 2 → 1 ngày
  3: 3 * 24 * 60 * 60 * 1000,      // Mức 3 → 3 ngày
  4: 7 * 24 * 60 * 60 * 1000,      // Mức 4 → 1 tuần
  5: 60 * 24 * 60 * 60 * 1000,     // Mức 5 → 2 tháng
};

// Nâng mức sau khi ôn thành công
export async function promoteWord(wordId: string, currentLevel: number) {
  const newLevel = Math.min(currentLevel + 1, 5);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]);
  await updateDoc(doc(db, "vocabulary", wordId), {
    srLevel: newLevel,
    nextReview: nextReview.toISOString(),
    status: "learned",
  });
}

// Giảm mức khi quên
export async function demoteWord(wordId: string, currentLevel: number) {
  const newLevel = Math.max(currentLevel - 1, 1);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]);
  await updateDoc(doc(db, "vocabulary", wordId), {
    srLevel: newLevel,
    nextReview: nextReview.toISOString(),
  });
}

// Đánh dấu từ mới học xong lần đầu → mức 1
export async function markNewWordLearned(wordId: string) {
  const nextReview = new Date(Date.now() + SR_INTERVALS[1]);
  await updateDoc(doc(db, "vocabulary", wordId), {
    srLevel: 1,
    nextReview: nextReview.toISOString(),
    status: "learned",
  });
}

// Lấy số từ ở mỗi mức SR
export async function getSRStats(): Promise<Record<number, number>> {
  const stats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const snap = await getDocs(
    query(collection(db, "vocabulary"), where("status", "==", "learned"))
  );
  snap.forEach((d) => {
    const level = d.data().srLevel || 1;
    if (level >= 1 && level <= 5) stats[level]++;
  });
  return stats;
}

// Lấy từ đến hạn ôn tập
export async function getDueWords(limitCount = 20) {
  const now = new Date().toISOString();
  const snap = await getDocs(
    query(collection(db, "vocabulary"), where("status", "==", "learned"))
  );
  const due = snap.docs
    .filter((d) => {
      const nextReview = d.data().nextReview;
      return !nextReview || nextReview <= now;
    })
    .map((d) => ({ id: d.id, ...d.data() }))
    .slice(0, limitCount);
  return due;
}

// ===== PROGRESS & STREAK =====
function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayString(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return y.toISOString().split("T")[0];
}

export type ProgressData = {
  streak: number;
  lastStudyDate: string;
  totalLearned: number;
  dailyHistory: Record<string, number>;
};

export async function getProgress(userId: string): Promise<ProgressData> {
  const ref = doc(db, "users", userId, "progress", "stats");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const d: ProgressData = {
      streak: 0, lastStudyDate: "",
      totalLearned: 0, dailyHistory: {},
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
  const ref = doc(db, "users", userId, "progress", "stats");
  const current = await getProgress(userId);
  const today = getTodayString();
  const yesterday = getYesterdayString();

  let newStreak = current.streak;
  if (current.lastStudyDate === today) {
    newStreak = current.streak;
  } else if (current.lastStudyDate === yesterday) {
    newStreak = current.streak + 1;
  } else {
    newStreak = 1;
  }

  const todayCount = (current.dailyHistory[today] || 0) + wordsLearned;
  const updated: ProgressData = {
    streak: newStreak,
    lastStudyDate: today,
    totalLearned: current.totalLearned + wordsLearned,
    dailyHistory: { ...current.dailyHistory, [today]: todayCount },
  };
  await updateDoc(ref, updated);
  return updated;
}