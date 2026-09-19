"use client";

import { useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Nazorat > Davomat jadvalidagi "Sharh" ikonkasi ochadigan oyna.
// Sharh o'quvchining davomati bo'yicha eslatma — `settings` kolleksiyasida
// `nazorat.davomat.v2` kaliti ostida, pupils.id bo'yicha saqlanadi
// (NazoratDavomatPage.tsx dagi SETTINGS_KEY). Bu davomat belgisining o'ziga
// (`attendance.note`) tegmaydi: u bitta darsga tegishli, bu esa o'quvchi
// bo'yicha umumiy eslatma — shuning uchun alohida turadi.
//
// DIQQAT: kalitdagi ".v2" ATAYLAB. Bazada eski `nazorat.davomat` hujjati
// hamon yotibdi, lekin undagi id'lar demo davridagi DAVOMAT_STUDENTS ning
// o'ylab topilgan 1..16 raqamlari — haqiqiy pupils.id emas. Bu izoh ilgari
// o'sha eski kalitni ko'rsatib turardi va kelajakdagi o'quvchini xato
// hujjatga olib borardi: uni o'qish tasodifiy o'quvchilarning sharhlarini
// ko'rsatib, ba'zilarini ro'yxatdan yashirib qo'yadi.

export default function DavomatCommentModal({
  studentName,
  initialValue,
  busy,
  onClose,
  onSave,
}: {
  studentName: string;
  initialValue: string;
  busy: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [text, setText] = useState(initialValue);

  return (
    <Modal onClose={onClose} controller={modal} bare zIndex={300} panelClassName="p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{t("Sharh")}</h3>
          <p className="text-[13px] text-muted-foreground">{studentName}</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
          placeholder={t("Davomat bo'yicha eslatma yozing")}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={modal.close} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(text)}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
