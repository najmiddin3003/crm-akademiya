"use client";

import { useMemo, useState, type RefObject } from "react";
import { Check, Coins, Loader2, Minus, Plus, Settings2, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { fieldCls } from "@/components/v2/form/fields";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { signed, type GamRow, type GamView, type OpRes } from "./groupDetailBits";

// YANGI VERSIYA — «TANGA BERISH» (rasm «Guruh · Tanga berish», 24.10.2026): «+ Tanga»
// tugmasi ostidan ochiladi. Ro'yxat — gamifikatsiya sozlamalaridan: «Darsda faol
// qatnashdi» (faollik), «Uy vazifasini bajardi / bajarilmadi» (tizim sabablari, miqdori
// sozlamada), qo'shimcha sabablar (Sozlamalar → Tanga sabablari, rolga ruxsatlilari);
// «Yoki boshqa miqdor» — tanlangan sabab oralig'ida; izoh — faqat qo'shimcha sababda
// (ayiriladiganida majburiy, server qoidasi). Hamma tekshiruv serverda
// (lib/gamification/lesson.ts) — xato matni toastda.

interface Item {
  key: string;
  label: string;
  sign: 1 | -1;
  min: number;
  max: number;
  def: number;
  kind: "activity" | "homework_done" | "homework_missed" | "reason";
  reasonId?: number;
  note: "none" | "optional" | "required";
  off?: string;
}

export interface CoinDone {
  res: OpRes;
  label: string;
  amount: number;
}

export default function CoinPanel({
  anchorRef,
  view,
  row,
  name,
  groupId,
  absent,
  onClose,
  onDone,
  onError,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  view: GamView;
  row: GamRow | null;
  name: string;
  groupId: number;
  /** Darsda yo'q (kelmadi / sababli) — faqat beriladigan qo'shimcha sabablar. */
  absent: boolean;
  onClose: () => void;
  onDone: (d: CoinDone) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useT();
  const canRules = useCanOpen("/settings-gamification");
  const s = view.settings;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const teach = view.canTeach && !absent;
    const reasons = view.reasons.filter((r) => !absent || r.direction > 0);
    const reasonItem = (r: (typeof view.reasons)[number]): Item => {
      const used = row?.reasonUse?.[r.id] ?? 0;
      return {
        key: `r${r.id}`,
        label: r.name,
        sign: r.direction,
        min: Math.max(1, r.amountMin),
        max: Math.max(r.amountMin, r.amountMax),
        def: Math.max(1, r.amountMin),
        kind: "reason",
        reasonId: r.id,
        note: r.noteRequired ? "required" : "optional",
        off: r.perDayLimit > 0 && used >= r.perDayLimit ? t("bugungi limit tugagan") : undefined,
      };
    };
    if (teach && view.sys.activity) {
      const max = Math.max(1, s.activityMaxPerClick);
      const left = s.activityGroupLimitPerLesson - view.activityUsed;
      out.push({
        key: "activity",
        label: t("Darsda faol qatnashdi"),
        sign: 1,
        min: 1,
        max,
        def: Math.min(2, max),
        kind: "activity",
        note: "none",
        off: left <= 0 ? t("guruh limiti tugagan") : undefined,
      });
    }
    if (teach && view.sys.homework_done && s.homeworkDoneCoins > 0) {
      out.push({
        key: "hw_done",
        label: t("Uy vazifasini bajardi"),
        sign: 1,
        min: s.homeworkDoneCoins,
        max: s.homeworkDoneCoins,
        def: s.homeworkDoneCoins,
        kind: "homework_done",
        note: "none",
        off: row?.homework?.value === "done" ? t("berilgan") : row?.homework?.lockShort ? row.homework.lockShort : undefined,
      });
    }
    for (const r of reasons) if (r.direction > 0) out.push(reasonItem(r));
    if (teach && view.sys.homework_missed && s.homeworkMissedPenalty > 0) {
      out.push({
        key: "hw_missed",
        label: t("Uy vazifasi bajarilmadi"),
        sign: -1,
        min: s.homeworkMissedPenalty,
        max: s.homeworkMissedPenalty,
        def: s.homeworkMissedPenalty,
        kind: "homework_missed",
        note: "none",
        off: row?.homework?.value === "missed" ? t("belgilangan") : row?.homework?.lockShort ? row.homework.lockShort : undefined,
      });
    }
    for (const r of reasons) if (r.direction < 0) out.push(reasonItem(r));
    return out;
  }, [view, row, absent, s, t]);

  const firstOn = items.find((x) => !x.off)?.key ?? null;
  const [picked, setPicked] = useState<string | null>(firstOn);
  const [custom, setCustom] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteErr, setNoteErr] = useState(false);
  const item = items.find((x) => x.key === picked) ?? null;
  const fixed = !item || item.min === item.max;
  const eff = !item ? 0 : custom > 0 ? Math.min(item.max, Math.max(item.min, custom)) : item.def;
  const value = item ? item.sign * eff : 0;
  // Stepper sukut miqdordan boshlab yuradi (0 — sukut, rasmdagidek).
  const canInc = !fixed && !!item && eff < item.max;
  const canDec = !fixed && !!item && eff > item.min;

  function pick(key: string) {
    setPicked(key);
    setCustom(0);
    setNoteErr(false);
  }

  async function give() {
    if (!item || busy) return;
    if (item.note === "required" && !note.trim()) {
      setNoteErr(true);
      return;
    }
    setBusy(true);
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(async (r) => (await r.json().catch(() => null)) as ({ ok: true } & OpRes) | { ok: false; error?: string } | null)
        .catch(() => null);
    const res =
      item.kind === "activity"
        ? await post("/api/gamification/activity", { groupId, pupilId: row?.pupilId, coins: eff })
        : item.kind === "reason"
          ? await post("/api/gamification/transactions", { pupilId: row?.pupilId, groupId, reasonId: item.reasonId, amount: eff, note: note.trim(), from: "lesson" })
          : await post("/api/gamification/homework", { groupId, pupilId: row?.pupilId, value: item.kind === "homework_done" ? "done" : "missed" });
    setBusy(false);
    if (!res || !res.ok) {
      onError(t((res && "error" in res && res.error) || "Tanga yozilmadi"));
      return;
    }
    onDone({ res, label: item.label, amount: res.amount || value });
  }

  return (
    <FloatingPanel open anchorRef={anchorRef} onClose={onClose} align="end" width={320} maxHeight={560} role="dialog" ariaLabel={t("Tanga berish")}>
      <div data-ui="v2" className="font-v2 text-v2-text">
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3.5">
          <div className="min-w-0">
            <div className="text-v2-body font-semibold text-v2-text">{t("Tanga berish")}</div>
            <div className="truncate text-v2-caption text-v2-text-2">
              {name} · {t("hozir {n} tanga", { n: row?.balance ?? 0 })}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Yopish")} className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text">
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-4 pb-4 text-v2-small text-v2-text-2">
            {absent ? t("Darsda yo'q o'quvchidan tanga ayirilmaydi, beriladigan sabab esa sizga ruxsat etilmagan") : t("Sizning rolingiz uchun faol sabab yo'q (Sozlamalar → Tanga sabablari)")}
          </p>
        ) : (
          <>
            <div role="radiogroup" aria-label={t("Sabab")} className="space-y-1 px-2">
              {items.map((x) => {
                const on = x.key === picked;
                return (
                  <button
                    key={x.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!!x.off}
                    title={x.off ?? (x.min !== x.max ? t("{min}–{max} oralig'ida", { min: x.min, max: x.max }) : undefined)}
                    onClick={() => pick(x.key)}
                    className={`flex w-full items-center gap-2 rounded-v2-md border px-2.5 py-2 text-left text-v2-small transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      on ? "border-v2-brand bg-v2-brand-bg text-v2-text" : "border-transparent hover:bg-v2-surface-2"
                    }`}
                  >
                    <span className={`min-w-0 flex-1 truncate ${on ? "font-semibold" : "font-medium"}`}>{x.label}</span>
                    {x.off && <span className="shrink-0 text-v2-caption text-v2-text-3">{x.off}</span>}
                    <span
                      className={`shrink-0 rounded-v2-full px-1.5 py-px text-v2-caption font-semibold tabular-nums ${
                        x.sign > 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"
                      }`}
                    >
                      {signed(x.sign * x.def)}
                    </span>
                    {on && <Check className="size-4 shrink-0 text-v2-brand-text" strokeWidth={2.25} aria-hidden />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 space-y-2.5 border-t border-v2-border px-4 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-v2-small text-v2-text-2">{t("Yoki boshqa miqdor")}</span>
                <div className={`inline-flex h-8 items-center rounded-v2-md border border-v2-border-strong ${fixed ? "opacity-50" : ""}`}>
                  <button
                    type="button"
                    disabled={!canDec}
                    onClick={() => item && setCustom(Math.max(item.min, eff - 1))}
                    aria-label={t("Kamaytirish")}
                    className="inline-flex size-8 items-center justify-center text-v2-text-2 hover:text-v2-text disabled:cursor-not-allowed"
                  >
                    <Minus className="size-3.5" strokeWidth={2} />
                  </button>
                  <span className="min-w-[2rem] text-center text-v2-small font-semibold tabular-nums" aria-live="polite">
                    {custom}
                  </span>
                  <button
                    type="button"
                    disabled={!canInc}
                    onClick={() => item && setCustom(Math.min(item.max, eff + 1))}
                    aria-label={t("Oshirish")}
                    className="inline-flex size-8 items-center justify-center text-v2-text-2 hover:text-v2-text disabled:cursor-not-allowed"
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              {item && item.note !== "none" && (
                <div>
                  <input
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      if (noteErr) setNoteErr(false);
                    }}
                    maxLength={300}
                    placeholder={item.note === "required" ? t("Izoh (majburiy)") : t("Izoh (ixtiyoriy)")}
                    aria-invalid={noteErr}
                    className={fieldCls(noteErr ? "error" : "default", "", "sm")}
                  />
                  {noteErr && <p className="mt-1 text-v2-caption text-v2-danger">{t("Tanga ayirilganda izoh yozish majburiy")}</p>}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-v2-border bg-v2-surface-2 px-3 py-2.5">
              {canRules ? (
                <Link href="/settings-gamification" className="inline-flex items-center gap-1 text-v2-caption text-v2-text-2 hover:text-v2-text hover:underline underline-offset-2">
                  <Settings2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {t("Qoidalar Sozlamalarda")}
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => void give()}
                disabled={!item || busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-v2-md bg-v2-brand px-3 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Coins className="size-4" strokeWidth={1.75} aria-hidden />}
                {value < 0 ? t("{n} tanga ayirish", { n: signed(value) }) : t("{n} tanga berish", { n: signed(value) })}
              </button>
            </div>
          </>
        )}
      </div>
    </FloatingPanel>
  );
}
