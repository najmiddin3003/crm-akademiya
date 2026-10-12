"use client";

import { useEffect, useState } from "react";

// ROL NOMLARI (12.10.2026) — Boshqaruv → Rollar, id bo'yicha.
//
// «O'quv markazidagi vazifasi» Rollar'da qo'lda qo'shilgan rol bo'lgan xodim
// (`turi: "staff"`, `hr_employees.centerRoleId`, lib/roles.ts) jadval va
// profilda umumiy «Xodim» emas, o'z rolining nomi bilan ko'rinsin. Ro'yxat
// sahifa davomida bir marta o'qiladi (modul keshi); xato bo'lsa keyingi
// chaqiruv qayta urinadi.

let cache: Promise<Map<number, string>> | null = null;

function loadRoleNames(): Promise<Map<number, string>> {
  cache ??= fetch("/api/roles")
    .then((r) => r.json())
    .then((d: { ok?: boolean; roles?: { id: number; name: string }[] }) =>
      new Map((d?.ok && Array.isArray(d.roles) ? d.roles : []).map((r) => [Number(r.id), String(r.name)] as const)),
    )
    .catch(() => {
      cache = null;
      return new Map<number, string>();
    });
  return cache;
}

export function useRoleNames(): Map<number, string> {
  const [names, setNames] = useState<Map<number, string>>(() => new Map());
  useEffect(() => {
    let alive = true;
    loadRoleNames().then((m) => {
      if (alive) setNames(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return names;
}

/**
 * Xodim vazifasining yorlig'i: qo'lda qo'shilgan rol — Rollar'dagi nomi
 * (topilmasa `labels.staff`), aks holda lavozim yorlig'i (ROLE_LABELS).
 * `null` — vazifa yo'q (saralashda qiymatsiz qatorlar oxirida tursin).
 */
export function employeeRoleLabel(
  e: { turi?: string; centerRoleId?: number | null },
  names: Map<number, string>,
  labels: Record<string, string>,
): string | null {
  if (e.centerRoleId !== null && e.centerRoleId !== undefined) {
    return names.get(Number(e.centerRoleId)) ?? labels.staff ?? null;
  }
  const turi = String(e.turi ?? "");
  return labels[turi] ?? (turi || null);
}
