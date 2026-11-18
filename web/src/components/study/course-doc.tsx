import { creditsLabel } from "@/lib/phrases";
import type { CoursePageData } from "@/server/data/types";

export type DocKind = "program" | "assessment";

function H({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="mt-7 mb-2 text-[15px] font-semibold text-[#111]">
      {n}. {children}
    </h3>
  );
}

function Meta({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="mt-6 grid grid-cols-[170px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13.5px] max-sm:grid-cols-1 max-sm:gap-y-0">
      {rows.map(([k, v]) => (
        <div key={k} className="contents max-sm:block max-sm:pb-2">
          <dt className="text-[#777]">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const List = ({ items, ordered }: { items: string[]; ordered?: boolean }) => {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "list-decimal space-y-1 pl-5 marker:text-[#888]" : "list-disc space-y-1 pl-5 marker:text-[#aaa]"}>
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </Tag>
  );
};

function Formula({ d }: { d: CoursePageData }) {
  return (
    <table className="w-full text-[13.5px]">
      <tbody>
        {d.components.map((c) => (
          <tr key={c.id} className="border-b-[.5px] border-[#ddd]">
            <td className="py-1.5 pr-3">
              {c.title}
              {c.aggregate && <span className="text-[#777]"> — среднее по всем работам, несданная работа — 0</span>}
            </td>
            <td className="py-1.5 text-right tabular-nums">{c.weight}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Документы курса листом бумаги (как справки в «Офисе»): программа дисциплины и оценочные материалы.
 * Текст — из Course.syllabus и формулы курса; всё вымышленное.
 */
export function CourseDoc({ kind, d }: { kind: DocKind; d: CoursePageData }) {
  const s = d.syllabus!;
  const hours = s.hours.lectures + s.hours.seminars + s.hours.self;
  const staff = d.staff.map((x) => `${x.name} (${x.role.toLowerCase()})`).join(", ");
  return (
    <article
      data-course-doc={kind}
      className="rounded-[10px] bg-[#FBFBF9] px-10 py-9 text-[14px] leading-relaxed text-[#1b1b1d] shadow-[0_20px_50px_-20px_rgba(0,0,0,.6)] max-sm:px-5 max-sm:py-6"
    >
      <header className="border-b-[.5px] border-[#ddd] pb-4 text-[12.5px] text-[#666]">
        <b className="block font-semibold text-[#1b1b1d]">Университет Будущего</b>
        {d.docMeta.faculty}
      </header>

      <h2 className="mt-6 text-center text-[13px] tracking-[.12em] text-[#555] uppercase">
        {kind === "program" ? "Рабочая программа дисциплины" : "Оценочные материалы по дисциплине"}
      </h2>
      <div className="mt-1 text-center text-[20px] font-semibold tracking-[-.01em]">«{d.title}»</div>

      <Meta
        rows={[
          ["Код дисциплины", s.code],
          ["Направление", d.docMeta.program],
          ["Семестр", d.docMeta.semester],
          ["Трудоёмкость", `${creditsLabel(d.credits)}, ${hours} ч: лекции ${s.hours.lectures}, семинары и практика ${s.hours.seminars}, самостоятельная работа ${s.hours.self}`],
          ["Форма контроля", d.docMeta.exam],
          ...(staff ? [["Преподаватели", staff] as [string, string]] : []),
        ]}
      />

      {kind === "program" ? (
        <>
          <H n={1}>Аннотация</H>
          <p>{s.annotation}</p>
          <H n={2}>Результаты обучения</H>
          <List items={s.outcomes} />
          <H n={3}>Содержание дисциплины</H>
          <ol className="space-y-1">
            {s.topics.map((t, i) => (
              <li key={t} className="grid grid-cols-[64px_minmax(0,1fr)]">
                <span className="text-[#777]">Тема {i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <H n={4}>Формула оценки</H>
          <Formula d={d} />
          <H n={5}>Литература</H>
          <p className="mb-1 text-[13px] text-[#777]">Основная</p>
          <List items={s.literature.main} />
          {s.literature.extra.length > 0 && (
            <>
              <p className="mt-3 mb-1 text-[13px] text-[#777]">Дополнительная</p>
              <List items={s.literature.extra} />
            </>
          )}
        </>
      ) : (
        <>
          <H n={1}>Формула оценки</H>
          <Formula d={d} />
          <H n={2}>Округление</H>
          <p>Итоговая оценка — сумма баллов по элементам с их весами, округляется по правилам арифметики: 7,49 → 7, 7,5 → 8. Оценка 4 и выше — {d.assessment === "exam" ? "положительная" : "зачёт"}.</p>
          <H n={3}>Автомат</H>
          <p>{d.autoPass?.rule || "Автомат по дисциплине не предусмотрен."}</p>
          <H n={4}>Пересдача</H>
          <p>При неудовлетворительной оценке накопленные баллы сохраняются, пересдаётся только {d.assessment === "exam" ? "экзамен" : "итоговое собеседование"} в дополнительную сессию. Заявление — в «Офисе».</p>
          <H n={5}>{d.assessment === "exam" ? "Вопросы к экзамену" : "Вопросы к зачёту"}</H>
          <List items={s.questions} ordered />
        </>
      )}

      <footer className="mt-8 border-t-[.5px] border-[#ddd] pt-3 text-[12.5px] text-[#777]">{s.approved}</footer>
    </article>
  );
}
