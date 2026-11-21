import type { PersonHit } from "@/server/data/types";

/** Ответ ИИ-помощника. Модели нет: намерение распознаётся на сервере, данные — из того же слоя, что и экраны. */

export type OrbState = "searching" | "solving" | "composing" | "connecting" | "working";

/** Шаг «размышления»: состояние сферы и подпись рядом с ней. */
export interface ThinkStep {
  state: OrbState;
  label: string;
}

export interface AssistantLesson {
  title: string;
  start: string;
  end: string;
  place: string;
  teacher: string;
  /** «Сейчас», «Дальше», «Завтра» */
  when: string;
  live: boolean;
}

export interface AssistantConsultation {
  id: string;
  /** «Завтра», «Пн, 23 ноября» */
  day: string;
  start: string;
  end: string;
  teacher: string;
  teacherInitials: string;
  teacherGradient: string;
  courseTitle: string;
  color: string;
  place: string;
  online: boolean;
  count: number;
  capacity: number;
}

export type AssistantCard =
  | { kind: "lessons"; items: AssistantLesson[] }
  | { kind: "grades"; average: string; rank: number | null; size: number | null; rows: { id: string; title: string; color: string; value: string; fill: number }[] }
  | { kind: "tasks"; items: { id: string; title: string; course: string; color: string; due: string; hot: boolean; note: string }[] }
  | { kind: "request"; typeId: string; title: string; eta: string; params: { purpose: string; lang: string; format: string; copies: number } }
  | { kind: "consultations"; items: AssistantConsultation[] }
  | { kind: "people"; items: PersonHit[] };

export interface AssistantReply {
  steps: ThinkStep[];
  text: string;
  card?: AssistantCard;
  /** Подсказки следующего вопроса */
  chips?: string[];
}
