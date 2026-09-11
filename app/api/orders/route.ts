import { NextResponse, after } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { branchCondition, branchForInsert, getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { notifyNewLead } from "@/lib/leadNotify";
import { withLeadScope } from "@/lib/leadScope";
import { buildOrderFromValues, type NewOrderValues, type Order } from "@/lib/ordersData";

// GET /api/orders — buyurtmalar ro'yxati, faqat bazadagi haqiqiy yozuvlar
// (demo/urug' ma'lumotlar bilan avtomatik to'ldirish endi yo'q — kolleksiya
// bo'sh bo'lsa, ro'yxat ham bo'sh qaytadi).
//
// FILIAL QAMROVI: navbardagi tanlov shu yerda ishlaydi (lib/branchScope.ts),
// ya'ni lid QAYSI filialda qo'shilgan bo'lsa, o'sha filial tanlanganda
// ko'rinadi. Ilgari ro'yxat kesilmasdi va filialni almashtirish lidlarga
// umuman ta'sir qilmasdi.
//
// Qamrov qoidasi bitta joyda — lib/leadScope.ts (u yerda nega aynan
// shunday ekani ham yozilgan): shu filialning lidlari, ustiga xodim O'ZI
// qo'shgan lidlar (filiali o'zgarsa ham ular yo'qolmaydi).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const col = db.collection("orders");
  const rows = await col
    .find(withLeadScope({}, scope, await currentAuthorName()))
    .sort({ id: -1 })
    .toArray();
  const orders: Order[] = rows.map(({ _id, ...rest }) => rest as Order);
  return NextResponse.json({ ok: true, orders });
}

/**
 * Lidning MANBASI (`orders.source`) — o'quvchining yozuvidan.
 *
 * MUAMMO: bu maydon `buildOrderFromValues` da "Sayt" deb QATTIQ yozilgan edi.
 * O'lchandi: bazadagi 98 ta lidning HAMMASIDA `source: "Sayt"`. Ya'ni "Yangi
 * o'quvchi qo'shish" formasidagi MAJBURIY "Manba" tanlovi ("Tavsiya",
 * "Instagram", …) hech qayerga yetib bormasdi — Telegramdagi lid xabari ham
 * doim "📣 Manba: Sayt" deb chiqardi (foydalanuvchi shikoyati, 08.09.2026).
 *
 * "Manba" LIDDA emas, O'QUVCHIDA saqlanadi (`pupils.source`) — lid formasida
 * bunday maydon umuman yo'q. Shu bois u shu yerda o'qiladi. KLIENTDAN
 * OLINMAYDI: yon oyna ham, Kanbandagi forma ham uni yubormaydi, va o'quvchining
 * yozuvi baribir yagona ishonchli manba.
 *
 * TOPISH TARTIBI — avval TO'LIQ ISM, keyin telefon:
 *   • yon oyna (AddOrderModal) `studentName` ni o'quvchining O'Z yozuvidan
 *     yasaydi (ism + " " + familiya, chetlari kesilgan), ya'ni satr aynan
 *     mos keladi;
 *   • telefon esa faqat ZAXIRA: aka-uka/opa-singillar bitta ota-ona raqamini
 *     bo'lishadi, shuning uchun u birinchi bo'lsa boshqa bolaning manbasini
 *     olib qo'yishi mumkin edi.
 *
 * Topilmasa BO'SH satr — o'quvchi hali qo'shilmagan bo'lishi mumkin, va
 * noma'lum manbani to'qib yozgandan ko'ra bo'sh qoldirilgani to'g'ri
 * (leadMessage bo'sh `source` da "Manba" qatorini umuman chizmaydi).
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
async function pupilSourceFor(db: Db, studentName: string, phone: string): Promise<string> {
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

// POST /api/orders — AddOrderModal'dan "Saqlash" bosilganda yangi buyurtma
// yaratadi (id avtomatik oshiriladi, tasks/route.ts'dagi bilan bir xil usul).
export async function POST(req: Request) {
  let body: NewOrderValues;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!body.studentName || !body.course || !body.lessonDay) {
    return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
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
  const author = body.moderator?.trim() ? body.moderator.trim() : await currentAuthorName();

  // Lid manbasi — o'quvchining yozuvidan (yuqoridagi izoh).
  const source = await pupilSourceFor(db, body.studentName, body.phone);

  // Lid QAYSI filialda qo'shilgani — navbardagi tanlovdan.
  const branchId = branchForInsert(scope);
  // FILIAL ICHIDAGI tartib raqami — foydalanuvchi ko'radigan "ID".
  // `id` dan farqli, shu filialning eng katta raqamidan davom etadi
  // (lib/ordersData.ts → Order.branchNo). Qidiruv `branchCondition` bilan:
  // 1-filialda filialsiz eski lidlar ham bor (ular ham shu raqamlashda).
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

  // TELEGRAM — javobdan KEYIN (`after`), lid qaysi filialda qo'shilganidan
  // qat'i nazar (lib/leadNotify.ts). Javob ichida yuborilsa moderator
  // Telegram javob berguncha kutib turardi va Telegram ishlamay qolgan
  // paytda lid QO'SHILMAY qolardi — yozuv allaqachon bazada bo'lsa ham.
  after(() => notifyNewLead(db, order, order.branchId ?? null));

  return NextResponse.json({ ok: true, order });
}
