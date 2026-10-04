import type { Db } from "mongodb";

// XODIM ISMI O'ZGARGANDA — ESKI ISM YOZILGAN BOG'LANISHLAR YANGI ISMGA KO'CHADI (04.10.2026).
//
// NEGA KERAK: ko'p bog'lanish xodim ID'si emas, ISMI bo'yicha:
//   • ustozning foizli oyligi — kirimdagi `teacherName` (lib/payrollSources.ts);
//   • olgan avans/oyligi — chiqimdagi `studentName`;
//   • bonus/jarima — `recipientName`; ustoz almashuvi — `fromTeacher`/`toTeacher`;
//   • KASSA EGALIGI — `cashboxes.moderator` (kassir faqat shu ism bo'yicha o'z kassasini
//     ko'radi va unga kelgan ko'chirmani tasdiqlaydi: lib/currentEmployee.ts → ownsCashbox,
//     app/api/cashboxes, xodimlar boti);
//   • lidlar (`orders.moderator` — lid muallifi qamrovi, lib/leadScope.ts), guruh ustozi.
// Ism o'zgartirilsa-yu, bular eski ismda qolsa — o'sha to'lovlar HECH KIMNIKI bo'lib qoladi.
// O'lchandi (prod, 03.10.2026): 4-filialda 7 ustozning ismiga familiya qo'shilganda/yozilishi
// tuzatilganda sentabr–oktabr kirimlarining ulushi oylikdan tushib qoldi, 125 000 avans
// "olinmagan" bo'lib ko'rindi (ikki marta to'lash xavfi), kassir o'z kassasini yo'qotdi.
//
// NIMA KO'CHADI — faqat JORIY ishlaydigan maydonlar (TARGETS). TARIX TEGILMAYDI: arxivdagi
// guruhlar, oylik chiqarish cheklari (salary_runs — ism ataylab muzlatilgan), gamifikatsiya
// natijalari, SMS jurnali, ishga arizalar, lid holati tarixi. O'QUVCHI ismlari ham (kirimdagi
// `studentName` — o'quvchi) tegilmaydi: chiqimda ham faqat o'quvchiga qaytarim EMAS bo'lganlar.
//
// BIR XIL ISMLI BOSHQA FAOL XODIM bo'lsa — HECH NARSA ko'chirilmaydi: eski ism yozilgan
// to'lov kimniki ekanini ism bo'yicha ajratib bo'lmaydi (ikki xil odamning yozuvi aralashib
// ketardi). Chaqiruvchi buni foydalanuvchiga aytadi. Arxivdagi ismdosh to'smaydi —
// odatda bu shu odamning takroriy yozuvi.
//
// Mos kelish — harf kattaligi va chetdagi probel FARQLANMAYDI (oylik hisobi ham shunday
// solishtiradi: payrollSources.ts → nameKey).

export interface RenameSyncResult {
  /** "kolleksiya.maydon" → yangilangan hujjatlar soni (0 bo'lganlar yo'q). */
  moved: Record<string, number>;
  total: number;
  /** "same" — ism amalda o'zgarmagan; "ambiguous" — bir xil ismli boshqa faol xodim bor. */
  skipped?: "same" | "ambiguous";
  /** `skipped: "ambiguous"` da — o'sha ismdosh(lar), "#id Ism". */
  namesakes?: string[];
}

const TARGETS: { coll: string; field: string; extra?: Record<string, unknown> }[] = [
  { coll: "transaction_entries", field: "teacherName" },
  { coll: "transaction_entries", field: "studentName", extra: { txType: "payOut", studentRefund: { $ne: true } } },
  { coll: "transaction_entries", field: "moderator" },
  { coll: "cashboxes", field: "moderator" },
  { coll: "groups", field: "teacher" },
  { coll: "groups", field: "assistant" },
  { coll: "orders", field: "teacher" },
  { coll: "orders", field: "moderator" },
  { coll: "orders", field: "holatBy" },
  { coll: "bonuses", field: "recipientName", extra: { type: "employee" } },
  { coll: "penalties", field: "recipientName", extra: { type: "employee" } },
];

const key = (s: unknown) => String(s ?? "").trim().toLowerCase();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function syncEmployeeRename(db: Db, empId: number, oldName: unknown, newName: unknown): Promise<RenameSyncResult> {
  const from = String(oldName ?? "").trim();
  const to = String(newName ?? "").trim();
  if (!from || !to || from === to) return { moved: {}, total: 0, skipped: "same" };
  const same = { $regex: `^\\s*${escapeRegex(from)}\\s*$`, $options: "i" };

  const namesakes = await db
    .collection("hr_employees")
    .find({ id: { $ne: empId }, name: same, archReason: { $in: ["", null] } }, { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();
  if (namesakes.length > 0) {
    return { moved: {}, total: 0, skipped: "ambiguous", namesakes: namesakes.map((n) => `#${n.id} ${n.name}`) };
  }

  const moved: Record<string, number> = {};
  let total = 0;
  const count = (label: string, n: number) => {
    if (n > 0) {
      moved[label] = (moved[label] ?? 0) + n;
      total += n;
    }
  };
  for (const t of TARGETS) {
    const r = await db.collection(t.coll).updateMany({ ...(t.extra ?? {}), [t.field]: same }, { $set: { [t.field]: to } });
    count(`${t.coll}.${t.field}`, r.modifiedCount);
  }

  // USTOZ ALMASHUVI (lib/teacherHandover.ts): eski ustoz — `fromTeacher` + kalit `fromKey`,
  // o'quvchilar kimga o'tgani — `pupils[].toTeacher`. Hujjatlar kam — JS'da yangilanadi.
  try {
    const handovers = db.collection("teacher_handovers");
    const docs = await handovers.find({ $or: [{ fromTeacher: same }, { "pupils.toTeacher": same }] }).toArray();
    for (const d of docs) {
      const set: Record<string, unknown> = {};
      if (key(d.fromTeacher) === key(from)) {
        set.fromTeacher = to;
        set.fromKey = key(to);
      }
      if (Array.isArray(d.pupils) && d.pupils.some((p: { toTeacher?: unknown }) => key(p?.toTeacher) === key(from))) {
        set.pupils = d.pupils.map((p: { toTeacher?: unknown }) => (key(p?.toTeacher) === key(from) ? { ...p, toTeacher: to } : p));
      }
      if (Object.keys(set).length === 0) continue;
      const r = await handovers.updateOne({ _id: d._id }, { $set: set });
      count("teacher_handovers", r.modifiedCount);
    }
  } catch (e) {
    // Unikal kalit (month + fromKey) to'qnashuvi — yangi ismda shu oy uchun allaqachon
    // almashuv bor. Asosiy bog'lanishlar ko'chdi; bu yozuv qo'lda ko'rib chiqiladi.
    console.error("[employeeRename] ustoz almashuvi yangilanmadi:", e);
  }
  return { moved, total };
}
