"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Check, LoaderCircle, Phone, Send } from "lucide-react";
import { confirmPersonalData, savePhoto } from "@/server/onboarding/actions";
import { createRequest } from "@/server/office/actions";
import { updateContact } from "@/server/profile/actions";
import { CONTACT_ERROR, CONTACT_PREFIX, contactValue, maskContact, normalizeContact, type ContactField } from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { squareJpeg } from "./photo";
import s from "./classes";

/**
 * Задачи первокурсника — общие для онбординга (layout="page": кнопки внизу экрана)
 * и окон «Первых шагов» на «Сегодня» (layout="modal": кнопки сразу под содержимым).
 */
export type TaskLayout = "page" | "modal";

export const primaryBtn =
  "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-text px-6 text-[15px] font-semibold tracking-[-.01em] text-bg transition-[transform,opacity] duration-150 ease-soft hover:opacity-90 active:scale-[.985] disabled:opacity-50";
export const secondaryBtn =
  "inline-flex h-[48px] w-full items-center justify-center rounded-[14px] px-6 text-[15px] font-medium text-text-2 transition-colors hover:bg-hover hover:text-text";

/** Задержка появления элемента, мс (только на странице онбординга). */
export const delay = (ms: number) => ({ "--d": ms }) as React.CSSProperties;

function Actions({ layout, d, spacer = true, children }: { layout: TaskLayout; d?: number; spacer?: boolean; children: React.ReactNode }) {
  return (
    <>
      {layout === "page" && spacer && <div className="flex-1 sm:flex-none" />}
      <div className={cn("flex flex-col gap-1.5", layout === "page" ? cn(s.rise, "mt-8") : "mt-6")} style={layout === "page" ? delay(d ?? 260) : undefined}>
        {children}
      </div>
    </>
  );
}

/* ---------- Личные данные: «Всё верно» или исправления (несколько полей сразу) ---------- */
const YELLOW = "var(--st-yellow)";
const MAX_FIX = 60;

export function DataReview({ rows, layout, onDone }: { rows: [string, string][]; layout: TaskLayout; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<"view" | "fix" | "sent">("view");
  const [fixes, setFixes] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [pending, start] = useTransition();
  const field = useRef<HTMLInputElement>(null);
  const original = Object.fromEntries(rows);
  const changed = (k: string) => fixes[k] !== undefined && fixes[k].trim() !== "" && fixes[k].trim() !== original[k];
  const changedKeys = rows.map(([k]) => k).filter(changed);

  const pick = (k: string) => {
    setActive(k);
    setFixes((f) => (f[k] === undefined ? { ...f, [k]: original[k].slice(0, MAX_FIX) } : f));
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    });
  };

  const confirm = () =>
    start(async () => {
      const r = await confirmPersonalData();
      if (r.ok) onDone("Данные подтверждены");
      else setError(r.error);
    });
  const report = () =>
    start(async () => {
      setError(null);
      const comment = changedKeys.map((k) => `${k}: ${fixes[k].trim()}`).join("\n");
      const r = await createRequest("data-fix", { subject: changedKeys, comment });
      if (!r.ok) return setError(r.error);
      setNumber(r.number ?? "");
      setMode("sent");
      setTimeout(() => onDone(`Заявка ${r.number ?? ""} в учебном офисе`), 1600);
    });

  return (
    <>
      <dl className={cn("rounded-[22px] bg-s1/85 px-6 backdrop-blur-md", layout === "page" ? cn(s.rise, "mt-7") : "bg-s3/60")} style={layout === "page" ? delay(120) : undefined}>
        {rows.map(([k, v], n) => (
          <div key={k} className={cn("py-3.5", n > 0 && "border-t-[.5px] border-line")} data-row={k} data-changed={changed(k) || undefined}>
            <dt className="flex items-center gap-1.5 text-[13px] text-text-3">
              {k}
              {changed(k) && <span className="size-1.5 rounded-full" style={{ background: YELLOW }} />}
            </dt>
            {changed(k) ? (
              <dd className="mt-0.5 text-[15.5px] tracking-[-.01em]">
                <span className="block text-[13.5px] text-text-3 line-through">{v}</span>
                <span style={{ color: YELLOW }}>{fixes[k].trim()}</span>
              </dd>
            ) : (
              <dd className="mt-0.5 text-[15.5px] tracking-[-.01em]">{v}</dd>
            )}
          </div>
        ))}
      </dl>

      {mode === "view" && (
        <Actions layout={layout}>
          <button type="button" onClick={confirm} disabled={pending} className={primaryBtn} data-confirm>
            {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.2} />}
            Всё верно
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("fix");
              pick(rows[0][0]);
            }}
            className={secondaryBtn}
            data-report
          >
            Есть ошибка
          </button>
        </Actions>
      )}

      {mode === "fix" && (
        <>
          <div className={cn("mt-5 rounded-[22px] p-5", layout === "page" ? cn(s.rise, "bg-s1/90 backdrop-blur-md") : "bg-s3/60")}>
            <div className="flex flex-wrap gap-1.5">
              {rows.map(([k]) => {
                const on = active === k;
                const fixed = changed(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(k)}
                    className={cn(
                      "h-9 rounded-full px-3.5 text-[13.5px] font-medium transition-[background-color,color,box-shadow]",
                      on ? "bg-text text-bg" : fixed ? "" : "bg-s2 text-text-2 hover:text-text",
                    )}
                    style={!on && fixed ? { color: YELLOW, background: `color-mix(in srgb, ${YELLOW} 16%, transparent)` } : undefined}
                    data-fix-chip={k}
                    data-fixed={fixed || undefined}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            {active && (
              <label className="mt-3 block">
                <span className="sr-only">{active}: как правильно</span>
                <input
                  ref={field}
                  value={fixes[active] ?? ""}
                  onChange={(e) => setFixes((f) => ({ ...f, [active]: e.target.value }))}
                  maxLength={MAX_FIX}
                  enterKeyHint="done"
                  autoComplete="off"
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-[52px] w-full rounded-[14px] bg-s2 px-4 text-[16px] focus-visible:ring-2 focus-visible:ring-(--accent)"
                  style={{ outline: "none" }}
                  data-fix-input
                />
              </label>
            )}
          </div>
          <Actions layout={layout} d={0}>
            <button type="button" onClick={report} disabled={pending || !changedKeys.length} className={primaryBtn} data-send-fix>
              {pending && <LoaderCircle size={18} className="animate-spin" />}
              {changedKeys.length > 1 ? `Отправить ${changedKeys.length} исправления` : "Отправить в учебный офис"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setFixes({});
                setActive(null);
              }}
              className={secondaryBtn}
            >
              Отмена
            </button>
          </Actions>
        </>
      )}

      {mode === "sent" && (
        <div className={cn(s.rise, "mt-8 flex items-center justify-center gap-2.5 py-4 text-[15px]")} role="status">
          <span className="grid size-7 place-items-center rounded-full bg-(--st-green) text-bg">
            <Check size={16} strokeWidth={2.6} />
          </span>
          Заявка {number} в учебном офисе
        </div>
      )}
      {error && <p className="mt-3 text-center text-[13.5px] text-(--st-red)">{error}</p>}
    </>
  );
}

/* ---------- Контакты ---------- */
export function ContactsForm({
  phone: phone0,
  telegram: tg0,
  layout,
  onDone,
  onSkip,
}: {
  phone: string | null;
  telegram: string | null;
  layout: TaskLayout;
  onDone: (msg: string) => void;
  onSkip?: () => void;
}) {
  const [phone, setPhone] = useState(maskContact("phone", phone0 ?? ""));
  const [tg, setTg] = useState(tg0 ?? "");
  const [err, setErr] = useState<Partial<Record<ContactField, string>>>({});
  const [pending, start] = useTransition();

  const save = () => {
    const bad: Partial<Record<ContactField, string>> = {};
    const phoneV = contactValue("phone", phone);
    const tgV = contactValue("telegram", tg);
    if (normalizeContact("phone", phoneV) === undefined) bad.phone = CONTACT_ERROR.phone;
    if (normalizeContact("telegram", tgV) === undefined) bad.telegram = CONTACT_ERROR.telegram;
    setErr(bad);
    if (Object.keys(bad).length) return;
    start(async () => {
      const out: Partial<Record<ContactField, string>> = {};
      for (const [f, v, was] of [
        ["phone", phoneV, phone0],
        ["telegram", tgV, tg0],
      ] as const) {
        if (normalizeContact(f, v) === was) continue;
        const r = await updateContact(f, v);
        if (!r.ok) out[f] = r.error;
      }
      setErr(out);
      if (!Object.keys(out).length) onDone("Контакты сохранены");
    });
  };

  const field = (f: ContactField, value: string, set: (v: string) => void, icon: React.ReactNode, n: number) => (
    <label className={cn("block", layout === "page" && s.rise)} style={layout === "page" ? delay(120 + n * 80) : undefined}>
      <span className="sr-only">{f === "phone" ? "Телефон" : "Telegram"}</span>
      <span
        className={cn(
          "flex h-[56px] items-center gap-3 rounded-[16px] px-5 transition-shadow focus-within:ring-2 focus-within:ring-(--accent)",
          layout === "page" ? "bg-s1/85 backdrop-blur-md" : "bg-s3/60",
          err[f] && "ring-2 ring-(--st-red)",
        )}
      >
        <span className="text-text-3">{icon}</span>
        <input
          value={value}
          onChange={(e) => set(maskContact(f, e.target.value, value))}
          onFocus={() => !value && set(CONTACT_PREFIX[f])}
          onBlur={() => !contactValue(f, value) && set("")}
          maxLength={40}
          placeholder={f === "phone" ? "+7 900 000-00-00" : "@telegram"}
          enterKeyHint={f === "phone" ? "next" : "done"}
          {...(f === "phone"
            ? { type: "tel", inputMode: "tel" as const, autoComplete: "tel" }
            : { type: "text", autoComplete: "off", autoCapitalize: "none", autoCorrect: "off", spellCheck: false })}
          onKeyDown={(e) => e.key === "Enter" && f === "telegram" && save()}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-text-3"
          // кольцо фокуса — у капсулы (focus-within); общее :focus-visible из globals.css дало бы вторую рамку
          style={{ outline: "none" }}
          data-contact={f}
        />
      </span>
      {err[f] && <span className="mt-1.5 block px-1 text-[13px] text-(--st-red)">{err[f]}</span>}
    </label>
  );

  return (
    <>
      <div className={cn("flex flex-col gap-3", layout === "page" ? "mt-7" : "mt-1")}>
        {field("phone", phone, setPhone, <Phone size={19} strokeWidth={1.8} />, 0)}
        {field("telegram", tg, setTg, <Send size={19} strokeWidth={1.8} />, 1)}
      </div>
      <Actions layout={layout} d={300}>
        <button type="button" onClick={save} disabled={pending} className={primaryBtn} data-next>
          {pending && <LoaderCircle size={18} className="animate-spin" />}
          {layout === "page" ? "Дальше" : "Сохранить"}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className={secondaryBtn}>
            Позже
          </button>
        )}
      </Actions>
    </>
  );
}

/* ---------- Фото ---------- */
export function PhotoPicker({
  initials,
  background,
  photo,
  layout,
  onPhoto,
  onDone,
  onSkip,
}: {
  initials: string;
  background: string;
  photo: string | null;
  layout: TaskLayout;
  onPhoto: (url: string) => void;
  onDone: () => void;
  onSkip?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = preview ?? photo;

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    start(async () => {
      let blob: Blob;
      try {
        blob = await squareJpeg(file);
      } catch {
        setError("Не получилось открыть фото");
        return;
      }
      setPreview(URL.createObjectURL(blob));
      const form = new FormData();
      form.set("photo", blob, "photo.jpg");
      const r = await savePhoto(form);
      if (r.ok && r.photo) onPhoto(r.photo);
      else {
        setPreview(null);
        setError(r.ok ? "Не получилось" : r.error);
      }
    });
  };

  return (
    <>
      <div className={cn("flex items-center justify-center", layout === "page" ? "flex-1 py-8 sm:flex-none sm:py-12" : "py-4")}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn("group relative rounded-full", layout === "page" ? cn(s.rise, "size-[220px] max-sm:size-[188px]") : "size-[168px]")}
          style={layout === "page" ? delay(140) : undefined}
          aria-label={shown ? "Выбрать другое фото" : "Выбрать фото"}
          data-photo-pick
        >
          <span
            className={cn(
              "mono grid size-full place-items-center overflow-hidden rounded-full font-semibold shadow-[0_0_0_6px_var(--bg),0_0_0_7px_var(--line)]",
              layout === "page" ? "text-[64px]" : "text-[52px]",
            )}
            style={{ background }}
          >
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element -- предпросмотр blob: и своё фото
              <img src={shown} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="absolute right-1.5 bottom-1.5 grid size-12 place-items-center rounded-full bg-text text-bg shadow-lg transition-transform group-hover:scale-105 group-active:scale-95 max-sm:size-11">
            {pending ? <LoaderCircle size={20} className="animate-spin" /> : <Camera size={20} strokeWidth={2} />}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
          data-photo-input
        />
      </div>
      {error && <p className="mb-2 text-center text-[13.5px] text-(--st-red)">{error}</p>}
      <Actions layout={layout} spacer={false}>
        {photo ? (
          <button type="button" onClick={onDone} disabled={pending} className={primaryBtn} data-next>
            {layout === "page" ? "Дальше" : "Готово"}
          </button>
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className={primaryBtn}>
            {pending && <LoaderCircle size={18} className="animate-spin" />}
            Выбрать фото
          </button>
        )}
        {!photo && onSkip && (
          <button type="button" onClick={onSkip} className={secondaryBtn} data-skip>
            Позже
          </button>
        )}
      </Actions>
    </>
  );
}
