import { LaterToday } from "@/components/today/later-today";
import { NewsList } from "@/components/today/news-list";
import { NowCard } from "@/components/today/now-card";
import { QuickTiles } from "@/components/today/quick-tiles";
import { SoonList } from "@/components/today/soon-list";
import {
  DEMO_DATE,
  DEMO_MINUTES,
  formatLongDate,
  greeting,
  toMinutes,
} from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { getStudentCard } from "@/server/data/profile";
import { getNews, getScheduleForToday, getSoon } from "@/server/data/today";

export default async function TodayPage() {
  const user = await requireUser();
  const student = user.role === "student";
  const [schedule, soon, news, card] = student
    ? await Promise.all([getScheduleForToday(), getSoon(), getNews(), getStudentCard()])
    : [null, [], [], null];
  const today = schedule?.today ?? [];
  const tomorrow = schedule?.tomorrow;

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
          {greeting(DEMO_MINUTES)}, {user.firstName}
        </h1>
      </div>

      {!student ? (
        <p className="mt-8 text-[15px] text-text-2">Кабинет сотрудника появится здесь</p>
      ) : (
        <>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-stretch gap-12 min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {current && <NowCard lesson={current} nowMinutes={DEMO_MINUTES} />}
        <LaterToday lessons={later} tomorrow={tomorrow} />
      </div>

      <QuickTiles card={card} />

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SoonList items={soon} />
        <NewsList news={news} />
      </div>
        </>
      )}
    </>
  );
}
