"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useNotifications } from "./center";

/** Полоса наверху «Сегодня»: «нужно действие» со сроком меньше суток. Исчезает, когда решено. */
export function UrgentStrip() {
  const { data, resolve, resolving } = useNotifications();
  const urgent = data.items.filter((n) => n.pending && n.urgent);
  if (!urgent.length) return null;
  return (
    <div className="mt-6 flex flex-col gap-2">
      {urgent.map((n) => (
        <div
          key={n.id}
          data-urgent={n.id}
          className="flex items-center gap-3.5 rounded-[18px] bg-[color-mix(in_srgb,var(--urgent)_12%,transparent)] py-3 pr-3 pl-4 max-sm:flex-wrap"
        >
          <CircleAlert size={18} strokeWidth={1.7} className="shrink-0 text-urgent" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{n.title}</div>
            <div className="text-sm text-urgent">{n.due}</div>
          </div>
          {n.action &&
            (n.action.kind === "resolve" ? (
              <button
                type="button"
                disabled={resolving === n.id}
                onClick={() => resolve(n.id)}
                className="inline-flex h-9 items-center rounded-[11px] bg-text px-3.5 text-[13.5px] font-semibold text-bg transition-[opacity,transform] hover:opacity-90 active:scale-[.97] disabled:opacity-50 max-sm:ml-8"
              >
                {n.action.label}
              </button>
            ) : (
              <Link href={n.href ?? "#"} className="inline-flex h-9 items-center rounded-[11px] bg-text px-3.5 text-[13.5px] font-semibold text-bg max-sm:ml-8">
                {n.action.label}
              </Link>
            ))}
        </div>
      ))}
    </div>
  );
}
