"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const GAP = 12;
const MASK = "radial-gradient(70% 90% at 100% 0%, #000 0%, transparent 72%)";

/** Точечное поле: точки «дышат» волной. По умолчанию монохромное; `rgb` — цвет точек («r,g,b»). При prefers-reduced-motion рисуется один кадр. */
export function DotField({ rgb, mask = MASK, peak }: { rgb?: string; mask?: string; peak?: number } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ink = rgb ?? (light ? "20,20,22" : "237,237,239");
    const top = peak ?? (light ? 0.16 : 0.2);
    let w = 0;
    let h = 0;
    let raf = 0;

    const draw = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, w, h);
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          const v = 0.5 + 0.5 * Math.sin((x / w) * 5 - t * 0.5 + Math.sin((y / h) * 4 + t * 0.35) * 1.6);
          ctx.fillStyle = `rgba(${ink},${top * (0.25 + 0.75 * v)})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.5 + v * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    };

    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    fit();
    if (!reduce) raf = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [light, rgb, peak]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}
