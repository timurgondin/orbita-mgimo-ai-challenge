import { Archive, ArrowLeftRight, BedDouble, CircleCheck, CircleX, FileText, ListChecks, LoaderCircle, Pause, Plane, RotateCcw, ScanSearch, Send, Shield, Undo2, type LucideIcon } from "lucide-react";
import { STATUS_TAGS } from "@/lib/office-catalog";

const ICONS: Record<string, LucideIcon> = {
  "file-text": FileText, plane: Plane, "list-checks": ListChecks, shield: Shield, "rotate-ccw": RotateCcw,
  "arrow-left-right": ArrowLeftRight, "bed-double": BedDouble, pause: Pause,
  send: Send, "loader-circle": LoaderCircle, "scan-search": ScanSearch, "circle-check": CircleCheck, archive: Archive, "circle-x": CircleX, "undo-2": Undo2,
};

/** Иконка по имени из каталога. */
export function Ico({ name, size, strokeWidth }: { name: string; size: number; strokeWidth: number }) {
  const I = ICONS[name] ?? FileText;
  return <I size={size} strokeWidth={strokeWidth} />;
}

export const typeColor = (c: string) => `var(--${c})`;

/** Статус-тег (цветной фон 13% + иконка), как в «Учёбе». */
export function OfficeTag({ status }: { status: string }) {
  const t = STATUS_TAGS[status] ?? STATUS_TAGS.sent;
  return (
    <span
      style={{ "--c": t.color } as React.CSSProperties}
      className="inline-flex h-6 shrink-0 items-center gap-[5px] rounded-full bg-[color-mix(in_srgb,var(--c)_13%,transparent)] pr-[9px] pl-[7px] text-[12.5px] font-medium whitespace-nowrap text-(--c)"
    >
      <Ico name={t.icon} size={13} strokeWidth={2.1} />
      {t.label}
    </span>
  );
}

export const whiteBtn =
  "inline-flex h-[46px] items-center justify-center rounded-[14px] bg-text px-[22px] text-[15px] font-semibold whitespace-nowrap text-bg transition-[opacity,transform] duration-150 hover:opacity-92 active:scale-[.97] disabled:opacity-60";
export const ghostBtn =
  "inline-flex h-10 items-center justify-center gap-[7px] rounded-[12px] bg-s3 px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--s3)_80%,var(--text))] disabled:opacity-60";
