"use client";

import { useEffect, useMemo, useState } from "react";
import type { Group } from "@/lib/groups";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Pupil } from "@/lib/pupilsData";
import { pupilFullName } from "@/lib/pupilsData";
import type { TaskTargetKind } from "@/lib/tasksData";

// Topshiriq oynasidagi "kimga/nimaga" tanlovi uchun ro'yxatlar — hammasi
// BAZADAN:
//   O'quvchi — /api/pupils
//   Guruh    — /api/groups (guruh raqami/nomi)
//   Buyurtma — tizimdagi barcha odamlar: o'quvchilar + xodimlar
//
// Har bir variant nomdan tashqari qo'shimcha satrga ham ega (telefon, kurs,
// o'qituvchi) — bir xil ismlar farqlansin va qidiruvda telefon ham ishlasin.

export interface TargetOption {
  /** Tanlanganda saqlanadigan qiymat (ro'yxatda ham shu ko'rinadi). */
  value: string;
  /** Qator ostidagi kichik satr. */
  subtitle: string;
}

export function useTaskTargets() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // Bu yerga faqat ism va telefon kerak — to'liq hujjatlar ~3.6 MB.
      fetch("/api/pupils?light=1").then((r) => r.json()).catch(() => null),
      fetch("/api/groups").then((r) => r.json()).catch(() => null),
      fetch("/api/hr-employees").then((r) => r.json()).catch(() => null),
    ]).then(([p, g, e]) => {
      if (cancelled) return;
      if (p?.ok) setPupils(p.pupils);
      if (g?.ok) setGroups(g.groups);
      if (e?.ok) setEmployees(e.employees);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const byKind = useMemo(() => {
    const studentOptions: TargetOption[] = pupils.map((p) => ({
      value: pupilFullName(p),
      subtitle: p.phone ? `+998 ${p.phone}` : "telefon yo'q",
    }));

    const groupOptions: TargetOption[] = groups.map((g) => ({
      value: g.name || String(g.id),
      subtitle: [g.course, g.teacher, g.day].filter(Boolean).join(" · ") || "—",
    }));

    // Xodimlar ham "inson" — buyurtma tanlanganda ikkalasi bitta ro'yxatda.
    const peopleOptions: TargetOption[] = [
      ...studentOptions.map((o) => ({ ...o, subtitle: `O'quvchi · ${o.subtitle}` })),
      ...employees
        .filter((e) => !e.archReason)
        .map((e) => ({
          value: e.name,
          subtitle: `Xodim · ${e.phone ? `+998 ${e.phone}` : "telefon yo'q"}`,
        })),
    ];

    return {
      student: studentOptions,
      group: groupOptions,
      order: peopleOptions,
    } as Record<TaskTargetKind, TargetOption[]>;
  }, [pupils, groups, employees]);

  return { byKind, loading };
}
