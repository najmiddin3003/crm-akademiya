import type { Db } from "mongodb";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import { parseMoney } from "@/lib/taxes";

// SOZLAMALAR → MOLIYA → «LAVOZIM VA STAVKALAR» (40-qism). Ro'yxatlar eski «Menejer / O'qituvchilar grading tizimi»
// tablari bilan umumiy (`settings_degrees_manager`, `settings_degrees_teacher`; /api/settings-lists). Xodim kartasida
// «Darajasi» (`hr_employees.degree`) va moderatorda «Bandlik darajasi» (`employmentRate`: Yarim / Bir stavka) shu
// ro'yxatdan tanlanadi. OKLAD hozircha kartada filial bo'yicha alohida kiritiladi — stavka undan avtomatik
// olinmaydi (SAVOLLAR 528). Sahifa har lavozimdagi xodimlar sonini va stavka bilan kartadagi oklad farqini ko'rsatadi.

const nk = (s: unknown) => String(s ?? "").trim().toLowerCase();

export async function positionsPage(db: Db) {
  const [mgr, tch, emps] = await Promise.all([
    db.collection(SETTINGS_LIST_KINDS["degrees-manager"]).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection(SETTINGS_LIST_KINDS["degrees-teacher"]).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection("hr_employees").find({ archived: { $ne: true } }, { projection: { _id: 0, id: 1, name: 1, turi: 1, degree: 1, employmentRate: 1, branchAssignments: 1 } }).toArray(),
  ]);
  // Kartadagi oklad — filial biriktiruvlaridagi ish haqi yig'indisi (Oylik chiqarish bilan bir xil).
  const oklad = (e: Record<string, unknown>) => (Array.isArray(e.branchAssignments) ? (e.branchAssignments as { salary?: unknown }[]) : []).reduce((a, x) => a + (Number(x.salary) || 0), 0);
  const rows = (items: Record<string, unknown>[], turi: "moderator" | "teacher") =>
    items.map((i) => {
      const staff = emps.filter((e) => e.turi === turi && nk(e.degree) === nk(i.name));
      return { id: Number(i.id), name: String(i.name ?? ""), halfRate: parseMoney(i.halfRate), fullRate: parseMoney(i.fullRate), staff: staff.length };
    });
  const managers = rows(mgr, "moderator");
  // Misol: lavozimi va bandligi tanlangan birinchi moderator.
  const exEmp = emps.find((e) => e.turi === "moderator" && e.degree && managers.some((m) => nk(m.name) === nk(e.degree)));
  const exDeg = exEmp ? managers.find((m) => nk(m.name) === nk(exEmp.degree)) : null;
  const half = /yarim/i.test(String(exEmp?.employmentRate ?? ""));
  return {
    ok: true as const,
    managers,
    teachers: rows(tch, "teacher"),
    unassigned: {
      moderators: emps.filter((e) => e.turi === "moderator" && !e.degree).length,
      teachers: emps.filter((e) => e.turi === "teacher" && !e.degree).length,
    },
    example:
      exEmp && exDeg
        ? { name: String(exEmp.name), degree: exDeg.name, rate: half ? "Yarim stavka" : "Bir stavka", rateSum: half ? exDeg.halfRate : exDeg.fullRate, cardOklad: oklad(exEmp) }
        : null,
  };
}
