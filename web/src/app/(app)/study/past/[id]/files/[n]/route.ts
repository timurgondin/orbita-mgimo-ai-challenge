import { NextResponse } from "next/server";
import { getPastMaterial } from "@/server/data/archive";
import { renderMaterialPdf } from "@/server/office/material-pdf";

const notFound = () => new NextResponse("Файл не найден", { status: 404, headers: { "Cache-Control": "private, no-store" } });

/** Материал пройденного курса — PDF только владельцу курса (иначе 404, как несуществующий). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const m = await getPastMaterial(id, Number(n));
  if (!m) return notFound();
  const plan = m.material.plan ?? [m.material.title];
  const bytes = await renderMaterialPdf({
    kicker: m.course,
    title: m.material.title,
    byline: `${m.teacher}, ${m.semester}`,
    landscape: m.material.kind === "slides",
    pages: plan.map((h, i) => ({
      heading: h,
      text:
        i === plan.length - 1 && /самопроверк|Критери/.test(h)
          ? ["1. Сформулируйте главный вывод темы своими словами.", "2. Приведите пример из реальной экономики или политики.", "3. Какие допущения модели кажутся вам самыми спорными?"]
          : [`Материал к теме «${h}». Ключевые понятия, определения и примеры, которые разбирались на занятии.`, "Подробные выкладки и задачи для самостоятельной работы — в списке литературы курса."],
    })),
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="material.pdf"; filename*=UTF-8''${encodeURIComponent(m.material.title)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
