"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Leaf, Minus, Plus, Printer as PrinterIcon, QrCode, ScanLine, Upload, X } from "lucide-react";
import { StudentCardModal } from "@/components/profile/student-card";
import { Modal } from "@/components/time/modal";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { useToast, type Toast } from "@/components/ui/toast";
import { MAX_COPIES } from "@/lib/printers";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import { cancelPrint, releasePrint, scanToOrbita, sendToPrint } from "@/server/print/actions";
import type { PrintData, StudentCardView } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const MAX = 8 * 1024 * 1024;
const BTN = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-[transform,opacity,background] duration-150 active:scale-[.97] disabled:opacity-40";
const ACT = "inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s2 px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-s3 disabled:opacity-45";
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);
const pages = (n: number) => `${n} ${plural(n, "страница", "страницы", "страниц")}`;

const STATUS: Record<PrintData["printers"][number]["status"], { label: string; color: string }> = {
  ready: { label: "Свободен", color: "var(--st-green)" },
  busy: { label: "Очередь", color: "var(--st-yellow)" },
  paper: { label: "Мало бумаги", color: "var(--st-orange)" },
  offline: { label: "Не работает", color: "var(--st-gray)" },
};

function useRun(toast: Toast) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, run };
}

/** Отправка в очередь: файл, копии, цвет, двусторонняя. Страницы считает сервер. */
function SendBox({ toast }: { toast: Toast }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [duplex, setDuplex] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const { pending, run } = useRun(toast);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return toast("Нужен PDF, JPG или PNG", "error");
    if (f.size > MAX) return toast("Файл больше 8 МБ", "error");
    setFile(f);
  };
  const send = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("copies", String(copies));
    fd.set("color", color === "color" ? "1" : "0");
    fd.set("duplex", duplex ? "1" : "0");
    run(() => sendToPrint(fd), () => setFile(null));
  };

  return (
    <div data-send className="min-w-0">
      {!file ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-9 text-center transition-colors duration-150",
            drag ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-[color-mix(in_srgb,var(--text)_18%,transparent)] hover:bg-hover",
          )}
        >
          <Upload size={22} strokeWidth={1.6} className="text-text-2" />
          <b className="font-medium">Выбрать файл или перетащить</b>
          <small className="text-[13px] text-text-3">PDF, JPG или PNG до 8 МБ</small>
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-s3 text-text-2">
              <FileText size={18} strokeWidth={1.6} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{file.name}</b>
              <small className="text-[13px] text-text-3">{size(file.size)}</small>
            </span>
            <button type="button" aria-label="Убрать файл" onClick={() => setFile(null)} className="grid size-8 place-items-center rounded-full text-text-3 hover:bg-hover hover:text-text">
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Segmented label="Цвет" value={color} onChange={setColor} items={[{ id: "bw", label: "Ч/б" }, { id: "color", label: "Цвет" }]} />
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-text-2">
              <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              С двух сторон
            </label>
            <span className="inline-flex items-center gap-2 text-sm text-text-2" role="group" aria-label="Копии">
              <button type="button" aria-label="Меньше копий" disabled={copies <= 1} onClick={() => setCopies((c) => c - 1)} className="grid size-8 place-items-center rounded-[9px] bg-s3 disabled:opacity-40">
                <Minus size={14} strokeWidth={2} />
              </button>
              <span className="w-16 text-center tabular-nums">
                {copies} {plural(copies, "копия", "копии", "копий")}
              </span>
              <button type="button" aria-label="Больше копий" disabled={copies >= MAX_COPIES} onClick={() => setCopies((c) => c + 1)} className="grid size-8 place-items-center rounded-[9px] bg-s3 disabled:opacity-40">
                <Plus size={14} strokeWidth={2} />
              </button>
            </span>
          </div>
          <button type="button" onClick={send} disabled={pending} data-send-go className={cn(BTN, "mt-5 w-full bg-text text-bg")}>
            {pending ? "Отправляем…" : "В очередь печати"}
          </button>
        </>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
        data-send-input
      />
    </div>
  );
}

/** Как это работает: три шага прямо в карточке отправки — путь «файл → принтер → Орбита ID» виден до первого действия. */
const STEPS = [
  { n: 1, title: "Отправь файл", text: "Он ждёт тебя сутки" },
  { n: 2, title: "Подойди к любому принтеру", text: "В любом корпусе" },
  { n: 3, title: "Приложи Орбита ID", text: "Печать начнётся при тебе" },
];

export function PrintView({ d, card }: { d: PrintData; card: StudentCardView | null }) {
  const { toast, node } = useToast();
  const [idOpen, setIdOpen] = useState(false);
  const [printer, setPrinter] = useState<string | null>(null);
  const [pOpen, setPOpen] = useState(false);
  const [allPrinters, setAllPrinters] = useState(false);
  const [hist, setHist] = useState<"print" | "scan">("print");
  const closeId = useCallback(() => setIdOpen(false), []);
  const closeP = useCallback(() => setPOpen(false), []);
  const { pending, run } = useRun(toast);
  const cur = d.printers.find((p) => p.id === printer);
  const printers = allPrinters ? d.printers : d.printers.filter((p) => p.status !== "offline").slice(0, 3);
  const left = { bw: d.quota.bw.total - d.quota.bw.used, color: d.quota.color.total - d.quota.color.used };

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Печать</h1>
        {card && (
          <button type="button" onClick={() => setIdOpen(true)} data-orbita-id className="inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97] max-sm:h-[52px] max-sm:justify-center max-sm:gap-2.5 max-sm:rounded-2xl max-sm:text-[15px]">
            <QrCode className="size-4 max-sm:size-5" strokeWidth={1.7} />
            Орбита ID
          </button>
        )}
      </div>

      <section aria-label="Отправить на печать" className="mt-9 grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[28px] bg-s1 p-5 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:p-6">
        <SendBox toast={toast} />
        <ol aria-label="Как это работает" className="flex flex-col justify-center gap-5" data-steps>
          {STEPS.map((x) => (
            <li key={x.n} className="flex items-center gap-4">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums", x.n === (d.held.length ? 2 : 1) ? "bg-text text-bg" : "bg-s3 text-text-2")}>{x.n}</span>
              <span className="min-w-0">
                <b className="block font-medium">{x.title}</b>
                <small className="text-[13px] text-text-3">{x.text}</small>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 min-[1000px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="queue">
            <h2 id="queue" className={H2}>
              Ждут печати
            </h2>
            {d.held.length ? (
              <div className="rows [--row-inset:0px]">
                {d.held.map((j) => (
                  <div key={j.id} data-held={j.name} className="flex items-center gap-3.5 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-s1 text-text-2">
                      <FileText size={18} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-medium">{j.name}</b>
                      <small className="block text-[13px] text-text-3">
                        {pages(j.pages)}
                        {j.copies > 1 && ` × ${j.copies}`}, {j.color ? "цвет" : "ч/б"}
                        {j.duplex ? ", с двух сторон" : ""}
                      </small>
                      <small className="block text-[13px] text-text-3">{j.expires}</small>
                    </span>
                    <button type="button" disabled={pending} onClick={() => run(() => cancelPrint(j.id))} className={ACT}>
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[15px] text-text-3">Пусто</p>
            )}
          </section>

          {(d.history.length > 0 || d.scans.length > 0) && (
            <section aria-labelledby="history">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="history" className="text-lg font-semibold tracking-[-.02em]">
                  История
                </h2>
                <Segmented label="История" value={hist} onChange={setHist} items={[{ id: "print", label: "Печать" }, { id: "scan", label: `Сканы ${d.scans.length || ""}`.trim() }]} />
              </div>
              {hist === "scan" ? (
                d.scans.length ? (
                  <div className="rows [--row-inset:14px]">
                    {d.scans.map((s) => (
                      <a key={s.id} href={`/print/scans/${s.id}`} target="_blank" rel="noopener" data-scan className="-mx-3.5 flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-colors duration-150 hover:bg-hover">
                        <span className="min-w-0 flex-1">
                          <b className="block truncate font-medium">{s.name}</b>
                          <small className="text-[13px] text-text-3">
                            {pages(s.pages)}, {s.when}
                          </small>
                        </span>
                        <Download size={16} strokeWidth={1.6} className="shrink-0 text-text-3" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[15px] text-text-3">Сканов нет</p>
                )
              ) : (
                <div className="rows [--row-inset:0px]">
                  {d.history.slice(0, 4).map((h) => (
                    <div key={h.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
                      <span className="min-w-0">
                        <b className="block truncate font-medium">{h.name}</b>
                        <small className="text-[13px] text-text-3">{h.when}</small>
                      </span>
                      <span className="text-[13px] whitespace-nowrap text-text-3">
                        {pages(h.pages)}
                        {h.color ? ", цвет" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="quota" data-quota>
            <h2 id="quota" className={H2}>
              Бесплатно до конца месяца
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["ч/б страниц", left.bw, d.quota.bw.total, "var(--text-2)"],
                  ["цветных", left.color, d.quota.color.total, "var(--accent)"],
                ] as const
              ).map(([label, l, total, fill]) => (
                <div key={label}>
                  <b className="block text-[32px] leading-none font-medium tracking-[-.03em] tabular-nums">{l}</b>
                  <span className="text-sm text-text-3">
                    {label} из {total}
                  </span>
                  <ProgressBar value={Math.round((l / total) * 100)} label={`Осталось ${label}`} fill={fill} className="mt-2.5 h-1" />
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[13px] text-text-3">
              <Leaf size={14} strokeWidth={1.7} style={{ color: "var(--st-green)" }} />
              {d.saved > 0 ? `${d.saved} ${plural(d.saved, "лист", "листа", "листов")} сэкономила печать с двух сторон` : "Печать с двух сторон экономит бумагу"}
            </p>
          </section>

          <section aria-labelledby="printers">
            <h2 id="printers" className={H2}>
              Принтеры
            </h2>
            <div className="rows [--row-inset:14px]">
              {printers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-printer={p.id}
                  onClick={() => {
                    setPrinter(p.id);
                    setPOpen(true);
                  }}
                  className="-mx-3.5 grid w-[calc(100%+28px)] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover"
                >
                  <span className="min-w-0">
                    <b className="block truncate font-medium">{p.name}</b>
                    <small className="block truncate text-[13px] text-text-3">{p.id === d.nearId ? "Рядом со следующей парой" : p.place}</small>
                  </span>
                  <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-text-2">
                    <i className="size-2 rounded-full" style={{ background: STATUS[p.status].color }} />
                    {STATUS[p.status].label}
                    {p.status === "busy" && `: ${p.queue}`}
                  </span>
                </button>
              ))}
            </div>
            {!allPrinters && (
              <button type="button" onClick={() => setAllPrinters(true)} data-all-printers className="mt-2 text-sm text-text-2 hover:text-text">
                Все принтеры, {d.printers.length} ›
              </button>
            )}
          </section>
        </div>
      </div>

      <Modal open={pOpen} onClose={closeP} accent="var(--c-law)" title={cur?.name ?? "Принтер"} width={460}>
        {cur && (
          <div data-printer-modal>
            <div className="text-sm text-text-2">{cur.place}</div>
            <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{cur.name}</div>
            <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-2">
              <i className="size-2 rounded-full" style={{ background: STATUS[cur.status].color }} />
              {STATUS[cur.status].label}
              {cur.status === "busy" && `: ${cur.queue} ${plural(cur.queue, "задание", "задания", "заданий")} впереди`}
            </span>
            <p className="mt-5 text-[15px] text-text-2">У принтера приложи Орбита ID к считывателю или отсканируй QR на его экране — Орбита попросит подтвердить.</p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={pending || cur.status === "offline" || !d.held.length}
                onClick={() => run(() => releasePrint(cur.id), closeP)}
                data-release
                className={cn(BTN, "w-full bg-text text-bg")}
              >
                <PrinterIcon size={17} strokeWidth={1.7} />
                {d.held.length ? `Напечатать здесь: ${d.held.length} ${plural(d.held.length, "файл", "файла", "файлов")}` : "Очередь пуста"}
              </button>
              {cur.scan && (
                <button type="button" disabled={pending || cur.status === "offline"} onClick={() => run(() => scanToOrbita(cur.id), closeP)} data-scan-here className={cn(BTN, "w-full bg-s3")}>
                  <ScanLine size={17} strokeWidth={1.7} />
                  Сканировать в Орбиту
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      {card && <StudentCardModal card={card} open={idOpen} onClose={closeId} />}
      {node}
    </>
  );
}
