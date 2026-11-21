"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { animateWhileVisible } from "@/lib/animate-visible";

/**
 * Фон онбординга: рассыпанные точки собираются в знак «Орбиты» — кольцо с разрывом и спутник.
 * gather — знак крупно в верхней части; ambient — большое тихое кольцо за содержимым; launch — кольцо уходит за край.
 */
export type OrbitPhase = "gather" | "ambient" | "launch";

const RING = 760;
const SAT = 70;
const N = RING + SAT;
const GAP = 0.62; // ширина разрыва под спутник, рад
const SAT_ANGLE = -Math.PI / 4; // спутник справа сверху, как в логотипе

function rgb(v: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Поворот кольца — общий для онбординга и «моста» в кабинет (модуль живёт между клиентскими переходами). */
export const orbitShared = { rot: 0 };

export function OrbitField({ phase, formed = false }: { phase: OrbitPhase; /** сразу собранный знак в том же повороте (мост в кабинет) */ formed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const base = rgb(css.getPropertyValue("--text"), [237, 237, 239]);
    const acc = rgb(css.getPropertyValue("--accent"), [139, 142, 255]);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    const ang = new Float32Array(N); // место на кольце
    const off = new Float32Array(N); // толщина полосы
    const spd = new Float32Array(N);
    const tw = new Float32Array(N);
    const sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (i < RING) {
        ang[i] = SAT_ANGLE + GAP / 2 + ((i + Math.random() * 0.6) / RING) * (Math.PI * 2 - GAP);
        off[i] = (Math.random() + Math.random() - 1) * 0.5;
      } else {
        // спутник — плотный диск точек
        ang[i] = Math.random() * Math.PI * 2;
        off[i] = Math.sqrt(Math.random());
      }
      spd[i] = 1.1 + Math.random() * 2.2;
      tw[i] = Math.random() * 6.283;
      sz[i] = 0.7 + Math.random() * 0.9;
    }

    const fit = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      const first = W === 0;
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * d;
      cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      if (first && !formed) {
        // старт: точки рассыпаны по всему экрану
        for (let i = 0; i < N; i++) {
          x[i] = Math.random() * W;
          y[i] = Math.random() * H;
        }
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    let last = 0;
    let rot = formed ? orbitShared.rot : 0;
    let alpha = formed ? 1 : 0;
    let snap = formed; // первый кадр — сразу на месте
    const stop = animateWhileVisible(cv, (ms) => {
      const dt = last ? Math.min((ms - last) / 1000, 0.05) : 0.016;
      last = ms;
      const ph = phaseRef.current;
      const mobile = W < 640;
      const small = Math.min(W, H);
      const cx = W / 2;
      const cy = ph === "gather" ? H * 0.3 : H * 0.46; // 30% высоты — там же центр вспышки входа в кабинет (globals.css, arrive)
      const R =
        ph === "gather"
          ? Math.min(small * (mobile ? 0.3 : 0.2), 200)
          : ph === "ambient"
            ? mobile
              ? W * 0.74
              : Math.min(W, H) * 0.5
            : Math.max(W, H) * 1.25;
      const band = ph === "gather" ? R * 0.11 : R * 0.035;
      const targetAlpha = ph === "gather" ? 1 : ph === "ambient" ? 0.34 : 0;
      alpha += (targetAlpha - alpha) * Math.min(1, dt * (ph === "launch" ? 3 : 1.6));
      if (!reduce) rot += dt * (ph === "gather" ? 0.06 : 0.025);
      orbitShared.rot = rot;
      const t = ms / 1000;

      ctx.clearRect(0, 0, W, H);
      const sa = SAT_ANGLE + rot;
      const sx = cx + Math.cos(sa) * R;
      const sy = cy + Math.sin(sa) * R;
      const sr = R * 0.29;
      for (let i = 0; i < N; i++) {
        let tx: number;
        let ty: number;
        const sat = i >= RING;
        if (!sat) {
          const a = ang[i] + rot;
          const r = R + off[i] * band * 2;
          tx = cx + Math.cos(a) * r;
          ty = cy + Math.sin(a) * r;
        } else {
          tx = sx + Math.cos(ang[i]) * off[i] * sr;
          ty = sy + Math.sin(ang[i]) * off[i] * sr;
        }
        if (reduce || snap) {
          x[i] = tx;
          y[i] = ty;
        } else {
          const k = Math.min(1, dt * spd[i] * (ph === "launch" ? 2.4 : 1));
          x[i] += (tx - x[i]) * k;
          y[i] += (ty - y[i]) * k;
        }
        const twinkle = reduce ? 0.85 : 0.7 + 0.3 * Math.sin(t * 1.8 + tw[i]);
        const c = sat ? acc : base;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(sat ? 0.95 : 0.78) * twinkle * alpha})`;
        ctx.beginPath();
        ctx.arc(x[i], y[i], sz[i] * (sat ? 1.25 : 1) * (mobile ? 0.9 : 1.1), 0, 6.283);
        ctx.fill();
      }
      snap = false;
    });
    return () => {
      stop();
      ro.disconnect();
    };
  }, [resolvedTheme, formed]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 size-full" />;
}
