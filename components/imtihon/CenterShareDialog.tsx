"use client";

import { ExternalLink, Link2 } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import type { CenterShareField } from "@/lib/centerShare";
import { useCenterShare } from "./sarhisobCore";

// ESKI VERSIYA: «REYTINGNI ULASHISH» OYNASI (01.11.2026, «galochka qo'yilgan qismlar chiqishi kerak
// holos») — Sarhisob → «Markaz reytingi» → «Ulashish». Mantiq yangi versiyadagi bilan bitta
// (sarhisobCore.useCenterShare); ko'rinishi — components/v2/imtihon/CenterShareDialogV2.tsx.

interface Item {
  f: CenterShareField;
  label: string;
  hint?: string;
}

const btn = "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";

export default function CenterShareDialog({ month, monthLabel, course, onClose }: { month: string; monthLabel: string; course: string; onClose: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
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
    <Modal
      onClose={onClose}
      controller={modal}
      title={t("Reytingni ulashish")}
      subtitle={`${monthLabel} · ${course || t("Barcha fanlar")}`}
      size="lg"
      footer={
        <>
          <button type="button" onClick={modal.close} className={`${btn} border border-border bg-card hover:bg-secondary`}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void s.copy().then((ok) => ok && modal.close())}
            disabled={!s.link}
            className={`${btn} bg-primary text-white shadow-sm hover:opacity-90`}
          >
            <Link2 className="w-4 h-4" />
            {t("Havolani nusxalash")}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {t("Ochiq sahifada faqat belgilangan qismlar chiqadi.")} {t("O'rin, ism va natija doim ko'rinadi, telefon — hech qachon.")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.title} className="min-w-0">
            <legend className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</legend>
            {g.items.map((i) => (
              <label key={i.f} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary">
                <input type="checkbox" checked={s.show[i.f]} onChange={(e) => s.toggle(i.f, e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0 rounded accent-primary" />
                <span className="min-w-0">
                  <span className="block text-sm">{i.label}</span>
                  {i.hint && <span className="block text-xs text-muted-foreground">{i.hint}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      {!s.valid && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {t("Uchlik yoki jadvaldan kamida bittasini belgilang.")}
        </p>
      )}
      {s.valid && !s.show.course && !course && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {t("Yo'nalish yashirilsa, barcha fanlar bitta ro'yxatda chiqadi. Bitta fan kerak bo'lsa — avval «Fan» filtrida tanlang.")}
        </p>
      )}

      {s.valid && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("Havola")}</div>
          <div className="flex items-start gap-2">
            <div className={`min-h-9 min-w-0 flex-1 select-all break-all rounded-lg border border-border bg-secondary px-3 py-2 text-sm ${s.failed ? "text-amber-600" : "text-muted-foreground"}`} aria-live="polite">
              {s.link || (s.failed ? t("Havolani olib bo'lmadi — sahifani yangilang") : t("Yuklanmoqda…"))}
            </div>
            {s.link && (
              <a href={s.link} target="_blank" rel="noopener noreferrer" className={`${btn} shrink-0 border border-border bg-card hover:bg-secondary`} title={t("Ochib ko'rish")}>
                <ExternalLink className="w-4 h-4" />
                <span className="max-sm:sr-only">{t("Ochib ko'rish")}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
