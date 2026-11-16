import Link from "next/link";
import { formatDuration, toMinutes } from "@/lib/demo-clock";
import { kindAt } from "@/lib/phrases";
import { TeacherAvatar } from "@/components/ui/teacher-avatar";
import type { Lesson } from "@/server/data/types";
import { DotField } from "./dot-field";

/** Карточка «Сейчас» (идёт пара) или «Дальше» (пара ещё не началась). Всё считается из расписания. */
export function NowCard({ lesson, nowMinutes }: { lesson: Lesson; nowMinutes: number }) {
  const start = toMinutes(lesson.start);
  const end = toMinutes(lesson.end);
  const ongoing = nowMinutes >= start && nowMinutes < end;
  const progress = ongoing ? Math.round(((nowMinutes - start) / (end - start)) * 100) : 0;
  const left = ongoing ? `ещё ${formatDuration(end - nowMinutes)}` : `через ${formatDuration(start - nowMinutes)}`;

  return (
    <Link
      href="#"
      aria-label={`Текущая пара: ${lesson.title}`}
      className="relative flex min-h-[244px] flex-col overflow-hidden rounded-[26px] bg-s1 px-7 pt-[26px] pb-6 transition-colors duration-200 hover:bg-s2"
    >
      <DotField />
      <div className="relative flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-text-2">
          <span className="live-dot size-[7px] rounded-full bg-text [animation:blink_2.4s_ease-in-out_infinite]" />
          {ongoing ? "Сейчас" : "Дальше"}
        </span>
        <span className="text-text-3 tabular-nums">{left}</span>
      </div>
      <div className="relative mt-auto text-[30px] leading-[1.1] font-semibold tracking-[-.03em]">
        {lesson.title}
      </div>
      <div className="relative mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[15px] text-text-2">
        <span>{kindAt(lesson.format, lesson.place)}</span>
        {lesson.teacher && (
          <span className="flex items-center gap-2">
            <TeacherAvatar name={lesson.teacher} size={22} />
            {lesson.teacher}
          </span>
        )}
      </div>
      <div className="relative mt-[22px]">
        <div className="h-[3px] overflow-hidden rounded-[3px] bg-s3">
          <div className="h-full rounded-[3px] bg-text" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[13px] text-text-3">
          <span>{lesson.start}</span>
          <span>{lesson.end}</span>
        </div>
      </div>
    </Link>
  );
}
