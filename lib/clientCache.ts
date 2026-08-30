"use client";

// Klient tomonidagi umumiy GET keshi.
//
// MUAMMO: bir xil og'ir ro'yxat (o'quvchilar ~3.6 MB, tranzaksiyalar ~2.8 MB)
// bitta sahifada bir necha komponent tomonidan, va har navigatsiyada qaytadan
// so'ralardi. Server tomonda hech qanday xato yo'q edi — shunchaki bir narsa
// ko'p marta tashilardi.
//
// NIMA QILADI:
//   1) IN-FLIGHT DEDUP — ayni paytda ketayotgan bir xil so'rovlar bitta
//      so'rovga birlashadi (eng ko'p foyda shu yerda: sahifa + ichidagi
//      oyna bir vaqtda so'raydi);
//   2) QISQA MUDDATLI KESH — tugagan natija TTL davomida saqlanadi, ya'ni
//      sahifalar orasida yurganda qaytadan yuklanmaydi.
//
// ESKIRISH XAVFI: sahifa ochilgach ro'yxat baribir "suratga olingan" holatda
// turadi — foydalanuvchi 5 daqiqa qarab tursa, keshsiz kodda ham 5 daqiqalik
// eski ma'lumotni ko'radi. Ya'ni qisqa TTL mavjud xulqdan ESKIROQ ma'lumot
// ko'rsata olmaydi. Yozuvdan keyin esa kesh aniq bekor qilinadi.

type Entry = { at: number; ttl: number; req: Promise<unknown>; value?: unknown };

const cache = new Map<string, Entry>();

/** Keshdan oladi; bo'lmasa `load()` ni chaqirib, natijasini keshlaydi. */
export function cachedGet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.req as Promise<T>;

  const req: Promise<T> = load()
    .then((v) => {
      // Shu orada kesh bekor qilingan yoki yangi so'rov boshlangan bo'lishi
      // mumkin — faqat O'ZIMIZNING yozuvni to'ldiramiz.
      const own = cache.get(key);
      if (own && own.req === req) own.value = v;
      return v;
    })
    .catch((e) => {
      // Xato natija keshda qolib ketmasin — keyingi urinish qaytadan so'rasin.
      if (cache.get(key)?.req === req) cache.delete(key);
      throw e;
    });

  cache.set(key, { at: Date.now(), ttl: ttlMs, req });
  return req;
}

/** Keshda TAYYOR natija bo'lsa — o'sha, aks holda `null`. */
export function peekCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at >= hit.ttl) return null;
  return (hit.value as T) ?? null;
}

/** `prefix` bilan boshlanadigan yozuvlarni bekor qiladi (prefiks yo'q — hammasi). */
export function invalidateCached(prefix?: string): void {
  if (!prefix) { cache.clear(); return; }
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}
