"use client";

import { Wrench, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { hideDevNoticeForToday, switchUiVersion } from "@/lib/uiVersion";

// O'TISH DAVRI BELGILARI (17.10.2026). Foydalanuvchi: «yangi versiyaga
// o'tganda qayerdadir "yangi versiya hozir texnik ish davom etmoqda" yoki
// shunga o'xshash professional so'z turishi kerak, xodimlarga bilintirish
// uchun».
//
//   DevNoticeBanner — yuqori panel ostidagi ingichka qator: nima bo'layotgani,
//     ma'lumot ikkala versiyada bir xilligi (xodim xavotir olmasin) va «Eski
//     versiyaga qaytish». × — kun oxirigacha yopiladi (cookie — server ham
//     biladi, qator keyingi yuklanishda miltillamaydi); ertasi kuni yana chiqadi.
//   BetaBadge — logotip yonida DOIM: qator yopilgan bo'lsa ham versiya holati
//     ko'rinib turadi.
//
// Rang — «Ma'lumot» (info): ogohlantirish emas, xabar (design/v2/DESIGN.md →
// «Holat belgilari»). Yangi versiya to'liq ishga tushganda ikkalasi olib
// tashlanadi (design/v2/SAVOLLAR.md, 28).

export function DevNoticeBanner({ onHide }: { onHide: () => void }) {
  const { t } = useT();
  const hide = () => {
    hideDevNoticeForToday();
    onHide();
  };

  return (
    <div
      data-ui="v2"
      role="status"
      // `non-fullscreen` — dars jadvalining to'liq ekran rejimida yuqori panel bilan birga yashirinadi.
      className="non-fullscreen flex shrink-0 items-center gap-3 border-b border-v2-border bg-v2-info-bg px-3 py-1.5 font-v2 text-v2-text sm:px-4 lg:px-6"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface text-v2-info" aria-hidden>
        <Wrench className="size-4" strokeWidth={1.75} />
      </span>
      <p className="min-w-0 flex-1 text-v2-small text-v2-text-2">
        <span className="font-semibold text-v2-text">{t("Yangi versiya ishlab chiqilmoqda")}.</span>{" "}
        {/* Qator doim BIR qatorli: izoh ~690 px — yon menyu ochiq turganda 1280 px dan
            kengda sig'adi (o'lchangan), torroq ekranda faqat sarlavha. */}
        <span className="hidden xl:inline">{t("Bo'limlar bosqichma-bosqich yangilanmoqda, ma'lumotlar ikkala versiyada bir xil.")}</span>
      </p>
      {/* Telefonda joy tor — qaytish profil menyusida va chekma menyu pastida bor. */}
      <button
        type="button"
        onClick={() => switchUiVersion("v1")}
        className="hidden h-8 shrink-0 items-center rounded-v2-md px-2.5 text-v2-small font-medium text-v2-info transition-colors hover:bg-v2-surface sm:inline-flex"
      >
        {t("Eski versiyaga qaytish")}
      </button>
      <button
        type="button"
        onClick={hide}
        title={t("Bugun boshqa ko'rsatilmasin")}
        aria-label={t("Bugun boshqa ko'rsatilmasin")}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 transition-colors hover:bg-v2-surface hover:text-v2-text"
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function BetaBadge() {
  const { t } = useT();
  return (
    <span
      title={t("Yangi versiya ishlab chiqilmoqda")}
      className="shrink-0 rounded-v2-full bg-v2-info-bg px-1.5 py-0.5 text-[11px] font-semibold leading-none text-v2-info"
    >
      {t("Beta")}
    </span>
  );
}
