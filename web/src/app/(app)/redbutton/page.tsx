import type { Metadata } from "next";
import { AppealsView } from "@/components/appeals/appeals-view";
import { getAppeals } from "@/server/data/appeals";

export const metadata: Metadata = { title: "Красная кнопка — Орбита" };

/** «Красная кнопка»: жалоба, благодарность или предложение — в приёмную ректора; свои обращения с этапами и ответом. */
export default async function RedButtonPage() {
  return <AppealsView data={await getAppeals()} />;
}
