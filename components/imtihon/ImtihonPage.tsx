"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStudents } from "@/hooks/useStudents";
import SarhisobView from "./SarhisobView";
import UzbmbView from "./UzbmbView";
import { useT } from "@/components/shared/Language";

// Imtihon bo'limi — referens sarhisob.html: sarlavha (yo'l + nom), ikki
// tab (Sarhisob | UzBMB) va tab mazmuni.
//
//   Sarhisob — guruh bo'yicha kiritilgan imtihon natijalari (SarhisobView:
//              filtr, KPI, jadval, tafsilot va kiritish panellari).
//   UzBMB    — o'zgarishsiz (UzbmbView: 1-blok 93, 2-blok 63, majburiy 33,
//              jami 189 ball).
//
// 21.09.2026 gacha birinchi tab "Oylik imtihon" — o'quvchi-o'quvchi
// `monthly_exams` jadvali (Excel/CSV import, solishtirish modali) edi;
// referens bo'yicha u Sarhisobga almashdi (menyu, tab, sarlavha, tugma va
// eksport nomi). `monthly_exams` ning o'zi qoladi — o'quvchilar boti
// o'qiydi, kiritish paneli unga ko'chirishda davom etadi.

type Tab = "sarhisob" | "uzbmb";

export default function ImtihonPage() {
  const { t } = useT();

  // Tab holati manzilda: /imtihon (Sarhisob) va /imtihon?tab=uzbmb. Shunda
  // sidebar'dagi "Sarhisob" / "UzBMB" havolalari to'g'ridan-to'g'ri kerakli
  // tabni ochadi.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "uzbmb" ? "uzbmb" : "sarhisob";
  const setTab = useCallback(
    (next: Tab) => {
      router.replace(next === "uzbmb" ? `${pathname}?tab=uzbmb` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // O'quvchilar ro'yxati UzBMB tabiga uzatiladi (u yerdagi ism tanlovi).
  const { names: pupilNames } = useStudents({ light: true });

  const title = tab === "uzbmb" ? "UzBMB" : t("Sarhisob");
  const tabCls = (on: boolean) =>
    `h-8 px-4 rounded-full border text-sm font-medium transition-colors ${
      on ? "bg-primary border-primary text-white" : "border-border bg-card text-muted-foreground hover:bg-secondary"
    }`;

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div>
        <div className="text-[12px] text-muted-foreground">
          {t("Imtihon")} / {title}
        </div>
        <h1 className="text-xl font-semibold tracking-tight mt-0.5">{title}</h1>
        <div className="flex items-center gap-1.5 mt-3">
          <button onClick={() => setTab("sarhisob")} className={tabCls(tab === "sarhisob")}>
            {t("Sarhisob")}
          </button>
          <button onClick={() => setTab("uzbmb")} className={tabCls(tab === "uzbmb")}>
            UzBMB
          </button>
        </div>
      </div>

      {/* Ikkala tab ham DOM'da qoladi (`hidden` bilan almashadi) — filtr
          holati tab almashganda yo'qolmaydi. */}
      <div className={tab === "sarhisob" ? "" : "hidden"}>
        <SarhisobView />
      </div>
      <div className={tab === "uzbmb" ? "" : "hidden"}>
        <UzbmbView pupilNames={pupilNames} />
      </div>
    </div>
  );
}
