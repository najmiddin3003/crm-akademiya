"use client";

import { useState } from "react";
import { Info, Minus, Plus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { gamApi } from "@/components/gamification/api";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { isAbsent, type GamReason, type LessonRowV2, type OpRes } from "./lessonTypes";

// «SABAB BO'YICHA TANGA» (33-qism, rasmlar «Tanga berish · Sabab bo'yicha tanga» va telefonda
// «Sabab bo'yicha tanga (ustoz)»): balans va bugungi qo'lda ayirish, «+ Berish / − Ayirish»,
// sabablar ro'yxati (Sozlamalar → Tanga sabablari, rolga ruxsatlilari), oraliqli sababda miqdor,
// izoh, oqibat qatori. Telefonda V2Dialog o'zi pastdan chiqadi. Hamma qoida serverda ham
// tekshiriladi (POST /api/gamification/transactions → lib/gamification/lesson.ts → giveByReason).

export interface ReasonDoneV2 {
  res: OpRes;
  reason: GamReason;
  amount: number;
}

const rangeLabel = (r: GamReason) => {
  const s = r.direction > 0 ? "+" : "−";
  return r.amountMin === r.amountMax ? `${s}${r.amountMin}` : `${s}${r.amountMin}…${s}${r.amountMax}`;
};

export default function ReasonDialogV2({
  row,
  reasons,
  groupId,
  groupLabel,
  dailyLimit,
  onClose,
  onDone,
}: {
  row: LessonRowV2;
  reasons: GamReason[];
  groupId: number;
  groupLabel: string;
  dailyLimit: number;
  onClose: () => void;
  onDone: (d: ReasonDoneV2) => void;
}) {
  const { t } = useT();
  const absent = isAbsent(row.att);
  const [dir, setDir] = useState<"1" | "-1">("1");
  const list = reasons.filter((r) => String(r.direction) === dir);
  const [pick, setPick] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const left = Math.max(0, dailyLimit - row.deducted);
  const usedOf = (r: GamReason) => row.reasonUse?.[r.id] ?? 0;
  const denial = (r: GamReason): string | null => {
    if (r.perDayLimit > 0 && usedOf(r) >= r.perDayLimit) return t("Bugun {n} marta ishlatilgan — limit", { n: usedOf(r) });
    if (r.direction < 0 && absent) return t("Darsda yo'q o'quvchidan tanga ayirilmaydi");
    if (r.direction < 0 && left < r.amountMin) return t("Bugungi ayirish limiti tugagan ({used}/{limit})", { used: row.deducted, limit: dailyLimit });
    return null;
  };
  const sel = list.find((r) => r.id === pick) ?? null;
  const hi = sel ? (sel.direction < 0 ? Math.min(sel.amountMax, left) : sel.amountMax) : 0;
  const value = sel ? Math.min(hi, Math.max(sel.amountMin, amount ?? sel.amountMin)) : 0;
  const ranged = !!sel && sel.amountMin !== sel.amountMax;

  function choose(r: GamReason) {
    if (denial(r)) return;
    setPick(r.id);
    setAmount(r.amountMin);
    setError("");
  }

  async function save(close: () => void) {
    if (!sel || saving) return;
    if (sel.noteRequired && !note.trim()) {
      setError(t("Izoh yozish majburiy"));
      return;
    }
    setSaving(true);
    const res = await gamApi<OpRes>("/api/gamification/transactions", {
      method: "POST",
      body: { pupilId: row.pupilId, groupId, reasonId: sel.id, amount: value, note: note.trim(), from: "lesson" },
    });
    setSaving(false);
    if (!res.ok) {
      setError(t(res.error));
      return;
    }
    onDone({ res, reason: sel, amount: sel.direction * value });
    close();
  }

  const after = sel ? Math.max(0, row.balance + sel.direction * value) : row.balance;
  const verb = dir === "1" ? t("{n} tanga berish", { n: value || "" }) : t("{n} tanga ayirish", { n: value || "" });

  return (
    <V2Dialog
      title={t("Sabab bo'yicha tanga")}
      subtitle={`${row.name} · ${groupLabel} · ${t("bugungi dars")}`}
      onClose={onClose}
      saving={saving}
      dirty={!!sel || !!note}
      width={560}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={`${secondaryBtn} max-sm:hidden`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={!sel || saving} className={`${primaryBtn} max-sm:flex-1 max-sm:justify-center disabled:opacity-50`}>
            {sel ? verb : t("Sababni tanlang")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-4 py-3">
            <span className="block text-v2-small text-v2-text-2">{t("Balans")}</span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[22px] font-semibold tabular-nums text-v2-text">
              <span className="size-3 rounded-full bg-v2-warning" aria-hidden />
              {row.balance}
            </span>
          </div>
          <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-4 py-3">
            <span className="block text-v2-small text-v2-text-2">{t("Bugun qo'lda ayirildi")}</span>
            <span className="mt-1 block text-v2-body text-v2-text-2">
              <b className="text-[22px] font-semibold tabular-nums text-v2-text">{row.deducted}</b> / {dailyLimit} {t("tanga")}
            </span>
          </div>
        </div>

        <Segmented
          label={t("Yo'nalish")}
          size="lg"
          value={dir}
          onChange={(v) => {
            setDir(v as "1" | "-1");
            setPick(null);
            setError("");
          }}
          options={[
            { value: "1", label: `+ ${t("Berish")}` },
            { value: "-1", label: `− ${t("Ayirish")}`, disabled: absent, title: absent ? t("Darsda yo'q o'quvchidan tanga ayirilmaydi") : undefined },
          ]}
        />

        <div>
          <span className="mb-2 block text-v2-small font-semibold text-v2-text">{t("Sabab")}</span>
          {list.length === 0 ? (
            <p className="rounded-v2-md border border-dashed border-v2-border px-3 py-4 text-center text-v2-small text-v2-text-3">
              {t("Sizga ruxsat etilgan sabab yo'q — Sozlamalar → Tanga sabablari")}
            </p>
          ) : (
            <div role="radiogroup" aria-label={t("Sabab")} className="space-y-2">
              {list.map((r) => {
                const on = r.id === pick;
                const deny = denial(r);
                const hints = [
                  r.perDayLimit > 0 ? t("kuniga {n} marta", { n: r.perDayLimit }) : "",
                  r.amountMin !== r.amountMax ? t("miqdorni o'zingiz tanlaysiz") : "",
                  r.noteRequired ? t("izoh majburiy") : "",
                ].filter(Boolean);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!!deny}
                    title={deny ?? undefined}
                    onClick={() => choose(r)}
                    className={`flex w-full items-center gap-3 rounded-v2-md border px-4 py-3 text-left transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
                      on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface hover:bg-v2-hover"
                    }`}
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-v2-brand" : "border-v2-border-strong"}`} aria-hidden>
                      {on && <span className="size-2.5 rounded-full bg-v2-brand" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-v2-text">{t(r.name)}</span>
                      {(deny || hints.length > 0) && (
                        <span className={`block text-v2-small ${deny ? "text-v2-warning" : "text-v2-text-2"}`}>{deny ?? hints.join(" · ")}</span>
                      )}
                    </span>
                    <b className={`shrink-0 font-semibold tabular-nums ${r.direction > 0 ? "text-v2-success" : "text-v2-danger"}`}>{rangeLabel(r)}</b>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {ranged && sel && (
          <Field label={t("Miqdor")} hint={t("{min}–{max} tanga", { min: sel.amountMin, max: hi })}>
            <div className="inline-flex items-center rounded-v2-md border border-v2-border-strong">
              <button type="button" onClick={() => setAmount(Math.max(sel.amountMin, value - 1))} disabled={value <= sel.amountMin} aria-label={t("Kamaytirish")} className="inline-flex size-10 items-center justify-center text-v2-text-2 hover:text-v2-text disabled:opacity-40">
                <Minus className="size-4" />
              </button>
              <input
                value={value}
                inputMode="numeric"
                aria-label={t("Miqdor")}
                onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || sel.amountMin)}
                className="w-14 bg-transparent text-center text-v2-body font-semibold tabular-nums text-v2-text outline-none"
              />
              <button type="button" onClick={() => setAmount(Math.min(hi, value + 1))} disabled={value >= hi} aria-label={t("Ko'paytirish")} className="inline-flex size-10 items-center justify-center text-v2-text-2 hover:text-v2-text disabled:opacity-40">
                <Plus className="size-4" />
              </button>
            </div>
          </Field>
        )}

        <Field label={t("Izoh")} optional={!sel?.noteRequired} error={error || undefined}>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError("");
            }}
            rows={2}
            placeholder={sel?.noteRequired ? t("Nima bo'lganini qisqa yozing") : t("Ixtiyoriy")}
            className={fieldCls(error ? "error" : "default", "h-auto! py-2 leading-5")}
          />
        </Field>

        {sel && (
          <div className="flex gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
            <span>
              {sel.direction < 0
                ? t("Balans {from} → {to}, bugungi ayirish {d} / {limit} bo'ladi. Daraja tushmaydi.", {
                    from: row.balance,
                    to: after,
                    d: row.deducted + value,
                    limit: dailyLimit,
                  })
                : t("Balans {from} → {to}.", { from: row.balance, to: after })}{" "}
              {t("O'quvchi kabinetidagi tanga tarixida sababi bilan ko'rinadi.")}
            </span>
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
