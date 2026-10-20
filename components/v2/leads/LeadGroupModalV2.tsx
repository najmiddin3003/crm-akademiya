"use client";

import { useState } from "react";
import { Calendar, Check, Info, Loader2, Users } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { postHolat } from "@/components/leads/LeadHolatModals";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import { Chip, FieldError } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { enrollOrderInGroup } from "@/lib/enrollStudent";
import type { Group } from "@/lib/groups";
import { sinovOf } from "@/lib/leadHolat";
import type { Order } from "@/lib/ordersData";
import type { PupilListItem } from "@/lib/pupilsData";
import { uzDateOf } from "@/lib/staffTasks";
import { GroupRadioList, LeadFromBox } from "./leadBits";
import { dateOfIso, isoOfDate, liveGroupsFor, nextLessonIso, phoneParts, splitByCourse, trialGroupOf, useLeadV2Fmt } from "./leadUtils";

// YANGI VERSIYA — «GURUHGA QO'SHISH» (rasm «5-qism · Guruhga qo'shish oynasi»,
// yorug'/qorong'i, 20.10.2026): kurs va filial liddan; guruh — radio kartalar
// (lid kursidagilar, «Birinchi dars shu guruhda» belgisi), boshlash sanasi —
// guruhning keyingi darsi yoki boshqa sana; «Saqlagach, to'lov oynasini ochish».
//
// Saqlash — eski oyna bilan BITTA yo'l: avval o'quvchi haqiqatan guruhga
// yoziladi (lib/enrollStudent.ts — o'quvchi bo'lmasa lid ma'lumotidan
// yaratiladi), keyin lid holati (POST /api/orders/:id/holat). Bekor qilish lid
// holatini qaytaradi, o'quvchini guruhdan CHIQARMAYDI (eski qaror).

export interface GroupJoined {
  pupil: PupilListItem | undefined;
  group: Group;
  /** «Saqlagach, to'lov oynasini ochish» belgilangan. */
  openPay: boolean;
}

export default function LeadGroupModalV2({
  order,
  branchName,
  nowMs,
  groups,
  canPay,
  onClose,
  onDone,
  onConflict,
}: {
  order: Order;
  branchName: string;
  nowMs: number;
  /** null — hali yuklanmoqda. */
  groups: Group[] | null;
  /** Kassaga ruxsat bor — to'lov oynasi taklif qilinadi. */
  canPay: boolean;
  onClose: () => void;
  onDone: (order: Order, info: GroupJoined) => void;
  onConflict: () => void;
}) {
  const f = useLeadV2Fmt();
  const { t } = useT();
  // Saqlangach oyna o'zi yopilsin (Enter bilan saqlansa ham) — tashqi boshqaruvchi.
  const modal = useModalClose(onClose, "center");
  const all = groups ?? [];
  const live = liveGroupsFor(order, all);
  const { match, other } = splitByCourse(order, live);
  const [showAll, setShowAll] = useState(false);
  const list = showAll || match.length === 0 ? [...match, ...other] : match;
  const trial = trialGroupOf(order, all);

  // Tanlov: foydalanuvchi bosmaguncha — sinov darsi bo'lgan guruh, u bo'lmasa
  // kursdagi yagona guruh (guruhlar keyin yuklansa ham to'g'ri chiqadi).
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const fallbackPick = trial && list.some((g) => g.id === trial.id) ? trial.id : match.length === 1 ? match[0].id : null;
  const pick = picked === undefined ? fallbackPick : picked;
  const chosen = live.find((g) => g.id === pick) ?? null;

  // Boshlash sanasi — sukut guruhning keyingi darsi; jadvali o'qilmasa —
  // sinov darsi (o'tmagan bo'lsa) yoki bugun (eski oyna qoidasi).
  const today = uzDateOf(nowMs);
  const sinov = sinovOf(order);
  const fallbackIso = sinov && sinov.sana >= today ? sinov.sana : today;
  const nextIso = chosen ? nextLessonIso(chosen, nowMs) : null;
  const [custom, setCustom] = useState<string | null>(null);
  const useNext = !!nextIso && custom === null;
  const boshlash = useNext ? (nextIso as string) : (custom ?? fallbackIso);

  const [openPay, setOpenPay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const phone = phoneParts(order.phone)?.show ?? order.phone;
  const firstName = (order.name || "").trim().split(/\s+/)[0] || t("O'quvchi");

  async function submit() {
    if (busy) return;
    setSubmitted(true);
    if (!chosen) return;
    setErr("");
    setBusy(true);
    const enrolled = await enrollOrderInGroup(order, chosen.id, undefined, { joinedAt: boshlash });
    if (!enrolled.ok) {
      setBusy(false);
      setErr(t(enrolled.error || "Guruhga qo'shishda xatolik yuz berdi"));
      return;
    }
    const r = await postHolat(order.id, {
      to: "guruh",
      guruh: { id: chosen.id, nom: String(chosen.name || chosen.id), kun: chosen.day || "", vaqt: chosen.time || "", boshlash },
      pupilId: enrolled.pupil?.id,
    });
    setBusy(false);
    if (!r.ok) {
      // O'quvchi guruhda — faqat lid holati yozilmadi; qayta bosish xavfsiz
      // (guruhga qo'shish takrorlanmaydi, $addToSet).
      setErr(t("O'quvchi guruhga qo'shildi, lekin lid holati saqlanmadi: {error}", { error: t(r.error) }));
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    onDone(r.order, { pupil: enrolled.pupil, group: chosen, openPay: canPay && openPay });
    modal.close();
  }

  return (
    <V2Dialog
      title={t("Guruhga qo'shish")}
      subtitle={[order.name, phone].filter(Boolean).join(" · ")}
      onClose={onClose}
      controller={modal}
      saving={busy}
      width={540}
      onSubmit={() => void submit()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={busy} className={`${secondaryBtn} h-10 justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${primaryBtn} h-10 justify-center disabled:opacity-60`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {busy ? t("Saqlanmoqda...") : t("Guruhga qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <LeadFromBox course={order.course || ""} branch={branchName} />

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
              {match.length === 0 && other.length > 0 && (
                <p className="mb-2 text-v2-caption text-v2-text-2">{t("«{course}» kursi bo'yicha guruh yo'q — barcha guruhlar ko'rsatilmoqda.", { course: order.course || "—" })}</p>
              )}
              <GroupRadioList
                groups={list}
                value={pick}
                trialId={trial?.id ?? null}
                label={t("Guruh")}
                autoFocus
                onChange={(id) => {
                  setPicked(id);
                  // Boshqa guruhda keyingi dars boshqa kun — tanlangan sana qayta hisoblansin.
                  setCustom(null);
                  setErr("");
                }}
              />
              {submitted && !chosen && <FieldError>{t("Guruhni tanlang")}</FieldError>}
            </>
          )}
          {match.length > 0 && other.length > 0 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
              {showAll ? t("Faqat shu kurs guruhlari") : t("Boshqa kurslar guruhlari ({n})", { n: other.length })}
            </button>
          )}
        </div>

        <div>
          <div className="mb-2 text-v2-small font-medium text-v2-text">{t("Boshlash sanasi")}</div>
          <div className="flex flex-wrap items-center gap-2">
            {nextIso && (
              <Chip on={useNext} onClick={() => setCustom(null)}>
                <span>{f.dayWithWeekday(nextIso)}</span>
                <span className={useNext ? "font-normal opacity-80" : "text-v2-text-2"}>· {t("keyingi dars")}</span>
              </Chip>
            )}
            <V2DateField
              value={dateOfIso(boshlash)}
              onChange={(d) => setCustom(isoOfDate(d))}
              trigger={(trigger, open) => (
                <Chip on={!useNext} onClick={trigger.onClick} ref={trigger.ref} aria-haspopup="dialog" aria-expanded={open}>
                  <span>{useNext ? t("Boshqa sana") : f.dayWithWeekday(boshlash)}</span>
                  <Calendar className="size-3.5" strokeWidth={1.75} aria-hidden />
                </Chip>
              )}
            />
          </div>
          <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("Darslar (to'lov hisobi) shu sanadan sanaladi.")}</p>
        </div>

        {canPay && (
          <label className="flex cursor-pointer items-center gap-2.5 text-v2-body text-v2-text">
            <V2Checkbox checked={openPay} onChange={setOpenPay} label={t("Saqlagach, to'lov oynasini ochish")} />
            {t("Saqlagach, to'lov oynasini ochish")}
          </label>
        )}

        <div className="flex items-start gap-2.5 rounded-v2-lg bg-v2-info-bg px-3.5 py-3 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          <p>
            {t("Saqlansa, {name}", { name: firstName })} <b className="font-semibold">{t("O'quvchilar")}</b>{" "}
            {t("ro'yxatiga o'tadi va lid holati «Guruhga qo'shildi» bo'ladi. Xato bo'lsa, lid holatini 10 daqiqa ichida bekor qilish mumkin.")}
          </p>
        </div>

        {err && (
          <div role="alert" className="rounded-v2-md bg-v2-danger-bg px-3.5 py-2.5 text-v2-small text-v2-danger">
            {err}
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
