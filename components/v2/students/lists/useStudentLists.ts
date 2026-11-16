"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onMoneyChanged, onPupilCreated } from "@/components/v2/shell/v2Events";
import type { StudentListsPayload } from "@/lib/studentListsTypes";

// O'QUVCHILAR BO'LIMI (yangi versiya, 30-qism) — /api/students/lists ma'lumoti. ALOHIDA FAYL: ruxsat
// generatori (scripts/gen-api-permissions.mjs) importlarni kuzatadi — umumiy UI faylida tursa, shu
// UI'ni ishlatadigan har sahifaga (Jihozlar, Ish jadvallari …) o'quvchilar moliyasi API'si ochilardi.

async function fetchLists(): Promise<StudentListsPayload | { ok: false; error?: string } | null> {
  return fetch("/api/students/lists", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => null);
}

export function useStudentLists() {
  const [data, setData] = useState<StudentListsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchLists>>) => {
    if (!alive.current) return;
    if (res?.ok) {
      setData(res);
      setError("");
    } else setError(res?.error || "Ma'lumotni yuklab bo'lmadi");
    setLoading(false);
  }, []);
  const reload = useCallback(() => fetchLists().then(apply), [apply]);

  useEffect(() => {
    alive.current = true;
    fetchLists().then(apply);
    // «+ Yangi» dan qo'shilgan o'quvchi va qabul qilingan to'lov — ro'yxat darhol yangilansin.
    const off1 = onPupilCreated(() => void fetchLists().then(apply));
    const off2 = onMoneyChanged(() => void fetchLists().then(apply));
    return () => {
      alive.current = false;
      off1();
      off2();
    };
  }, [apply]);

  return { rows: data?.rows ?? [], asOf: data?.asOf ?? "", botLink: data?.botLink ?? "", loading, error, reload };
}

