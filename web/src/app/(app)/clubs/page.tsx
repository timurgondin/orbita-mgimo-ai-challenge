import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClubsView } from "@/components/clubs/clubs-view";
import { getClubs } from "@/server/data/clubs";

export const metadata: Metadata = { title: "Клубы — Орбита" };

/** Внеучебная жизнь: клубы, руководители, вступление. */
export default async function ClubsPage() {
  const clubs = await getClubs();
  if (!clubs) redirect("/");
  return <ClubsView clubs={clubs} />;
}
