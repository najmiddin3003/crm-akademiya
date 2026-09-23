"use client";

import type { StaffTaskFile } from "@/lib/staffTasks";

// Topshiriqlar sahifasining tarmoq yordamchilari. Server xabari o'zbekcha
// keladi — ko'rsatishda toast uni o'zi tarjima qiladi (ui/Toast).

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return { ok: false, error: "Server javob bermadi" };
    if (!res.ok || data.ok === false) return { ok: false, error: String(data.error || "Xatolik yuz berdi") };
    return data as { ok: true } & T;
  } catch {
    return { ok: false, error: "Tarmoq xatoligi" };
  }
}

/** Faylni Cloudinary'ga yuklaydi (server orqali) — keyin topshiriq bilan yuboriladi. */
export async function uploadTaskFile(file: File): Promise<ApiResult<{ file: StaffTaskFile }>> {
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fayl hajmi 10 MB dan oshmasin" };
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch("/api/staff-tasks/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!data?.ok) return { ok: false, error: String(data?.error || "Fayl yuklanmadi") };
    return data as { ok: true; file: StaffTaskFile };
  } catch {
    return { ok: false, error: "Tarmoq xatoligi" };
  }
}
