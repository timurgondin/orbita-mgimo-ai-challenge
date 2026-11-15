"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="mt-8 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = code.trim().split("/").pop();
        if (t) router.push(`/verify/${encodeURIComponent(t)}`);
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="Код документа"
        placeholder="Код из QR-кода"
        maxLength={200}
        className="h-12 min-w-0 flex-1 rounded-[14px] bg-s1 px-4 text-[15px] text-text outline-none placeholder:text-text-3 focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_60%,transparent)]"
      />
      <button type="submit" className="h-12 rounded-[14px] bg-text px-5 text-[15px] font-semibold text-bg transition-transform duration-150 active:scale-[.97]">
        Проверить
      </button>
    </form>
  );
}
