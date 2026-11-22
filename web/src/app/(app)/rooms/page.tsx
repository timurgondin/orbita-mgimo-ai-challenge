import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoomsView } from "@/components/rooms/rooms-view";
import { getStudentCard } from "@/server/data/profile";
import { getRooms } from "@/server/data/rooms";

export const metadata: Metadata = { title: "Аудитории — Орбита" };

/** Бронирование переговорок и свободных аудиторий, отметка у двери по Орбита ID. */
export default async function RoomsPage() {
  const [d, card] = await Promise.all([getRooms(), getStudentCard()]);
  if (!d) redirect("/");
  return <RoomsView d={d} card={card} />;
}
