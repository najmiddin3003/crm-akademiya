"use client";

import { useMemo } from "react";
import { useLang, useT, type TFn } from "@/components/shared/Language";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import type { LeadRow } from "@/components/leads/leadsCommon";
import { groupWeekdays } from "@/lib/attendance";
import { sameBranchPool } from "@/lib/branchPools";
import type { Group } from "@/lib/groups";
import { HOLAT_STEPS, UNDO_MINUTES, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import { BOT_SOURCE, SURVEY_SOURCE, darajaInfo, hasDaraja, isSelfServeSource, type LeadSettings } from "@/lib/leadSettings";
import { leadStatusOption } from "@/lib/leadStatus";
import type { Order } from "@/lib/ordersData";
import { WEEKDAYS_FULL } from "@/lib/i18n";
import { DAY_MS, HOUR_MS, uzDateOf, uzTimeOf, uzWallToMs } from "@/lib/staffTasks";

// YANGI VERSIYA — LIDLAR (5-qism, rasmlar «Lidlar», «Lid paneli — bosqichlar
// chizig'i», «Guruhga qo'shish oynasi», 20.10.2026) uchun umumiy hisoblar:
// holat belgilari, «Keyingi qadam» ustuni, sinov darsi qaysi guruhda bo'lgani,
// guruhning keyingi darsi, panel tarixi. Holat, o'tishlar va so'rovlar — eski
// sahifa bilan bitta (lib/leadHolat.ts, components/leads/*).

/* ───────────────────────── Holat belgilari ───────────────────────── */

export interface HolatTone {
  /** Jadval va paneldagi belgi («Birinchi dars»). */
  label: string;
  /** Ko'rsatkich kartasi va tarixdagi nom («Birinchi darsga yozildi»). */
  card: string;
  /** Bosqich chizig'idagi nom («Guruhda»). */
  step: string;
  dot: string;
  badge: string;
}

// Rasmdagidek: «Rad etdi» — BETARAF (kulrang), komponentlar rasmidagi qizil emas
// (design/v2/SAVOLLAR.md, 88). «Sinov darsi» o'rniga «Birinchi dars» (8).
export const HOLAT_V2: Record<LeadHolat, HolatTone> = {
  yangi: { label: "Yangi", card: "Yangi", step: "Yangi", dot: "bg-v2-holat-yangi", badge: "bg-v2-holat-yangi-bg text-v2-holat-yangi" },
  bog: { label: "Bog'lanildi", card: "Bog'lanildi", step: "Bog'lanildi", dot: "bg-v2-holat-bog", badge: "bg-v2-holat-bog-bg text-v2-holat-bog" },
  sinov: { label: "Birinchi dars", card: "Birinchi darsga yozildi", step: "Birinchi dars", dot: "bg-v2-holat-sinov", badge: "bg-v2-holat-sinov-bg text-v2-holat-sinov" },
  guruh: { label: "Guruhga qo'shildi", card: "Guruhga qo'shildi", step: "Guruhda", dot: "bg-v2-holat-guruh", badge: "bg-v2-holat-guruh-bg text-v2-holat-guruh" },
  rad: { label: "Rad etdi", card: "Rad etdi", step: "Rad etdi", dot: "bg-v2-text-3", badge: "bg-v2-surface-2 text-v2-text-2" },
};

/** Ko'rsatkich kartalari tartibi (Barchasi alohida). */
export const HOLAT_ORDER: readonly LeadHolat[] = ["yangi", "bog", "sinov", "guruh", "rad"];

/** Yangi lid shuncha vaqtdan keyin «kechikkan» (eski sahifa bilan bir xil). */
export const LATE_MS = 24 * HOUR_MS;

/* ───────────────────────── Sana va vaqt ───────────────────────── */

/** "YYYY-MM-DD" → JS hafta kuni (0 = yakshanba), kalendar kuni bo'yicha. */
export function weekdayOfIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
}

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n)).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → mahalliy Date (taqvim tanlovlari uchun). */
export function dateOfIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Mahalliy Date → "YYYY-MM-DD" (kalendar kuni). */
export function isoOfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Guruh vaqtining boshi: "14:00 - 16:00" → "14:00", "9:00" → "09:00". */
export function startTimeOf(time: string | undefined): string {
  const m = /(\d{1,2}):(\d{2})/.exec(time || "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Shuncha vaqtdan beri: <1 soat — daqiqa, <1 kun — soat, keyin kun. */
export function sinceParts(delta: number): { n: number; unit: "min" | "hour" | "day" } {
  const a = Math.max(0, delta);
  if (a < HOUR_MS) return { n: Math.max(1, Math.floor(a / 60_000)), unit: "min" };
  if (a < DAY_MS) return { n: Math.floor(a / HOUR_MS), unit: "hour" };
  return { n: Math.floor(a / DAY_MS), unit: "day" };
}

/** «Abdulloh Raxmatullayev» → «Abdulloh R.» (rasmdagi tarix qatori). */
export function shortName(full: string | undefined): string {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/** 9 raqam → «90 123 45 67» va qo'ng'iroq uchun «+998901234567». */
export function phoneParts(raw: string | undefined): { show: string; tel: string } | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw ? { show: raw, tel: raw.replace(/[^\d+]/g, "") } : null;
  return { show: `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`, tel: `+998${local}` };
}

/** Sana va vaqt — yangi versiya ko'rinishida («11-oktyabr | 09:15», «Chorshanba»). */
export function useLeadV2Fmt() {
  const [lang] = useLang();
  const { t } = useT();
  return useMemo(() => {
    /** "YYYY-MM-DD" → «12-oktyabr» (boshqa yil — yili bilan). */
    const day = (iso: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? dayMonthLabel(dateOfIso(iso), lang) : iso);
    /** Lahza (Toshkent) → «11-oktyabr | 09:15». */
    const stamp = (ms: number): string => (Number.isFinite(ms) ? `${day(uzDateOf(ms))} | ${uzTimeOf(ms)}` : "—");
    /** Hafta kuni nomi («Chorshanba»). */
    const weekday = (iso: string): string => WEEKDAYS_FULL[lang][(weekdayOfIso(iso) + 6) % 7] ?? "";
    /** Dars kuni — bugun / ertaga / shu hafta ichida hafta kuni / aks holda sana. */
    const lessonDay = (iso: string, nowMs: number): string => {
      const today = uzDateOf(nowMs);
      if (iso === today) return t("Bugun");
      if (iso === addDaysIso(today, 1)) return t("Ertaga");
      if (iso > today && iso <= addDaysIso(today, 6)) return weekday(iso);
      return day(iso);
    };
    /** «14-oktyabr, chorshanba». */
    const dayWithWeekday = (iso: string): string => `${day(iso)}, ${weekday(iso).toLowerCase()}`;
    const since = (delta: number): string => {
      const { n, unit } = sinceParts(delta);
      return unit === "min" ? t("{n} daqiqadan beri", { n }) : unit === "hour" ? t("{n} soatdan beri", { n }) : t("{n} kundan beri", { n });
    };
    return { t, lang, day, stamp, weekday, lessonDay, dayWithWeekday, since };
  }, [lang, t]);
}

export type LeadV2Fmt = ReturnType<typeof useLeadV2Fmt>;

/* ───────────────────────── Guruhlar ───────────────────────── */

type GroupWithBranch = Group & { branchId?: number };

const norm = (s: string | undefined) => String(s ?? "").trim().toLowerCase().replace(/[ʻʼ`‘’]/g, "'");

/**
 * Lidni yozsa bo'ladigan guruhlar: arxivlanmagan, lid filialida (yoki u bilan
 * bitta hovuzda — lib/branchPools.ts). Eski oyna bilan bir xil qoida, ustiga
 * arxiv (tugagan) guruhlar chiqarib tashlandi.
 */
export function liveGroupsFor(o: Pick<Order, "branchId">, groups: Group[]): Group[] {
  return (groups as GroupWithBranch[]).filter(
    (g) => g.status !== "archive" && g.status !== "finished" && (g.branchId == null || o.branchId == null || sameBranchPool(g.branchId, o.branchId)),
  );
}

/** Lid kursi bo'yicha: mos guruhlar va qolganlari (nomi bo'yicha). */
export function splitByCourse(o: Pick<Order, "course">, list: Group[]): { match: Group[]; other: Group[] } {
  const c = norm(o.course);
  const isMatch = (g: Group) => !!c && norm(g.course) === c;
  const byName = (a: Group, b: Group) => String(a.course || a.name).localeCompare(String(b.course || b.name), "uz", { numeric: true }) || a.id - b.id;
  return { match: list.filter(isMatch).sort(byName), other: list.filter((g) => !isMatch(g)).sort(byName) };
}

/**
 * Sinov (birinchi) darsi QAYSI GURUHDA — bazada alohida yozilmaydi (sinov darsi
 * `firstLesson` + `teacher`, lib/leadHolat.ts). Shu bois topiladi: o'sha
 * o'qituvchining, o'sha soatda boshlanadigan va o'sha hafta kunida dars bo'ladigan
 * guruhi; bir nechta bo'lsa — lid kursidagisi. Aniq bitta chiqmasa — null
 * (xona ko'rsatilmaydi, «Birinchi dars shu guruhda» belgisi chiqmaydi).
 */
export function trialGroupOf(o: Order, groups: Group[]): Group | null {
  const s = sinovOf(o);
  if (!s || !s.vaqt) return null;
  const wd = weekdayOfIso(s.sana);
  const teacher = norm(s.oqituvchi);
  const course = norm(o.course);
  const cands = liveGroupsFor(o, groups).filter((g) => {
    if (startTimeOf(g.time) !== s.vaqt) return false;
    const days = groupWeekdays(g.day);
    if (days.length && !days.includes(wd)) return false;
    if (teacher) return norm(g.teacher) === teacher;
    return !!course && norm(g.course) === course;
  });
  if (cands.length <= 1) return cands[0] ?? null;
  const byCourse = cands.filter((g) => !!course && norm(g.course) === course);
  return byCourse.length === 1 ? byCourse[0] : null;
}

/**
 * Guruhning KEYINGI darsi ("YYYY-MM-DD") — dars kunlari jadvalidan; bugungi dars
 * boshlangan bo'lsa keyingisi. Guruh hali boshlanmagan bo'lsa — boshlanish
 * sanasidan; jadvali o'qilmasa yoki 3 hafta ichida dars yo'q bo'lsa — null.
 */
export function nextLessonIso(g: Pick<Group, "day" | "time" | "startDate" | "endDate">, nowMs: number): string | null {
  const days = groupWeekdays(g.day);
  if (!days.length) return null;
  const today = uzDateOf(nowMs);
  const start = startTimeOf(g.time);
  const isIso = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = isIso(g.startDate) && (g.startDate as string) > today ? (g.startDate as string) : today;
  for (let i = 0; i < 21; i++) {
    const iso = addDaysIso(from, i);
    if (isIso(g.endDate) && iso > (g.endDate as string)) return null;
    if (!days.includes(weekdayOfIso(iso))) continue;
    if (iso === today && start) {
      const at = uzWallToMs(iso, start);
      if (Number.isFinite(at) && at <= nowMs) continue;
    }
    return iso;
  }
  return null;
}

/* ───────────────────────── Keyingi qadam ───────────────────────── */

export type NextStep =
  /** Birinchi dars bugun — vaqti va xonasi. */
  | { kind: "lessonToday"; vaqt: string; room: string }
  /** Yangi lid — qo'ng'iroq; 24 soatdan oshgan bo'lsa `late`. */
  | { kind: "call"; since: number; late: boolean; dup: boolean }
  /** Bog'lanilgan — birinchi darsga yozish kerak. */
  | { kind: "schedule" }
  /** Birinchi dars oldinda. */
  | { kind: "lessonSoon"; sana: string; vaqt: string }
  /** Birinchi dars o'tdi — guruhga qo'shish (kelmagan bo'lsa — qayta yozish). */
  | { kind: "lessonPast"; missed: boolean }
  /** «Birinchi dars» holatida, lekin sana yo'q (Telegram tugmasidan). */
  | { kind: "lessonNoDate" }
  | { kind: "joined" }
  | { kind: "rejected"; reason: string };

export function nextStepOf(r: LeadRow, nowMs: number, groups: Group[]): NextStep {
  const o = r.o;
  switch (r.holat) {
    case "yangi": {
      const since = Number.isFinite(r.at) ? nowMs - r.at : 0;
      return { kind: "call", since, late: since > LATE_MS, dup: r.dupOf !== null };
    }
    case "bog":
      return { kind: "schedule" };
    case "sinov": {
      const s = sinovOf(o);
      if (!s) return { kind: "lessonNoDate" };
      const today = uzDateOf(nowMs);
      if (s.sana === today) {
        const g = trialGroupOf(o, groups);
        return { kind: "lessonToday", vaqt: s.vaqt, room: g?.room ?? "" };
      }
      if (s.sana > today) return { kind: "lessonSoon", sana: s.sana, vaqt: s.vaqt };
      return { kind: "lessonPast", missed: o.firstLessonStatus === "KELMADI" };
    }
    case "guruh":
      return { kind: "joined" };
    case "rad":
      return { kind: "rejected", reason: o.radSabab || "" };
  }
}

/**
 * «Keyingi qadam» bo'yicha saralash (shoshilinchi tepada): bugungi birinchi dars
 * (soati bo'yicha) → kechikkan yangi lid → yangi lid (eng uzoq kutgani oldin) →
 * bog'lanilgan → o'tgan / sanasiz birinchi dars → oldindagi birinchi dars →
 * guruhga qo'shilgan → rad etilgan (oxirgi o'zgargani oldin).
 */
export function nextRank(step: NextStep, r: LeadRow): [number, number] {
  const holatAt = Date.parse(r.o.holatAt ?? "") || r.at || 0;
  const lessonMs = () => {
    const s = sinovOf(r.o);
    return s ? uzWallToMs(s.sana, s.vaqt || "23:59") || 0 : 0;
  };
  switch (step.kind) {
    case "lessonToday":
      return [0, lessonMs()];
    case "call":
      return [step.late ? 1 : 2, r.at || 0];
    case "schedule":
      return [3, holatAt];
    case "lessonPast":
    case "lessonNoDate":
      return [4, lessonMs()];
    case "lessonSoon":
      return [5, lessonMs()];
    case "joined":
      return [6, -holatAt];
    case "rejected":
      return [7, -holatAt];
  }
}

/* ───────────────────────── Daraja va javoblar ───────────────────────── */

/** «1-bosqich» + «2-bosqich» → «1–2-bosqich»; boshqacha bo'lsa «A–B» (qavsdagi izohsiz: «Boshlang'ich (0 dan)» → «Boshlang'ich»). */
function compactRange(lo: string, hi: string): string {
  const a = /^(\d+)-(.+)$/.exec(lo);
  const b = /^(\d+)-(.+)$/.exec(hi);
  if (a && b && a[2] === b[2]) return `${a[1]}–${b[1]}-${a[2]}`;
  const short = (s: string) => s.replace(/\s*\([^)]*\)/g, "").trim() || s;
  return `${short(lo)}–${short(hi)}`;
}

/** Jadvaldagi qisqa daraja («· 1–2-bosqich», «· 7-sinf»). */
export function levelShort(o: Order, settings: LeadSettings | null, t: TFn): string {
  if (o.daraja && hasDaraja(o.yonalish) && settings) {
    const i = darajaInfo(o.daraja, settings.bosqichlar);
    if (i.test) return t("Test kerak");
    return i.aniq ? t(i.near) : compactRange(t(i.lo), t(i.hi));
  }
  if (o.sinf) return t(o.sinf);
  return (o.level || "").trim();
}

/** Paneldagi «Taxminiy daraja» («1–2-bosqich oralig'i»). */
export function levelLong(o: Order, settings: LeadSettings | null, t: TFn): string {
  if (!(o.daraja && hasDaraja(o.yonalish) && settings)) return "";
  const i = darajaInfo(o.daraja, settings.bosqichlar);
  if (i.test) return t("Bilmaydi — daraja testi kerak");
  return i.aniq ? t(i.near) : t("{range} oralig'i", { range: compactRange(t(i.lo), t(i.hi)) });
}

/** «Tushdan keyin (13:00–18:00)» → «Tushdan keyin, 13:00–18:00» (rasmdagidek). */
export function qulayVaqtText(v: string): string {
  return v.replace(/\s*\((.+)\)\s*$/, ", $1");
}

/* ───────────────────────── Bekor qilish ───────────────────────── */

/** Oxirgi o'zgarishni bekor qilish: necha daqiqa qoldi va mumkinmi (10 daq — har kim, keyin — direktor). */
export function undoState(o: Order, nowMs: number, isAdmin: boolean): { has: boolean; left: number; can: boolean } {
  const stack = Array.isArray(o.holatOldin) ? o.holatOldin : [];
  const last = stack[stack.length - 1];
  if (!last) return { has: false, left: 0, can: false };
  const left = UNDO_MINUTES - Math.floor(Math.max(0, nowMs - Date.parse(last.at)) / 60_000);
  return { has: true, left: Math.max(0, left), can: left > 0 || isAdmin };
}

/** Bosqich chizig'idagi o'rni (rad — oxirgi faol bosqich bilan). */
export function stepIndexOf(h: LeadHolat): number {
  return HOLAT_STEPS.indexOf(h);
}

/* ───────────────────────── Tarix ───────────────────────── */

export interface TimelineItem {
  at: number;
  title: string;
  sub: string;
}

/**
 * Panel tarixi — YANGISI TEPADA (rasmdagidek). Manba eski kartadagi bilan bir xil
 * (`created`, `holatTarix`, Telegram belgisi — components/leads/leadsCommon.ts →
 * timelineOf); yozuvlar yangi nomlarda: «Lid qo'shildi · sayt so'rovnomasi»,
 * «Birinchi darsga yozildi · 12-oktyabr, 14:00».
 */
export function leadTimelineV2(r: LeadRow, f: LeadV2Fmt): TimelineItem[] {
  const { t } = f;
  const o = r.o;
  const out: TimelineItem[] = [];
  const survey = isSelfServeSource(o.source);
  const via = o.source === SURVEY_SOURCE ? t("sayt so'rovnomasi") : o.source === BOT_SOURCE ? t("Telegram bot") : o.source ? t(o.source) : "";
  out.push({
    at: r.at,
    title: via ? t("Lid qo'shildi · {source}", { source: via }) : t("Lid qo'shildi"),
    sub: !survey && o.moderator ? shortName(o.moderator) : "",
  });
  if (r.dupOf !== null) out.push({ at: r.at, title: t("Takroriy raqam — avvalgi lid #{n}", { n: r.dupOf }), sub: "" });

  const name = (h: LeadHolat | undefined) => (h ? t(HOLAT_V2[h].card) : "—");
  const events = Array.isArray(o.holatTarix) ? o.holatTarix : [];
  for (const e of events) {
    const at = Date.parse(e.at);
    const by = shortName(e.by);
    if (e.kind === "undo") {
      out.push({ at, title: t("Bekor qilindi: {from} → {to}", { from: name(e.from), to: name(e.holat) }), sub: by });
      continue;
    }
    if (e.kind !== "holat" && e.kind !== "telegram") continue;
    const h = e.holat ?? "yangi";
    let title = h === "sinov" && e.from === "sinov" ? t("Birinchi dars ko'chirildi") : name(h);
    let detail = "";
    if (h === "sinov" && e.sinov) detail = [f.day(e.sinov.sana), e.sinov.vaqt].filter(Boolean).join(", ");
    if (h === "guruh" && e.guruhNom) detail = e.guruhNom;
    if (h === "rad" && e.radSabab) detail = t(e.radSabab);
    if (detail) title = `${title} · ${detail}`;
    const skipped = e.skipped?.length ? t("o'tkazib yuborildi: {list}", { list: e.skipped.map((s) => t(HOLAT_V2[s].step)).join(", ") }) : "";
    const who = e.kind === "telegram" ? [t("Telegram orqali"), by] : [by];
    out.push({ at, title, sub: [...who, skipped].filter(Boolean).join(" · ") });
  }
  if (!events.some((e) => e.kind === "telegram") && o.leadStatus && o.leadStatusAt) {
    const opt = leadStatusOption(o.leadStatus);
    if (opt) {
      const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{1,2}):(\d{2}))?/.exec(o.leadStatusAt);
      const at = m ? uzWallToMs(`${m[3]}-${m[2]}-${m[1]}`, `${(m[4] ?? "00").padStart(2, "0")}:${m[5] ?? "00"}`) : Date.parse(o.leadStatusAt);
      out.push({ at, title: t(opt.label), sub: [t("Telegram orqali"), shortName(o.leadStatusBy)].filter(Boolean).join(" · ") });
    }
  }
  return out.filter((x) => Number.isFinite(x.at)).sort((a, b) => b.at - a.at);
}
