"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import { Field, FieldError, TextInput } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useModerators } from "@/hooks/useModerators";
import type { Cashbox } from "@/lib/cashboxes";
import { initials } from "@/lib/paymentMethodUsage";

// YANGI VERSIYA — KASSA QO'SHISH / TAHRIRLASH (24-qism «Sozlamalar · Kassalar»).
//
// Server qoidalari o'zgarmagan (app/api/cashboxes, [id]): faqat administrator; nom bo'sh
// bo'lmaydi; bitta xodim — bitta kassa (band mas'ul ro'yxatda xira). Mas'ul ro'yxati eski
// oynadagi kabi /api/moderators (lavozimi «Moderator» faol xodimlar); kassaning hozirgi
// mas'uli ro'yxatda bo'lmasa (masalan rahbar) — u ham variant bo'lib turadi.
//
// FILIAL o'zgartirilmaydi — API buni qabul qilmaydi: yangi kassa navbarda tanlangan filialga
// ochiladi (1+2 hovuzida — mas'ulning o'z filiali). «Onlayn to'lov» belgisi oynada yo'q
// (tizimda hech narsaga ta'sir qilmaydi) — tahrirda yuborilmaydi, o'zgarmay qoladi.
// Xato oyna ichida (toast pastki o'ngda «Saqlash» ustiga tushadi).

export default function CashboxDialogV2({
  cashbox,
  cashboxes,
  branchName,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox | null;
  /** Barcha kassalar — band mas'ullarni aniqlash uchun. */
  cashboxes: Cashbox[];
  /** Tahrirda — kassaning filiali; qo'shishda — navbardagi filial. */
  branchName: string;
  onClose: () => void;
  onSaved: (saved: Cashbox, message: string) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const { names, loading: modsLoading } = useModerators();
  const [name, setName] = useState(cashbox?.name ?? "");
  const [moderator, setModerator] = useState(cashbox?.moderator ?? "");
  const [nameErr, setNameErr] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const norm = (s: string) => s.trim().toLowerCase();
  const takenBy = new Map<string, Cashbox>();
  for (const c of cashboxes) if (c.id !== cashbox?.id && c.moderator) takenBy.set(norm(c.moderator), c);

  const pool = [...names];
  if (cashbox?.moderator && !pool.some((n) => norm(n) === norm(cashbox.moderator))) pool.unshift(cashbox.moderator);
  const options: PickerOption[] = pool.map((n) => {
    const busy = takenBy.get(norm(n));
    return {
      value: n,
      label: n,
      lead: (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[10px] font-semibold text-v2-text-2" aria-hidden>
          {initials(n)}
        </span>
      ),
      hint: busy ? <span className="text-v2-caption text-v2-text-3">{busy.archived ? t("«{name}» (arxiv)", { name: busy.name }) : busy.name}</span> : undefined,
      disabled: Boolean(busy),
    };
  });

  const dirty = cashbox ? name.trim() !== cashbox.name || moderator !== (cashbox.moderator ?? "") : Boolean(name.trim() || moderator);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setNameErr(t("Kassa nomini kiriting"));
    setErr("");
    setSaving(true);
    const payload = cashbox ? { name: trimmed, moderator } : { name: trimmed, moderator, onlinePayment: false, archived: false };
    try {
      const res = await fetch(cashbox ? `/api/cashboxes/${cashbox.id}` : "/api/cashboxes", {
        method: cashbox ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.cashbox as Cashbox, cashbox ? t("Kassa yangilandi") : t("Kassa qo'shildi"));
      setSaving(false);
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={cashbox ? t("Kassani tahrirlash") : t("Kassa qo'shish")}
      subtitle={cashbox ? t("Qoldiq va pul amallari — Moliya → Kassalar") : t("Yangi kassa bo'sh ochiladi — pul tushum yoki ko'chirma bilan keladi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {cashbox ? t("Saqlash") : t("Kassa qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Kassa nomi")} htmlFor="cashbox-v2-name" error={nameErr || undefined}>
          <TextInput
            id="cashbox-v2-name"
            value={name}
            state={nameErr ? "error" : "default"}
            onChange={(e) => {
              setName(e.target.value);
              if (nameErr) setNameErr("");
            }}
            maxLength={60}
            placeholder={t("Masalan: Uychi kassasi")}
            autoComplete="off"
          />
        </Field>
        <Field label={t("Mas'ul")} optional htmlFor="cashbox-v2-mod" hint={t("To'lov oynasida xodim faqat o'zi mas'ul bo'lgan kassani ko'radi. Bitta xodim — bitta kassa.")}>
          <V2Picker
            id="cashbox-v2-mod"
            label={t("Mas'ul")}
            value={moderator}
            onChange={setModerator}
            options={options}
            clearable
            loading={modsLoading}
            placeholder={t("Mas'ulni tanlang")}
            searchPlaceholder={t("Xodim ismi")}
            emptyText={t("Lavozimi «Moderator» bo'lgan faol xodim yo'q")}
          />
        </Field>
        <div className="flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0">
            <div className="text-v2-text">
              {t("Filial")}: <span className="font-semibold">{branchName || t("Filialsiz")}</span>
            </div>
            <div className="text-v2-caption text-v2-text-2">
              {cashbox
                ? t("Kassa filiali ochilganda belgilanadi va o'zgarmaydi.")
                : t("Kassa navbarda tanlangan filialga ochiladi (1+2 hovuzida — mas'ulning o'z filiali). Keyin o'zgarmaydi.")}
            </div>
          </div>
        </div>
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}
