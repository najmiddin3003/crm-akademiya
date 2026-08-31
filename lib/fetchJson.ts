"use client";

// JSON o'qishning YAGONA to'g'ri yo'li.
//
// MUAMMO. Loyihada 339 ta `fetch` joyi bor va ularning 311 tasi HTTP
// holatini (`res.ok`) umuman tekshirmaydi. Ko'pi konvertni (`d.ok`)
// tekshiradi, lekin server 500 qaytarganda javob JSON ham emas — HTML
// xato sahifasi keladi va `res.json()` `SyntaxError` bilan yiqiladi.
// Uni esa `.catch(() => {})` yutib yuboradi.
//
// NATIJA — MOLIYADA XAVFLI. Sahifalar holatni [] yoki 0 bilan
// boshlaydi, xato shoxi esa hech nima qilmaydi. Ya'ni ekranda xato
// xabari emas, HAQIQIY RAQAM sifatida "0 UZS" turadi. Bu "ma'lumot yo'q"
// va "so'rov yiqildi" ni bir-biridan ajratmaslik.
//
// SHU FUNKSIYA UCHALA TESHIKNI YOPADI:
//   1) HTTP holati        -> res.ok
//   2) javob JSON emasligi -> content-type
//   3) konvert             -> d.ok === false
//
// `d?.ok === false` ataylab: ba'zi route'lar umuman `ok` maydonisiz
// javob qaytaradi, `!d?.ok` esa ularni ham xato deb hisoblardi.

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new ApiError(`${url}: HTTP ${res.status}`, res.status);

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new ApiError(`${url}: javob JSON emas`, res.status);
  }

  const d = await res.json();
  if (d?.ok === false) throw new ApiError(d.error || `${url}: ok emas`, res.status);
  return d as T;
}
