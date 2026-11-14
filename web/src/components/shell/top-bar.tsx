import { useId } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { student } from "@/lib/mock/student";
import { Dock } from "./dock";
import { ProfileMenu } from "./profile-menu";
import { ScrollHeader } from "./scroll-header";

function Logo() {
  const maskId = `gap-${useId().replace(/:/g, "")}`;
  return (
    <Link
      href="/"
      aria-label="Орбита — на главную"
      className="flex w-max items-center gap-[9px] rounded-[10px]"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect width="24" height="24" fill="#fff" />
            <circle cx="18.72" cy="5.28" r="4.2" fill="#000" />
          </mask>
        </defs>
        <circle
          cx="12"
          cy="12"
          r="9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          mask={`url(#${maskId})`}
        />
        <circle cx="18.72" cy="5.28" r="2.3" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-.035em] max-sm:hidden">орбита</span>
    </Link>
  );
}

export function TopBar() {
  return (
    <ScrollHeader>
      <Logo />
      <Dock />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          aria-label={`Уведомления: ${student.unreadNotifications} новых`}
          className="relative grid size-9 place-items-center rounded-full text-text-2 transition-[background,color] duration-150 hover:bg-hover hover:text-text"
        >
          <Bell size={16} strokeWidth={1.6} />
          <span className="absolute top-2 right-[9px] size-[7px] rounded-full bg-accent shadow-[0_0_0_2px_var(--bg)]" />
        </button>
        <ProfileMenu />
      </div>
    </ScrollHeader>
  );
}
