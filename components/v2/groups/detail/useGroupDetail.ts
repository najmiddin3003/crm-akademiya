"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AttendanceMark } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import type { GamView, Member } from "./groupDetailBits";

// YANGI VERSIYA — GURUH SAHIFASINING MA'LUMOTI. Manbalar eski sahifa bilan bir xil:
//   GET /api/groups/:id               — guruh (+ `monthlyPrice`, 24.10.2026);
//   GET /api/groups/:id/students      — a'zolar (+ `joinedAt`);
//   GET /api/groups/:id/attendance    — oy belgilari;
//   GET /api/gamification/lesson      — bugungi dars tangalari (+ `?month=` — oy bo'yicha jami).
// setState faqat promise callback'ida (react-hooks/set-state-in-effect); qayta yuklashda
// eski ma'lumot ko'rinib turadi.

export type GroupState =
  | { kind: "loading" }
  | { kind: "ok"; group: Group & { branchId?: number | null }; monthlyPrice: number | null }
  | { kind: "notfound" }
  | { kind: "error" };

export function useGroup(id: number) {
  const [state, setState] = useState<GroupState>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let off = false;
    fetch(`/api/groups/${id}`, { cache: "no-store" })
      .then(async (r) => ({ status: r.status, d: await r.json().catch(() => null) }))
      .then(({ status, d }) => {
        if (off) return;
        if (d?.ok) setState({ kind: "ok", group: d.group, monthlyPrice: typeof d.monthlyPrice === "number" ? d.monthlyPrice : null });
        else setState((cur) => (cur.kind === "ok" ? cur : status === 404 ? { kind: "notfound" } : { kind: "error" }));
      })
      .catch(() => {
        if (!off) setState((cur) => (cur.kind === "ok" ? cur : { kind: "error" }));
      });
    return () => {
      off = true;
    };
  }, [id, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}

export function useMembers(id: number) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let off = false;
    fetch(`/api/groups/${id}/students`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!off) setMembers(d?.ok ? (d.students as Member[]) : []);
      })
      .catch(() => {
        if (!off) setMembers((cur) => cur ?? []);
      });
    return () => {
      off = true;
    };
  }, [id, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { members, reload };
}

/** Oy belgilari ("YYYY-MM"). `null` — yuklanmoqda. */
export function useMonthMarks(groupId: number, monthKey: string) {
  const [data, setData] = useState<{ key: string; marks: AttendanceMark[] } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let off = false;
    const [y, m] = monthKey.split("-").map(Number);
    fetch(`/api/groups/${groupId}/attendance?year=${y}&month=${m}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!off) setData({ key: `${groupId}:${monthKey}`, marks: d?.ok ? (d.marks as AttendanceMark[]) : [] });
      })
      .catch(() => {
        if (!off) setData((cur) => cur ?? { key: `${groupId}:${monthKey}`, marks: [] });
      });
    return () => {
      off = true;
    };
  }, [groupId, monthKey, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  /** Optimistik yangilash (jurnal katagi). */
  const patch = useCallback((fn: (marks: AttendanceMark[]) => AttendanceMark[]) => setData((cur) => (cur ? { ...cur, marks: fn(cur.marks) } : cur)), []);
  // Boshqa oy (yoki guruh) uchun eski javob ko'rsatilmasin.
  const marks = data && data.key === `${groupId}:${monthKey}` ? data.marks : null;
  return { marks, reload, patch };
}

/**
 * Gamifikatsiya: bugungi dars (tangalar, sabablar, ruxsat). `month` — jurnaldagi oy
 * bo'yicha jami. Xodimda gamifikatsiya ruxsati bo'lmasa yoki modul o'chiq — `view` null /
 * `enabled: false`: tanga ustunlari yashiriladi.
 */
export function useGamView(groupId: number, month: string) {
  const [view, setView] = useState<GamView | null | undefined>(undefined);
  // Eng oxirgi so'rov javobi qo'llanadi (qayta yuklash va oy almashishi ustma-ust tushsa).
  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    const v = await fetchGamView(groupId, month);
    if (my === seq.current) setView((cur) => (v === undefined ? (cur ?? null) : v));
  }, [groupId, month]);
  useEffect(() => {
    const my = ++seq.current;
    fetchGamView(groupId, month).then((v) => {
      if (my === seq.current) setView((cur) => (v === undefined ? (cur ?? null) : v));
    });
    return () => {
      seq.current += 1;
    };
  }, [groupId, month]);
  /** Qayta yuklaydi; javob kelganda tugaydi (tanga oynasi yangi balansni kutadi). */
  const reload = load;
  return { view, reload };
}

/** `undefined` — tarmoq xatosi (eski ko'rinish qoladi), `null` — ruxsat yo'q / modul yo'q. */
async function fetchGamView(groupId: number, month: string): Promise<GamView | null | undefined> {
  try {
    const r = await fetch(`/api/gamification/lesson?groupId=${groupId}&month=${month}`, { cache: "no-store" });
    const d = await r.json().catch(() => null);
    if (!d?.ok) return null;
    // Xodim bu guruhni ko'ra olmasa server boshqa guruhni qaytaradi — bu guruh uchun yo'q deb olamiz.
    if (d.group?.id === groupId) return d as GamView;
    return { ...(d as GamView), group: null, rows: [], canTeach: false, monthCoins: {} };
  } catch {
    return undefined;
  }
}

/* ── Hozirgi daqiqa (dars boshlanishiga / boshlanganiga) ─────────────── */

const subscribeMinute = (cb: () => void) => {
  const id = window.setInterval(cb, 20_000);
  return () => window.clearInterval(id);
};
const minuteSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;

/** Daqiqaga yaxlitlangan «hozir» (ms); serverda — null (gidratatsiya farqi bo'lmasin). */
export function useMinuteNow(): number | null {
  return useSyncExternalStore(subscribeMinute, minuteSnapshot, () => null);
}
