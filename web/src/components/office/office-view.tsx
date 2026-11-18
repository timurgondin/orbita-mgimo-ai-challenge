"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronRight, Download, FileBadge, Grid2x2Plus, MessageCircle, MapPin, Clock3 } from "lucide-react";
import { Modal } from "@/components/time/modal";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES, REQUEST_TYPES, OFFICE, getType, catalogLine } from "@/lib/office-catalog";
import { cn } from "@/lib/utils";
import type { OfficeData, OfficeDocView, OfficeRequestView } from "@/server/data/types";
import { DocContent, pdfHref } from "./doc-modal";
import { FormContent } from "./form-modal";
import { Ico, OfficeTag, ghostBtn, typeColor } from "./icons";
import { RequestCard } from "./request-card";
import { RequestContent } from "./request-modal";

/** snap — снимок на момент открытия: после отзыва заявка пропадает из данных, а модалка ещё закрывается */
type ModalState = { type: "req"; id: string; snap: OfficeRequestView } | { type: "form"; id: string } | { type: "doc"; id: string; snap: OfficeDocView } | { type: "more" } | null;

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3.5 text-lg font-semibold tracking-[-.02em]">{children}</h2>;

export function OfficeView({ data }: { data: OfficeData }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ModalState>(null);
  const { toast, node } = useToast();

  const openModal = useCallback((m: NonNullable<ModalState>) => {
    setShown(m);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  // ?request=R-2481 — открыть заявку сразу (так ведёт уведомление «Загрузить»); ?new=grades — форму заявки (из «Архива»). Адрес чистим
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("request");
  const wantedNew = params.get("new");
  useEffect(() => {
    if (!wanted && !wantedNew) return;
    const r = wanted ? data.requests.find((x) => x.number === wanted) : undefined;
    const t = wantedNew ? getType(wantedNew) : undefined;
    // через кадр: страница успевает отрисоваться, окно открывается с обычной анимацией
    requestAnimationFrame(() => {
      if (r) openModal({ type: "req", id: r.id, snap: r });
      else if (t) openModal({ type: "form", id: t.id });
    });
    router.replace("/office", { scroll: false });
  }, [wanted, wantedNew, data.requests, router, openModal]);

  const req = shown?.type === "req" ? (data.requests.find((r) => r.id === shown.id) ?? shown.snap) : undefined;
  const doc = shown?.type === "doc" ? (data.documents.find((d) => d.id === shown.id) ?? shown.snap) : undefined;
  const formType = shown?.type === "form" ? getType(shown.id) : undefined;

  const wide = shown?.type === "doc";
  const title = req ? `Заявка ${req.number}` : doc ? doc.title : formType ? formType.title : shown?.type === "more" ? "Все заявки" : "Офис";

  return (
    <>
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Офис</h1>

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

      <section className="mt-11" aria-label="Заказать">
        <H2>Заказать</H2>
        <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
          {REQUEST_TYPES.filter((t) => t.popular).map((t) => {
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
                  <small className="mt-[3px] block text-[13px] text-text-3">{catalogLine(t)}</small>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            data-more
            onClick={() => openModal({ type: "more" })}
            className="flex flex-col gap-3.5 rounded-[20px] bg-s1 p-[18px] text-left transition-[background,transform] duration-300 ease-spring hover:bg-s2 active:scale-[.98]"
          >
            <span className="grid size-10 place-items-center rounded-[12px] bg-s3 text-text-2">
              <Grid2x2Plus size={20} strokeWidth={1.7} />
            </span>
            <span>
              <b className="block text-[15px] leading-tight font-semibold tracking-[-.01em]">Ещё</b>
              <small className="mt-[3px] block text-[13px] text-text-3">{REQUEST_TYPES.length} видов заявок</small>
            </span>
          </button>
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
          <small className="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-3">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} strokeWidth={1.6} />
              {OFFICE.address}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} strokeWidth={1.6} />
              {OFFICE.hours}
            </span>
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
        {shown?.type === "more" && (
          <>
            <h2 className="mb-1 text-[22px] font-semibold tracking-[-.025em]">Все заявки</h2>
            {CATEGORIES.map((cat) => (
              <section key={cat} aria-label={cat} className="mt-5">
                <h3 className="mb-1 text-[13px] font-medium text-text-3">{cat}</h3>
                <div className="rows [--row-inset:12px]">
                  {REQUEST_TYPES.filter((t) => t.category === cat).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      data-more-type={t.id}
                      onClick={() => openModal({ type: "form", id: t.id })}
                      style={{ "--c": typeColor(t.color) } as React.CSSProperties}
                      className="-mx-3 flex w-[calc(100%+24px)] items-center gap-3.5 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--c)_14%,transparent)] text-(--c)">
                        <Ico name={t.icon} size={17} strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate font-medium">{t.title}</b>
                        <small className="text-[13px] text-text-3">{catalogLine(t)}</small>
                      </span>
                      <ChevronRight size={16} strokeWidth={1.6} className="text-text-3" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </Modal>
      {node}
    </>
  );
}
