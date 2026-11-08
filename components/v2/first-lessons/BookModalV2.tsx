"use client";

import { useMemo, useState } from "react";
import { Bell, Calendar, Check, Info, Loader2, Users } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { postHolat } from "@/components/leads/LeadHolatModals";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import { Chip, Field, FieldError, FieldWarning } from "@/components/v2/form/fields";
import { GroupRadioList } from "@/components/v2/leads/leadBits";
import { dateOfIso, initialsOf, isoOfDate, liveGroupsFor, phoneParts, shortName, splitByCourse, startTimeOf, trialGroupOf, useLeadV2Fmt } from "@/components/v2/leads/leadUtils";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { Group } from "@/lib/groups";
import { holatOf, sinovOf } from "@/lib/leadHolat";
import type { Order } from "@/lib/ordersData";
import { uzDateOf } from "@/lib/staffTasks";
import { isLessonDay, lessonDatesOf, seatsOf, type GroupInfo } from "./firstLessonUtils";

// YANGI VERSIYA — «BIRINCHI DARSGA YOZISH» (22-qism, rasm «Birinchi darsga yozish
// oynasi», yorug'/qorong'i): lid (yangi yoki bog'lanilgan) → guruh (radio
// kartalar: bo'sh o'rin va shu guruhga yozilganlar) → birinchi dars (guruhning
// keyingi uch darsi yoki boshqa sana) → «dars kunidan bir kun oldin eslatish».
//
// «Boshqa kunga ko'chirish» ham shu oyna (`order` berilsa — lid qotgan).
//
// So'rov — Lidlar sahifasi bilan BITTA: POST /api/orders/:id/holat
// { to: "sinov", sinov: { sana, vaqt, oqituvchi, guruhId, eslatma } }.

const leadAt = (o: Order) => {
  const ms = Date.parse(o.created || "");
  return Number.isFinite(ms) ? ms : 0;
};

export default function BookModalV2({
  order: fixed,
  orders,
  groups,
  info,
  waitingByGroup,
  nowMs,
  onClose,
  onDone,
  onConflict,
}: {
  /** Ko'chirish — shu lid (tanlab bo'lmaydi). Berilmasa — lid tanlanadi. */
  order?: Order;
  orders: Order[];
  /** null — hali yuklanmoqda. */
  groups: Group[] | null;
  info: Record<number, GroupInfo>;
  /** Guruh → shu guruhga birinchi darsga yozilgan (natija kutayotgan) lidlar soni. */
  waitingByGroup: Map<number, number>;
  nowMs: number;
  onClose: () => void;
  onDone: (order: Order, message: string) => void;
  onConflict: () => void;
}) {
  const { t } = useT();
  const f = useLeadV2Fmt();
  const { showToast } = useToast();
  const modal = useModalClose(onClose, "center");
  const today = uzDateOf(nowMs);
  const moving = !!fixed;

  // Lidlar: yangi va bog'lanilganlar, yangisi tepada.
  const candidates = useMemo(
    () =>
      orders
        .filter((o) => {
          const h = holatOf(o);
          return h === "yangi" || h === "bog";
        })
        .sort((a, b) => leadAt(b) - leadAt(a) || b.id - a.id),
    [orders],
  );
  const leadOptions = useMemo<PickerOption[]>(
    () =>
      candidates.map((o) => {
        const ms = leadAt(o);
        const phone = phoneParts(o.phone)?.show ?? o.phone ?? "";
        const when = ms ? (uzDateOf(ms) === today ? t("ariza bugun {time}", { time: f.stamp(ms).split(" | ")[1] ?? "" }) : t("ariza {day}", { day: f.day(uzDateOf(ms)) })) : "";
        return {
          value: String(o.id),
          label: o.name || `#${o.id}`,
          sublabel: [phone, when].filter(Boolean).join(" · "),
          hint: o.course ? t(o.course) : undefined,
          keywords: [o.phone, o.course].filter(Boolean).join(" "),
          lead: (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full border border-v2-border bg-v2-surface-2 text-[10px] font-semibold text-v2-text-2" aria-hidden>
              {initialsOf(o.name || "?")}
            </span>
          ),
        };
      }),
    [candidates, today, f, t],
  );

  const [leadId, setLeadId] = useState<string>(fixed ? String(fixed.id) : "");
  const order = fixed ?? candidates.find((o) => String(o.id) === leadId) ?? null;

  const all = groups ?? [];
  const live = liveGroupsFor(order ?? { branchId: undefined }, all);
  const { match, other } = order ? splitByCourse(order, live) : { match: [] as Group[], other: live };
  const [showAll, setShowAll] = useState(false);
  const list = showAll || match.length === 0 ? [...match, ...other] : match;
  const current = fixed ? trialGroupOf(fixed, all) : null;

  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const fallbackPick = current && list.some((g) => g.id === current.id) ? current.id : match.length === 1 ? match[0].id : null;
  const pick = picked === undefined ? fallbackPick : picked;
  const chosen = live.find((g) => g.id === pick) ?? null;

  const dates = chosen ? lessonDatesOf(chosen, nowMs, 3) : [];
  const [custom, setCustom] = useState<string | null>(null);
  const [dateIdx, setDateIdx] = useState(0);
  const sana = custom ?? dates[Math.min(dateIdx, dates.length - 1)] ?? "";
  const vaqt = chosen ? startTimeOf(chosen.time) : "";

  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fromSinov = fixed ? sinovOf(fixed) : null;

  const errLead = !order ? t("Lidni tanlang") : "";
  const errGroup = !chosen ? t("Guruhni tanlang") : !vaqt ? t("Guruh vaqti kiritilmagan — Guruhlar bo'limida to'ldiring") : "";
  const errSana = !sana ? t("Sanani tanlang") : sana < today ? t("Sana bugundan oldin bo'lmasin.") : "";
  const warnSana = chosen && sana && !errSana && !isLessonDay(chosen, sana) ? t("Bu kun guruhning dars kuni emas") : "";
  const sameAsNow = !!fromSinov && fromSinov.sana === sana && fromSinov.vaqt === vaqt && current?.id === chosen?.id;
  const dirty = (!fixed && leadId !== "") || picked !== undefined || custom !== null || dateIdx !== 0 || !remind;
  const moderator = (order?.moderator || "").trim();

  async function submit() {
    if (busy) return;
    setSubmitted(true);
    if (errLead || errGroup || errSana || !order || !chosen) return;
    if (sameAsNow) return modal.close();
    setBusy(true);
    const r = await postHolat(order.id, {
      to: "sinov",
      sinov: { sana, vaqt, oqituvchi: chosen.teacher || "", guruhId: chosen.id, ...(remind ? {} : { eslatma: false }) },
    });
    setBusy(false);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Saqlab bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onDone(r.order, moving ? t("Birinchi dars ko'chirildi: {day}", { day: f.dayWithWeekday(sana) }) : t("Birinchi darsga yozildi: {day}", { day: f.dayWithWeekday(sana) }));
    modal.close();
  }

  const seatsAside = (g: Group) => {
    const s = seatsOf(g, info[g.id]);
    const waiting = waitingByGroup.get(g.id) ?? 0;
    return (
      <span className="block text-v2-caption leading-4">
        {s.free !== null ? (
          <span className={`block font-medium ${s.free === 0 ? "text-v2-warning" : "text-v2-text"}`}>
            {s.free === 0 ? t("bo'sh o'rin yo'q") : t("{n} bo'sh o'rin", { n: s.free })}
          </span>
        ) : (
          <span className="block text-v2-text-2">{t("{n} o'quvchi", { n: s.students })}</span>
        )}
        {waiting > 0 && <span className="block text-v2-text-3">{t("{n} kishi yozilgan", { n: waiting })}</span>}
      </span>
    );
  };

  const phone = fixed ? (phoneParts(fixed.phone)?.show ?? fixed.phone) : "";
  return (
    <V2Dialog
      title={moving ? t("Birinchi darsni ko'chirish") : t("Birinchi darsga yozish")}
      subtitle={moving ? [fixed?.name, phone].filter(Boolean).join(" · ") : t("Lidni guruhning birinchi darsiga yozish")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={busy}
      width={560}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : moving ? t("Saqlash") : t("Yozish")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {!moving && (
          <Field label={t("Lid")} error={submitted ? errLead : ""}>
            <V2Picker
              value={leadId}
              onChange={(v) => {
                setLeadId(v);
                setPicked(undefined);
                setCustom(null);
                setDateIdx(0);
                setShowAll(false);
              }}
              options={leadOptions}
              label={t("Lid")}
              placeholder={t("Lidni tanlang")}
              searchPlaceholder={t("Ism yoki telefon")}
              emptyText={t("Yangi yoki bog'lanilgan lid yo'q")}
            />
          </Field>
        )}

        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Guruh")}</div>
          {groups === null ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-[66px] rounded-v2-lg bg-v2-skeleton" />
              <div className="h-[66px] rounded-v2-lg bg-v2-skeleton" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex items-center gap-3 rounded-v2-lg bg-v2-surface-2 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                <Users className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-v2-small text-v2-text-2">{t("Faol guruh topilmadi — avval Guruhlar bo'limida guruh oching.")}</span>
            </div>
          ) : (
            <>
              {order && match.length === 0 && other.length > 0 && (
                <p className="mb-2 text-v2-caption text-v2-text-2">{t("«{course}» kursi bo'yicha guruh yo'q — barcha guruhlar ko'rsatilmoqda.", { course: order.course || "—" })}</p>
              )}
              <div className="max-h-[300px] overflow-y-auto pr-0.5">
                <GroupRadioList
                  groups={list}
                  value={pick}
                  trialId={current?.id ?? null}
                  label={t("Guruh")}
                  autoFocus={moving}
                  aside={seatsAside}
                  onChange={(id) => {
                    setPicked(id);
                    setCustom(null);
                    setDateIdx(0);
                  }}
                />
              </div>
              {submitted && errGroup && <FieldError>{errGroup}</FieldError>}
            </>
          )}
          {match.length > 0 && other.length > 0 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
              {showAll ? t("Faqat shu kurs guruhlari") : t("Boshqa kurslar guruhlari ({n})", { n: other.length })}
            </button>
          )}
          {order?.course && <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("Kurs — liddan: {course}. Bo'sh o'rin guruh xonasining sig'imidan hisoblanadi.", { course: t(order.course) })}</p>}
        </div>

        {chosen && (
          <div>
            <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Birinchi dars")}</div>
            <div className="flex flex-wrap items-center gap-2">
              {dates.map((iso, i) => {
                const on = custom === null && Math.min(dateIdx, dates.length - 1) === i;
                return (
                  <Chip
                    key={iso}
                    on={on}
                    onClick={() => {
                      setCustom(null);
                      setDateIdx(i);
                    }}
                  >
                    <span>{f.dayWithWeekday(iso)}</span>
                    {i === 0 && vaqt && <span className={on ? "font-normal opacity-80" : "text-v2-text-2"}>· {vaqt}</span>}
                  </Chip>
                );
              })}
              <V2DateField
                value={sana ? dateOfIso(sana) : null}
                onChange={(d) => setCustom(isoOfDate(d))}
                trigger={(trigger, open) => (
                  <Chip on={custom !== null} onClick={trigger.onClick} ref={trigger.ref} aria-haspopup="dialog" aria-expanded={open}>
                    <span>{custom !== null ? f.dayWithWeekday(custom) : t("Boshqa sana")}</span>
                    <Calendar className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </Chip>
                )}
              />
            </div>
            {submitted && errSana ? <FieldError>{errSana}</FieldError> : warnSana ? <FieldWarning>{warnSana}</FieldWarning> : null}
            {dates.length === 0 && !custom && <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("Guruh jadvalidan dars kuni topilmadi — sanani o'zingiz tanlang.")}</p>}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2.5 text-v2-body text-v2-text">
          <V2Checkbox checked={remind} onChange={setRemind} label={t("Dars kunidan bir kun oldin eslatish")} />
          <Bell className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <span>
            {t("Dars kunidan bir kun oldin eslatish")}
            {moderator && <span className="text-v2-text-2"> — {moderator}</span>}
          </span>
        </label>

        <div className="flex items-start gap-2.5 rounded-v2-lg bg-v2-info-bg px-3.5 py-3 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          <p>
            {chosen?.teacher
              ? t("Saqlansa, lid shu ro'yxatga «Birinchi dars» bo'lib tushadi ({teacher} guruhi). Natija dars kuni shu sahifada belgilanadi.", { teacher: shortName(chosen.teacher) })
              : t("Saqlansa, lid shu ro'yxatga «Birinchi dars» bo'lib tushadi. Natija dars kuni shu sahifada belgilanadi.")}
          </p>
        </div>
      </div>
    </V2Dialog>
  );
}
