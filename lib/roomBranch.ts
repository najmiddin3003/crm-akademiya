import type { Db } from "mongodb";
import { branchInCondition, type BranchScope } from "@/lib/branchScope";
import { ROOM_HOLDING_STATUSES } from "@/lib/groupRules";

// XONANING FILIALI — server qoidalari (POST /api/rooms, PATCH /api/rooms/:id).
//
// Xona jismoniy, bino bilan birga — har biri aniq bitta filialda turadi va
// Xonalar ro'yxati navbardagi filial bo'yicha kesiladi. Qo'shish/tahrirlash
// oynasida filial TANLANADI (sukut — navbardagi), ya'ni navbarni
// almashtirmasdan boshqa filialga ham xona qo'shsa bo'ladi.
//
// Guruh xonaga NOMI bilan bog'lanadi (`groups.room`, o'z filiali ichida) va
// bandlik ham shunday tekshiriladi (lib/groupRoomClash.ts). Ikki qoida
// shundan kelib chiqadi:
//   1. Bir filialda bir xil nomli ikki xona bo'lmasin — bandlik ularni
//      bitta xona deb hisoblardi. Boshqa filialda esa o'sha nom — boshqa
//      xona ("201 - xona" ikkala binoda ham bor).
//   2. Guruhlar dars o'tayotgan xona boshqa filialga ko'chirilmasin — eski
//      filialdagi guruhlar o'z binosida yo'q xonaga bog'lanib qolardi:
//      xonalar hisoboti ularni "xonasiz" deb sanaydi (/reports-rooms),
//      yangi filial esa o'sha vaqtga boshqa guruh qo'ya olardi — bandlik
//      faqat filial ichida tekshiriladi va eski guruhlarni ko'rmaydi.

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
    .find(branchInCondition([branchId]), { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();
  const twin = rows.find((r) => r.id !== excludeId && nameKey(String(r.name ?? "")) === key);
  if (!twin) return null;
  const name = String(twin.name);
  return { ok: false, status: 409, error: `Bu filialda «${name}» nomli xona allaqachon bor` };
}

/**
 * 2-qoida. `fromBranch` dagi tirik guruhlar (ROOM_HOLDING_STATUSES — arxiv
 * xona egallamaydi) shu xonada dars o'tadimi. Qaysilari ekani xabarda
 * aytiladi — foydalanuvchi ularni avval boshqa xonaga o'tkazadi.
 */
export async function roomInUseRefusal(db: Db, fromBranch: number, roomName: string): Promise<Refusal | null> {
  const rows = await db
    .collection("groups")
    .find(
      { $and: [{ room: roomName, status: { $in: [...ROOM_HOLDING_STATUSES] } }, branchInCondition([fromBranch])] },
      { projection: { _id: 0, name: 1 } },
    )
    .sort({ id: 1 })
    .toArray();
  if (rows.length === 0) return null;
  const count = rows.length;
  const names = rows.slice(0, 3).map((g) => String(g.name ?? "")).join(", ") + (count > 3 ? ", …" : "");
  return {
    ok: false,
    status: 409,
    error: `Bu xonada ${count} ta guruh dars o'tadi (${names}) — filialni almashtirishdan oldin ularni boshqa xonaga o'tkazing`,
  };
}
