"use client";

import { useEffect, useMemo, useState } from "react";
import { useGroups } from "@/hooks/useGroups";
import type { Group } from "@/lib/groups";
import type { AttendanceStatus } from "@/lib/attendance";

// Nazorat bo'limidagi davomatga tayanadigan sahifalarning umumiy manbasi.
//
// NEGA shunday: `attendance` kolleksiyasi uchun global API route yo'q — faqat
// GET /api/groups/:id/attendance bor. Shuning uchun avval /api/groups dan
// guruhlar olinadi, keyin har bir guruhning belgilari parallel tortiladi va
// bitta ro'yxatga birlashtiriladi. Ilgari bu sahifalar (Davomat, Davomat
// analitikasi, Davomat qilinmagan guruhlar) sonlarni indeks arifmetikasi va
// LCG generatorlari bilan o'ylab topardi — endi hammasi bazadagi haqiqiy
// belgilardan hisoblanadi.

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
    if (groupsLoading) return;
    let cancelled = false;

    // Guruh bo'lmasa ham Promise.all([]) ishlatiladi: u mikrotaskda hal
    // bo'ladi, ya'ni setState effekt tanasida SINXRON chaqirilmaydi
    // (react-hooks/set-state-in-effect qoidasi shuni talab qiladi).
    Promise.all(
      groups.map((g) =>
        fetch(`/api/groups/${g.id}/attendance`)
          .then((r) => r.json())
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const all: AttendanceMarkRow[] = [];
        for (const d of results) {
          if (d?.ok && Array.isArray(d.marks)) all.push(...(d.marks as AttendanceMarkRow[]));
        }
        setMarks(all);
      })
      .finally(() => { if (!cancelled) setMarksLoading(false); });

    return () => { cancelled = true; };
  }, [groups, groupsLoading]);

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
