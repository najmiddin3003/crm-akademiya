"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Info, Loader2, X } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Picker from "@/components/v2/form/V2Picker";
import { Field, FieldError, FieldHint, FieldLabel, MoneyField, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { BONUS_TYPES } from "@/constants/bonuses";
import { PENALTY_TYPES } from "@/constants/penalties";
import { useStudents } from "@/hooks/useStudents";
import { LOADING_TEXT, selectPlaceholder } from "@/lib/selectPlaceholder";
import type { Bonus } from "@/lib/bonuses";
import type { Cashbox } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Penalty } from "@/lib/penalties";

// YANGI VERSIYA — «BONUS YARATISH» va «JARIMA QO'SHISH» oynasi (Moliya → Bonus / Jarima,
// 20.11.2026). Ikkala eski panel bir xil: «Tranzaksiya turi» → Xodim / O'quvchi, Kassa, Qiymat,
// Izoh (+ jarimada Rasm). Mantiq AYNAN eski panellardan:
//   • components/finance/BonusDrawer.tsx — POST /api/bonuses
//       { type, recipientName, amount, note, cashboxId };
//   • components/finance/PenaltyDrawer.tsx — avval rasm /api/upload/image ga (papka «jarimalar»;
//       yuklanmasa jarima YOZILMAYDI), keyin POST /api/penalties
//       { type, recipientName, amount, note, image, cashboxId }.
// Ro'yxatlar o'sha: /api/hr-employees/ref (filialga kesilmagan), /api/cashboxes, o'quvchilar —
// useStudents({ light: true }) (faqat «O'quvchi» tanlanganda yuklanadi).
// Xato matnlari o'sha («Xodimni tanlang», «Qiymatni to'g'ri kiriting» …) — faqat toast o'rniga
// maydon ostida chiqadi.

type AwardKind = "bonus" | "penalty";

/** Xodimlar va kassalar — oyna ochilganda bir marta (eski panellardagi kabi). */
function useAwardRefLists() {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/hr-employees/ref")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.ok) setEmployees(d.employees);
        }),
      fetch("/api/cashboxes")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.ok) setCashboxes(d.cashboxes);
        }),
    ])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { employees, cashboxes, loading };
}

/**
 * O'quvchi tanlovi — MODUL DARAJASIDA (eski BonusDrawer'dagi sabab): ~6 700 o'quvchi ro'yxati faqat
 * shu komponent chizilganda, ya'ni «O'quvchi» turi tanlanganda yuklanadi; oyna ichida e'lon
 * qilinsa har harf yozilganda qayta mount bo'lib, ro'yxat qayta ketardi.
 */
function AwardStudentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const { names, loading } = useStudents({ light: true });
  // Ismdoshlar bor (bir xil ism — bitta qator; tanlovda faqat ism saqlanadi, eski kabi).
  const options = useMemo(() => Array.from(new Set(names)).map((n) => ({ value: n, label: n })), [names]);
  return (
    <V2Select
      label={t("O'quvchi")}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={loading ? LOADING_TEXT : "O'quvchini qidirish"}
      searchable
    />
  );
}

const CFG = {
  bonus: {
    types: BONUS_TYPES as { value: string; label: string }[],
    initialType: BONUS_TYPES[0].value as string,
    endpoint: "/api/bonuses",
    title: "Bonus yaratish",
    typeLabel: "Bonus turi",
    saved: "Bonus yaratildi",
    hint: {
      employee: "Xodim oyligiga qo'shiladi — Oylik chiqarishdagi «Bonus» ustuni (yozilgan oy bo'yicha).",
      student: "O'quvchiga markaz hisobidan — xodimlar oyligiga ta'sir qilmaydi.",
    } as Record<string, string>,
  },
  penalty: {
    types: PENALTY_TYPES as { value: string; label: string }[],
    initialType: "",
    endpoint: "/api/penalties",
    title: "Jarima qo'shish",
    typeLabel: "Jarima turi",
    saved: "Jarima qo'shildi",
    hint: {
      employee: "Xodim oyligidan ushlanadi — Oylik chiqarishdagi «Jarima» ustuni (yozilgan oy bo'yicha).",
      student: "O'quvchiga yoziladi — xodimlar oyligiga ta'sir qilmaydi.",
    } as Record<string, string>,
  },
} as const;

function AwardDialog({ kind, onClose, onSaved }: { kind: AwardKind; onClose: () => void; onSaved: (data: Record<string, unknown>) => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const cfg = CFG[kind];
  const withImage = kind === "penalty";
  const { employees, cashboxes, loading: listsLoading } = useAwardRefLists();

  const [type, setType] = useState<string>(cfg.initialType);
  const [employeeName, setEmployeeName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ type?: string; recipient?: string; amount?: string }>({});
  const [saving, setSaving] = useState(false);

  const recipientName = type === "employee" ? employeeName : studentName;
  const dirty = type !== cfg.initialType || !!employeeName || !!studentName || !!cashboxId || !!amount || !!note || !!imageFile;

  const employeeOptions = useMemo(() => Array.from(new Set(employees.map((e) => e.name).filter(Boolean))).map((n) => ({ value: n, label: n })), [employees]);
  const cashboxOptions = useMemo(() => cashboxes.map((c) => ({ value: String(c.id), label: c.name })), [cashboxes]);

  function changeType(v: string) {
    setType(v);
    // Eski panel kabi — tur almashsa tanlangan odam tozalanadi.
    setEmployeeName("");
    setStudentName("");
    setErrors((e) => ({ ...e, type: undefined, recipient: undefined }));
  }

  async function save() {
    if (saving) return;
    // Tekshiruv tartibi va matnlari — eski panellardagi.
    const next: typeof errors = {};
    if (withImage && !type) next.type = t("Tranzaksiya turini tanlang");
    else if (!recipientName) next.recipient = type === "employee" ? t("Xodimni tanlang") : t("O'quvchini tanlang");
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) next.amount = t("Qiymatni to'g'ri kiriting");
    setErrors(next);
    if (next.type || next.recipient || next.amount) return;

    setSaving(true);
    try {
      let body: Record<string, unknown>;
      if (withImage) {
        // Rasm avval yuklanadi; xato bo'lsa jarima umuman yozilmaydi.
        let imageUrl = "";
        if (imageFile) {
          const fd = new FormData();
          fd.append("file", imageFile);
          fd.append("folder", "jarimalar");
          const up = await fetch("/api/upload/image", { method: "POST", body: fd });
          const upData = await up.json();
          if (!up.ok || !upData.ok) {
            showError(t(upData.error || "Rasm yuklanmadi"));
            setSaving(false);
            return;
          }
          imageUrl = upData.url as string;
        }
        body = { type, recipientName, amount: amountNum, note, image: imageUrl, cashboxId: cashboxId ? Number(cashboxId) : null };
      } else {
        body = { type, recipientName, amount: amountNum, note, cashboxId: cashboxId ? Number(cashboxId) : null };
      }
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data);
      showSuccess(t(cfg.saved));
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const typeHint = type ? cfg.hint[type] : "";

  return (
    <V2Dialog
      title={t(cfg.title)}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={520}
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
        <div>
          <FieldLabel>{t(cfg.typeLabel)}</FieldLabel>
          <Segmented label={t(cfg.typeLabel)} value={type} onChange={changeType} options={cfg.types.map((o) => ({ value: o.value, label: t(o.label) }))} />
          {errors.type ? <FieldError>{errors.type}</FieldError> : typeHint ? <FieldHint>{t(typeHint)}</FieldHint> : null}
        </div>

        {type === "employee" && (
          <Field label={t("Xodim")} error={errors.recipient}>
            <V2Picker
              value={employeeName}
              onChange={(v) => {
                setEmployeeName(v);
                setErrors((e) => ({ ...e, recipient: undefined }));
              }}
              options={employeeOptions}
              label={t("Xodim")}
              placeholder={t(selectPlaceholder(false, employeeOptions.length, "Xodim qo'shilmagan"))}
              loading={listsLoading}
              searchPlaceholder={t("Ism bo'yicha qidirish")}
              clearable
              state={errors.recipient ? "error" : "default"}
            />
          </Field>
        )}
        {type === "student" && (
          <Field label={t("O'quvchi")} error={errors.recipient}>
            <AwardStudentPicker
              value={studentName}
              onChange={(v) => {
                setStudentName(v);
                setErrors((e) => ({ ...e, recipient: undefined }));
              }}
            />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Qiymat")} htmlFor="award-amount" error={errors.amount}>
            <MoneyField
              id="award-amount"
              compact
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setErrors((e) => ({ ...e, amount: undefined }));
              }}
              state={errors.amount ? "error" : "default"}
            />
          </Field>
          <Field label={t("Kassa")} optional>
            <V2Picker
              value={cashboxId}
              onChange={setCashboxId}
              options={cashboxOptions}
              label={t("Kassa")}
              placeholder={t(selectPlaceholder(false, cashboxOptions.length, "Kassa qo'shilmagan", "Tanlanmagan"))}
              loading={listsLoading}
              clearable
            />
          </Field>
        </div>

        <Field label={t("Izoh")} optional htmlFor="award-note">
          <TextInput id="award-note" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
        </Field>

        {withImage && (
          <div>
            <FieldLabel optional>{t("Rasm")}</FieldLabel>
            {/* Endpoint faqat PNG/JPG/WEBP va 5 MB gacha qabul qiladi (app/api/upload/image/route.ts). */}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className={fieldCls("default", "flex items-center gap-2 text-left hover:bg-v2-surface-2!")}>
                <ImagePlus className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                <span className={`min-w-0 flex-1 truncate ${imageFile ? "text-v2-text" : "text-v2-text-3"}`}>{imageFile?.name || t("Faylni tanlash")}</span>
              </button>
              {imageFile && (
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  title={t("Olib tashlash")}
                  aria-label={t("Olib tashlash")}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              )}
            </div>
            <FieldHint>{t("Dalil sifatida: PNG, JPG yoki WEBP, 5 MB gacha. Saqlashda yuklanadi — yuklanmasa jarima yozilmaydi.")}</FieldHint>
          </div>
        )}

        {type === "employee" && (
          <p className="flex items-start gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2 text-v2-small text-v2-text">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
            <span>{t("Bugungi sana bilan yoziladi va shu oy oyligida hisobga olinadi. Xodim ismi bo'yicha bog'lanadi.")}</span>
          </p>
        )}
      </div>
    </V2Dialog>
  );
}

export function BonusCreateDialogV2({ onClose, onSaved }: { onClose: () => void; onSaved: (b: Bonus) => void }) {
  return <AwardDialog kind="bonus" onClose={onClose} onSaved={(d) => onSaved(d.bonus as Bonus)} />;
}

export function PenaltyCreateDialogV2({ onClose, onSaved }: { onClose: () => void; onSaved: (p: Penalty) => void }) {
  return <AwardDialog kind="penalty" onClose={onClose} onSaved={(d) => onSaved(d.penalty as Penalty)} />;
}
