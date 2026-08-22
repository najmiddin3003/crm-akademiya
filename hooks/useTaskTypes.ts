"use client";

import { useCallback, useEffect, useState } from "react";
import type { TaskType } from "@/lib/taskTypes";

// Topshiriq turlarining YAGONA klient manbasi — /api/task-types (MongoDB
// `task_types`). Topshiriq qo'shish formasidagi tanlov, sahifadagi filtr va
// "Topshiriq turi" boshqaruv oynasi shundan o'qiydi.
//
// CRUD amallari muvaffaqiyatli bo'lsa mahalliy ro'yxatni ham yangilaydi —
// oyna qayta so'rov yubormasdan darhol yangilanadi. Xatolikda xabar
// qaytariladi (chaqiruvchi uni toast bilan ko'rsatadi).
export function useTaskTypes() {
  const [types, setTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await fetch("/api/task-types").then((r) => r.json());
      if (d.ok) setTypes(d.types);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/task-types")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTypes(d.types); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const create = useCallback(async (values: Omit<TaskType, "id">): Promise<string | null> => {
    try {
      const res = await fetch("/api/task-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await res.json();
      if (!d.ok) return d.error || "Saqlashda xatolik";
      setTypes((prev) => [...prev, d.type as TaskType]);
      return null;
    } catch {
      return "Tarmoq xatoligi";
    }
  }, []);

  const update = useCallback(async (id: number, values: Omit<TaskType, "id">): Promise<string | null> => {
    try {
      const res = await fetch(`/api/task-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await res.json();
      if (!d.ok) return d.error || "Saqlashda xatolik";
      setTypes((prev) => prev.map((t) => (t.id === id ? (d.type as TaskType) : t)));
      return null;
    } catch {
      return "Tarmoq xatoligi";
    }
  }, []);

  const remove = useCallback(async (id: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/task-types/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) return d.error || "O'chirishda xatolik";
      setTypes((prev) => prev.filter((t) => t.id !== id));
      return null;
    } catch {
      return "Tarmoq xatoligi";
    }
  }, []);

  return { types, loading, create, update, remove, refresh };
}
