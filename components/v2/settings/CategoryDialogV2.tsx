"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Chip, Field, FieldError, FieldHint, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { CatCourse } from "@/lib/categoryPrices";
import { COURSE_CATEGORY_MAX, DEFAULT_COURSE_CATEGORIES, normalizeCourseCategory } from "@/lib/courseCategories";

// YANGI VERSIYA — KATEGORIYA QO'SHISH / TAHRIRLASH (24-qism «Sozlamalar · Kategoriyalar»).
// Kategoriya — kurslarning `category` maydoni (alohida ro'yxat yo'q), shu bois kamida bitta
// kurs tanlanadi. Boshqa kategoriyadagi kurs tanlansa — shu kategoriyaga o'tadi; tahrirda
// olib tashlangan kurs — kategoriyasiz. PUT /api/course-categories.

export default function CategoryDialogV2({
  current,
  courses,
  onClose,
  onSaved,
}: {
  /** Tahrirlanayotgan kategoriya; `null` — yangi. */
  current: string | null;
  courses: CatCourse[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const same = (a: unknown, b: unknown) => normalizeCourseCategory(a).toLowerCase() === normalizeCourseCategory(b).toLowerCase();
  const initial = current === null ? [] : courses.filter((c) => same(c.category, current)).map((c) => c.id);
  const [name, setName] = useState(current ?? "");
  const [picked, setPicked] = useState<number[]>(initial);
  const [nameErr, setNameErr] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const used = new Set(courses.map((c) => normalizeCourseCategory(c.category).toLowerCase()).filter(Boolean));
  const suggestions = current === null ? DEFAULT_COURSE_CATEGORIES.filter((d) => !used.has(d.toLowerCase())) : [];
  const sorted = [...courses].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name, "uz"));
  const moving = picked.filter((id) => {
    const c = courses.find((x) => x.id === id);
    return c && normalizeCourseCategory(c.category) && !(current !== null && same(c.category, current));
  }).length;
  const dirty = current === null ? Boolean(name.trim() || picked.length) : name.trim() !== current || picked.length !== initial.length || picked.some((id) => !initial.includes(id));

  function toggle(id: number) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    if (err) setErr("");
  }

  async function submit() {
    const n = normalizeCourseCategory(name);
    if (!n) return setNameErr(t("Kategoriya nomini kiriting"));
    if (picked.length === 0) return setErr(t("Kamida bitta kursni tanlang"));
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/course-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, courseIds: picked, ...(current !== null ? { from: current } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setErr(t(d.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(current === null ? t("«{name}» kategoriyasi qo'shildi", { name: n }) : t("«{name}» kategoriyasi saqlandi", { name: n }));
      setSaving(false);
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={current === null ? t("Kategoriya qo'shish") : t("Kategoriyani tahrirlash")}
      subtitle={t("Kurslar shu nom bilan guruhlanadi — Kurslar ro'yxati va narxlar shu bo'yicha")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={560}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {current === null ? t("Kategoriya qo'shish") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Kategoriya nomi")} htmlFor="cat-v2-name" error={nameErr || undefined}>
          <TextInput
            id="cat-v2-name"
            value={name}
            state={nameErr ? "error" : "default"}
            onChange={(e) => {
              setName(e.target.value);
              if (nameErr) setNameErr("");
            }}
            maxLength={COURSE_CATEGORY_MAX}
            placeholder={t("Masalan: Chet tillari")}
            autoComplete="off"
            autoFocus
          />
        </Field>
        {suggestions.length > 0 && !name.trim() && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Chip key={s} on={false} onClick={() => setName(s)}>
                {t(s)}
              </Chip>
            ))}
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-v2-small font-medium text-v2-text">{t("Kurslar")}</span>
            <span className="text-v2-caption text-v2-text-3">{t("{n} ta tanlangan", { n: picked.length })}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((c) => {
              const other = normalizeCourseCategory(c.category);
              const title = other && !(current !== null && same(other, current)) ? t("Hozir: {name}", { name: other }) : undefined;
              return (
                <Chip key={c.id} on={picked.includes(c.id)} onClick={() => toggle(c.id)} title={title}>
                  <span className={c.active === false ? "text-v2-text-3" : ""}>{c.name}</span>
                  {title && <span className="text-v2-caption font-normal text-v2-text-3">· {other}</span>}
                </Chip>
              );
            })}
          </div>
          {moving > 0 && <FieldHint>{t("{n} ta kurs boshqa kategoriyadan shu kategoriyaga o'tadi.", { n: moving })}</FieldHint>}
        </div>
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}
