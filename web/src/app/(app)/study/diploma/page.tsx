import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiplomaView } from "@/components/study/diploma-view";
import { getDiploma } from "@/server/data/diploma";

export const metadata: Metadata = { title: "Диплом — Орбита" };

export default async function DiplomaPage() {
  const data = await getDiploma();
  if (!data) redirect("/study");
  return <DiplomaView d={data} />;
}
