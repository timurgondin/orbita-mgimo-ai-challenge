"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const G = 12;
const TILT = -0.42;

function parseColor(v: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Орбита из точек: планета, эллипс и спутник
export function OrbitCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const base = parseColor(css.getPropertyValue("--text"), [237, 237, 239]);
    const acc = parseColor(css.getPropertyValue("--accent"), [139, 142, 255]);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let raf = 0;
    const ct = Math.cos(TILT);
    const st = Math.sin(TILT);
    function draw(ms: number) {
      const t = ms / 1000;
      ctx!.clearRect(0, 0, W, H);
      const cx = W * 0.5;
      const cy = H * 0.42;
      const R = Math.min(W, H) * 0.36;
      const rx = R * 1.15;
      const ry = R * 0.42;
      const sa = t * 0.35;
      const sx = cx + rx * Math.cos(sa) * ct - ry * Math.sin(sa) * st;
      const sy = cy + rx * Math.cos(sa) * st + ry * Math.sin(sa) * ct;
      for (let y = G / 2; y < H; y += G) {
        for (let x = G / 2; x < W; x += G) {
          const dx = x - cx;
          const dy = y - cy;
          const pr = R * 0.42;
          const pd = Math.hypot(dx, dy) / pr;
          let v = 0;
          if (pd < 1) {
            const lit = 0.5 + 0.5 * ((-dx - dy) / (pr * 1.5));
            v = 0.18 + 0.72 * Math.pow(1 - pd * pd, 0.35) * (0.45 + 0.55 * lit);
          }
          const ex = dx * ct + dy * st;
          const ey = -dx * st + dy * ct;
          const e = Math.abs(Math.hypot(ex / rx, ey / ry) - 1) * R;
          if (ey > 0 || pd >= 1.05) v = Math.max(v, Math.max(0, 1 - e / 15) * 0.8);
          const sd = Math.hypot(x - sx, y - sy);
          v = Math.max(v, Math.max(0, 1 - sd / 30));
          const hd = Math.hypot(dx, dy) / (R * 1.9);
          v = Math.max(v, hd < 1 ? 0.07 * (1 - hd) * (0.6 + 0.4 * Math.sin(t * 0.6 + hd * 9)) : 0);
          if (v < 0.04) continue;
          const near = Math.max(0, 1 - sd / 60);
          const r = base[0] + (acc[0] - base[0]) * near;
          const g = base[1] + (acc[1] - base[1]) * near;
          const b = base[2] + (acc[2] - base[2]) * near;
          ctx!.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.9 * v})`;
          ctx!.beginPath();
          ctx!.arc(x, y, 0.5 + v * 1.9, 0, 6.283);
          ctx!.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    const fit = () => {
      const d = devicePixelRatio || 1;
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * d;
      cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      if (reduce) draw(0);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    fit();
    if (!reduce) raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [resolvedTheme]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}
