import { cn } from "@/lib/utils";

/** Фирменная сфера «Орбиты» — она же ИИ-помощник. Состояния: покой и «слушает» (пишут вопрос); «думает» — `thinking-orbs` в окне помощника. */
export function Orb({
  size = 30,
  state,
  className,
}: {
  size?: number;
  state?: "listening";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-state={state}
      className={cn("orb", className)}
      style={{ width: size, height: size, "--orb-blur": `${size * 0.16}px` } as React.CSSProperties}
    >
      <i />
      <i />
      <i />
    </span>
  );
}
