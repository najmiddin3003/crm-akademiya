import { branchPool } from "@/lib/branchPools";
import { basePriceFor, levelPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { DEFAULT_COURSE_CATEGORIES, normalizeCourseCategory } from "@/lib/courseCategories";

// «SOZLAMALAR → O'QUV → KATEGORIYALAR» (24-qism, 13.11.2026) — SOF HISOB (mijoz ham, server ham).
//
// Kategoriya — `offline_courses.category` (lib/courseCategories.ts). Narx darajasi —
// kurs DARAJASI (`levels[].name`) va uning shu filialdagi oylik narxi; kategoriyadagi
// bir xil nomli darajalar bitta qatorga yig'iladi («Kichik guruh» — Ingliz, Rus, Turk …).
// Narx qoidasi — lib/coursePrice.ts (Qarzdorlar hisoboti, o'quvchi kartasi bilan BITTA):
// avval daraja narxi, bo'lmasa kursning asosiy narxi; 1+2 hovuzda hovuzdosh qatori.
// Guruh soni — guruhning HAQIQIY narxi qaysi qatordan kelsa, o'sha qatorga.

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();

export interface CatCourse extends PricedCourse {
  id: number;
  category?: string | null;
  active?: boolean | null;
}

export interface CatGroup {
  id: number;
  name: string;
  course: string;
  level?: string | null;
  branchId?: number | null;
  /** Hozirgi o'quvchilar soni (`studentIds.length`). */
  students: number;
}

export interface PriceRowCourse {
  id: number;
  name: string;
  groups: number;
  students: number;
}

export interface PriceRow {
  /** Barqaror kalit: `<daraja>|<narx>`. */
  key: string;
  /** Daraja nomi (birinchi uchragan yozilishi); "" — kursning asosiy narxi (darajasiz). */
  level: string;
  /** Shu filialdagi oylik narx; `null` — kiritilmagan. */
  price: number | null;
  /** Shu qatorga tushadigan kurslar (narx o'zgarsa — hammasida o'zgaradi). */
  courses: PriceRowCourse[];
  groups: number;
  students: number;
}

export interface CategoryCard {
  /** "" — kategoriyasiz kurslar. */
  name: string;
  courses: { id: number; name: string; active: boolean }[];
  rows: PriceRow[];
  groups: number;
  /** Narxi topilmagan guruhlar (Qarzdorlar hisobotida «narx yo'q»). */
  noPriceGroups: { id: number; name: string }[];
}

const rowKey = (level: string, price: number | null) => `${norm(level)}|${price ?? "-"}`;

/** Kategoriyalar tartibi: rasmdagi uchtasi, keyin qolganlari alifbo bo'yicha, kategoriyasiz — oxirida. */
export function categoryOrder(names: string[]): string[] {
  const uniq = new Map<string, string>();
  for (const n of names) {
    const v = normalizeCourseCategory(n);
    if (!uniq.has(v.toLowerCase())) uniq.set(v.toLowerCase(), v);
  }
  const rank = (v: string) => {
    if (!v) return 10_000;
    const i = DEFAULT_COURSE_CATEGORIES.findIndex((d) => d.toLowerCase() === v.toLowerCase());
    return i >= 0 ? i : 100;
  };
  return [...uniq.values()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Kategoriya kartalari — `branchId` (navbardagi filial) narxlari bilan. `groups` — shu filial
 * (hovuzi bilan) tirik guruhlari; har guruh o'z `branchId` si bo'yicha narxlanadi.
 */
export function buildCategoryCards(courses: CatCourse[], groups: CatGroup[], branchId: number): CategoryCard[] {
  const byCat = new Map<string, CatCourse[]>();
  for (const c of [...courses].sort((a, b) => a.id - b.id)) {
    const k = normalizeCourseCategory(c.category);
    const list = byCat.get(k.toLowerCase()) ?? [];
    list.push(c);
    byCat.set(k.toLowerCase(), list);
  }
  const courseByName = new Map(courses.map((c) => [norm(c.name), c]));

  const cards: CategoryCard[] = [];
  for (const name of categoryOrder(courses.map((c) => c.category ?? ""))) {
    const list = byCat.get(name.toLowerCase()) ?? [];
    const rows = new Map<string, PriceRow>();
    const touch = (level: string, price: number | null) => {
      const k = rowKey(level, price);
      let r = rows.get(k);
      if (!r) rows.set(k, (r = { key: k, level, price, courses: [], groups: 0, students: 0 }));
      return r;
    };
    const addCourse = (r: PriceRow, c: CatCourse) => {
      if (!r.courses.some((x) => x.id === c.id)) r.courses.push({ id: c.id, name: c.name, groups: 0, students: 0 });
    };

    // 1) Darajalar — har kursning har darajasi (guruhi bo'lmasa ham).
    for (const c of list) {
      const levels = (c.levels ?? []).map((l) => (l.name || "").trim()).filter(Boolean);
      for (const lv of levels) addCourse(touch(lv, levelPriceFor(c, lv, branchId)), c);
      // Darajasiz kurs — asosiy narx qatori.
      if (levels.length === 0) addCourse(touch("", basePriceFor(c, branchId)), c);
    }

    // 2) Guruhlar — haqiqiy narxi qaysi qatordan kelsa.
    let groupCount = 0;
    const noPrice: { id: number; name: string }[] = [];
    for (const g of groups) {
      const c = courseByName.get(norm(g.course));
      if (!c || normalizeCourseCategory(c.category).toLowerCase() !== name.toLowerCase()) continue;
      groupCount++;
      const gb = Number(g.branchId) || 1;
      const lp = levelPriceFor(c, g.level, gb);
      let r: PriceRow;
      if (lp !== null) {
        const lvName = (c.levels ?? []).find((l) => norm(l.name) === norm(g.level))?.name?.trim() || String(g.level);
        // Guruh boshqa filialniki (hovuz) bo'lsa ham — o'sha narxdagi qator.
        r = rows.get(rowKey(lvName, lp)) ?? touch(lvName, lp);
      } else {
        const bp = basePriceFor(c, gb);
        if (bp === null) {
          noPrice.push({ id: g.id, name: g.name });
          continue;
        }
        r = touch("", bp);
      }
      addCourse(r, c);
      r.groups++;
      r.students += g.students;
      const rc = r.courses.find((x) => x.id === c.id);
      if (rc) {
        rc.groups++;
        rc.students += g.students;
      }
    }

    cards.push({
      name,
      courses: list.map((c) => ({ id: c.id, name: c.name, active: c.active !== false })),
      rows: [...rows.values()],
      groups: groupCount,
      noPriceGroups: noPrice,
    });
  }
  return cards;
}

/** Narx o'zgarishining oylik tushumga taxminiy ta'siri (chegirmalarsiz): o'quvchilar × farq. */
export function priceImpact(row: Pick<PriceRow, "students">, oldPrice: number | null, newPrice: number): number {
  return oldPrice === null ? 0 : row.students * (newPrice - oldPrice);
}

// ── Saqlash (server) — qaysi qatorlar yoziladi ───────────────────────────────

type LevelBranch = { id: number; enabled: boolean; summa: number };
type CourseBranch = { id: number; enabled: boolean; price: number };

/**
 * Kursning `level` (bo'sh — asosiy narx) narxini `branchId` va uning hovuzi uchun `price` ga
 * o'zgartiradi. Yoziladigan qatorlar — hovuzdagi YOQIQ qatorlar (1+2 Chortoq bitta narx bo'lib
 * qolsin); hovuzda yoqiq qator yo'q bo'lsa — o'z filiali qatori yoqiladi (yo'q bo'lsa qo'shiladi).
 * Faqat o'zgargan maydon qaytariladi; daraja topilmasa — `null`.
 */
export function applyPriceChange(
  course: { branches?: CourseBranch[]; levels?: ({ name: string; branches?: LevelBranch[] } & Record<string, unknown>)[] },
  level: string,
  branchId: number,
  price: number,
): { branches: CourseBranch[] } | { levels: NonNullable<typeof course.levels> } | null {
  const pool = branchPool(branchId);
  if (!norm(level)) {
    const branches = (course.branches ?? []).map((b) => ({ ...b }));
    const live = branches.filter((b) => pool.includes(Number(b.id)) && b.enabled);
    if (live.length) for (const b of live) b.price = price;
    else {
      const own = branches.find((b) => Number(b.id) === branchId);
      if (own) Object.assign(own, { enabled: true, price });
      else branches.push({ id: branchId, enabled: true, price });
    }
    return { branches };
  }
  const levels = (course.levels ?? []).map((l) => ({ ...l, branches: (l.branches ?? []).map((b) => ({ ...b })) }));
  const lv = levels.find((l) => norm(l.name) === norm(level));
  if (!lv) return null;
  const live = lv.branches.filter((b) => pool.includes(Number(b.id)) && b.enabled);
  if (live.length) for (const b of live) b.summa = price;
  else {
    const own = lv.branches.find((b) => Number(b.id) === branchId);
    if (own) Object.assign(own, { enabled: true, summa: price });
    else lv.branches.push({ id: branchId, enabled: true, summa: price });
  }
  return { levels };
}
