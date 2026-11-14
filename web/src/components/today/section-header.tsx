import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeader({ title, linkLabel }: { title: string; linkLabel: string }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between">
      <h2 className="text-lg font-semibold tracking-[-.02em]">{title}</h2>
      <Link
        href="#"
        className="-mr-2 inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm text-text-3 transition-[color,background] duration-150 hover:bg-hover hover:text-text"
      >
        {linkLabel}
        <ChevronRight size={15} strokeWidth={1.6} />
      </Link>
    </div>
  );
}
