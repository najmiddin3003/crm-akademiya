import type { Db } from "mongodb";

// JOYLASHUV — «Ishga keldim» (QR) tekshiruvi va manzil matni (29.09.2026).
//
// Foydalanuvchi qarorlari: xodim skanerlaganda joylashuv ham tekshiriladi —
// filialdan uzoqda bo'lsa yoki joylashuvga ruxsat bermasa BELGILANMAYDI;
// olingan joylashuv bazaga INSON O'QIYDIGAN matn bo'lib yoziladi (manzil —
// OpenStreetMap Nominatim, kalitsiz; pastdagi bo'lim). Manzil xizmati javob
// bermasa ham skanerlash to'xtamaydi: matnda filialgacha masofa (va
// koordinata) qoladi, manzil keyinroq fonda to'ldiriladi.

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

/** Xaritada ochish havolasi (Yandex «Bu yerda nima?» — nuqta manzili kartochkasi bilan). */
export function mapLink(p: GeoPoint): string {
  const q = `${p.lng}%2C${p.lat}`;
  return `https://yandex.uz/maps/?ll=${q}&z=17&mode=whatshere&whatshere%5Bpoint%5D=${q}&whatshere%5Bzoom%5D=17`;
}

// ── Manzil (OpenStreetMap Nominatim) ────────────────────────────────
//
// 29.09.2026: Yandex Geocoder'ning bepul sharti faqat ommaviy saytlarga
// ruxsat beradi (CRM yopiq — pullik litsenziya yiliga 195 000 ₽), foydalanuvchi
// OpenStreetMap'ni tanladi ("openstreetmap qil"). Kalit kerak emas.
// Nominatim qoidasi (operations.osmfoundation.org/policies/nominatim):
// soniyasiga ko'pi bilan 1 so'rov, dasturni tanitadigan User-Agent, natijani
// keshlash, «© OpenStreetMap» atributsiyasi (components/shared/AttendanceLocation.tsx).
// Bizda kuniga bir necha o'nta skanerlash va 90 kunlik kesh — qoidadan ancha past.

const CACHE = "geo_address_cache";
const NOMINATIM = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").trim().replace(/\/+$/, "");
const USER_AGENT = "TizimliCRM/1.0 (+https://www.tizimli24.uz)";
/** Soniyasiga 1 ta — biroz zaxira bilan. pm2 bitta jarayon (fork, 1), ya'ni navbat shu yerda. */
const MIN_GAP_MS = 1_100;
/** Nominatim rad etsa (429/403) — shuncha vaqt so'ramaymiz. */
const BACKOFF_MS = 5 * 60_000;
let nextSlotAt = 0;

/**
 * Navbatdan joy band qiladi. Joy `maxWaitMs` ichida bo'shamasa band qilmaydi
 * (false) — chaqiruvchi manzilni keyinroq to'ldiradi (lib/attendanceCheck.ts).
 */
async function takeSlot(maxWaitMs: number): Promise<boolean> {
  const now = Date.now();
  const at = Math.max(now, nextSlotAt);
  if (at - now > maxWaitMs) return false;
  nextSlotAt = at + MIN_GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
  return true;
}

interface OsmReverse {
  /** Nuqtadagi obyekt nomi (maktab, do'kon, ko'cha …). */
  name?: string;
  /** Obyekt turi: amenity, shop, building, highway, place … */
  category?: string;
  address?: Record<string, string | undefined>;
  display_name?: string;
  error?: string;
}

/** Bu turdagi obyekt nomi manzil boshiga yozilmaydi: ko'cha, aholi punkti, chegara — ular allaqachon manzilda. */
const NOT_A_PLACE = new Set(["highway", "place", "boundary", "landuse", "natural", "railway", "waterway"]);

const COUNTRY = /^(O[ʻ'`‘’]?zbekiston|Uzbekistan|Узбекистан|Ўзбекистон)$/i;

/**
 * Nominatim javobi → qisqa manzil: nuqtadagi nomli joy (texnikum, do'kon …),
 * ko'cha (va uy), mahalla, shahar/qishloq; ko'cha bo'lmasa tuman ham. Viloyat,
 * indeks va mamlakat yozilmaydi (hammasi Namanganda). Nomlar OSM'dagidek —
 * ba'zi ko'chalar kirillda, yo'llar raqam bilan ("D110").
 */
export function formatOsmAddress(r: OsmReverse): string | null {
  const a = r.address ?? {};
  const street = [a.road || a.pedestrian || a.footway || a.path || "", a.house_number || ""].filter(Boolean).join(" ");
  const area = a.neighbourhood || a.quarter || a.suburb || a.residential || a.hamlet || "";
  const place = a.city || a.town || a.village || a.municipality || "";
  const district = street ? "" : a.city_district || a.district || a.county || "";
  // 29.09.2026: "D110, Chortoq" dan ko'ra "Chortoq tuman 1-son texnikumi, D110, Chortoq" tushunarli.
  const poi = r.name && !NOT_A_PLACE.has(String(r.category ?? "")) ? r.name : "";
  const parts = [...new Set([poi, street, area, place, district].map((s) => s.trim()).filter(Boolean))];
  if (parts.length) return parts.join(", ");
  // Tarkibiy qismlar yo'q — umumiy satrdan (indeks va mamlakatsiz) boshidagi uchtasi.
  const d = String(r.display_name || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^\d{5,6}$/.test(s) && !COUNTRY.test(s));
  return d.length ? d.slice(0, 3).join(", ") : null;
}

/** `retry` — manzil topilmadi, lekin keyinroq topilishi mumkin (navbat, tarmoq). */
export interface AddressLookup {
  address: string | null;
  retry: boolean;
}

/**
 * Koordinata → manzil matni. Natija ~11 m aniqlikda keshlanadi
 * (`geo_address_cache`, 90 kun): xodim har kuni o'sha binodan skanerlaydi —
 * Nominatim'ga deyarli bormaydi. `maxWaitMs` — navbatda ko'pi bilan qancha
 * kutish (skanerlash so'rovi ichida qisqa, fonda uzun).
 * HECH QACHON OTILMAYDI: tarmoq xatosi yoki vaqt tugasa — `address: null`.
 */
export async function reverseGeocode(db: Db, p: GeoPoint, opts: { maxWaitMs?: number } = {}): Promise<AddressLookup> {
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  try {
    const hit = await db.collection(CACHE).findOne({ key }, { projection: { _id: 0, address: 1 } });
    if (typeof hit?.address === "string" && hit.address) return { address: hit.address, retry: false };
    if (!(await takeSlot(opts.maxWaitMs ?? 1_200))) return { address: null, retry: true };
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=18&addressdetails=1&accept-language=uz,ru`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (res.status === 429 || res.status === 403) {
      nextSlotAt = Date.now() + BACKOFF_MS;
      console.warn(`[geo] Nominatim rad etdi: ${res.status} — ${BACKOFF_MS / 60_000} daqiqa so'ralmaydi`);
      return { address: null, retry: false };
    }
    if (!res.ok) {
      console.warn(`[geo] Nominatim javobi: ${res.status}`);
      return { address: null, retry: res.status >= 500 };
    }
    const data = (await res.json()) as OsmReverse;
    // `error` — bu nuqtada manzil yo'q ("Unable to geocode"); qayta so'rash befoyda.
    const address = data.error ? null : formatOsmAddress(data);
    if (address) {
      await db.collection(CACHE).updateOne({ key }, { $set: { key, address, createdAt: new Date() } }, { upsert: true });
    }
    return { address, retry: false };
  } catch (e) {
    console.warn("[geo] manzil aniqlanmadi:", e instanceof Error ? e.name : e);
    return { address: null, retry: true };
  }
}
