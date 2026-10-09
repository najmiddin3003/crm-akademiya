import type { Db } from "mongodb";
import { pooledBranchInCondition, type BranchScope } from "@/lib/branchScope";
import { ROOM_HOLDING_STATUSES } from "@/lib/groupRules";

// XONANING FILIALI — server qoidalari (POST /api/rooms, PATCH /api/rooms/:id).
//
// Xona jismoniy, bino bilan birga — har biri aniq bitta filialda turadi va
// Xonalar ro'yxati navbardagi filial bo'yicha kesiladi. Qo'shish/tahrirlash
// oynasida filial TANLANADI (sukut — navbardagi), ya'ni navbarni
// almashtirmasdan boshqa filialga ham xona qo'shsa bo'ladi.
//
// Guruh xonaga NOMI bilan bog'lanadi (`groups.room`, o'z filiali ichida) va
// bandlik ham shunday tekshiriladi (lib/groupRoomClash.ts). Uch qoida
// shundan kelib chiqadi (3-si — `renameRoomInGroups`):
//   1. Bir filialda bir xil nomli ikki xona bo'lmasin — bandlik ularni
//      bitta xona deb hisoblardi. Boshqa filialda esa o'sha nom — boshqa
//      xona ("201 - xona" ikkala binoda ham bor).
//   2. Guruhlar dars o'tayotgan xona boshqa filialga ko'chirilmasin — eski
//      filialdagi guruhlar o'z binosida yo'q xonaga bog'lanib qolardi:
//      xonalar hisoboti ularni "xonasiz" deb sanaydi (/reports-rooms),
//      yangi filial esa o'sha vaqtga boshqa guruh qo'ya olardi — bandlik
//      faqat filial ichida tekshiriladi va eski guruhlarni ko'rmaydi.
//
// HOVUZ (09.10.2026, lib/branchPools.ts): 1- va 2-filial (Chortoq) bitta —
// uchala qoida HOVUZ bo'yicha. Umumiy ekranda 2-filial guruhiga 1-binodagi
// xona ham tanlanadi, ya'ni hovuzda nom noyob bo'lishi, bandlik va nom
// o'zgarishi esa ikkala filial guruhlariga birdek ishlashi shart. Hovuz
// ichida filial almashsa (1 ↔ 2) guruhlar xonani yo'qotmaydi — ko'chirish
// to'silmaydi (app/api/rooms/[id] → PATCH).

type Refusal = { ok: false; status: number; error: string };

/**
 * Formadan kelgan filial. Ruxsat etilmagani QABUL QILINMAYDI: aks holda
 * xodim so'rovni qo'lda yuborib o'ziga biriktirilmagan filialga xona
 * qo'shardi yoki xonani o'sha yerga ko'chirardi.
 */
export function parseRoomBranch(raw: unknown, scope: BranchScope): { ok: true; branchId: number } | Refusal {
  const n = raw === null || raw === "" ? NaN : Number(raw);
  if (!Number.isInteger(n)) return { ok: false, status: 400, error: "Filialni tanlang" };
  if (!scope.allowed.includes(n)) return { ok: false, status: 403, error: "Bu filial sizga biriktirilmagan" };
  return { ok: true, branchId: n };
}

/** Nom solishtirish kaliti: katta-kichik harf va ortiqcha bo'shliq farq qilmaydi. */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * 1-qoida. Filialdagi xonalar oz (~20) — hammasi o'qilib JS'da
 * solishtiriladi, regex uchun nomni qochirish shart emas.
 * `excludeId` — tahrirlanayotgan xonaning o'zi.
 */
export async function sameNameRoomRefusal(
  db: Db,
  branchId: number,
  wanted: string,
  excludeId?: number,
): Promise<Refusal | null> {
  const key = nameKey(wanted);
  const rows = await db
    .collection("rooms")
    .find(pooledBranchInCondition([branchId]), { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();
  const twin = rows.find((r) => r.id !== excludeId && nameKey(String(r.name ?? "")) === key);
  if (!twin) return null;
  const name = String(twin.name);
  return { ok: false, status: 409, error: `Bu filialda «${name}» nomli xona allaqachon bor` };
}

/**
 * Filialdagi shu xonada dars o'tadigan TIRIK guruhlar (ROOM_HOLDING_STATUSES —
 * arxiv xona egallamaydi). 2-qoida va xonani o'chirish ogohlantirishi
 * (GET /api/rooms/:id) shu ro'yxatga tayanadi.
 */
export interface RoomGroup {
  id: number;
  name: string;
  /** "Toq kunlar" / "Juft kunlar" / … — nomlari bir xil guruhlarni ajratish uchun. */
  day: string;
  time: string;
}

export async function groupsInRoom(db: Db, branchId: number, roomName: string): Promise<RoomGroup[]> {
  const rows = await db
    .collection("groups")
    .find(
      { $and: [{ room: roomName, status: { $in: [...ROOM_HOLDING_STATUSES] } }, pooledBranchInCondition([branchId])] },
      { projection: { _id: 0, id: 1, name: 1, day: 1, time: 1 } },
    )
    .sort({ id: 1 })
    .toArray();
  return rows.map((g) => ({ id: Number(g.id), name: String(g.name ?? ""), day: String(g.day ?? ""), time: String(g.time ?? "") }));
}

/**
 * 2-qoida. `fromBranch` dagi tirik guruhlar (ROOM_HOLDING_STATUSES — arxiv
 * xona egallamaydi) shu xonada dars o'tadimi. Qaysilari ekani xabarda
 * aytiladi — foydalanuvchi ularni avval boshqa xonaga o'tkazadi.
 */
export async function roomInUseRefusal(db: Db, fromBranch: number, roomName: string): Promise<Refusal | null> {
  const rows = await groupsInRoom(db, fromBranch, roomName);
  if (rows.length === 0) return null;
  const count = rows.length;
  const names = rows.slice(0, 3).map((g) => String(g.name ?? "")).join(", ") + (count > 3 ? ", …" : "");
  return {
    ok: false,
    status: 409,
    error: `Bu xonada ${count} ta guruh dars o'tadi (${names}) — filialni almashtirishdan oldin ularni boshqa xonaga o'tkazing`,
  };
}

/**
 * 3-qoida. Xona NOMI o'zgarsa, shu filialda eski nomdagi guruhlar ham yangi
 * nomga o'tadi — aks holda ular ro'yxatda yo'q xonaga ishora qilib qolardi
 * (hisobotda "xonasiz", bandlik tekshiruvi yangi nom ostida ko'rmaydi).
 * Hamma holat, arxiv ham: xona o'sha-o'sha, tarixi ham bir nomda tursin.
 * Qaytaradi — nechta guruh o'zgardi.
 */
export async function renameRoomInGroups(db: Db, branchId: number, from: string, to: string): Promise<number> {
  if (from === to) return 0;
  const res = await db
    .collection("groups")
    .updateMany({ $and: [{ room: from }, pooledBranchInCondition([branchId])] }, { $set: { room: to } });
  return res.modifiedCount;
}
