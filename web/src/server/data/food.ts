import "server-only";
import { BELLS, PAIRS } from "@/lib/bells";
import { CAFE_SLUGS } from "@/lib/coffee";
import { DEMO_MINUTES, formatShortWeekday, mskDate, mskTime, toMinutes } from "@/lib/demo-clock";
import { requireUser } from "@/server/auth/session";
import { currentWeek } from "@/server/coffee/match";
import { db } from "@/server/db/client";
import type { MenuSection, VenueView } from "./food-types";

/**
 * Еда на кампусе: столовая, кофейни, кафе. Меню общее для всех и не персональное — каталог в коде,
 * как сетка звонков. Загруженность считается от расписания: наплыв — на переменах, особенно на большой (12:30–13:00).
 */

interface Peak {
  at: string;
  width: number;
  height: number;
}
interface Venue {
  slug: string;
  name: string;
  kind: string;
  building: string;
  floor: string;
  open: string;
  close: string;
  color: string;
  perk?: string;
  base: number;
  peaks: Peak[];
  /** прибавка на перемене (на всю длину получаса) */
  breakBoost: number;
  menu: MenuSection[];
}

const VENUES: Venue[] = [
  {
    slug: "peremena",
    name: "«Большая перемена»",
    kind: "Столовая",
    building: "Корпус А",
    floor: "1 этаж",
    open: "08:30",
    close: "18:00",
    color: "econ",
    base: 8,
    peaks: [{ at: "13:00", width: 70, height: 55 }, { at: "09:00", width: 40, height: 15 }],
    breakBoost: 35,
    menu: [
      {
        title: "Обед дня",
        items: [
          { name: "Комплексный обед", note: "Борщ, котлета по-киевски с пюре, винегрет, морс", price: 320 },
          { name: "Вегетарианский обед", note: "Суп-пюре из тыквы, сырники со сметаной, винегрет, компот", price: 290, tags: ["veg"] },
        ],
      },
      {
        title: "Первое",
        items: [
          { name: "Борщ со сметаной", size: "250 г", price: 120 },
          { name: "Суп-пюре из тыквы", size: "250 г", price: 110, tags: ["veg", "season"] },
          { name: "Куриный суп с лапшой", size: "250 г", price: 105 },
        ],
      },
      {
        title: "Второе",
        items: [
          { name: "Котлета по-киевски", size: "120 г", price: 165 },
          { name: "Гуляш из говядины", size: "150 г", price: 190 },
          { name: "Минтай, запечённый с сыром", size: "120 г", price: 155 },
          { name: "Сырники со сметаной", size: "150 г", price: 135, tags: ["veg"] },
        ],
      },
      {
        title: "Гарниры",
        items: [
          { name: "Картофельное пюре", size: "150 г", price: 60, tags: ["veg"] },
          { name: "Гречка с маслом", size: "150 г", price: 55, tags: ["veg"] },
          { name: "Рис с овощами", size: "150 г", price: 65, tags: ["veg"] },
          { name: "Овощи гриль", size: "120 г", price: 95, tags: ["veg"] },
        ],
      },
      {
        title: "Салаты",
        items: [
          { name: "Винегрет", size: "120 г", price: 75, tags: ["veg"] },
          { name: "Оливье", size: "120 г", price: 85 },
          { name: "Цезарь с курицей", size: "160 г", price: 170 },
        ],
      },
      {
        title: "Выпечка и напитки",
        items: [
          { name: "Пирожок с капустой", size: "90 г", price: 55, tags: ["veg"] },
          { name: "Морс клюквенный", size: "0,3 л", price: 60, tags: ["veg"] },
          { name: "Компот из сухофруктов", size: "0,3 л", price: 45, tags: ["veg"] },
          { name: "Чай чёрный", size: "0,3 л", price: 30, tags: ["veg"] },
        ],
      },
    ],
  },
  {
    slug: "zerno",
    name: "«Зерно»",
    kind: "Кофейня",
    building: "Корпус А",
    floor: "2 этаж",
    open: "08:00",
    close: "20:00",
    color: "hist",
    perk: "Скидка 10% по Орбита ID",
    base: 42,
    peaks: [{ at: "09:00", width: 50, height: 45 }, { at: "15:30", width: 90, height: 20 }],
    breakBoost: 40,
    menu: [
      {
        title: "Кофе",
        items: [
          { name: "Эспрессо", size: "30 мл", price: 120 },
          { name: "Американо", size: "0,3 л", price: 150 },
          { name: "Капучино", size: "0,3 л", price: 190 },
          { name: "Флэт уайт", size: "0,2 л", price: 210 },
          { name: "Раф ванильный", size: "0,3 л", price: 240 },
          { name: "Латте «Пряная тыква»", size: "0,3 л", price: 260, tags: ["season"] },
        ],
      },
      {
        title: "Не кофе",
        items: [
          { name: "Матча-латте", size: "0,3 л", price: 250, tags: ["veg"] },
          { name: "Какао с маршмеллоу", size: "0,3 л", price: 180 },
          { name: "Чай листовой", size: "0,4 л", price: 140, tags: ["veg"] },
          { name: "Облепиховый чай", size: "0,4 л", price: 190, tags: ["veg", "season"] },
        ],
      },
      {
        title: "Еда",
        items: [
          { name: "Круассан с ветчиной и сыром", price: 220 },
          { name: "Сэндвич с индейкой", price: 260 },
          { name: "Сэндвич с хумусом и овощами", price: 230, tags: ["veg", "new"] },
          { name: "Чизкейк «Нью-Йорк»", size: "120 г", price: 230 },
          { name: "Печенье овсяное", price: 90, tags: ["veg"] },
        ],
      },
    ],
  },
  {
    slug: "atrium",
    name: "«Атриум»",
    kind: "Кафе",
    building: "Корпус Б",
    floor: "1 этаж",
    open: "09:00",
    close: "19:00",
    color: "world",
    base: 10,
    peaks: [{ at: "13:15", width: 75, height: 50 }, { at: "17:00", width: 60, height: 18 }],
    breakBoost: 25,
    menu: [
      {
        title: "Боулы",
        items: [
          { name: "Боул с лососем", note: "Рис, лосось, авокадо, эдамаме, кунжутный соус", price: 390 },
          { name: "Боул с курицей терияки", note: "Рис, курица, огурец, морковь, терияки", price: 340 },
          { name: "Боул с фалафелем", note: "Булгур, фалафель, хумус, овощи", price: 310, tags: ["veg"] },
        ],
      },
      {
        title: "Паста",
        items: [
          { name: "Карбонара", size: "280 г", price: 330 },
          { name: "Паста с томатами и базиликом", size: "280 г", price: 280, tags: ["veg"] },
          { name: "Паста с грибами в сливках", size: "280 г", price: 310, tags: ["veg", "new"] },
        ],
      },
      {
        title: "Супы",
        items: [
          { name: "Том ям с креветками", size: "300 г", price: 360, tags: ["spicy"] },
          { name: "Крем-суп из шампиньонов", size: "250 г", price: 220, tags: ["veg"] },
        ],
      },
      {
        title: "Завтраки весь день",
        items: [
          { name: "Шакшука", size: "250 г", price: 290, tags: ["veg"] },
          { name: "Гранола с йогуртом и ягодами", size: "200 г", price: 210, tags: ["veg"] },
          { name: "Омлет с сыром и зеленью", size: "200 г", price: 230, tags: ["veg"] },
        ],
      },
    ],
  },
  {
    slug: "terrace",
    name: "Терраса",
    kind: "Кафе",
    building: "Библиотека",
    floor: "3 этаж",
    open: "10:00",
    close: "21:00",
    color: "micro",
    base: 12,
    peaks: [{ at: "17:30", width: 110, height: 40 }],
    breakBoost: 12,
    menu: [
      {
        title: "Напитки",
        items: [
          { name: "Капучино", size: "0,3 л", price: 170 },
          { name: "Чай в чайнике", size: "0,6 л", price: 220, tags: ["veg"] },
          { name: "Глинтвейн безалкогольный", size: "0,3 л", price: 190, tags: ["veg", "season"] },
          { name: "Лимонад «Имбирь и лайм»", size: "0,4 л", price: 200, tags: ["veg"] },
        ],
      },
      {
        title: "Перекус",
        items: [
          { name: "Тыквенный пирог", size: "130 г", price: 210, tags: ["veg", "season"] },
          { name: "Брауни", size: "80 г", price: 160, tags: ["veg"] },
          { name: "Сэндвич с моцареллой и песто", price: 240, tags: ["veg"] },
          { name: "Фруктовая тарелка", size: "200 г", price: 180, tags: ["veg"] },
        ],
      },
    ],
  },
  {
    slug: "fresh",
    name: "Фреш-бар",
    kind: "Бар у спорткомплекса",
    building: "Корпус В",
    floor: "1 этаж",
    open: "08:00",
    close: "21:00",
    color: "py",
    base: 6,
    peaks: [{ at: "08:30", width: 40, height: 25 }, { at: "18:30", width: 70, height: 45 }],
    breakBoost: 15,
    menu: [
      {
        title: "Смузи и фреши",
        items: [
          { name: "Смузи «Банан и шпинат»", size: "0,4 л", price: 230, tags: ["veg"] },
          { name: "Смузи ягодный", size: "0,4 л", price: 250, tags: ["veg"] },
          { name: "Апельсиновый фреш", size: "0,3 л", price: 220, tags: ["veg"] },
          { name: "Протеиновый коктейль", size: "0,4 л", price: 280 },
        ],
      },
      {
        title: "Перекус",
        items: [
          { name: "Овсянка с ягодами", size: "250 г", price: 190, tags: ["veg"] },
          { name: "Ролл с курицей", size: "200 г", price: 250 },
          { name: "Протеиновый батончик", price: 120, tags: ["new"] },
        ],
      },
    ],
  },
];

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Перемены между парами: [конец пары, начало следующей] в минутах. */
const BREAKS = PAIRS.slice(0, -1).map((p) => [toMinutes(BELLS[p][1]), toMinutes(BELLS[p + 1][0])] as const);
const overlap = (a: number, b: number, c: number, d: number) => Math.max(0, Math.min(b, d) - Math.max(a, c));

function loadOf(v: Venue) {
  const out: { at: string; value: number }[] = [];
  for (let m = toMinutes(v.open); m < toMinutes(v.close); m += 30) {
    const mid = m + 15;
    const peaks = v.peaks.reduce((s, p) => s + p.height * Math.exp(-(((mid - toMinutes(p.at)) / p.width) ** 2)), 0);
    const brk = BREAKS.reduce((s, [a, b]) => s + overlap(m, m + 30, a, b), 0) / 30;
    out.push({ at: hhmm(m), value: Math.min(100, Math.round(v.base + peaks + v.breakBoost * brk)) });
  }
  return out;
}

const crowdOf = (n: number) => (n < 35 ? "low" : n < 65 ? "mid" : "high");

function highlightOf(v: Venue): VenueView["highlight"] {
  const set = v.menu.find((s) => s.title === "Обед дня")?.items[0];
  if (set) return { label: "Обед дня", dish: set };
  const all = v.menu.flatMap((s) => s.items);
  const season = all.find((d) => d.tags?.includes("season"));
  if (season) return { label: "Сезонное", dish: season };
  const fresh = all.find((d) => d.tags?.includes("new"));
  return fresh ? { label: "Новинка", dish: fresh } : null;
}

/** Встреча Random Coffee этой недели (не онлайн, не отменена) — чтобы отметить её кафе. */
async function myCoffee(userId: string) {
  const m = await db.coffeeMember.findFirst({
    where: { userId, match: { week: currentWeek(), status: "active", online: false } },
    select: { match: { select: { place: true, startsAt: true, members: { where: { userId: { not: userId } }, select: { user: { select: { firstName: true } } } } } } },
  });
  const slug = m && CAFE_SLUGS[m.match.place];
  if (!m || !slug) return null;
  return { slug, day: formatShortWeekday(mskDate(m.match.startsAt)), time: mskTime(m.match.startsAt), partner: m.match.members[0]?.user.firstName ?? "" };
}

/** Все заведения кампуса с часами, загруженностью на сейчас и меню. Доступно любому вошедшему. */
export async function getFood(): Promise<VenueView[]> {
  const user = await requireUser();
  const coffee = user.role === "student" ? await myCoffee(user.id) : null;
  return VENUES.map((v) => {
    const load = loadOf(v);
    const isOpen = toMinutes(v.open) <= DEMO_MINUTES && DEMO_MINUTES < toMinutes(v.close);
    const nowIndex = isOpen ? Math.floor((DEMO_MINUTES - toMinutes(v.open)) / 30) : -1;
    const rush = nowIndex >= 0 ? load.slice(nowIndex + 1).find((l) => l.value >= 65) : undefined;
    return {
      slug: v.slug,
      name: v.name,
      kind: v.kind,
      building: v.building,
      floor: v.floor,
      open: v.open,
      close: v.close,
      color: v.color,
      perk: v.perk,
      menu: v.menu,
      isOpen,
      load,
      nowIndex,
      crowd: nowIndex >= 0 ? crowdOf(load[nowIndex].value) : null,
      rushAt: rush?.at ?? null,
      highlight: highlightOf(v),
      coffee: coffee?.slug === v.slug ? { day: coffee.day, time: coffee.time, partner: coffee.partner } : null,
    };
  });
}
