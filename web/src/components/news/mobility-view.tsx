"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CircleAlert, FileText, Mail, MapPin, Paperclip, Sparkles, X } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { useToast, type Toast } from "@/components/ui/toast";
import { MOBILITY } from "@/lib/announcements";
import { cn } from "@/lib/utils";
import { applyMobility } from "@/server/news/actions";
import type { MobilityPage } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const MAX = 8 * 1024 * 1024;
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);
const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-text px-5 text-[15px] font-medium text-bg transition-[transform,opacity] duration-150 active:scale-[.97] disabled:opacity-40";

/** Строка выбора файла: кнопка открывает системный выбор, рядом — имя и размер. */
function FilePick({ id, title, note, required, pdfOnly, file, onPick, toast }: { id: string; title: string; note: string; required: boolean; pdfOnly: boolean; file: File | null; onPick: (f: File | null) => void; toast: Toast }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3.5 py-3" data-file={id}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px]", file ? "bg-[color-mix(in_srgb,var(--st-green)_16%,transparent)] text-(--st-green)" : "bg-s3 text-text-2")}>
        {file ? <Check size={17} strokeWidth={2} /> : <FileText size={17} strokeWidth={1.6} />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-medium">
          {title}
          {!required && <span className="font-normal text-text-3"> — по желанию</span>}
        </b>
        <small className="block truncate text-[13px] text-text-3">{file ? `${file.name}, ${size(file.size)}` : note}</small>
      </span>
      {file ? (
        <button type="button" aria-label={`Убрать: ${title}`} onClick={() => onPick(null)} className="grid size-8 place-items-center rounded-full text-text-3 hover:bg-hover hover:text-text">
          <X size={16} strokeWidth={1.8} />
        </button>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s3 px-3 text-[13px] font-medium hover:bg-[color-mix(in_srgb,var(--s3)_70%,var(--text)_8%)]">
          <Paperclip size={14} strokeWidth={1.7} />
          Выбрать
        </button>
      )}
      <input
        ref={input}
        type="file"
        name={id}
        hidden
        accept={pdfOnly ? ".pdf,application/pdf" : ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (pdfOnly ? !/\.pdf$/i.test(f.name) : !/\.(pdf|jpe?g|png)$/i.test(f.name)) return toast(pdfOnly ? "Нужен PDF" : "Нужен PDF, JPG или PNG", "error");
          if (f.size > MAX) return toast("Файл больше 8 МБ", "error");
          onPick(f);
        }}
      />
    </div>
  );
}

/** Форма заявки: приоритеты (до трёх), язык, документы. Отправка — server action, проверка всего — на сервере. */
function ApplyForm({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [prio, setPrio] = useState<string[]>([]);
  const [lang, setLang] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const ready = prio.length > 0 && !!lang && MOBILITY.documents.every((d) => !d.required || files[d.id]);

  const toggle = (id: string) =>
    setPrio((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? (toast("Можно выбрать до трёх университетов", "error"), p) : [...p, id]));

  const send = () => {
    const fd = new FormData();
    for (const id of prio) fd.append("priority", id);
    fd.set("lang", lang ?? "");
    for (const [k, f] of Object.entries(files)) if (f) fd.set(k, f);
    start(async () => {
      const r = await applyMobility(fd);
      toast(r.ok ? `${r.message}: ${r.number}` : r.error, r.ok ? "ok" : "error");
      if (r.ok) {
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <div data-apply-form>
      <h2 className="text-[22px] font-semibold tracking-[-.025em]">Заявка на конкурс</h2>
      <p className="mt-1 text-sm text-text-2">{MOBILITY.title}</p>

      <h3 className="mt-6 mb-1 text-[15px] font-semibold">Университеты по приоритету</h3>
      <div className="flex flex-col">
        {MOBILITY.partners.map((p) => {
          const n = prio.indexOf(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={n >= 0}
              data-partner={p.id}
              onClick={() => toggle(p.id)}
              className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                  n >= 0 ? "bg-text text-bg" : "shadow-[inset_0_0_0_1.5px_var(--line)] text-transparent",
                )}
              >
                {n >= 0 ? n + 1 : ""}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate font-medium">{p.name}</b>
                <small className="text-[13px] text-text-3">
                  {p.city}, {p.country}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 mb-2 text-[15px] font-semibold">Чем подтвердишь английский</h3>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Язык">
        {MOBILITY.langs.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className={cn("h-9 rounded-xl px-3.5 text-sm font-medium transition-colors duration-150", lang === l ? "bg-text text-bg" : "bg-s3 text-text-2 hover:text-text")}
          >
            {l}
          </button>
        ))}
      </div>

      <h3 className="mt-6 text-[15px] font-semibold">Документы</h3>
      <div className="rows [--row-inset:0px]">
        {MOBILITY.documents.map((d) => (
          <FilePick
            key={d.id}
            id={d.id}
            title={d.title}
            note={d.id === "cert" ? "PDF, JPG или PNG до 8 МБ" : "PDF до 8 МБ"}
            required={d.required}
            pdfOnly={d.id !== "cert"}
            file={files[d.id] ?? null}
            onPick={(f) => setFiles((x) => ({ ...x, [d.id]: f }))}
            toast={toast}
          />
        ))}
      </div>
      <p className="mt-2 flex items-start gap-2 text-[13px] text-text-3">
        <Sparkles size={14} strokeWidth={1.7} className="mt-0.5 shrink-0" />
        {MOBILITY.auto.join(", ")} Орбита приложит сама
      </p>

      <button type="button" onClick={send} disabled={!ready || pending} data-apply-send className={cn(BTN_PRIMARY, "mt-6 w-full")}>
        {pending ? "Отправляем…" : "Отправить заявку"}
      </button>
    </div>
  );
}

export function MobilityView({ d }: { d: MobilityPage }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast, node } = useToast();
  const m = MOBILITY;

  const cta = (
    <section aria-label="Подача заявки" data-cta className="rounded-3xl bg-s1 p-5">
      {d.application ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--st-green)" }}>
            <Check size={15} strokeWidth={2} />
            Заявка подана
          </span>
          <b className="mt-1 block text-[22px] font-semibold tracking-[-.02em]">{d.application.number}</b>
          <ol className="mt-2 flex flex-col gap-0.5 text-sm text-text-2">
            {d.application.priorities.map((id, i) => (
              <li key={id}>
                {i + 1}. {m.partners.find((p) => p.id === id)?.name}
              </li>
            ))}
          </ol>
          <Link href={`/office?request=${d.application.number}`} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-s3 text-sm font-medium hover:bg-s2">
            Статус в «Офисе»
            <ChevronRight size={15} strokeWidth={1.7} />
          </Link>
        </>
      ) : d.open ? (
        <>
          <span className="text-sm text-text-2">Приём заявок до {m.deadlineLabel}</span>
          <b className="mt-0.5 block text-[28px] leading-tight font-medium tracking-[-.03em]">ещё {d.left}</b>
          <button type="button" onClick={() => setOpen(true)} data-apply-open className={cn(BTN_PRIMARY, "mt-4 w-full")}>
            Подать заявку
          </button>
          {!d.eligible && (
            <p className="mt-3 flex items-start gap-2 text-[13px] text-text-3">
              <CircleAlert size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              Не все требования выполнены — комиссия может отказать
            </p>
          )}
        </>
      ) : (
        <b className="block text-[17px] font-semibold">Приём заявок закончился</b>
      )}
    </section>
  );

  return (
    <>
      <Link href="/" className="-ml-1 inline-flex items-center gap-0.5 rounded-lg pr-1.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
        <ChevronLeft size={17} strokeWidth={1.6} />
        Сегодня
      </Link>
      <div className="course-cover mt-4 h-[150px] rounded-[26px] max-sm:h-[110px]" style={{ "--cc": "var(--accent)" } as React.CSSProperties}>
        <span className="absolute top-5 left-6 text-[13px] font-medium text-[color-mix(in_srgb,var(--accent)_60%,var(--text))]">{m.kicker}</span>
      </div>
      <h1 className="mt-6 max-w-[760px] text-[34px] leading-[1.15] font-medium tracking-[-.03em] [text-wrap:balance] max-sm:text-[28px]">{m.title}</h1>
      <p className="mt-3 max-w-[680px] text-[16px] leading-relaxed text-text-2">{m.lead}</p>

      <section aria-label="Коротко" className="mt-8 flex flex-wrap gap-x-14 gap-y-6 max-sm:gap-x-8">
        {m.facts.map((f) => (
          <div key={f.label}>
            <b className="block text-[32px] leading-none font-medium tracking-[-.03em] max-sm:text-[26px]">{f.value}</b>
            <span className="text-sm text-text-3">{f.label}</span>
          </div>
        ))}
      </section>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-12 min-[1000px]:hidden">{cta}</div>

          <section aria-labelledby="partners">
            <h2 id="partners" className={H2}>
              Университеты
            </h2>
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              {m.partners.map((p) => (
                <article key={p.id} data-partner-card={p.id} className="rounded-3xl bg-s1 px-5 py-4" style={{ "--cc": `var(--c-${p.color})` } as React.CSSProperties}>
                  <span className="flex items-center gap-2 text-[13px] text-text-3">
                    <MapPin size={13} strokeWidth={1.7} />
                    {p.city}, {p.country}
                  </span>
                  <b className="mt-1 block text-[17px] font-semibold tracking-[-.01em]">{p.name}</b>
                  <span className="mt-0.5 block text-sm text-text-2">{p.focus}</span>
                  <span className="mt-3 flex items-center justify-between text-[13px] text-text-3">
                    <span>Обучение на языке: {p.lang}</span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <i className="size-2 rounded-full bg-(--cc)" />
                      {p.places} {p.places === 1 ? "место" : p.places < 5 ? "места" : "мест"}
                    </span>
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="req" className="mt-12">
            <h2 id="req" className={H2}>
              Требования
            </h2>
            <div className="rows [--row-inset:0px]">
              {m.requirements.map((r) => {
                const c = d.checks[r.id];
                return (
                  <div key={r.id} data-req={r.id} data-ok={c?.ok ? "yes" : "no"} className="flex items-start gap-3.5 py-3">
                    <span
                      className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                      style={{ background: `color-mix(in srgb, ${c?.ok ? "var(--st-green)" : "var(--st-orange)"} 16%, transparent)`, color: c?.ok ? "var(--st-green)" : "var(--st-orange)" }}
                    >
                      {c?.ok ? <Check size={14} strokeWidth={2.2} /> : <CircleAlert size={14} strokeWidth={2} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px]">{r.text}</span>
                      {c && <small className="text-[13px] text-text-3">{c.note}</small>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="docs" className="mt-12">
            <h2 id="docs" className={H2}>
              Документы
            </h2>
            <div className="rows [--row-inset:0px]">
              {m.documents.map((x) => (
                <div key={x.id} className="flex items-start gap-3.5 py-3">
                  <FileText size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-3" />
                  <span>
                    <b className="block font-medium">
                      {x.title}
                      {!x.required && <span className="font-normal text-text-3"> — по желанию</span>}
                    </b>
                    <small className="text-[13px] text-text-3">{x.note}</small>
                  </span>
                </div>
              ))}
              <div className="flex items-start gap-3.5 py-3">
                <Sparkles size={18} strokeWidth={1.6} className="mt-0.5 shrink-0 text-text-3" />
                <span>
                  <b className="block font-medium">{m.auto.join(", ")}</b>
                  <small className="text-[13px] text-text-3">Орбита приложит сама</small>
                </span>
              </div>
            </div>
          </section>

          <section aria-labelledby="steps" className="mt-12">
            <h2 id="steps" className={H2}>
              Как проходит отбор
            </h2>
            <ol className="flex flex-col">
              {m.steps.map((s, i) => (
                <li key={s.title} className="relative grid grid-cols-[120px_minmax(0,1fr)] gap-x-5 pb-6 last:pb-0 max-sm:grid-cols-[minmax(0,1fr)]">
                  <span className="pt-px text-sm text-text-3 tabular-nums">{s.when}</span>
                  <span className="relative pl-6 max-sm:mt-1">
                    <i className={cn("absolute top-[7px] left-0 size-2 rounded-full", i === 0 ? "bg-accent" : "bg-text-3/60")} />
                    {i < m.steps.length - 1 && <i className="absolute top-[19px] bottom-[-18px] left-[3.5px] w-px bg-line" />}
                    <b className="block font-medium">{s.title}</b>
                    <span className="text-sm text-text-2">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-4 self-start min-[1000px]:sticky min-[1000px]:top-[92px]">
          <div className="max-[1000px]:hidden">{cta}</div>
          <section aria-label="Контакт" className="rounded-3xl bg-s1 p-5">
            <span className="text-[13px] text-text-3">{m.contact.role}</span>
            <b className="mt-0.5 block font-medium">{m.contact.name}</b>
            <span className="mt-1 block text-sm text-text-2">{m.contact.place}</span>
            <a href={`mailto:${m.contact.email}`} className="mt-3 inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text">
              <Mail size={15} strokeWidth={1.6} />
              {m.contact.email}
            </a>
          </section>
        </aside>
      </div>

      <Modal open={open} onClose={close} accent="var(--accent)" cover={false} title="Заявка на конкурс" width={520}>
        <ApplyForm toast={toast} onDone={close} />
      </Modal>
      {node}
    </>
  );
}
