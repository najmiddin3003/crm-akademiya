"use client";

import { useEffect, useState } from "react";
import { cachedGet, invalidateCached, peekCached } from "@/lib/clientCache";

// Kichik ro'yxatlarni bir marta so'raydigan umumiy hook.
//
// MUAMMO: bir qancha hook (`useGroups`, `useTeachers`, `useModerators`,
// `useStaff`, `usePaymentMethods`, `useOfflineCourseList`) xom `fetch` ni
// mount effektida chaqirardi — na kesh, na IN-FLIGHT DEDUP. Bitta sahifa
// va uning ichidagi modal bir vaqtda mount bo'lganda bir xil ro'yxat
// ikki-uch marta so'ralardi, va ular BIR VAQTDA ketgani uchun hech qanday
// kesh ham yordam bermasdi.
//
// Miqyosi o'lchangan: `useGroups` 11 ta faylda, `usePaymentMethods` 11 ta,
// `useOfflineCourseList` 10 ta, `useTeachers` 9 ta, `useModerators` 7 ta.
//
// `cachedGet` (lib/clientCache.ts) SO'ROVNING O'ZINI keshlaydi, ya'ni
// bir vaqtda kelgan chaqiruvlar bitta so'rovni bo'lishadi.
//
// TTL QISQA — 1.5 soniya. Maqsad "ma'lumotni keshlash" emas, bitta
// sahifa ochilishidagi TAKRORNI yo'qotish. Foydalanuvchi biror narsa
// qo'shib, ro'yxat yangilanishini kutgan payt baribir bundan uzoqroq,
// ya'ni u eski ro'yxatni ko'rmaydi.
//
// DIQQAT: `lib/clientCache.ts:42` shartida `Date.now() - hit.at < hit.ttl`
// turadi — TTL 0 bo'lsa shart HECH QACHON rost bo'lmaydi, ya'ni na kesh,
// na dedup ishlaydi. Shu bois nol berilmaydi.
const SHARED_TTL_MS = 1500;

/**
 * `url` dan ro'yxat oladi va `pick` bilan kerakli maydonni ajratadi.
 *
 * `key` — kesh kaliti; mutatsiyadan keyin `invalidateSharedList(key)`
 * bilan bekor qilinadi.
 */
export function useSharedList<T>(key: string, url: string, pick: (d: unknown) => T[]): {
  items: T[];
  loading: boolean;
} {
  const [items, setItems] = useState<T[]>(() => peekCached<T[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekCached<T[]>(key) === null);

  useEffect(() => {
    let cancelled = false;
    cachedGet<T[]>(key, SHARED_TTL_MS, () =>
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          // Xatoni bo'sh ro'yxatga aylantirmaymiz: bo'sh natija keshga
          // tushib qolsa, tanlov ro'yxatlari sababsiz bo'sh turardi.
          if (!d?.ok) throw new Error(key + ": ok emas");
          return pick(d);
        }))
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // `pick` har renderda yangi funksiya bo'lishi mumkin — u bog'liqlikka
    // qo'shilmaydi, aks holda effekt cheksiz qayta ishga tushardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);

  return { items, loading };
}

/** Ro'yxat o'zgargandan keyin CHAQIRILSIN. */
export function invalidateSharedList(key: string): void {
  invalidateCached(key);
}
