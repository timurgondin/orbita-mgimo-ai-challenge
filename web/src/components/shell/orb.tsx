import { cn } from "@/lib/utils";

// TODO: пакет `thinking-orbs` даёт монохромную точечную сферу только размеров 20/32/64 —
// не совпадает с утверждённой цветной сферой макета (44 px). Оставляем CSS-сферу.
// Когда ассистент получит состояния (слушает/ищет/пишет), можно рассмотреть thinking-orbs.
export function Orb({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("orb", className)}
      style={{ width: size, height: size, "--orb-blur": `${size * 0.16}px` } as React.CSSProperties}
    >
      <i />
      <i />
      <i />
    </span>
  );
}
