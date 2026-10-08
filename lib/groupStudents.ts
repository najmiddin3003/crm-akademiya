import type { Db } from "mongodb";
import { withBranch, withPupilBranch, type BranchScope } from "./branchScope";
import type { AdjustDeps } from "./cashboxAdjust";
import { closeMemberships, openMembership } from "./groupMembership";
import type { Group } from "./groups";
import type { Pupil } from "./pupilsData";
import { notifyGroupAdded } from "./studentBot/notify";
import { uzDateIso } from "./uzTime";

// GURUH A'ZOLIGI YADROLARI — o'quvchini guruhga qo'shish va chiqarish.
// Web route'i (app/api/groups/[id]/students) va AI yordamchi
// (lib/ai/actions/execute.ts) BIR XIL funksiyani chaqiradi (08.10.2026,
// mantiq route'dan o'zgarishsiz ko'chirildi).
//
// FILIAL QAMROVI IKKALA TOMONDA: guruh ham, o'quvchi ham JORIY filialda
// bo'lishi shart. Faqat guruh kesilsa, moderator boshqa filialning
// o'quvchisini o'z guruhiga qo'shib, uni shu yo'l bilan ko'rib olardi.

export type MembershipOutcome<T> = { ok: true; value: T } | { ok: false; error: string; status: 400 | 404 };

/**
 * O'quvchini guruhga qo'shadi. `joinedAt` ("YYYY-MM-DD") — darslar shu
 * kundan sanaladi (Qarzdorlar hisoboti); `null` — bugun. Kelajak sanasi
 * ham mumkin (lid birinchi darsga yozilganda). `added: false` — allaqachon
 * a'zo edi (hech narsa o'zgarmadi, faqat a'zolik yozuvi yo'qligi tuzatiladi).
 *
 * `deps.defer` — o'quvchilar botining "guruhga qo'shildingiz" xabari
 * (route'da `after`): Telegram sekin javob bersa ham xodim kutmaydi.
 */
export async function addPupilToGroup(
  db: Db,
  scope: BranchScope,
  groupId: number,
  pupilId: number,
  joinedAt: string | null,
  deps: AdjustDeps,
): Promise<MembershipOutcome<{ pupil: Pupil; added: boolean }>> {
  const pupil = await db.collection("pupils").findOne(withPupilBranch({ id: pupilId }, scope));
  if (!pupil) return { ok: false, error: "O'quvchi topilmadi", status: 404 };
  const res = await db.collection<Group>("groups").updateOne(withBranch({ id: groupId }, scope), { $addToSet: { studentIds: pupilId } });
  if (res.matchedCount === 0) return { ok: false, error: "Guruh topilmadi", status: 404 };

  // FAQAT HAQIQATAN QO'SHILGANDA xabar ketadi: `$addToSet` a'zo o'quvchida
  // hech narsani o'zgartirmaydi, lekin so'rov muvaffaqiyatli tugaydi —
  // `modifiedCount` tekshirilmasa, har safar bir xil xabar ketardi.
  const added = res.modifiedCount > 0;
  if (added) {
    const group = await db.collection<Group>("groups").findOne({ id: groupId }, { projection: { _id: 0 } });
    if (group) deps.defer(() => notifyGroupAdded(db, pupilId, group as unknown as Group));
  }

  // A'ZOLIK TARIXI (lib/groupMembership.ts) — studentIds bilan BIRGA.
  // Haqiqatan qo'shilganda sana — so'ralgan/bugun; allaqachon a'zo bo'lsa
  // faqat yozuvi yo'qligi tuzatiladi (sanasi noma'lum → guruh boshi).
  await openMembership(db, groupId, pupilId, added ? (joinedAt ?? uzDateIso()) : null);
  const { _id, ...rest } = pupil;
  void _id;
  return { ok: true, value: { pupil: rest as unknown as Pupil, added } };
}

/**
 * O'quvchini guruhdan chiqaradi. A'zolik shu kun yopiladi — o'tgan
 * darslari qarz bo'lib qoladi. `removed: false` — guruhda emas edi.
 */
export async function removePupilFromGroup(
  db: Db,
  scope: BranchScope,
  groupId: number,
  pupilId: number,
): Promise<MembershipOutcome<{ removed: boolean }>> {
  const res = await db
    .collection<{ id: number; studentIds?: number[] }>("groups")
    .updateOne(withBranch({ id: groupId }, scope), { $pull: { studentIds: pupilId } });
  if (res.matchedCount === 0) return { ok: false, error: "Guruh topilmadi", status: 404 };
  await closeMemberships(db, pupilId, groupId, uzDateIso());
  return { ok: true, value: { removed: res.modifiedCount > 0 } };
}
