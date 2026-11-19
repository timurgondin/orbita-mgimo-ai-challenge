import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfDoc {
  heading: string; // СПРАВКА
  number: string;
  title: string;
  issuedDate: string; // 18.11.2026
  issuedTime: string;
  paragraphs: string[];
  signedBy: string;
  verifyUrl: string;
}

const INK = rgb(0.106, 0.106, 0.114);
const MUTED = rgb(0.45, 0.45, 0.47);
const RULE = rgb(0.867, 0.867, 0.867);

let fontBytes: Promise<Buffer> | undefined;
export const loadFont = () => (fontBytes ??= readFile(path.join(process.cwd(), "assets", "fonts", "Onest.ttf")));

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Настоящий PDF A4: шапка с логотипом, заголовок, текст, блок электронной подписи и QR-код (вектором). */
export async function renderDocumentPdf(d: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFont(), { subset: true });
  pdf.setTitle(`${d.title} ${d.number}`);
  pdf.setAuthor("Университет Будущего");
  pdf.setProducer("Орбита");
  pdf.setSubject("Электронный документ (концепт, данные вымышлены)");

  const page = pdf.addPage([595.28, 841.89]);
  const M = 56;
  const W = page.getWidth() - M * 2;
  let y = page.getHeight() - M;

  // шапка: логотип-кольцо + название
  const cx = M + 9;
  page.drawCircle({ x: cx, y: y - 8, size: 8.5, borderColor: INK, borderWidth: 1.6 });
  page.drawCircle({ x: cx + 6.2, y: y - 1.8, size: 2.6, color: INK });
  page.drawText("Университет Будущего", { x: M + 26, y: y - 12, size: 13, font, color: INK });
  y -= 28;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: RULE });

  // заголовок с разрядкой
  y -= 70;
  const spaced = d.heading.split("").join(" ");
  const hs = 20;
  page.drawText(spaced, { x: M + (W - font.widthOfTextAtSize(spaced, hs)) / 2, y, size: hs, font, color: INK });
  y -= 24;
  const no = `№ ${d.number} от ${d.issuedDate}`;
  page.drawText(no, { x: M + (W - font.widthOfTextAtSize(no, 12)) / 2, y, size: 12, font, color: MUTED });

  // текст
  y -= 44;
  const fs = 12.5;
  const lh = 20;
  for (const p of d.paragraphs) {
    for (const line of wrap(p, font, fs, W)) {
      page.drawText(line, { x: M, y, size: fs, font, color: INK });
      y -= lh;
    }
    y -= 8;
  }

  // низ: подпись слева, QR справа
  const qr = QRCode.create(d.verifyUrl, { errorCorrectionLevel: "M" }).modules;
  const qrSize = 96;
  const bottom = M + 12;
  drawQr(page, qr, M + W - qrSize, bottom + 14, qrSize);
  const cap = "Проверка подлинности";
  page.drawText(cap, { x: M + W - qrSize + (qrSize - font.widthOfTextAtSize(cap, 8)) / 2, y: bottom, size: 8, font, color: MUTED });

  const sigW = 270;
  const sigH = 74;
  const sigY = bottom + 14;
  page.drawRectangle({ x: M, y: sigY, width: sigW, height: sigH, color: rgb(0.957, 0.961, 1), borderColor: rgb(0.812, 0.824, 1), borderWidth: 0.6 });
  page.drawText("Подписано электронной подписью", { x: M + 12, y: sigY + sigH - 22, size: 10.5, font, color: rgb(0.227, 0.239, 0.722) });
  page.drawText(d.signedBy, { x: M + 12, y: sigY + sigH - 40, size: 10, font, color: rgb(0.33, 0.33, 0.35) });
  page.drawText(`${d.issuedDate} ${d.issuedTime}`, { x: M + 12, y: sigY + sigH - 55, size: 10, font, color: rgb(0.33, 0.33, 0.35) });
  page.drawText(d.verifyUrl, { x: M, y: sigY - 14, size: 7, font, color: MUTED, maxWidth: sigW + 80 });

  page.drawText("Концепт для конкурса MGIMO×AI Challenge. Все данные вымышлены.", { x: M, y: M - 18, size: 7.5, font, color: MUTED });
  return pdf.save();
}

function drawQr(page: PDFPage, qr: { size: number; get(r: number, c: number): number }, x: number, y: number, size: number) {
  const quiet = 2;
  const cell = size / (qr.size + quiet * 2);
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1), borderColor: RULE, borderWidth: 0.5 });
  for (let r = 0; r < qr.size; r++)
    for (let c = 0; c < qr.size; c++)
      if (qr.get(r, c)) page.drawRectangle({ x: x + (c + quiet) * cell, y: y + size - (r + quiet + 1) * cell, width: cell + 0.02, height: cell + 0.02, color: INK });
}
