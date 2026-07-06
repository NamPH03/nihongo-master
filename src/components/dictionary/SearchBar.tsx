// src/components/dictionary/SearchBar.tsx
"use client";

import { Edit3 } from "lucide-react";

type Props = {
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  loading: boolean;
  placeholder?: string;
  showHandwriting: boolean;
  onToggleHandwriting: () => void;
};

export default function SearchBar({
  query,
  onChange,
  onClear,
  loading,
  placeholder,
  showHandwriting,
  onToggleHandwriting,
}: Props) {
  return (
    <div className="relative flex gap-2 items-center">
      <div className="relative flex-1">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "var(--text-faint)" }}>
          🔍
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Nhập từ tiếng Nhật, hiragana hoặc nghĩa..."}
          className="input pl-11 pr-11 py-4 text-base rounded-2xl"
          style={{ fontSize: "1rem" }}
        />

        {/* Loading */}
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* Clear button */}
        {query && !loading && (
          <button
            onClick={onClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all duration-150"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Handwriting toggle button */}
      <button
        onClick={onToggleHandwriting}
        title="Vẽ tay để tra cứu"
        className="p-3.5 rounded-2xl flex items-center justify-center border transition-all duration-200 active:scale-95 flex-shrink-0"
        style={{
          background: showHandwriting ? "var(--primary)" : "var(--surface)",
          borderColor: showHandwriting ? "var(--primary)" : "var(--border-strong)",
          color: showHandwriting ? "#0d1f14" : "var(--text)",
        }}
      >
        <Edit3 className="w-5 h-5" />
      </button>
    </div>
  );
}