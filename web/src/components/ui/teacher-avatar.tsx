import { AVATAR_GRADIENTS } from "@/lib/user-view";

const KEYS = ["peach", "mist", "sand", "lilac"] as const;

/** «Петрова Е. А.» → «ЕП», «Morgan K.» → «KM». */
export function nameInitials(name: string): string {
  const [surname = "", first = ""] = name.split(" ");
  return `${first[0] ?? ""}${surname[0] ?? ""}`.toUpperCase();
}

/** Аватар человека по имени: инициалы на градиенте, цвет стабилен для одного имени. Люди в строках — аватаром, а не словами. */
export function TeacherAvatar({ name, size = 24, gradient }: { name: string; size?: number; gradient?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden="true"
      className="mono grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: gradient ?? AVATAR_GRADIENTS[KEYS[hash % KEYS.length]],
      }}
    >
      {nameInitials(name)}
    </span>
  );
}
