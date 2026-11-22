import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoursePage } from "@/components/study/course-page";
import { TeachCourse } from "@/components/teach/teach-course";
import { requireUser } from "@/server/auth/session";
import { getCourse } from "@/server/data/study";
import { getTeachCourse } from "@/server/data/teach";

export const metadata: Metadata = { title: "Курс — Орбита" };

/** Страница курса. Чужой или несуществующий курс — 404: студенту — по записи на курс, преподавателю — по составу курса. */
export default async function CourseRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  if (user.role === "teacher") {
    const d = await getTeachCourse(slug);
    if (!d) notFound();
    return <TeachCourse d={d} />;
  }
  const data = await getCourse(slug);
  if (!data) notFound();
  return <CoursePage d={data} />;
}
