"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, PenLine } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { normalizeContact, CONTACT_ERROR, type ContactField } from "@/lib/contacts";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import type { PersonRef, ProfileView } from "@/server/data/types";
import { updateContact } from "@/server/profile/actions";

const ROW =
  "-mx-3.5 grid min-h-[54px] grid-cols-[160px_minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] px-3.5 py-2.5 transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-0.5";
const ACT =
  "grid size-8 place-items-center rounded-[10px] text-text-3 opacity-0 transition-[opacity,background,color] duration-150 group-hover:opacity-100 hover:bg-s2 hover:text-text focus-visible:opacity-100 max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:opacity-100";

function Row({ k, children, action }: { k: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("group", ROW)}>
      <dt className="text-sm text-text-3 max-sm:text-[13px]">{k}</dt>
      <dd className="min-w-0 truncate font-medium max-sm:col-start-1">{children}</dd>
      {action}
    </div>
  );
}

function Person({ p }: { p: PersonRef }) {
  return (
    <span className="flex items-center gap-2.5 max-sm:mt-2 max-sm:mb-0.5">
      <span className="grid size-[26px] shrink-0 place-items-center rounded-full text-[10px] font-semibold mono" style={{ background: p.avatar }}>
        {p.initials}
      </span>
      <span className="truncate">{p.name}</span>
    </span>
  );
}

function CopyButton({ value, label, onDone }: { value: string; label: string; onDone: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Скопировать: ${label}`}
      className={ACT}
      onClick={() => navigator.clipboard?.writeText(value).then(onDone, onDone)}
    >
      <Copy size={16} strokeWidth={1.6} />
    </button>
  );
}

function EditableRow({ k, field, initial, placeholder }: { k: string; field: ContactField; initial: string | null; placeholder: string }) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast, node } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const editing = draft !== null;

  const save = () => {
    if (draft === null) return;
    if (normalizeContact(field, draft) === undefined) return toast(CONTACT_ERROR[field], "error");
    start(async () => {
      const r = await updateContact(field, draft);
      if (!r.ok) return toast(r.error, "error");
      setValue(r.value);
      setDraft(null);
      toast("Сохранено");
    });
  };

  return (
    <div className={cn("group", ROW, editing && "bg-transparent hover:bg-transparent")} data-editing={editing || undefined} data-contact={field}>
      <dt className="text-sm text-text-3 max-sm:text-[13px]">{k}</dt>
      <dd className="min-w-0 font-medium max-sm:col-start-1">
        {editing ? (
          <input
            ref={input}
            autoFocus
            value={draft}
            maxLength={40}
            placeholder={placeholder}
            enterKeyHint="done"
            {...(field === "phone"
              ? { type: "tel", autoComplete: "tel" }
              : { autoComplete: "nickname", autoCapitalize: "none", autoCorrect: "off", spellCheck: false })}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Enter, подтверждающий набор через IME (китайский, японский…), не сохраняет; 229 — для Safari
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                save();
              }
              if (e.key === "Escape") setDraft(null);
            }}
            className="-my-1 h-9 w-full rounded-[10px] bg-s2 px-3 text-[15px] font-medium text-text outline-none shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)] placeholder:font-normal placeholder:text-text-3"
          />
        ) : (
          <span className={cn("block truncate", !value && "font-normal text-text-3")}>{value ?? "—"}</span>
        )}
      </dd>
      <button
        type="button"
        aria-label={editing ? "Сохранить" : `Изменить: ${k}`}
        disabled={pending}
        onClick={() => (editing ? save() : setDraft(value ?? ""))}
        className={cn(ACT, editing && "text-text opacity-100")}
      >
        {editing ? <Check size={16} strokeWidth={1.8} /> : <PenLine size={16} strokeWidth={1.6} />}
      </button>
      {node}
    </div>
  );
}

export function ProfileSections({ p }: { p: ProfileView }) {
  const { toast, node } = useToast();
  const copied = () => toast("Скопировано");

  return (
    <div className="mt-[52px] grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-14 px-7 max-[900px]:grid-cols-1 max-[900px]:gap-11 max-sm:px-0.5">
      <section aria-labelledby="p-study">
        <h2 id="p-study" className="mb-1.5 text-lg font-semibold tracking-[-.02em]">
          {p.student ? "Учёба" : "Работа"}
        </h2>
        <dl className="rows [--row-inset:14px]">
          {p.faculty && <Row k={p.student ? "Факультет" : "Подразделение"}>{p.faculty}</Row>}
          {p.student ? (
            <>
              {p.program && (
                <Row k="Программа">
                  {p.program}
                  {p.programSub && <small className="block text-[13.5px] font-normal text-text-3">{p.programSub}</small>}
                </Row>
              )}
              {p.group && <Row k="Группа">{p.group}</Row>}
              {p.studyForm && <Row k="Форма обучения">{p.studyForm}</Row>}
              {p.recordBook && (
                <Row k="Зачётная книжка" action={<CopyButton value={p.recordBook} label="номер зачётки" onDone={copied} />}>
                  <span className="tabular-nums">{p.recordBook}</span>
                </Row>
              )}
              {p.archive && (
                <Row k="Архив курсов" action={<ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} className="mx-2 text-text-3 max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1" />}>
                  <Link href="/study/archive" data-archive-link className="after:absolute after:inset-0 after:rounded-[14px]">
                    {p.archive.semesters} {plural(p.archive.semesters, "семестр", "семестра", "семестров")}
                    {p.archive.average && <>, средний балл {p.archive.average}</>}
                  </Link>
                </Row>
              )}
              {p.curator && (
                <Row k="Куратор">
                  <Person p={p.curator} />
                </Row>
              )}
              {p.headman && (
                <Row k="Староста">
                  <Person p={p.headman} />
                </Row>
              )}
            </>
          ) : (
            p.position && <Row k="Должность">{p.position}</Row>
          )}
        </dl>
      </section>

      <section aria-labelledby="p-contacts">
        <h2 id="p-contacts" className="mb-1.5 text-lg font-semibold tracking-[-.02em]">
          Контакты
        </h2>
        <dl className="rows [--row-inset:14px]">
          <Row k="Почта" action={<CopyButton value={p.email} label="почту" onDone={copied} />}>
            {p.email}
          </Row>
          <EditableRow k="Телефон" field="phone" initial={p.phone} placeholder="+7 900 000-00-00" />
          <EditableRow k="Telegram" field="telegram" initial={p.telegram} placeholder="@username" />
        </dl>
      </section>
      {node}
    </div>
  );
}
