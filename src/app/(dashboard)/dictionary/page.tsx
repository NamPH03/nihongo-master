// src/app/(dashboard)/dictionary/page.tsx
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/dictionary/SearchBar";
import WordDetail from "@/components/dictionary/WordDetail";
import VocabularyList from "@/components/dictionary/VocabularyList";
import HandwritingCanvas from "@/components/dictionary/HandwritingCanvas";
import { useDictionary } from "@/hooks/useDictionary";
import Navbar from "@/components/ui/Navbar";

type Tab = "search" | "saved";

export default function DictionaryPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [userEmail, setUserEmail] = useState("");
  const [showHandwriting, setShowHandwriting] = useState(false);
  const router = useRouter();

  // Hook mới — không cần language param
  const { results, loading, error, query, hasSearched, search, clearSearch } = useDictionary();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) window.location.replace("/login");
      else setUserEmail(user.email || "");
    });
    return () => unsubscribe();
  }, [router]);

  const handleSelectHandwritingChar = (char: string) => {
    search(query + char);
  };

  return (
    <div className="min-h-[100dvh] bg-page font-sans">
      <Navbar userEmail={userEmail} />

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-5 animate-fade-up">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Từ điển</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Tra từ tiếng Nhật, Hiragana, Romaji hoặc tiếng Việt
          </p>
        </div>

        {/* Tabs */}
        <div className="card p-1.5 mb-5 flex gap-1.5 animate-fade-up rounded-2xl">
          {(["search", "saved"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={
                tab === t
                  ? { background: "var(--primary)", color: "#0d1f14" }
                  : { color: "var(--text-muted)" }
              }
            >
              {t === "search" ? "🔍 Tra từ" : "📚 Kho từ của tôi"}
            </button>
          ))}
        </div>

        {/* Tab: Search */}
        {tab === "search" && (
          <div className="animate-fade-up flex flex-col gap-4">
            <SearchBar
              query={query}
              onChange={search}
              onClear={clearSearch}
              loading={loading}
              showHandwriting={showHandwriting}
              onToggleHandwriting={() => setShowHandwriting(!showHandwriting)}
              placeholder="Nhập tiếng Nhật, Hiragana, Romaji hoặc tiếng Việt..."
            />

            {showHandwriting && (
              <div className="animate-scale-in">
                <HandwritingCanvas
                  onSelectWord={handleSelectHandwritingChar}
                  onClose={() => setShowHandwriting(false)}
                />
              </div>
            )}

            <div className="space-y-3">
              {error && (
                <div className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)" }}>
                  {error}
                </div>
              )}

              {!hasSearched && !loading && (
                <div className="text-center py-16 animate-fade-in">
                  <div className="text-5xl mb-4">🔍</div>
                  <p className="font-medium" style={{ color: "var(--text-muted)" }}>Nhập từ để tra cứu</p>
                  <p className="text-sm mt-2" style={{ color: "var(--text-faint)" }}>
                    Ví dụ: <span className="font-jp">食べる</span> · たべる · taberu · ăn
                  </p>
                  <p className="text-[11px] mt-4 max-w-xs mx-auto" style={{ color: "var(--text-faint)" }}>
                    Tìm kiếm ưu tiên từ vựng trong kho từ (có nghĩa tiếng Việt chuẩn), sau đó mở rộng ra Jisho
                  </p>
                </div>
              )}

              {hasSearched && results.length === 0 && !loading && (
                <div className="text-center py-16 animate-fade-in">
                  <div className="text-5xl mb-3">😕</div>
                  <p style={{ color: "var(--text-muted)" }}>
                    Không tìm thấy <strong>&quot;{query}&quot;</strong>
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-faint)" }}>
                    Thử tìm bằng tiếng Nhật hoặc romaji để có kết quả tốt hơn
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