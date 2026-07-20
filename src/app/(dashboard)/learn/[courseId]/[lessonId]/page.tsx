"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import StudySession from "@/components/learn/StudySession";
import { getLearnedOnlyWordIds } from "@/lib/progress";

type Vocabulary = {
  id: string;
  word: string;
  reading: string;
  type: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  level: string;
  courseId?: string;
  courseName?: string;
  lessonId?: string;
  lessonTitle?: string;
};

// Khoá học N5 dùng random, các khoá khác theo thứ tự
const RANDOM_COURSES = ["ID_n5_vocab"];

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Array.isArray(params?.courseId) ? params?.courseId[0] || "" : params?.courseId || "";
  const lessonId = Array.isArray(params?.lessonId) ? params?.lessonId[0] || "" : params?.lessonId || "";
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [learnedWordIds, setLearnedWordIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUserEmail(user.email || "");

      if (!courseId || !lessonId) return;

      try {
        // Load từ vựng của bài học và progress song song
        const [snap, learnedIds] = await Promise.all([
          getDocs(
            query(
              collection(db, "vocabulary"),
              where("courseId", "==", courseId),
              where("lessonId", "==", lessonId)
            )
          ),
          getLearnedOnlyWordIds(user.uid),
        ]);

        if (snap.empty) {
          setNotFound(true);
          return;
        }

        const dataWords: Vocabulary[] = [];
        let firstLessonTitle = "";

        snap.docs.forEach((doc) => {
          const data = doc.data() as Omit<Vocabulary, "id">;
          dataWords.push({ id: doc.id, ...data });
          if (!firstLessonTitle) firstLessonTitle = data.lessonTitle || lessonId;
        });

        setWords(dataWords);

        // Chỉ lấy ID của các từ TRONG BÀI HỌC NÀY đã được learned
        const lessonWordIds = new Set(dataWords.map((w) => w.id));
        const learnedInLesson = new Set(
          Array.from(learnedIds).filter((id) => lessonWordIds.has(id))
        );
        setLearnedWordIds(learnedInLesson);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [courseId, lessonId, router]);

  const isRandomOrder = RANDOM_COURSES.includes(courseId);

  return (
    <div className="min-h-[100dvh] bg-page pb-12">
      {/* Chỉ hiển thị Navbar khi đang tải hoặc lỗi */}
      {(loading || notFound) && <Navbar userEmail={userEmail} />}
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Đang nạp từ vựng...</div>
            </div>
          </div>
        ) : notFound ? (
          <div className="card p-10 rounded-3xl text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text)" }}>Bài học không tìm thấy</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Không có từ vựng thuộc khoá học / bài học này.
            </p>
          </div>
        ) : (
          <StudySession
            words={words}
            courseId={courseId}
            learnedWordIds={learnedWordIds}
            isRandomOrder={isRandomOrder}
            totalWordsInLesson={words.length}
          />
        )}
      </div>
    </div>
  );
}
