"use client";

// Gamifikatsiya sahifalarining tarmoq yordamchisi. Server xabari o'zbekcha
// (kalit) keladi — ko'rsatishda toast uni o'zi tarjima qiladi (ui/Toast).
//
// ATAYLAB O'Z NUSXASI: boshqa modulning yordamchisi (masalan
// staff-tasks/api) import qilinsa, ruxsatlar generatori uning ichidagi
// "/api/…" yo'llarini ham shu sahifaga ochib qo'yardi
// (scripts/gen-api-permissions.mjs importlarni kuzatadi).

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string; status?: number };

export async function gamApi<T>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return { ok: false, error: "Server javob bermadi", status: res.status };
    if (!res.ok || data.ok === false) return { ok: false, error: String(data.error || "Xatolik yuz berdi"), status: res.status };
    return data as { ok: true } & T;
  } catch {
    return { ok: false, error: "Tarmoq xatoligi" };
  }
}
