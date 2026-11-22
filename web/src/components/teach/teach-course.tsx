"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, FolderOpen, Plus, Search, Upload, X } from "lucide-react";
import { Switch } from "@/components/profile/privacy";
import { Modal } from "@/components/time/modal";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import { assignAssistant, removeAssistant, searchAssistants, updateAssistant } from "@/server/teach/actions";
import type { Candidate, TeachCoursePage, TeamMember } from "@/server/data/teach-types";
import { BTN, BTN_SMALL, FIELD, H1, H2 } from "./ui";

const Mono = ({ initials, gradient, size = 40 }: { initials: string; gradient: string; size?: number }) => (
  <span aria-hidden="true" className="mono grid shrink-0 place-items-center rounded-full font-semibold" style={{ background: gradient, width: size, height: size, fontSize: Math.round(size * 0.36) }}>
    {initials}
  </span>
);

function Rights({ review, grade, onReview, onGrade }: { review: boolean; grade: boolean; onReview: () => void; onGrade: () => void }) {
  return (
    <div className="rows mt-2 [--row-inset:0px]">
      <div className="flex items-center justify-between gap-4 py-3">
        <span className="text-[15px]">Проверять работы</span>
        <Switch on={review} label="Проверять работы" onClick={onReview} />
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        <span className="text-[15px]">Ставить оценки в журнал</span>
        <Switch on={grade} label="Ставить оценки в журнал" onClick={onGrade} />
      </div>
    </div>
  );
}

/** Окно «Назначить ассистента»: поиск старшекурсника или магистранта, права — переключателями. */
function AssignContent({ slug, toast, onDone }: { slug: string; toast: (t: string, tone?: "ok" | "error") => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Candidate[]>([]);
  const [pick, setPick] = useState<Candidate | null>(null);
  const [review, setReview] = useState(true);
  const [grade, setGrade] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => searchAssistants(slug, q).then((r) => live && setList(r)), 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, slug]);

  if (pick) {
    return (
      <>
        <button type="button" onClick={() => setPick(null)} className="-ml-1 inline-flex items-center gap-1 text-sm text-text-3 hover:text-text">
          <ChevronLeft size={16} strokeWidth={1.6} />
          Другой студент
        </button>
        <div className="mt-4 flex items-center gap-3">
          <Mono initials={pick.initials} gradient={pick.gradient} size={44} />
          <span>
            <b className="block text-[17px] font-semibold">{pick.name}</b>
            <small className="text-[13px] text-text-3">{pick.line}</small>
          </span>
        </div>
        <Rights review={review} grade={grade} onReview={() => setReview(!review)} onGrade={() => setGrade(!grade)} />
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={pending}
            data-assign-confirm
            className={BTN}
            onClick={() =>
              start(async () => {
                const r = await assignAssistant(slug, pick.id, review, grade);
                if (!r.ok) return toast(r.error, "error");
                toast(r.message);
                onDone();
                router.refresh();
              })
            }
          >
            Назначить
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="text-[22px] font-semibold tracking-[-.02em]">Ассистент курса</div>
      <div className="relative mt-4">
        <Search size={16} strokeWidth={1.7} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Фамилия или имя"
          aria-label="Найти студента"
          className={cn(FIELD, "pl-10")}
        />
      </div>
      <div className="mt-2 min-h-[220px]">
        {list.map((c) => (
          <button key={c.id} type="button" onClick={() => setPick(c)} data-candidate={c.id} className="-mx-3 flex w-[calc(100%+24px)] items-center gap-3 rounded-[14px] px-3 py-2.5 text-left hover:bg-hover">
            <Mono initials={c.initials} gradient={c.gradient} size={36} />
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{c.name}</b>
              <small className="block truncate text-[13px] text-text-3">{c.line}</small>
            </span>
            <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
          </button>
        ))}
        {!list.length && <p className="py-3 text-[15px] text-text-3">Никого не нашли</p>}
      </div>
    </>
  );
}

function AssistantContent({ m, toast, onDone }: { m: TeamMember; toast: (t: string, tone?: "ok" | "error") => void; onDone: () => void }) {
  const [review, setReview] = useState(m.assistant!.canReview);
  const [grade, setGrade] = useState(m.assistant!.canGrade);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (r: boolean, g: boolean) => {
    setReview(r);
    setGrade(g);
    start(async () => {
      const res = await updateAssistant(m.id, r, g);
      if (!res.ok) toast(res.error, "error");
      router.refresh();
    });
  };
  return (
    <>
      <div className="flex items-center gap-3">
        <Mono initials={m.initials} gradient={m.gradient} size={44} />
        <span className="min-w-0">
          <b className="block text-[17px] font-semibold">{m.name}</b>
          <small className="text-[13px] text-text-3">
            {m.role.replace(/^Ассистент, /, "")}, {m.assistant!.since}
          </small>
        </span>
      </div>
      <Rights review={review} grade={grade} onReview={() => save(!review, grade)} onGrade={() => save(review, !grade)} />
      <div className="mt-5 flex items-center justify-between">
        {m.href && (
          <Link href={m.href} className="text-sm text-text-3 hover:text-text">
            Карточка
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await removeAssistant(m.id);
              if (!r.ok) return toast(r.error, "error");
              toast(r.message);
              onDone();
              router.refresh();
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-urgent hover:bg-hover"
        >
          <X size={15} strokeWidth={1.8} />
          Снять с курса
        </button>
      </div>
    </>
  );
}

type Dlg = { kind: "assign" } | { kind: "assistant"; id: string } | null;

/** Курс глазами преподавателя: цифры, формула, задания со сдачей, материалы (заглушка), команда с ассистентами. */
export function TeachCourse({ d }: { d: TeachCoursePage }) {
  const [dlg, setDlg] = useState<Dlg>(null);
  const [open, setOpen] = useState(false);
  const { toast, node } = useToast();
  const show = (x: NonNullable<Dlg>) => {
    setDlg(x);
    setOpen(true);
  };
  const member = dlg?.kind === "assistant" ? d.team.find((m) => m.id === dlg.id) : undefined;
  const assistants = d.team.filter((m) => m.assistant).length;

  return (
    <div style={{ "--cc": `var(--c-${d.color})` } as React.CSSProperties}>
      <Link href="/study" className="-ml-1 inline-flex items-center gap-1 text-sm text-text-3 hover:text-text">
        <ChevronLeft size={16} strokeWidth={1.6} />
        Курсы
      </Link>
      <div className="mt-3 flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-[15px] text-text-2">
            <i className="size-2 rounded-full bg-(--cc)" />
            {d.kindLabel}
          </div>
          <h1 className={cn(H1, "mt-1")}>{d.title}</h1>
          <div className="mt-1 text-[15px] text-text-3">{d.groups}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/study?tab=journal" className={BTN_SMALL}>
            Журнал
          </Link>
          <Link href="/study?tab=review" className={BTN_SMALL}>
            Проверка
            {d.toReview > 0 && <span className="rounded-full bg-accent px-1.5 text-[11.5px] leading-[18px] font-semibold text-white tabular-nums">{d.toReview}</span>}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-4 gap-4 max-[800px]:grid-cols-2">
        {[
          [String(d.students), plural(d.students, "студент", "студента", "студентов")],
          [String(d.toReview), "на проверке"],
          [String(d.credits), plural(d.credits, "кредит", "кредита", "кредитов")],
          [d.assessment, "в конце семестра"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-3xl bg-s1 px-5 py-4">
            <b className="block text-2xl font-medium tracking-[-.02em] tabular-nums">{v}</b>
            <small className="text-[13px] text-text-3">{l}</small>
          </div>
        ))}
      </div>

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-12 min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <section aria-label="Задания">
            <div className="mb-2 flex items-center justify-between">
              <h2 className={H2}>Задания</h2>
              <button type="button" onClick={() => toast("Черновик задания создан")} className={BTN_SMALL}>
                <Plus size={15} strokeWidth={1.8} />
                Задание
              </button>
            </div>
            <div className="rows [--row-inset:0px]">
              {d.tasks.map((t) => (
                <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-4 py-3 max-sm:grid-cols-[minmax(0,1fr)_96px]">
                  <span className="min-w-0">
                    <b className={cn("block truncate font-medium", !t.open && "text-text-2")}>{t.title}</b>
                    <small className="text-[13px] text-text-3">{t.due ? `Срок ${t.due.charAt(0).toLowerCase()}${t.due.slice(1)}` : "Без срока"}</small>
                  </span>
                  <span>
                    <span className="flex justify-between text-[13px] text-text-3 tabular-nums">
                      <span>Сдали {t.sent}</span>
                      <span>из {t.total}</span>
                    </span>
                    <ProgressBar value={t.total ? Math.round((t.sent / t.total) * 100) : 0} label="Сдали" fill="var(--cc)" className="mt-1.5 h-1" />
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Материалы" className="mt-12">
            <div className="mb-2 flex items-center justify-between">
              <h2 className={H2}>Материалы</h2>
              <button type="button" onClick={() => toast("Файл добавлен в черновики")} className={BTN_SMALL}>
                <Upload size={15} strokeWidth={1.8} />
                Загрузить
              </button>
            </div>
            {d.materials.map((g) => (
              <div key={g.title} className="mt-3">
                <div className="mb-1 flex items-center gap-2 text-[13px] text-text-3">
                  <FolderOpen size={14} strokeWidth={1.6} />
                  {g.title}
                </div>
                <div className="rows [--row-inset:0px]">
                  {g.items.map((it) => (
                    <div key={it} className="flex items-center gap-3 py-2.5">
                      <FileText size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                      <span className="min-w-0 flex-1 truncate">{it}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        <div>
          <section aria-label="Формула оценки">
            <h2 className={cn(H2, "mb-3")}>Формула оценки</h2>
            <div className="flex h-2 gap-[3px]" aria-hidden="true">
              {d.formula.map((f, i) => (
                <i key={f.title} className="block rounded-sm" style={{ flex: f.weight, background: `color-mix(in srgb, var(--cc) ${100 - i * 22}%, var(--s3))` }} />
              ))}
            </div>
            <div className="rows mt-2 [--row-inset:0px]">
              {d.formula.map((f) => (
                <div key={f.title} className="flex items-center justify-between gap-3 py-2.5">
                  <span>{f.title}</span>
                  <span className="text-text-2 tabular-nums">{f.weight}%</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Команда" className="mt-12">
            <div className="mb-2 flex items-center justify-between">
              <h2 className={H2}>Команда</h2>
              <button type="button" onClick={() => show({ kind: "assign" })} className={BTN_SMALL} data-assign>
                <Plus size={15} strokeWidth={1.8} />
                Ассистент
              </button>
            </div>
            <div className="rows [--row-inset:0px]" data-team>
              {d.team.map((m) => {
                const inner = (
                  <>
                    <Mono initials={m.initials} gradient={m.gradient} size={36} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{m.name}</b>
                      <small className="block truncate text-[13px] text-text-3">{m.role}</small>
                    </span>
                    {m.assistant && (
                      <span className="text-[13px] whitespace-nowrap text-text-3">{m.assistant.canGrade ? "Проверка и журнал" : m.assistant.canReview ? "Проверка" : "Без прав"}</span>
                    )}
                    <ChevronRight size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                  </>
                );
                return m.assistant ? (
                  <button key={m.id} type="button" data-assistant={m.id} onClick={() => show({ kind: "assistant", id: m.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
                    {inner}
                  </button>
                ) : (
                  <Link key={m.id} href={m.href ?? "#"} className="flex items-center gap-3 py-2.5">
                    {inner}
                  </Link>
                );
              })}
            </div>
            {!assistants && <p className="pt-2 text-[13px] text-text-3">Ассистентов нет</p>}
          </section>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} accent={`var(--c-${d.color})`} cover={false} title={dlg?.kind === "assign" ? "Назначить ассистента" : "Ассистент"} width={460}>
        {dlg?.kind === "assign" && <AssignContent key={String(open)} slug={d.slug} toast={toast} onDone={() => setOpen(false)} />}
        {member && <AssistantContent key={member.id} m={member} toast={toast} onDone={() => setOpen(false)} />}
      </Modal>
      {node}
    </div>
  );
}
