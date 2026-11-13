"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, FieldError, FieldLabel, Segmented, TextInput, methodDot } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { PaymentMethod } from "@/lib/paymentMethods";
import { isLockedMethod } from "@/lib/paymentMethodUsage";

// YANGI VERSIYA — TO'LOV TURI QO'SHISH / TAHRIRLASH (24-qism «Sozlamalar · To'lov turlari»).
//
// Mavjud API: POST /api/settings-lists?kind=payment-methods (nomdan barqaror `key` yasaydi),
// PATCH /api/settings-lists/:id?kind=payment-methods. Nom o'zgarsa KALIT o'zgarmaydi — eski
// to'lovlar va kassalardagi summalar shu turda qoladi.
//
// Rasmdagi rang tanlovi YO'Q: rang tur kalitidan (components/v2/form/fields.tsx methodDot) —
// to'lov oynasi, kassa kartasi va hisobotlar shunga qaraydi. «Naqd» va «Plastik» nofaol
// qilinmaydi (lib/paymentMethodUsage.ts LOCKED_METHOD_KEYS).

export default function PaymentMethodDialogV2({
  method,
  onClose,
  onSaved,
}: {
  method: PaymentMethod | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(method ? method.name : "");
  const [active, setActive] = useState(method ? method.active !== false : true);
  const [nameErr, setNameErr] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = method ? isLockedMethod(method.key) : false;

  const dirty = method ? name.trim() !== method.name || active !== (method.active !== false) : Boolean(name.trim());

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setNameErr(t("Nomini kiriting"));
    setErr("");
    setSaving(true);
    try {
      const res = await fetch(method ? `/api/settings-lists/${method.id}?kind=payment-methods` : "/api/settings-lists?kind=payment-methods", {
        method: method ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locked ? { name: trimmed } : { name: trimmed, active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(method ? t("To'lov turi yangilandi") : t("«{name}» qo'shildi — ro'yxat oxirida", { name: trimmed }));
      setSaving(false);
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={method ? t("To'lov turini tahrirlash") : t("To'lov turi qo'shish")}
      subtitle={method ? t("Nom o'zgarsa ham eski to'lovlar shu turda qoladi") : t("To'lov oynasida, kassa amallarida va hisobotlarda chiqadi")}
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
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {method ? t("Saqlash") : t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="pm-v2-name" error={nameErr || undefined}>
          <TextInput
            id="pm-v2-name"
            value={name}
            state={nameErr ? "error" : "default"}
            onChange={(e) => {
              setName(e.target.value);
              if (nameErr) setNameErr("");
            }}
            maxLength={40}
            placeholder={t("Masalan: Payme")}
            autoComplete="off"
          />
        </Field>
        <div>
          <FieldLabel>{t("Holat")}</FieldLabel>
          {locked ? (
            <div className="flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span className="text-v2-text-2">{t("Tizim turi — doim faol: kassa hisobi va oylik shu tur bilan yuradi.")}</span>
            </div>
          ) : (
            <>
              <Segmented
                value={active ? "on" : "off"}
                onChange={(v) => setActive(v === "on")}
                label={t("Holat")}
                options={[
                  { value: "on", label: t("Faol"), dot: "bg-v2-success" },
                  { value: "off", label: t("Nofaol"), dot: "bg-v2-text-3" },
                ]}
              />
              <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("Nofaol tur yangi to'lovda tanlanmaydi, eski to'lovlarda va kassa qoldig'ida ko'rinib turadi.")}</p>
            </>
          )}
        </div>
        {method && (
          <div className="flex items-center gap-2 text-v2-caption text-v2-text-2">
            <span className={`size-2.5 shrink-0 rounded-[3px] ${methodDot(method.key)}`} aria-hidden />
            <span>{t("Rang tur kalitidan avtomatik: «{key}»", { key: method.key })}</span>
          </div>
        )}
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}
