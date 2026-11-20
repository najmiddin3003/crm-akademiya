"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Picker from "@/components/v2/form/V2Picker";
import { Field, FieldHint, FieldLabel, TextInput } from "@/components/v2/form/fields";
import { Switch } from "@/components/v2/settings/financeKit";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { BLOCK_TEST_KINDS } from "@/constants/blockTest";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import type { BlockTestSubject, BlockTestType } from "@/lib/blockTestTypes";

// YANGI VERSIYA — «TUR QO'SHISH» / «TURNI TAHRIRLASH» OYNASI (Blok test → Blok test turlari, 54-qism, rasmsiz,
// 20.11.2026). Mantiq AYNAN eski components/blockTest/BlockTestTypeModal.tsx dan:
//   • POST /api/block-test-types (qo'shish) yoki PATCH /api/block-test-types/:id (tahrirlash);
//   • so'rov tanasi { name (trim), kind, durationMinutes (yozilgan matn), subjects (fani tanlanganlari), active };
//   • tekshiruv — faqat nomi («Nomini kiriting»; eskisida toast, bu yerda maydon ostida);
//   • Fan tanlovi — /api/offline-courses (useOfflineCourseList), saqlangan fan ro'yxatda bo'lmasa ham ko'rinadi.
// Son maydonlari matn sifatida turadi (faqat raqam), saqlashda eskisidagidek songa aylanadi:
// savollar — parseInt || 0, ball — parseFloat || 0 (vergul ham qabul qilinadi).

interface SubjectDraft {
  subject: string;
  q: string;
  p: string;
}

const draftOf = (s: BlockTestSubject): SubjectDraft => ({ subject: s.subject, q: String(s.questionsCount ?? 0), p: String(s.pointsPerCorrect ?? 0) });
const emptyDraft = (): SubjectDraft => ({ subject: "", q: "0", p: "0" });
const toSubject = (d: SubjectDraft): BlockTestSubject => ({
  subject: d.subject,
  questionsCount: parseInt(d.q, 10) || 0,
  pointsPerCorrect: parseFloat(d.p.replace(",", ".")) || 0,
});
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 5);
const decimal = (v: string) => v.replace(/[^\d.,]/g, "").slice(0, 6);
const fmtScore = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export default function BlockTestTypeDialogV2({ type, onClose, onSaved }: { type?: BlockTestType; onClose: () => void; onSaved: (type: BlockTestType) => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const { names: subjectOptions, loading: subjectsLoading } = useOfflineCourseList();

  const initial = useMemo(
    () => ({
      name: type?.name || "",
      kind: type?.kind || "",
      duration: type ? String(type.durationMinutes) : "0",
      subjects: type?.subjects?.length ? type.subjects.map(draftOf) : [emptyDraft()],
      active: type ? type.active : true,
    }),
    [type],
  );
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState(initial.kind);
  const [duration, setDuration] = useState(initial.duration);
  const [subjects, setSubjects] = useState<SubjectDraft[]>(initial.subjects);
  const [active, setActive] = useState(initial.active);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== initial.name ||
    kind !== initial.kind ||
    duration !== initial.duration ||
    active !== initial.active ||
    JSON.stringify(subjects) !== JSON.stringify(initial.subjects);

  const parsed = subjects.map(toSubject);
  const chosen = parsed.filter((s) => s.subject.trim());
  const totalQ = chosen.reduce((s, x) => s + x.questionsCount, 0);
  const totalP = chosen.reduce((s, x) => s + x.questionsCount * x.pointsPerCorrect, 0);

  function update(i: number, patch: Partial<SubjectDraft>) {
    setSubjects((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t("Nomini kiriting"));
      return;
    }
    setSaving(true);
    // Eski oyna bilan bir xil tana.
    const payload = {
      name: trimmed,
      kind,
      durationMinutes: duration,
      subjects: subjects.map(toSubject).filter((s) => s.subject.trim()),
      active,
    };
    const url = type ? `/api/block-test-types/${type.id}` : "/api/block-test-types";
    const method = type ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.type as BlockTestType);
      showSuccess(type ? t("Tur yangilandi") : t("Tur qo'shildi"));
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={type ? t("Turni tahrirlash") : t("Tur qo'shish")}
      subtitle={type ? `${type.code} · ${type.createdAt}` : t("Blok test qolipi: davomiyligi va fanlari")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={600}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="btt-name" error={nameError || undefined}>
          <TextInput
            id="btt-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            placeholder={t("Nomi")}
            state={nameError ? "error" : "default"}
          />
        </Field>

        <div className="grid gap-4 min-[40rem]:grid-cols-2">
          <Field label={t("Turi (kodi)")}>
            <V2Select
              label={t("Turi (kodi)")}
              value={kind}
              onChange={setKind}
              options={BLOCK_TEST_KINDS.map((k) => ({ value: k.value, label: k.label }))}
              placeholder="Tanlang"
              searchable={false}
            />
          </Field>
          <Field label={t("Davomiyligi (daqiqa)")} htmlFor="btt-duration">
            <div className="relative">
              <TextInput id="btt-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(digits(e.target.value))} className="pr-16 tabular-nums" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">{t("daqiqa")}</span>
            </div>
          </Field>
        </div>

        {/* Fanlar */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <FieldLabel className="mb-0!">{t("Fanlar")}</FieldLabel>
            {chosen.length > 0 && (
              <span className="text-v2-caption text-v2-text-2">{t("Jami {q} savol · {p} ball", { q: totalQ, p: fmtScore(totalP) })}</span>
            )}
          </div>
          <div className="space-y-2">
            {subjects.map((s, i) => {
              const opts = s.subject && !subjectOptions.includes(s.subject) ? [s.subject, ...subjectOptions] : subjectOptions;
              const sub = parsed[i];
              return (
                <div key={i} className="rounded-v2-md border border-v2-border bg-v2-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-v2-caption text-v2-text-3">{t("Fan {n}", { n: i + 1 })}</span>
                    <span className="flex items-center gap-2">
                      {sub.subject && (
                        <span className="text-v2-caption tabular-nums text-v2-text-2">{t("{p} ball", { p: fmtScore(sub.questionsCount * sub.pointsPerCorrect) })}</span>
                      )}
                      {subjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSubjects((prev) => prev.filter((_, idx) => idx !== i))}
                          title={t("O'chirish")}
                          aria-label={t("Fan {n}", { n: i + 1 }) + " — " + t("O'chirish")}
                          className="inline-flex size-7 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-danger-bg hover:text-v2-danger"
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="grid gap-2 min-[40rem]:grid-cols-[minmax(0,1fr)_112px_132px]">
                    <div>
                      <span className="mb-1 block text-v2-caption text-v2-text-2">{t("Fan")}</span>
                      <V2Picker
                        value={s.subject}
                        onChange={(v) => update(i, { subject: v })}
                        options={opts.map((f) => ({ value: f, label: f, lead: <span className={`size-2 rounded-full ${FAN_DOT[fanOf(f)]}`} aria-hidden /> }))}
                        label={t("Fan")}
                        placeholder={t(selectPlaceholder(subjectsLoading, subjectOptions.length, "Kurs qo'shilmagan"))}
                        loading={subjectsLoading}
                        disabled={subjectsLoading}
                        clearable
                        size="sm"
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-v2-caption text-v2-text-2">{t("Savollar soni")}</span>
                      <TextInput
                        inputMode="numeric"
                        aria-label={t("Savollar soni")}
                        value={s.q}
                        onChange={(e) => update(i, { q: digits(e.target.value) })}
                        className="h-9! tabular-nums"
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-v2-caption text-v2-text-2" title={t("Har bir to'g'ri javob uchun ball")}>
                        {t("Ball (1 javob)")}
                      </span>
                      <TextInput
                        inputMode="decimal"
                        aria-label={t("Har bir to'g'ri javob uchun ball")}
                        value={s.p}
                        onChange={(e) => update(i, { p: decimal(e.target.value) })}
                        className="h-9! tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSubjects((prev) => [...prev, emptyDraft()])}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-v2-md border border-dashed border-v2-border-strong text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Fan qo'shish")}
          </button>
          {subjects.some((s) => !s.subject.trim()) && <FieldHint>{t("Fani tanlanmagan qator saqlanmaydi.")}</FieldHint>}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-v2-md border border-v2-border px-3 py-2.5">
          <div>
            <div className="text-v2-body font-medium text-v2-text">{t("Faol")}</div>
            <div className="text-v2-caption text-v2-text-3">{t("Nofaol tur ro'yxatda qoladi, belgisi kulrang")}</div>
          </div>
          <Switch on={active} label={t("Faol")} onChange={setActive} />
        </div>
      </div>
    </V2Dialog>
  );
}
