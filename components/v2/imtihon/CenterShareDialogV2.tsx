"use client";

import { ExternalLink, Link2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useCenterShare } from "@/components/imtihon/sarhisobCore";
import type { CenterShareField } from "@/lib/centerShare";

// YANGI VERSIYA: «REYTINGNI ULASHISH» OYNASI (01.11.2026, foydalanuvchi: «kerakmas bo'limni
// galochka orqali yoqish va o'chirish imkoni ham kerak, ulashilganda galochka qo'yilgan qismlar
// chiqishi kerak holos. Masalan yo'nalish kerak lekin guruh nomi shartmas, ustoz shartmas»).
// Sarhisob → «Markaz reytingi» → «Ulashish». Belgilanganlar havola kalitiga imzo bilan kiradi
// (sarhisobCore.useCenterShare, lib/centerShare.ts) — ochiq sahifada faqat shular chiqadi.
// Eski versiyada xuddi shu oyna — components/imtihon/CenterShareDialog.tsx.

interface Item {
  f: CenterShareField;
  label: string;
  hint?: string;
}

export default function CenterShareDialogV2({ month, monthLabel, course, onClose }: { month: string; monthLabel: string; course: string; onClose: () => void }) {
  const { t } = useT();
  const s = useCenterShare(month, course);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: t("Bo'limlar"),
      items: [
        { f: "kpis", label: t("Ko'rsatkichlar"), hint: t("Qatnashgan o'quvchi, guruhlar, o'rtacha natija, 80% va yuqori") },
        { f: "podium", label: t("Eng yaxshi uchlik"), hint: t("1–3-o'rinlar kartochkasi") },
        { f: "table", label: t("Barcha natijalar jadvali"), hint: t("Har bir o'quvchining o'rni va natijasi") },
      ],
    },
    {
      title: t("Ma'lumotlar"),
      items: [
        { f: "course", label: t("Yo'nalish (fan)") },
        { f: "group", label: t("Guruh") },
        { f: "level", label: t("Bosqich") },
        { f: "teacher", label: t("Ustoz") },
        { f: "correct", label: t("To'g'ri javoblar soni") },
      ],
    },
  ];

  return (
    <V2Dialog
      title={t("Reytingni ulashish")}
      subtitle={`${monthLabel} · ${course || t("Barcha fanlar")}`}
      onClose={onClose}
      width={540}
      // Enter bu oynada hech narsa saqlamaydi — «Enter saqlash» izohi chiqmasin.
      footerStart={<span />}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void s.copy().then((ok) => ok && api.close())}
            disabled={!s.link}
            className={`${primaryBtn} h-10 justify-center disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Havolani nusxalash")}
          </button>
        </>
      )}
    >
      <p className="text-v2-small text-v2-text-2">
        {t("Ochiq sahifada faqat belgilangan qismlar chiqadi.")} {t("O'rin, ism va natija doim ko'rinadi, telefon — hech qachon.")}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.title} className="min-w-0">
            <legend className="mb-1 px-2 text-v2-caption font-medium uppercase tracking-wide text-v2-text-3">{g.title}</legend>
            {g.items.map((i) => (
              <label key={i.f} className="flex cursor-pointer items-start gap-2.5 rounded-v2-md px-2 py-1.5 transition-colors hover:bg-v2-hover">
                <V2Checkbox checked={s.show[i.f]} onChange={(on) => s.toggle(i.f, on)} label={i.label} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-v2-body text-v2-text">{i.label}</span>
                  {i.hint && <span className="block text-v2-caption text-v2-text-2">{i.hint}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      {!s.valid && (
        <p role="alert" className="mt-3 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-warning">
          {t("Uchlik yoki jadvaldan kamida bittasini belgilang.")}
        </p>
      )}
      {s.valid && !s.show.course && !course && (
        <p className="mt-3 rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">
          {t("Yo'nalish yashirilsa, barcha fanlar bitta ro'yxatda chiqadi. Bitta fan kerak bo'lsa — avval «Fan» filtrida tanlang.")}
        </p>
      )}

      {s.valid && (
        <div className="mt-4">
          <div className="mb-1.5 text-v2-small font-medium text-v2-text-2">{t("Havola")}</div>
          <div className="flex items-start gap-2">
            <div
              className={`min-h-9 min-w-0 flex-1 select-all break-all rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-small ${s.failed ? "text-v2-warning" : "text-v2-text-2"}`}
              aria-live="polite"
            >
              {s.link || (s.failed ? t("Havolani olib bo'lmadi — sahifani yangilang") : t("Yuklanmoqda…"))}
            </div>
            {s.link && (
              <a href={s.link} target="_blank" rel="noopener noreferrer" className={`${secondaryBtn} shrink-0`} title={t("Ochib ko'rish")}>
                <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
                <span className="max-sm:sr-only">{t("Ochib ko'rish")}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </V2Dialog>
  );
}
