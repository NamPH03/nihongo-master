// src/components/dictionary/SearchBar.tsx
"use client";

type Props = {
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  loading: boolean;
  placeholder?: string;
};

export default function SearchBar({ query, onChange, onClear, loading, placeholder }: Props) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
        🔍
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Nhập từ tiếng Nhật, hiragana hoặc nghĩa..."}
        className="w-full pl-12 pr-12 py-4 bg-white border-2 border-gray-200 rounded-2xl text-lg focus:outline-none focus:border-red-400 transition"
      />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
          ⏳
        </div>
      )}

      {/* Nút xóa */}
      {query && !loading && (
        <button
          onClick={onClear}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition text-xl"
        >
          ✕
        </button>
      )}
    </div>
  );
}