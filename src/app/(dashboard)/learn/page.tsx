"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";

type CourseSummary = {
  courseId: string;
  courseName: string;
  lessonCount: number;
  wordCount: number;
};

export default function LearnHomePage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [unassignedWordCount, setUnassignedWordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
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
    const fetchCourses = async () => {
      try {
        const snap = await getDocs(query(collection(db, "vocabulary")));
        const map = new Map<string, { courseName: string; lessonIds: Set<string>; wordCount: number }>();
        let unassigned = 0;

        snap.docs.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const courseId = String(data.courseId || "").trim();
          const lessonId = String(data.lessonId || "").trim();
          const courseName = String(data.courseName || courseId || "Khoá học chưa gán").trim();

          if (!courseId) {
            unassigned += 1;
            return;
          }

          if (!map.has(courseId)) {
            map.set(courseId, {
              courseName: courseName || courseId,
              lessonIds: new Set(),
              wordCount: 0,
            });
          }

          const course = map.get(courseId)!;
          if (lessonId) course.lessonIds.add(lessonId);
          course.wordCount += 1;
        });

        const courseList: CourseSummary[] = Array.from(map.entries()).map(([courseId, item]) => ({
          courseId,
          courseName: item.courseName,
          lessonCount: item.lessonIds.size,
          wordCount: item.wordCount,
        }));

        courseList.sort((a, b) => a.courseName.localeCompare(b.courseName));
        setCourses(courseList);
        setUnassignedWordCount(unassigned);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-page pb-24 md:pb-10">
      <Navbar userEmail={userEmail} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6 animate-fade-up">
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>Học theo khoá học</h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Chọn một khoá học để vào danh sách bài học, sau đó bắt đầu học từng bài.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải khoá học...</div>
            </div>
          </div>
        ) : courses.length === 0 ? (
          <div className="card p-10 rounded-3xl text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--text)" }}>Chưa có khoá học nào</h2>
            <p className="mb-6" style={{ color: "var(--text-muted)" }}>
              Dữ liệu hiện tại chưa chứa thông tin khoá học / bài học. Hãy sử dụng script import `scripts/import-course-lessons.ts` để nhập từ vựng theo cấu trúc khoá học.
            </p>
            <Link href="/dashboard" className="btn btn-primary py-3 rounded-2xl">Về Dashboard</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link
                key={course.courseId}
                href={`/learn/${encodeURIComponent(course.courseId)}`}
                className="card p-6 rounded-3xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--text)" }}>{course.courseName}</h2>
                  </div>
                  <div className="text-3xl" style={{ color: "var(--primary)" }}>🎓</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-[var(--text-muted)]">
                  <div className="rounded-2xl bg-[var(--surface-2)] p-3">
                    <div className="font-semibold" style={{ color: "var(--text)" }}>{course.lessonCount}</div>
                    <p>Bài học</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-2)] p-3">
                    <div className="font-semibold" style={{ color: "var(--text)" }}>{course.wordCount}</div>
                    <p>Từ vựng</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {unassignedWordCount > 0 && (
          <div className="mt-8 rounded-3xl border border-orange-300/30 bg-orange-50/60 p-5 text-sm" style={{ color: "#92400e" }}>
            Có {unassignedWordCount} từ chưa được gán khoá học hoặc bài học.
            <div>Những từ này sẽ không xuất hiện trong chế độ học theo khoá học.</div>
          </div>
        )}
      </div>
    </div>
  );
}
