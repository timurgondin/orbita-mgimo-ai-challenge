import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reader } from "@/components/library/reader";
import { getReader } from "@/server/data/library";

export const metadata: Metadata = { title: "Читалка — Орбита" };

/** Электронная книга: страница из адреса (?p=) или та, где остановились. */
export default async function ReadPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const [{ slug }, { p }] = await Promise.all([params, searchParams]);
  const d = await getReader(slug, typeof p === "string" ? p : undefined);
  if (!d) notFound();
  return <Reader d={d} />;
}
