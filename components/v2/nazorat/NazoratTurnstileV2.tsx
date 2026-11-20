"use client";

import { ArrowRight, Unplug } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { Panel } from "@/components/v2/reports/report35";
import { PageHead, PageShell } from "@/components/v2/students/lists/listKit";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";

// YANGI VERSIYA — NAZORAT → «TURNIKET ANALITIKASI» (/nazorat-turnstile, 28-qism, rasmsiz). Eski sahifa
// (components/nazorat/NazoratTurnstilePage.tsx) o'zgarmagan; versiya app/(app)/nazorat-turnstile/page.tsx da
// serverda tanlanadi.
//
// Ma'lumot manbasi YO'Q: turniket qurilmasi ulanmagan (SAVOLLAR 447 — egasi qarori: xodim botda belgilaydi),
// har bir kirish/chiqish VOQEASI tizimga kelmaydi. Eskisidagidek son o'ylab topilmaydi va ishlamaydigan filtr
// ko'rsatilmaydi: bo'sh holat + sabab, mavjud manbalarga havola («Xodimlar davomati», «Turniket kirish-chiqish
// analitikasi» — kunlik jamlanma) va qurilma ulanganda jadval qaysi ustunlardan iborat bo'lishi.

const PLANNED_COLUMNS = [
  "To'liq ismi",
  "Foydalanuvchi turi",
  "Voqea turi",
  "Vaqti",
  "Rejalashtirilgan boshlanish",
  "Rejalashtirilgan tugash",
  "Kechikish mavjud",
  "Kechikish (daq.)",
  "Erta ketish mavjud",
  "Erta ketish (daq.)",
  "Turniket nomi",
];

export default function NazoratTurnstileV2() {
  const { t } = useT();
  return (
    <PageShell flow>
      <PageHead title={t("Turniket analitikasi")} subtitle={t("Har bir kirish va chiqish urinishi, rejadan kechikish va erta ketish — turniket qurilmasidan")} />

      <section className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-3">
            <Unplug className="size-6" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="text-v2-section text-v2-text">{t("Turniket qurilmasi ulanmagan")}</h2>
          <p className="max-w-xl text-v2-small text-v2-text-2">
            {t(
              "Turniket voqealari (har bir kirish/chiqish urinishi, rejalashtirilgan vaqtdan kechikish va qurilma nomi) tizimga kelmaydi — qurilma bilan integratsiya yo'q. Shuning uchun bu yerda son ham, filtr ham yo'q: filtrlaydigan yozuvning o'zi yo'q.",
            )}
          </p>
          <p className="max-w-xl text-v2-small text-v2-text-2">
            {t("Xodim ishga kelganini xodimlar botida belgilaydi (joylashuv va Face ID) — kunlik jamlanma quyidagi sahifalarda.")}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Link href="/nazorat-turnstile-io" className={primaryBtn}>
              {t("Turniket kirish-chiqish analitikasi")}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
            <Link href="/nazorat-qr" className={secondaryBtn}>
              {t("Xodimlar davomati")}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <Panel title={t("Qurilma ulanganda jadval ustunlari")} sub={t("Har bir voqea alohida qator bo'ladi")}>
        <ol className="flex flex-wrap gap-2 px-4 pb-4">
          {PLANNED_COLUMNS.map((c, i) => (
            <li key={c} className="inline-flex items-center gap-1.5 rounded-v2-full border border-v2-border bg-v2-surface-2 px-2.5 py-1 text-v2-small text-v2-text-2">
              <span className="tabular-nums text-v2-text-3">{i + 1}</span>
              {t(c)}
            </li>
          ))}
        </ol>
      </Panel>
    </PageShell>
  );
}
