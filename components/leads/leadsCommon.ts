"use client";

import { useMemo } from "react";
import { useStaffFmt } from "@/components/staff-tasks/format";
import { guruhOf, holatMeta, holatOf, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import { SURVEY_SOURCE, darajaInfo, hasDaraja, type LeadDaraja, type LeadSettings } from "@/lib/leadSettings";
import { leadStatusOption } from "@/lib/leadStatus";
import { orderNo, type Order } from "@/lib/ordersData";
import { DAY_MS, uzDateOf, uzWallToMs } from "@/lib/staffTasks";

// Lidlar sahifasining umumiy yordamchilari (components/leads/LeadsPage.tsx,
// LeadDrawer.tsx, LeadHolatModals.tsx). Hammasi TIL bilan — `t()` orqali;
// server va Telegram matnlari o'zbekcha qoladi (lib/leadStatus.ts).

/** "23.09.2026 | 14:30" (Toshkent) → lahza; yaroqsiz — NaN. */
export function stampMs(s: string | undefined): number {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{1,2}):(\d{2}))?/.exec(s || "");
  if (!m) return NaN;
  return uzWallToMs(`${m[3]}-${m[2]}-${m[1]}`, `${(m[4] ?? "00").padStart(2, "0")}:${m[5] ?? "00"}`);
}

/** Telefonning oxirgi 9 raqami — "+998 94 …" va "94 …" bir xil lid. */
export function phoneKey(p: string | undefined): string {
  const d = String(p ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : d;
}

/** Lidning yo'nalishi — so'rovnomadan, bo'lmasa kurs nomi sozlamadagi ro'yxatdan. */
export function yonalishOf(o: Pick<Order, "yonalish" | "course">, s: LeadSettings | null): string {
  if (o.yonalish) return o.yonalish;
  if (!s || !o.course) return "";
  return s.yonalishlar.find((y) => y.fanlar.some((f) => f.nom === o.course))?.id ?? "";
}

/** Ro'yxat qatori — hisoblangan maydonlar bir marta. */
export interface LeadRow {
  o: Order;
  holat: LeadHolat;
  /** Kelgan lahza (`created`). */
  at: number;
  yon: string;
  /** Shu raqamli OLDINGI lidning ko'rinadigan raqami. */
  dupOf: number | null;
  /** Shu raqamli lidlar soni (o'zi bilan). */
  dupCount: number;
}

export function buildRows(orders: Order[], settings: LeadSettings | null): LeadRow[] {
  const byPhone = new Map<string, Order[]>();
  for (const o of orders) {
    const k = phoneKey(o.phone);
    if (k.length < 9) continue;
    const list = byPhone.get(k);
    if (list) list.push(o);
    else byPhone.set(k, [o]);
  }
  return orders.map((o) => {
    const same = byPhone.get(phoneKey(o.phone)) ?? [];
    const older = same.filter((x) => x.id < o.id).sort((a, b) => b.id - a.id)[0];
    return {
      o,
      holat: holatOf(o),
      at: stampMs(o.created),
      yon: yonalishOf(o, settings),
      dupOf: older ? orderNo(older) : null,
      dupCount: same.length,
    };
  });
}

export const SANA_OPTIONS = [
  { value: "1", label: "Bugun" },
  { value: "7", label: "So'nggi 7 kun" },
  { value: "30", label: "So'nggi 30 kun" },
] as const;

/** Sana filtri: "Bugun" — Toshkent kuni boshidan; qolganlari — N kun ichida. */
export function inPeriod(at: number, sana: string, nowMs: number): boolean {
  if (!sana) return true;
  if (!Number.isFinite(at)) return false;
  if (sana === "1") return uzDateOf(at) === uzDateOf(nowMs);
  return nowMs - at <= Number(sana) * DAY_MS;
}

/** Lidlar sahifasining formatlash yordamchilari (topshiriqlar sahifasiniki ustiga). */
export function useLeadFmt() {
  const base = useStaffFmt();
  const { t, lang } = base;
  return useMemo(() => {
    /** "2026-09-24" → "24-sen" (inglizchada "Sep 24"). */
    const day = (iso: string): string => {
      const ms = Date.parse(`${iso}T12:00:00+05:00`);
      if (!Number.isFinite(ms)) return iso;
      return base.stamp(ms).split(" | ")[0];
    };
    /** Daraja (chet tili) — tanlangan tilda. */
    const daraja = (d: LeadDaraja, bosqichlar: string[]): { text: string; test: boolean } => {
      const i = darajaInfo(d, bosqichlar);
      if (i.test) return { text: t("Daraja testi kerak"), test: true };
      return { text: i.aniq ? t(i.near) : t("{lo} — {hi} orasida", { lo: t(i.lo), hi: t(i.hi) }), test: false };
    };
    const holatNom = (h: LeadHolat) => t(holatMeta(h).nom);
    return { ...base, lang, day, daraja, holatNom };
  }, [base, t, lang]);
}

export type LeadFmt = ReturnType<typeof useLeadFmt>;

/** "Daraja / sinf" ustuni va eksport uchun matn. */
export function levelText(o: Order, settings: LeadSettings | null, fmt: LeadFmt): { text: string; strong: boolean } {
  if (o.daraja && hasDaraja(o.yonalish) && settings) {
    const d = fmt.daraja(o.daraja, settings.bosqichlar);
    return { text: d.test ? fmt.t("Test kerak") : d.text, strong: true };
  }
  if (o.sinf) return { text: fmt.t(o.sinf), strong: false };
  if (o.level) return { text: o.level, strong: false };
  return { text: "", strong: false };
}

export interface TimelineLine {
  at: number;
  title: string;
  sub: string;
  tone: LeadHolat | "info";
}

/**
 * Kartadagi tarix — eskisidan yangisiga. Qo'shilish qatori `created` dan
 * (eski lidlarda tarix yo'q), qolgani `holatTarix` dan; tarixsiz eski
 * lidda Telegram belgisi ham ko'rsatiladi.
 */
export function timelineOf(row: LeadRow, fmt: LeadFmt): TimelineLine[] {
  const { t } = fmt;
  const o = row.o;
  const out: TimelineLine[] = [];
  const survey = o.source === SURVEY_SOURCE;
  out.push({
    at: row.at,
    title: survey ? t("Sayt so'rovnomasi orqali keldi") : o.source ? t("Lid qo'shildi — {source}", { source: t(o.source) }) : t("Lid qo'shildi"),
    sub: !survey && o.moderator ? o.moderator : "",
    tone: "info",
  });
  if (row.dupOf !== null) {
    out.push({ at: row.at, title: t("Takroriy raqam — avvalgi lid #{n}", { n: row.dupOf }), sub: "", tone: "sinov" });
  }
  const events = Array.isArray(o.holatTarix) ? o.holatTarix : [];
  for (const e of events) {
    const at = Date.parse(e.at);
    const by = e.by || "";
    if (e.kind === "undo") {
      out.push({
        at,
        title: t("Bekor qilindi: {from} → {to}", { from: e.from ? fmt.holatNom(e.from) : "—", to: e.holat ? fmt.holatNom(e.holat) : "—" }),
        sub: by,
        tone: "info",
      });
      continue;
    }
    if (e.kind !== "holat" && e.kind !== "telegram") continue;
    const h = e.holat ?? "yangi";
    let detail = "";
    if (h === "sinov" && e.sinov) detail = [fmt.day(e.sinov.sana), e.sinov.vaqt, e.sinov.oqituvchi].filter(Boolean).join(", ");
    if (h === "guruh" && e.guruhNom) detail = e.guruhNom;
    if (h === "rad" && e.radSabab) detail = t(e.radSabab);
    const title = e.kind === "telegram" ? t("Telegram: {label}", { label: e.text || fmt.holatNom(h) }) : detail ? `${fmt.holatNom(h)} — ${detail}` : fmt.holatNom(h);
    const skipped = e.skipped?.length ? t("o'tkazib yuborildi: {list}", { list: e.skipped.map(fmt.holatNom).join(", ") }) : "";
    out.push({ at, title, sub: [by, skipped].filter(Boolean).join(" · "), tone: h });
  }
  if (!events.some((e) => e.kind === "telegram") && o.leadStatus && o.leadStatusAt) {
    const opt = leadStatusOption(o.leadStatus);
    if (opt) {
      out.push({
        at: stampMs(o.leadStatusAt) || Date.parse(o.leadStatusAt),
        title: t("Telegram: {label}", { label: `${opt.emoji} ${t(opt.label)}` }),
        sub: o.leadStatusBy || "",
        tone: "info",
      });
    }
  }
  return out.filter((x) => Number.isFinite(x.at)).sort((a, b) => a.at - b.at);
}

/** Eksport (CSV/Excel) va chek uchun sinov/guruh matni. */
export function sinovText(o: Order, fmt: LeadFmt): string {
  const s = sinovOf(o);
  return s ? [fmt.day(s.sana), s.vaqt, s.oqituvchi].filter(Boolean).join(", ") : "";
}

export function guruhText(o: Order): string {
  return guruhOf(o)?.nom ?? "";
}
