"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { fmtExamDate } from "./SarhisobDetailDrawer";

// IMTIHON → SARHISOB: UMUMIY YADRO — eski tab (SarhisobView.tsx) va yangi versiya
// (components/v2/imtihon/*) ikkalasi shundan (23.10.2026, SarhisobView.tsx dan AYNAN
// ko'chirildi): joriy filialning guruh imtihonlari (`group_exams`, GET
// /api/imtihon/group), oy nomi va CSV qatorlari (Sarhisob_YYYY-MM.csv — ustunlar
// tartibi o'zgarmasin).

export function useGroupExams() {
  const [exams, setExams] = useState<GroupExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/imtihon/group")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setExams(d.exams as GroupExam[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { exams, setExams, loading };
}

/** "2026-10" → "Oktabr 2026" (tanlangan tilda). */
export function useMonthLabel() {
  const { months } = useT();
  return useCallback(
    (m: string) => {
      const x = /^(\d{4})-(\d{2})$/.exec(m);
      return x ? `${months[Number(x[2]) - 1]} ${x[1]}` : m;
    },
    [months],
  );
}

/** Referensdagi CSV: har bir o'quvchi alohida qator. */
export function sarhisobCsvRows(list: GroupExam[], monthLabel: (m: string) => string): unknown[][] {
  const head = ["Sana", "Oy", "Fan", "Ustoz", "Guruh", "O'quvchi", "Savollar", "To'g'ri javob", "O'zlashtirish %"];
  const out: unknown[][] = [head];
  for (const r of list) {
    for (const s of r.students) {
      out.push([fmtExamDate(r.date), monthLabel(groupExamMonth(r)), r.course, r.teacher, r.groupLabel, s.name, r.total, s.correct, s.pct]);
    }
  }
  return out;
}
