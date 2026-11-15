"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, Apple, BookOpen, Calendar, ChevronRight, FileSearch, FolderOpen, Mail, MapPin, Navigation, Target, UsersRound, Video } from "lucide-react";
import { BELLS } from "@/lib/bells";
import { cn } from "@/lib/utils";
import { cancel, signUp, updateQuestion } from "@/server/consultations/actions";
import type { TimeConsultation, TimeLesson } from "@/server/data/types";
import { DOWL, cap, dayMonth, roomHint } from "./helpers";
import { isFull } from "./cons-view";

export type Toast = (text: string, tone?: "ok" | "error") => void;

const weekday = (iso: string) => cap(DOWL[(new Date(`${iso}T12:00:00+03:00`).getUTCDay() + 6) % 7]);

function Row({ icon, title, sub, action, link }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; link?: boolean }) {
  const Tag = link ? "a" : "div";
  return (
    <Tag className={cn("flex items-center gap-3.5 border-t-[.5px] border-line py-3 first:border-t-0", link && "cursor-pointer")} {...(link ? { href: "#", onClick: (e: React.MouseEvent) => e.preventDefault() } : {})}>
      {icon}
      <span className="min-w-0 flex-1">
        <b className="block font-medium">{title}</b>
        {sub && <small className="text-[13px] text-text-3">{sub}</small>}
      </span>
      {action}
      {link && <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />}
    </Tag>
  );
}

const IconBox = ({ children }: { children: React.ReactNode }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-s3 text-text-2">{children}</span>
);
const Avatar = ({ initials, gradient }: { initials: string; gradient: string }) => (
  <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-[#1d1d20]" style={{ background: gradient }}>
    {initials}
  </span>
);
const Act = ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
  <button type="button" disabled={disabled} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s3 px-3 text-[13px] font-medium disabled:cursor-default disabled:opacity-45">
    {children}
  </button>
);

export function LessonContent({ lesson: l }: { lesson: TimeLesson }) {
  const [s, e] = BELLS[l.pair];
  return (
    <>
      <div className="text-sm text-text-2">
        {l.pair} пара · {l.kindLabel}
        {l.topic ? ` · ${l.topic}` : ""}
      </div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{l.title}</div>
      <div className="mt-1.5 text-[15px] text-text-2">
        {weekday(l.date)}, {dayMonth(l.date)} · {s}–{e}
      </div>
      {l.roomFrom && (
        <div className="mt-4 flex items-center gap-2.5 rounded-[14px] bg-[color-mix(in_srgb,var(--urgent)_12%,transparent)] px-3.5 py-3 text-sm font-medium text-urgent">
          <ArrowRightLeft size={16} strokeWidth={1.6} />
          Аудитория изменена: {l.roomFrom} → {l.room}
        </div>
      )}
      <div className="mt-4">
        <Row icon={<IconBox><MapPin size={16} strokeWidth={1.6} /></IconBox>} title={`Аудитория ${l.room}`} sub={roomHint(l.room)} action={<Act><Navigation size={14} strokeWidth={1.6} />Как пройти</Act>} />
        <Row icon={<Avatar initials={l.teacherInitials} gradient={l.teacherGradient} />} title={l.teacher} sub="Преподаватель" action={<Act><Mail size={14} strokeWidth={1.6} />Написать</Act>} />
        {l.test && (
          <>
            <Row link icon={<IconBox><Target size={16} strokeWidth={1.6} /></IconBox>} title={`${l.test.weight}% итоговой оценки`} sub={l.test.score ? `Сейчас ${l.test.score}` : undefined} />
            <Row link icon={<IconBox><FileSearch size={16} strokeWidth={1.6} /></IconBox>} title="Демо-вариант" sub="PDF · 4 задачи" />
          </>
        )}
        <Row link icon={<IconBox><FolderOpen size={16} strokeWidth={1.6} /></IconBox>} title="Материалы к занятию" sub="3 файла" />
        <Row link icon={<IconBox><BookOpen size={16} strokeWidth={1.6} /></IconBox>} title={l.courseTitle} sub="Страница курса" />
      </div>
    </>
  );
}

export function ConsContent({ cons: c, toast, onDone }: { cons: TimeConsultation; toast: Toast; onDone: () => void }) {
  const [q, setQ] = useState(c.myQuestion);
  const [pending, start] = useTransition();
  const [s, e] = BELLS[c.pair];
  const full = isFull(c);

  const run = (fn: () => ReturnType<typeof signUp>, close = true) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok && close) onDone();
    });

  return (
    <>
      <div className="text-sm text-text-2">Консультация · {c.courseTitle}</div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{c.teacher}</div>
      <div className="mt-1.5 text-[15px] text-text-2">
        {weekday(c.date)}, {dayMonth(c.date)} · {s}–{e}
      </div>
      <div className="mt-4">
        <Row
          icon={<IconBox>{c.online ? <Video size={16} strokeWidth={1.6} /> : <MapPin size={16} strokeWidth={1.6} />}</IconBox>}
          title={c.place}
          sub={c.online ? "Видеовстреча" : roomHint(c.place.replace(/^\D+/, ""))}
          action={
            c.online ? (
              <Act disabled><Video size={14} strokeWidth={1.6} />Подключиться</Act>
            ) : (
              <Act><Navigation size={14} strokeWidth={1.6} />Как пройти</Act>
            )
          }
        />
        <Row icon={<IconBox><UsersRound size={16} strokeWidth={1.6} /></IconBox>} title={`${c.count} из ${c.capacity}`} sub={`${c.questions} ${plural(c.questions)} уже прислали`} />
      </div>
      <label htmlFor="cons-q" className="mt-[18px] block text-sm text-text-2">
        Ваш вопрос
      </label>
      <textarea
        id="cons-q"
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        maxLength={500}
        placeholder="Что хотите разобрать"
        disabled={full || c.past}
        className="mt-1.5 min-h-[84px] w-full resize-none rounded-[14px] bg-s1 px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-3 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)] disabled:opacity-60"
      />
      <div className="mt-5 flex items-center justify-between gap-3">
        {c.going ? (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => cancel(c.id))} className="text-sm text-text-3 hover:text-text disabled:opacity-50">
              Отменить запись
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => updateQuestion(c.id, q))} className={white}>
              Сохранить
            </button>
          </>
        ) : full || c.past ? (
          <>
            <span />
            <span className={cn(white, "pointer-events-none bg-transparent text-text-3 shadow-[inset_0_0_0_1px_var(--line)]")}>{c.past ? "Запись закрыта" : "Мест нет"}</span>
          </>
        ) : (
          <>
            <span />
            <button type="button" disabled={pending} onClick={() => run(() => signUp(c.id, q))} className={white}>
              Записаться
            </button>
          </>
        )}
      </div>
    </>
  );
}

const white =
  "inline-flex h-[46px] items-center rounded-[14px] bg-text px-[22px] text-[15px] font-semibold whitespace-nowrap text-bg transition-transform duration-150 active:scale-[.97] disabled:opacity-60";

function plural(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? "вопрос" : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "вопроса" : "вопросов";
}

export function SyncContent({ link, toast }: { link: string; toast: Toast }) {
  const [on, setOn] = useState({ lessons: true, cons: true, deadlines: true });
  const copy = () => {
    navigator.clipboard?.writeText(link).catch(() => {});
    toast("Ссылка скопирована");
  };
  const tg = (k: keyof typeof on, label: string) => (
    <div className="flex items-center justify-between border-t-[.5px] border-line py-[13px] text-[15px] first:border-t-0">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={on[k]}
        aria-label={label}
        onClick={() => setOn((p) => ({ ...p, [k]: !p[k] }))}
        className={cn("relative h-[26px] w-11 rounded-full transition-colors duration-200", on[k] ? "bg-(--st-green)" : "bg-s3")}
      >
        <span className={cn("absolute top-[3px] left-[3px] size-5 rounded-full bg-white transition-transform duration-300 ease-spring", on[k] && "translate-x-[18px]")} />
      </button>
    </div>
  );
  const big = "flex h-12 items-center justify-center gap-[9px] rounded-[14px] bg-s1 font-medium transition-colors duration-150 hover:bg-s3";
  return (
    <>
      <div className="text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">Синхронизация календаря</div>
      <div className="mt-[18px] grid grid-cols-2 gap-2">
        <button type="button" className={big} onClick={() => toast("Добавлено в Google Календарь")}><Calendar size={16} strokeWidth={1.6} />Google</button>
        <button type="button" className={big} onClick={() => toast("Добавлено в Apple Календарь")}><Apple size={16} strokeWidth={1.6} />Apple</button>
      </div>
      <div className="mt-[18px] text-sm text-text-2">Ссылка для подписки</div>
      <div className="mt-2 flex h-12 items-center gap-2 rounded-[14px] bg-s1 pr-1.5 pl-3.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-text-2">{link}</code>
        <button type="button" onClick={copy} className="h-9 rounded-[10px] bg-s3 px-3 text-[13.5px] font-medium">Скопировать</button>
      </div>
      <div className="mt-3.5">
        {tg("lessons", "Пары")}
        {tg("cons", "Консультации")}
        {tg("deadlines", "Дедлайны")}
        <div className="flex items-center justify-between border-t-[.5px] border-line py-[13px] text-[15px]">
          <label htmlFor="remind">Напоминание</label>
          <select id="remind" defaultValue="15" className="h-[34px] rounded-[10px] bg-s3 px-2.5 text-sm text-text">
            <option value="15">За 15 минут</option>
            <option value="30">За 30 минут</option>
            <option value="60">За час</option>
            <option value="0">Без напоминания</option>
          </select>
        </div>
      </div>
    </>
  );
}


