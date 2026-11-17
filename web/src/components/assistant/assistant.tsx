"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { useTheme } from "next-themes";
import { ThinkingOrb } from "thinking-orbs";
import { Orb } from "@/components/shell/orb";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { askAssistant } from "@/server/assistant/actions";
import type { AssistantReply, ThinkStep } from "@/server/assistant/types";
import { ReplyCard } from "./cards";

/**
 * ИИ-помощник «Орбиты»: окно по центру, открывается сферой в доке и Ctrl/⌘ K.
 * Модели нет — ответ собирает сервер (src/server/assistant), а здесь он «проживается»: сфера думает по шагам, текст печатается.
 */
type Ctx = { open: () => void };
const AssistantContext = createContext<Ctx | null>(null);

export function useAssistant(): Ctx {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant: нет AssistantProvider выше по дереву");
  return ctx;
}

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; reply: AssistantReply; shown: number; done: boolean };

const START_CHIPS = ["Какая следующая пара?", "Мой средний балл", "Что сдать на неделе?", "Закажи справку об обучении", "Запиши на консультацию"];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState<ThinkStep | null>(null);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const { toast, node } = useToast();
  const { resolvedTheme } = useTheme();
  const light = resolvedTheme === "light";
  const busy = thinking !== null || msgs.some((m) => m.role === "bot" && !m.done);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  // Ctrl K / ⌘ K — из любого раздела
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setText("");
      setMsgs((m) => [...m, { id: ++seq.current, role: "user", text: q }]);
      setThinking({ state: "searching", label: "Думаю" });
      const started = performance.now();
      let reply: AssistantReply;
      try {
        reply = await askAssistant(q);
      } catch {
        reply = { steps: [], text: "Не получилось ответить. Попробуйте ещё раз." };
      }
      // «размышление»: каждый шаг — своё состояние сферы и подпись
      const quick = reducedMotion();
      const steps = reply.steps.length ? reply.steps : [{ state: "composing" as const, label: "Думаю" }];
      for (const [i, step] of steps.entries()) {
        setThinking(step);
        await wait(quick ? 150 : i === 0 ? Math.max(500, 900 - (performance.now() - started)) : 750);
      }
      setThinking(null);
      const id = ++seq.current;
      const words = reply.text.split(/(?<=\s)/);
      setMsgs((m) => [...m, { id, role: "bot", reply, shown: quick ? words.length : 0, done: quick }]);
      if (quick) return;
      // печать по словам
      for (let n = 1; n <= words.length; n++) {
        await wait(28 + Math.random() * 34);
        setMsgs((m) => m.map((x) => (x.id === id && x.role === "bot" ? { ...x, shown: n } : x)));
      }
      setMsgs((m) => m.map((x) => (x.id === id && x.role === "bot" ? { ...x, done: true } : x)));
    },
    [busy],
  );

  const empty = msgs.length === 0 && !thinking;
  const last = msgs.at(-1);

  return (
    <AssistantContext.Provider value={{ open }}>
      {children}
      <Dialog
        open={isOpen}
        onClose={close}
        label="Орбита — помощник"
        className={cn(
          // как Spotlight: верх окна на месте, растёт вниз по мере диалога
          "mt-[max(16px,10dvh)] mb-0 h-fit max-h-[min(680px,calc(100dvh-max(16px,10dvh)-16px))] w-[min(620px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] open:flex",
        )}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="absolute top-3.5 right-3.5 z-[2] grid size-8 place-items-center rounded-full text-text-3 transition-colors hover:bg-hover hover:text-text"
        >
          <X size={16} strokeWidth={1.6} />
        </button>

        {empty ? (
          <div className="flex flex-col items-center px-6 pt-12 pb-7 text-center">
            <Orb size={56} state={text ? "listening" : undefined} />
            <h2 className="mt-5 text-[22px] font-semibold tracking-[-.025em]">Чем помочь?</h2>
            <Chips items={START_CHIPS} onPick={ask} className="mt-5 justify-center" />
          </div>
        ) : (
          // column-reverse держит прокрутку у нижнего края, пока ответ растёт
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_56px)]">
            <div role="log" aria-live="polite" aria-label="Диалог" className="flex flex-col gap-5 px-5 pt-14 pb-4 sm:px-7">
              {msgs.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="max-w-[80%] self-end rounded-[20px] rounded-br-[6px] bg-s3 px-4 py-2.5 text-[15px] leading-[1.45] break-words">
                    {m.text}
                  </div>
                ) : (
                  <BotMessage key={m.id} msg={m} toast={toast} isLast={m === last} onPick={ask} />
                ),
              )}
              {thinking && (
                <div className="flex items-center gap-3" role="status">
                  {/* состояние сферы — по шагу ответа (ищет, считает, связывает, пишет); оттенок — акцент темы */}
                  <ThinkingOrb state={thinking.state} size={32} theme={light ? "light" : "dark"} color={light ? "#5457e6" : "#8b8eff"} aria-hidden="true" />
                  <span key={thinking.label} className="assistant-step text-sm text-text-3">
                    {thinking.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
          className="px-3 pb-3 sm:px-4 sm:pb-4"
        >
          <div className="flex items-center gap-2 rounded-full bg-s1 py-1.5 pr-1.5 pl-5 shadow-[inset_0_0_0_.5px_var(--line)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--accent)]">
            <label htmlFor="assistant-input" className="sr-only">
              Вопрос
            </label>
            <input
              ref={inputRef}
              id="assistant-input"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Спросите Орбиту"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={300}
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3"
              // кольцо фокуса — у капсулы вокруг поля (focus-within); глобальное :focus-visible вне слоёв, поэтому inline
              style={{ outline: "none" }}
            />
            <button
              type="submit"
              disabled={!text.trim() || busy}
              aria-label="Отправить"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-text text-bg transition-[opacity,scale] duration-200 active:scale-[.94] disabled:opacity-25"
            >
              <ArrowUp size={18} strokeWidth={2} />
            </button>
          </div>
        </form>
      </Dialog>
      {node}
    </AssistantContext.Provider>
  );
}

function BotMessage({
  msg,
  toast,
  isLast,
  onPick,
}: {
  msg: Extract<Msg, { role: "bot" }>;
  toast: ReturnType<typeof useToast>["toast"];
  isLast: boolean;
  onPick: (q: string) => void;
}) {
  const words = msg.reply.text.split(/(?<=\s)/);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-[1.55]">
        <span className="sr-only">{msg.reply.text}</span>
        <span aria-hidden="true">{words.slice(0, msg.shown).join("")}</span>
      </p>
      {msg.done && msg.reply.card && (
        <div className="assistant-in">
          <ReplyCard card={msg.reply.card} toast={toast} />
        </div>
      )}
      {msg.done && isLast && msg.reply.chips?.length ? <Chips items={msg.reply.chips} onPick={onPick} className="assistant-in" /> : null}
    </div>
  );
}

function Chips({ items, onPick, className }: { items: string[]; onPick: (q: string) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className="h-[34px] rounded-full px-3.5 text-sm text-text-2 shadow-[inset_0_0_0_.5px_var(--line)] transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-text active:scale-[.97]"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
