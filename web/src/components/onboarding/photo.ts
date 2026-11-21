/** Квадрат по центру, 720 px, JPEG: фото с телефона (5–10 МБ) уходит на сервер лёгким и без лишних метаданных. */
export async function squareJpeg(file: File, size = 720): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // ориентацию из EXIF браузер применяет сам
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(size, side);
    const cv = document.createElement("canvas");
    cv.width = out;
    cv.height = out;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}
