import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeacherPage } from "@/components/people/teacher-page";
import { getTeacher } from "@/server/data/people";

export const metadata: Metadata = { title: "Преподаватель — Орбита" };

export default async function PersonRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTeacher(slug);
  if (!data) notFound();
  return <TeacherPage t={data} />;
}
