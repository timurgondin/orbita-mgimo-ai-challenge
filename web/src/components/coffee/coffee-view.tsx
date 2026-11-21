"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock3,
  MapPin,
  Send,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import { Modal } from "@/components/time/modal";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import {
  COFFEE_INTERESTS,
  MAX_INTERESTS,
  MIN_INTERESTS,
  type CoffeeFormat,
} from "@/lib/coffee";
import {
  formatDayMonth,
  formatLongDate,
  mskDate,
  mskTime,
} from "@/lib/demo-clock";
import { plural } from "@/lib/phrases";
import { cn } from "@/lib/utils";
import {
  answerCoffee,
  markCoffeeMet,
  pauseCoffee,
  rescheduleCoffee,
  saveCoffee,
  type CoffeeResult,
} from "@/server/coffee/actions";
import type {
  CoffeeCurrentView,
  CoffeePastView,
  CoffeePerson,
  CoffeeView as Data,
} from "@/server/data/types";

const BTN =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-[transform,opacity,background] duration-150 active:scale-[.97] disabled:opacity-40";
const FORMATS: { id: CoffeeFormat; label: string }[] = [
  { id: "campus", label: "На кампусе" },
  { id: "online", label: "Онлайн" },
  { id: "any", label: "Как удобно" },
];
const ACCENT = "var(--c-hist)";

const longDay = (iso: string) => formatLongDate(mskDate(new Date(iso)));
const span = (a: string, b: string) =>
  `с ${mskTime(new Date(a))} до ${mskTime(new Date(b))}`;

function Avatar({ p, size = 40 }: { p: CoffeePerson; size?: number }) {
  return (
    <span
      className="mono grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        background: p.gradient,
        width: size,
        height: size,
        fontSize: size * 0.34,
      }}
    >
      {p.initials}
    </span>
  );
}

function Chip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls = cn(
    "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
    on ? "bg-text text-bg" : "bg-s2 text-text-2",
    onClick && !on && "hover:bg-s3 hover:text-text",
  );
  return onClick ? (
    <button type="button" aria-pressed={on} onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/** Интересы и формат: вступление и настройки. */
function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  extra,
}: {
  initial: { interests: string[]; format: CoffeeFormat };
  submitLabel: string;
  onSubmit: (v: { interests: string[]; format: CoffeeFormat }) => void;
  pending: boolean;
  extra?: React.ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>(initial.interests);
  const [format, setFormat] = useState<CoffeeFormat>(initial.format);
  const toggle = (i: string) =>
    setPicked((p) =>
      p.includes(i)
        ? p.filter((x) => x !== i)
        : p.length >= MAX_INTERESTS
          ? p
          : [...p, i],
    );
  const ok = picked.length >= MIN_INTERESTS && picked.length <= MAX_INTERESTS;

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold">Интересы</h3>
        <span className="text-[13px] text-text-3 tabular-nums" data-picked>
          {picked.length} из {MAX_INTERESTS}
        </span>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Интересы"
        data-interests
      >
        {COFFEE_INTERESTS.map((i) => (
          <Chip key={i} on={picked.includes(i)} onClick={() => toggle(i)}>
            {i}
          </Chip>
        ))}
      </div>
      <h3 className="mt-6 mb-3 text-[15px] font-semibold">Формат</h3>
      <Segmented
        items={FORMATS}
        value={format}
        onChange={setFormat}
        label="Формат встречи"
      />
      <button
        type="button"
        disabled={!ok || pending}
        onClick={() => onSubmit({ interests: picked, format })}
        className={cn(BTN, "mt-7 w-full bg-text text-bg")}
        data-coffee-save
      >
        {submitLabel}
      </button>
      {extra}
    </>
  );
}

function MatchCard({
  c,
  nextRound,
  run,
  onReschedule,
  pending,
  onCopy,
}: {
  c: CoffeeCurrentView;
  nextRound: string;
  run: (fn: () => Promise<CoffeeResult>) => void;
  onReschedule: () => void;
  pending: boolean;
  onCopy: (tg: string) => void;
}) {
  const p = c.partner;
  const interests = [
    ...p.shared,
    ...p.interests.filter((i) => !p.shared.includes(i)),
  ];
  const both = c.mine === "yes" && c.theirs === "yes";

  return (
    <article
      data-coffee-match
      style={{ "--cc": ACCENT } as React.CSSProperties}
      className={cn(
        "overflow-hidden rounded-3xl bg-s1",
        c.cancelled && "opacity-80",
      )}
    >
      <div className="course-cover !h-[92px]">
        <span className="absolute top-4 left-6 text-xs font-medium text-[color-mix(in_srgb,var(--cc)_60%,var(--text))]">
          Пара на неделю
        </span>
      </div>
      <div className="-mt-9 px-6 pb-6 max-sm:px-5">
        <span className="inline-block rounded-full ring-4 ring-s1">
          <Avatar p={p} size={68} />
        </span>
        <div
          className="mt-3 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]"
          data-partner
        >
          {p.name}
        </div>
        <div className="mt-1 text-[15px] text-text-2">{p.study}</div>
        {p.faculty && (
          <div className="mt-0.5 text-sm text-text-3">{p.faculty}</div>
        )}

        <div
          className="mt-5 flex flex-wrap gap-1.5"
          aria-label="Интересы"
          data-partner-interests
        >
          {interests.map((i) =>
            p.shared.includes(i) ? (
              <span
                key={i}
                data-shared
                className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[color-mix(in_srgb,var(--cc)_20%,transparent)] px-3 text-[13.5px] font-medium"
              >
                <Check size={13} strokeWidth={2.2} className="text-(--cc)" />
                {i}
              </span>
            ) : (
              <span
                key={i}
                className="inline-flex h-8 items-center rounded-[10px] bg-s2 px-3 text-[13.5px] text-text-2"
              >
                {i}
              </span>
            ),
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 text-[15px]">
          <span className="inline-flex items-center gap-2.5" data-slot>
            <Clock3
              size={17}
              strokeWidth={1.6}
              className="shrink-0 text-text-3"
            />
            {longDay(c.startsAt)}, {span(c.startsAt, c.endsAt)}
          </span>
          <span className="inline-flex items-center gap-2.5">
            {c.online ? (
              <Video
                size={17}
                strokeWidth={1.6}
                className="shrink-0 text-text-3"
              />
            ) : (
              <MapPin
                size={17}
                strokeWidth={1.6}
                className="shrink-0 text-text-3"
              />
            )}
            {c.place}
          </span>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          {c.cancelled ? (
            <p
              className="text-[15px] text-text-2"
              data-coffee-state="cancelled"
            >
              Неделя пропущена. Новая пара — в понедельник,{" "}
              {formatDayMonth(new Date(`${nextRound}T12:00:00+03:00`))}
            </p>
          ) : (
            <>
              <div
                className={cn(
                  "flex items-center gap-2 text-[15px]",
                  (both || c.mine === "yes" || c.theirs === "yes") &&
                    "mb-4 min-h-6",
                )}
                data-coffee-state={
                  both
                    ? "both"
                    : c.mine === "yes"
                      ? "waiting"
                      : c.theirs === "yes"
                        ? "ready"
                        : "new"
                }
              >
                {both ? (
                  <>
                    <span
                      className="inline-flex flex-1 items-center gap-1.5 font-medium"
                      style={{ color: "var(--st-green)" }}
                    >
                      <Check size={17} strokeWidth={2} />
                      Встреча назначена
                    </span>
                    {c.telegram && (
                      <button
                        type="button"
                        onClick={() => onCopy(c.telegram!)}
                        data-partner-tg
                        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-s2 px-3 text-sm font-medium hover:bg-s3"
                      >
                        <Send size={14} strokeWidth={1.7} />
                        {c.telegram}
                      </button>
                    )}
                  </>
                ) : c.mine === "yes" ? (
                  <span className="inline-flex items-center gap-2 text-text-2">
                    <Clock3
                      size={16}
                      strokeWidth={1.8}
                      className="text-text-3"
                    />
                    Ждём ответа пары
                  </span>
                ) : c.theirs === "yes" ? (
                  <span className="inline-flex items-center gap-2 text-text-2">
                    <i
                      className="size-2 rounded-full"
                      style={{ background: "var(--st-green)" }}
                    />
                    {p.firstName} за встречу
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.mine !== "yes" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => answerCoffee(c.id, "yes"))}
                    className={cn(
                      BTN,
                      "flex-1 bg-text text-bg max-sm:basis-full",
                    )}
                    data-coffee-yes
                  >
                    Встречаемся
                  </button>
                )}
                {c.alternatives.length > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onReschedule}
                    className={cn(
                      BTN,
                      "bg-s2 hover:bg-s3 max-sm:flex-1",
                      c.mine === "yes" && "flex-1",
                    )}
                    data-coffee-move
                  >
                    Другое время
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => answerCoffee(c.id, "skip"))}
                  className={cn(
                    BTN,
                    "px-4 text-text-2 hover:bg-s2 hover:text-text max-sm:flex-1",
                  )}
                  data-coffee-skip
                >
                  {c.mine === "yes" ? "Не смогу" : "Пропустить"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function PastRow({
  m,
  run,
  pending,
}: {
  m: CoffeePastView;
  run: (fn: () => Promise<CoffeeResult>) => void;
  pending: boolean;
}) {
  return (
    <div
      data-past={m.id}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 py-3"
    >
      <Avatar p={m.partner} size={40} />
      <span className="min-w-0">
        <b className="block truncate font-medium">{m.partner.name}</b>
        <small className="block truncate text-[13px] text-text-3">
          {m.partner.study}
        </small>
      </span>
      <span className="text-right">
        <span className="block text-[13px] whitespace-nowrap text-text-2">
          {formatDayMonth(new Date(m.date))}
        </span>
        {m.cancelled ? (
          <small className="text-[13px] text-text-3">пропущена</small>
        ) : m.met === null ? (
          <span className="mt-1 inline-flex items-center gap-1" data-met-ask>
            <span className="mr-1 text-[13px] text-text-3">Встретились?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markCoffeeMet(m.id, true))}
              className="h-7 rounded-lg bg-s2 px-2.5 text-[13px] font-medium hover:bg-s3"
              data-met-yes
            >
              Да
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markCoffeeMet(m.id, false))}
              className="h-7 rounded-lg bg-s2 px-2.5 text-[13px] font-medium hover:bg-s3"
              data-met-no
            >
              Нет
            </button>
          </span>
        ) : (
          <small className="text-[13px] text-text-3">
            {m.met ? "встретились" : "не встретились"}
          </small>
        )}
      </span>
    </div>
  );
}

export function CoffeeView({ data }: { data: Data }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { toast, node } = useToast();
  const [modal, setModal] = useState<"settings" | "move" | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const close = useCallback(() => setModal(null), []);
  const { profile, current, past } = data;
  const active = !!profile?.active;
  const met = past.filter((m) => m.met).length;

  const run = (fn: () => Promise<CoffeeResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.message : r.error, r.ok ? "ok" : "error");
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  const copy = (tg: string) => {
    navigator.clipboard?.writeText(tg).catch(() => {});
    toast(`Telegram ${tg} скопирован`, "ok");
  };

  const initial = {
    interests: profile?.interests ?? [],
    format: profile?.format ?? "campus",
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">
          Random Coffee
        </h1>
        {active && (
          <button
            type="button"
            onClick={() => setModal("settings")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium text-text-2 hover:bg-s2 hover:text-text"
            data-coffee-settings
          >
            <SlidersHorizontal size={16} strokeWidth={1.7} />
            Интересы
          </button>
        )}
      </div>

      <div className="mt-9 grid grid-cols-[1.25fr_1fr] items-start gap-10 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          {current && (
            <MatchCard
              c={current}
              nextRound={data.nextRound}
              run={run}
              pending={pending}
              onReschedule={() => {
                setSlot(current.alternatives[0]?.startsAt ?? null);
                setModal("move");
              }}
              onCopy={copy}
            />
          )}

          {!active && (
            <section
              data-coffee-join
              style={{ "--cc": ACCENT } as React.CSSProperties}
              className="overflow-hidden rounded-3xl bg-s1"
            >
              <div className="course-cover !h-[120px] px-6 pt-6 max-sm:px-5">
                <div className="relative max-w-[340px] text-[24px] leading-[1.2] font-semibold tracking-[-.03em]">
                  Кофе с новым человеком каждую неделю
                </div>
              </div>
              <div className="px-6 pt-6 pb-6 max-sm:px-5">
                <ProfileForm
                  initial={initial}
                  submitLabel={profile ? "Вернуться" : "Участвовать"}
                  pending={pending}
                  onSubmit={(v) => run(() => saveCoffee(v))}
                />
              </div>
            </section>
          )}

          {active && !current && (
            <p
              className="rounded-3xl bg-s1 px-6 py-5 text-[15px] text-text-2"
              data-coffee-state="wait"
            >
              Новая пара — в понедельник,{" "}
              {formatDayMonth(new Date(`${data.nextRound}T12:00:00+03:00`))}
            </p>
          )}
        </div>

        {(profile || past.length > 0) && (
          <section aria-label="Прошлые встречи">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-[-.02em]">
                Прошлые встречи
              </h2>
              {met > 0 && (
                <span className="text-[13px] text-text-3">
                  {met} {plural(met, "встреча", "встречи", "встреч")}
                </span>
              )}
            </div>
            {past.length ? (
              <div className="rows [--row-inset:54px]">
                {past.map((m) => (
                  <PastRow key={m.id} m={m} run={run} pending={pending} />
                ))}
              </div>
            ) : (
              <p className="py-3 text-[15px] text-text-3">Пока без встреч</p>
            )}
          </section>
        )}
      </div>

      <Modal
        open={modal === "settings"}
        onClose={close}
        accent={ACCENT}
        title="Интересы"
        width={520}
      >
        <div className="mb-5 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">
          Интересы
        </div>
        {modal === "settings" && (
          <ProfileForm
            initial={initial}
            submitLabel="Сохранить"
            pending={pending}
            onSubmit={(v) => run(() => saveCoffee(v), close)}
            extra={
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => pauseCoffee(), close)}
                className={cn(
                  BTN,
                  "mt-2 w-full text-text-2 hover:bg-s2 hover:text-text",
                )}
                data-coffee-pause
              >
                Поставить на паузу
              </button>
            }
          />
        )}
      </Modal>

      <Modal
        open={modal === "move"}
        onClose={close}
        accent={ACCENT}
        title="Другое время"
        width={480}
      >
        <div className="mb-5 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">
          Другое время
        </div>
        {current && (
          <>
            <fieldset className="flex flex-col gap-1.5" data-slots>
              <legend className="sr-only">Время встречи</legend>
              {current.alternatives.map((s) => (
                <label
                  key={s.startsAt}
                  className="flex cursor-pointer items-center gap-3.5 rounded-2xl bg-s2 px-4 py-3 transition-[background,box-shadow] duration-150 hover:bg-s3 has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--accent)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                >
                  <input
                    type="radio"
                    name="slot"
                    value={s.startsAt}
                    checked={slot === s.startsAt}
                    onChange={() => setSlot(s.startsAt)}
                    className="sr-only"
                    data-slot-option={s.startsAt}
                  />
                  <Clock3
                    size={19}
                    strokeWidth={1.6}
                    className="shrink-0 text-text-2"
                  />
                  <b className="flex-1 text-[15px] font-medium">
                    {longDay(s.startsAt)}
                  </b>
                  <span className="text-[14px] whitespace-nowrap text-text-2 tabular-nums">
                    {mskTime(new Date(s.startsAt))}–
                    {mskTime(new Date(s.endsAt))}
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              disabled={pending || !slot}
              onClick={() =>
                slot && run(() => rescheduleCoffee(current.id, slot), close)
              }
              className={cn(BTN, "mt-5 w-full bg-text text-bg")}
              data-move-send
            >
              Предложить
            </button>
          </>
        )}
      </Modal>
      {node}
    </>
  );
}
