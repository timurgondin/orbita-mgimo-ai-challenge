"use client";

import { Download, Share, Link as LinkIcon, ShieldCheck } from "lucide-react";
import type { OfficeDocView } from "@/server/data/types";
import type { Toast } from "@/components/ui/toast";
import { ghostBtn } from "./icons";

export const pdfHref = (id: string) => `/office/documents/${id}/pdf`;

export function DocContent({ doc, toast }: { doc: OfficeDocView; toast: Toast }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(doc.verifyUrl);
      toast("Ссылка скопирована");
    } catch {
      toast("Не удалось скопировать", "error");
    }
  };
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: doc.title, url: doc.verifyUrl });
        return;
      } catch {
        return;
      }
    }
    copy();
  };
  let path = "#";
  try {
    path = new URL(doc.verifyUrl).pathname;
  } catch {}

  return (
    <>
      <div className="text-sm text-text-2">Документ {doc.number}</div>
      <div className="mt-1 pr-10 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{doc.title}</div>
      <div className="mt-5 grid grid-cols-[minmax(0,380px)_1fr] items-start gap-6 max-sm:grid-cols-1">
        <div className="[container-type:inline-size]">
          <div
            className="flex aspect-[1/1.414] flex-col rounded-[10px] bg-[#FBFBF9] text-[#1b1b1d] shadow-[0_20px_50px_-20px_rgba(0,0,0,.6)]"
            style={{ padding: "5.6cqw 5.6cqw 4.8cqw", fontSize: "2.4cqw", lineHeight: 1.55 }}
          >
            <div className="flex items-center gap-[1.5cqw] border-b-[.5px] border-[#ddd] pb-[2.2cqw] font-semibold" style={{ fontSize: "2.5cqw" }}>
              <svg viewBox="0 0 24 24" className="size-[3cqw]" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5" fill="none" stroke="#1b1b1d" strokeWidth="2" />
                <circle cx="18.7" cy="5.3" r="2.6" fill="#1b1b1d" />
              </svg>
              Университет Будущего
            </div>
            <div className="text-center" style={{ fontSize: "3.3cqw", letterSpacing: ".12em", margin: "4.8cqw 0 .9cqw" }}>
              {doc.heading}
            </div>
            <div className="text-center text-[#777]" style={{ marginBottom: "3.5cqw" }}>
              № {doc.number} от {doc.issuedDate}
            </div>
            {doc.paragraphs.map((p, i) => (
              <p key={i} style={{ marginBottom: "1.7cqw" }}>
                {p}
              </p>
            ))}
            <div className="mt-auto flex items-end justify-between gap-[2cqw]">
              <div className="rounded-[1.3cqw] border-[.5px] border-[#cfd2ff] bg-[#f4f5ff] text-[#555]" style={{ fontSize: "2.1cqw", padding: "1.3cqw 1.7cqw" }}>
                <b className="block font-medium text-[#3a3db8]" style={{ fontSize: "2.25cqw" }}>
                  Подписано электронной подписью
                </b>
                {doc.signedBy}
                <br />
                {doc.issuedDate} {doc.issuedTime}
              </div>
              <div className="shrink-0 bg-white [&>svg]:block [&>svg]:size-full" style={{ width: "14cqw", height: "14cqw" }} dangerouslySetInnerHTML={{ __html: doc.qrSvg }} />
            </div>
          </div>
        </div>
        <div>
          <b className="block font-semibold">{doc.title}</b>
          <small className="mb-3.5 block text-[13.5px] text-text-3">{doc.subtitle}</small>
          <a href={pdfHref(doc.id)} download onClick={() => toast("Скачивание началось")} className={`${ghostBtn} mb-2 w-full`}>
            <Download size={15} strokeWidth={1.6} />
            Скачать PDF
          </a>
          <button type="button" onClick={share} className={`${ghostBtn} mb-2 w-full`}>
            <Share size={15} strokeWidth={1.6} />
            Отправить
          </button>
          <button type="button" onClick={copy} className={`${ghostBtn} mb-2 w-full`}>
            <LinkIcon size={15} strokeWidth={1.6} />
            Ссылка для проверки
          </button>
          <a href={path} target="_blank" rel="noopener" className="mt-1.5 flex items-center gap-2 text-[13.5px] text-(--st-green)">
            <ShieldCheck size={16} strokeWidth={1.6} />
            Подлинность подтверждена
          </a>
        </div>
      </div>
    </>
  );
}
