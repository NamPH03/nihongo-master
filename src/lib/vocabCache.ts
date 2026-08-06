// src/lib/vocabCache.ts
// Client-side localStorage cache cho vocabulary collection
// Version-check: thay vì hết hạn theo thời gian (TTL), cache chỉ bị coi là "cũ"
// khi document meta/vocabVersion trên Firestore đổi giá trị. Vocab hầu như không
// đổi (chỉ đổi khi import file hoặc tự thêm từ mới qua tra từ điển), nên cache
// gần như tồn tại vĩnh viễn — mỗi lần mở app chỉ tốn 1 read nhẹ để so version,
// thay vì đọc lại toàn bộ collection (có thể hàng nghìn document).

import { getDocs, getDoc, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

<<<<<<< HEAD
const CACHE_KEY = "vocab_cache_v5";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 tiếng
=======
const CACHE_KEY = "vocab_cache_v6";
const VERSION_DOC_PATH = ["meta", "vocabVersion"] as const;
>>>>>>> f5925cc (update vocab: version-check cache thay TTL)

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
  version: number;
  data: CachedVocabItem[];
};

function readCache(): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage có thể đầy — bỏ qua, không crash app
  }
}

export function invalidateVocabCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

async function fetchRemoteVersion(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, ...VERSION_DOC_PATH));
    if (!snap.exists()) return 0;
    return Number(snap.data().version) || 0;
  } catch {
    // Nếu không đọc được version (lỗi mạng, chưa tạo doc...) → coi như 0,
    // sẽ ưu tiên cache cũ nếu có, tránh crash app.
    return 0;
  }
}

/**
 * Lấy toàn bộ vocabulary — ưu tiên cache localStorage.
 * Chỉ đọc lại toàn bộ Firestore khi:
 *  - Chưa có cache, hoặc
 *  - Version trên Firestore (meta/vocabVersion) khác version đã cache
 *    (nghĩa là vừa import file mới hoặc vừa tự thêm từ qua tra từ điển).
 * Mỗi lần gọi vẫn tốn 1 read nhẹ để kiểm tra version — chi phí không đáng kể
 * so với đọc cả collection.
 */
export async function getAllVocabulary(): Promise<CachedVocabItem[]> {
  const cached = readCache();
  const remoteVersion = await fetchRemoteVersion();

  if (cached && cached.version === remoteVersion) {
    return cached.data;
  }

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

  writeCache({ version: remoteVersion, data });
  return data;
}
