"use client";

import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/dictionary/SearchBar";
import WordDetail from "@/components/dictionary/WordDetail";
import VocabularyList from "@/components/dictionary/VocabularyList";
import { useDictionary } from "@/hooks/useDictionary";
import Navbar from "@/components/ui/Navbar";

type Tab = "search" | "saved";

export default function DictionaryPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [dictionaryLanguage, setDictionaryLanguage] = useState<"vi" | "en">("vi");
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const previousLanguage = useRef<"vi" | "en">("vi");
  const { results, loading, error, query, hasSearched, search, clearSearch } = useDictionary(dictionaryLanguage);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && process.env.NODE_ENV === "production") router.replace("/login");
      else if (user) setUserEmail(user.email || "");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (previousLanguage.current !== dictionaryLanguage) {
      previousLanguage.current = dictionaryLanguage;
      if (query.trim()) search(query);
      else clearSearch();
    }
  }, [dictionaryLanguage, query, search, clearSearch]);

  return (
    <div className="min-h-[100dvh] bg-page">
      <Navbar userEmail={userEmail} showBackToDashboard />

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Từ điển</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Tra cứu trong kho từ, hoặc tìm qua API bên ngoài
          </p>
        </div>

        {/* Language selector + tabs */}
        <div className="card p-4 mb-5 flex flex-col gap-3 animate-fade-up">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium min-w-max" style={{ color: "var(--text-muted)" }}>
              Ngôn ngữ nghĩa:
            </label>
            <select
              value={dictionaryLanguage}
              onChange={(e) => setDictionaryLanguage(e.target.value as "vi" | "en")}
              className="input flex-1"
              style={{ padding: "0.5rem 0.75rem" }}
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>

          <div className="flex gap-2">
            {(["search", "saved"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-spring"
                style={
                  tab === t
                    ? { background: "var(--primary)", color: "#0d1f14" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)" }
                }
              >
                {t === "search" ? "🔍 Tra từ" : "📌 Kho từ của tôi"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Search */}
        {tab === "search" && (
          <div className="animate-fade-up">
            <SearchBar
              query={query} onChange={search} onClear={clearSearch} loading={loading}
              placeholder={dictionaryLanguage === "vi"
                ? "Nhập từ tiếng Nhật, tiếng Việt hoặc hiragana..."
                : "Enter Japanese, English or hiragana..."}
            />

            <div className="mt-4 space-y-3">
              {error && (
                <div className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                  {error}
                </div>
              )}

              {!hasSearched && !loading && (
                <div className="text-center py-16 animate-fade-in">
                  <div className="text-5xl mb-3">🔍</div>
                  <p style={{ color: "var(--text-muted)" }}>Nhập từ để tra cứu</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-faint)" }}>
                    Ví dụ: 食べる · たべる · ăn · eat
                  </p>
                </div>
              )}

              {hasSearched && results.length === 0 && !loading && (
                <div className="text-center py-16 animate-fade-in">
                  <div className="text-5xl mb-3">😕</div>
                  <p style={{ color: "var(--text-muted)" }}>
                    Không tìm thấy từ <strong>&quot;{query}&quot;</strong>
                  </p>
                </div>
              )}

              {results.map((word) => (
                <WordDetail key={word.id} word={word} />
              ))}
            </div>
          </div>
        )}

        {/* Tab: Saved */}
        {tab === "saved" && <VocabularyList />}
      </div>
    </div>
  );
}