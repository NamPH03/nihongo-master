// src/app/(dashboard)/dictionary/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchBar from "@/components/dictionary/SearchBar";
import WordDetail from "@/components/dictionary/WordDetail";
import VocabularyList from "@/components/dictionary/VocabularyList";
import { useDictionary } from "@/hooks/useDictionary";

type Tab = "search" | "saved";

export default function DictionaryPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [dictionaryLanguage, setDictionaryLanguage] = useState<"vi" | "en">("vi");
  const router = useRouter();
  const previousLanguage = useRef<"vi" | "en">("vi");
  const { results, loading, error, query, hasSearched, search, clearSearch } = useDictionary(dictionaryLanguage);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && process.env.NODE_ENV === "production") {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (previousLanguage.current !== dictionaryLanguage) {
      previousLanguage.current = dictionaryLanguage;
      if (query.trim()) {
        search(query);
      } else {
        clearSearch();
      }
    }
  }, [dictionaryLanguage, query, search, clearSearch]);

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Menu */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </Link>
        <Link href="/dashboard" className="text-gray-500 text-sm hover:text-gray-700">
          ← Dashboard
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Tiêu đề */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">📖 Từ điển</h1>
        <p className="text-sm text-gray-500 mb-4">
          Tìm trong từ vựng của bạn trước; nếu không có, hệ thống sẽ tra từ bên ngoài qua API.
        </p>

        <div className="mb-5 bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ngôn ngữ hiển thị nghĩa
          </label>
          <select
            value={dictionaryLanguage}
            onChange={(e) => setDictionaryLanguage(e.target.value as "vi" | "en")}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">Tiếng Anh</option>
          </select>
        </div>

        {/* Tab */}
        <div className="flex gap-2 mb-5">
          {(["search", "saved"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl font-medium transition ${
                tab === t
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "search" ? "🔍 Tra từ" : "📌 Kho từ của tôi"}
            </button>
          ))}
        </div>

        {/* ===== TAB TRA TỪ ===== */}
        {tab === "search" && (
          <div>
            <SearchBar
              query={query}
              onChange={search}
              onClear={clearSearch}
              loading={loading}
              placeholder={dictionaryLanguage === "vi" ? "Nhập từ tiếng Nhật, tiếng Việt hoặc hiragana..." : "Nhập từ tiếng Nhật, tiếng Anh hoặc hiragana..."}
            />

            <div className="mt-4 space-y-4">
              {/* Lỗi */}
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                  ⚠️ {error}
                </div>
              )}

              {/* Chưa tìm gì */}
              {!hasSearched && !loading && (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-5xl mb-3">🔍</div>
                  <p>Nhập từ tiếng Nhật, tiếng Việt hoặc tiếng Anh để tìm</p>
                  <p className="text-sm mt-1">Ví dụ: 食べる, たべる, ăn, eat</p>
                </div>
              )}

              {/* Không có kết quả */}
              {hasSearched && results.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-5xl mb-3">😕</div>
                  <p>Không tìm thấy từ <span className="font-bold">{`"${query}"`}</span></p>
                </div>
              )}

              {/* Kết quả tìm kiếm */}
              {results.map((word) => (
                <WordDetail key={word.id} word={word} />
              ))}
            </div>
          </div>
        )}

        {/* ===== TAB KHO TỪ ===== */}
        {tab === "saved" && <VocabularyList />}

      </div>
    </main>
  );
}