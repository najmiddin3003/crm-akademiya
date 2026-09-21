"use client";

import { useEffect, useMemo, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useEduCategoryNames } from "@/hooks/useEduCategories";
import { invalidateStudents } from "@/hooks/useStudents";
import { SOURCE_OTHER, STUDENT_SOURCES } from "@/constants";
import type { Pupil } from "@/lib/pupilsData";
import { useT } from "@/components/shared/Language";

// Imtihon → "Natija qo'shish" paneli → "O'quvchi qo'shish" (referens
// sarhisob.html dagi "Yangi o'quvchi" modali).
//
// Guruh ro'yxatida yo'q o'quvchi shu yerdan qo'shiladi va panelda darhol
// paydo bo'ladi: POST /api/pupils (O'quvchilar bo'limiga yoziladi), so'ng
// POST /api/groups/:id/students (tanlangan guruhga biriktiriladi).
//
// REFERENSDAN FARQI: unda Ism/Familiya/Telefon/Kategoriya — to'rt maydon.
// Bu yerda yana "Manba" bor, chunki POST /api/pupils da u MAJBURIY
// (O'quvchilar oqimi hisoboti shunga tayanadi) va uni jimgina qattiq
// qiymat bilan to'ldirish o'sha hisobotni buzardi. Lid (buyurtma)
// YARATILMAYDI: lid — sotuv voronkasi va Telegramga "yangi lid" xabari
// ketadi; imtihon topshirayotgan o'quvchi lid emas.
//
// Ichki oyna panel (zIndex 110) USTIDA ochiladi — 120.

/** "941558855" → "94 155 88 55" — ilovaning boshqa joylaridagi format. */
function formatLocalPhone(digits: string): string {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function NewStudentModal({
  groupId,
  groupLabel,
  onClose,
  onAdded,
}: {
  groupId: number;
  groupLabel: string;
  onClose: () => void;
  /** O'quvchi yaratilib guruhga qo'shilgach — panel ro'yxatiga qo'shish uchun. */
  onAdded: (pupil: Pupil) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const { names: categoryNames, loading: categoriesLoading } = useEduCategoryNames();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  // Manba ro'yxati bazadan (Sotuv va marketing → O'quvchilar oqimi);
  // kelmasa konstanta — maydon majburiy, bo'sh ro'yxat formani qulflardi.
  const [dbSources, setDbSources] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-sources/options")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const names = (d.options as { name: string }[]).map((o) => o.name).filter(Boolean);
        if (names.length > 0) setDbSources(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const sourceOptions = useMemo(() => {
    const list = dbSources ?? (STUDENT_SOURCES as string[]).filter((s) => s !== SOURCE_OTHER);
    return list.map((s) => ({ value: s, label: s }));
  }, [dbSources]);

  const categoryOptions = useMemo(() => categoryNames.map((c) => ({ value: c, label: c })), [categoryNames]);

  async function save() {
    if (!firstName.trim()) return showError(t("Ism majburiy"));
    if (!source) return showError(t("Manba majburiy"));
    setSaving(true);
    try {
      const created = await fetch("/api/pupils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: formatLocalPhone(phone),
          extraPhone: "",
          category,
          birthDate: "",
          source,
        }),
      }).then((r) => r.json());
      if (!created.ok) {
        showError(t(created.error || "O'quvchi qo'shishda xatolik yuz berdi"));
        setSaving(false);
        return;
      }
      const pupil = created.pupil as Pupil;
      invalidateStudents();
      const joined = await fetch(`/api/groups/${groupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId: pupil.id }),
      }).then((r) => r.json());
      if (!joined.ok) {
        // O'quvchi yaratildi, lekin guruhga kirmadi — foydalanuvchi bilsin,
        // Guruh sahifasidan qo'shib qo'yadi.
        showError(t(joined.error || "Guruhga qo'shishda xatolik yuz berdi"));
        setSaving(false);
        return;
      }
      showSuccess(t("{name} qo'shildi — {group}", { name: `${pupil.firstName} ${pupil.lastName}`.trim(), group: groupLabel }));
      onAdded(pupil);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare size="md" zIndex={120} locked={saving} panelClassName="p-5">
      <h3 className="text-[16px] font-semibold">{t("Yangi o'quvchi")}</h3>
      <p className="text-[12px] text-muted-foreground mt-0.5 mb-4">
        {t("O'quvchi O'quvchilar bo'limiga yoziladi va {group} guruhiga biriktiriladi.", { group: groupLabel })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[13px] font-medium mb-1.5">
            {t("Ism")}<span className="text-red-500">*</span>
          </label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} autoFocus />
        </div>
        <div>
          <label className="block text-[13px] font-medium mb-1.5">{t("Familiya")}</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-[13px] font-medium mb-1.5">{t("Telefon")}</label>
        <div className="auth-phone">
          <span className="auth-phone-prefix">+998</span>
          <input
            type="tel"
            inputMode="numeric"
            value={formatLocalPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder="94 408 57 97"
            className="auth-phone-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Select
          label={t("Kategoriya")}
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          placeholder={t("Tanlang")}
          loading={categoriesLoading}
          clearable
        />
        <Select
          label={t("Manba")}
          required
          value={source}
          onChange={setSource}
          options={sourceOptions}
          placeholder={t("Tanlang")}
        />
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={modal.close}
          disabled={saving}
          className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
        >
          {t("Bekor qilish")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t("Qo'shilmoqda…") : t("Qo'shish")}
        </button>
      </div>
    </Modal>
  );
}
