"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";

type LessonSummary = {
  lessonId: string;
  lessonTitle: string;
  wordCount: number;
};

export default function CoursePage() {
  const params = useParams();
  const courseId = Array.isArray(params?.courseId) ? params?.courseId[0] || "" : params?.courseId || "";
  const [courseName, setCourseName] = useState("");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

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
    if (!courseId) return;

    const fetchLessons = async () => {
      try {
        const snap = await getDocs(query(collection(db, "vocabulary"), where("courseId", "==", courseId)));
        if (snap.empty) {
          setNotFound(true);
          return;
        }

        const lessonMap = new Map<string, { title: string; wordCount: number }>();
        let firstName = "";

        snap.docs.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          if (!firstName) {
            firstName = String(data.courseName || courseId);
          }
          const lessonId = String(data.lessonId || "Bài chưa gán").trim();
          const lessonTitle = String(data.lessonTitle || lessonId || "Bài chưa gán").trim();
          if (!lessonMap.has(lessonId)) {
            lessonMap.set(lessonId, { title: lessonTitle, wordCount: 0 });
          }
          lessonMap.get(lessonId)!.wordCount += 1;
        });

        const lessonList: LessonSummary[] = Array.from(lessonMap.entries()).map(([lessonId, item]) => ({
          lessonId,
          lessonTitle: item.title,
          wordCount: item.wordCount,
        }));
        lessonList.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
        setCourseName(firstName);
        setLessons(lessonList);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [courseId]);

  return (
    <div className="min-h-[100dvh] bg-page pb-24 md:pb-10">
      <Navbar userEmail={userEmail} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">Khoá học</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>{courseName || courseId}</h1>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/learn" className="btn btn-ghost rounded-2xl py-3">← Danh sách khoá học</Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải bài học...</div>
            </div>
          </div>
        ) : notFound ? (
          <div className="card p-10 rounded-3xl text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text)" }}>Khoá học không tồn tại</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Không tìm thấy bài học cho khoá học này. Hãy kiểm tra lại đường dẫn hoặc dữ liệu Firestore.
            </p>
            <Link href="/learn" className="btn btn-primary py-3 rounded-2xl">Quay về khoá học</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {lessons.map((lesson) => (
              <Link
                key={lesson.lessonId}
                href={`/learn/${encodeURIComponent(courseId)}/${encodeURIComponent(lesson.lessonId)}`}
                className="card p-6 rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--text)" }}>{lesson.lessonTitle}</h2>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{lesson.wordCount} từ vựng</p>
                  </div>
                  <div className="text-3xl" style={{ color: "var(--primary)" }}>📖</div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-2)] p-3 text-sm" style={{ color: "var(--text)" }}>
                  {lesson.wordCount} từ vựng trong bài
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
