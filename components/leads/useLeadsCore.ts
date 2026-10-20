"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrders } from "@/components/orders/OrdersContext";
import { api } from "@/components/staff-tasks/api";
import { useBranches } from "@/hooks/useBranches";
import type { Group } from "@/lib/groups";
import type { LeadSettings } from "@/lib/leadSettings";
import { buildRows } from "./leadsCommon";

// LIDLAR SAHIFASINING UMUMIY MA'LUMOT QISMI — eski (components/leads/LeadsPage.tsx)
// va yangi versiya (components/v2/leads/LeadsV2.tsx) BITTA manbadan o'qiydi
// (20.10.2026, eski sahifadan aynan ko'chirildi): Lidlar sozlamalari, sahifa
// soati («24 soatdan oshdi», bekor qilish muddati), har daqiqadagi yangilash,
// ro'yxat qatorlari (buildRows — holat, takroriy raqam) va guruhlar.
//
// Holat tugmalari va oynalar har versiyada o'zicha (ko'rinishi boshqa), so'rov
// esa bitta — POST /api/orders/:id/holat (./LeadHolatModals.tsx → postHolat).

export function useLeadsCore() {
  const { orders, reload } = useOrders();
  const { branches } = useBranches();

  const [settings, setSettings] = useState<LeadSettings | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const nowMs = clock;

  useEffect(() => {
    let off = false;
    api<{ settings: LeadSettings }>("/api/lead-settings").then((r) => {
      if (!off && r.ok) setSettings(r.settings);
    });
    return () => {
      off = true;
    };
  }, []);

  // Soat har 30 soniyada (bekor qilish muddati, "24 soatdan oshdi"), ro'yxat
  // har daqiqada — faqat sahifa ko'rinib turganda.
  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 30_000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [reload]);

  // ── Qatorlar ──
  const rows = useMemo(() => buildRows(orders, settings), [orders, settings]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const loadGroups = useCallback(() => {
    if (groups !== null) return;
    api<{ groups: Group[] }>("/api/groups").then((r) => setGroups(r.ok ? r.groups : []));
  }, [groups]);

  /** Guruhlar qayta (guruhga qo'shilgandan keyin — o'quvchilar soni yangilansin). */
  const reloadGroups = useCallback(() => {
    api<{ groups: Group[] }>("/api/groups").then((r) => {
      if (r.ok) setGroups(r.groups);
    });
  }, []);

  return { settings, groups, loadGroups, reloadGroups, nowMs, setClock, rows, branches, branchById };
}
