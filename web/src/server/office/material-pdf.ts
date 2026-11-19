import "server-only";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { loadFont, wrap } from "./pdf";

export interface MaterialPdf {
  /** «Микроэкономика» — над заголовком */
  kicker: string;
  title: string;
  /** «Петрова Е. А., 1 курс, 1 семестр» */
  byline: string;
  /** страницы: заголовок и абзацы */
  pages: { heading: string; text: string[] }[];
  /** слайды (альбомная) или документ (книжная) */
  landscape: boolean;
}

const INK = rgb(0.106, 0.106, 0.114);
const MUTED = rgb(0.45, 0.45, 0.47);
const ACCENT = rgb(0.42, 0.45, 0.95);

/** Учебный материал как настоящий PDF: обложка и страницы с заголовками. Содержимое вымышленное. */
export async function renderMaterialPdf(d: MaterialPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFont(), { subset: true });
  pdf.setTitle(`${d.kicker}. ${d.title}`);
  pdf.setAuthor("Университет Будущего");
  pdf.setProducer("Орбита");
  const size: [number, number] = d.landscape ? [842, 474] : [595.28, 841.89];
  const M = d.landscape ? 48 : 56;

  const ring = (page: ReturnType<typeof pdf.addPage>, x: number, y: number) => {
    page.drawCircle({ x, y, size: 7, borderColor: INK, borderWidth: 1.4 });
    page.drawCircle({ x: x + 5.1, y: y + 5, size: 2.1, color: INK });
  };
  const footer = (page: ReturnType<typeof pdf.addPage>, n: number) => {
    page.drawText(`Университет Будущего · ${d.kicker}`, { x: M, y: 22, size: 8, font, color: MUTED });
    const t = String(n);
    page.drawText(t, { x: size[0] - M - font.widthOfTextAtSize(t, 8), y: 22, size: 8, font, color: MUTED });
  };

  // обложка
  const cover = pdf.addPage(size);
  const W = size[0] - M * 2;
  ring(cover, M + 7, size[1] - M - 6);
  cover.drawText("Университет Будущего", { x: M + 22, y: size[1] - M - 10, size: 11, font, color: INK });
  cover.drawRectangle({ x: M, y: size[1] / 2 + 34, width: 36, height: 3, color: ACCENT });
  cover.drawText(d.kicker, { x: M, y: size[1] / 2 + 12, size: 13, font, color: MUTED });
  let y = size[1] / 2 - 22;
  for (const line of wrap(d.title, font, 30, W)) {
    cover.drawText(line, { x: M, y, size: 30, font, color: INK });
    y -= 38;
  }
  cover.drawText(d.byline, { x: M, y: y - 6, size: 12, font, color: MUTED });
  cover.drawText("Концепт для конкурса MGIMO×AI Challenge. Все данные вымышлены.", { x: M, y: 22, size: 7.5, font, color: MUTED });

  d.pages.forEach((p, i) => {
    const page = pdf.addPage(size);
    let yy = size[1] - M - 8;
    for (const line of wrap(p.heading, font, 22, W)) {
      page.drawText(line, { x: M, y: yy, size: 22, font, color: INK });
      yy -= 30;
    }
    yy -= 10;
    for (const para of p.text) {
      for (const line of wrap(para, font, 12.5, W)) {
        page.drawText(line, { x: M, y: yy, size: 12.5, font, color: INK });
        yy -= 19;
      }
      yy -= 9;
    }
    footer(page, i + 2);
  });
  return pdf.save();
}
