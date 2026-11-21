import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoffeeView } from "@/components/coffee/coffee-view";
import { getCoffee } from "@/server/data/coffee";

export const metadata: Metadata = { title: "Random Coffee — Орбита" };

/** Random Coffee: каждую неделю — встреча за кофе со студентом другого факультета. */
export default async function CoffeePage() {
  const data = await getCoffee();
  if (!data) redirect("/");
  return <CoffeeView data={data} />;
}
