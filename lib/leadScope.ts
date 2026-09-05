import type { Document, Filter } from "mongodb";
import { branchCondition, type BranchScope } from "@/lib/branchScope";
import { nameEq } from "@/lib/currentEmployee";

// LIDLAR QAMROVI — `orders` uchun. Bitta joyda, chunki uchta route bir xil
// javob berishi shart: ro'yxat (GET /api/orders), bitta lidni tahrirlash
// (PATCH /api/orders/:id) va qo'ng'iroq paneli (/api/notifications).
// Ular ajralib qolsa, ro'yxatda ko'rinmaydigan lid haqida xabar kelardi
// yoki ko'rinib turgani ochilmasdi.
//
// QOIDA (markaz, 2026-09-05):
//   1) lid QAYSI filialda qo'shilgan bo'lsa, o'sha filialda ko'rinadi;
//   2) va odam O'ZI qo'shgan lidni filialidan qat'i nazar doim ko'radi.
//
// ──────────────────────────────────────────────────────────────────
// NEGA IKKINCHI SHART BOR
//
// Xodimning filiali o'zgarishi mumkin — Dilmurod bilan aynan shunday
// bo'ldi (04.09 kuni hisobi 1-filialdan 2-filialga ko'chirildi). Faqat
// filial bo'yicha kesilsa, o'sha lahzada u o'zi kiritgan lidlarni ham
// ko'rmay qoladi. Muallif sharti buni oldini oladi.
//
// NEGA "BELGILANMAGAN FILIAL HAMMAGA" YO'LI QAYTARILDI
//
// Bir muddat bu yerda "filiali belgilanmagan lidlar hamma filialda
// ko'rinsin" degan yumshoq qoida turdi (`withBranchOrUnassigned`). Amalda
// u kutilganidan boshqacha chiqdi: bo'linishdan oldingi 42 ta lid —
// hammasi Akademiya 1 niki — Dilmurodning ro'yxatida paydo bo'ldi, ya'ni
// "o'zinikini ko'rsin" o'rniga "hammaniki ko'rinsin" bo'lib qoldi.
// Markaz qarori: bunday lidlar 1-filialda qoladi (`branchCondition` ularni
// o'sha yerga qo'shadi), muallifi ma'lum bo'lganlari esa muallifiga
// ko'rinadi.

/**
 * @param authorName Joriy foydalanuvchining `hr_employees.name` i
 *   (lib/currentEmployee.ts → `currentAuthorName`). BO'SH bo'lsa muallif
 *   sharti QO'SHILMAYDI — va bu shart, bezak emas: bo'linishdan oldingi
 *   lidlarning HAMMASIDA `moderator: ""`, ya'ni bo'sh ism bilan
 *   solishtirish butun kolleksiyani ochib yuborardi.
 */
export function withLeadScope<T extends Document>(
  filter: Filter<T>,
  scope: BranchScope,
  authorName: string,
): Filter<T> {
  const author = (authorName ?? "").trim();
  const cond: Filter<Document> = author
    ? { $or: [branchCondition(scope), { moderator: nameEq(author) }] }
    : branchCondition(scope);
  return { $and: [filter, cond] } as Filter<T>;
}
