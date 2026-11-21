import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

/** Фото студента в поиске людей и на его карточке. Только для вошедших; ?v= — версия для кеша. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await getCurrentUser())) return new Response(null, { status: 401 });
  const { slug } = await params;
  if (!/^[a-z0-9._-]{1,40}$/.test(slug)) return new Response(null, { status: 404 });
  const photo = await db.userPhoto.findFirst({ where: { user: { login: slug, role: "student" } } });
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
