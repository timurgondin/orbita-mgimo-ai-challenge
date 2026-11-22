/** Еда на кампусе: типы для клиента (без server-only). */

export type DishTag = "veg" | "spicy" | "new" | "season";

export interface Dish {
  name: string;
  /** «250 г», «0,3 л» */
  size?: string;
  /** Состав одной строкой: у комплексов — из чего собран */
  note?: string;
  price: number;
  tags?: DishTag[];
  /** на порцию: ккал, белки, жиры, углеводы (г) */
  kbju?: [number, number, number, number];
}

export interface MenuSection {
  title: string;
  items: Dish[];
}

export interface VenueView {
  slug: string;
  name: string;
  /** «Столовая», «Кофейня» */
  kind: string;
  building: string;
  floor: string;
  open: string;
  close: string;
  color: string;
  /** «Скидка 10% по Орбита ID» */
  perk?: string;
  /** открыто ли сейчас (демо-часы) */
  isOpen: boolean;
  /** загруженность по получасам с открытия до закрытия, 0–100 */
  load: { at: string; value: number }[];
  /** индекс получаса «сейчас» в load или -1 */
  nowIndex: number;
  /** «Свободно», «Средне», «Многолюдно» — сейчас */
  crowd: "low" | "mid" | "high" | null;
  /** ближайший наплыв после «сейчас»: «12:30» */
  rushAt: string | null;
  /** блюдо или набор, который показываем на карточке */
  highlight: { label: string; dish: Dish } | null;
  menu: MenuSection[];
  /** встреча Random Coffee этой недели здесь */
  coffee: { day: string; time: string; partner: string } | null;
}
