import type { Db } from "mongodb";
import { branchCondition } from "@/lib/branchScope";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { notifyNewLead } from "@/lib/leadNotify";
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

export async function createOrder(
  db: Db,
  body: NewOrderValues,
  ctx: CreateOrderContext,
  deps: AdjustDeps,
): Promise<CreateOrderOutcome> {
  if (!body.studentName || !body.course || !body.lessonDay) {
    return { ok: false, error: "Majburiy maydonlar to'ldirilmagan", status: 400 };
  }

  const col = db.collection("orders");
  // `id` GLOBAL ketma-ket (unique indeks butun kolleksiyada) — shu bois
  // eng katta id filial bo'yicha KESILMASDAN qidiriladi, o'quvchilardagi
  // bilan bir xil sabab: kesilsa ikkinchi filial mavjud id ni qayta
  // ishlatib, unikal indeksga urilardi.
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

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
  // FILIAL ICHIDAGI tartib raqami — foydalanuvchi ko'radigan "ID".
  // `id` dan farqli, shu filialning eng katta raqamidan davom etadi
  // (lib/ordersData.ts → Order.branchNo). Qidiruv `branchCondition` bilan:
  // 1-filialda filialsiz eski lidlar ham bor (ular ham shu raqamlashda).
  const scope = { branchId, allowed: [branchId], isAdmin: false };
  const lastInBranch = await col.find(branchCondition(scope)).sort({ branchNo: -1 }).limit(1).toArray();
  const branchNo = (Number(lastInBranch[0]?.branchNo) || 0) + 1;
  const order = {
    ...buildOrderFromValues(nextId, { ...body, moderator: author, source }),
    branchId,
    branchNo,
  };
  // insertOne mutates its argument to add _id — insert a copy so the
  // returned `order` (and whatever the client stores from it) stays clean.
  await col.insertOne({ ...order });

  // TELEGRAM — javobdan KEYIN (`defer`), lid qaysi filialda qo'shilganidan
  // qat'i nazar (lib/leadNotify.ts). Javob ichida yuborilsa moderator
  // Telegram javob berguncha kutib turardi va Telegram ishlamay qolgan
  // paytda lid QO'SHILMAY qolardi — yozuv allaqachon bazada bo'lsa ham.
  deps.defer(() => notifyNewLead(db, order, branchId));

  return { ok: true, order };
}
