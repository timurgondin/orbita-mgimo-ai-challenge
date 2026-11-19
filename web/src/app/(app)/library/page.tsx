import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LibraryView } from "@/components/library/library-view";
import { getLibrary } from "@/server/data/library";
import { getStudentCard } from "@/server/data/profile";

export const metadata: Metadata = { title: "Библиотека — Орбита" };

/** Библиотека: книги на руках, продление и бронь по Орбита ID, электронные книги, книги к курсам. */
export default async function LibraryPage() {
  const [d, card] = await Promise.all([getLibrary(), getStudentCard()]);
  if (!d) redirect("/");
  return <LibraryView d={d} card={card} />;
}
