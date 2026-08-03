// src/lib/leaderboard.ts
// Leaderboard dùng denormalized collection /leaderboard/{uid}
// Mỗi user có 1 document, được cập nhật sau mỗi buổi học.
// Đọc leaderboard = đọc N docs (N user) thay vì N×151 như cũ.

import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";

// ===== TYPES =====
export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  email: string;
  streak: number;
  totalLearned: number;
  xp: number;
  badges: BadgeId[];
  rank: number;
};

export type BadgeId =
  | "first_word"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "words_10"
  | "words_50"
  | "words_100"
  | "words_200"
  | "words_500"
  | "master_100";

export type Badge = {
  id: BadgeId;
  emoji: string;
  name: string;
  description: string;
  color: string;
  bg: string;
};

// ===== BADGE DEFINITIONS =====
export const BADGES: Record<BadgeId, Badge> = {
  first_word: {
    id: "first_word",
    emoji: "🌱",
    name: "Khởi Đầu",
    description: "Học từ đầu tiên",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
  },
  streak_3: {
    id: "streak_3",
    emoji: "🔥",
    name: "Lửa Nhỏ",
    description: "Streak 3 ngày liên tiếp",
    color: "#f97316",
    bg: "rgba(249,115,22,0.15)",
  },
  streak_7: {
    id: "streak_7",
    emoji: "⚡",
    name: "Điện Xẹt",
    description: "Streak 7 ngày liên tiếp",
    color: "#eab308",
    bg: "rgba(234,179,8,0.15)",
  },
  streak_30: {
    id: "streak_30",
    emoji: "👑",
    name: "Nhất Quyết",
    description: "Streak 30 ngày liên tiếp",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.15)",
  },
  words_10: {
    id: "words_10",
    emoji: "📖",
    name: "Học Trò",
    description: "Học được 10 từ",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
  },
  words_50: {
    id: "words_50",
    emoji: "📚",
    name: "Ham Học",
    description: "Học được 50 từ",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.15)",
  },
  words_100: {
    id: "words_100",
    emoji: "🏆",
    name: "Bách Từ",
    description: "Học được 100 từ",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
  },
  words_200: {
    id: "words_200",
    emoji: "🎌",
    name: "N5 Thủ",
    description: "Học được 200 từ",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
  },
  words_500: {
    id: "words_500",
    emoji: "🗾",
    name: "Nihongo Pro",
    description: "Học được 500 từ",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.15)",
  },
  master_100: {
    id: "master_100",
    emoji: "✨",
    name: "Thiên Tài",
    description: "100 từ ở mức nhớ cao nhất (Mức 5)",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.15)",
  },
};

// ===== XP CALCULATION =====
export function calcXP(totalLearned: number, streak: number): number {
  return totalLearned * 10 + streak * 50;
}

// ===== BADGE UNLOCK =====
export function getEarnedBadges(
  totalLearned: number,
  streak: number,
  masteredCount: number
): BadgeId[] {
  const earned: BadgeId[] = [];
  if (totalLearned >= 1) earned.push("first_word");
  if (streak >= 3) earned.push("streak_3");
  if (streak >= 7) earned.push("streak_7");
  if (streak >= 30) earned.push("streak_30");
  if (totalLearned >= 10) earned.push("words_10");
  if (totalLearned >= 50) earned.push("words_50");
  if (totalLearned >= 100) earned.push("words_100");
  if (totalLearned >= 200) earned.push("words_200");
  if (totalLearned >= 500) earned.push("words_500");
  if (masteredCount >= 100) earned.push("master_100");
  return earned;
}

// ===== PUSH USER SNAPSHOT → /leaderboard/{uid} =====
// Gọi sau updateProgress() để cập nhật denormalized leaderboard.
// Chi phí: 1 write duy nhất, không đọc thêm gì.
export async function pushLeaderboardSnapshot(params: {
  uid: string;
  displayName: string;
  email: string;
  totalLearned: number;
  streak: number;
  masteredCount: number;
}): Promise<void> {
  const { uid, displayName, email, totalLearned, streak, masteredCount } = params;
  const xp = calcXP(totalLearned, streak);
  const badges = getEarnedBadges(totalLearned, streak, masteredCount);

  try {
    await setDoc(
      doc(db, "leaderboard", uid),
      {
        uid,
        displayName: displayName || email.split("@")[0] || "Ẩn danh",
        email,
        totalLearned,
        streak,
        masteredCount,
        xp,
        badges,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Không crash app nếu leaderboard update lỗi
  }
}

// ===== FETCH LEADERBOARD =====
// Chỉ đọc collection /leaderboard — mỗi user 1 doc.
// Tổng reads = số user (thường < 100), không phụ thuộc số từ đã học.
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, "leaderboard"));

  const entries: LeaderboardEntry[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid || d.id,
      displayName: data.displayName || "Ẩn danh",
      email: data.email || "",
      streak: data.streak || 0,
      totalLearned: data.totalLearned || 0,
      xp: data.xp || 0,
      badges: (data.badges as BadgeId[]) || [],
      rank: 0,
    };
  });

  // Sắp xếp theo XP giảm dần, gán rank
  entries.sort((a, b) => b.xp - a.xp);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}
