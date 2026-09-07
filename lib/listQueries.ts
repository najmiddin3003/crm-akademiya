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
//
// FILIAL QAMROVI — IKKALA RO'YXAT HAM KESILADI (qaror 2026-09-07).
//
// `loadPupils()` va `loadGroups()` filial bo'yicha kesiladi (sabab
// app/api/pupils/route.ts dagi GET izohida). Bu SHART: sahifani server
// chizadi, keyin klient o'sha ro'yxatni `/api/pupils` yoki `/api/groups`
// dan qayta so'raydi — ikkalasi bir xil qamrovda bo'lmasa, birinchi
// kadrda boshqa filialning ma'lumoti ko'rinib, keyin g'oyib bo'lardi.
//
// Sidebar'dagi guruhlar sanog'i ham aynan shu qamrovda bo'lishi kerak
// (app/api/sidebar-counts) — u yerda ham o'zgartirildi.

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
export async function loadGroups(): Promise<Group[]> {
  // Qamrov shu yerda olinadi — sabab `loadPupils()` dagi bilan bir xil
  // (chaqiruvchidan kutilsa, uzatishni unutgan sahifa butun bazani
  // ko'rsatib qo'yardi).
  const scope = await getBranchScope();
  if (!scope) return [];

  const db = await ensureIndexes();
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const todayIso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const weekday = now.getDay();

  // Ikkala so'rov bir-biriga bog'liq emas.
  const [rows, marked] = await Promise.all([
    db.collection("groups").find(withBranch({}, scope)).sort({ id: 1 }).toArray(),
    // Davomat KESILMAYDI — u guruh id'si bo'yicha qidiriladi va yuqoridagi
    // ro'yxatda bo'lmagan guruhning id'si baribir ishlatilmaydi.
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
  opts: PupilsQueryOptions = {},
): Promise<PupilListItem[]> {
  // Qamrov SHU YERDA olinadi, chaqiruvchidan kutilmaydi: uni parametr
  // qilish "uzatishni unutish" imkonini qoldirardi va o'sha sahifa jimgina
  // butun bazani ko'rsatib qo'yardi. `getBranchScope()` 10 soniyalik keshda
  // (lib/branchScope.ts), ya'ni takroriy chaqiruv qimmat emas.
  const scope = await getBranchScope();
  // Tizimga kirilmagan — sahifalar buni `listScope()` bilan allaqachon
  // tekshiradi va bu yergacha yetib kelmaydi; baribir bo'sh qaytariladi.
  if (!scope) return [];

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
