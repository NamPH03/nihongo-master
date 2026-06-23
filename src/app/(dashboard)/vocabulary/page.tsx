// src/app/(dashboard)/vocabulary/page.tsx
// Trang hiển thị danh sách từ vựng — có thể lọc theo cấp độ

"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Định nghĩa kiểu dữ liệu cho 1 từ vựng
type Vocabulary = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  level: string;
  type: string;
  example: string;
  exampleMeaning: string;
};

// Màu sắc cho từng cấp độ
const levelColors: Record<string, string> = {
  N5: "bg-green-100 text-green-700",
  N4: "bg-blue-100 text-blue-700",
  N3: "bg-yellow-100 text-yellow-700",
  N2: "bg-orange-100 text-orange-700",
  N1: "bg-red-100 text-red-700",
};

export default function VocabularyPage() {
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [filtered, setFiltered] = useState<Vocabulary[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("Tất cả");
  const [selectedType, setSelectedType] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Kiểm tra đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  // Lấy dữ liệu từ Firebase
  useEffect(() => {
    const fetchWords = async () => {
      try {
        const q = query(
          collection(db, "vocabulary"),
          orderBy("level")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Vocabulary[];
        setWords(data);
        setFiltered(data);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, []);

  // Lọc từ vựng khi thay đổi bộ lọc
  useEffect(() => {
    let result = words;

    if (selectedLevel !== "Tất cả") {
      result = result.filter((w) => w.level === selectedLevel);
    }
    if (selectedType !== "Tất cả") {
      result = result.filter((w) => w.type === selectedType);
    }
    if (search) {
      result = result.filter(
        (w) =>
          w.word.includes(search) ||
          w.reading.includes(search) ||
          w.meaning.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFiltered(result);
  }, [selectedLevel, selectedType, search, words]);

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Thanh menu */}
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎌</span>
          <span className="text-xl font-bold text-red-600">Nihongo Master</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Về Dashboard
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Tiêu đề */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📚 Từ vựng</h1>
          <p className="text-gray-500 mt-1">
            {filtered.length} từ vựng
            {selectedLevel !== "Tất cả" ? ` cấp độ ${selectedLevel}` : " tất cả cấp độ"}
          </p>
        </div>

        {/* Bộ lọc */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 flex flex-wrap gap-4">

          {/* Tìm kiếm */}
          <input
            type="text"
            placeholder="🔍 Tìm từ vựng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          {/* Lọc theo cấp độ */}
          <div className="flex gap-2 flex-wrap">
            {["Tất cả", "N5", "N4", "N3", "N2", "N1"].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-4 py-2 rounded-xl font-medium transition text-sm ${
                  selectedLevel === level
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Lọc theo loại từ */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
          >
            {["Tất cả", "động từ", "tính từ", "danh từ", "đại từ"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

        </div>

        {/* Danh sách từ vựng */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-4">⏳</div>
            <p>Đang tải từ vựng...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-4">🔍</div>
            <p>Không tìm thấy từ vựng nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((word) => (
              <div
                key={word.id}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition"
              >
                {/* Hàng trên: từ + badge cấp độ */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">
                      {word.word}
                    </div>
                    <div className="text-red-500 font-medium mt-1">
                      {word.reading}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${levelColors[word.level] || "bg-gray-100 text-gray-600"}`}>
                    {word.level}
                  </span>
                </div>

                {/* Nghĩa */}
                <div className="text-gray-700 font-medium mb-3">
                  {word.meaning}
                </div>

                {/* Loại từ */}
                <div className="text-xs text-gray-400 mb-3">
                  [{word.type}]
                </div>

                {/* Câu ví dụ */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-sm text-gray-700">{word.example}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {word.exampleMeaning}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}