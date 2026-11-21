import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentPage } from "@/components/people/student-page";
import { TeacherPage } from "@/components/people/teacher-page";
import { getStudentPage } from "@/server/data/directory";
import { getTeacher } from "@/server/data/people";

export const metadata: Metadata = { title: "Люди — Орбита" };

// Один адрес для всех людей: у преподавателя slug «petrova-ea», у студента — логин «d.belyaeva»; ?week= — понедельник недели расписания
export default async function PersonRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ week?: string }> }) {
  const [{ slug }, { week }] = await Promise.all([params, searchParams]);
  const teacher = await getTeacher(slug, week);
  if (teacher) return <TeacherPage t={teacher} />;
  const student = await getStudentPage(slug, week);
  if (!student) notFound();
  return <StudentPage s={student} />;
}
