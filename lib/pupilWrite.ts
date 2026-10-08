import type { Db } from "mongodb";
import { withPupilBranch, type BranchScope } from "./branchScope";
import { closeMemberships } from "./groupMembership";
import { buildPupilFromValues, isPupilStatus, type NewPupilValues, type Pupil } from "./pupilsData";
import { uzDateIso } from "./uzTime";

// O'QUVCHI YOZISH YADROLARI — yangi o'quvchi va holat (Aktiv / Muzlatilgan /
// Arxiv). Web route'lari (app/api/pupils, app/api/pupils/[id]/status) va AI
// yordamchi (lib/ai/actions/execute.ts) BIR XIL funksiyani chaqiradi
// (08.10.2026, mantiq route'lardan o'zgarishsiz ko'chirildi — izohlar
// o'sha yerda).

export type PupilWriteOutcome = { ok: true; pupil: Pupil } | { ok: false; error: string; status: 400 | 404 | 503 };

/** Parol xeshlari hech qachon klientga chiqmaydi. */
function clean(doc: Record<string, unknown>): Pupil {
  const { _id, studentPasswordHash, parentPasswordHash, ...rest } = doc;
  void _id;
  void studentPasswordHash;
  void parentPasswordHash;
  return rest as unknown as Pupil;
}

/**
 * Yangi o'quvchi `branchId` filialiga. Ism va manba MAJBURIY (manba —
 * chetlari kesilgan holda, "Manba" filtri qat'iy tenglik bilan ishlaydi).
 *
 * `id` GLOBAL ketma-ket (unique indeks butun kolleksiyada) — eng katta id
 * filial bo'yicha kesilmasdan olinadi. Ikki so'rov bir vaqtda kelsa
 * ikkinchisi E11000 ga uriladi — bir necha marta qayta uriniladi.
 */
export async function createPupil(db: Db, branchId: number, values: NewPupilValues): Promise<PupilWriteOutcome> {
  if (!values.firstName?.trim()) return { ok: false, error: "Ism majburiy", status: 400 };
  const source = typeof values.source === "string" ? values.source.trim() : "";
  if (!source) return { ok: false, error: "Manba majburiy", status: 400 };

  const col = db.collection("pupils");
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
    const nextId = (last[0]?.id ?? 0) + 1;
    const pupil = { ...buildPupilFromValues(nextId, { ...values, source }), branchId };
    try {
      // insertOne argumentiga `_id` qo'shadi — qaytariladigan `pupil` toza qolsin.
      await col.insertOne({ ...pupil });
      return { ok: true, pupil };
    } catch (e) {
      if ((e as { code?: number })?.code !== 11000) throw e;
    }
  }
  return { ok: false, error: "Hozir band — qayta urinib ko'ring", status: 503 };
}

/**
 * Holatni o'zgartiradi. Aktiv bo'lmagan holatga sabab MAJBURIY. Arxivga
 * o'tkazilgan o'quvchi barcha guruhlardan chiqariladi va a'zolik tarixi
 * shu kun yopiladi (arxivgacha darslari Qarzdorlar hisobotida qoladi).
 * Qamrov — joriy filial hovuzi (PATCH /api/pupils/:id bilan bir xil).
 */
export async function setPupilStatus(
  db: Db,
  scope: BranchScope,
  pupilId: number,
  status: unknown,
  reasonRaw: unknown,
): Promise<PupilWriteOutcome> {
  if (!isPupilStatus(status)) return { ok: false, error: "Holat noto'g'ri", status: 400 };
  const reason = String(reasonRaw ?? "").trim();
  if (status !== "Aktiv" && !reason) return { ok: false, error: "Sababni kiriting", status: 400 };

  // Toshkent kuni — serverda UTC, kechqurun bir kun orqaga yozilmasin.
  const today = uzDateIso();
  const res = await db
    .collection("pupils")
    .findOneAndUpdate(
      withPupilBranch({ id: pupilId }, scope),
      { $set: { status, statusChangedAt: today, statusReason: status === "Aktiv" ? "" : reason } },
      { returnDocument: "after" },
    );
  if (!res) return { ok: false, error: "O'quvchi topilmadi", status: 404 };

  if (status === "Arxiv") {
    await db.collection<{ studentIds?: number[] }>("groups").updateMany({ studentIds: pupilId }, { $pull: { studentIds: pupilId } });
    await closeMemberships(db, pupilId, null, today);
  }
  return { ok: true, pupil: clean(res) };
}
