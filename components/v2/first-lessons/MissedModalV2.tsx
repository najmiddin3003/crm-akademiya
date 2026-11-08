"use client";

import { useState, type KeyboardEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { postHolat } from "@/components/leads/LeadHolatModals";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, fieldCls } from "@/components/v2/form/fields";
import { HOLAT_V2, addDaysIso, phoneParts, startTimeOf, useLeadV2Fmt } from "@/components/v2/leads/leadUtils";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel } from "@/components/v2/ui/groupStatus";
import type { Order } from "@/lib/ordersData";
import { uzDateOf } from "@/lib/staffTasks";
import { lessonDatesOf, type FlRow } from "./firstLessonUtils";

// YANGI VERSIYA — «KELMADI — KEYINGI QADAM» (22-qism, rasm «Kelmadi → keyingi
// qadam oynasi», yorug'/qorong'i): lid birinchi darsga kelmadi — uchta yo'l:
//
//   • «Operator qo'ng'iroq qilsin» (sukut) — lidning mas'uli ertaga 10:00 gacha
//     qo'ng'iroq qiladi; lid ro'yxatda «× Kelmadi · Qo'ng'iroq: ertaga 10:00
//     gacha» bo'lib turadi (PATCH firstLessonStatus=KELMADI + firstLessonFollowUp).
//     Xodim topshirig'i (staff_tasks) YARATILMAYDI — jarima/avtomatika bor
//     (SAVOLLAR 249);
//   • «Yangi sanaga yozish» — guruhning keyingi darsiga (POST /holat sinov);
//   • «Ketdi» — sababi bilan «Rad etdi» ga (POST /holat rad).
//
// Izoh: qo'ng'iroqda — topshiriqning o'zida, «Ketdi» da — rad sababi, yangi
// sanada — lid izohlariga.

export type MissedStep = "call" | "newDate" | "ketdi";

/** "YYYY-MM-DD HH:MM" → «ertaga 10:00» / «12-oktyabr 10:00». */
export function useDueText() {
  const f = useLeadV2Fmt();
  const { t } = useT();
  return (due: string, nowMs: number): string => {
    const [d, time = ""] = due.split(" ");
    const today = uzDateOf(nowMs);
    const day = d === today ? t("bugun") : d === addDaysIso(today, 1) ? t("ertaga") : f.day(d);
    return `${day} ${time}`.trim();
  };
}

export default function MissedModalV2({
  row,
  nowMs,
  initialStep,
  patchOrder,
  addMessage,
  onClose,
  onDone,
  onConflict,
}: {
  row: FlRow;
  nowMs: number;
  initialStep?: MissedStep;
  patchOrder: (id: number, patch: Partial<Order>) => Promise<Order | null>;
  addMessage: (orderId: number, text: string) => Promise<boolean>;
  onClose: () => void;
  /** Saqlandi — yangi nusxa, toast matni va holat o'zgardimi (bekor qilish tugmasi uchun). */
  onDone: (order: Order, message: string, holatChanged: boolean) => void;
  onConflict: () => void;
}) {
  const { t } = useT();
  const f = useLeadV2Fmt();
  const dueText = useDueText();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const o = row.o;
  const g = row.group;
  const tomorrow = addDaysIso(uzDateOf(nowMs), 1);
  const due = `${tomorrow} 10:00`;
  const nextIso = g ? (lessonDatesOf(g, nowMs, 1)[0] ?? null) : null;
  const nextTime = (g && startTimeOf(g.time)) || row.vaqt;

  const [step, setStep] = useState<MissedStep>(initialStep ?? "call");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = note.trim() !== "" || step !== (initialStep ?? "call");

  async function submit() {
    if (busy) return;
    setErr("");
    const izoh = note.trim();
    if (step === "newDate" && (!g || !nextIso || !nextTime)) return setErr(t("Guruhning keyingi darsi topilmadi — lid kartasidan boshqa kunga ko'chiring."));
    setBusy(true);
    if (step === "call") {
      const updated = await patchOrder(o.id, {
        firstLessonStatus: "KELMADI",
        firstLessonFollowUp: { kind: "call", assignee: o.moderator || "", due, ...(izoh ? { note: izoh } : {}) },
      });
      setBusy(false);
      if (!updated) return setErr(t("Saqlab bo'lmadi. Qaytadan urinib ko'ring"));
      onDone(updated, t("Kelmadi — qo'ng'iroq {due} gacha", { due: dueText(due, nowMs) }), false);
      modal.close();
      return;
    }
    const r =
      step === "newDate" && g && nextIso
        ? await postHolat(o.id, { to: "sinov", sinov: { sana: nextIso, vaqt: nextTime, oqituvchi: g.teacher || o.teacher || "", guruhId: g.id } })
        : await postHolat(o.id, { to: "rad", radSabab: izoh || "Birinchi darsga kelmadi" });
    if (!r.ok) {
      setBusy(false);
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    if (step === "newDate" && izoh) await addMessage(o.id, izoh);
    setBusy(false);
    onDone(r.order, step === "newDate" && nextIso ? t("Yangi sanaga yozildi: {day}", { day: f.dayWithWeekday(nextIso) }) : t("Ketdi — «{holat}» ga o'tdi", { holat: t(HOLAT_V2.rad.card) }), true);
    modal.close();
  }

  const phone = phoneParts(o.phone)?.show ?? o.phone;
  const teacher = (g?.teacher || o.teacher || "").trim();
  const options: { key: MissedStep; title: string; badge?: string; desc: string; disabled?: boolean }[] = [
    {
      key: "call",
      title: t("Operator qo'ng'iroq qilsin"),
      badge: t("odatda shu"),
      desc: t("{who} · {due} gacha. Natijasiga qarab yangi sana yoki «ketdi» yoziladi.", {
        who: o.moderator || t("Sizga"),
        due: dueText(due, nowMs),
      }),
    },
    {
      key: "newDate",
      title: t("Yangi sanaga yozish"),
      desc:
        nextIso && nextTime
          ? t("O'zim gaplashdim — keyingi dars: {day} {time}", { day: f.dayWithWeekday(nextIso), time: nextTime })
          : t("Guruh jadvali topilmadi — lid kartasidan boshqa kunga ko'chiring."),
      disabled: !nextIso || !nextTime,
    },
    {
      key: "ketdi",
      title: t("Ketdi"),
      desc: t("Sababi bilan «{holat}» ga o'tadi", { holat: t(HOLAT_V2.rad.card) }),
    },
  ];
  const enabled = options.filter((x) => !x.disabled);
  const move = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = enabled.findIndex((x) => x.key === step);
    const next = enabled[(i + (e.key === "ArrowDown" ? 1 : enabled.length - 1)) % enabled.length];
    if (!next) return;
    setStep(next.key);
    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-step="${next.key}"]`)?.focus();
  };

  return (
    <V2Dialog
      title={t("Kelmadi — keyingi qadam")}
      subtitle={[o.name, phone].filter(Boolean).join(" · ")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={busy}
      width={520}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 rounded-v2-lg border border-v2-border bg-v2-surface-2 px-3.5 py-2.5">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g?.course || o.course)]}`} aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-v2-body font-semibold text-v2-text">{g ? g.course || g.name || `#${g.id}` : o.course || t("Guruh tanlanmagan")}</div>
            <div className="text-v2-small text-v2-text-2">
              {[teacher, g ? roomLabel(g.room) : "", f.day(row.sana), row.tugash ? `${row.vaqt}–${row.tugash}` : row.vaqt].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Keyingi qadam")}</div>
          <div role="radiogroup" aria-label={t("Keyingi qadam")} className="space-y-2">
            {options.map((x) => {
              const on = step === x.key;
              return (
                <button
                  key={x.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-step={x.key}
                  data-autofocus={on ? "" : undefined}
                  tabIndex={on ? 0 : -1}
                  disabled={x.disabled}
                  onClick={() => setStep(x.key)}
                  onKeyDown={move}
                  className={`flex w-full items-start gap-3 rounded-v2-lg border px-3.5 py-3 text-left transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
                    on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface hover:bg-v2-hover"
                  }`}
                >
                  <span className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 bg-v2-surface ${on ? "border-v2-brand" : "border-v2-border-strong"}`} aria-hidden>
                    {on && <span className="size-2 rounded-full bg-v2-brand" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-v2-body font-semibold text-v2-text">{x.title}</span>
                      {x.badge && <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{x.badge}</span>}
                    </span>
                    <span className="mt-0.5 block text-v2-small text-v2-text-2">{x.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label={t("Izoh")} optional htmlFor="fl-missed-note">
          <textarea
            id="fl-missed-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder={t("Masalan: kasal bo'lib qoldi, onasi qo'ng'iroq qiladi")}
            className={`${fieldCls()} h-auto! min-h-[4.5rem] resize-y py-2`}
          />
        </Field>

        {err && (
          <div role="alert" className="rounded-v2-md bg-v2-danger-bg px-3.5 py-2.5 text-v2-small text-v2-danger">
            {err}
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
