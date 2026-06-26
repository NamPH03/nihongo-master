// src/hooks/useDictionary.ts
// Tìm kiếm trực tiếp từ Firebase — không cần API route

"use client";

import { useState, useCallback, useRef } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DictionaryWord } from "@/types/dictionary";

type SearchState = {
  results: DictionaryWord[];
  loading: boolean;
  error: string | null;
  query: string;
  hasSearched: boolean;
};

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
      setState((prev) => ({
        ...prev,
        results: [],
        hasSearched: false,
        error: null,
      }));
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const q = searchQuery.trim();
        const vocabRef = collection(db, "vocabulary");
        const seen = new Set<string>();
        const results: DictionaryWord[] = [];

        // Tìm theo từ (word)
        const wordQuery = query(
          vocabRef,
          where("word", ">=", q),
          where("word", "<=", q + "\uf8ff"),
          limit(10)
        );

        // Tìm theo cách đọc (reading)
        const readingQuery = query(
          vocabRef,
          where("reading", ">=", q),
          where("reading", "<=", q + "\uf8ff"),
          limit(10)
        );

        // Tìm theo nghĩa (meaning)
        const meaningQuery = query(
          vocabRef,
          where("meaning", ">=", q),
          where("meaning", "<=", q + "\uf8ff"),
          limit(10)
        );

        const [wordSnap, readingSnap, meaningSnap] = await Promise.all([
          getDocs(wordQuery),
          getDocs(readingQuery),
          getDocs(meaningQuery),
        ]);

        // Gộp kết quả, loại trùng
        [...wordSnap.docs, ...readingSnap.docs, ...meaningSnap.docs].forEach((doc) => {
          if (seen.has(doc.id)) return;
          seen.add(doc.id);

          const data = doc.data();
          results.push({
            id: doc.id,
            word: data.word || "",
            reading: data.reading || "",
            level: data.level || "N5",
            difficultyLevel: getLevelNumber(data.level),
            meanings: [{
              partOfSpeech: data.type || "danh từ",
              definitions: [{
                meaning: data.meaning || "",
                example: data.example || "",
                exampleMeaning: data.exampleMeaning || "",
              }],
            }],
          });
        });

        setState((prev) => ({
          ...prev,
          results,
          loading: false,
          hasSearched: true,
        }));

      } catch (error) {
        console.error("Search error:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Có lỗi xảy ra khi tìm kiếm",
          hasSearched: true,
        }));
      }
    }, 400);
  }, []);

  const clearSearch = useCallback(() => {
    setState({
      results: [],
      loading: false,
      error: null,
      query: "",
      hasSearched: false,
    });
  }, []);

  return { ...state, search, clearSearch };
}

function getLevelNumber(level: string): number {
  const map: Record<string, number> = {
    N5: 1, N4: 2, N3: 3, N2: 4, N1: 5,
  };
  return map[level] || 1;
}