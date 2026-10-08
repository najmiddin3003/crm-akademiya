import type { AttendanceStatus } from "@/lib/attendance";
import { saveAttendanceMark } from "@/lib/attendanceWrite";
import { withBranch } from "@/lib/branchScope";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { addPupilToGroup, removePupilFromGroup } from "@/lib/groupStudents";
import { holatMeta, isHolat, type LeadGuruh, type LeadSinov } from "@/lib/leadHolat";
import { applyHolatChange } from "@/lib/leadHolatServer";
import { refreshLeadMessage } from "@/lib/leadNotify";
import { withLeadScope } from "@/lib/leadScope";
import type { Order } from "@/lib/ordersData";
import type { NewPupilValues } from "@/lib/pupilsData";
import { createPupil, setPupilStatus } from "@/lib/pupilWrite";
import { authorNameOf, type AiContext } from "../context";
import { findPupilForLead, pupilValuesFromLead, type GroupDoc } from "./prepareStudents";
import type { ActionDoc, ActionOutcome } from "./store";

// 5-BOSQICH AMALLARINI YOZISH (08.10.2026) — web bilan UMUMIY yadrolar:
//   pupil      — lib/pupilWrite.ts → createPupil (+ lib/groupStudents.ts);
//   membership — lib/groupStudents.ts;
//   attendance — lib/attendanceWrite.ts (har o'quvchi alohida, web
//                jadvalidagi kabi; gamifikatsiya cheklovi har birida);
//   status     — lib/pupilWrite.ts → setPupilStatus;
//   stage      — lib/leadHolatServer.ts → applyHolatChange («guruh» da
//                avval o'quvchi topiladi/yaratiladi va guruhga qo'shiladi —
//                Lidlar sahifasidagi «Guruhga qo'shish» oynasi tartibida).
// Ruxsat va qamrov oldin lib/ai/actions/execute.ts → checkAccess da.

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const profileHref = (id: number) => `/student-edit/${id}?src=list`;

export async function executeStudentAction(ctx: AiContext, doc: ActionDoc, deps: AdjustDeps): Promise<ActionOutcome> {
  const db = ctx.db;
  const p = doc.payload;

  if (doc.kind === "pupil") {
    const out = await createPupil(db, num(p.branchId), (p.values ?? {}) as NewPupilValues);
    if (!out.ok) return { ok: false, error: out.error };
    const id = out.pupil.id;
    const groupId = num(p.groupId);
    let groupNote = "";
    if (Number.isFinite(groupId)) {
      // O'quvchi allaqachon yozildi — guruh xatosi uni bekor qilmaydi, kartada ko'rinadi.
      const add = await addPupilToGroup(db, ctx.scope, groupId, id, str(p.joinedAt) || null, deps);
      if (!add.ok) groupNote = ` · guruhga qo'shilmadi: ${add.error}`;
    }
    return {
      ok: true,
      resultText: `#${id}${groupNote}`,
      resultHref: profileHref(id),
      result: { pupilId: id, groupId: Number.isFinite(groupId) ? groupId : null, groupAdded: Number.isFinite(groupId) ? !groupNote : undefined },
    };
  }

  if (doc.kind === "membership") {
    const groupId = num(p.groupId);
    const pupilId = num(p.pupilId);
    if (str(p.op) === "remove") {
      const out = await removePupilFromGroup(db, ctx.scope, groupId, pupilId);
      if (!out.ok) return { ok: false, error: out.error };
      return {
        ok: true,
        resultText: out.value.removed ? "guruhdan chiqarildi" : "guruhda emas edi",
        resultHref: `/groups/${groupId}`,
        result: { removed: out.value.removed },
      };
    }
    const out = await addPupilToGroup(db, ctx.scope, groupId, pupilId, str(p.joinedAt) || null, deps);
    if (!out.ok) return { ok: false, error: out.error };
    return {
      ok: true,
      resultText: out.value.added ? "guruhga qo'shildi" : "allaqachon guruhda",
      resultHref: `/groups/${groupId}`,
      result: { added: out.value.added },
    };
  }

  if (doc.kind === "attendance") {
    const groupId = num(p.groupId);
    const date = str(p.date);
    const marks = (Array.isArray(p.marks) ? p.marks : []) as { pupilId?: unknown; status?: unknown; reason?: unknown; note?: unknown }[];
    const author = ctx.userName || authorNameOf(ctx);
    let saved = 0;
    const failed: string[] = [];
    for (const m of marks) {
      const out = await saveAttendanceMark(
        db,
        ctx.scope,
        {
          groupId,
          pupilId: num(m.pupilId),
          date,
          status: str(m.status) as AttendanceStatus,
          reason: str(m.reason) || null,
          note: str(m.note) || null,
        },
        author,
        deps,
      );
      if (out.ok) saved++;
      else failed.push(out.error);
    }
    if (saved === 0) return { ok: false, error: failed[0] ?? "Davomat saqlanmadi" };
    const reasons = [...new Set(failed)].join("; ");
    return {
      ok: true,
      resultText: failed.length ? `${saved} ta belgi · ${failed.length} tasi saqlanmadi: ${reasons}` : `${saved} ta belgi`,
      resultHref: `/groups/${groupId}`,
      result: { saved, failed: failed.length },
    };
  }

  if (doc.kind === "status") {
    const pupilId = num(p.pupilId);
    const out = await setPupilStatus(db, ctx.scope, pupilId, str(p.status), str(p.reason));
    if (!out.ok) return { ok: false, error: out.error };
    return { ok: true, resultText: str(p.status), resultHref: profileHref(pupilId), result: { pupilId, status: str(p.status) } };
  }

  // stage
  const orderId = num(p.orderId);
  const to = str(p.to);
  if (!isHolat(to)) return { ok: false, error: "Noma'lum holat" };
  const author = authorNameOf(ctx);
  const filter = withLeadScope({ id: orderId }, ctx.scope, author);
  const order = (await db.collection("orders").findOne(filter, { projection: { _id: 0 } })) as unknown as Order | null;
  if (!order) return { ok: false, error: "Lid topilmadi" };

  let guruh: LeadGuruh | undefined;
  let pupilId: number | undefined;
  if (to === "guruh") {
    const groupId = num(p.groupId);
    const g = (await db.collection("groups").findOne(withBranch({ id: groupId }, ctx.scope), {
      projection: { _id: 0, id: 1, name: 1, day: 1, time: 1 },
    })) as unknown as GroupDoc | null;
    if (!g) return { ok: false, error: "Guruh topilmadi" };
    // O'quvchi qaytadan qidiriladi — qoralamadan beri kimdir yaratib qo'ygan bo'lishi mumkin.
    let pupil = await findPupilForLead(ctx, order);
    if (!pupil) {
      const created = await createPupil(db, ctx.scope.branchId, pupilValuesFromLead(order));
      if (!created.ok) return { ok: false, error: created.error };
      pupil = { id: created.pupil.id, name: `${created.pupil.firstName} ${created.pupil.lastName}`.trim() };
    }
    const joinedAt = str(p.joinedAt) || null;
    const add = await addPupilToGroup(db, ctx.scope, groupId, pupil.id, joinedAt, deps);
    if (!add.ok) return { ok: false, error: add.error };
    guruh = { id: g.id, nom: String(g.name || g.id), kun: g.day || "", vaqt: g.time || "", boshlash: joinedAt ?? "" };
    pupilId = pupil.id;
  }

  const out = await applyHolatChange(db, filter, order, {
    to,
    sinov: to === "sinov" ? (p.sinov as LeadSinov) : undefined,
    guruh,
    radSabab: str(p.radSabab) || undefined,
    pupilId,
    by: author || ctx.userName || "CRM",
    via: "crm",
    assignModerator: author || undefined,
  });
  if (!out.ok) {
    // Guruhga qo'shish allaqachon bo'lgan — faqat lid holati yozilmadi (sahifadagi oyna bilan bir xil xabar).
    return { ok: false, error: guruh ? `O'quvchi guruhga qo'shildi, lekin lid holati saqlanmadi: ${out.error}` : out.error };
  }
  // Telegram guruhidagi lid xabarining "Status:" qatori ham yangilansin.
  deps.defer(() => refreshLeadMessage(db, orderId));
  return {
    ok: true,
    resultText: `#${order.branchNo ?? order.id} → ${holatMeta(to).nom}`,
    resultHref: "/orders-list",
    result: { orderId, to, ...(pupilId ? { pupilId } : {}) },
  };
}
