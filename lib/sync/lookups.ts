import type { Db } from "mongodb";
import type { Group } from "@/lib/groups";

// Tranzaksiya yozuvida faqat ISMLAR turadi (o'quvchi, kassir, o'qituvchi) —
// filial, lavozim va guruh esa boshqa kolleksiyalarda. Sheet va Telegram
// uchun ularni bir joyga yig'ish kerak.
//
// FILIAL HAQIDA MUHIM IZOH
// ────────────────────────
// `transaction_entries` da filial maydoni YO'Q. `cashboxes`, `pupils`,
// `groups` da ham yo'q — filial faqat `hr_employees` da bor. Shu bois
// foydalanuvchi bilan kelishilgan yechim:
//
//   • xodim oyligi  → pul chiqarilgan XODIMNING o'z filiali (aniq)
//   • o'quvchi to'lovi → to'lovni QABUL QILGAN KASSIR filiali (taxminiy,
//     lekin amalda kassir o'z filialida ishlaydi)
//
// Kelajakda kassaga filial maydoni qo'shilsa, `branchOfPayment` shu
// yerda bitta qatorda o'zgartiriladi — qolgan kod tegilmaydi.

function nameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export interface EmployeeInfo {
  filial: string;
  /** "teacher" | "moderator" | "admin" */
  turi: string;
}

const POSITION_LABEL: Record<string, string> = {
  teacher: "O'qituvchi",
  moderator: "Moderator",
  admin: "Admin",
};

export function positionLabel(turi: string): string {
  return POSITION_LABEL[turi] || (turi ? turi : "—");
}

/**
 * Bir marta yuklanib, butun partiya davomida qayta ishlatiladigan
 * ma'lumotlar. Bitta to'lov uchun ham, 20 000 ta yozuvni ko'chirishda ham
 * bir xil ishlaydi — farq faqat necha marta yuklanishida.
 *
 * O'quvchi va guruh xaritalari DANGASA (lazy): xodim oyligi yozuvida ular
 * umuman kerak emas, shuning uchun bekorga minglab hujjat o'qilmaydi.
 */
export class SyncContext {
  private employees: Map<string, EmployeeInfo> | null = null;
  private cashboxes: Map<number, string> | null = null;
  private pupilGroups: Map<string, string> | null = null;

  // MAYDON OSHKORA E'LON QILINADI, `constructor(private db)` EMAS.
  // Sabab amaliy: loyihadagi skriptlar `node --import ./scripts/_ts-alias.mjs`
  // bilan ishlaydi, Node esa tiplarni faqat O'CHIRIB tashlaydi —
  // konstruktor parametridan maydon YASAY OLMAYDI va butun fayl
  // yuklanmay qoladi. Bitta shu qator tufayli `lib/` ni import
  // qiladigan har qanday diagnostika skripti yiqilardi.
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private async loadEmployees(): Promise<Map<string, EmployeeInfo>> {
    if (this.employees) return this.employees;
    const rows = await this.db
      .collection("hr_employees")
      .find({}, { projection: { name: 1, filial: 1, turi: 1, archReason: 1 } })
      .toArray();
    const map = new Map<string, EmployeeInfo>();
    for (const r of rows) {
      const key = nameKey(r.name);
      if (!key) continue;
      // Arxivlanmagan yozuv ustunlik qiladi: bir xil ismli xodim qayta
      // ishga olingan bo'lsa, joriy holati to'g'ri bo'lsin.
      const isArchived = Boolean(r.archReason);
      if (map.has(key) && isArchived) continue;
      map.set(key, { filial: String(r.filial ?? ""), turi: String(r.turi ?? "") });
    }
    this.employees = map;
    return map;
  }

  private async loadCashboxes(): Promise<Map<number, string>> {
    if (this.cashboxes) return this.cashboxes;
    const rows = await this.db
      .collection("cashboxes")
      .find({}, { projection: { id: 1, name: 1 } })
      .toArray();
    this.cashboxes = new Map(rows.map((r) => [Number(r.id), String(r.name ?? "")]));
    return this.cashboxes;
  }

  /** O'quvchi ismi -> guruh nomi. Faqat to'lov yozuvlari uchun yuklanadi. */
  private async loadPupilGroups(): Promise<Map<string, string>> {
    if (this.pupilGroups) return this.pupilGroups;

    const pupils = await this.db
      .collection("pupils")
      .find({}, { projection: { id: 1, firstName: 1, lastName: 1 } })
      .toArray();
    // pupils.id -> "ism familiya"
    const idToName = new Map<number, string>();
    for (const p of pupils) {
      const key = nameKey(`${p.firstName ?? ""} ${p.lastName ?? ""}`);
      if (key) idToName.set(Number(p.id), key);
    }

    const groups = await this.db
      .collection<Group>("groups")
      .find({}, { projection: { name: 1, course: 1, studentIds: 1 } })
      .toArray();

    const map = new Map<string, string>();
    for (const g of groups) {
      const label = groupLabel(String(g.course ?? ""), String(g.name ?? ""));
      for (const sid of g.studentIds ?? []) {
        const nk = idToName.get(Number(sid));
        // Birinchi topilgan guruh qoladi — o'quvchi bir necha guruhda
        // bo'lsa, birinchisi ko'rsatiladi (Sheet'da bitta ustun).
        if (nk && !map.has(nk)) map.set(nk, label);
      }
    }
    this.pupilGroups = map;
    return map;
  }

  async employeeInfo(name: string): Promise<EmployeeInfo | null> {
    const map = await this.loadEmployees();
    return map.get(nameKey(name)) ?? null;
  }

  async cashboxName(id: number): Promise<string> {
    const map = await this.loadCashboxes();
    return map.get(Number(id)) || `Kassa #${id}`;
  }

  async groupOfStudent(studentName: string): Promise<string> {
    if (!studentName.trim()) return "";
    const map = await this.loadPupilGroups();
    return map.get(nameKey(studentName)) || "";
  }

  /** To'lov filiali — kassir orqali (yuqoridagi izohga qarang). */
  async branchOfPayment(moderator: string): Promise<string> {
    const info = await this.employeeInfo(moderator);
    return info?.filial || "";
  }
}

/** "IELTS — 85" ko'rinishidagi guruh yorlig'i; kursi yo'q bo'lsa faqat nomi. */
export function groupLabel(course: string, name: string): string {
  const c = course.trim();
  const n = name.trim();
  if (c && n) return `${c} — ${n}`;
  return n || c;
}
