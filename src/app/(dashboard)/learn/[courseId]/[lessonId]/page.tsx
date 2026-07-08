"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import StudySession from "@/components/learn/StudySession";

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

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId || "";
  const lessonId = params?.lessonId || "";
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email || "");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!courseId || !lessonId) return;

    const fetchLessonWords = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "vocabulary"),
            where("courseId", "==", courseId),
            where("lessonId", "==", lessonId)
          )
        );
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

        setLessonTitle(firstLessonTitle);
        setWords(dataWords);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchLessonWords();
  }, [courseId, lessonId]);

  return (
    <div className="min-h-[100dvh] bg-page pb-24 md:pb-10">
      <Navbar userEmail={userEmail} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">Bài học</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>{lessonTitle || lessonId}</h1>
          <div className="flex flex-wrap gap-3 mt-4">
            <a href={`/learn/${encodeURIComponent(courseId)}`} className="btn btn-ghost rounded-2xl py-3">← Bài học</a>
          </div>
        </div>

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
              Không có từ vựng thuộc khoá học / bài học này. Hãy kiểm tra lại giá trị `courseId` và `lessonId`.
            </p>
          </div>
        ) : (
          <StudySession
            words={words}
            courseId={courseId}
          />
        )}
      </div>
    </div>
  );
}
