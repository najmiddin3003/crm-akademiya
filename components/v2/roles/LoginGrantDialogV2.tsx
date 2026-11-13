"use client";

import { useState } from "react";
import { AlertTriangle, Check, Info, KeyRound, Loader2, Lock, MessageSquare } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { phoneParts } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { chunk, hasSmsPhone, smsParts, type LoginRow } from "./loginsBits";

// YANGI VERSIYA — «LOGIN BERISH» OYNASI (25-qism, rasm «Login berish (3 kishi)», yorug'/qorong'i).
//
// Rasmdan HALOL FARQLAR (design/v2/SAVOLLAR.md 324–331):
//   • SMS matni — Eskiz'da moderatsiyadan o'tgan shablon: faollashtirish HAVOLASI va KOD
//     (lib/invite.ts → activationMessage). Rasmdagi «vaqtinchalik parol» matni shablonda yo'q —
//     Eskiz moderatsiyadan o'tmagan matnni yubormaydi. Namuna serverdan (`smsPreview`).
//   • «Birinchi kirishda parolni almashtirish majburiy» — tizimda parolni xodim o'zi o'rnatadi
//     (havola yoki kod orqali), ya'ni bu shart doim bajariladi — qulfli belgi.
//   • «Kirishga admin tasdig'i kerak» — mavjud ikki bosqichli tasdiq (users.adminApproval,
//     /vaqtinchalik dagi tugmacha bilan bir xil); sukut — tanlanganlarning HAMMASIDA yoqiq bo'lsa.
// Yuborish — POST /api/temp-staff/invite (faqat admin), server partiya chegarasi (`maxBatch`)
// bo'yicha bo'laklab, KETMA-KET. SMS haqiqatan ketadi va pul turadi — shu oyna tasdiq vazifasini
// bajaradi (kimga ketishi ro'yxat bilan ko'rinadi).

interface InviteResult {
  id: number;
  name: string;
  ok: boolean;
  error?: string;
}

export default function LoginGrantDialogV2({
  rows,
  smsPreview,
  maxBatch,
  describe,
  onClose,
  onSent,
}: {
  rows: LoginRow[];
  smsPreview: string;
  maxBatch: number;
  /** «O'qituvchi · Akademiya 1 Chortoq» — rol va filial (tab hisoblaydi). */
  describe: (row: LoginRow) => string;
  onClose: () => void;
  /** Yuborilgandan keyin (natijadan qat'i nazar) — ro'yxatni yangilash va tanlovni tozalash. */
  onSent: (sentIds: number[]) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const [twoFactor, setTwoFactor] = useState(() => rows.length > 0 && rows.every((r) => r.twoFactor));
  const [saving, setSaving] = useState(false);

  const sendable = rows.filter((r) => hasSmsPhone(r.phone));
  const noPhone = rows.length - sendable.length;
  const first = sendable[0] ?? rows[0];

  async function submit() {
    if (saving || sendable.length === 0) return;
    setSaving(true);
    const results: InviteResult[] = [];
    try {
      for (const part of chunk(sendable, maxBatch)) {
        const res = await fetch("/api/temp-staff/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: part.map((r) => r.id), twoFactor }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok) {
          // Butun partiya rad etildi (ruxsat, partiya chegarasi …) — qolganini yubormaymiz.
          for (const r of part) results.push({ id: r.id, name: r.name, ok: false, error: String(d.error || "SMS yuborilmadi") });
          break;
        }
        results.push(...((d.results as InviteResult[]) ?? []));
      }
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
    const sent = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    if (sent.length > 0) showSuccess(t("Login yuborildi: {n} ta", { n: sent.length }));
    if (failed.length > 0) {
      const list = failed
        .slice(0, 3)
        .map((r) => `${r.name} — ${t(r.error || "SMS yuborilmadi")}`)
        .join("; ");
      showError(
        failed.length > 3
          ? t("Yuborilmadi: {list} va yana {n} ta", { list, n: failed.length - 3 })
          : t("Yuborilmadi: {list}", { list }),
      );
    }
    setSaving(false);
    onSent(sent.map((r) => r.id));
    if (results.length > 0) modal.close();
  }

  return (
    <V2Dialog
      title={t("Login berish")}
      subtitle={t("{n} xodim — SMS'da faollashtirish havolasi va kod boradi", { n: rows.length })}
      onClose={onClose}
      controller={modal}
      saving={saving}
      onSubmit={() => void submit()}
      width={540}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving || sendable.length === 0} className={`${primaryBtn} disabled:opacity-60`}>
            {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <KeyRound className="size-4" strokeWidth={2} aria-hidden />}
            {t("Login berish ({n})", { n: sendable.length })}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* Kimga */}
        <ul className="max-h-[15rem] divide-y divide-v2-border overflow-y-auto rounded-v2-md border border-v2-border">
          {rows.map((r) => {
            const phone = phoneParts(r.phone)?.copy ?? "";
            const ok = hasSmsPhone(r.phone);
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                  {initialsOf(r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-body font-semibold text-v2-text">{r.name}</span>
                  <span className="block truncate text-v2-caption text-v2-text-2">{describe(r)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-v2-caption text-v2-text-3">{t("Login")}</span>
                  {ok ? (
                    <span className="block text-v2-small font-semibold tabular-nums text-v2-text">{phone}</span>
                  ) : (
                    <span className="block text-v2-small font-semibold text-v2-warning">{t("telefon yo'q")}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {noPhone > 0 && (
          <div className="flex gap-2.5 rounded-v2-md border border-v2-warning/30 bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
            <span>{t("{n} ta xodimda telefon raqami yo'q — ularga yuborilmaydi. Raqamni xodim kartasida kiriting.", { n: noPhone })}</span>
          </div>
        )}

        {/* SMS namunasi */}
        {first && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-v2-small font-medium text-v2-text-2">
              <MessageSquare className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("SMS · {name}", { name: first.name })}
            </div>
            <p className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2.5 text-v2-small leading-relaxed text-v2-text [overflow-wrap:anywhere]">
              {smsParts(smsPreview).map((p, i) =>
                p.mark ? (
                  <mark key={i} className="rounded-v2-sm bg-v2-warning-bg px-1 font-semibold text-v2-warning">
                    {p.text}
                  </mark>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </p>
            <p className="mt-1 text-v2-caption text-v2-text-3">{t("Havola va kod har bir xodimga alohida; 3 kun amal qiladi.")}</p>
          </div>
        )}

        {/* Shartlar */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-v2-small text-v2-text" title={t("Tizimda parolni xodimning o'zi o'rnatadi — bu doim shunday")}>
            {/* Doim bajariladi — belgilangan va qulfli (o'chiq V2Checkbox belgisini kulrang fonda yo'qotadi). */}
            <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-v2-brand text-white opacity-60" aria-hidden>
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span>{t("Parolni xodim o'zi o'rnatadi (havola yoki kod orqali)")}</span>
            <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={2} aria-hidden />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-v2-small text-v2-text">
            <V2Checkbox checked={twoFactor} onChange={setTwoFactor} disabled={saving} label={t("Kirishga admin tasdig'i kerak (ikki bosqichli)")} className="mt-0.5" />
            <span>
              {t("Kirishga admin tasdig'i kerak (ikki bosqichli)")}
              <span className="block text-v2-caption text-v2-text-3">{t("Parol qo'ygach ham admin «Vaqtinchalik bo'lim» da ✓ bosguncha kira olmaydi")}</span>
            </span>
          </label>
        </div>

        {/* Izoh */}
        <div className="flex gap-2.5 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={2} aria-hidden />
          <span>{t("Har biri o'z roli bilan kiradi. Yuborilgach «Yuborilgan» ro'yxatiga o'tadi; 3 kun ichida kirmasa, havola eskiradi — shu yerdan qayta yuborasiz.")}</span>
        </div>
      </div>
    </V2Dialog>
  );
}
