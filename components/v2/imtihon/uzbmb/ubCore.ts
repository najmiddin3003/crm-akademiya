"use client";

import { useCallback, useEffect, useState } from "react";
import type { Group } from "@/lib/groups";
import type { Lang } from "@/lib/i18n";
import type { Pupil } from "@/lib/pupilsData";
import { blockSubjects, r1, sameSubject, type UbCells, type UbConfig, type UbResult, type UbScheme, type UbTest, type UbTestRow } from "@/lib/uzbmb";
import type { UbHistoryRow, UbTestData } from "@/lib/uzbmbServer";

// YANGI VERSIYA — IMTIHON → UZBMB: umumiy hook'lar va formatlash (12-qism, 25.10.2026).
// Ma'lumot: /api/imtihon/uzbmb/config (ball tuzilishi, fanlar), /tests (filial testlari),
// /tests/:id (natijalar + taqqoslash), guruh o'quvchilari — /api/groups/:id/students.

export type Dir = { b1s: string; b2s: string };
export const NO_DIR: Dir = { b1s: "", b2s: "" };

/** Ball: bitta kasr, o'zbekchada vergul («74,4»), inglizchada nuqta. */
export function fmtBall(v: number, lang: Lang): string {
  const s = r1(v).toFixed(1);
  return lang === "en" ? s : s.replace(".", ",");
}

/** Maksimal ball / koeffitsiyent: butun bo'lsa kasrsiz («189», «93»), aks holda «3,1». */
export function fmtNum(v: number, lang: Lang): string {
  const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return lang === "en" ? s : s.replace(".", ",");
}

/** O'sish: «+9,5» / «−2,4» / «0,0». */
export function fmtDelta(v: number, lang: Lang): string {
  const s = fmtBall(Math.abs(v), lang);
  return v > 0.04 ? `+${s}` : v < -0.04 ? `−${s}` : s;
}

/** «Biologiya · 9-11-sinflar · 12» — server `ubGroupLabel` bilan bir xil. */
export function groupLabelOf(g: Pick<Group, "id" | "name" | "course" | "level">): string {
  const head = [g.course?.trim(), g.level?.trim()].filter(Boolean).join(" · ");
  const num = (g.name || "").trim();
  if (!head) return num ? `${num}-guruh` : `#${g.id}`;
  return num ? `${head} · ${num}` : head;
}

export const dirLabel = (d: Dir) => (d.b1s && d.b2s ? `${d.b1s} — ${d.b2s}` : d.b1s ? `${d.b1s} — …` : "");
export const sameDir = (a: Dir, b: Dir) => a.b1s === b.b1s && a.b2s === b.b2s;

/* ── Kiritish katagi (matn) ─────────────────────────────────────────────── */

/** Jadvaldagi bitta o'quvchining kiritilayotgan qiymatlari (maydon matni). */
export interface DraftCells {
  b1: string;
  b1cert: boolean;
  b2: string;
  b2cert: boolean;
  m1: string;
  m2: string;
  m3: string;
}

export const EMPTY_DRAFT: DraftCells = { b1: "", b1cert: false, b2: "", b2cert: false, m1: "", m2: "", m3: "" };

/** Sertifikat bali maydonda bitta kasr bilan («93,0» — rasmdagidek). */
const decimalText = (v: number) => r1(v).toFixed(1).replace(".", ",");

export function draftOf(c: UbCells): DraftCells {
  return {
    b1: c.b1cert ? (c.b1m === null ? "" : decimalText(c.b1m)) : c.b1c === null ? "" : String(c.b1c),
    b1cert: c.b1cert,
    b2: c.b2cert ? (c.b2m === null ? "" : decimalText(c.b2m)) : c.b2c === null ? "" : String(c.b2c),
    b2cert: c.b2cert,
    m1: c.m1 === null ? "" : String(c.m1),
    m2: c.m2 === null ? "" : String(c.m2),
    m3: c.m3 === null ? "" : String(c.m3),
  };
}

const intOrNull = (s: string): number | null => (s.trim() === "" ? null : Math.trunc(Number(s)));
const decOrNull = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (t === "" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? r1(n) : null;
};

export function cellsOf(d: DraftCells): UbCells {
  return {
    b1c: d.b1cert ? null : intOrNull(d.b1),
    b1cert: d.b1cert,
    b1m: d.b1cert ? decOrNull(d.b1) : null,
    b2c: d.b2cert ? null : intOrNull(d.b2),
    b2cert: d.b2cert,
    b2m: d.b2cert ? decOrNull(d.b2) : null,
    m1: intOrNull(d.m1),
    m2: intOrNull(d.m2),
    m3: intOrNull(d.m3),
  };
}

/** To'g'ri javoblar maydoni: faqat raqam, savollar sonidan oshsa — shunga qisqaradi. */
export function countInput(raw: string, q: number): string {
  let v = raw.replace(/\D/g, "").slice(0, 3);
  if (v !== "" && Number(v) > q) v = String(q);
  return v.replace(/^0+(?=\d)/, "");
}

/** Sertifikat bali: raqam va bitta vergul (bitta kasr), eng katta baldan oshmaydi. */
export function ballInput(raw: string, max: number): string {
  let v = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const i = v.indexOf(",");
  if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, "").slice(0, 1);
  v = v.replace(/^0+(?=\d)/, "");
  const n = Number(v.replace(",", "."));
  if (Number.isFinite(n) && n > max) v = String(max).replace(".", ",");
  return v.slice(0, 5);
}

/* ── Avtomatik yo'nalish ────────────────────────────────────────────────── */

/** Odatdagi juftliklar — guruh kursi blok fani bo'lsa, ikkinchisi shundan (bo'lsa). */
const PARTNER: Record<string, string> = { Biologiya: "Kimyo", Kimyo: "Biologiya", Matematika: "Fizika", Fizika: "Matematika", Geografiya: "Matematika" };

/**
 * «Yo'nalish · avto»: (1) shu testda shu guruh bilan saqlangan natijalarning ko'pchiligi;
 * (2) guruhning oxirgi saqlangan yo'nalishi; (3) guruh nomida ikki blok fani («Biologiya–Kimyo»);
 * (4) guruh kursi blok fani bo'lsa — 1-blok, 2-blok odatiy juftidan. `auto` — ikkalasi topildi.
 */
export function autoDirection(opts: { group: Group | null; saved: UbResult[]; last: Dir | null; config: UbConfig }): { dir: Dir; auto: boolean } {
  const subjects = blockSubjects(opts.config);
  const canon = (name: string) => subjects.find((s) => sameSubject(s.name, name))?.name ?? "";
  const tally = new Map<string, { dir: Dir; n: number }>();
  for (const r of opts.saved) {
    if (!r.b1s || !r.b2s) continue;
    const key = `${r.b1s}|${r.b2s}`;
    const cur = tally.get(key) ?? { dir: { b1s: r.b1s, b2s: r.b2s }, n: 0 };
    cur.n += 1;
    tally.set(key, cur);
  }
  const top = [...tally.values()].sort((a, b) => b.n - a.n)[0];
  if (top) return { dir: top.dir, auto: true };
  if (opts.last && opts.last.b1s && opts.last.b2s) return { dir: opts.last, auto: true };
  const g = opts.group;
  if (!g) return { dir: NO_DIR, auto: false };
  const text = `${g.course ?? ""} ${g.level ?? ""} ${g.name ?? ""}`.toLowerCase();
  const found = subjects
    .map((s) => ({ name: s.name, at: text.indexOf(s.name.toLowerCase()) }))
    .filter((x) => x.at >= 0)
    // «Ona tili va adabiyot» topilsa, uning ichidagi «Ona tili» alohida sanalmasin.
    .filter((x, _, all) => !all.some((y) => y !== x && y.name.length > x.name.length && y.at <= x.at && y.at + y.name.length >= x.at + x.name.length))
    .sort((a, b) => a.at - b.at);
  if (found.length >= 2) return { dir: { b1s: found[0].name, b2s: found[1].name }, auto: true };
  const b1s = canon(g.course ?? "");
  if (!b1s) return { dir: NO_DIR, auto: false };
  const b2s = PARTNER[b1s] ? canon(PARTNER[b1s]) : "";
  return { dir: { b1s, b2s }, auto: Boolean(b2s) };
}

/* ── Hook'lar ───────────────────────────────────────────────────────────── */

export function useUbConfig() {
  const [state, setState] = useState<{ config: UbConfig; canEdit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch("/api/imtihon/uzbmb/config")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          setState({ config: d.config as UbConfig, canEdit: Boolean(d.canEdit) });
          setError(null);
        } else setError(String(d.error || "Sozlama yuklanmadi"));
      })
      .catch(() => alive && setError("Serverga ulanib bo'lmadi"));
    return () => {
      alive = false;
    };
  }, [version]);
  const reload = useCallback(() => {
    setError(null);
    setVersion((v) => v + 1);
  }, []);
  const setConfig = useCallback((config: UbConfig) => setState((s) => (s ? { ...s, config } : { config, canEdit: false })), []);
  return { config: state?.config ?? null, canEdit: state?.canEdit ?? false, error, reload, setConfig };
}

export function useUbTests() {
  const [state, setState] = useState<{ tests: UbTestRow[]; legacyCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch("/api/imtihon/uzbmb/tests")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          setState({ tests: d.tests as UbTestRow[], legacyCount: Number(d.legacyCount) || 0 });
          setError(null);
        } else setError(String(d.error || "Testlar yuklanmadi"));
      })
      .catch(() => alive && setError("Serverga ulanib bo'lmadi"));
    return () => {
      alive = false;
    };
  }, [version]);
  const reload = useCallback(() => {
    setError(null);
    setVersion((v) => v + 1);
  }, []);
  /** Yangi yoki tahrirlangan test — ro'yxatga (raqami bo'yicha teskari tartibda). */
  const upsert = useCallback((t: UbTest, counts?: { resultCount: number; groupCount: number }) => {
    setState((s) => {
      const list = s?.tests ?? [];
      const old = list.find((x) => x.id === t.id);
      const row: UbTestRow = { ...t, resultCount: counts?.resultCount ?? old?.resultCount ?? 0, groupCount: counts?.groupCount ?? old?.groupCount ?? 0 };
      const next = old ? list.map((x) => (x.id === t.id ? row : x)) : [row, ...list];
      return { tests: next.sort((a, b) => b.no - a.no || b.id - a.id), legacyCount: s?.legacyCount ?? 0 };
    });
  }, []);
  const remove = useCallback((id: number) => setState((s) => (s ? { ...s, tests: s.tests.filter((x) => x.id !== id) } : s)), []);
  return { tests: state?.tests ?? null, legacyCount: state?.legacyCount ?? 0, error, reload, upsert, remove };
}

export function useUbTestData(testId: number | null) {
  const [state, setState] = useState<{ id: number; data: UbTestData } | null>(null);
  const [err, setErr] = useState<{ id: number; error: string } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (testId === null) return;
    let alive = true;
    fetch(`/api/imtihon/uzbmb/tests/${testId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          const data: UbTestData = {
            test: d.test,
            prev: d.prev ?? null,
            results: d.results ?? [],
            prevResults: d.prevResults ?? [],
            lastDirections: d.lastDirections ?? {},
            groupLabels: d.groupLabels ?? {},
          };
          setState({ id: testId, data });
          setErr(null);
        } else setErr({ id: testId, error: String(d.error || "Natijalar yuklanmadi") });
      })
      .catch(() => alive && setErr({ id: testId, error: "Serverga ulanib bo'lmadi" }));
    return () => {
      alive = false;
    };
  }, [testId, version]);
  const data = state && state.id === testId ? state.data : null;
  const error = !data && err && err.id === testId ? err.error : null;
  const reload = useCallback(() => {
    setErr(null);
    setVersion((v) => v + 1);
  }, []);
  /** Saqlangandan keyin — server qaytargan yangi ro'yxat. */
  const setResults = useCallback((results: UbResult[]) => setState((s) => (s && s.id === testId ? { ...s, data: { ...s.data, results } } : s)), [testId]);
  const patchTest = useCallback((t: UbTest) => setState((s) => (s && s.id === t.id ? { ...s, data: { ...s.data, test: t } } : s)), []);
  return { data, error, loading: testId !== null && !data && !error, reload, setResults, patchTest };
}

/** Guruh o'quvchilari — guruh almashganda eski ro'yxat bir zum ham ko'rinmaydi. */
export function useGroupMembers(groupId: number | null) {
  const [state, setState] = useState<{ id: number; list: Pupil[] } | null>(null);
  const [err, setErr] = useState<{ id: number; error: string } | null>(null);
  useEffect(() => {
    if (groupId === null) return;
    let alive = true;
    fetch(`/api/groups/${groupId}/students`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) setState({ id: groupId, list: d.students as Pupil[] });
        else setErr({ id: groupId, error: String(d.error || "O'quvchilar yuklanmadi") });
      })
      .catch(() => alive && setErr({ id: groupId, error: "Serverga ulanib bo'lmadi" }));
    return () => {
      alive = false;
    };
  }, [groupId]);
  const list = state && state.id === groupId ? state.list : null;
  const error = !list && err && err.id === groupId ? err.error : null;
  const add = useCallback((p: Pupil) => setState((s) => (s && s.id === groupId ? { ...s, list: [...s.list, p] } : s)), [groupId]);
  return { members: list, error, loading: groupId !== null && !list && !error, add };
}

export function useUbPupilHistory(pupilId: number | null) {
  const [state, setState] = useState<{ id: number; rows: UbHistoryRow[] } | null>(null);
  useEffect(() => {
    if (pupilId === null) return;
    let alive = true;
    fetch(`/api/imtihon/uzbmb/pupils/${pupilId}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setState({ id: pupilId, rows: d.ok ? (d.history as UbHistoryRow[]) : [] });
      })
      .catch(() => alive && setState({ id: pupilId, rows: [] }));
    return () => {
      alive = false;
    };
  }, [pupilId]);
  return state && state.id === pupilId ? state.rows : null;
}

/* ── Varaq qatorlari (kiritish va natijalar uchun bitta qoida) ──────────── */

export interface SheetRow {
  pupilId: number;
  name: string;
  /** Guruh a'zosi (yo'q bo'lsa — natijasi shu guruh bilan saqlangan yoki qo'lda qo'shilgan). */
  member: boolean;
  /** «O'quvchi qo'shish» bilan shu varaqqa qo'shilgan (hali saqlanmagan). */
  added: boolean;
  /** Shu testdagi natijasi (qaysi guruh bilan bo'lsa ham). */
  saved: UbResult | null;
}

/**
 * Varaq: guruh a'zolari (guruh tartibida) + natijasi shu guruh bilan saqlangan boshqalar (masalan
 * guruhdan chiqqan) + qo'lda qo'shilganlar. O'quvchining shu testdagi natijasi bitta — boshqa guruh
 * bilan saqlangan bo'lsa ham ko'rsatiladi (ismi ostida qaysi guruh bilanligi).
 */
export function sheetRows(opts: { members: Pupil[]; results: UbResult[]; groupId: number; added?: { id: number; name: string }[] }): SheetRow[] {
  const byPupil = new Map(opts.results.map((r) => [r.pupilId, r]));
  const out: SheetRow[] = [];
  const seen = new Set<number>();
  for (const p of opts.members) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ pupilId: p.id, name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || `#${p.id}`, member: true, added: false, saved: byPupil.get(p.id) ?? null });
  }
  const extra = opts.results.filter((r) => r.groupId === opts.groupId && !seen.has(r.pupilId)).sort((a, b) => a.student.localeCompare(b.student, "uz"));
  for (const r of extra) {
    seen.add(r.pupilId);
    out.push({ pupilId: r.pupilId, name: r.student || `#${r.pupilId}`, member: false, added: false, saved: r });
  }
  for (const a of opts.added ?? []) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push({ pupilId: a.id, name: a.name, member: false, added: true, saved: byPupil.get(a.id) ?? null });
  }
  return out;
}

export function schemeLabel(s: UbScheme, part: "b1" | "b2" | "maj", lang: Lang): string {
  return `${s[part].q} × ${fmtNum(s[part].k, lang)}`;
}

/** «10-oktabr» — testlar ro'yxati va sana maydoni uchun. */
export function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
