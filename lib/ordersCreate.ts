import type { Db } from "mongodb";
import { branchCondition } from "@/lib/branchScope";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { notifyNewLead } from "@/lib/leadNotify";
import { SURVEY_SOURCE, type LeadDaraja } from "@/lib/leadSettings";
import { buildOrderFromValues, type NewOrderValues, type Order } from "@/lib/ordersData";

// YANGI LID (buyurtma) YARATISH — yadro.
//
// NEGA ROUTE'DAN AJRATILGAN: `POST /api/orders` ni web'dagi "Yangi
// buyurtma" oynasi chaqiradi; 18.09.2026 dan xodimlar Telegram boti ham
// lid qo'shadi (lib/staffBot/lead.ts). Botda sessiya ham, filial cookie'si
// ham yo'q — muallif va filial chaqiruvchidan keladi. Qolgan hamma narsa
// (id, filial ichidagi raqam, manba, Telegram lid topigi) bitta joyda.
// Mantiq route'dagi bilan aynan bir xil — izohlar ham o'sha yerdan.

export interface CreateOrderContext {
  /** Lidni KIM qo'shgani — `hr_employees.name` (web: currentAuthorName). */
  authorName: string;
  /** Lid QAYSI filialda — web: navbardagi tanlov; bot: kassaning filiali. */
  branchId: number;
}

export type CreateOrderOutcome =
  | { ok: true; order: Order & { branchId: number; branchNo: number } }
  | { ok: false; error: string; status: 400 };

/**
 * Lid manbasi — O'QUVCHINING YOZUVIDAN.
 *
 * Ilgari `source: "Sayt"` qattiq yozilgan edi (lib/ordersData.ts izohi).
 * Endi lid yaratilayotganda o'quvchi `pupils` da ism (yoki telefon)
 * bo'yicha topiladi va uning "Manba" maydoni olinadi. Topilmasa bo'sh
 * qoladi (leadMessage bo'sh `source` da "Manba" qatorini umuman chizmaydi).
 *
 * TAKRORLANGAN O'QUVCHILAR. Bazada bir xil ism VA bir xil raqamli ikkita
 * yozuv uchraydi (o'lchandi: #14927 va #16792 — "Shahboz Rustamjanov",
 * ikkalasi ham "95 214 03 33"; birinchisida `source: ""`, ikkinchisida
 * "Boshqa"). Oddiy `findOne` birinchisini olib, manbani BO'SH deb
 * qaytarardi. Shu bois qidiruvga IKKI shart qo'shilgan:
 *   • `source` bo'sh bo'lmagan yozuvlargina hisobga olinadi — bo'sh
 *     yozuv baribir foyda bermaydi, u faqat to'g'ri javobni to'sadi;
 *   • `id` bo'yicha teskari tartib — dublikatlarda ENG YANGI yozuv
 *     ustun: moderator hozir kiritgani o'sha.
 *
 * INDEKS SHART EMAS: bu so'rov faqat lid yaratilganda (kuniga bir necha marta,
 * odam tezligida) bajariladi, `pupils` esa ~7 ming yozuv (o'lchandi: ~190 ms).
 */
export async function pupilSourceFor(db: Db, studentName: string, phone: string): Promise<string> {
  const name = (studentName || "").trim();
  const tel = (phone || "").trim();
  const col = db.collection("pupils");

  const sourceOf = async (match: Record<string, unknown>): Promise<string> => {
    const row = await col.findOne(
      { $and: [match, { source: { $nin: ["", null] } }] },
      { projection: { _id: 0, source: 1 }, sort: { id: -1 } },
    );
    return typeof row?.source === "string" ? row.source.trim() : "";
  };

  if (name) {
    const byName = await sourceOf({
      $expr: {
        $eq: [
          { $trim: { input: { $concat: [{ $ifNull: ["$firstName", ""] }, " ", { $ifNull: ["$lastName", ""] }] } } },
          name,
        ],
      },
    });
    if (byName) return byName;
  }

  return tel ? sourceOf({ phone: tel }) : "";
}

type InsertedOrder = Order & { branchId: number; branchNo: number };

/**
 * Lidni yozadi: global `id` va filial ichidagi tartib raqami bilan.
 *
 * `id` GLOBAL ketma-ket (unique indeks butun kolleksiyada) — shu bois
 * eng katta id filial bo'yicha KESILMASDAN qidiriladi, o'quvchilardagi
 * bilan bir xil sabab: kesilsa ikkinchi filial mavjud id ni qayta
 * ishlatib, unikal indeksga urilardi.
 *
 * FILIAL ICHIDAGI tartib raqami — foydalanuvchi ko'radigan "ID". `id`
 * dan farqli, shu filialning eng katta raqamidan davom etadi
 * (lib/ordersData.ts → Order.branchNo). Qidiruv `branchCondition` bilan:
 * 1-filialda filialsiz eski lidlar ham bor (ular ham shu raqamlashda).
 * 09.10.2026 dan u HOVUZNI oladi (lib/branchPools.ts): 1- va 2-filial
 * lidlari bitta ro'yxat, yangi raqam ikkalasining eng kattasidan davom
 * etadi (eski №1–№92 ikki filialda takrorlanib qolgan — ular o'zgarmaydi).
 *
 * IKKI SO'ROV BIR VAQTDA (ommaviy so'rovnoma — /sorovnoma — buni odatiy
 * qiladi) bir xil `id` ni hisoblab qo'yadi: ikkinchisi unikal indeksga
 * uriladi va raqamlar qayta hisoblanib yana urinadi.
 */
async function insertLead(db: Db, branchId: number, build: (id: number) => Order): Promise<InsertedOrder> {
  const col = db.collection("orders");
  const scope = { branchId, allowed: [branchId], isAdmin: false };
  for (let attempt = 0; ; attempt++) {
    const [last, lastInBranch] = await Promise.all([
      col.find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray(),
      col.find(branchCondition(scope), { projection: { _id: 0, branchNo: 1 } }).sort({ branchNo: -1 }).limit(1).toArray(),
    ]);
    const order: InsertedOrder = {
      ...build((Number(last[0]?.id) || 0) + 1),
      branchId,
      branchNo: (Number(lastInBranch[0]?.branchNo) || 0) + 1,
    };
    try {
      // insertOne mutates its argument to add _id — insert a copy so the
      // returned `order` (and whatever the client stores from it) stays clean.
      await col.insertOne({ ...order });
      return order;
    } catch (e) {
      if (attempt < 4 && (e as { code?: number } | null)?.code === 11000) continue;
      throw e;
    }
  }
}

export async function createOrder(
  db: Db,
  body: NewOrderValues,
  ctx: CreateOrderContext,
  deps: AdjustDeps,
): Promise<CreateOrderOutcome> {
  if (!body.studentName || !body.course || !body.lessonDay) {
    return { ok: false, error: "Majburiy maydonlar to'ldirilmagan", status: 400 };
  }

  // LIDNI KIM QO'SHGANI. Ilgari bu maydon HAR BIR lidda bo'sh edi
  // (`buildOrderFromValues` uni faqat Kanbandagi to'liq sahifa formasidan
  // olardi, yon oyna esa yubormaydi) — o'lchandi: bazadagi 59 ta lidning
  // hammasida `moderator: ""`. Ya'ni "Dilmurod qo'shgan lidlar" degan
  // savolga tizim javob bera olmasdi va /orders-list dagi "Moderator"
  // filtri hech qachon hech narsani topmasdi.
  //
  // Forma qiymati USTUN turadi: Kanban oqimida moderator ataylab
  // tanlanadi (lid boshqa xodimga biriktirilishi mumkin), bu yerdagi ism
  // esa faqat u tanlanmaganda qo'yiladigan sukut.
  const author = body.moderator?.trim() ? body.moderator.trim() : ctx.authorName;

  // Lid manbasi — o'quvchining yozuvidan (yuqoridagi izoh).
  const source = await pupilSourceFor(db, body.studentName, body.phone);

  // Lid QAYSI filialda qo'shilgani — chaqiruvchidan.
  const branchId = ctx.branchId;
  const order = await insertLead(db, branchId, (id) => buildOrderFromValues(id, { ...body, moderator: author, source }));

  // TELEGRAM — javobdan KEYIN (`defer`), lid qaysi filialda qo'shilganidan
  // qat'i nazar (lib/leadNotify.ts). Javob ichida yuborilsa moderator
  // Telegram javob berguncha kutib turardi va Telegram ishlamay qolgan
  // paytda lid QO'SHILMAY qolardi — yozuv allaqachon bazada bo'lsa ham.
  deps.defer(() => notifyNewLead(db, order, branchId));

  return { ok: true, order };
}

/** Ommaviy so'rovnoma javoblari — app/api/sorovnoma tekshirib bo'lgan. */
export interface SurveyLeadInput {
  name: string;
  /** "94 155 88 55" — bazadagi lid va o'quvchi raqamlari shaklida. */
  phone: string;
  branchId: number;
  yonalish: string;
  course: string;
  daraja?: LeadDaraja;
  sinf?: string;
  qulayVaqt: string;
  heardFrom: string;
  note: string;
}

/**
 * So'rovnomadan kelgan lid (/sorovnoma). Muallif yo'q — moderator bo'sh
 * qoladi va lidni birinchi bo'lib ishlagan xodimga biriktiriladi
 * (lib/leadHolatServer.ts → assignModerator). Manba — kanal:
 * "Sayt so'rovnomasi"; odamning "bizni qayerdan bildingiz?" javobi
 * alohida (`heardFrom`), `source` lug'ati aralashmasin.
 */
export async function createSurveyLead(db: Db, input: SurveyLeadInput, deps: AdjustDeps): Promise<InsertedOrder> {
  const order = await insertLead(db, input.branchId, (id) => ({
    ...buildOrderFromValues(id, {
      studentName: input.name,
      phone: input.phone,
      referral: "",
      course: input.course,
      lessonDay: "",
      lessonStartTime: "",
      teacher: "",
      group: "",
      firstLessonDate: "",
      firstLessonTime: "",
      note: input.note,
      moderator: "",
      source: SURVEY_SOURCE,
    }),
    yonalish: input.yonalish,
    ...(input.daraja ? { daraja: input.daraja } : {}),
    ...(input.sinf ? { sinf: input.sinf } : {}),
    qulayVaqt: input.qulayVaqt,
    heardFrom: input.heardFrom,
  }));
  deps.defer(() => notifyNewLead(db, order, input.branchId));
  return order;
}
