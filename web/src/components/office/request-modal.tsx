"use client";

import { useState, useTransition } from "react";
import { Check, Circle, LoaderCircle, MessageCircle, Pause } from "lucide-react";
import { UploadBox, UploadedFiles } from "./upload-box";
import { cn } from "@/lib/utils";
import { replyToRequest, withdrawRequest } from "@/server/office/actions";
import type { OfficeRequestView } from "@/server/data/types";
import { MAX_MESSAGE } from "@/lib/office-catalog";
import { AVATAR_GRADIENTS } from "@/lib/user-view";
import type { Toast } from "@/components/ui/toast";
import { OfficeTag, ghostBtn, whiteBtn } from "./icons";

export function RequestContent({ req, toast, onClose }: { req: OfficeRequestView; toast: Toast; onClose: () => void }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const r = await replyToRequest(req.id, text);
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) {
        setText("");
        setReplying(false);
      }
    });
  const withdraw = () =>
    start(async () => {
      const r = await withdrawRequest(req.id);
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) onClose();
      setConfirm(false);
    });

  return (
    <>
      <div className="text-sm text-text-2">Заявка {req.number}</div>
      <div className="mt-1 pr-10 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{req.title}</div>
      <div className="mt-2.5 flex items-center gap-2">
        <OfficeTag status={req.waiting ? "waiting" : req.status} />
        {!req.waiting && <span className="text-sm text-text-3">{req.eta}</span>}
      </div>

      {req.waiting && <UploadBox req={req} toast={toast} />}
      {req.files.length > 0 && <UploadedFiles files={req.files} />}

      <div className="mt-[22px]">
        {req.events.map((e, i) => (
          <div key={i} className="relative grid grid-cols-[24px_1fr_auto] gap-3.5 pb-[18px] last:pb-0">
            {i < req.events.length - 1 && <span className="absolute top-6 bottom-0.5 left-[11.5px] w-px bg-line" />}
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full",
                e.state === "fin" ? "bg-text text-bg" : e.state === "cur" && req.waiting ? "bg-[color-mix(in_srgb,var(--urgent)_20%,transparent)] text-urgent" : e.state === "cur" ? "bg-[color-mix(in_srgb,var(--st-blue)_20%,transparent)] text-(--st-blue)" : "bg-s3 text-text-3",
              )}
            >
              {e.state === "fin" ? <Check size={13} strokeWidth={2.4} /> : e.state === "cur" && req.waiting ? <Pause size={12} strokeWidth={2.6} /> : e.state === "cur" ? <LoaderCircle size={13} strokeWidth={2.4} /> : <Circle size={13} strokeWidth={2.4} />}
            </span>
            <div>
              <b className={cn("block font-medium", e.state === "todo" && "text-text-3")}>{e.title}</b>
              <small className={cn("text-[13.5px]", e.state === "cur" && req.waiting ? "text-urgent" : "text-text-3")}>{e.small}</small>
            </div>
            <span className="text-[13px] whitespace-nowrap text-text-3">{e.at}</span>
          </div>
        ))}
      </div>

      {req.messages.map((m) => (
        <div key={m.id} className="mt-1.5 flex gap-2.5 rounded-[14px] bg-s1 px-3.5 py-3 text-sm text-text-2 first-of-type:mt-[22px]">
          <span
            className="mono grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
            style={{ background: m.staff ? AVATAR_GRADIENTS.mint : AVATAR_GRADIENTS.sand }}
          >
            {m.initials}
          </span>
          <div className="min-w-0">
            <b className="font-medium text-text">{m.staff ? m.authorName : "Вы"}</b>
            <br />
            <span className="break-words whitespace-pre-wrap">{m.body}</span>
          </div>
        </div>
      ))}

      {replying && (
        <textarea
          autoFocus
          aria-label="Сообщение"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_MESSAGE}
          placeholder="Сообщение"
          className="mt-3 min-h-[76px] w-full resize-none rounded-[14px] bg-s1 px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-3 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
        />
      )}

      <div className="mt-[26px] flex items-center justify-between gap-3 border-t-[.5px] border-line pt-5">
        {replying ? (
          <>
            <button type="button" onClick={() => setReplying(false)} className="text-sm text-text-3 hover:text-text">
              Отмена
            </button>
            <button type="button" disabled={pending || !text.trim()} onClick={send} className={whiteBtn}>
              Отправить
            </button>
          </>
        ) : (
          <>
            {req.canWithdraw ? (
              <button type="button" disabled={pending} onClick={() => (confirm ? withdraw() : setConfirm(true))} onBlur={() => setConfirm(false)} className={cn("h-10 rounded-[12px] px-3.5 text-sm font-medium transition-colors", confirm ? "text-(--st-red)" : "text-text-3 hover:text-text")}>
                {confirm ? "Точно отозвать?" : "Отозвать заявку"}
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => setReplying(true)} className={ghostBtn}>
              <MessageCircle size={15} strokeWidth={1.6} />
              Ответить
            </button>
          </>
        )}
      </div>
    </>
  );
}
