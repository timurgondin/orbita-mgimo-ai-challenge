import { cn } from "@/lib/utils";

/** Полоска прогресса — нативный <progress> (читается экранным диктором). Высота — утилитой, цвета — --track и --fill; стиль .bar в globals.css. */
export function ProgressBar({
  value,
  label,
  className,
  fill,
  track,
}: {
  /** 0–100 */
  value: number;
  label: string;
  className?: string;
  fill?: string;
  track?: string;
}) {
  return (
    <progress
      max={100}
      value={Math.round(value)}
      aria-label={label}
      className={cn("bar", className)}
      style={{ ...(fill && { "--fill": fill }), ...(track && { "--track": track }) } as React.CSSProperties}
    />
  );
}
