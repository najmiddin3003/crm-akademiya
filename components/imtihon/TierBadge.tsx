import { imTier } from "@/lib/imtihon";

// O'zlashtirish foizi yorlig'i — to'rt rangli shkala (lib/imtihon.ts →
// imTier): past (qizil), o'rtacha (sariq), yaxshi (och yashil), zo'r
// (yashil). Guruh imtihoni paneli va Sarhisob sahifasi bir xil yorliqni
// ishlatadi — ikki joyda ikki xil rang chiqmasin.
export default function TierBadge({ pct, className = "" }: { pct: number; className?: string }) {
  const tier = imTier(pct);
  return (
    <span
      title={tier.label}
      className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded-full text-[12px] font-bold tabular-nums ${tier.cls} ${className}`}
    >
      {pct}%
    </span>
  );
}
