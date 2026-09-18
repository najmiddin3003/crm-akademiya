"use client";

// "use client" — `aria-label` tanlangan tilda (useT). Server komponentlar
// (loading.tsx, hisobot sahifalari) uni avvalgidek chizadi: klient
// komponentni server komponent ichida ishlatish mumkin.
// Aylanadigan yuklanish indikatori — referensdagi kabi doira yoy.
//
// CSS animatsiyasi `globals.css` dagi `.spinner` klassida (Tailwind'ning
// `animate-spin` i bu loyihada eski v3 blobi bilan to'qnashadi, shuning
// uchun o'z klassimiz).

import { useT } from "@/components/shared/Language";

export interface SpinnerProps {
  /** Diametri (px). Standart 28. */
  size?: number;
  className?: string;
}

export default function Spinner({ size = 28, className = "" }: SpinnerProps) {
  const { t } = useT();
  return (
    <span
      className={`spinner ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label={t("Yuklanmoqda")}
    />
  );
}

/** Markazga joylashgan spinner — jadval katagi yoki bo'sh blok uchun. */
export function SpinnerBlock({ size = 28, className = "" }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`.trim()}>
      <Spinner size={size} />
    </div>
  );
}
