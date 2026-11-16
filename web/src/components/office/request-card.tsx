import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OfficeRequestView } from "@/server/data/types";

export function RequestCard({ req, onOpen }: { req: OfficeRequestView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-request={req.number}
      className="flex w-full flex-col rounded-[24px] bg-s1 px-6 py-[22px] text-left transition-colors duration-200 hover:bg-s2 max-sm:px-5"
    >
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold tracking-[-.02em]">{req.title}</span>
        <span className="mt-0.5 block text-sm text-text-3">{req.subtitle}</span>
      </span>
      <span className="mt-[26px] grid" style={{ gridTemplateColumns: `repeat(${req.steps.length}, minmax(0, 1fr))` }}>
        {req.steps.map((s) => (
          <span key={s.label} className="flex flex-col gap-2">
            <span className="mr-1 block h-1 overflow-hidden rounded bg-s3">
              <i className={cn("block h-full rounded bg-text", s.state === "fin" ? "w-full" : s.state === "cur" ? "step-cur" : "w-0")} />
            </span>
            <b className={cn("text-[13px] font-medium", s.state === "todo" ? "text-text-3" : "text-text")}>{s.label}</b>
            <small className="-mt-1.5 text-xs text-text-3">{s.when || " "}</small>
          </span>
        ))}
      </span>
      {req.eta && (
        <span className="mt-[18px] flex items-center gap-2 text-sm text-text-2">
          <Clock3 size={15} strokeWidth={1.6} className="text-text-3" />
          {req.eta}
        </span>
      )}
    </button>
  );
}
