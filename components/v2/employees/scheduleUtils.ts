// YANGI VERSIYA — XODIM PROFILI → «GURUHLAR VA JADVAL» HISOBI (rasm «Xodim profili»,
// 20.10.2026). Sof funksiyalar: guruh kuni («Toq kunlar», «Du,Ju» …) va vaqti
// («14:00 - 16:00») → hafta kunlari bo'yicha bandlik, BIR VAQTGA TO'G'RI KELGAN
// guruhlar va haftalik soat (ustma-ust vaqt bir marta sanaladi — rasmdagi «3 ta guruh ·
// haftada 12 soat»: 14–16 dagi ikki guruh + 16–18, uch kun).
//
// Kun qoidasi Dars jadvali bilan BITTA: constants/groupsSchedule.js →
// weekdaysForDayPattern (Toq kunlar = Du/Chor/Ju, Juft = Se/Pa/Sha, erkin «Du,Ch,Sh»).

import { SCHEDULE_DAY_ORDER, weekdaysForDayPattern } from "@/constants/groupsSchedule";

/** Hafta kuni indeksi — SCHEDULE_DAY_ORDER bo'yicha (0 — yakshanba, 1 — dushanba …). */
export type DayIndex = number;

export interface ScheduleGroup {
  id: number;
  day: string;
  time: string;
}

export interface Slot<G extends ScheduleGroup = ScheduleGroup> {
  group: G;
  day: DayIndex;
  /** Daqiqada, kun boshidan. */
  start: number;
  end: number;
}

/** "14:00 - 16:00" → { start: 840, end: 960 }; o'qib bo'lmasa null. */
export function parseTimeRange(time: string | undefined): { start: number; end: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/.exec(time || "");
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return end > start ? { start, end } : null;
}

/** Guruhning hafta kunlari (indekslar). */
export function groupDays(day: string | undefined): DayIndex[] {
  const names = (weekdaysForDayPattern(day || "") as string[]) ?? [];
  return names.map((n) => SCHEDULE_DAY_ORDER.indexOf(n)).filter((i) => i >= 0);
}

export function slotsOf<G extends ScheduleGroup>(groups: G[]): Slot<G>[] {
  const out: Slot<G>[] = [];
  for (const g of groups) {
    const r = parseTimeRange(g.time);
    if (!r) continue;
    for (const day of groupDays(g.day)) out.push({ group: g, day, start: r.start, end: r.end });
  }
  return out;
}

/** Jadvalda ko'rsatiladigan kunlar: Du–Sha doim, yakshanba — faqat darsi bo'lsa (oxirida). */
export function visibleDays(slots: Slot[]): DayIndex[] {
  const days = [1, 2, 3, 4, 5, 6];
  if (slots.some((s) => s.day === 0)) days.push(0);
  return days;
}

/** Soat oralig'i (butun soatlarga yaxlitlangan): eng erta boshlanish — eng kech tugash. */
export function hourRange(slots: Slot[]): { from: number; to: number } | null {
  if (slots.length === 0) return null;
  const from = Math.floor(Math.min(...slots.map((s) => s.start)) / 60);
  const to = Math.ceil(Math.max(...slots.map((s) => s.end)) / 60);
  return { from, to: Math.max(to, from + 1) };
}

/** Haftalik band vaqt (daqiqa): har kunda ustma-ust oraliqlar BIRLASHTIRILIB sanaladi. */
export function weeklyMinutes(slots: Slot[]): number {
  let total = 0;
  const byDay = new Map<DayIndex, { start: number; end: number }[]>();
  for (const s of slots) {
    const list = byDay.get(s.day) ?? [];
    list.push({ start: s.start, end: s.end });
    byDay.set(s.day, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start);
    let curS = -1;
    let curE = -1;
    for (const r of list) {
      if (r.start >= curE) {
        if (curE > curS) total += curE - curS;
        curS = r.start;
        curE = r.end;
      } else curE = Math.max(curE, r.end);
    }
    if (curE > curS) total += curE - curS;
  }
  return total;
}

/**
 * Bir kunda ustma-ust tushgan bandlar — «ustun» joylashuvi uchun: har bandga o'z
 * qatoridagi o'rni (`lane`) va shu to'qnashuv to'plamidagi bandlar soni (`lanes`).
 */
export function layoutDay<G extends ScheduleGroup>(slots: Slot<G>[]): { slot: Slot<G>; lane: number; lanes: number; clash: boolean }[] {
  const sorted = [...slots].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: { slot: Slot<G>; lane: number; lanes: number; clash: boolean }[] = [];
  let cluster: { slot: Slot<G>; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = cluster.reduce((m, c) => Math.max(m, c.lane + 1), 0);
    for (const c of cluster) out.push({ slot: c.slot, lane: c.lane, lanes, clash: cluster.length > 1 });
    cluster = [];
  };
  for (const s of sorted) {
    if (cluster.length > 0 && s.start >= clusterEnd) flush();
    // Bo'sh qator: shu to'plamda tugab bo'lgan bandning o'rni.
    const used = new Set(cluster.filter((c) => c.slot.end > s.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    cluster.push({ slot: s, lane });
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  if (cluster.length > 0) flush();
  return out;
}

export interface Clash<G extends ScheduleGroup = ScheduleGroup> {
  /** Ustma-ust tushgan guruhlar (takrorsiz, tartib — boshlanish vaqti bo'yicha). */
  groups: G[];
  /** Qaysi kunlarda (indekslar, tartibda). */
  days: DayIndex[];
  /** Ustma-ust qismi (daqiqa). */
  start: number;
  end: number;
}

/**
 * BIR VAQTGA TO'G'RI KELGAN GURUHLAR: har kunda kesishgan juftliklar; bir xil guruhlar
 * to'plami va bir xil oraliq bir necha kunda takrorlansa — bitta yozuv, kunlari bilan
 * (rasm: «Toq kunlar 14:00–16:00 da ikki guruh bir vaqtga to'g'ri kelgan: …»).
 */
export function findClashes<G extends ScheduleGroup>(slots: Slot<G>[]): Clash<G>[] {
  const byKey = new Map<string, Clash<G>>();
  const days = [...new Set(slots.map((s) => s.day))].sort((a, b) => a - b);
  for (const day of days) {
    const list = slots.filter((s) => s.day === day).sort((a, b) => a.start - b.start);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (b.start >= a.end) break;
        if (a.group.id === b.group.id) continue;
        const start = Math.max(a.start, b.start);
        const end = Math.min(a.end, b.end);
        const ids = [a.group.id, b.group.id].sort((x, y) => x - y);
        const key = `${ids.join(",")}|${start}|${end}`;
        const c = byKey.get(key) ?? { groups: [a.group, b.group], days: [], start, end };
        if (!c.days.includes(day)) c.days.push(day);
        byKey.set(key, c);
      }
    }
  }
  return [...byKey.values()].sort((x, y) => x.days[0] - y.days[0] || x.start - y.start);
}

/** 840 → "14:00". */
export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
