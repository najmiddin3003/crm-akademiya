"use client";

import { useEffect, useMemo, useState } from "react";
import { useGroups } from "@/hooks/useGroups";
import type { Group } from "@/lib/groups";
import type { AttendanceStatus } from "@/lib/attendance";

// Nazorat bo'limidagi davomatga tayanadigan sahifalarning umumiy manbasi.
//
// Belgilar BITTA so'rovda keladi — GET /api/attendance.
//
// Ilgari bunday route yo'q edi (faqat GET /api/groups/:id/attendance), shu
// bois bu hook har bir guruh uchun alohida so'rov yuborardi. Bazada 91 ta
// guruh bor, ya'ni uchala Nazorat sahifasi har ochilganda 91 ta HTTP
// so'rovi ketardi — har biri o'zining ensureIndexes() va Atlas
// round-trip'i bilan, brauzerning 6 ta ulanish chegarasi tufayli ~16
// to'lqinga bo'linib.
//
// Guruh bo'yicha ajratish shu yerda qoladi: javobdagi har bir belgida
// `groupId` bor va shakl eski route bilan aynan bir xil, shuning uchun
// sahifalardagi hisob mantiqi tegilmagan.
//
// Guruhlar ro'yxati baribir kerak (jadval qatorlarida guruh nomi va
// o'qituvchisi ko'rsatiladi), shuning uchun u `useGroups` dan olinaveradi.
//
// Ilgari bu sahifalar (Davomat, Davomat analitikasi, Davomat qilinmagan
// guruhlar) sonlarni indeks arifmetikasi va LCG generatorlari bilan o'ylab
// topardi — endi hammasi bazadagi haqiqiy belgilardan hisoblanadi.

export interface AttendanceMarkRow {
  groupId: number;
  pupilId: number;
  /** "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  grade: number | null;
  reason: string | null;
  note: string | null;
}

export interface NazoratAttendance {
  groups: Group[];
  /** groups.id → guruh (jadval qatorlarida guruh nomi/o'qituvchisi kerak). */
  groupById: Map<number, Group>;
  marks: AttendanceMarkRow[];
  loading: boolean;
}

export function useNazoratAttendance(): NazoratAttendance {
  const { groups, loading: groupsLoading } = useGroups();
  const [marks, setMarks] = useState<AttendanceMarkRow[]>([]);
  const [marksLoading, setMarksLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok && Array.isArray(d.marks)) setMarks(d.marks as AttendanceMarkRow[]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMarksLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  return { groups, groupById, marks, loading: groupsLoading || marksLoading };
}

/** "2026-08-24" → Date (mahalliy vaqt; `new Date(iso)` UTC deb o'qib kunni surib yuboradi). */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Sanani mahalliy vaqt bo'yicha "YYYY-MM-DD" ga aylantiradi. */
export function dateToIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-08-24" → "24.08.2026" (jadvallardagi ko'rinish). */
export function isoToLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}
