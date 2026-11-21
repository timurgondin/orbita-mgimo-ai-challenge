"use client";

import { useEffect, useState } from "react";
import { refreshCardQr } from "@/server/profile/actions";
import { cn } from "@/lib/utils";

/**
 * QR Орбита ID: пока виден, сервер каждые 10 с выдаёт новый подписанный код (старый на /verify — «устарел»).
 * Полоска под кодом тает до смены. SVG строит сервер (библиотека qrcode).
 */
export function OrbitaQr({
  initial,
  active,
  className,
}: {
  initial: { qr: string; ttl: number };
  /** Окно открыто — обновляем; закрыто — молчим */
  active: boolean;
  className?: string;
}) {
  const [cur, setCur] = useState({ ...initial, rev: 0 });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pull = async () => {
      clearTimeout(timer);
      const next = await refreshCardQr().catch(() => null);
      if (!alive) return;
      if (next) setCur((p) => ({ ...next, rev: p.rev + 1 }));
      // Смена — ровно на границе окна; при ошибке сети — повтор через 3 с
      timer = setTimeout(pull, next ? next.ttl + 60 : 3000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") pull();
      else clearTimeout(timer);
    };
    pull(); // код, пришедший со страницей, мог давно устареть
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return (
    <div className="flex flex-col items-center" data-orbita-qr data-qr-rev={cur.rev}>
      <div className={cn("rounded-[22px] bg-white [&_svg]:block", className)}>
        <div key={cur.rev} className="qr-in" dangerouslySetInnerHTML={{ __html: cur.qr }} />
      </div>
      <span className="mt-3 block h-[3px] w-16 overflow-hidden rounded-full bg-s2" aria-hidden="true">
        {cur.rev > 0 && (
          <span
            key={cur.rev}
            className="qr-drain block h-full rounded-full bg-(--accent)"
            style={{ animationDuration: `${cur.ttl}ms` }}
          />
        )}
      </span>
    </div>
  );
}
