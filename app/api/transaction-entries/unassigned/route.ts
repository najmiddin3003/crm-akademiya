import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { pupilNameOfDoc, type UnassignedEntry } from "@/lib/pupilEntries";
import { studentBalanceMatch } from "@/lib/studentRefund";
import type { Group } from "@/lib/groups";

// GET /api/transaction-entries/unassigned — EGASI ANIQLANMAGAN to'lovlar.
//
// NIMA UCHUN BOR. 23.09.2026 dan har bir to'lov yozuviga o'quvchining
// ID'si yoziladi (lib/pupilEntries.ts). Eski yozuvlar
// `scripts/backfill-entry-pupil-id.mjs` bilan belgilandi — prodda 740
// tadan 651 tasi. Qolgan 89 tasida ISM TAKRORLANADI va mashina qaysi
// o'quvchi ekanini bila olmaydi: skript ataylab taxmin qilmaydi, chunki
// noto'g'ri ID yozilsa xato yozuvga MUHRLANIB qolardi.
//
// Bu qoldiqni faqat ODAM hal qiladi — kassir yoki moderator to'lovni kim
// qilganini eslaydi. Route o'sha qaror uchun kerakli hamma narsani bitta
// javobda beradi: to'lovning o'zi va nomzod o'quvchilar (telefon, holat,
// filial, guruhlari/ustozlari va allaqachon biriktirilgan to'lovlari).
//
// BIR MARTALIK ISH: yangi to'lovlar oynada o'quvchi ID'si bilan yoziladi,
// ya'ni bu ro'yxat o'smaydi — faqat kamayadi. Shu bois sahifalash yo'q
// (89 qator) va alohida sahifa ham yasalmadi: Moliya → Tranzaksiyalar
// sahifasining ichida, moderator baribir ishlaydigan joyda.

/** Yozuv o'quvchiga oid bo'lgan turlar — xodimga avans/oylik KIRMAYDI. */
const OWNED = { $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] };

const digits = (v: unknown) => String(v ?? "").replace(/[^0-9]/g, "");

export async function GET() {
  const db = await ensureIndexes();

  const rows = await db
    .collection("transaction_entries")
    .find(
      { ...OWNED, pupilId: { $exists: false }, studentName: { $nin: ["", null] } },
      {
        projection: {
          _id: 0, id: 1, date: 1, time: 1, amount: 1, studentName: 1,
          teacherName: 1, txName: 1, paymentType: 1, moderator: 1, note: 1,
        },
      },
    )
    .sort({ id: 1 })
    .toArray();

  if (rows.length === 0) return NextResponse.json({ ok: true, count: 0, entries: [] });

  // Nomzodlar ism bo'yicha topiladi — aynan shu ikkilanish sababli yozuv
  // belgilanmagan edi.
  const pupils = await db
    .collection("pupils")
    .find({}, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1, branchId: 1 } })
    .toArray();
  const byName = new Map<string, typeof pupils>();
  for (const p of pupils) {
    const k = pupilNameOfDoc(p).toLowerCase();
    if (!k) continue;
    const list = byName.get(k);
    if (list) list.push(p);
    else byName.set(k, [p]);
  }

  // Faqat KERAKLI o'quvchilar uchun qo'shimcha ma'lumot yig'amiz —
  // 7 133 o'quvchining guruhini hisoblashning ma'nosi yo'q.
  const needed = new Set<number>();
  for (const e of rows) {
    for (const p of byName.get(String(e.studentName).trim().toLowerCase()) ?? []) needed.add(Number(p.id));
  }

  const [groups, paid] = await Promise.all([
    needed.size === 0
      ? Promise.resolve([] as Group[])
      : (db
          .collection<Group>("groups")
          .find({ studentIds: { $in: [...needed] } }, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, studentIds: 1 } })
          .toArray()),
    // Nomzodning ALLAQACHON biriktirilgan to'lovlari — eng foydali belgi:
    // "bu bolaga oldin ham shu ustozdan pul kelgan" degani qarorni
    // deyarli o'zi hal qiladi. Shart balans hisobi bilan bir xil
    // (lib/studentRefund.ts).
    db
      .collection("transaction_entries")
      .aggregate([
        { $match: { $and: [studentBalanceMatch(), { pupilId: { $exists: true } }] } },
        { $group: { _id: "$pupilId", n: { $sum: 1 }, total: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);

  const groupsOf = new Map<number, string[]>();
  for (const g of groups) {
    const label = [g.name || g.course || String(g.id), String(g.teacher ?? "").trim()].filter(Boolean).join(" — ");
    for (const sid of g.studentIds ?? []) {
      if (!needed.has(sid)) continue;
      const list = groupsOf.get(sid);
      if (list) list.push(label);
      else groupsOf.set(sid, [label]);
    }
  }
  const paidOf = new Map<number, { n: number; total: number }>(
    paid.map((r) => [Number(r._id), { n: Number(r.n) || 0, total: Number(r.total) || 0 }]),
  );

  const entries: UnassignedEntry[] = rows.map((e) => {
    const hits = byName.get(String(e.studentName).trim().toLowerCase()) ?? [];
    const phones = new Set(hits.map((p) => digits(p.phone)).filter(Boolean));
    return {
      id: Number(e.id),
      date: String(e.date ?? ""),
      time: String(e.time ?? ""),
      amount: Number(e.amount) || 0,
      studentName: String(e.studentName ?? ""),
      teacherName: String(e.teacherName ?? ""),
      txName: String(e.txName ?? ""),
      paymentType: String(e.paymentType ?? ""),
      moderator: String(e.moderator ?? ""),
      note: String(e.note ?? ""),
      samePerson: hits.length > 1 && phones.size === 1 && hits.every((p) => digits(p.phone)),
      candidates: hits.map((p) => {
        const id = Number(p.id);
        const pd = paidOf.get(id);
        return {
          id,
          name: pupilNameOfDoc(p),
          phone: String(p.phone ?? ""),
          status: String(p.status ?? "Aktiv"),
          branchId: p.branchId == null ? null : Number(p.branchId),
          groups: groupsOf.get(id) ?? [],
          paidCount: pd?.n ?? 0,
          paidTotal: pd?.total ?? 0,
        };
      }),
    };
  });

  return NextResponse.json({ ok: true, count: entries.length, entries });
}
