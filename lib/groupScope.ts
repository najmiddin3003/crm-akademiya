import type { Document, Filter } from "mongodb";
import { getBranchScope, withBranch } from "./branchScope";

// GURUHLAR FILIAL BO'YICHA KESILADI (qaror 07.09.2026, o'quvchilar bilan
// birga — lib/branchScope.ts dagi ro'yxatga qarang).
//
// NEGA ALOHIDA FAYL: guruhga MUROJAAT QILADIGAN sakkizta route bor
// (`/api/groups/[id]` va uning davomat, darslar, izohlar, o'quvchilar,
// topshiriqlar tarmoqlari, ustiga import va onlayn kursga biriktirish).
// Har birida `getBranchScope()` + `withBranch()` ni qo'lda takrorlash —
// bittasini unutib qoldirish demak, va o'sha bitta route butun qamrovni
// bekor qilardi: guruh id'si oddiy son, ya'ni uni terib ko'rish oson.
// Bitta funksiya bo'lsa, "qamrov qayerda majburlanadi" degan savolga
// `grep groupScopeFilter` bir soniyada javob beradi.
//
// XODIMLARDAN FARQI: guruhda `branchId` — SKALYAR maydon, shuning uchun
// oddiy `branchCondition` ishlaydi (`lib/employeeBranches.ts` dagi
// `branchIds` MASSIVI uchun esa alohida shart kerak edi).

/**
 * Guruh(lar) filtri — JORIY FILIAL ICHIDA.
 *
 * `null` qaytsa — tizimga kirilmagan; chaqiruvchi 401 beradi.
 *
 * Boshqa filialning guruhi "topilmadi" (404) bo'lib ko'rinadi, "ruxsat
 * yo'q" emas: mavjudligini ham bildirmaslik kerak.
 */
export async function groupScopeFilter<T extends Document>(
  where: Filter<T> = {},
): Promise<Filter<T> | null> {
  const scope = await getBranchScope();
  return scope ? withBranch(where, scope) : null;
}
