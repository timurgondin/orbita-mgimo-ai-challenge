import type { Metadata } from "next";
import { FoodView } from "@/components/food/food-view";
import { getFood } from "@/server/data/food";

export const metadata: Metadata = { title: "Еда — Орбита" };

/** Столовая, кофейни и кафе кампуса: часы, загруженность, меню с ценами. `?place=<slug>` открывает заведение. */
export default async function FoodPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const [venues, { place }] = await Promise.all([getFood(), searchParams]);
  const initial = venues.some((v) => v.slug === place) ? place! : null;
  return <FoodView venues={venues} initial={initial} />;
}
