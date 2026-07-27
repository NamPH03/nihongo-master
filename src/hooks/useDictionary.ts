// src/hooks/useDictionary.ts
// Search flow mới:
// 1. Tìm ngay trong vocabCache (substring, instant, có nghĩa VI chuẩn)
// 2. Song song gọi Jisho API cho kết quả bổ sung (JP/EN/romaji)
// 3. Không còn language toggle — tự động hiển thị VI nếu có, EN nếu không

"use client";

import { useState, useCallback, useRef } from "react";
import type { DictionaryWord } from "@/types/dictionary";
import { getAllVocabulary, type CachedVocabItem } from "@/lib/vocabCache";

type SearchState = {
  results: DictionaryWord[];
  loading: boolean;
  error: string | null;
  query: string;
  hasSearched: boolean;
};

type JishoEntry = {
  japanese?: Array<{ word?: string; reading?: string }>;
  senses?: Array<{
    english_definitions?: string[];
    translated_definitions?: string[];
    parts_of_speech?: string[];
    tags?: string[];
  }>;
};

// ─── Internal: tìm trong vocabCache (substring, O(n), instant) ───
function searchInCache(allVocab: CachedVocabItem[], q: string): DictionaryWord[] {
  const lower = q.toLowerCase().trim();
  const scored: Array<{ item: CachedVocabItem; score: number }> = [];

  for (const v of allVocab) {
    let score = 0;
    if (v.word === q) score += 10;
    else if (v.word.startsWith(q)) score += 7;
    else if (v.word.includes(q)) score += 4;

    if (v.reading === q) score += 8;
    else if (v.reading.startsWith(q)) score += 5;
    else if (v.reading.includes(q)) score += 3;

    const meaningLower = v.meaning.toLowerCase();
    if (meaningLower.startsWith(lower)) score += 6;
    else if (meaningLower.includes(lower)) score += 2;

    if (score > 0) scored.push({ item: v, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map(({ item: v }) => ({
    id: v.id,
    word: v.word,
    reading: v.reading,
    level: v.level || "N5",
    difficultyLevel: getLevelNumber(v.level),
    source: "local",
    language: "vi-jp",
    meanings: [{
      partOfSpeech: (v.type || "khác") as DictionaryWord["meanings"][number]["partOfSpeech"],
      definitions: [{
        meaning: v.meaning || "",
        example: v.example || "",
        exampleMeaning: v.exampleMeaning || "",
      }],
    }],
  }));
}

// ─── External: Jisho API qua proxy route ───
async function searchExternal(q: string): Promise<DictionaryWord[]> {
  const response = await fetch(
    `/api/dictionary/lookup?word=${encodeURIComponent(q.trim())}`
  );
  if (!response.ok) return [];

  const payload = await response.json();
  const entries: JishoEntry[] = payload?.data || [];

  return entries.slice(0, 5).map((entry, index) => {
    const japanese = entry.japanese?.[0];
    const senses = entry.senses || [];
    const word = japanese?.word || japanese?.reading || q.trim();
    const reading = japanese?.reading || "";

    const meanings = senses.slice(0, 3).map((sense) => {
      const defs = sense.translated_definitions?.length
        ? sense.translated_definitions
        : sense.english_definitions || [];
      const partOfSpeech = (sense.parts_of_speech?.[0] || "khác") as DictionaryWord["meanings"][number]["partOfSpeech"];
      return {
        partOfSpeech,
        definitions: defs.slice(0, 2).map((m) => ({ meaning: m, example: "", exampleMeaning: "" })),
      };
    });

    return {
      id: `ext-${word}-${reading}-${index}`,
      word,
      reading,
      level: "N5",
      difficultyLevel: 1,
      source: "external" as const,
      language: "en-jp" as const,
      meanings: meanings.length > 0 ? meanings : [{ partOfSpeech: "khác", definitions: [{ meaning: "", example: "", exampleMeaning: "" }] }],
    };
  });
}

// ─── Hook ───
export function useDictionary() {
  const [state, setState] = useState<SearchState>({
    results: [],
    loading: false,
    error: null,
    query: "",
    hasSearched: false,
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    setState((prev) => ({ ...prev, query: searchQuery }));

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!searchQuery.trim()) {
      setState((prev) => ({ ...prev, results: [], hasSearched: false, error: null }));
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const q = searchQuery.trim();

        // Chạy song song: cache (instant) + Jisho (network)
        const [allVocab, externalResults] = await Promise.all([
          getAllVocabulary(),
          searchExternal(q),
        ]);

        const localResults = searchInCache(allVocab, q);

        // Merge: local lên trước, external bổ sung phía sau (dedup theo word+reading)
        const seen = new Set(localResults.map((r) => `${r.word}|${r.reading}`));
        const merged = [
          ...localResults,
          ...externalResults.filter((r) => !seen.has(`${r.word}|${r.reading}`)),
        ];

        setState((prev) => ({
          ...prev,
          results: merged,
          loading: false,
          hasSearched: true,
        }));
      } catch (err) {
        console.error("Search error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Có lỗi xảy ra khi tìm kiếm",
          hasSearched: true,
        }));
      }
    }, 350);
  }, []);

  const clearSearch = useCallback(() => {
    setState({ results: [], loading: false, error: null, query: "", hasSearched: false });
  }, []);

  return { ...state, search, clearSearch };
}

function getLevelNumber(level: string): number {
  const map: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
  return map[level] || 1;
}