"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, Segmented, TextInput } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";

// 40-qism — Sozlamalar ro'yxatlari (`/api/settings-lists?kind=…`) uchun umumiy qo'shish/tahrirlash oynasi:
// Sabablar, Lavozimlar, SMS qurilmalar, raqam belgilari, hashtag va o'quvchi turlari. Maydonlar sahifadan beriladi.

export type ListField =
  | { key: string; label: string; kind: "text"; placeholder?: string; optional?: boolean; hint?: string; max?: number }
  | { key: string; label: string; kind: "money"; optional?: boolean; hint?: string }
  | { key: string; label: string; kind: "segment"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "select"; options: string[]; optional?: boolean };

export default function ListItemDialogV2({
  kind,
  id,
  title,
  subtitle,
  fields,
  initial,
  onClose,
  onDone,
}: {
  kind: string;
  /** Tahrirlashda — yozuv id; yo'q — yangi. */
  id?: number;
  title: string;
  subtitle?: string;
  fields: ListField[];
  initial: Record<string, string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const { showSuccess } = useToast();
  const modal = useModalClose(onClose, "center");
  const [v, setV] = useState<Record<string, string>>(initial);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = fields.some((f) => (v[f.key] ?? "") !== (initial[f.key] ?? ""));
  async function submit() {
    for (const f of fields) if (f.kind !== "segment" && !("optional" in f && f.optional) && !String(v[f.key] ?? "").trim()) return setErr(t("«{f}» maydonini to'ldiring", { f: t(f.label) }));
    setSaving(true);
    const body = Object.fromEntries(fields.map((f) => [f.key, String(v[f.key] ?? "").trim()]));
    const url = id ? `/api/settings-lists/${id}?kind=${kind}` : `/api/settings-lists?kind=${kind}`;
    const r = await fetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) return setErr(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(id ? t("Saqlandi") : t("Qo'shildi"));
    onDone();
    modal.close();
  }
  return (
    <V2Dialog
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {id ? t("Saqlash") : t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {fields.map((f, i) => {
          const fid = `li-${f.key}`;
          const set = (x: string) => {
            setV((p) => ({ ...p, [f.key]: x }));
            setErr("");
          };
          if (f.kind === "segment")
            return (
              <Field key={f.key} label={t(f.label)} htmlFor={fid}>
                <Segmented label={t(f.label)} value={v[f.key] ?? ""} onChange={set} options={f.options.map((o) => ({ value: o.value, label: t(o.label) }))} />
              </Field>
            );
          if (f.kind === "select")
            return (
              <Field key={f.key} label={t(f.label)} optional={f.optional} htmlFor={fid}>
                <V2Select id={fid} label={t(f.label)} placeholder={t("Tanlang")} clearable={false} value={v[f.key] ?? ""} onChange={set} options={f.options.map((o) => ({ value: o, label: o }))} />
              </Field>
            );
          if (f.kind === "money")
            return (
              <Field key={f.key} label={t(f.label)} optional={f.optional} htmlFor={fid} hint={f.hint ? t(f.hint) : undefined}>
                <MoneyField id={fid} compact value={(v[f.key] ?? "").replace(/\D/g, "")} onChange={set} />
              </Field>
            );
          return (
            <Field key={f.key} label={t(f.label)} optional={f.optional} htmlFor={fid} hint={f.hint ? t(f.hint) : undefined} error={i === 0 && err ? err : undefined}>
              <TextInput id={fid} value={v[f.key] ?? ""} onChange={(e) => set(e.target.value)} maxLength={f.max ?? 80} placeholder={f.placeholder ? t(f.placeholder) : undefined} autoComplete="off" />
            </Field>
          );
        })}
        {err && fields[0]?.kind !== "text" && <p className="text-v2-small text-v2-danger">{err}</p>}
      </div>
    </V2Dialog>
  );
}
