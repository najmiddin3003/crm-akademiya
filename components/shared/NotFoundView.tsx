"use client";

import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";

// 404 — mavjud bo'lmagan manzil (app/not-found.tsx). Ilgari app/(app)/[view]
// joy egallovchisi har qanday noma'lum manzilga "hali portlanmagan" deb 200
// qaytarardi; 27.09.2026 da u olib tashlandi — endi haqiqiy 404.
// Tizimga kirmagan foydalanuvchi bu yerga yetmaydi: proxy uni login'ga
// yo'naltiradi.
export default function NotFoundView() {
  const { t } = useT();
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="text-5xl font-bold tabular-nums text-primary">404</div>
        <h1 className="mt-3 text-lg font-semibold">{t("Sahifa topilmadi")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {t("Bu manzilda sahifa yo'q yoki u boshqa joyga ko'chirilgan. Havolani tekshiring yoki bosh sahifaga qayting.")}
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
        >
          {t("Bosh sahifaga")}
        </Link>
      </div>
    </div>
  );
}
