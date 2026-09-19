"use client";

import { useState } from "react";
import { useModerators } from "@/hooks/useModerators";
import { useToast } from "@/components/ui/Toast";
import { invalidateStudents } from "@/hooks/useStudents";
import { useT } from "@/components/shared/Language";

// Ported from crm-akademiya/src/app.js renderStudentEditModerator() (~line 34547),
// upgraded to a searchable dropdown (matches the real site's moderator picker)
// instead of the source's plain <select>.

export default function ModeratorTabContent({
  initialModerator,
  pupilId,
}: {
  initialModerator: string;
  pupilId?: number;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { names: moderatorNames } = useModerators();
  // Ro'yxat bazadan kelgani uchun boshlang'ich qiymat sifatida "birinchi
  // moderator" ni qo'yib bo'lmaydi — bo'sh qoldiramiz.
  const [moderator, setModerator] = useState(initialModerator);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ilgari "Saqlash" hech nima qilmasdi — tanlangan moderator faqat
  // oynada qolib ketardi.
  const save = async () => {
    if (!pupilId) return;
    setSaving(true);
    const res = await fetch(`/api/pupils/${pupilId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moderator }),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
    if (!res?.ok) {
      showError(t(res?.error || "Saqlashda xatolik yuz berdi"));
      return;
    }
    showSuccess(t("Moderator saqlandi"));
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="max-w-3xl space-y-4">
        <div>
          <label className="block text-[13px] font-medium mb-1.5">{t("Moderator")}</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-full h-11 px-3 pr-16 rounded-lg border border-border bg-secondary/30 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {moderator}
            </button>
            <button
              type="button"
              onClick={() => setModerator("")}
              className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <svg
              onClick={() => setOpen((v) => !v)}
              className="icon icon-sm absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer"
            >
              <use href="#i-chevron-down" />
            </svg>

            {open && (
              <div className="absolute left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 overflow-hidden">
                {moderatorNames.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setModerator(m);
                      setOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2.5 text-sm ${
                      m === moderator ? "bg-secondary/60 font-medium" : "hover:bg-secondary/40"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {!pupilId && (
          <p className="text-[12px] text-muted-foreground">
            {t("Bu yozuv o'quvchilar bazasida topilmadi — moderatorni saqlab bo'lmaydi.")}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!pupilId || saving}
            onClick={save}
            className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
