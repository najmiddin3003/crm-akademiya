"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, HandCoins, Send } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import { nf, ownerPost, Pill } from "./ownerBits";

// AVANS SO'ROVI — filial tomoni (48-qism, rasm «Qabul admin · avans so'rovi · telefon»). Admin (yoki menejer) xodimni
// tanlaydi: oylik holati (hisoblangan, jarima, olishi mumkin) ko'rinadi, summa va izoh yoziladi → «Rahbarga yuborish».
// Ko'p bo'lsa ham so'rov ketadi — Rahbar hal qiladi. Pastda Rahbar tasdiqlagan so'rovlar: pulni berib «Berdim» —
// shunda kassa chiqimi (avans) yoziladi (lib/advanceRequests.ts → giveAdvance).

interface Desk {
  employees: { id: number; name: string; role: string }[];
  requests: { id: number; employeeName: string; amount: number; approvedAmount: number | null; status: string; decisionNote: string; date: string; time: string }[];
  cashbox: { id: number; name: string; balance: number } | null;
}
interface Salary {
  earned: number;
  bonus: number;
  fine: number;
  taken: number;
  canTake: number;
}

export default function AdvanceRequestDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [emp, setEmp] = useState("");
  const [salary, setSalary] = useState<Salary | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const sum = Number(amount) || 0;
  const over = salary ? sum - salary.canTake : 0;

  useEffect(() => {
    let off = false;
    fetch("/api/owner?view=advance-desk", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then((j) => {
        if (!off && j?.ok) setDesk(j);
      });
    return () => {
      off = true;
    };
  }, [tick]);
  useEffect(() => {
    let off = false;
    if (!emp) return;
    fetch(`/api/owner?view=salary&employeeId=${emp}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then((j) => {
        if (!off) setSalary(j?.ok ? j.salary : null);
      });
    return () => {
      off = true;
    };
  }, [emp]);

  async function send(close: () => void) {
    if (!emp) return showError(t("Xodimni tanlang"));
    if (sum <= 0) return showError(t("Summani kiriting"));
    if (!note.trim()) return showError(t("Izoh yozing — nima uchun kerak"));
    setSaving(true);
    const r = await ownerPost({ action: "advance-create", employeeId: Number(emp), amount: sum, note });
    setSaving(false);
    if (!r.ok) return showError(t(r.error || "Saqlab bo'lmadi"));
    showSuccess(t("So'rov Rahbarga yuborildi"));
    close();
  }
  async function give(id: number) {
    const r = await ownerPost({ action: "advance-give", id, method: "naqd" });
    if (!r.ok) return showError(t(r.error || "Saqlab bo'lmadi"));
    emitMoneyChanged();
    showSuccess(t("Avans berildi — chiqim yozildi"));
    setTick((x) => x + 1);
  }
  const approved = desk?.requests.filter((r) => r.status === "approved") ?? [];
  const recent = desk?.requests.filter((r) => r.status !== "approved").slice(0, 4) ?? [];

  return (
    <V2Dialog
      title={
        <span className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
            <HandCoins className="size-5" strokeWidth={1.75} />
          </span>
          {t("Avans so'rovi")}
        </span>
      }
      subtitle={t("Rahbar tasdiqlaydi")}
      onClose={onClose}
      saving={saving}
      dirty={sum > 0 || Boolean(note)}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void send(api.close)} disabled={saving} className={primaryBtn}>
            <Send className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Rahbarga yuborish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {approved.length ? (
          <div className="rounded-v2-md border border-v2-success bg-v2-success-bg p-3">
            <div className="mb-2 text-v2-small font-semibold text-v2-text">{t("Rahbar tasdiqladi — pulni bering")}</div>
            {approved.map((r) => (
              <div key={r.id} className="flex items-center gap-2 border-t border-v2-border py-2 first:border-t-0">
                <span className="min-w-0 flex-1 text-v2-small text-v2-text">
                  <b>{r.employeeName}</b> · {nf(r.approvedAmount ?? r.amount)}
                </span>
                <button type="button" onClick={() => void give(r.id)} className={`${primaryBtn} h-8`}>
                  <Check className="size-4" strokeWidth={2} aria-hidden />
                  {t("Berdim")}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <Field label={t("Xodim")}>
          <V2Select label={t("Xodim")} value={emp} onChange={setEmp} placeholder={t("Xodimni tanlang")} options={(desk?.employees ?? []).map((e) => ({ value: String(e.id), label: e.name, hint: e.role }))} />
        </Field>
        {salary ? (
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: t("Hisoblangan"), v: nf(salary.earned + salary.bonus) },
              { k: t("Jarima"), v: salary.fine ? `−${nf(salary.fine)}` : "0", tone: salary.fine ? "text-v2-danger" : "" },
              { k: t("Olishi mumkin"), v: nf(salary.canTake) },
            ].map((x) => (
              <div key={x.k} className="rounded-v2-md border border-v2-border px-2.5 py-2">
                <div className="text-v2-caption text-v2-text-3">{x.k}</div>
                <div className={`text-v2-body font-semibold tabular-nums ${x.tone || "text-v2-text"}`}>{x.v}</div>
              </div>
            ))}
          </div>
        ) : null}
        <Field label={t("Summa")}>
          <MoneyField value={amount} onChange={setAmount} />
        </Field>
        {salary && over > 0 ? (
          <p className="flex gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" aria-hidden />
            {t("{n} so'm ko'p — so'rov baribir Rahbarga ketadi, u hal qiladi.", { n: nf(over) })}
          </p>
        ) : null}
        <Field label={t("Izoh")}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldCls("default", "h-auto py-2")} placeholder={t("masalan: oilaviy sabab, oylikdan ushlansin")} />
        </Field>
        <p className="text-v2-caption text-v2-text-3">
          {desk?.cashbox ? t("Tasdiqlansa, pulni o'z kassangizdan berasiz (kassada {n}) va «Berdim»ni bosasiz.", { n: nf(desk.cashbox.balance) }) : t("Tasdiqlansa, pulni o'z kassangizdan berasiz va «Berdim»ni bosasiz.")}
        </p>
        {recent.length ? (
          <div>
            <div className="mb-1 text-v2-caption font-semibold text-v2-text-2">{t("Oxirgi so'rovlar")}</div>
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 py-1 text-v2-small">
                <span className="truncate text-v2-text">{r.employeeName} · {nf(r.approvedAmount ?? r.amount)}</span>
                <Pill tone={r.status === "pending" ? "warning" : r.status === "given" ? "success" : "neutral"}>
                  {r.status === "pending" ? t("kutilmoqda") : r.status === "given" ? t("berildi") : t("rad etildi")}
                </Pill>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </V2Dialog>
  );
}
