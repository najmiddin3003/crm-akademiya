import type { Db } from "mongodb";
import { redactForLog } from "./actionLog";
import { LOG_OBJECTS } from "./actionLogView";

// «AMALLAR JURNALI» — TAHRIR VA O'CHIRISHDAN OLDINGI HOLAT (25.10.2026, 14-qism).
//
// Rasmdagi «Tahrirlangan yozuvni bosing — «oldin → keyin» farqi ochiladi» va «lidni o'chirdi —
// Sardor Ergashev» uchun: proxy so'rovni route'ga O'TKAZISHDAN OLDIN obyektning joriy holatini
// o'qiydi (faqat tanadagi maydonlar va nomi) va jurnal yozuviga `before` qilib qo'shadi. Keyin
// sahifa tanadagi yangi qiymat bilan solishtiradi (lib/actionLogView.ts → diffOf).
//
// Faqat: PUT/PATCH (`/api/<bo'lim>/<id>` va uning ichidagi yo'llar — masalan `/status`), DELETE
// (aynan `/api/<bo'lim>/<id>`) va to'lovni bekor qilish (POST …/transaction-entries/<id>/cancel);
// bo'lim — `LOG_OBJECTS` dagilar. Parol/token kalitlari o'qilmaydi; qiymatlar `redactForLog` dan
// o'tadi. Xato yoki sekin baza amalni to'xtatmaydi — proxy vaqt chegarasi bilan chaqiradi.

const SECRET_KEY = /pass|parol|pwd|secret|token|otp|hash|cookie|session/i;
const MAX_KEYS = 40;

export async function snapshotBefore(db: Db, pathname: string, method: string, bodyText: string | null): Promise<Record<string, unknown> | undefined> {
  const parts = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [section, id, ...rest] = parts;
  const cfg = LOG_OBJECTS[section];
  if (!cfg || !id || !/^\d+$/.test(id)) return undefined;

  const cancel = method === "POST" && section === "transaction-entries" && rest.length === 1 && rest[0] === "cancel";
  if (!cancel) {
    if (method !== "PUT" && method !== "PATCH" && method !== "DELETE") return undefined;
    // Ichki yo'l o'chirishi (dars, guruh a'zoligi) — obyektning o'zi o'chmaydi.
    if (method === "DELETE" && rest.length) return undefined;
    if (section === "transaction-entries") return undefined;
  }

  const keys = new Set<string>(cfg.fields);
  if ((method === "PATCH" || method === "PUT") && bodyText) {
    try {
      const b: unknown = JSON.parse(bodyText);
      if (b && typeof b === "object" && !Array.isArray(b)) {
        for (const k of Object.keys(b as Record<string, unknown>)) {
          if (keys.size >= MAX_KEYS) break;
          if (k.startsWith("$") || k.includes(".") || k === "_id" || SECRET_KEY.test(k)) continue;
          keys.add(k);
        }
      }
    } catch {
      // JSON emas — faqat nomi
    }
  }
  const projection: Record<string, 0 | 1> = { _id: 0 };
  for (const k of keys) projection[k] = 1;
  const doc = await db.collection(cfg.col).findOne({ id: Number(id) }, { projection });
  if (!doc) return undefined;
  const red = redactForLog(doc);
  return red && typeof red === "object" && !Array.isArray(red) ? (red as Record<string, unknown>) : undefined;
}
