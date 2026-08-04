// src/lib/vocabCache.ts
// Client-side localStorage cache cho vocabulary collection
// TTL = 30 phút — giảm số lần đọc Firestore khi user điều hướng qua lại các trang.
// Dùng localStorage (thay vì sessionStorage) để cache sống sót qua việc đóng/mở lại
// tab hoặc app bị hệ điều hành (đặc biệt iOS) giải phóng khỏi RAM — chỉ hết hạn theo TTL.

import { getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

const CACHE_KEY = "vocab_cache_v5";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 tiếng

export type CachedVocabItem = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  type: string;
  level: string;
  example?: string;
  exampleMeaning?: string;
  courseId?: string;
  lessonId?: string;
  lessonTitle?: string;
  courseName?: string;
  source?: string;
};

type CacheEntry = {
  ts: number;
  data: CachedVocabItem[];
};

function readCache(): CachedVocabItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(data: CachedVocabItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage có thể đầy — bỏ qua, không crash app
  }
}

export function invalidateVocabCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Lấy toàn bộ vocabulary — ưu tiên cache localStorage (TTL 30 phút).
 * Chỉ gọi Firestore khi cache miss hoặc hết hạn.
 */
export async function getAllVocabulary(): Promise<CachedVocabItem[]> {
  const cached = readCache();
  if (cached) return cached;

  const snap = await getDocs(collection(db, "vocabulary"));
  const data: CachedVocabItem[] = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      word: v.word || "",
      reading: v.reading || "",
      meaning: v.meaning || "",
      type: v.type || "",
      level: v.level || "N5",
      example: v.example || "",
      exampleMeaning: v.exampleMeaning || "",
      courseId: v.courseId || "",
      lessonId: v.lessonId || "",
      lessonTitle: v.lessonTitle || "",
      courseName: v.courseName || "",
      source: v.source || "",
    };
  });

  writeCache(data);
  return data;
}
