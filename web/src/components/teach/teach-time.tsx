"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, MapPin, MessageCircleQuestion, Plus, UsersRound } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { ScheduleView, type Item, type View } from "@/components/time/schedule-view";
import { DOW, cap, dayMonth, dowIndex } from "@/components/time/helpers";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { BELLS, PAIRS } from "@/lib/bells";
import { DEMO_DATE, addDays } from "@/lib/demo-clock";
import { cn } from "@/lib/utils";
import { addConsultation } from "@/server/teach/actions";
import type { TeachConsultation, TeachLesson } from "@/server/data/teach-types";
import type { TimeConsultation, TimeLesson } from "@/server/data/types";
import { BTN, BTN_SMALL, FIELD, H1, H2 } from "./ui";

type Tab = "sched" | "cons";
const WEEK_MIN = -3;
const WEEK_MAX = 3;
const url = (tab: Tab, view: View, w: number) => {
  const q = new URLSearchParams();
  if (tab === "cons") q.set("tab", "cons");
  if (view === "week") q.set("view", "week");
  if (w) q.set("w", String(w));
  const s = q.toString();
  return s ? `/time?${s}` : "/time";
};

// Сетка «Времени» общая со студентом: пара преподавателя — та же строка, вместо преподавателя — группа
const toLesson = (l: TeachLesson): TimeLesson => ({
  id: l.id, date: l.date, pair: l.pair, start: l.start, end: l.end, color: l.color, courseTitle: l.title, title: l.title, isTest: false,
  kind: "seminar", kindLabel: l.kindLabel, room: l.room, teacher: l.group, teacherInitials: "", teacherGradient: "", teacherSlug: null, courseSlug: l.slug ?? "", prep: null,
});
const toCons = (c: TeachConsultation): TimeConsultation => ({
  id: c.id, date: c.date, pair: c.pair, start: c.start, end: c.end, color: c.color, courseId: "", courseTitle: c.courseTitle, teacher: "", teacherInitials: "", teacherGradient: "",
  place: c.place, online: /онлайн/i.test(c.place), count: c.count, capacity: c.capacity, questions: c.questions.length, going: true, myQuestion: "", past: c.date < DEMO_DATE,
  note: `Записались ${c.count} из ${c.capacity}`,
});

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-s1 text-text-2">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function LessonInfo({ l }: { l: TeachLesson }) {
  return (
    <>
      <div className="text-[13px] text-text-3">
        {cap(new Date(`${l.date}T12:00:00+03:00`).toLocaleDateString("ru-RU", { weekday: "long", timeZone: "Europe/Moscow" }))}, {dayMonth(l.date)}, с {l.start} до {l.end}
      </div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{l.title}</div>
      <div className="mt-1 text-[15px] text-text-2">{l.kindLabel}</div>
      <div className="mt-4">
        <Line icon={<UsersRound size={16} strokeWidth={1.6} />}>
          <b className="block font-medium">{l.group || "Группа"}</b>
          {l.students != null && <small className="text-[13px] text-text-3">{l.students} в Орбите</small>}
        </Line>
        <Line icon={<MapPin size={16} strokeWidth={1.6} />}>
          <b className="block font-medium">Аудитория {l.room}</b>
          <small className="text-[13px] text-text-3">Корпус {l.room[0]}, {l.room[1]} этаж</small>
        </Line>
      </div>
      {l.slug && (
        <Link href={`/study/${l.slug}`} className="mt-4 flex items-center justify-between rounded-[16px] bg-s1 px-4 py-3.5 font-medium hover:bg-s3">
          Страница курса
          <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
        </Link>
      )}
    </>
  );
}

function ConsInfo({ c }: { c: TeachConsultation }) {
  return (
    <>
      <div className="text-[13px] text-text-3">
        {dayMonth(c.date)}, с {c.start} до {c.end}
      </div>
      <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">Консультация</div>
      <div className="mt-1 text-[15px] text-text-2">{c.courseTitle}</div>
      <div className="mt-4">
        <Line icon={<MapPin size={16} strokeWidth={1.6} />}>
          <b className="block font-medium">{c.place}</b>
        </Line>
        <Line icon={<UsersRound size={16} strokeWidth={1.6} />}>
          <b className="block font-medium">
            Записались {c.count} из {c.capacity}
          </b>
        </Line>
      </div>
      {c.questions.length > 0 && (
        <>
          <h3 className="mt-5 mb-1 text-[15px] font-semibold">Вопросы</h3>
          <div className="rows [--row-inset:0px]">
            {c.questions.map((q, i) => (
              <div key={i} className="py-2.5">
                <small className="text-[13px] text-text-3">{q.name}</small>
                <p className="text-[15px]">{q.text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Новый слот: курс, день недели, пара, место и число мест. */
function AddCons({ courses, monday, onDone, toast }: { courses: { id: string; title: string }[]; monday: string; onDone: () => void; toast: (t: string, tone?: "ok" | "error") => void }) {
  const days = Array.from({ length: 12 }, (_, i) => addDays(monday, i)).filter((d) => d > DEMO_DATE && new Date(`${d}T12:00:00+03:00`).getUTCDay() !== 0).slice(0, 6);
  const [course, setCourse] = useState(courses[0]?.id ?? "");
  const [day, setDay] = useState(days[0]);
  const [pair, setPair] = useState(5);
  const [place, setPlace] = useState("Каб. 518");
  const [capacity, setCapacity] = useState(8);
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = "mt-4 mb-1.5 block text-sm text-text-2";
  return (
    <>
      <div className="text-[22px] font-semibold tracking-[-.02em]">Новая консультация</div>
      <label className={label} htmlFor="c-course">
        Курс
      </label>
      <select id="c-course" value={course} onChange={(e) => setCourse(e.target.value)} className={FIELD}>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <div className={label}>День</div>
      <div className="grid grid-cols-6 gap-1" role="group" aria-label="День">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={day === d}
            onClick={() => setDay(d)}
            className={cn("flex h-[54px] flex-col items-center justify-center rounded-[12px] text-[13px] transition-colors", day === d ? "bg-text text-bg" : "bg-s1 text-text-2 hover:bg-s3")}
          >
            <span>{DOW[dowIndex(monday, d) % 7] ?? ""}</span>
            <b className="text-[15px] font-semibold tabular-nums">{Number(d.slice(8))}</b>
          </button>
        ))}
      </div>
      <label className={label} htmlFor="c-pair">
        Время
      </label>
      <select id="c-pair" value={pair} onChange={(e) => setPair(Number(e.target.value))} className={FIELD}>
        {PAIRS.map((p) => (
          <option key={p} value={p}>
            {BELLS[p][0]}–{BELLS[p][1]}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <div>
          <label className={label} htmlFor="c-place">
            Где
          </label>
          <input id="c-place" value={place} onChange={(e) => setPlace(e.target.value)} autoComplete="off" enterKeyHint="next" className={FIELD} />
        </div>
        <div>
          <label className={label} htmlFor="c-cap">
            Мест
          </label>
          <input id="c-cap" type="number" inputMode="numeric" min={1} max={40} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} autoComplete="off" enterKeyHint="done" className={FIELD} />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={pending}
          className={BTN}
          data-cons-save
          onClick={() =>
            start(async () => {
              const r = await addConsultation(course, day, pair, place, capacity);
              if (!r.ok) return toast(r.error, "error");
              toast(r.message);
              onDone();
              router.refresh();
            })
          }
        >
          Добавить
        </button>
      </div>
    </>
  );
}

type Shown = { type: "lesson" | "cons"; id: string } | { type: "add" } | null;

export function TeachTime({ data }: { data: { baseMonday: string; lessons: TeachLesson[]; consultations: TeachConsultation[]; courses: { id: string; title: string }[]; load: string } }) {
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "cons" ? "cons" : "sched";
  const view: View = params.get("view") === "week" ? "week" : "list";
  const rawW = Number(params.get("w") ?? 0);
  const week = Number.isInteger(rawW) ? Math.min(WEEK_MAX, Math.max(WEEK_MIN, rawW)) : 0;
  const monday = addDays(data.baseMonday, week * 7);
  const [picked, setPicked] = useState<{ w: number; d: number } | null>(null);
  const todayIdx = dowIndex(data.baseMonday, DEMO_DATE);
  const sel = picked && picked.w === week ? picked.d : week === 0 ? Math.min(Math.max(todayIdx, 0), 5) : 0;
  const [shown, setShown] = useState<Shown>(null);
  const [open, setOpen] = useState(false);
  const { toast, node } = useToast();
  const go = (t: Tab, v: View, w: number) => window.history.pushState(null, "", url(t, v, w));
  const show = useCallback((s: NonNullable<Shown>) => {
    setShown(s);
    setOpen(true);
  }, []);

  const wanted = params.get("open");
  useEffect(() => {
    if (!wanted) return;
    const type = data.lessons.some((l) => l.id === wanted) ? "lesson" : data.consultations.some((c) => c.id === wanted) ? "cons" : null;
    if (type) requestAnimationFrame(() => show({ type, id: wanted }));
    window.history.replaceState(null, "", url(tab, view, week));
  }, [wanted, data, show, tab, view, week]);

  const items: Item[] = useMemo(
    () => [
      ...data.lessons.map((l) => ({ type: "lesson" as const, pair: l.pair, lesson: toLesson(l) })),
      ...data.consultations.map((c) => ({ type: "cons" as const, pair: c.pair, cons: toCons(c) })),
    ],
    [data],
  );
  const lesson = shown?.type === "lesson" ? data.lessons.find((l) => l.id === shown.id) : undefined;
  const cons = shown?.type === "cons" ? data.consultations.find((c) => c.id === shown.id) : undefined;
  const upcoming = data.consultations.filter((c) => c.date >= DEMO_DATE);

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-5">
        <div>
          <h1 className={H1}>Время</h1>
          <div className="mt-1 text-[15px] text-text-3">{data.load}</div>
        </div>
        <Segmented
          variant="tabs"
          label="Разделы времени"
          value={tab}
          onChange={(t) => go(t, view, week)}
          items={[
            { id: "sched", label: "Расписание" },
            { id: "cons", label: "Консультации" },
          ]}
        />
      </div>

      <div key={tab} role="tabpanel" className="view-in mt-8">
        {tab === "sched" ? (
          <ScheduleView
            monday={monday}
            week={week}
            sel={sel}
            view={view}
            items={items}
            onWeek={(d) => {
              setPicked(null);
              go(tab, view, Math.min(WEEK_MAX, Math.max(WEEK_MIN, week + d)));
            }}
            onSelect={(d) => {
              setPicked({ w: week, d });
              if (view !== "list") go(tab, "list", week);
            }}
            onView={(v) => go(tab, v, week)}
            onOpen={(it) => show({ type: it.type === "cons" ? "cons" : "lesson", id: it.type === "cons" ? it.cons.id : it.lesson.id })}
            onSync={() => toast("Ссылка на календарь скопирована")}
          />
        ) : (
          <section className="max-w-[760px]" aria-label="Мои консультации">
            <div className="mb-2 flex items-center justify-between">
              <h2 className={H2}>Мои консультации</h2>
              <button type="button" onClick={() => show({ type: "add" })} className={BTN_SMALL} data-cons-add>
                <Plus size={15} strokeWidth={1.8} />
                Слот
              </button>
            </div>
            {upcoming.length ? (
              <div className="rows [--row-inset:0px]">
                {upcoming.map((c) => (
                  <button key={c.id} type="button" onClick={() => show({ type: "cons", id: c.id })} data-cons={c.id} className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 py-3 text-left">
                    <span className="tabular-nums">
                      <b className="block text-[15px] font-medium">{dayMonth(c.date).replace(/ноября/, "нояб").replace(/декабря/, "дек")}</b>
                      <small className="text-[13px] text-text-3">{c.start}</small>
                    </span>
                    <span className="min-w-0">
                      <b className="flex items-center gap-2 font-medium">
                        <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${c.color})` }} />
                        <span className="truncate">{c.courseTitle}</span>
                      </b>
                      <small className="block truncate pl-3.5 text-[13.5px] text-text-3">{c.place}</small>
                    </span>
                    <span className="text-right text-sm whitespace-nowrap text-text-2">
                      {c.count} из {c.capacity}
                      {c.questions.length > 0 && (
                        <small className="flex items-center justify-end gap-1 text-[13px] text-text-3">
                          <MessageCircleQuestion size={13} strokeWidth={1.6} />
                          {c.questions.length}
                        </small>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-3 text-[15px] text-text-3">Консультаций нет</p>
            )}
          </section>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        accent={lesson ? `var(--c-${lesson.color})` : "var(--accent)"}
        cover={shown?.type !== "add"}
        title={lesson?.title ?? (cons ? "Консультация" : "Новая консультация")}
      >
        {lesson && <LessonInfo l={lesson} />}
        {cons && <ConsInfo c={cons} />}
        {shown?.type === "add" && <AddCons key={String(open)} courses={data.courses} monday={data.baseMonday} toast={toast} onDone={() => setOpen(false)} />}
      </Modal>
      {node}
    </>
  );
}
