import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch, type BranchScope } from "@/lib/branchScope";
import { groupWeekdays } from "@/lib/attendance";
import { PUPIL_EXTRA_FIELDS, type Pupil, type PupilExtraField, type PupilListItem } from "@/lib/pupilsData";
import type { Group } from "@/lib/groups";

// Ro'yxat sahifalarining ma'lumotini YIG'ADIGAN yagona joy.
//
// NIMA UCHUN: bu funksiyalarni IKKI joy chaqiradi — `/api/*` route'lari
// (klient keyin qayta so'raganda) va SERVER KOMPONENTLAR (sahifa birinchi
// ochilganda). Ikkalasi bir xil natija berishi SHART, aks holda sahifa
// serverdan bir xil, klientdan boshqacha ro'yxat bilan chizilardi.
//
// Server komponentda ishlatilishining sababi: sahifalar ma'lumotni
// gidratatsiyadan KEYIN, alohida HTTP to'lqinda olardi. Prodda bitta
// brauzer<->API borib-kelishi ~208 ms, ya'ni ro'yxat shuncha kech
// ko'rinardi. Serverda olinsa o'sha to'lqin butunlay yo'qoladi.

/** Sahifa ochilishida ishlatiladigan qamrov. `null` — tizimga kirilmagan. */
export async function listScope(): Promise<BranchScope | null> {
  return getBranchScope();
}

/**
 * Guruhlar ro'yxati — `/api/groups` GET bilan AYNAN bir xil natija.
 *
 * `highlighted` bazada saqlanmaydi, har safar hisoblanadi: bugun shu
 * guruhning dars kuni bo'lsa va davomat hali qilinmagan bo'lsa, guruh
 * ro'yxatda sariq qator bo'lib turadi.
 */
export async function loadGroups(scope: BranchScope): Promise<Group[]> {
  const db = await ensureIndexes();
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const weekday = now.getDay();

  // Ikkala so'rov bir-biriga bog'liq emas.
  const [rows, marked] = await Promise.all([
    db.collection("groups").find(withBranch({}, scope)).sort({ id: 1 }).toArray(),
    db.collection("attendance").distinct("groupId", { date: todayIso }),
  ]);
  const markedToday = new Set<number>(marked as number[]);

  return rows.map(({ _id, ...rest }) => {
    void _id;
    const g = rest as unknown as Group;
    return { ...g, highlighted: groupWeekdays(g.day).includes(weekday) && !markedToday.has(g.id) };
  });
}

/** `/api/pupils` dagi asosiy to'plam — o'sha ro'yxat, o'sha maydonlar. */
const BASE_PROJECTION = {
  _id: 0,
  id: 1, firstName: 1, lastName: 1, phone: 1,
  balance: 1, coin: 1, createdAt: 1, moderator: 1, source: 1, category: 1,
  status: 1, statusReason: 1, statusChangedAt: 1,
} as const;

export interface PupilsQueryOptions {
  status?: string;
  extra?: readonly PupilExtraField[];
}

/**
 * O'quvchilar ro'yxati — `/api/pupils?status=…&extra=…` bilan bir xil.
 *
 * Parol xeshlari proyeksiyaga UMUMAN kirmaydi (route'da ular keyin
 * o'chiriladi; bu yerda ular hech qachon o'qilmaydi).
 */
export async function loadPupils(
  scope: BranchScope,
  opts: PupilsQueryOptions = {},
): Promise<PupilListItem[]> {
  const db = await ensureIndexes();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;

  const projection: Record<string, number> = { ...BASE_PROJECTION };
  for (const f of opts.extra ?? []) {
    if ((PUPIL_EXTRA_FIELDS as readonly string[]).includes(f)) projection[f] = 1;
  }

  const rows = await db.collection("pupils")
    .find(withBranch(filter, scope), { projection })
    .sort({ id: -1 })
    .toArray();
  return rows as unknown as (PupilListItem & Partial<Pupil>)[];
}
