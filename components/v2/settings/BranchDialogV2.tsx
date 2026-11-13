"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock, Info, LocateFixed, MapPin } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { invalidateBranches } from "@/hooks/useBranches";
import { useModalClose } from "@/components/ui/Modal";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, FieldLabel, PhoneField, TextInput, fieldCls, formatLocalPhone } from "@/components/v2/form/fields";
import V2TimeField, { finishTime, isTime, maskTime } from "@/components/v2/form/V2TimeField";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import {
  BRANCH_HOURS_DEFAULT,
  WEEKDAY_SHORT,
  branchAddressLine,
  branchPhoneDigits,
  type ManagementBranch,
} from "@/lib/managementBranches";

// YANGI VERSIYA — «FILIAL QO'SHISH» / «FILIALNI TAHRIRLASH» OYNASI (23-qism, rasm
// «Sozlamalar · Filial qo'shish», yorug'/qorong'i, 13.11.2026).
//
// Rasmdagi maydonlar: Filial nomi + Kod, Manzil (mo'ljal bilan), Telefon, Ish vaqti,
// Ish kunlari, pastda ma'lumot qutisi. KOD — filial `id` si: u butun tizimda
// (guruh, o'quvchi, kassa, xodim) bog'lovchi kalit, shuning uchun faqat ko'rsatiladi,
// o'zgartirilmaydi (design/v2/SAVOLLAR.md).
//
// Rasmda yo'q, lekin tizimda ISHLAYOTGAN sozlamalar (Telegram topiklari, xodimlar
// ish boshlanishi va kechikish, «Ishga keldim» joylashuvi) yo'qolmasin — pastda
// yig'iq «Telegram, davomat va joylashuv» bo'limida (eski formadagi maydonlar va
// izohlar bilan bir xil).

interface FormState {
  name: string;
  address: string;
  phone: string; // 9 raqam
  from: string;
  to: string;
  days: number[];
  leadTopic: string;
  paymentTopic: string;
  attendanceTopic: string;
  workStart: string;
  lateGrace: string;
  geo: string;
  radius: string;
}

function initialForm(b: ManagementBranch | null): FormState {
  return {
    name: b?.name ?? "",
    address: b ? branchAddressLine(b) : "",
    phone: branchPhoneDigits(b?.phone),
    from: b?.openFrom ?? (b ? "" : BRANCH_HOURS_DEFAULT.from),
    to: b?.openTo ?? (b ? "" : BRANCH_HOURS_DEFAULT.to),
    days: b?.workDays?.length ? [...b.workDays] : [...BRANCH_HOURS_DEFAULT.days],
    leadTopic: b?.leadTopicId ? String(b.leadTopicId) : "",
    paymentTopic: b?.paymentTopicId ? String(b.paymentTopicId) : "",
    attendanceTopic: b?.attendanceTopicId ? String(b.attendanceTopicId) : "",
    workStart: b?.workStart ?? "",
    lateGrace: b?.lateGraceMin ? String(b.lateGraceMin) : "",
    geo: b?.geo ? `${b.geo.lat.toFixed(6)}, ${b.geo.lng.toFixed(6)}` : "",
    radius: b?.geoRadiusM ? String(b.geoRadiusM) : "",
  };
}

/** Rasmdagi bitta katak: «🕐 08:00 – 22:00» (ikki vaqt bitta maydonda). */
function TimeRangeField({ from, to, onChange, invalid }: { from: string; to: string; onChange: (from: string, to: string) => void; invalid: boolean }) {
  const { t } = useT();
  const part = "w-[3.25rem] min-w-0 bg-transparent! text-v2-body tabular-nums text-v2-text placeholder:text-v2-text-3 focus:outline-none";
  return (
    <div className={`${fieldCls(invalid ? "error" : "default", "flex items-center gap-1.5 pl-3 focus-within:border-v2-brand focus-within:shadow-v2-focus")}`}>
      <Clock className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder="08:00"
        aria-label={t("Ish boshlanishi")}
        value={from}
        onChange={(e) => onChange(maskTime(e.target.value), to)}
        onBlur={() => onChange(finishTime(from), to)}
        className={part}
      />
      <span className="text-v2-text-3">–</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder="22:00"
        aria-label={t("Ish tugashi")}
        value={to}
        onChange={(e) => onChange(from, maskTime(e.target.value))}
        onBlur={() => onChange(from, finishTime(to))}
        className={part}
      />
    </div>
  );
}

export default function BranchDialogV2({
  branch,
  nextId,
  onClose,
  onSaved,
}: {
  /** `null` — yangi filial. */
  branch: ManagementBranch | null;
  /** Yangi filialning raqami (Kod) — server `max(id) + 1` beradi. */
  nextId: number;
  onClose: () => void;
  onSaved: (b: ManagementBranch, created: boolean) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const editing = branch !== null;
  const modal = useModalClose(onClose);
  const [init] = useState(() => initialForm(branch));
  const [f, setF] = useState<FormState>(init);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(init);

  const nameErr = tried && !f.name.trim() ? t("Filial nomini kiriting") : null;
  const phoneErr = tried && f.phone.length > 0 && f.phone.length < 9 ? t("Telefon 9 raqam bo'lsin") : null;
  const hoursBad =
    (f.from || f.to) && (!isTime(f.from) || !isTime(f.to) || f.to <= f.from) ? t("Ish vaqti: masalan 08:00 – 22:00, tugashi boshlanishidan keyin") : null;
  const hoursErr = tried ? hoursBad : null;
  const daysErr = tried && f.days.length === 0 ? t("Kamida bitta ish kunini tanlang") : null;

  function toggleDay(d: number) {
    set("days", f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort((a, b) => a - b));
  }

  function takeMyLocation() {
    if (!navigator.geolocation) {
      showError(t("Bu brauzer joylashuvni bera olmaydi"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        set("geo", `${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`);
        showSuccess(t("Joylashuv olindi (±{m} m)", { m: Math.round(p.coords.accuracy) }));
      },
      () => {
        setLocating(false);
        showError(t("Joylashuv olinmadi — brauzerga ruxsat bering"));
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function submit() {
    setTried(true);
    setServerErr(null);
    if (!f.name.trim() || (f.phone.length > 0 && f.phone.length < 9) || hoursBad || f.days.length === 0) return;
    setSaving(true);
    try {
      const address = f.address.trim();
      const body: Record<string, unknown> = {
        name: f.name.trim(),
        address,
        phone: f.phone ? `+998 ${formatLocalPhone(f.phone)}` : "",
        openFrom: f.from,
        openTo: f.to,
        workDays: f.days,
        leadTopicId: f.leadTopic.trim(),
        paymentTopicId: f.paymentTopic.trim(),
        attendanceTopicId: f.attendanceTopic.trim(),
        workStart: f.workStart,
        lateGraceMin: f.lateGrace.trim(),
        geo: f.geo.trim(),
        geoRadiusM: f.radius.trim(),
      };
      // Yangi filialda hudud (`location`) — manzilning birinchi bo'lagi («Uchqo'rg'on»):
      // u qisqa ko'rinishlarda (ariza filial ro'yxati) ishlatiladi. Tahrirda eski hudud
      // o'zgarmaydi — manzil to'liq `address` ga yoziladi.
      if (!editing) body.location = address.split(",")[0].trim();
      const res = await fetch(editing ? `/api/branches/${branch.id}` : "/api/branches", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) {
        setServerErr(t(d?.error || "Saqlanmadi"));
        return;
      }
      invalidateBranches();
      showSuccess(editing ? t("Filial yangilandi") : t("Filial qo'shildi"));
      onSaved(d.branch as ManagementBranch, !editing);
      modal.close();
    } catch {
      setServerErr(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  const code = editing ? branch.id : nextId;
  const moreCount = [f.leadTopic, f.paymentTopic, f.attendanceTopic, f.workStart, f.geo].filter((x) => x.trim()).length;

  return (
    <V2Dialog
      title={editing ? t("Filialni tahrirlash") : t("Filial qo'shish")}
      subtitle={editing ? t("{n}-filial", { n: code }) : t("{n}-filial — barcha bo'limlardagi filial tanlashga qo'shiladi", { n: code })}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      width={600}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {editing ? t("Saqlash") : t("Filial qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
          <Field label={t("Filial nomi")} htmlFor="br-name" error={nameErr}>
            <TextInput
              id="br-name"
              data-autofocus
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("Masalan: Akademiya 5 Chust")}
              state={nameErr ? "error" : "default"}
            />
          </Field>
          <Field label={t("Kod")} htmlFor="br-code">
            <TextInput id="br-code" value={String(code)} readOnly tabIndex={-1} title={t("Filial raqami — tizim o'zi beradi, o'zgarmaydi")} className="cursor-default bg-v2-surface-2! text-v2-text-2 tabular-nums" />
          </Field>
        </div>

        <Field label={t("Manzil")} htmlFor="br-addr" hint={t("Mo'ljal bilan yozing — chek va ariza sahifasida shunday chiqadi.")}>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            <TextInput id="br-addr" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder={t("Masalan: Chortoq, Temur kafe 2-qavat")} className="pl-9" />
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("Telefon")} htmlFor="br-phone" error={phoneErr}>
            <PhoneField id="br-phone" value={f.phone} onChange={(v) => set("phone", v)} state={phoneErr ? "error" : "default"} />
          </Field>
          <Field label={t("Ish vaqti")} error={hoursErr}>
            <TimeRangeField from={f.from} to={f.to} invalid={!!hoursErr} onChange={(from, to) => setF((p) => ({ ...p, from, to }))} />
          </Field>
        </div>

        <div>
          <FieldLabel>{t("Ish kunlari")}</FieldLabel>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Ish kunlari")}>
            {WEEKDAY_SHORT.map((label, i) => {
              const d = i + 1;
              const on = f.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={`inline-flex h-8 min-w-11 items-center justify-center gap-1 rounded-v2-full border px-3 text-v2-small transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                    on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
                  }`}
                >
                  {on && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
                  {t(label)}
                </button>
              );
            })}
          </div>
          {daysErr && <p className="mt-1.5 text-v2-caption text-v2-danger">{daysErr}</p>}
        </div>

        {!editing && (
          <div className="flex items-start gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
            <span>{t("Xonalar, xodimlar, kassa va guruhlarni keyin qo'shasiz — shungacha filial ro'yxatda «0 guruh · 0 xona» bo'lib turadi.")}</span>
          </div>
        )}

        {/* Rasmda yo'q, tizimda ishlaydigan sozlamalar — yig'iq */}
        <section className="rounded-v2-md border border-v2-border">
          <button
            type="button"
            onClick={() => setMore((o) => !o)}
            aria-expanded={more}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:shadow-v2-focus focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-v2-body font-medium text-v2-text">{t("Telegram, davomat va joylashuv")}</span>
              <span className="block text-v2-caption text-v2-text-2">
                {moreCount > 0 ? t("{n} ta sozlama kiritilgan", { n: moreCount }) : t("Topiklar, xodimlar ish boshlanishi, «Ishga keldim» joylashuvi")}
              </span>
            </span>
            <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${more ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
          </button>
          {more && (
            <div className="space-y-4 border-t border-v2-border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={t("Lid topigi")} htmlFor="br-lt">
                  <TextInput id="br-lt" value={f.leadTopic} onChange={(e) => set("leadTopic", e.target.value)} placeholder="45" />
                </Field>
                <Field label={t("To'lov topigi")} htmlFor="br-pt">
                  <TextInput id="br-pt" value={f.paymentTopic} onChange={(e) => set("paymentTopic", e.target.value)} placeholder="3" />
                </Field>
                <Field label={t("Davomat topigi")} htmlFor="br-at">
                  <TextInput id="br-at" value={f.attendanceTopic} onChange={(e) => set("attendanceTopic", e.target.value)} placeholder="7" />
                </Field>
              </div>
              <p className="-mt-2 text-v2-caption text-v2-text-3">
                {t("Raqam yoki Telegram'dagi topik havolasi (xabarga o'ng tugma → «Copy Link»). Bo'sh — umumiy topik.")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("Xodimlar ish boshlanishi")} htmlFor="br-ws" hint={t("O'qituvchi bo'lmagan, o'z ish vaqti kiritilmagan xodimning kechikishi shundan.")}>
                  <V2TimeField id="br-ws" value={f.workStart} onChange={(v) => set("workStart", v)} placeholder="08:30" />
                </Field>
                <Field label={t("Ruxsat etilgan kechikish, daqiqa")} htmlFor="br-lg">
                  <TextInput id="br-lg" inputMode="numeric" value={f.lateGrace} onChange={(e) => set("lateGrace", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="0" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <Field label={t("«Ishga keldim» joylashuvi")} htmlFor="br-geo">
                  <TextInput id="br-geo" value={f.geo} onChange={(e) => set("geo", e.target.value)} placeholder="40.98, 71.82" />
                </Field>
                <Field label={t("Radius, m")} htmlFor="br-rad">
                  <TextInput id="br-rad" inputMode="numeric" value={f.radius} onChange={(e) => set("radius", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="200" />
                </Field>
              </div>
              <button type="button" onClick={takeMyLocation} disabled={locating} className={`${secondaryBtn} disabled:opacity-60`}>
                <LocateFixed className="size-4" strokeWidth={1.75} aria-hidden />
                {locating ? t("Aniqlanmoqda...") : t("Hozirgi joylashuvim")}
              </button>
            </div>
          )}
        </section>

        {serverErr && <p className="text-v2-small text-v2-danger">{serverErr}</p>}
      </div>
    </V2Dialog>
  );
}
