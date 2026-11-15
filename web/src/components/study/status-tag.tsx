import { CircleX, Clock3, LoaderCircle, PencilLine, ScanSearch, Send, type LucideIcon } from "lucide-react";
import type { TagKind } from "@/server/data/types";

const TAGS: Record<TagKind, { label: string; color: string; Icon: LucideIcon }> = {
  upcoming: { label: "Впереди", color: "var(--st-gray)", Icon: Clock3 },
  draft: { label: "Черновик", color: "var(--st-orange)", Icon: PencilLine },
  in_progress: { label: "В работе", color: "var(--st-blue)", Icon: LoaderCircle },
  submitted: { label: "Отправлено", color: "var(--st-violet)", Icon: Send },
  reviewing: { label: "На проверке", color: "var(--st-yellow)", Icon: ScanSearch },
  returned: { label: "Доработать", color: "var(--st-red)", Icon: CircleX },
};

export function StatusTag({ status }: { status: TagKind }) {
  const { label, color, Icon } = TAGS[status];
  return (
    <span
      style={{ "--c": color } as React.CSSProperties}
      className="inline-flex h-6 items-center gap-[5px] rounded-full bg-[color-mix(in_srgb,var(--c)_13%,transparent)] pr-[9px] pl-[7px] text-[12.5px] font-medium whitespace-nowrap text-(--c)"
    >
      <Icon size={13} strokeWidth={2.1} />
      {label}
    </span>
  );
}
