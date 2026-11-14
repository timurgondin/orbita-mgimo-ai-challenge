import { LaterToday } from "@/components/today/later-today";
import { NewsList } from "@/components/today/news-list";
import { NowCard } from "@/components/today/now-card";
import { QuickTiles } from "@/components/today/quick-tiles";
import { SoonList } from "@/components/today/soon-list";
import {
  DEMO_DATE,
  DEMO_MINUTES,
  addDays,
  formatLongDate,
  greeting,
  toMinutes,
} from "@/lib/demo-clock";
import { schedule } from "@/lib/mock/schedule";
import { student } from "@/lib/mock/student";

export default function TodayPage() {
  const byStart = (a: { start: string }, b: { start: string }) => toMinutes(a.start) - toMinutes(b.start);
  const today = schedule.filter((l) => l.date === DEMO_DATE).sort(byStart);
  const tomorrow = schedule.filter((l) => l.date === addDays(DEMO_DATE, 1)).sort(byStart)[0];

  // Текущая пара; если сейчас перерыв — ближайшая следующая
  const current =
    today.find((l) => toMinutes(l.start) <= DEMO_MINUTES && DEMO_MINUTES < toMinutes(l.end)) ??
    today.find((l) => toMinutes(l.start) > DEMO_MINUTES);
  const later = today.filter((l) => l !== current && toMinutes(l.start) > DEMO_MINUTES);

  return (
    <>
      <div>
        <div className="text-[15px] text-text-2">{formatLongDate(DEMO_DATE)}</div>
        <h1 className="mt-1 text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">
          {greeting(DEMO_MINUTES)}, {student.firstName}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-stretch gap-12 min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {current && <NowCard lesson={current} nowMinutes={DEMO_MINUTES} />}
        <LaterToday lessons={later} tomorrow={tomorrow} />
      </div>

      <QuickTiles />

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SoonList />
        <NewsList />
      </div>
    </>
  );
}
