"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { phoneDigits } from "@/components/auth/PhoneField";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import V2Dialog from "@/components/v2/form/V2Dialog";
import BirthDateField, { birthText, parseBirth } from "@/components/v2/form/BirthDateField";
import { Chip, Field, FieldError, FieldLabel, PhoneField, SectionTitle, TextInput, formatLocalPhone } from "@/components/v2/form/fields";
import { useEduCategoryNames } from "@/hooks/useEduCategories";
import { invalidateStudents } from "@/hooks/useStudents";
import type { PupilProfilePayload } from "@/lib/pupilProfile";
import { toIso } from "./profileBits";

// YANGI VERSIYA — O'QUVCHI MA'LUMOTLARINI TAHRIRLASH (rasmi yo'q; «Yangi o'quvchi»
// paneli qolipida, SAVOLLAR 150): Shaxsiy ma'lumotlar (Ism, Familiya, Telefon,
// Qo'shimcha telefon, Tug'ilgan sana, Kategoriya) va Ota-ona (otasi, onasi — ism va
// telefon). O'quvchi sahifasidagi «Tahrirlash», «Tug'ilgan sana · Qo'shish» va
// «+ Ota-ona qo'shish» shu oynani ochadi (oxirgi ikkisi — o'sha maydonga fokus bilan).
//
// Yozish — eski profil formasi bilan BITTA so'rov (PATCH /api/pupils/:id), lekin faqat
// O'ZGARGAN maydonlar yuboriladi: tegilmagan telefon bazadagi shaklida qoladi.
// Qolgan maydonlar (manzil, o'qish joyi, izoh, sinf …) — eski profilning «Tahrirlash» tabida.

type Pupil = PupilProfilePayload["pupil"];
type Key = "firstName" | "phone" | "extraPhone" | "birth" | "fatherPhone" | "motherPhone";

export default function StudentEditDialogV2({
  pupil,
  focus,
  onClose,
  onSaved,
}: {
  pupil: Pupil;
  focus?: "birth" | "parents";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "drawer");
  const rootRef = useRef<HTMLDivElement>(null);

  const init = {
    firstName: pupil.firstName,
    lastName: pupil.lastName,
    phone: phoneDigits(pupil.phone),
    extraPhone: phoneDigits(pupil.extraPhone),
    birth: birthText(toIso(pupil.birthDate)),
    category: pupil.category,
    fatherName: pupil.fatherName,
    fatherPhone: phoneDigits(pupil.fatherPhone),
    motherName: pupil.motherName,
    motherPhone: phoneDigits(pupil.motherPhone),
  };
  const [f, setF] = useState(init);
  const set = <K extends keyof typeof init>(k: K, v: (typeof init)[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const touch = (k: Key) => setTouched((cur) => (cur[k] ? cur : { ...cur, [k]: true }));
  const { names: categoryNames, loading: categoriesLoading } = useEduCategoryNames(f.category);

  // «Qo'shish» havolalaridan ochilganda — o'sha maydonga.
  useEffect(() => {
    if (!focus) return;
    const id = requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(focus === "birth" ? '[data-field="birth"] input' : '[data-field="fatherName"] input');
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focus]);

  const birth = parseBirth(f.birth);
  const phoneErr = (v: string, required: boolean) =>
    v.length === 0 ? (required ? t("Telefon raqamini kiriting") : "") : v.length < 9 ? t("Raqam to'liq emas — 9 ta raqam kerak") : "";
  const errors: Record<Key, string> = {
    firstName: !f.firstName.trim() ? t("Ismni kiriting") : "",
    // Bazada telefoni bor o'quvchida raqamni o'chirib bo'lmaydi; yo'g'ida — ixtiyoriy.
    phone: phoneErr(f.phone, init.phone.length > 0),
    extraPhone: phoneErr(f.extraPhone, false),
    birth: birth.state === "partial" || birth.state === "invalid" ? t("Sana noto'g'ri — kk.oo.yyyy") : "",
    fatherPhone: phoneErr(f.fatherPhone, false),
    motherPhone: phoneErr(f.motherPhone, false),
  };
  const shown = (k: Key) => ((submitted || touched[k]) && errors[k] ? errors[k] : "");
  const ORDER: Key[] = ["firstName", "phone", "extraPhone", "birth", "fatherPhone", "motherPhone"];

  // Faqat o'zgargan maydonlar.
  const diff: Record<string, string> = {};
  if (f.firstName.trim() !== init.firstName.trim()) diff.firstName = f.firstName.trim();
  if (f.lastName.trim() !== init.lastName.trim()) diff.lastName = f.lastName.trim();
  if (f.phone !== init.phone) diff.phone = formatLocalPhone(f.phone);
  if (f.extraPhone !== init.extraPhone) diff.extraPhone = formatLocalPhone(f.extraPhone);
  if (f.birth !== init.birth) diff.birthDate = birth.iso;
  if (f.category !== init.category) diff.category = f.category;
  if (f.fatherName.trim() !== init.fatherName.trim()) diff.fatherName = f.fatherName.trim();
  if (f.fatherPhone !== init.fatherPhone) diff.fatherPhone = formatLocalPhone(f.fatherPhone);
  if (f.motherName.trim() !== init.motherName.trim()) diff.motherName = f.motherName.trim();
  if (f.motherPhone !== init.motherPhone) diff.motherPhone = formatLocalPhone(f.motherPhone);
  const dirty = Object.keys(diff).length > 0;

  async function save() {
    if (saving) return;
    const first = ORDER.find((k) => errors[k]);
    if (first) {
      setSubmitted(true);
      rootRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] input`)?.focus();
      return;
    }
    if (!dirty) {
      modal.close();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pupils/${pupil.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        showError(t(data?.error || "Saqlashda xatolik yuz berdi"));
        setSaving(false);
        return;
      }
      invalidateStudents();
      const removed = Number(data.removedWishes) || 0;
      showSuccess(
        removed
          ? `${t("O'quvchi ma'lumotlari saqlandi")} · ${t("toifa o'zgargani uchun {n} ta istak olib tashlandi", { n: removed })}`
          : t("O'quvchi ma'lumotlari saqlandi"),
      );
      onSaved();
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const name = `${pupil.firstName} ${pupil.lastName}`.trim();
  return (
    <V2Dialog
      variant="right"
      controller={modal}
      title={t("Ma'lumotlarni tahrirlash")}
      subtitle={name || undefined}
      onClose={onClose}
      dirty={dirty}
      saving={saving}
      onSubmit={save}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={`${secondaryBtn} justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={save} disabled={saving} className={`${primaryBtn} justify-center disabled:cursor-not-allowed disabled:opacity-70`}>
            {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div ref={rootRef} className="space-y-6">
        <section>
          <SectionTitle>{t("Shaxsiy ma'lumotlar")}</SectionTitle>
          <div className="grid gap-4 min-[30rem]:grid-cols-2">
            <div data-field="firstName">
              <Field label={t("Ism")} error={shown("firstName")}>
                <TextInput value={f.firstName} onChange={(e) => set("firstName", e.target.value)} onBlur={() => touch("firstName")} maxLength={60} autoComplete="off" state={shown("firstName") ? "error" : "default"} />
              </Field>
            </div>
            <Field label={t("Familiya")}>
              <TextInput value={f.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={60} autoComplete="off" />
            </Field>
            <div data-field="phone">
              <Field label={t("Telefon")} error={shown("phone")}>
                <PhoneField value={f.phone} onChange={(v) => set("phone", v)} onBlur={() => touch("phone")} state={shown("phone") ? "error" : "default"} />
              </Field>
            </div>
            <div data-field="extraPhone">
              <Field label={t("Qo'shimcha telefon")} optional error={shown("extraPhone")}>
                <PhoneField value={f.extraPhone} onChange={(v) => set("extraPhone", v)} onBlur={() => touch("extraPhone")} state={shown("extraPhone") ? "error" : "default"} />
              </Field>
            </div>
            <div data-field="birth">
              <Field label={t("Tug'ilgan sana")} optional error={shown("birth")}>
                <BirthDateField value={f.birth} onChange={(v) => set("birth", v)} onBlur={() => touch("birth")} state={shown("birth") ? "error" : "default"} />
              </Field>
            </div>
          </div>
          <div className="mt-4">
            <FieldLabel>{t("Kategoriya")}</FieldLabel>
            {categoriesLoading ? (
              <div className="flex gap-2" aria-hidden>
                <span className="h-8 w-20 rounded-v2-full bg-v2-skeleton" />
                <span className="h-8 w-16 rounded-v2-full bg-v2-skeleton" />
                <span className="h-8 w-24 rounded-v2-full bg-v2-skeleton" />
              </div>
            ) : categoryNames.length === 0 ? (
              <p className="text-v2-small text-v2-text-3">{t("Kategoriya qo'shilmagan — O'quv bo'limi → Kategoriya")}</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("Kategoriya")}>
                {categoryNames.map((c) => (
                  <Chip key={c} on={f.category === c} onClick={() => set("category", f.category === c ? "" : c)}>
                    {t(c)}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="border-t border-v2-border" aria-hidden />

        <section>
          <SectionTitle>{t("Ota-ona")}</SectionTitle>
          <p className="-mt-1 mb-3 text-v2-small text-v2-text-2">{t("Qarzdorlik va davomat haqida kimga xabar berishni shu yerdan bilasiz.")}</p>
          <div className="grid gap-4 min-[30rem]:grid-cols-2">
            <div data-field="fatherName">
              <Field label={t("Otasining ismi")} optional>
                <TextInput value={f.fatherName} onChange={(e) => set("fatherName", e.target.value)} maxLength={80} autoComplete="off" />
              </Field>
            </div>
            <div data-field="fatherPhone">
              <Field label={t("Otasining telefoni")} optional error={shown("fatherPhone")}>
                <PhoneField value={f.fatherPhone} onChange={(v) => set("fatherPhone", v)} onBlur={() => touch("fatherPhone")} state={shown("fatherPhone") ? "error" : "default"} />
              </Field>
            </div>
            <Field label={t("Onasining ismi")} optional>
              <TextInput value={f.motherName} onChange={(e) => set("motherName", e.target.value)} maxLength={80} autoComplete="off" />
            </Field>
            <div data-field="motherPhone">
              <Field label={t("Onasining telefoni")} optional error={shown("motherPhone")}>
                <PhoneField value={f.motherPhone} onChange={(v) => set("motherPhone", v)} onBlur={() => touch("motherPhone")} state={shown("motherPhone") ? "error" : "default"} />
              </Field>
            </div>
          </div>
          {submitted && Object.values(errors).some(Boolean) && <FieldError>{t("Xato maydonlarni to'g'rilang")}</FieldError>}
        </section>
      </div>
    </V2Dialog>
  );
}
