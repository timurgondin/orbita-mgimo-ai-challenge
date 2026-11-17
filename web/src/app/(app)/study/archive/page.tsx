import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArchiveView } from "@/components/study/archive-view";
import { getArchive } from "@/server/data/archive";

export const metadata: Metadata = { title: "Архив курсов — Орбита" };

export default async function ArchivePage() {
  const data = await getArchive();
  if (!data) redirect("/study");
  return <ArchiveView data={data} />;
}
