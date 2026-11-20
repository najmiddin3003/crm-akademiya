"use client";

import { useState } from "react";
import { AlertTriangle, Info, Loader2, Send } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatPhoneDisplay, phoneDigits } from "@/components/auth/PhoneField";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, PhoneField, TextInput } from "@/components/v2/form/fields";
import { Switch } from "@/components/v2/settings/financeKit";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { EMP_LEAVE_REASONS, ROLE_LABELS } from "@/constants/employees";
import type { TempStaffRow } from "@/app/api/temp-staff/route";

// YANGI VERSIYA — «VAQTINCHALIK TUGMA» OYNALARI (/vaqtinchalik, 55-qism, 20.11.2026).
// Eski versiyada — components/temp/TempStaffPage.tsx ichidagi oynalar, o'zgarmagan. Mantiq, so'rovlar
// va yuboriladigan maydonlar AYNAN o'sha:
//   • Tahrirlash — PATCH /api/temp-staff/:id { name, phone, turi, email } (tor tahrir; filial, oylik,
//     ruxsatlar — Boshqaruv → Xodimlar da);
//   • Arxivlash — PATCH { archReason, archDate: "DD.MM.YYYY" }; qaytarish — ikkalasi bo'sh satr;
//   • Faollashtirish SMS'i — POST /api/temp-staff/invite { ids, twoFactor }; kimga ketishi ro'yxat
//     bilan ko'rsatiladi, «Ikki bosqichli tasdiqlash» har safar O'CHIQ ochiladi.
// Farqi: xatolar (ism bo'sh, chala telefon) toast o'rniga maydon ostida; server xatolari — toast, eski kabi.

export type TempBranch = { id: number; name: string };
/** /api/temp-staff/invite qaytaradigan qator natijasi. */
export type InviteResult = { id: number; name: string; ok: boolean; error?: string };

/** Bugungi sana "YYYY-MM-DD" (brauzer vaqti — eski sahifadagi bilan bir xil). */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "YYYY-MM-DD" → "DD.MM.YYYY" (loyihada saqlanadigan format). */
function toStoredDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/* ---------------- Tahrirlash ---------------- */

export function EditStaffDialogV2({ row, onClose, onSaved }: { row: TempStaffRow; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(row.name);
  const [phone, setPhone] = useState(() => phoneDigits(row.phone));
  // Telefon maydoniga tegilmagan bo'lsa — eski oynadagi kabi bazadagi raqam ekrandagi ko'rinishida
  // yuboriladi (g'alati shakldagi eski yozuv jimgina 9 raqamga qisqarib qolmasin).
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [turi, setTuri] = useState(row.turi);
  const [email, setEmail] = useState(row.email);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  const dirty = name !== row.name || (phoneTouched && phone !== phoneDigits(row.phone)) || turi !== row.turi || email !== row.email;

  async function save() {
    if (saving) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("Ismni kiriting");
    if (phoneTouched && phone.length > 0 && phone.length < 9) next.phone = t("Telefon raqami noto'g'ri");
    setErrors(next);
    if (next.name || next.phone) return;

    const phoneOut = phoneTouched ? (phone ? formatPhoneDisplay(phone) : "") : formatPhoneDisplay(row.phone);
    setSaving(true);
    try {
      const res = await fetch(`/api/temp-staff/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phoneOut.trim(), turi, email: email.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      showSuccess(t("Saqlandi"));
      setSaving(false);
      modal.close();
      await onSaved();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={t("Xodimni tahrirlash")}
      subtitle={row.name || `#${row.id}`}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={480}
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
        <Field label={t("Ism familiya")} htmlFor="tmp-name" error={errors.name}>
          <TextInput
            id="tmp-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
            state={errors.name ? "error" : "default"}
            autoComplete="off"
          />
        </Field>
        <Field label={t("Telefon raqam")} htmlFor="tmp-phone" error={errors.phone} hint={t("Raqam o'zgarsa hisob ham ergashadi — xodim yangi raqami bilan kiradi.")}>
          <PhoneField
            id="tmp-phone"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              setPhoneTouched(true);
              setErrors((x) => ({ ...x, phone: undefined }));
            }}
            state={errors.phone ? "error" : "default"}
          />
        </Field>
        <Field label={t("O'quv markazidagi vazifasi")}>
          <V2Select
            label={t("O'quv markazidagi vazifasi")}
            value={turi}
            onChange={setTuri}
            options={Object.entries(ROLE_LABELS).map(([key, label]) => ({ value: key, label: label as string }))}
            placeholder={t("Tanlang")}
            searchable={false}
            clearable
          />
        </Field>
        <Field label={t("Elektron pochta")} htmlFor="tmp-email">
          <TextInput id="tmp-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("example@gmail.com")} autoComplete="off" />
        </Field>
        <p className="flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <span>{t("Filial, ish haqi, soliq va ruxsatlar bu yerda emas — ular Boshqaruv → Xodimlar sahifasida, bir-biriga bog'liq qoidalar bilan birga tahrirlanadi.")}</span>
        </p>
      </div>
    </V2Dialog>
  );
}

/* ---------------- Arxivlash / arxivdan chiqarish ---------------- */

export function ArchiveDialogV2({ row, onClose, onSaved }: { row: TempStaffRow; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const restore = Boolean(row.archReason);
  const [reason, setReason] = useState<string>(EMP_LEAVE_REASONS[0]);
  const [date, setDate] = useState(() => todayIso());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Arxivlash — sabab + sana yoziladi; qaytarish — ikkalasi tozalanadi (eskisidagidek). */
  async function save() {
    if (saving) return;
    const body = restore ? { archReason: "", archDate: "" } : { archReason: reason, archDate: toStoredDate(date) };
    if (!restore && (!reason || !body.archDate)) {
      setError(t("Sabab va sanani to'g'ri kiriting"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/temp-staff/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      showSuccess(restore ? t("Arxivdan chiqarildi") : t("Arxivlandi"));
      setSaving(false);
      modal.close();
      await onSaved();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const action = restore ? t("Arxivdan chiqarish") : t("Arxivlash");
  return (
    <V2Dialog
      title={action}
      onClose={onClose}
      controller={modal}
      saving={saving}
      onSubmit={() => void save()}
      width={440}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : action}
          </button>
        </>
      )}
    >
      {restore ? (
        <div className="space-y-3">
          <p className="text-v2-body text-v2-text-2">
            <b className="font-semibold text-v2-text">{row.name || `#${row.id}`}</b> {t("arxivdan chiqariladi va yana aktiv xodimlar qatoriga qaytadi.")}
          </p>
          <div className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">
            <span className="text-v2-text-3">{t("Ketish sababi")}:</span> {t(row.archReason)}
            {row.archDate && (
              <>
                {" · "}
                <span className="text-v2-text-3">{t("Ketgan sanasi")}:</span> <span className="tabular-nums">{row.archDate}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-v2-body text-v2-text-2">
            <b className="font-semibold text-v2-text">{row.name || `#${row.id}`}</b> {t("arxivga o'tkaziladi. U ro'yxatdan yo'qolmaydi va istalgan vaqtda qaytariladi.")}
          </p>
          <Field label={t("Ketish sababi")}>
            <V2Select
              label={t("Ketish sababi")}
              value={reason}
              onChange={(v) => {
                setReason(v);
                setError("");
              }}
              options={EMP_LEAVE_REASONS.map((r: string) => ({ value: r, label: r }))}
              searchable={false}
              clearable={false}
            />
          </Field>
          <Field label={t("Ketgan sanasi")} error={error || undefined}>
            <IsoDateField
              value={date}
              onChange={(v) => {
                setDate(v);
                setError("");
              }}
            />
          </Field>
        </div>
      )}
    </V2Dialog>
  );
}

/* ---------------- Faollashtirish SMS'i ---------------- */

export function SmsInviteDialogV2({
  targets,
  maxBatch,
  onClose,
  onSent,
}: {
  /** `skipped` — tanlangan, lekin SMS ketmaydigan (faollashgan yoki raqamsiz) xodimlar soni. */
  targets: { list: TempStaffRow[]; skipped: number };
  maxBatch: number;
  onClose: () => void;
  onSent: (results: InviteResult[]) => Promise<void> | void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  // Har safar O'CHIQ ochiladi: oldingi yuborishdagi tanlov keyingi guruhga jimgina qo'llanmasin.
  const [twoFactor, setTwoFactor] = useState(false);
  const [sending, setSending] = useState(false);
  const n = targets.list.length;

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/temp-staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targets.list.map((x) => x.id), twoFactor }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Yuborilmadi"));
        setSending(false);
        return;
      }
      if (data.failed === 0) {
        showSuccess(t("SMS yuborildi — {sent} ta", { sent: data.sent }));
      } else {
        showError(t("Yuborildi: {sent}, yuborilmadi: {failed} — sabablari pastda", { sent: data.sent, failed: data.failed }));
      }
      setSending(false);
      modal.close();
      await onSent(data.results as InviteResult[]);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSending(false);
    }
  }

  return (
    <V2Dialog
      title={t("Faollashtirish SMS'i")}
      onClose={onClose}
      controller={modal}
      saving={sending}
      width={480}
      footerStart={<span className="text-v2-caption text-v2-text-3">{t("{n} ta raqam", { n })}</span>}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={sending} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void send()} disabled={sending} className={`${primaryBtn} disabled:opacity-60`}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" strokeWidth={2} aria-hidden />}
            {sending ? t("Yuborilmoqda…") : t("Yuborish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* KIMGA ketishi ochiq ro'yxat bilan turadi: SMS haqiqatan yuboriladi va pul turadi. */}
        <p className="text-v2-body text-v2-text-2">
          {t("Quyidagi")}{" "}
          <b className="font-semibold tabular-nums text-v2-text">
            {n} {t("ta")}
          </b>{" "}
          {t("raqamga faollashtirish havolasi va kodi yuboriladi:")}
        </p>
        <div className="max-h-52 overflow-y-auto rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-1.5 text-v2-small">
          {targets.list.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-3 py-1">
              <span className="truncate text-v2-text">{x.name || `#${x.id}`}</span>
              <span className="shrink-0 tabular-nums text-v2-text-2">{formatPhoneDisplay(x.phone)}</span>
            </div>
          ))}
        </div>

        {targets.skipped > 0 && (
          <p className="flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
            <span>{t("Yana {n} ta tanlangan xodim ro'yxatga kirmadi — hisobi allaqachon faollashgan yoki telefon raqami yo'q.", { n: targets.skipped })}</span>
          </p>
        )}
        {n > maxBatch && (
          <p className="flex items-start gap-2 rounded-v2-md bg-v2-danger-bg px-3 py-2 text-v2-small text-v2-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-danger" strokeWidth={1.75} aria-hidden />
            <span>{t("Bir marta {maxBatch} tagacha — belgilanganini kamaytiring", { maxBatch })}</span>
          </p>
        )}

        <div className="space-y-1.5 rounded-v2-md border border-v2-border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-v2-body font-medium text-v2-text">{t("Ikki bosqichli tasdiqlash")}</span>
            <Switch on={twoFactor} onChange={setTwoFactor} label={t("Ikki bosqichli tasdiqlash")} disabled={sending} />
          </div>
          <p className="text-v2-small text-v2-text-2">
            {twoFactor
              ? t("Xodim havoladan o'tib parol qo'yadi, lekin TIZIMGA KIRA OLMAYDI — ruxsat kutib turadi. Siz shu jadvaldan ✓ bosganingizdan keyin kiradi.")
              : t("Xodim parol qo'ygan zahoti tizimga kiraveradi.")}
          </p>
        </div>

        <p className="text-v2-caption text-v2-text-3">{t("SMS haqiqatan yuboriladi. Bitta raqamga soatiga 5 tadan ko'p kod ketmaydi.")}</p>
      </div>
    </V2Dialog>
  );
}
