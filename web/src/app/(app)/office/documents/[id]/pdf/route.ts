import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/session";
import { getOwnDocument, headingFor, paragraphsOf, verifyUrl } from "@/server/office/documents";
import { renderDocumentPdf } from "@/server/office/pdf";

const notFound = () => new NextResponse("Документ не найден", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const d = await getOwnDocument(id, user.id); // чужой документ — 404, как несуществующий
  if (!d) return notFound();

  const msk = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", ...o }).format(d.issuedAt);
  const bytes = await renderDocumentPdf({
    heading: headingFor(d.typeId),
    number: d.number,
    title: d.title,
    issuedDate: msk({ day: "2-digit", month: "2-digit", year: "numeric" }),
    issuedTime: msk({ hour: "2-digit", minute: "2-digit", hour12: false }),
    paragraphs: paragraphsOf(d.paragraphs),
    signedBy: d.signedBy,
    verifyUrl: verifyUrl(d.verifyToken),
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${d.number}.pdf"; filename*=UTF-8''${encodeURIComponent(`${d.title} ${d.number}`)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
