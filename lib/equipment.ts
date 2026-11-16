// Guruh → Jihozlar (group/equipments). MongoDB `equipment` kolleksiyasi.
export interface Equipment {
  id: number;
  name: string; // Jihoz nomi
  inventoryCode: string; // Inventar kodi — bo'sh qoldirilsa avtomatik yaratiladi
  price: number; // Narxi (dona uchun)
  createdAt: string; // Yaratilgan sana — "DD.MM.YYYY | HH:mm"

  // --- Yangi versiya (31-qism, «Jihozlar» rasmi) — hammasi ixtiyoriy, eski yozuvlarda yo'q ---
  /** Turi: "Texnika" | "Mebel" | "O'quv qurollari" | "Boshqa". */
  category?: string;
  /** Qayerda: xona nomlari («205») yoki «Qabulxona», «Koridor». */
  rooms?: string[];
  /** Soni (dona); yo'q — 1. */
  quantity?: number;
  /** Holati: ok — ishlayapti, repair — ta'mirda, broken — ishlamaydi; yo'q — ok. */
  status?: EquipmentStatus;
  /** Holat izohi («lampa», «sovutmayapti»). */
  statusNote?: string;
  /** Holat qachondan ("YYYY-MM-DD"). */
  statusSince?: string;
  /** Olingan kun ("YYYY-MM-DD"). */
  acquiredAt?: string;
  /** Qayerdan: «kassa chiqimi», «1-filialdan ko'chirildi». */
  source?: string;
  /** Mas'ul xodim (ismi). */
  responsible?: string;
  /** Kafolat tugaydigan kun ("YYYY-MM-DD"). */
  warrantyUntil?: string;
  /** Filial (branches.id); yo'q — 1-filial. */
  branchId?: number;
}

export type EquipmentStatus = "ok" | "repair" | "broken";
export const EQUIPMENT_STATUSES: EquipmentStatus[] = ["ok", "repair", "broken"];
export const EQUIPMENT_CATEGORIES = ["Texnika", "Mebel", "O'quv qurollari", "Boshqa"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Klient yuborgan yangi maydonlarni tekshirib, saqlanadigan ko'rinishga keltiradi (POST va PATCH
 * uchun bitta qoida). Berilmagan maydon natijada yo'q; noto'g'risi — xato matni.
 */
export function equipmentExtras(body: Record<string, unknown>): { set: Partial<Equipment>; error?: string } {
  const set: Partial<Equipment> = {};
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);
  const date = (k: keyof Equipment) => {
    const v = str(k);
    if (v === undefined) return undefined;
    if (v && !ISO.test(v)) return null;
    return v;
  };
  if (str("category") !== undefined) set.category = str("category");
  if (Array.isArray(body.rooms)) set.rooms = (body.rooms as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 50);
  if (body.quantity !== undefined) {
    const n = Math.floor(Number(body.quantity));
    if (!Number.isFinite(n) || n < 1 || n > 100000) return { set, error: "Soni 1 dan kam bo'lmasin" };
    set.quantity = n;
  }
  if (body.status !== undefined) {
    if (!EQUIPMENT_STATUSES.includes(body.status as EquipmentStatus)) return { set, error: "Noto'g'ri holat" };
    set.status = body.status as EquipmentStatus;
  }
  for (const k of ["statusNote", "source", "responsible"] as const) if (str(k) !== undefined) set[k] = str(k);
  for (const k of ["statusSince", "acquiredAt", "warrantyUntil"] as const) {
    const v = date(k);
    if (v === null) return { set, error: "Sana YYYY-MM-DD ko'rinishida bo'lsin" };
    if (v !== undefined) set[k] = v;
  }
  return { set };
}
