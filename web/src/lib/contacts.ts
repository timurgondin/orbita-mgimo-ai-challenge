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
