// Проверка контактов — общая для сервера и клиента. Сервер проверяет всегда; клиент — только для подсказки.
export type ContactField = "phone" | "telegram";

/** Нормализует значение; null — пусто (контакт удалён); undefined — неверный формат. */
export function normalizeContact(field: ContactField, raw: string): string | null | undefined {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 40) return undefined;
  if (field === "phone") {
    const digits = v.replace(/\D/g, "");
    if (!/^\+?[\d\s()-]+$/.test(v) || digits.length < 10 || digits.length > 15) return undefined;
    // российский номер → +7 900 000-12-34
    const ru = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits.length === 10 ? digits : null;
    return ru ? `+7 ${ru.slice(0, 3)} ${ru.slice(3, 6)}-${ru.slice(6, 8)}-${ru.slice(8)}` : `+${digits}`;
  }
  const nick = v.replace(/^@/, "");
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(nick) ? `@${nick}` : undefined;
}

export const CONTACT_ERROR: Record<ContactField, string> = {
  phone: "Проверьте номер телефона",
  telegram: "Имя в Telegram — от 5 латинских букв, цифр или _",
};

/*
 * Маски ввода (только для удобства; проверяет и приводит к виду сервер — normalizeContact).
 * Телефон: «+7» стоит сразу, скобки и тире появляются по мере набора — не заранее, поэтому стирание не застревает
 * на разделителе. 8… и 9… превращаются в +7. Номер с «+» и другим кодом страны — без маски.
 * Telegram: «@» стоит сразу, пробелы и лишние «@» убираются.
 */
export const CONTACT_PREFIX: Record<ContactField, string> = { phone: "+7 ", telegram: "@" };

export function maskPhone(raw: string, prev = ""): string {
  const t = raw.trim();
  let d = t.replace(/\D/g, "");
  if (!d && (!t || raw.length < prev.length)) return ""; // стёрли всё, включая +7
  if (t.startsWith("+") && d && d[0] !== "7") return `+${d.slice(0, 15)}`;
  if (d[0] === "8") d = `7${d.slice(1)}`;
  else if (d[0] !== "7") d = `7${d}`;
  const n = d.slice(1, 11);
  let out = "+7";
  if (n.length) out += ` (${n.slice(0, 3)}`;
  if (n.length > 3) out += `) ${n.slice(3, 6)}`;
  if (n.length > 6) out += `-${n.slice(6, 8)}`;
  if (n.length > 8) out += `-${n.slice(8, 10)}`;
  return out;
}

export function maskTelegram(raw: string): string {
  const v = raw.replace(/[@\s]/g, "");
  return v ? `@${v}` : raw.includes("@") ? "@" : "";
}

export const maskContact = (field: ContactField, raw: string, prev = "") => (field === "phone" ? maskPhone(raw, prev) : maskTelegram(raw));

/** Значение для сохранения: одна приставка («+7», «@») — то же, что пусто. */
export function contactValue(field: ContactField, v: string): string {
  if (field === "phone") return v.replace(/\D/g, "").length <= 1 ? "" : v;
  return v.replace(/[@\s]/g, "") ? v : "";
}
