// src/lib/progress.ts
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, where, addDoc
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
export async function promoteWord(userId: string, wordId: string, currentLevel: number) {
  const newLevel = Math.min(currentLevel + 1, 5);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]);
  await setDoc(doc(db, "users", userId, "progress", wordId), {
    srLevel: newLevel,
    nextReview: nextReview.toISOString(),
    status: "learned",
  }, { merge: true });
  await updateUserWordLevel(userId, wordId, newLevel);
}

// Giảm mức khi quên
export async function demoteWord(userId: string, wordId: string, currentLevel: number) {
  const newLevel = Math.max(currentLevel - 1, 1);
  const nextReview = new Date(Date.now() + SR_INTERVALS[newLevel]);
  await setDoc(doc(db, "users", userId, "progress", wordId), {
    srLevel: newLevel,
    nextReview: nextReview.toISOString(),
  }, { merge: true });
  await updateUserWordLevel(userId, wordId, newLevel);
}

// Đánh dấu từ mới học xong lần đầu → mức 1
export async function markNewWordLearned(userId: string, wordId: string) {
  const nextReview = new Date(Date.now() + SR_INTERVALS[1]);
  await setDoc(doc(db, "users", userId, "progress", wordId), {
    srLevel: 1,
    nextReview: nextReview.toISOString(),
    status: "learned",
  }, { merge: true });
  await updateUserWordLevel(userId, wordId, 1);
}

export async function getLearnedWordIds(userId: string): Promise<Set<string>> {
  const snap = await getDocs(query(collection(db, "users", userId, "progress")));
  return new Set(snap.docs.filter((d) => d.id !== "stats").map((d) => d.id));
}

// Lấy số từ ở mỗi mức SR
export async function getSRStats(userId: string): Promise<Record<number, number>> {
  const stats: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const snap = await getDocs(query(collection(db, "users", userId, "progress")));
  snap.forEach((d) => {
    if (d.id === "stats") return;
    const level = Number(d.data().srLevel || 1);
    if (level >= 1 && level <= 5) stats[level]++;
  });
  return stats;
}

export type DueWordProgress = {
  id: string;
  srLevel?: number;
  nextReview?: string;
  [key: string]: unknown;
};

export type UserWordStatus = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  srLevel: number;
  status: "learning" | "mastered";
};

// Lấy từ đến hạn ôn tập
export async function getDueWords(userId: string, limitCount = 20): Promise<DueWordProgress[]> {
  const now = new Date().toISOString();
  const snap = await getDocs(
    query(collection(db, "users", userId, "progress"))
  );
  const due = snap.docs
    .filter((d) => d.id !== "stats")
    .filter((d) => {
      const data = d.data();
      const nextReview = data.nextReview;
      return !nextReview || nextReview <= now;
    })
    .map((d) => ({ id: d.id, ...d.data() } as DueWordProgress))
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

export async function upsertUserWord(
  userId: string,
  payload: {
    wordId: string;
    word: string;
    reading: string;
    meaning: string;
    srLevel?: number;
    status?: "learning" | "mastered";
  }
) {
  const existing = await getDocs(
    query(collection(db, "userWords"), where("userId", "==", userId), where("wordId", "==", payload.wordId))
  );

  const srLevel = payload.srLevel ?? 1;
  const status = payload.status ?? (srLevel >= 3 ? "mastered" : "learning");
  const data = {
    userId,
    wordId: payload.wordId,
    word: payload.word,
    reading: payload.reading,
    meaning: payload.meaning,
    srLevel,
    status,
    notes: "",
    createdAt: new Date().toISOString(),
    reviewCount: 0,
  };

  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, data);
    return existing.docs[0].id;
  }

  const ref = await addDoc(collection(db, "userWords"), data);
  return ref.id;
}

export async function updateUserWordLevel(userId: string, wordId: string, srLevel: number) {
  const existing = await getDocs(
    query(collection(db, "userWords"), where("userId", "==", userId), where("wordId", "==", wordId))
  );

  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, {
      srLevel,
      status: srLevel >= 3 ? "mastered" : "learning",
    });
  }
}

export async function getUserWordStatuses(userId: string): Promise<UserWordStatus[]> {
  const snap = await getDocs(query(collection(db, "userWords"), where("userId", "==", userId)));
  return snap.docs.map((d) => ({
    id: d.id,
    word: d.data().word || "",
    reading: d.data().reading || "",
    meaning: d.data().meaning || "",
    srLevel: Number(d.data().srLevel ?? 1),
    status: d.data().status === "mastered" ? "mastered" : "learning",
  }));
}

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