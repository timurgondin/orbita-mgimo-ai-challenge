import { NextResponse } from "next/server";
import { printerById, printerName } from "@/lib/printers";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { renderMaterialPdf } from "@/server/office/material-pdf";

const notFound = () => new NextResponse("Скан не найден", { status: 404, headers: { "Cache-Control": "private, no-store" } });

/** Свой скан — PDF; чужой — 404, как несуществующий. Содержимое в прототипе — заглушка с данными скана. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (typeof id !== "string" || !/^[a-z0-9]{1,40}$/i.test(id)) return notFound();
  const s = await db.scan.findFirst({ where: { id, userId: user.id } });
  if (!s) return notFound();
  const p = printerById(s.printerId);
  const bytes = await renderMaterialPdf({
    kicker: "Скан из Орбиты",
    title: s.fileName.replace(/\.pdf$/, ""),
    byline: `${p ? printerName(p) : "Принтер"}, ${s.pages} стр.`,
    landscape: false,
    pages: Array.from({ length: s.pages }, (_, i) => ({ heading: `Страница ${i + 1}`, text: ["Здесь будет изображение отсканированной страницы. В прототипе сканер не подключён."] })),
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="scan.pdf"; filename*=UTF-8''${encodeURIComponent(s.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
