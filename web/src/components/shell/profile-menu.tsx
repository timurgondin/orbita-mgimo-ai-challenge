"use client";

import { useRef } from "react";
import Link from "next/link";
import { Info, LogOut, Moon, Settings, Sun, SunMoon, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { logoutAction } from "@/server/auth/actions";
import { avatarGradient, fullName, initials, subtitle, type UserView } from "@/lib/user-view";
import { cn } from "@/lib/utils";

const ITEM =
  "flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm text-text-2 transition-colors hover:bg-hover hover:text-text";

/** Меню профиля — popover="auto": закрытие по Esc и клику мимо, возврат фокуса — у браузера. Позиция — якорь у аватара (.pmenu в globals.css). */
export function ProfileMenu({ user }: { user: UserView }) {
  const menu = useRef<HTMLDivElement>(null);
  const { setTheme, resolvedTheme } = useTheme();
  const hide = () => menu.current?.hidePopover();

  return (
    <>
      <button
        type="button"
        aria-label="Профиль и настройки"
        popoverTarget="profile-menu"
        style={{ background: avatarGradient(user) }}
        className={cn(
          "mono ml-1 grid size-8 place-items-center rounded-full text-xs font-semibold transition-transform [anchor-name:--profile] hover:scale-105",
          user.avatar === "stone" && "text-text-2",
        )}
      >
        {initials(user)}
      </button>

      <div
        ref={menu}
        id="profile-menu"
        popover="auto"
        aria-label="Профиль"
        className="pmenu w-[252px] rounded-2xl bg-s2 p-1.5 shadow-[0_0_0_.5px_var(--line),0_20px_50px_-12px_rgba(0,0,0,.55)]"
      >
        <div className="mb-1.5 border-b border-line px-2.5 pt-2.5 pb-3">
          <b className="block text-sm font-semibold">{fullName(user)}</b>
          <small className="text-xs text-text-3">{subtitle(user)}</small>
        </div>
        <Link href="/profile" className={ITEM} onClick={hide}>
          <UserRound size={16} strokeWidth={1.6} />
          Профиль
        </Link>
        <button type="button" className={ITEM}>
          <Settings size={16} strokeWidth={1.6} />
          Настройки
        </button>
        <button
          type="button"
         
          aria-label="Тема: переключить тёмную и светлую"
          onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
          className={ITEM}
        >
          <SunMoon size={16} strokeWidth={1.6} />
          Тема
          <span className="ml-auto flex rounded-lg bg-s3 p-0.5" aria-hidden="true">
            <i className="grid h-[22px] w-[26px] place-items-center rounded-md dark:bg-bg dark:text-text">
              <Moon size={13} strokeWidth={2} />
            </i>
            <i className="grid h-[22px] w-[26px] place-items-center rounded-md light:bg-bg light:text-text">
              <Sun size={13} strokeWidth={2} />
            </i>
          </span>
        </button>
        <Link href="/about" className={ITEM} onClick={hide}>
          <Info size={16} strokeWidth={1.6} />
          О проекте
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={ITEM}>
            <LogOut size={16} strokeWidth={1.6} />
            Выйти
          </button>
        </form>
      </div>
    </>
  );
}
