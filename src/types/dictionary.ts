// src/types/dictionary.ts

export type PartOfSpeech = "động từ" | "danh từ" | "tính từ" | "trạng từ" | "khác";

export type Definition = {
  meaning: string;
  example?: string;
  exampleMeaning?: string;
};

export type WordMeaning = {
  partOfSpeech: PartOfSpeech;
  definitions: Definition[];
};

// Cấu trúc 1 từ trong từ điển
export type DictionaryWord = {
  id: string;
  word: string;
  reading: string;
  level: string;
  meanings: WordMeaning[];
  difficultyLevel: number; // 1-5
};

// Từ user đã lưu vào kho cá nhân
export type UserWord = {
  id: string;
  userId: string;
  wordId: string;
  word: string;
  reading: string;
  meaning: string;
  status: "learning" | "mastered";
  notes: string;
  createdAt: string;
  reviewCount: number;
};

// Kết quả tìm kiếm
export type SearchResult = {
  words: DictionaryWord[];
  total: number;
};