"use client";

import Link from "next/link";
import { BookOpen, CalendarClock, ChevronRight, MapPin, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskDetail } from "@/server/data/types";
import { StatusTag } from "./status-tag";

/** Текст задания: абзацы через пустую строку, строки с «- » — пункты списка. */
function Description({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-text-2">
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n");
        return lines.every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="flex flex-col gap-1">
            {lines.map((l) => (
              <li key={l} className="flex gap-2.5 before:mt-[11px] before:size-1 before:shrink-0 before:rounded-full before:bg-text-3 before:content-['']">
                {l.slice(2)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block}</p>
        );
      })}
    </div>
  );
}

const IconBox = ({ children }: { children: React.ReactNode }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-s3 text-text-2">{children}</span>
);

function Row({ icon, title, sub, href }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const inner = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <b className="block font-medium">{title}</b>
        {sub && <small className="text-[13px] text-text-3">{sub}</small>}
      </span>
      {href && <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />}
    </>
  );
  const cls = "flex items-center gap-3.5 border-t-[.5px] border-line py-3 first:border-t-0";
  return href ? (
    <Link href={href} className={cn(cls, "-mx-2 rounded-xl px-2 transition-colors duration-150 hover:bg-hover")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Трекер этапов «как у посылки» (как у заявок в «Офисе»). */
function Steps({ steps }: { steps: NonNullable<TaskDetail["steps"]> }) {
  return (
    <div className="grid grid-cols-4" aria-label="Этапы">
      {steps.map((s) => (
        <span key={s.label} className="flex flex-col gap-2">
          <span className="mr-1 block h-1 overflow-hidden rounded bg-s3">
            <i className={cn("block h-full rounded bg-text", s.state === "fin" ? "w-full" : s.state === "cur" ? "step-cur" : "w-0")} />
          </span>
          <b className={cn("text-[13px] font-medium", s.state === "todo" ? "text-text-3" : "text-text")}>{s.label}</b>
          <small className="-mt-1.5 min-h-4 text-xs text-text-3">{s.when}</small>
        </span>
      ))}
    </div>
  );
}

/** Содержимое окна задания (элемента оценки): срок, этапы, что сделать, оценка и отзыв. */
export function TaskContent({ t, showCourse = true }: { t: TaskDetail; showCourse?: boolean }) {
  return (
    <>
      <div className="text-sm text-text-2">{t.kindLabel}</div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{t.title}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {t.tag && <StatusTag status={t.tag} />}
        {t.dueLeft && <span className={cn("text-sm", t.dueHot ? "text-urgent" : "text-text-2")}>Срок {t.dueLeft}</span>}
      </div>

      {t.score != null && (
        <div className="mt-5 flex items-end gap-3">
          <b className="text-[44px] leading-none font-medium tracking-[-.035em] tabular-nums">{t.score}</b>
          <span className="pb-1 text-[15px] text-text-2">из 10{t.gradedAt && `, проверено ${t.gradedAt}`}</span>
        </div>
      )}
      {t.feedback && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-s2 px-4 py-3.5">
          <span className="mono mt-px grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: t.teacher.gradient }}>
            {t.teacher.initials}
          </span>
          <span className="min-w-0">
            <small className="block text-[13px] text-text-3">{t.teacher.name}</small>
            <span className="text-[15px]">{t.feedback}</span>
          </span>
        </div>
      )}

      {t.steps && t.score == null && (
        <div className="mt-5">
          <Steps steps={t.steps} />
        </div>
      )}

      {t.description && (
        <section className="mt-6">
          <h3 className="mb-2 text-[15px] font-semibold">{t.score != null ? "Задание" : "Что сделать"}</h3>
          <Description text={t.description} />
        </section>
      )}

      <div className="mt-5">
        {t.dueLong && <Row icon={<IconBox><CalendarClock size={16} strokeWidth={1.6} /></IconBox>} title={t.dueLong} sub={t.submittedAt ? `Сдано ${t.submittedAt}` : "Срок"} />}
        <Row icon={<IconBox><Target size={16} strokeWidth={1.6} /></IconBox>} title={`${t.weight}% итоговой оценки`} sub={t.kind === "participation" ? "Складывается из занятий" : undefined} />
        {t.room && (
          <Row
            icon={<IconBox><MapPin size={16} strokeWidth={1.6} /></IconBox>}
            title={`Аудитория ${t.room}`}
            sub={t.eventId ? "Открыть в расписании" : undefined}
            href={t.eventId ? `/time?open=${t.eventId}` : undefined}
          />
        )}
        {showCourse && (
          <Row
            icon={<IconBox><BookOpen size={16} strokeWidth={1.6} /></IconBox>}
            title={t.courseTitle}
            sub="Страница курса"
            href={`/study/${t.courseSlug}`}
          />
        )}
      </div>
    </>
  );
}
