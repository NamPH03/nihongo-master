// src/hooks/useDictionary.ts
// Tìm kiếm từ vựng nội bộ trước, nếu không có thì mở rộng bằng API từ điển bên ngoài

"use client";

import { useState, useCallback, useRef } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DictionaryWord } from "@/types/dictionary";

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

async function searchLocalVocabulary(q: string, language: "vi" | "en"): Promise<DictionaryWord[]> {
  const vocabRef = collection(db, "vocabulary");
  const seen = new Set<string>();
  const results: DictionaryWord[] = [];

  const wordQuery = query(
    vocabRef,
    where("word", ">=", q),
    where("word", "<=", q + "\uf8ff"),
    limit(10)
  );

  const readingQuery = query(
    vocabRef,
    where("reading", ">=", q),
    where("reading", "<=", q + "\uf8ff"),
    limit(10)
  );

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
      source: "local",
      language: "vi-jp",
      meanings: [{
        partOfSpeech: (data.type || "khác") as DictionaryWord["meanings"][number]["partOfSpeech"],
        definitions: [{
          meaning: language === "en" ? (data.meaningEnglish || data.meaning || "") : (data.meaning || ""),
          example: data.example || "",
          exampleMeaning: data.exampleMeaning || "",
        }],
      }],
    });
  });

  return results;
}

async function searchExternalDictionary(q: string, language: "vi" | "en"): Promise<DictionaryWord[]> {
  const response = await fetch(`/api/dictionary/lookup?word=${encodeURIComponent(q.trim())}&lang=${language}`);
  if (!response.ok) throw new Error("External lookup failed");

  const payload = await response.json();
  const entries: JishoEntry[] = payload?.data || [];

  return entries.slice(0, 5).map((entry, index) => {
    const japanese = entry.japanese?.[0];
    const sense = entry.senses?.[0];
    const word = japanese?.word || japanese?.reading || q.trim();
    const reading = japanese?.reading || "";
    const translatedDefinitions = Array.isArray(sense?.translated_definitions)
      ? sense.translated_definitions.filter(Boolean)
      : [];
    const englishDefinitions = Array.isArray(sense?.english_definitions)
      ? sense.english_definitions.filter(Boolean)
      : [];
    const meaning = language === "en"
      ? (englishDefinitions[0] || "")
      : (translatedDefinitions[0] || englishDefinitions[0] || "");
    const partOfSpeech = (sense?.parts_of_speech?.[0] || "khác") as DictionaryWord["meanings"][number]["partOfSpeech"];

    return {
      id: `${word}-${reading}-${index}`,
      word,
      reading,
      level: "N5",
      difficultyLevel: 1,
      source: "external",
      language: language === "en" ? "en-jp" : "vi-jp",
      meanings: [{
        partOfSpeech,
        definitions: [{ meaning, example: "", exampleMeaning: "" }],
      }],
    };
  });
}

export function useDictionary(language: "vi" | "en" = "vi") {
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
        const [remoteResults, localResults] = await Promise.all([
          searchExternalDictionary(q, language),
          searchLocalVocabulary(q, language),
        ]);

        const mergedResults = [...remoteResults, ...localResults].filter((item, index, array) => {
          const key = `${item.word}-${item.reading}-${item.source}`;
          return array.findIndex((candidate) => `${candidate.word}-${candidate.reading}-${candidate.source}` === key) === index;
        });

        setState((prev) => ({
          ...prev,
          results: mergedResults,
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
  }, [language]);

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