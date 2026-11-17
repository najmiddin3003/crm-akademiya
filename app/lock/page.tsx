import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import LockScreen from "@/components/auth/LockScreen";
import LockScreenV2 from "@/components/v2/auth/LockScreenV2";
import { ROLE_LABELS } from "@/constants/employees";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Qulflangan ekran. (app) guruhidan TASHQARIDA — sidebar/navbar chiqmaydi.
// Bu yerga faqat middleware yo'naltiradi (qulf cookie'si bor bo'lsa).
// YANGI VERSIYA (37-qism): soat, avatar, lavozim · filial, «Qulflangan · HH:MM dan beri» (components/v2/auth/LockScreenV2.tsx).
export default async function LockPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/force-logout");
  if ((await currentUiVersion()) !== "v2") return <LockScreen fullName={user.fullName} phone={user.phone} />;
  const db = await ensureIndexes();
  const [u, scope] = await Promise.all([db.collection("users").findOne({ _id: new ObjectId(user.id) }, { projection: { avatar: 1, lockedAt: 1 } }), getBranchScope()]);
  const [emp, branch] = await Promise.all([
    user.hrEmployeeId !== null ? db.collection("hr_employees").findOne({ id: user.hrEmployeeId }, { projection: { _id: 0, turi: 1, photoUrl: 1 } }) : null,
    scope ? db.collection("branches").findOne({ id: scope.branchId }, { projection: { _id: 0, name: 1 } }) : null,
  ]);
  const role = user.role === "admin" ? "Administrator" : String((ROLE_LABELS as Record<string, string>)[String(emp?.turi ?? "")] ?? "Xodim");
  return (
    <LockScreenV2
      info={{
        fullName: user.fullName,
        role,
        branch: String(branch?.name ?? ""),
        avatar: String(u?.avatar ?? emp?.photoUrl ?? ""),
        lockedAt: u?.lockedAt instanceof Date ? u.lockedAt.toISOString() : null,
      }}
    />
  );
}
