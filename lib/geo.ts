import type { Db } from "mongodb";

// JOYLASHUV — «Ishga keldim» (QR) tekshiruvi va manzil matni (29.09.2026).
//
// Foydalanuvchi qarorlari: xodim skanerlaganda joylashuv ham tekshiriladi —
// filialdan uzoqda bo'lsa yoki joylashuvga ruxsat bermasa BELGILANMAYDI;
// olingan joylashuv bazaga INSON O'QIYDIGAN matn bo'lib yoziladi (manzil —
// Yandex Geocoder, kalit `YANDEX_GEOCODER_API_KEY`). Kalit bo'lmasa yoki
// Yandex javob bermasa ham skanerlash to'xtamaydi: matnda filialgacha
// masofa (va koordinata) qoladi.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function isValidPoint(p: unknown): p is GeoPoint {
  const v = p as GeoPoint | null;
  return (
    !!v &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lat) <= 90 &&
    Math.abs(v.lng) <= 180 &&
    !(v.lat === 0 && v.lng === 0)
  );
}

/** Ikki nuqta orasidagi masofa, metr (Haversine — bir necha km ichida xatosi santimetrlarda). */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "35 m" / "1,2 km" / "14 km". */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}

export type GeoParse = { ok: true; value: GeoPoint | null } | { ok: false; error: string };

const GEO_ERROR = "Joylashuvni tushunib bo'lmadi — «41.06891, 71.82361» ko'rinishida yoki Google/Yandex xarita havolasini qo'ying";

/**
 * Filial joylashuvi formadan: "41.06891, 71.82361", Google Maps havolasi
 * (`!3d…!4d…`, `@lat,lng`, `q=lat,lng`) yoki Yandex havolasi
 * (`whatshere[point]=`, `pt=`, `ll=` — Yandex'da TARTIB TESKARI: uzunlik,
 * kenglik). Qisqa havolalar (maps.app.goo.gl) ochilmaydi — koordinata
 * so'raladi. Bo'sh → null (joylashuv olib tashlanadi).
 */
export function parseGeo(raw: unknown): GeoParse {
  let s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };
  try {
    s = decodeURIComponent(s);
  } catch {
    // buzuq %-kod — xom satr bilan davom
  }
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const pair = (lat: string, lng: string): GeoParse => {
    const p = { lat: Number(lat), lng: Number(lng) };
    return isValidPoint(p) ? { ok: true, value: p } : { ok: false, error: GEO_ERROR };
  };
  const yandex = /yandex\./i.test(s);
  const tries: [RegExp, "latlng" | "lnglat"][] = [
    [new RegExp(`!3d${num}!4d${num}`), "latlng"],
    [new RegExp(`whatshere\\[point\\]=${num},${num}`), "lnglat"],
    [new RegExp(`[?&]pt=${num},${num}`), "lnglat"],
    [new RegExp(`[?&]ll=${num},${num}`), yandex ? "lnglat" : "latlng"],
    [new RegExp(`@${num},${num}`), "latlng"],
    [new RegExp(`[?&](?:q|query|daddr|destination)=${num},\\s*${num}`), "latlng"],
    [new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`), "latlng"],
  ];
  for (const [re, order] of tries) {
    const m = re.exec(s);
    if (m) return order === "latlng" ? pair(m[1], m[2]) : pair(m[2], m[1]);
  }
  return { ok: false, error: GEO_ERROR };
}

/** API kirishi: satr (forma) yoki `{ lat, lng }` obyekt. */
export function parseGeoInput(raw: unknown): GeoParse {
  if (raw && typeof raw === "object") {
    const p = { lat: Number((raw as { lat?: unknown }).lat), lng: Number((raw as { lng?: unknown }).lng) };
    return isValidPoint(p) ? { ok: true, value: p } : { ok: false, error: GEO_ERROR };
  }
  return parseGeo(raw);
}

/** Xaritada ochish havolasi (Yandex, nuqta belgisi bilan). */
export function mapLink(p: GeoPoint): string {
  return `https://yandex.uz/maps/?pt=${p.lng},${p.lat}&z=17&l=map`;
}

// ── Manzil (Yandex Geocoder) ────────────────────────────────────────

const CACHE = "geo_address_cache";

export function geocoderReady(): boolean {
  return Boolean((process.env.YANDEX_GEOCODER_API_KEY || "").trim());
}

/** "Oʻzbekiston, Namangan viloyati, …" → mamlakat nomisiz (hammasi O'zbekistonda). */
function cleanAddress(text: string): string {
  return text.replace(/^(O[ʻ'`‘’]?zbekiston|Uzbekistan|Узбекистан)\s*,\s*/i, "").trim();
}

async function yandexLookup(apikey: string, p: GeoPoint): Promise<string | null> {
  // `uz_UZ` qo'llanmasa (400) — ruscha; ikkalasi ham odam o'qiydi.
  const langs = [(process.env.YANDEX_GEOCODER_LANG || "uz_UZ").trim(), "ru_RU"];
  for (const lang of [...new Set(langs)]) {
    const url =
      `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(apikey)}` +
      `&geocode=${p.lng},${p.lat}&format=json&results=1&lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (res.status === 400) continue;
    if (!res.ok) {
      // Kalit URL ichida — butun manzil jurnalga yozilmaydi.
      console.warn(`[geo] Yandex Geocoder javobi: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      response?: { GeoObjectCollection?: { featureMember?: { GeoObject?: { metaDataProperty?: { GeocoderMetaData?: { text?: string } } } }[] } };
    };
    const text = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text;
    return text ? cleanAddress(String(text)) : null;
  }
  return null;
}

/**
 * Koordinata → manzil matni. Natija ~11 m aniqlikda keshlanadi
 * (`geo_address_cache`, 90 kun): xodim har kuni o'sha binodan skanerlaydi —
 * Yandex'ga deyarli bormaydi (bepul chegara kuniga 1000 so'rov).
 * HECH QACHON OTILMAYDI: kalit yo'q, tarmoq xatosi yoki vaqt tugasa — null.
 */
export async function reverseGeocode(db: Db, p: GeoPoint): Promise<string | null> {
  const apikey = (process.env.YANDEX_GEOCODER_API_KEY || "").trim();
  if (!apikey) return null;
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  try {
    const hit = await db.collection(CACHE).findOne({ key }, { projection: { _id: 0, address: 1 } });
    if (typeof hit?.address === "string" && hit.address) return hit.address;
    const address = await yandexLookup(apikey, p);
    if (address) {
      await db.collection(CACHE).updateOne({ key }, { $set: { key, address, createdAt: new Date() } }, { upsert: true });
    }
    return address;
  } catch (e) {
    console.warn("[geo] manzil aniqlanmadi:", e instanceof Error ? e.name : e);
    return null;
  }
}
