import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoursePage } from "@/components/study/course-page";
import { getCourse } from "@/server/data/study";

export const metadata: Metadata = { title: "Курс — Орбита" };

/** Страница курса. Чужой или несуществующий курс — 404 (getCourse проверяет запись по сессии). */
export default async function CourseRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCourse(slug);
  if (!data) notFound();
  return <CoursePage d={data} />;
}
