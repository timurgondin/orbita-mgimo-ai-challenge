"use client";

import { BadgeCheck, CalendarClock, ChevronRight, DoorOpen, FileText, Plane, UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { H1, H2 } from "./ui";

const SERVICES = [
  { icon: CalendarClock, title: "Перенос занятия", sub: "Студенты получат уведомление" },
  { icon: DoorOpen, title: "Бронирование аудитории", sub: "Консультация, пересдача, встреча" },
  { icon: FileText, title: "Справка с места работы", sub: "PDF с QR, за 1 день" },
  { icon: Plane, title: "Командировка", sub: "Конференция, стажировка" },
  { icon: UserPlus, title: "Пропуск для гостя", sub: "Лектор, оппонент, партнёр" },
];

/** Офис преподавателя: ведомости курсов и заявки в учебный офис (каркас). */
export function TeachOffice({ sheets }: { sheets: { slug: string; title: string; color: string; students: number; when: string }[] }) {
  const { toast, node } = useToast();
  return (
    <>
      <h1 className={H1}>Офис</h1>
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Ведомости">
          <h2 className={`${H2} mb-2`}>Ведомости</h2>
          <div className="rows [--row-inset:0px]">
            {sheets.map((s) => (
              <div key={s.slug} className="flex items-center gap-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-2 font-medium">
                    <i className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${s.color})` }} />
                    <span className="truncate">{s.title}</span>
                  </b>
                  <small className="block pl-3.5 text-[13.5px] text-text-3">{s.students} студентов, экзамен</small>
                </span>
                <span className="text-right whitespace-nowrap">
                  <span className="block text-sm text-text-2">Откроется</span>
                  <small className="text-[13px] text-text-3">{s.when}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Заявки">
          <h2 className={`${H2} mb-2`}>Заявки</h2>
          {SERVICES.map(({ icon: Icon, title, sub }) => (
            <button
              key={title}
              type="button"
              onClick={() => toast("Заявка отправлена в учебный офис")}
              className="-mx-3 flex w-[calc(100%+24px)] items-center gap-3.5 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-hover"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-s1 text-text-2">
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block font-medium">{title}</b>
                <small className="text-[13.5px] text-text-3">{sub}</small>
              </span>
              <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
            </button>
          ))}
          <div className="mt-6 flex items-center gap-2 text-[13px] text-text-3">
            <BadgeCheck size={15} strokeWidth={1.6} />
            Учебный офис, каб. 104, пн–пт 10:00–18:00
          </div>
        </section>
      </div>
      {node}
    </>
  );
}
