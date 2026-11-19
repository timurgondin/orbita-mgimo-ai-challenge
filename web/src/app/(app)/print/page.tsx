import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrintView } from "@/components/print/print-view";
import { getPrint } from "@/server/data/print";
import { getStudentCard } from "@/server/data/profile";

export const metadata: Metadata = { title: "Печать — Орбита" };

/** Безопасная печать и сканирование по Орбита ID на принтерах кампуса. */
export default async function PrintPage() {
  const [d, card] = await Promise.all([getPrint(), getStudentCard()]);
  if (!d) redirect("/");
  return <PrintView d={d} card={card} />;
}
