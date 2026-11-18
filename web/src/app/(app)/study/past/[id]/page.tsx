import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PastCourseView } from "@/components/study/past-course";
import { getPastCourse } from "@/server/data/archive";

export const metadata: Metadata = { title: "Пройденный курс — Орбита" };

export default async function PastCourseRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPastCourse(id);
  if (!data) notFound();
  return <PastCourseView c={data} />;
}
