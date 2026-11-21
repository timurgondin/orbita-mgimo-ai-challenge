import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";

/** Своё фото (аватар, Орбита ID). Только владельцу: пользователь — из сессии, параметров нет; ?v= — версия для кеша. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const photo = await db.userPhoto.findUnique({ where: { userId: user.id } });
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
