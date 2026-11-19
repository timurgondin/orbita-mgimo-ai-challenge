import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RatingView } from "@/components/study/rating-view";
import { getRating } from "@/server/data/rating";

export const metadata: Metadata = { title: "Рейтинг — Орбита" };

/** Рейтинг на курсе: своё место, распределение без имён, пороги стипендий и мобильности. */
export default async function RatingPage() {
  const d = await getRating();
  if (!d) redirect("/study");
  return <RatingView d={d} />;
}
