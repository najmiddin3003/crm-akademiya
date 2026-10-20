"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CircleX,
  Copy,
  Loader2,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  RotateCcw,
  Send,
  SquareArrowOutUpRight,
  UserRound,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import type { LeadRow } from "@/components/leads/leadsCommon";
import { TextInput } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import type { Group } from "@/lib/groups";
import { HOLAT_STEPS, UNDO_MINUTES, canTransition, guruhOf, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import { isSelfServeSource, type LeadSettings } from "@/lib/leadSettings";
import { orderNo } from "@/lib/ordersData";
import { uzDateOf } from "@/lib/staffTasks";
import { HolatBadge } from "./leadBits";
import { HOLAT_V2, addDaysIso, initialsOf, leadTimelineV2, levelLong, levelShort, phoneParts, qulayVaqtText, trialGroupOf, undoState, useLeadV2Fmt } from "./leadUtils";

// YANGI VERSIYA — LID PANELI (rasm «5-qism · Lid paneli — bosqichlar chizig'i»,
// yorug'/qorong'i, 20.10.2026). Ro'yxatda lid bosilganda o'ngdan chiqadi
// (O'quvchi tezkor paneli qolipi — DESIGN.md «Tezkor panel»):
//
//   sarlavha: avatar (brend), ism, holat belgisi, «telefon · manba»; to'liq karta
//             (eski /orders-list/[id] — chek, SMS tarixi, boshqa filialga) va ×;
//   amallar:  «Qo'ng'iroq qilish» (keng), «SMS», «⋯» (tahrirlash, izohlar, chek …);
//   BOSQICH:  Yangi → Bog'lanildi → Birinchi dars → Guruhda, «3 / 4»; asosiy tugma —
//             keyingi bosqich («Guruhga qo'shish →»), «Rad etdi»; oldindagi
//             bosqich doirachasi bosilsa — oraliq bosqich o'tkazib yuboriladi
//             (tarixda yoziladi); oxirgi o'zgarishni 10 daqiqa ichida bekor qilish;
//   Birinchi dars (sana, kurs · o'qituvchi · xona, «O'zgartirish»), So'rovnoma
//   javoblari (yoki Ma'lumotlar), Izoh, Tarix (yangisi tepada).
//
// Holat o'tishlari eski kartadagi bilan BITTA (lib/leadHolat.ts → canTransition).

interface Props {
  row: LeadRow;
  settings: LeadSettings | null;
  branchName: string;
  groups: Group[];
  isAdmin: boolean;
  nowMs: number;
  /** Holat so'rovi ketyapti (Bog'lanildi, bekor qilish). */
  busy: boolean;
  commentsCount: number;
  /** O'quvchi profiliga ruxsat (guruhga qo'shilgan lid → o'quvchi). */
  canStudents: boolean;
  canGroups: boolean;
  onClose: () => void;
  /** Bog'lanildi — darhol; Birinchi dars / Guruh / Rad — oyna ochiladi. */
  onGo: (to: LeadHolat) => void;
  onReschedule: () => void;
  onUndo: () => void;
  onSaveNote: (note: string) => Promise<boolean>;
  onEdit: () => void;
  onReceipt: () => void;
  onComments: () => void;
  onSms: () => void;
}

const NEXT_LABEL: Partial<Record<LeadHolat, string>> = {
  yangi: "Bog'lanildi",
  bog: "Birinchi darsga yozish",
  sinov: "Guruhga qo'shish",
};

export default function LeadPanelV2(props: Props) {
  const { row, settings, branchName, groups, isAdmin, nowMs, busy, commentsCount, canStudents, canGroups } = props;
  const { onClose, onGo, onReschedule, onUndo, onSaveNote, onEdit, onReceipt, onComments, onSms } = props;
  const f = useLeadV2Fmt();
  const { t } = useT();
  const { showSuccess } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const o = row.o;
  const holat = row.holat;

  // Ochilganda fokus — klaviatura bilan ishlovchi panelda ekanini bilsin (Esc — yopadi).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const phone = phoneParts(o.phone);
  const survey = isSelfServeSource(o.source);
  const sinov = sinovOf(o);
  const guruh = guruhOf(o);
  const trial = trialGroupOf(o, groups);
  const undo = undoState(o, nowMs, isAdmin);
  const today = uzDateOf(nowMs);

  /* ---- Bosqich ---- */
  const stepIdx = HOLAT_STEPS.indexOf(holat);
  // Rad etilgan lid — qaysi bosqichdan rad etilgani (tarixdagi oxirgi «rad» yozuvidan).
  const radFrom: LeadHolat | null =
    holat === "rad" ? ([...(o.holatTarix ?? [])].reverse().find((e) => e.holat === "rad" && e.from && e.from !== "rad")?.from ?? null) : null;
  const reached = holat === "rad" ? (radFrom ? HOLAT_STEPS.indexOf(radFrom) : -1) : stepIdx;
  const nextLabel = NEXT_LABEL[holat];

  /* ---- Izoh ---- */
  const [note, setNote] = useState(o.note || "");
  const [savingNote, setSavingNote] = useState(false);
  const noteChanged = note.trim() !== (o.note || "").trim();
  const saveNote = async () => {
    if (!noteChanged || savingNote) return;
    setSavingNote(true);
    await onSaveNote(note.trim());
    setSavingNote(false);
  };

  /* ---- Ma'lumotlar / So'rovnoma javoblari ---- */
  const yon = settings?.yonalishlar.find((y) => y.id === row.yon) ?? null;
  const course = o.course ? t(o.course) : "";
  const info: [string, ReactNode][] = [];
  if (survey) {
    info.push([t("Yo'nalish"), [yon ? t(yon.nom) : "", course].filter(Boolean).join(" · ") || "—"]);
    const lvl = levelLong(o, settings, t);
    if (lvl) info.push([t("Taxminiy daraja"), lvl]);
    if (o.sinf) info.push([t("Sinf"), t(o.sinf)]);
    if (o.qulayVaqt) info.push([t("Qulay vaqt"), qulayVaqtText(t(o.qulayVaqt))]);
    info.push([t("Filial"), branchName || "—"]);
    if (o.heardFrom) info.push([t("Qayerdan bildi"), t(o.heardFrom)]);
  } else {
    info.push([t("Kurs"), course || "—"]);
    const lvl = levelShort(o, settings, t);
    if (lvl) info.push([t("Daraja / sinf"), lvl]);
    if (o.lessonDay || o.lessonStartTime) info.push([t("Dars kuni"), [o.lessonDay, o.lessonStartTime].filter(Boolean).join(" · ")]);
    info.push([t("Filial"), branchName || "—"]);
    info.push([t("Manba"), o.source ? t(o.source) : "—"]);
    if (o.heardFrom) info.push([t("Qayerdan bildi"), t(o.heardFrom)]);
  }
  if (o.tgUser) {
    info.push([
      t("Telegram"),
      o.tgUser.username ? (
        <a href={`https://t.me/${encodeURIComponent(o.tgUser.username)}`} target="_blank" rel="noopener noreferrer" className="text-v2-brand-text underline-offset-2 hover:underline">
          @{o.tgUser.username}
        </a>
      ) : (
        o.tgUser.name || "—"
      ),
    ]);
  }
  if (o.moderator) info.push([t("Mas'ul"), o.moderator]);

  const timeline = leadTimelineV2(row, f);

  /* ---- Amallar menyusi ---- */
  const menu: ActionMenuEntry[] = [
    { key: "h", heading: t("Lid #{n}", { n: orderNo(o) }) },
    { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: onEdit },
    { key: "comments", label: commentsCount > 0 ? t("Izohlar ({n})", { n: commentsCount }) : t("Izohlar"), icon: MessagesSquare, onSelect: onComments },
    { key: "receipt", label: t("Chek"), icon: Printer, onSelect: onReceipt },
    ...(o.tgUser?.username
      ? [{ key: "tg", label: t("Telegramda yozish"), icon: Send, onSelect: () => window.open(`https://t.me/${encodeURIComponent(o.tgUser?.username ?? "")}`, "_blank", "noopener,noreferrer") }]
      : []),
    ...(phone
      ? [
          {
            key: "copy",
            label: t("Raqamni nusxalash"),
            icon: Copy,
            onSelect: () => {
              void navigator.clipboard?.writeText(phone.tel);
              showSuccess(t("Nusxa olindi"));
            },
          },
        ]
      : []),
    { key: "d", divider: true },
    { key: "card", label: t("To'liq karta"), icon: SquareArrowOutUpRight, href: `/orders-list/${o.id}` },
  ];

  const iconBase =
    "inline-flex shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
  const outlineBtn =
    "inline-flex h-9 items-center justify-center gap-2 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-body font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50";
  const sectionTitle = "mb-2.5 text-v2-small font-medium text-v2-text-2";

  /* ---- Birinchi dars kartasi ---- */
  function lessonBadge(): ReactNode {
    if (!sinov) return null;
    if (sinov.sana === today) return <span className="rounded-v2-sm bg-v2-warning px-1.5 py-px text-v2-caption font-semibold text-v2-on-color">{t("Bugun birinchi dars")}</span>;
    if (sinov.sana === addDaysIso(today, 1)) return <span className="rounded-v2-sm bg-v2-warning-bg px-1.5 py-px text-v2-caption text-v2-warning">{t("Ertaga")}</span>;
    const st = o.firstLessonStatus;
    if (st === "KELDI") return <span className="rounded-v2-sm bg-v2-success-bg px-1.5 py-px text-v2-caption text-v2-success">{t("Keldi")}</span>;
    if (st === "KELMADI") return <span className="rounded-v2-sm bg-v2-danger-bg px-1.5 py-px text-v2-caption text-v2-danger">{t("Kelmadi")}</span>;
    if (sinov.sana < today) return <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("Dars o'tdi")}</span>;
    if (st === "ESLATILDI") return <span className="rounded-v2-sm bg-v2-info-bg px-1.5 py-px text-v2-caption text-v2-info">{t("Eslatildi")}</span>;
    return null;
  }

  return (
    <aside role="dialog" aria-modal="true" aria-label={o.name || t("Lid")} className="flex h-full w-full flex-col border-l border-v2-border bg-v2-surface text-v2-body text-v2-text shadow-v2-md">
      {/* Sarlavha va amallar */}
      <header className="shrink-0 border-b border-v2-border px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand-bg text-v2-body font-semibold text-v2-brand-text" aria-hidden>
            {initialsOf(o.name || "?")}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-v2-section text-v2-text" title={o.name}>
              {o.name || "—"}
            </h2>
            <div className="mt-1">
              <HolatBadge holat={holat} />
            </div>
            <p className="mt-1.5 truncate text-v2-small tabular-nums text-v2-text-2">{[phone?.show ?? "", o.source ? t(o.source) : ""].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <Link href={`/orders-list/${o.id}`} title={t("To'liq karta")} aria-label={t("To'liq karta")} className={`${iconBase} size-8 border border-v2-border-strong bg-v2-surface`}>
            <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
          </Link>
          <button ref={closeRef} type="button" onClick={onClose} title={t("Yopish")} aria-label={t("Yopish")} className={`${iconBase} size-8`}>
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {phone ? (
            <a href={`tel:${phone.tel}`} className={`${outlineBtn} min-w-0 flex-1`}>
              <Phone className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{t("Qo'ng'iroq qilish")}</span>
            </a>
          ) : (
            <button type="button" disabled className={`${outlineBtn} min-w-0 flex-1`} title={t("Telefon raqam yo'q")}>
              <Phone className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{t("Qo'ng'iroq qilish")}</span>
            </button>
          )}
          <button type="button" onClick={onSms} disabled={!o.phone} title={o.phone ? undefined : t("Telefon raqam yo'q")} className={outlineBtn}>
            <MessageSquare className="size-4" strokeWidth={1.75} aria-hidden />
            SMS
          </button>
          <ActionMenu items={menu} label={t("Qo'shimcha amallar")} width={232}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={`${iconBase} size-9 border border-v2-border-strong bg-v2-surface`}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Bosqich */}
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4" aria-label={t("Bosqich")}>
          <div className="flex items-center justify-between gap-2 text-v2-small text-v2-text-2">
            <span className="font-medium">{t("Bosqich")}</span>
            <span className="tabular-nums">{holat === "rad" ? t(HOLAT_V2.rad.card) : `${stepIdx + 1} / ${HOLAT_STEPS.length}`}</span>
          </div>

          <ol className="relative mt-3 grid grid-cols-4">
            {HOLAT_STEPS.slice(0, -1).map((s, i) => (
              <span
                key={`l-${s}`}
                aria-hidden
                className={`absolute top-[11px] h-0.5 -translate-y-1/2 ${i + 1 <= reached && holat !== "rad" ? "bg-v2-brand" : i + 1 <= reached ? "bg-v2-text-3" : "bg-v2-border-strong"}`}
                style={{ left: `${(i + 0.5) * 25}%`, width: "25%" }}
              />
            ))}
            {HOLAT_STEPS.map((s, i) => {
              const done = i < reached || (holat === "guruh" && i === reached) || (holat === "rad" && i <= reached);
              const current = holat !== "rad" && holat !== "guruh" && i === reached;
              // Rad etilganda o'tishlar pastdagi tugmalarda («Qayta bog'lanish», «Birinchi darsga yozish»).
              const canGo = !busy && holat !== "rad" && canTransition(holat, s) && !(holat === "sinov" && s === "sinov");
              const tone = holat === "rad" ? "bg-v2-text-3 text-v2-on-color" : "bg-v2-brand text-v2-on-brand";
              const circle = (
                <span
                  className={`relative z-[1] flex size-[22px] items-center justify-center rounded-full ${
                    done ? tone : current ? "border-2 border-v2-brand bg-v2-surface" : "border-2 border-v2-border-strong bg-v2-surface"
                  } ${canGo ? "transition-shadow group-hover/step:shadow-v2-focus" : ""}`}
                >
                  {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
                  {current && <span className="size-2 rounded-full bg-v2-brand" aria-hidden />}
                </span>
              );
              const label = <span className={`mt-1.5 text-center text-v2-caption ${current ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{t(HOLAT_V2[s].step)}</span>;
              return (
                <li key={s} className="flex flex-col items-center" aria-current={current ? "step" : undefined}>
                  {canGo ? (
                    <button
                      type="button"
                      onClick={() => onGo(s)}
                      title={i > reached + 1 ? t("Oraliq bosqichlar o'tkazib yuboriladi") : t(HOLAT_V2[s].card)}
                      className="group/step flex flex-col items-center rounded-v2-md px-1 focus-visible:shadow-v2-focus focus-visible:outline-none"
                    >
                      {circle}
                      {label}
                    </button>
                  ) : (
                    <>
                      {circle}
                      {label}
                    </>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Asosiy amal va «Rad etdi» */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {holat === "rad" ? (
              <button type="button" disabled={busy} onClick={() => onGo("bog")} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" strokeWidth={2} aria-hidden />}
                {t("Qayta bog'lanish")}
              </button>
            ) : nextLabel ? (
              <button type="button" disabled={busy} onClick={() => onGo(HOLAT_STEPS[stepIdx + 1])} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60">
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                <span className="truncate">{t(nextLabel)}</span>
                <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            ) : holat === "guruh" && o.pupilId && canStudents ? (
              <Link href={`/student-edit/${o.pupilId}`} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-v2-md border border-v2-border-strong bg-v2-surface px-4 text-v2-body font-semibold text-v2-text transition-colors hover:bg-v2-surface-2">
                <UserRound className="size-4" strokeWidth={1.75} aria-hidden />
                {t("O'quvchi profili")}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Link>
            ) : (
              <p className="text-v2-small text-v2-text-2">{t("O'quvchilarga o'tdi")}</p>
            )}
            {canTransition(holat, "rad") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onGo("rad")}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-v2-md border border-v2-danger/40 bg-v2-surface px-3.5 text-v2-body font-semibold text-v2-danger transition-colors hover:bg-v2-danger-bg focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
              >
                <CircleX className="size-4" strokeWidth={2} aria-hidden />
                {t(HOLAT_V2.rad.card)}
              </button>
            )}
            {holat === "rad" && (
              <button type="button" disabled={busy} onClick={() => onGo("sinov")} className={`${outlineBtn} h-10`}>
                {t("Birinchi darsga yozish")}
              </button>
            )}
          </div>

          {holat !== "rad" && holat !== "guruh" && stepIdx < 2 && (
            <p className="mt-3 text-v2-caption text-v2-text-2">{t("Kerak bo'lsa bosqichni o'tkazib yuborish mumkin — tarixda belgilanadi.")}</p>
          )}
          {holat === "rad" && o.radSabab && (
            <p className="mt-3 text-v2-small text-v2-text-2">
              {t("Sabab:")} <b className="font-semibold text-v2-text">{t(o.radSabab)}</b>
            </p>
          )}
          {undo.has && undo.can && (
            <div className="mt-3 border-t border-v2-border pt-3">
              <button type="button" disabled={busy} onClick={onUndo} className="inline-flex items-center gap-1.5 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline disabled:opacity-60">
                <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden />
                {undo.left > 0 ? t("Oxirgi o'zgarishni bekor qilish") : t("Oldingi holatga qaytarish")}
                <span className="font-normal text-v2-text-3">· {undo.left > 0 ? t("{n} daq qoldi", { n: undo.left }) : t("direktor")}</span>
              </button>
              {holat === "guruh" && <p className="mt-1.5 text-v2-caption text-v2-warning">{t("Bekor qilinsa ham o'quvchi guruhda qoladi — kerak bo'lsa guruh sahifasidan chiqaring.")}</p>}
              {undo.left > 0 && !isAdmin && <p className="mt-1 text-v2-caption text-v2-text-3">{t("{n} daqiqadan keyin faqat direktor qaytara oladi", { n: UNDO_MINUTES })}</p>}
            </div>
          )}
        </section>

        {/* Birinchi dars */}
        {holat === "sinov" && (
          <section>
            <h3 className={sectionTitle}>{t("Birinchi dars")}</h3>
            {sinov ? (
              <div className={`flex items-center gap-3 rounded-v2-lg border border-v2-border px-3.5 py-3 text-v2-body ${sinov.sana === today ? "shadow-[inset_3px_0_0_var(--v2-warning)]" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {lessonBadge()}
                    <span className="font-semibold tabular-nums text-v2-text">
                      {f.day(sinov.sana)}
                      {sinov.vaqt ? ` | ${sinov.vaqt}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-v2-small text-v2-text-2">
                    {[course, sinov.oqituvchi, trial ? roomLabel(trial.room) : ""].filter(Boolean).join(" · ") || t("O'qituvchi belgilanmagan")}
                  </div>
                </div>
                <button type="button" onClick={onReschedule} disabled={busy} className="shrink-0 rounded-v2-sm text-v2-small font-semibold text-v2-brand-text underline-offset-2 hover:underline disabled:opacity-60">
                  {t("O'zgartirish")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-v2-lg border border-dashed border-v2-border-strong px-3.5 py-3 text-v2-body">
                <div className="min-w-0 flex-1">
                  <div className="text-v2-body font-semibold text-v2-text">{t("Sana belgilanmagan")}</div>
                  <div className="mt-0.5 text-v2-small text-v2-text-2">{t("Telegram'da belgilangan — sana va o'qituvchini kiriting")}</div>
                </div>
                <button type="button" onClick={onReschedule} disabled={busy} className="shrink-0 rounded-v2-sm text-v2-small font-semibold text-v2-brand-text underline-offset-2 hover:underline">
                  {t("Belgilash")}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Guruh */}
        {holat === "guruh" && guruh && (
          <section>
            <h3 className={sectionTitle}>{t("Guruh")}</h3>
            {(() => {
              const g = groups.find((x) => x.id === guruh.id) ?? null;
              const title = g?.course || guruh.nom;
              const meta = g
                ? [g.teacher, [g.day, timeLabel(g.time)].filter(Boolean).join(" "), roomLabel(g.room)].filter(Boolean).join(" · ")
                : [guruh.kun, guruh.vaqt].filter(Boolean).join(" · ");
              const body = (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(title)]}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-semibold text-v2-text">{title}</span>
                    {guruh.boshlash && <span className="shrink-0 text-v2-caption text-v2-text-2">{t("1-dars {day}", { day: f.day(guruh.boshlash) })}</span>}
                  </div>
                  {meta && <div className="mt-1 truncate text-v2-small text-v2-text-2">{meta}</div>}
                </>
              );
              const cls = "block rounded-v2-lg border border-v2-border px-3.5 py-3 transition-colors";
              return guruh.id > 0 && canGroups ? (
                <Link href={`/groups/${guruh.id}`} className={`${cls} hover:border-v2-border-strong hover:bg-v2-hover`}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              );
            })()}
          </section>
        )}

        {/* So'rovnoma javoblari / Ma'lumotlar */}
        <section>
          <h3 className={sectionTitle}>{survey ? t("So'rovnoma javoblari") : t("Ma'lumotlar")}</h3>
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-2.5 text-v2-small">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-v2-text-2">{k}</dt>
                <dd className="min-w-0 break-words text-v2-text">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Izoh */}
        <section>
          <h3 className={sectionTitle}>{t("Izoh")}</h3>
          <div className="flex items-center gap-2">
            <TextInput
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveNote();
                }
              }}
              placeholder={t("Izoh qo'shish...")}
              aria-label={t("Izoh")}
            />
            {noteChanged && (
              <button type="button" onClick={() => void saveNote()} disabled={savingNote} className={`${outlineBtn} h-10 shrink-0`}>
                {savingNote && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("Saqlash")}
              </button>
            )}
          </div>
        </section>

        {/* Tarix */}
        <section>
          <h3 className={sectionTitle}>{t("Tarix")}</h3>
          {timeline.length === 0 ? (
            <div className="text-v2-small text-v2-text-3">—</div>
          ) : (
            <ol>
              {timeline.map((x, i) => (
                <li key={`${x.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < timeline.length - 1 && <span className="absolute left-[3.5px] top-3 h-full w-px bg-v2-border" aria-hidden />}
                  <span className={`relative mt-1.5 size-2 shrink-0 rounded-full ${i === 0 ? "bg-v2-brand" : "bg-v2-border-strong"}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-v2-small font-medium text-v2-text">{x.title}</span>
                    <span className="block text-v2-caption tabular-nums text-v2-text-3">{[f.stamp(x.at), x.sub].filter(Boolean).join(" · ")}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </aside>
  );
}
