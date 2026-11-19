import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SemesterView } from "@/components/study/semester-view";
import { getArchive } from "@/server/data/archive";

export const metadata: Metadata = { title: "Семестр — Орбита" };

/** Один прошлый семестр: карточки сданных дисциплин. Только свой архив (пользователь из сессии). */
export default async function SemesterRoute({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const num = Number(n);
  const data = Number.isInteger(num) && num > 0 && num < 13 ? await getArchive() : null;
  const sem = data?.semesters.find((s) => s.n === num);
  if (!data || !sem) notFound();
  const all = [...data.semesters].sort((a, b) => a.n - b.n);
  return <SemesterView s={sem} all={all.map((x) => ({ n: x.n, title: x.title }))} />;
}
