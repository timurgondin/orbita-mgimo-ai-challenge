import type { Metadata } from "next";
import { IdCard } from "lucide-react";
import { ProfileSections } from "@/components/profile/profile-sections";
import { StudentCardButton } from "@/components/profile/student-card";
import { DotField } from "@/components/today/dot-field";
import { avatarGradient, fullName, initials, subtitle } from "@/lib/user-view";
import { requireUser } from "@/server/auth/session";
import { getProfile, getStudentCard } from "@/server/data/profile";

export const metadata: Metadata = { title: "Профиль — Орбита" };

// Цвет точек баннера — по факультету (цвета из палитры курсов и статусов)
const FACULTY_DOTS: [RegExp, string][] = [
  [/бизнес/i, "242,163,94"],
  [/отношен/i, "229,128,145"],
  [/эконом/i, "143,141,247"],
];
const BANNER_MASK = "radial-gradient(90% 160% at 100% 0%, #000 10%, transparent 80%)";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, card] = await Promise.all([getProfile(), getStudentCard()]);
  const dots = FACULTY_DOTS.find(([re]) => re.test(user.faculty ?? ""))?.[1] ?? "139,142,255";

  return (
    <>
      <div className="relative h-[168px] overflow-hidden rounded-[26px] bg-s1 max-sm:h-[120px] max-sm:rounded-[22px]">
        <DotField rgb={dots} peak={0.7} mask={BANNER_MASK} />
      </div>

      <div className="relative -mt-14 flex items-end justify-between gap-5 pr-1 pl-7 max-sm:-mt-11 max-sm:pr-0 max-sm:pl-[18px]">
        <span
          aria-hidden="true"
          style={{ background: avatarGradient(user) }}
          className={`grid size-28 shrink-0 place-items-center rounded-[34px] text-4xl font-semibold tracking-[-.02em] shadow-[0_0_0_5px_var(--bg)] max-sm:size-[88px] max-sm:rounded-[28px] max-sm:text-[28px] max-sm:shadow-[0_0_0_4px_var(--bg)] ${user.avatar === "stone" ? "text-text-2" : "text-[#2a211a]"}`}
        >
          {initials(user)}
        </span>
        {card && (
          <StudentCardButton
            card={card}
            className="mb-1 inline-flex h-10 items-center gap-2 rounded-xl bg-text px-4 text-sm font-semibold text-bg transition-[opacity,transform] duration-150 ease-soft hover:opacity-90 active:scale-[.97]"
          >
            <IdCard size={16} strokeWidth={1.9} />
            Студенческий
          </StudentCardButton>
        )}
      </div>

      <div className="px-7 pt-[18px] max-sm:px-0.5">
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">{fullName(user)}</h1>
        <div className="mt-1 text-[15px] text-text-2">{subtitle(user)}</div>
      </div>

      <ProfileSections p={profile} />
    </>
  );
}
