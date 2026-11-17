import Link from "next/link";
import { SectionHeader } from "./section-header";
import { Check } from "lucide-react";
import { kindAt } from "@/lib/phrases";
import type { Lesson } from "@/server/data/types";

function Row({ lesson }: { lesson: Lesson }) {
  return (
    <Link
      href={`/time?open=${lesson.id}`}
      className="-mx-3 grid grid-cols-[54px_1fr_auto] items-baseline gap-3.5 rounded-[14px] px-3 py-3 transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[48px_1fr_auto]"
    >
      <span className="text-[15px] text-text-2">{lesson.start}</span>
      <div>
        <div className="font-medium">{lesson.title}</div>
        <div className="mt-px text-sm text-text-3">{kindAt(lesson.format, lesson.place)}</div>
      </div>
      {lesson.note?.kind === "flag" && (
        <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-urgent max-sm:col-start-2 max-sm:-mt-1.5 before:size-1.5 before:rounded-full before:bg-current before:content-['']">
          {lesson.note.text}
        </span>
      )}
      {lesson.note?.kind === "ok" && (
        <span className="inline-flex items-center gap-1 text-[13px] text-text-3 max-sm:col-start-2 max-sm:-mt-1.5">
          <Check size={14} strokeWidth={1.6} />
          {lesson.note.text}
        </span>
      )}
    </Link>
  );
}

export function LaterToday({ lessons, tomorrow }: { lessons: Lesson[]; tomorrow?: Lesson }) {
  return (
    <section aria-label="Дальше сегодня" className="flex flex-col">
      <SectionHeader title="Дальше сегодня" linkLabel="Неделя" href="/time?view=week" />
      {lessons.map((l) => (
        <Row key={l.id} lesson={l} />
      ))}
      {tomorrow && (
        <div className="mt-auto pt-3 text-sm text-text-3">
          Завтра первая пара в <b className="font-medium text-text-2">{tomorrow.start}</b> —{" "}
          {tomorrow.title}
        </div>
      )}
    </section>
  );
}
