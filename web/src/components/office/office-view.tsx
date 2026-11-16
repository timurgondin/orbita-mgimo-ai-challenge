"use client";

import { useCallback, useRef, useState } from "react";
import { Building2, Download, FileBadge, MessageCircle, Plus } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { REQUEST_TYPES, OFFICE, getType } from "@/lib/office-catalog";
import { cn } from "@/lib/utils";
import type { OfficeData, OfficeDocView, OfficeRequestView } from "@/server/data/types";
import { DocContent, pdfHref } from "./doc-modal";
import { FormContent } from "./form-modal";
import { Ico, OfficeTag, ghostBtn, typeColor } from "./icons";
import { RequestCard } from "./request-card";
import { RequestContent } from "./request-modal";

/** snap — снимок на момент открытия: после отзыва заявка пропадает из данных, а модалка ещё закрывается */
type ModalState = { type: "req"; id: string; snap: OfficeRequestView } | { type: "form"; id: string } | { type: "doc"; id: string; snap: OfficeDocView } | null;

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">{children}</h2>;

export function OfficeView({ data }: { data: OfficeData }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ModalState>(null);
  const { toast, node } = useToast();
  const catalog = useRef<HTMLElement>(null);

  const openModal = (m: NonNullable<ModalState>) => {
    setShown(m);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);

  const req = shown?.type === "req" ? (data.requests.find((r) => r.id === shown.id) ?? shown.snap) : undefined;
  const doc = shown?.type === "doc" ? (data.documents.find((d) => d.id === shown.id) ?? shown.snap) : undefined;
  const formType = shown?.type === "form" ? getType(shown.id) : undefined;

  const wide = shown?.type === "doc";
  const title = req ? `Заявка ${req.number}` : doc ? doc.title : formType ? formType.title : "Офис";

  return (
    <>
      <div className="flex items-end justify-between gap-6">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Офис</h1>
        <button
          type="button"
          onClick={() => catalog.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="inline-flex h-[42px] items-center gap-2 rounded-[13px] bg-text px-[18px] text-[14.5px] font-semibold text-bg transition-[opacity,transform] duration-150 hover:opacity-92 active:scale-[.97]"
        >
          <Plus size={17} strokeWidth={2} />
          Новая заявка
        </button>
      </div>

      <section className="mt-11">
        <H2>В работе</H2>
        {data.requests.length ? (
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {data.requests.map((r) => (
              <RequestCard key={r.id} req={r} onOpen={() => openModal({ type: "req", id: r.id, snap: r })} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-text-3">Активных заявок нет</p>
        )}
      </section>

      <section ref={catalog} className="mt-11 scroll-mt-24">
        <H2>Заказать</H2>
        <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
          {REQUEST_TYPES.map((t) => {
            return (
              <button
                key={t.id}
                type="button"
                data-type={t.id}
                onClick={() => openModal({ type: "form", id: t.id })}
                style={{ "--c": typeColor(t.color) } as React.CSSProperties}
                className="flex flex-col gap-3.5 rounded-[20px] bg-s1 p-[18px] text-left transition-[background,transform] duration-300 ease-spring hover:bg-s2 active:scale-[.98]"
              >
                <span className="grid size-10 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--c)_14%,transparent)] text-(--c)">
                  <Ico name={t.icon} size={20} strokeWidth={1.7} />
                </span>
                <span>
                  <b className="block text-[15px] leading-tight font-semibold tracking-[-.01em]">{t.title}</b>
                  <small className="mt-[3px] block text-[13px] text-text-3">
                    {t.format} · {t.eta}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-11">
        <H2>Документы</H2>
        {data.documents.length ? (
          <div className="rows [--row-inset:14px]">
            {data.documents.map((d) => (
              <div
                key={d.id}
                role="button"
                tabIndex={0}
                data-doc={d.number}
                onClick={() => openModal({ type: "doc", id: d.id, snap: d })}
                onKeyDown={(e) => e.key === "Enter" && openModal({ type: "doc", id: d.id, snap: d })}
                className="-mx-3.5 grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-4 rounded-2xl px-3.5 py-3 transition-colors duration-150 hover:bg-hover max-sm:grid-cols-[40px_minmax(0,1fr)_auto] max-sm:gap-3"
              >
                <span className="grid size-10 place-items-center rounded-[12px] bg-s2 text-text-2">
                  <FileBadge size={16} strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="truncate text-sm text-text-3">{d.subtitle}</div>
                </div>
                <span className={"text-sm whitespace-nowrap text-text-3 max-sm:hidden"}>{d.status === "ready" ? <OfficeTag status="ready" /> : d.when}</span>
                <a
                  href={pdfHref(d.id)}
                  download
                  aria-label={`Скачать PDF: ${d.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toast("Скачивание началось");
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] bg-s2 px-3 text-[13.5px] font-medium transition-colors duration-150 hover:bg-s3"
                >
                  <Download size={15} strokeWidth={1.6} />
                  PDF
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-text-3">Документов пока нет</p>
        )}
      </section>

      <div className="mt-11 flex items-center gap-4 rounded-[20px] bg-s1 px-[22px] py-[18px] max-md:flex-wrap">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-s2 text-text-2">
          <Building2 size={16} strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1 max-md:basis-[calc(100%-60px)]">
          <b className="font-semibold">{OFFICE.name}</b>
          <small className="block text-sm text-text-3">
            {OFFICE.address} · {OFFICE.hours} · {OFFICE.email}
          </small>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 text-[13.5px] before:size-[7px] before:rounded-full before:bg-current", data.open ? "text-(--st-green)" : "text-text-3")}>
          {data.open ? "Открыто до 18:00" : "Закрыто"}
        </span>
        <a href={`mailto:${OFFICE.email}`} className={cn(ghostBtn, "ml-3 max-md:ml-0")}>
          <MessageCircle size={15} strokeWidth={1.6} />
          Написать
        </a>
      </div>

      <Modal open={open} onClose={close} accent="var(--accent)" cover={false} width={wide ? 760 : 520} title={title}>
        {req && <RequestContent key={req.id} req={req} toast={toast} onClose={close} />}
        {formType && <FormContent key={formType.id} type={formType} toast={toast} onClose={close} />}
        {doc && <DocContent key={doc.id} doc={doc} toast={toast} />}
      </Modal>
      {node}
    </>
  );
}
