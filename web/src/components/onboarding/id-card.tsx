"use client";

import { useRef } from "react";
import { OrbitaQr } from "@/components/profile/orbita-qr";
import type { StudentCardView } from "@/server/data/types";
import s from "./classes";

/** Знак «Орбиты»: кольцо с разрывом и спутник (как icon.svg). */
export function OrbitMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <mask id="ob-mark">
          <rect width="32" height="32" fill="#fff" />
          <circle cx="22.4" cy="9.6" r="4.6" fill="#000" />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" mask="url(#ob-mark)" />
      <circle cx="22.4" cy="9.6" r="2.6" fill="var(--accent)" />
    </svg>
  );
}

/**
 * Орбита ID картой: собирается из точек (маска-сетка), переворачивается лицом, наклоняется за указателем.
 * QR живой — меняется каждые 10 с, как в окне студенческого.
 */
export function IdCard({ card, photo, program, group }: { card: StudentCardView; photo: string | null; program: string; group: string }) {
  const tilt = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !tilt.current) return;
    const r = tilt.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const el = tilt.current;
    el.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 10}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };
  const leave = () => {
    const el = tilt.current;
    if (!el) return;
    for (const p of ["--rx", "--ry", "--gx", "--gy"]) el.style.removeProperty(p);
  };

  return (
    <div className={`${s.materialize} -m-10 p-10`}>
      <div className={s.scene} onPointerMove={move} onPointerLeave={leave}>
        <div ref={tilt} className={s.tilt}>
          <div className={`${s.card} mx-auto w-full max-w-[380px]`} data-id-card>
            {/* Рубашка: знак из точек */}
            <div className={`${s.face} ${s.back} grid place-items-center`} aria-hidden="true">
              <span className="relative text-white/90">
                <OrbitMark size={84} />
              </span>
            </div>
            {/* Лицо */}
            <div className={`${s.face} flex flex-col p-5 max-sm:p-[18px]`}>
              <div className="relative flex items-center gap-2 text-[13px] font-semibold tracking-[-.01em]">
                <OrbitMark size={20} />
                Университет Будущего
                <span className="ml-auto text-[12px] font-medium text-white/55">Орбита ID</span>
              </div>
              <div className="relative mt-auto flex items-end gap-3.5">
                <div
                  className="mono grid aspect-[3/4] w-[74px] shrink-0 place-items-center overflow-hidden rounded-[12px] text-[22px] font-semibold max-sm:w-[64px]"
                  style={{ background: card.avatar }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- своё фото из /me/photo, не через оптимизатор
                    <img src={photo} alt="" className="size-full object-cover" data-card-photo />
                  ) : (
                    card.initials
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-0.5">
                  <b className="block text-[19px] leading-[1.15] font-semibold tracking-[-.02em] max-sm:text-[17px]">{card.name}</b>
                  <span className="mt-1 block truncate text-[13px] text-white/65">{program}</span>
                  <span className="block text-[13px] text-white/45">{group}</span>
                  <span className="mt-1.5 block text-[12px] text-white/45 tabular-nums">№ {card.number}</span>
                </div>
                <OrbitaQr initial={card} active bare className="rounded-[10px] p-[5px] [&_svg]:size-[64px] max-sm:[&_svg]:size-[54px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
