import Link from "@/components/ui/Link";
import { BILLING_TEXTS } from "@/constants/settingsBilling";

// Gamifikatsiya tablari uchun — "hali qurilmagan" o'rniga HAQIQIY sabab.
//
// Gamifikatsiya alohida pullik modul va referens akkauntda sotib olinmagan:
// jonli saytda /settings/gamification butunlay bo'sh render bo'ladi (chap
// panel ham yo'q), Obuna sahifasidagi "Gamifikatsiya to'lovi" tabi esa shu
// sababdan "Gamifikatsiya moduli yoqilmagan" deb turibdi.
//
// Ya'ni bu yerda ko'chiriladigan maydon YO'Q — umumiy "maydonlari referens
// saytdan ko'chirilishi kerak" yozuvi noto'g'ri bo'lardi. Modul yoqilgach
// yoki maydonlar rasmi bo'lgach, tab qurilishi mumkin.

export default function ModuleNotEnabledTab({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-10 text-center">
      <div className="text-[15px] font-semibold">{title}</div>
      <p className="text-[13px] text-muted-foreground mt-2 max-w-md mx-auto">
        {BILLING_TEXTS.gamificationEmpty}{" "}— gamifikatsiya alohida pullik modul.
        Referens akkauntda ham yoqilmagani uchun bu tabda ko&apos;chiriladigan
        maydon yo&apos;q.
      </p>
      <Link
        href="/settings-general?tab=billing"
        className="mt-4 inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary"
      >
        Obuna sahifasiga o&apos;tish
      </Link>
    </div>
  );
}
