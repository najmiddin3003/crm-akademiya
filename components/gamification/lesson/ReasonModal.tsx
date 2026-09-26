"use client";

import { useMemo, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";
import { intIn } from "@/lib/gamification/rules";
import { gamApi } from "../api";
import { btnDanger, btnGhost, btnPrimary, FieldError, inputCls } from "../ui";

// «Sabab bo'yicha tanga» oynasi (TZ 4.9.2–4.9.3, 5.1; prototipdagi
// reasonModal). Forma oynasi — Esc va fon bilan yopilmaydi, faqat «Bekor»
// (TZ 5.0). Tekshiruvlar bajarilmasa «Berish»/«Ayirish» o'chiq turadi;
// server baribir o'zi ham tekshiradi.

export interface ReasonOption {
  id: number;
  name: string;
  direction: 1 | -1;
  amountMin: number;
  amountMax: number;
  perDayLimit: number;
  noteRequired: boolean;
}

export interface ReasonTarget {
  pupilId: number;
  name: string;
  balance: number;
  /** Bugun qo'lda ayirilgan (kunlik limit hisobiga kiradi). */
  deducted: number;
  /** Bugun shu o'quvchida ishlatilgan sabablar: reasonId → marta. */
  reasonUse: Record<number, number>;
  groupId: number;
  groupLabel: string;
  /** Bugungi darsda yo'q — faqat beriladigan sabablar (TZ 4.5.7). */
  absent: boolean;
}

export interface ReasonDone {
  txId: number | null;
  amount: number;
  applied: number;
  reasonName: string;
  direction: 1 | -1;
  levelUp: { name: string } | null;
}

const amtLabel = (r: ReasonOption) => {
  const s = r.direction > 0 ? "+" : "−";
  return r.amountMin === r.amountMax ? `${s}${r.amountMin}` : `${s}${r.amountMin}…${s}${r.amountMax}`;
};

export default function ReasonModal({
  target,
  reasons,
  dailyLimit,
  objectionDays,
  onClose,
  onDone,
}: {
  target: ReasonTarget;
  reasons: ReasonOption[];
  dailyLimit: number;
  objectionDays: number;
  onClose: () => void;
  onDone: (res: ReasonDone) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const list = useMemo(() => (target.absent ? reasons.filter((r) => r.direction > 0) : reasons), [reasons, target.absent]);
  const [reasonId, setReasonId] = useState(String(list[0]?.id ?? ""));
  const r = list.find((x) => String(x.id) === reasonId) ?? list[0];
  const [amount, setAmount] = useState(String(r?.amountMin ?? ""));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; note?: string; server?: string }>({});
  const [busy, setBusy] = useState(false);

  if (!r) return null;
  const hi = r.direction < 0 ? Math.min(r.amountMax, dailyLimit - target.deducted) : r.amountMax;
  const used = target.reasonUse[r.id] ?? 0;
  const blocked =
    r.perDayLimit > 0 && used >= r.perDayLimit
      ? t("Bugun bu sabab bo'yicha limit tugagan ({used}/{limit})", { used, limit: r.perDayLimit })
      : r.direction < 0 && hi < r.amountMin
        ? t("Bugungi ayirish limiti tugagan ({used}/{limit})", { used: target.deducted, limit: dailyLimit })
        : "";
  const info: string[] = [];
  if (r.perDayLimit > 0) info.push(t("Bu sabab bo'yicha bugun: {used} / {limit} marta", { used, limit: r.perDayLimit }));
  if (r.direction < 0) {
    info.push(
      t(
        "Kunlik ayirish: {used} / {limit} ishlatilgan. Balans 0 dan pastga tushmaydi, daraja pasaymaydi; e'tiroz bo'lsa admin {days} kun ichida bekor qiladi",
        { used: target.deducted, limit: dailyLimit, days: objectionDays },
      ),
    );
  }

  const options = list.map((x) => ({
    value: String(x.id),
    label: `${amtLabel(x)} · ${x.name}`,
    group: x.direction > 0 ? t("➕ Tanga beriladi") : t("➖ Tanga ayiriladi"),
  }));

  async function submit() {
    if (blocked || busy) return;
    const errs: typeof errors = {};
    const v = r.amountMin === r.amountMax ? r.amountMin : intIn(amount, r.amountMin, Math.max(r.amountMin, hi));
    if (v === null) errs.amount = t("Miqdor {min}–{max} oralig'ida butun son bo'lsin", { min: r.amountMin, max: Math.max(r.amountMin, hi) });
    if (r.noteRequired && !note.trim()) errs.note = t("Izoh yozish majburiy");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await gamApi<Omit<ReasonDone, "reasonName" | "direction"> & { reasonName: string; direction: 1 | -1 }>(
      "/api/gamification/transactions",
      { method: "POST", body: { pupilId: target.pupilId, groupId: target.groupId, reasonId: r.id, amount: v, note: note.trim(), from: "lesson" } },
    );
    setBusy(false);
    if (!res.ok) {
      setErrors({ server: t(res.error) });
      return;
    }
    onDone(res);
    modal.close();
  }

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Sabab bo'yicha tanga")}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {target.name} · {target.groupLabel} · {t("bugungi dars")} · {t("balans")}: <span className="gm-coin">{target.balance}</span>
        </p>
        {target.absent && (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px]">
            {t("{name} bugun darsda yo'q — faqat tanga beriladigan sabablar ko'rsatildi.", { name: target.name })}
          </div>
        )}
        <div className="mt-4 space-y-3.5">
          <div>
            <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Sabab")}</span>
            <Select
              value={String(r.id)}
              onChange={(v) => {
                const nx = list.find((x) => String(x.id) === v);
                setReasonId(v);
                setAmount(String(nx?.amountMin ?? ""));
                setErrors({});
              }}
              options={options}
              size="md"
            />
          </div>
          <div>
            {r.amountMin === r.amountMax ? (
              <>
                <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Miqdor")}</span>
                <div className={`text-[18px] ${r.direction > 0 ? "gm-pos" : "gm-neg"}`}>
                  {r.direction > 0 ? "+" : "−"}
                  {r.amountMin} {t("tanga")}
                </div>
              </>
            ) : (
              <>
                <label htmlFor="rAmt" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  {t("Miqdor ({min}–{max} oralig'ida)", { min: r.amountMin, max: Math.max(r.amountMin, hi) })}
                </label>
                <input
                  id="rAmt"
                  type="number"
                  inputMode="numeric"
                  min={r.amountMin}
                  max={Math.max(r.amountMin, hi)}
                  step={1}
                  value={amount}
                  aria-invalid={!!errors.amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((x) => ({ ...x, amount: undefined, server: undefined }));
                  }}
                  className={inputCls}
                />
                <FieldError text={errors.amount ?? ""} />
              </>
            )}
          </div>
          <div>
            <label htmlFor="rNote" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              {r.noteRequired ? t("Izoh (majburiy — admin va ota-ona ko'radi)") : t("Izoh (ixtiyoriy)")}
            </label>
            <textarea
              id="rNote"
              rows={2}
              value={note}
              maxLength={500}
              aria-invalid={!!errors.note}
              placeholder={r.direction > 0 ? t("Masalan: tuman olimpiadasi, 2-o'rin") : t("Masalan: darsda ikki marta xalaqit berdi")}
              onChange={(e) => {
                setNote(e.target.value);
                setErrors((x) => ({ ...x, note: undefined, server: undefined }));
              }}
              className={`${inputCls} h-auto py-2`}
            />
            <FieldError text={errors.note ?? ""} />
          </div>
          {blocked ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px]">{blocked}.</div>
          ) : info.length ? (
            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-[12.5px] text-muted-foreground">{info.join(". ")}.</div>
          ) : null}
          <FieldError text={errors.server ?? ""} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={r.direction < 0 ? btnDanger : btnPrimary} onClick={submit} disabled={busy || !!blocked}>
            {busy ? t("Saqlanmoqda…") : r.direction < 0 ? t("Ayirish") : t("Berish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
