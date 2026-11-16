"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, FileText, Paperclip, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast } from "@/components/ui/toast";
import type { OfficeRequestView } from "@/server/data/types";
import { uploadRequestFile } from "@/server/office/actions";
import { whiteBtn } from "./icons";
import { ProgressBar } from "@/components/ui/progress";

const MAX = 8 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`);

/** Офис ждёт документ: выбрать или перетащить файл, отправить. Проверка типа и размера — на сервере (по содержимому). */
export function UploadBox({ req, toast }: { req: OfficeRequestView; toast: Toast }) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const router = useRouter();
  useEffect(() => () => clearInterval(timer.current), []);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return toast("Нужен PDF, JPG или PNG", "error");
    if (f.size > MAX) return toast("Файл больше 8 МБ", "error");
    setFile(f);
    setProgress(0);
  };

  const send = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    setProgress(6);
    // плавный ход до 90 %, остаток — когда сервер ответит
    timer.current = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p)), 120);
    start(async () => {
      const r = await uploadRequestFile(req.id, fd);
      clearInterval(timer.current);
      setProgress(r.ok ? 100 : 0);
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) router.refresh();
      else setFile(null);
    });
  };

  return (
    <section aria-label={req.waiting!.doc} data-upload className="mt-5 rounded-[20px] bg-[color-mix(in_srgb,var(--urgent)_9%,var(--s1))] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--urgent)_16%,transparent)] text-urgent">
          <Paperclip size={17} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <b className="block font-semibold">{req.waiting!.doc}</b>
          {req.waiting!.due && <span className="text-sm text-urgent">До {req.waiting!.due}</span>}
        </div>
      </div>

      {!file ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "mt-3.5 flex h-[112px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[16px] bg-s2 text-sm transition-[background,box-shadow] duration-200 hover:bg-[color-mix(in_srgb,var(--text)_4%,var(--s2))]",
            drag && "bg-[color-mix(in_srgb,var(--accent)_12%,var(--s2))] shadow-[inset_0_0_0_1.5px_var(--accent)]",
          )}
        >
          <Upload size={20} strokeWidth={1.7} className={drag ? "text-accent" : "text-text-2"} />
          <span className="mt-1 font-medium text-text">Выбрать файл</span>
          <span className="text-[13px] text-text-3">PDF, JPG или PNG до 8 МБ</span>
          <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="mt-3.5 rounded-[16px] bg-s2 p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-s3 text-text-2">
              <FileText size={18} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{file.name}</div>
              <div className="text-[13px] text-text-3 tabular-nums">{progress === 100 ? "Отправлен" : size(file.size)}</div>
            </div>
            {!pending && progress < 100 && (
              <button type="button" aria-label="Убрать файл" onClick={() => setFile(null)} className="grid size-8 place-items-center rounded-full text-text-3 hover:bg-s3 hover:text-text">
                <X size={16} strokeWidth={1.6} />
              </button>
            )}
          </div>
          {progress > 0 && (
            <ProgressBar value={progress} label="Загрузка файла" fill="var(--accent)" className="mt-3 h-1" />
          )}
          <button type="button" disabled={pending || progress === 100} onClick={send} className={cn(whiteBtn, "mt-3.5 h-11 w-full text-[14.5px]")}>
            {pending ? "Отправляем" : "Отправить в офис"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Файлы, которые студент уже отправил по заявке. */
export function UploadedFiles({ files }: { files: OfficeRequestView["files"] }) {
  return (
    <section aria-label="Отправленные файлы" className="mt-5">
      {files.map((f) => (
        <div key={f.id} data-file className="flex items-center gap-3 rounded-[16px] bg-s1 px-3.5 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--st-green)_14%,transparent)] text-(--st-green)">
            <FileCheck2 size={17} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{f.label}</div>
            <div className="truncate text-[13px] text-text-3">
              {f.name}, {f.size}
            </div>
          </div>
          <span className="text-[13px] whitespace-nowrap text-(--st-green)">Получен {f.at}</span>
        </div>
      ))}
    </section>
  );
}
