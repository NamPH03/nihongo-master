"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import { getLearnedOnlyWordIds } from "@/lib/progress";

type LessonSummary = {
  lessonId: string;
  lessonTitle: string;
  wordCount: number;
  learnedCount: number;   // Số từ user đã học trong bài này
  wordIds: string[];      // ID các từ trong bài để đối chiếu với progress
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUserEmail(user.email || "");

      if (!courseId) return;

      try {
        // Load từ vựng của khoá học và progress song song
        const [snap, learnedIds] = await Promise.all([
          getDocs(query(collection(db, "vocabulary"), where("courseId", "==", courseId))),
          getLearnedOnlyWordIds(user.uid),
        ]);

        if (snap.empty) {
          setNotFound(true);
          return;
        }

        const lessonMap = new Map<string, { title: string; wordIds: string[] }>();
        let firstName = "";

        snap.docs.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          if (!firstName) firstName = String(data.courseName || courseId);
          const lId = String(data.lessonId || "Bài chưa gán").trim();
          const lTitle = String(data.lessonTitle || lId || "Bài chưa gán").trim();
          if (!lessonMap.has(lId)) {
            lessonMap.set(lId, { title: lTitle, wordIds: [] });
          }
          lessonMap.get(lId)!.wordIds.push(doc.id);
        });

        const lessonList: LessonSummary[] = Array.from(lessonMap.entries()).map(([lId, item]) => {
          const learnedInLesson = item.wordIds.filter((id) => learnedIds.has(id)).length;
          return {
            lessonId: lId,
            lessonTitle: item.title,
            wordCount: item.wordIds.length,
            learnedCount: learnedInLesson,
            wordIds: item.wordIds,
          };
        });

        lessonList.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
        setCourseName(firstName);
        setLessons(lessonList);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [courseId, router]);

  const totalWords    = lessons.reduce((s, l) => s + l.wordCount, 0);
  const totalLearned  = lessons.reduce((s, l) => s + l.learnedCount, 0);
  const completedLessons = lessons.filter((l) => l.learnedCount >= l.wordCount && l.wordCount > 0).length;

  return (
    <div className="min-h-[100dvh] bg-page pb-24 md:pb-10">
      <Navbar userEmail={userEmail} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">Khoá học</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>{courseName || courseId}</h1>

          {/* Tổng tiến độ khoá học */}
          {!loading && totalWords > 0 && (
            <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--surface-2)" }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Tiến độ tổng khoá
                </span>
                <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                  {totalLearned}/{totalWords} từ
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.round((totalLearned / totalWords) * 100)}%`,
                    background: "var(--primary)",
                  }}
                />
              </div>
              <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>✅ {completedLessons}/{lessons.length} bài hoàn thành</span>
                <span>📝 {Math.round((totalLearned / totalWords) * 100)}%</span>
              </div>
            </div>
          )}

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
              Không tìm thấy bài học cho khoá học này.
            </p>
            <Link href="/learn" className="btn btn-primary py-3 rounded-2xl">Quay về khoá học</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {lessons.map((lesson) => {
              const pct = lesson.wordCount > 0 ? Math.round((lesson.learnedCount / lesson.wordCount) * 100) : 0;
              const isDone = lesson.learnedCount >= lesson.wordCount && lesson.wordCount > 0;
              return (
                <Link
                  key={lesson.lessonId}
                  href={`/learn/${encodeURIComponent(courseId)}/${encodeURIComponent(lesson.lessonId)}`}
                  className="card p-6 rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden"
                >
                  {/* Badge hoàn thành */}
                  {isDone && (
                    <div
                      className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
                    >
                      ✓ Xong
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold truncate" style={{ color: "var(--text)" }}>
                        {lesson.lessonTitle}
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {lesson.wordCount} từ vựng
                      </p>
                    </div>
                    <div className="text-2xl flex-shrink-0" style={{ color: "var(--primary)" }}>
                      {isDone ? "✅" : "📖"}
                    </div>
                  </div>

                  {/* Progress bar từng bài */}
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {lesson.learnedCount}/{lesson.wordCount} đã học
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: isDone ? "#22c55e" : pct > 0 ? "var(--primary)" : "var(--text-faint)" }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: isDone ? "#22c55e" : "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
