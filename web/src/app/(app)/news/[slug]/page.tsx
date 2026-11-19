import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobilityView } from "@/components/news/mobility-view";
import { MOBILITY } from "@/lib/announcements";
import { getMobilityPage } from "@/server/data/news";

export const metadata: Metadata = { title: "Объявление — Орбита" };

/** Объявление со своей страницей. Пока одно — конкурс академической мобильности. */
export default async function NewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== MOBILITY.slug) notFound();
  const d = await getMobilityPage();
  if (!d) notFound();
  return <MobilityView d={d} />;
}
