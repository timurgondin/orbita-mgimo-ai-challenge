"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, Monitor, Plus, PenLine, QrCode, Users, Video } from "lucide-react";
import { StudentCardModal } from "@/components/profile/student-card";
import { Modal } from "@/components/time/modal";
import { Segmented } from "@/components/ui/segmented";
import { useToast, type Toast } from "@/components/ui/toast";
import { plural } from "@/lib/phrases";
import { CLOSE, DURATIONS, EQUIP, OPEN, STEP, TITLE_MAX, durationLabel, hhmm, type Equip } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { bookRoom, cancelBooking, checkIn, releaseRoom } from "@/server/rooms/actions";
import type { BookingView, RoomBusy, RoomView, RoomsData } from "@/server/data/rooms-types";
import type { StudentCardView } from "@/server/data/types";

const H2 = "mb-3 text-lg font-semibold tracking-[-.02em]";
const BTN = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-[transform,opacity,background] duration-150 active:scale-[.97] disabled:opacity-40";
const ACT = "inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-s2 px-3 text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-s3 disabled:opacity-45";
const chip = (on: boolean) =>
  cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150", on ? "bg-text text-bg" : "bg-s2 text-text-2 hover:bg-s3 hover:text-text");
const SELECT =
  "h-9 appearance-none rounded-xl bg-s2 pr-8 pl-3.5 text-sm font-medium tabular-nums text-text outline-none transition-colors hover:bg-s3 focus-visible:shadow-[0_0_0_2px_var(--accent)]";

const ICON: Record<Equip, typeof Monitor> = { screen: Monitor, board: PenLine, vks: Video };
const KINDS = [
  { id: "all", label: "Все" },
  { id: "meet", label: "Переговорки" },
  { id: "class", label: "Аудитории" },
] as const;
type Kind = (typeof KINDS)[number]["id"];
const people = (n: number) => `${n} ${plural(n, "человек", "человека", "человек")}`;
const seats = (n: number) => `${n} ${plural(n, "место", "места", "мест")}`;

/** Пересечение со слотом и до какого времени комната свободна после него. */
function fit(busy: RoomBusy[], start: number, end: number) {
  const hit = busy.filter((b) => b.from < end && b.to > start).sort((a, b) => a.from - b.from);
  if (!hit.length) {
    const next = busy.filter((b) => b.from >= end).sort((a, b) => a.from - b.from)[0];
    return { free: true as const, until: next ? next.from : CLOSE };
  }
  const first = hit[0];
  if (first.from > start) return { free: false as const, text: `Занята с ${hhmm(first.from)}`, mine: hit.some((h) => h.mine) };
  // занято с начала слота: до конца цепочки подряд идущих отрезков
  let to = first.to;
  for (const b of [...busy].sort((a, b) => a.from - b.from)) if (b.from <= to && b.to > to) to = b.to;
  return { free: false as const, text: `Занята до ${hhmm(to)}`, mine: hit.some((h) => h.mine) };
}

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

/** Полоса дня 08:00–21:00: пары и брони — серым, свои — акцентом, выбранное время — рамкой, «сейчас» — чертой. */
function Timeline({ busy, start, end, now, big, onPick }: { busy: RoomBusy[]; start: number; end: number; now: number | null; big?: boolean; onPick?: (min: number) => void }) {
  const span = CLOSE - OPEN;
  const pct = (m: number) => `${((Math.min(Math.max(m, OPEN), CLOSE) - OPEN) / span) * 100}%`;
  const width = (a: number, b: number) => `${((Math.min(b, CLOSE) - Math.max(a, OPEN)) / span) * 100}%`;
  const ok = !busy.some((b) => b.from < end && b.to > start);
  return (
    <div>
      <div
        className={cn("relative overflow-hidden rounded-full", big ? "h-9 rounded-[10px] bg-s3" : "h-1.5 bg-s2", onPick && "cursor-pointer")}
        onClick={
          onPick
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onPick(OPEN + Math.floor((((e.clientX - r.left) / r.width) * span) / STEP) * STEP);
              }
            : undefined
        }
        data-timeline
      >
        {now !== null && now > OPEN && (
          <i className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_srgb,var(--text)_7%,transparent)_3px_5px)]" style={{ width: pct(now) }} aria-hidden="true" />
        )}
        {busy.map((b, i) => (
          <i
            key={i}
            aria-hidden="true"
            className={cn("absolute inset-y-0", big && "rounded-[6px]")}
            style={{ left: pct(b.from), width: width(b.from, b.to), background: b.mine ? "var(--accent)" : b.kind === "class" ? "color-mix(in srgb, var(--text) 22%, transparent)" : "color-mix(in srgb, var(--text) 34%, transparent)" }}
          />
        ))}
        <i
          aria-hidden="true"
          className={cn("absolute inset-y-0 transition-[left,width] duration-300 ease-spring", big ? "rounded-[8px] border-2" : "rounded-full border")}
          style={{ left: pct(start), width: width(start, end), borderColor: ok ? "var(--st-green)" : "var(--urgent)", background: `color-mix(in srgb, ${ok ? "var(--st-green)" : "var(--urgent)"} ${big ? 16 : 30}%, transparent)` }}
        />
        {now !== null && now > OPEN && now < CLOSE && <i className="absolute inset-y-0 w-px bg-text" style={{ left: pct(now) }} aria-hidden="true" />}
      </div>
      {big && (
        <div className="relative mt-1.5 h-4 text-[11px] text-text-3 tabular-nums" aria-hidden="true">
          {[8, 10, 12, 14, 16, 18, 20].map((h) => (
            <span key={h} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: pct(h * 60) }}>
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Equipment({ r, full }: { r: RoomView; full?: boolean }) {
  return (
    <span className={cn("flex items-center text-text-3", full ? "flex-wrap gap-x-5 gap-y-2 text-sm text-text-2" : "gap-2.5 text-[13px]")}>
      <span className="inline-flex items-center gap-1 tabular-nums" title={seats(r.seats)}>
        <Users size={full ? 16 : 14} strokeWidth={1.7} />
        {full ? seats(r.seats) : r.seats}
      </span>
      {r.equip.map((e) => {
        const I = ICON[e];
        return (
          <span key={e} className="inline-flex items-center gap-1.5" title={EQUIP[e]}>
            <I size={full ? 16 : 14} strokeWidth={1.7} aria-label={full ? undefined : EQUIP[e]} />
            {full && EQUIP[e]}
          </span>
        );
      })}
    </span>
  );
}

function TimeControls({ start, setStart, duration, setDuration, min }: { start: number; setStart: (n: number) => void; duration: number; setDuration: (n: number) => void; min: number }) {
  const starts: number[] = [];
  for (let t = Math.max(OPEN, min); t + STEP <= CLOSE; t += STEP) starts.push(t);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative inline-flex items-center">
        <span className="sr-only">Начало</span>
        <select value={start} onChange={(e) => setStart(Number(e.target.value))} className={SELECT} data-start>
          {starts.map((t) => (
            <option key={t} value={t}>
              с {hhmm(t)}
            </option>
          ))}
        </select>
        <ChevronDown size={15} strokeWidth={1.8} className="pointer-events-none absolute right-2.5 text-text-3" />
      </label>
      <Segmented
        label="Длительность"
        value={String(duration)}
        onChange={(v) => setDuration(Number(v))}
        items={DURATIONS.filter((d) => start + d <= CLOSE).map((d) => ({ id: String(d), label: durationLabel(d) }))}
      />
    </div>
  );
}

function BookingRow({ b, onOpen, pending, onCheckIn }: { b: BookingView; onOpen: () => void; pending: boolean; onCheckIn: () => void }) {
  const live = b.state === "upcoming" || b.state === "checkin" || b.state === "active";
  return (
    <div data-booking={b.roomId} data-state={b.state} className="-mx-3.5 grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-2xl px-3.5 py-3 transition-colors duration-150 hover:bg-hover max-sm:gap-x-3">
      <button type="button" onClick={onOpen} className="col-span-2 grid grid-cols-subgrid items-center text-left">
        <span className={cn("text-[15px] font-medium tabular-nums", !live && "text-text-2")}>
          {b.start}
          <small className="block text-[13px] font-normal text-text-3">{b.end}</small>
        </span>
        <span className="min-w-0">
          <b className={cn("block truncate font-medium", !live && "text-text-2")}>{b.title ?? b.roomName}</b>
          <small className="block truncate text-[13.5px] text-text-3">
            {b.dayLabel}, {b.title ? b.roomName : b.where.toLowerCase()}
          </small>
        </span>
      </button>
      {b.state === "checkin" ? (
        <button type="button" disabled={pending} onClick={onCheckIn} data-checkin className={cn(ACT, "bg-text text-bg hover:bg-text")}>
          <QrCode size={14} strokeWidth={1.8} />
          Отметиться
        </button>
      ) : (
        <span className={cn("text-right text-[13px] max-sm:max-w-[92px] sm:whitespace-nowrap", b.state === "active" ? "text-[var(--st-green)]" : b.state === "missed" ? "text-urgent" : "text-text-3")}>{b.note}</span>
      )}
    </div>
  );
}

export function RoomsView({ d, card }: { d: RoomsData; card: StudentCardView | null }) {
  const { toast, node } = useToast();
  const { pending, run } = useRun(toast);
  const [date, setDate] = useState(d.days[0].date);
  const day = d.days.find((x) => x.date === date) ?? d.days[0];
  const [rawStart, setStart] = useState(() => Math.max(d.days[0].minStart, 10 * 60));
  const [rawDuration, setDuration] = useState(60);
  const start = Math.max(rawStart, day.minStart, OPEN);
  const duration = Math.min(rawDuration, CLOSE - start);
  const end = start + duration;
  const [kind, setKind] = useState<Kind>("all");
  const [need, setNeed] = useState(1);
  const [equip, setEquip] = useState<Equip[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bOpen, setBOpen] = useState(false);
  const [idOpen, setIdOpen] = useState(false);
  const closeRoom = useCallback(() => setRoomOpen(false), []);
  const closeB = useCallback(() => setBOpen(false), []);
  const closeId = useCallback(() => setIdOpen(false), []);
  const now = date === d.nowDate ? d.nowMin : null;

  const list = useMemo(() => {
    const rows = d.rooms
      .filter((r) => (kind === "all" || r.kind === kind) && r.seats >= need && equip.every((e) => r.equip.includes(e)))
      .map((r) => ({ r, f: fit(r.busy[date] ?? [], start, end) }));
    const rank = (x: (typeof rows)[number]) => (x.f.free ? 0 : 1);
    return rows.sort((a, b) => rank(a) - rank(b) || (a.r.kind === b.r.kind ? 0 : a.r.kind === "meet" ? -1 : 1) || a.r.seats - b.r.seats);
  }, [d.rooms, kind, need, equip, date, start, end]);

  const room = d.rooms.find((r) => r.id === roomId);
  const roomFit = room ? fit(room.busy[date] ?? [], start, end) : null;
  const booking = [...d.upcoming, ...d.past].find((b) => b.id === bookingId);
  const freeCount = list.filter((x) => x.f.free).length;

  const book = () => {
    if (!room) return;
    run(() => bookRoom({ roomId: room.id, date, start, duration, title }), () => {
      setRoomOpen(false);
      setTitle("");
    });
  };

  return (
    <>
      <div className="flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Аудитории</h1>
        {card && (
          <button type="button" onClick={() => setIdOpen(true)} data-orbita-id className="inline-flex h-10 items-center gap-2 rounded-xl bg-s1 px-4 text-sm font-medium transition-[background,transform] duration-150 hover:bg-s2 active:scale-[.97] max-sm:h-[52px] max-sm:justify-center max-sm:gap-2.5 max-sm:rounded-2xl max-sm:text-[15px]">
            <QrCode className="size-4 max-sm:size-5" strokeWidth={1.7} />
            Орбита ID
          </button>
        )}
      </div>

      <section aria-label="Когда и кто" className="mt-9 grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[28px] bg-s1 p-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:gap-10 min-[900px]:p-6" data-finder>
        <div className="flex min-w-0 flex-col gap-4">
          <div role="group" aria-label="День" className="grid grid-cols-6 gap-1" data-days>
            {d.days.map((x) => {
              const on = x.date === date;
              return (
                <button
                  key={x.date}
                  type="button"
                  aria-pressed={on}
                  aria-label={x.label}
                  onClick={() => setDate(x.date)}
                  data-day={x.date}
                  className={cn("flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] transition-[background,color,transform] duration-150 active:scale-[.97]", on ? "bg-text text-bg" : "text-text-2 hover:bg-hover")}
                >
                  <span className={cn("text-[12px]", on ? "text-bg/70" : x.date === d.nowDate ? "text-accent" : "text-text-3")}>{x.dow}</span>
                  <b className="text-[17px] leading-none font-semibold tabular-nums">{x.day}</b>
                </button>
              );
            })}
          </div>
          <TimeControls start={start} setStart={setStart} duration={duration} setDuration={setDuration} min={day.minStart} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Тип" value={kind} onChange={setKind} items={KINDS.map((k) => ({ id: k.id, label: k.label }))} />
            <span className="inline-flex items-center gap-1.5 text-sm text-text-2" role="group" aria-label="Сколько вас">
              <button type="button" aria-label="Меньше" disabled={need <= 1} onClick={() => setNeed((n) => n - 1)} className="grid size-9 place-items-center rounded-xl bg-s2 transition-colors hover:bg-s3 disabled:opacity-40">
                <Minus size={14} strokeWidth={2} />
              </button>
              <span className="w-[92px] text-center tabular-nums" data-need>
                {people(need)}
              </span>
              <button type="button" aria-label="Больше" disabled={need >= 30} onClick={() => setNeed((n) => n + 1)} className="grid size-9 place-items-center rounded-xl bg-s2 transition-colors hover:bg-s3 disabled:opacity-40">
                <Plus size={14} strokeWidth={2} />
              </button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-filters>
            {(Object.keys(EQUIP) as Equip[]).map((e) => {
              const on = equip.includes(e);
              const I = ICON[e];
              return (
                <button key={e} type="button" aria-pressed={on} onClick={() => setEquip((l) => (on ? l.filter((x) => x !== e) : [...l, e]))} className={chip(on)} data-equip={e}>
                  <I size={15} strokeWidth={1.7} />
                  {EQUIP[e]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 [grid-template-areas:'mine'_'rooms'_'past'] min-[1000px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] min-[1000px]:grid-rows-[auto_1fr] min-[1000px]:[grid-template-areas:'rooms_mine'_'rooms_past']">
        <section aria-labelledby="rooms" className="min-w-0 [grid-area:rooms]">
          <h2 id="rooms" className={H2}>
            {freeCount ? `Свободно ${freeCount} из ${list.length}` : list.length ? "Всё занято" : "Комнат нет"}
          </h2>
          {list.length > 0 ? (
            <div className="rows [--row-inset:14px]" data-room-list>
              {list.map(({ r, f }) => (
                <button
                  key={r.id}
                  type="button"
                  data-room={r.id}
                  data-free={f.free ? "1" : "0"}
                  onClick={() => {
                    setRoomId(r.id);
                    setRoomOpen(true);
                  }}
                  className="-mx-3.5 flex w-[calc(100%+28px)] flex-col gap-2.5 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover"
                >
                  <span className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5">
                    <b className={cn("truncate font-medium", !f.free && "text-text-2")}>{r.name}</b>
                    <span className={cn("flex items-center gap-1.5 justify-self-end text-[13px] whitespace-nowrap", f.free ? "text-text" : "text-text-3")}>
                      <i className="size-2 rounded-full" style={{ background: f.free ? "var(--st-green)" : f.mine ? "var(--accent)" : "var(--st-gray)" }} />
                      {f.free ? (f.until >= CLOSE ? "Свободна до вечера" : `Свободна до ${hhmm(f.until)}`) : f.mine ? "Ваша бронь" : f.text}
                    </span>
                    <small className="truncate text-[13px] text-text-3">
                      Корпус {r.building}, {r.kind === "meet" ? `ауд. ${r.number}` : r.place.toLowerCase()}
                    </small>
                    <span className="justify-self-end">
                      <Equipment r={r} />
                    </span>
                  </span>
                  <span className="w-full">
                    <Timeline busy={r.busy[date] ?? []} start={start} end={end} now={now} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-text-3">Под эти условия комнат нет</p>
          )}
        </section>

          <section aria-labelledby="mine" className="min-w-0 [grid-area:mine]">
            <h2 id="mine" className={H2}>
              Мои брони
            </h2>
            {d.upcoming.length ? (
              <div className="rows [--row-inset:14px]" data-mine>
                {d.upcoming.map((b) => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    pending={pending}
                    onOpen={() => {
                      setBookingId(b.id);
                      setBOpen(true);
                    }}
                    onCheckIn={() => run(() => checkIn(b.id))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[15px] text-text-3">Броней нет</p>
            )}
          </section>
          {d.past.length > 0 && (
            <section aria-labelledby="past" className="min-w-0 [grid-area:past]">
              <h2 id="past" className={H2}>
                Прошедшие
              </h2>
              <div className="rows [--row-inset:14px]" data-past>
                {d.past.map((b) => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    pending={pending}
                    onOpen={() => {
                      setBookingId(b.id);
                      setBOpen(true);
                    }}
                    onCheckIn={() => {}}
                  />
                ))}
              </div>
            </section>
          )}
      </div>

      <Modal open={roomOpen} onClose={closeRoom} accent={room?.kind === "class" ? "var(--c-econ)" : "var(--accent)"} title={room?.name ?? "Комната"} width={520}>
        {room && roomFit && (
          <div data-room-modal={room.id}>
            <div className="text-sm text-text-2">{room.kind === "meet" ? "Переговорка" : room.place}</div>
            <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{room.name}</div>
            <div className="mt-1 text-[15px] text-text-2">
              {room.where}, {room.kind === "meet" ? `${room.place.toLowerCase()}, ауд. ${room.number}` : `ауд. ${room.number}`}
            </div>
            <div className="mt-4">
              <Equipment r={room} full />
            </div>

            <div className="mt-6 mb-2.5 flex items-baseline justify-between gap-3">
              <b className="font-medium">{day.label}</b>
              <span className={cn("text-sm", roomFit.free ? "text-text-2" : "text-urgent")} data-room-fit>
                {roomFit.free ? `с ${hhmm(start)} до ${hhmm(end)}` : roomFit.text}
              </span>
            </div>
            <Timeline busy={room.busy[date] ?? []} start={start} end={end} now={now} big onPick={(m) => m >= day.minStart && m + STEP <= CLOSE && setStart(m)} />
            <div className="mt-4">
              <TimeControls start={start} setStart={setStart} duration={duration} setDuration={setDuration} min={day.minStart} />
            </div>
            <label className="mt-5 block">
              <span className="sr-only">Тема</span>
              <input
                type="text"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Тема"
                autoComplete="off"
                enterKeyHint="done"
                data-title
                className="w-full rounded-[14px] bg-s3 px-3.5 py-3 text-[15px] text-text outline-none placeholder:text-text-3 focus:shadow-[0_0_0_2px_var(--accent)]"
              />
            </label>
            <button type="button" disabled={pending || !roomFit.free} onClick={book} data-book className={cn(BTN, "mt-5 w-full bg-text text-bg")}>
              {pending ? "Бронируем…" : roomFit.free ? `Забронировать с ${hhmm(start)} до ${hhmm(end)}` : "Выберите другое время"}
            </button>
          </div>
        )}
      </Modal>

      <Modal open={bOpen} onClose={closeB} accent="var(--accent)" title={booking?.roomName ?? "Бронь"} width={460}>
        {booking && (
          <div data-booking-modal={booking.state}>
            <div className="text-sm text-text-2">{booking.title ? booking.roomName : "Бронь"}</div>
            <div className="mt-1 text-[26px] leading-[1.15] font-semibold tracking-[-.03em]">{booking.title ?? booking.roomName}</div>
            <div className="mt-1 text-[15px] text-text-2">
              {booking.dayLabel}, с {booking.start} до {booking.end}
            </div>
            <div className="text-[15px] text-text-2">
              {booking.where}, {booking.place.toLowerCase()}, ауд. {booking.number}
            </div>
            {booking.note && (
              <div className={cn("mt-4 text-sm", booking.state === "missed" ? "text-urgent" : booking.state === "active" ? "text-[var(--st-green)]" : "text-text-2")}>{booking.note}</div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {booking.state === "checkin" && (
                <button type="button" disabled={pending} onClick={() => run(() => checkIn(booking.id), closeB)} data-checkin-modal className={cn(BTN, "w-full bg-text text-bg")}>
                  <QrCode size={17} strokeWidth={1.7} />
                  Отметиться по Орбита ID
                </button>
              )}
              {booking.state === "active" && (
                <button type="button" disabled={pending} onClick={() => run(() => releaseRoom(booking.id), closeB)} data-release className={cn(BTN, "w-full bg-s3")}>
                  Освободить сейчас
                </button>
              )}
              {(booking.state === "upcoming" || booking.state === "checkin") && (
                <button type="button" disabled={pending} onClick={() => run(() => cancelBooking(booking.id), closeB)} data-cancel className={cn(BTN, "w-full bg-s3")}>
                  Отменить бронь
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
