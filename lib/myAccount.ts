import { ObjectId, type Db } from "mongodb";
import { ROLE_LABELS } from "@/constants/employees";
import type { BranchScope } from "@/lib/branchScope";
import type { CurrentUser } from "@/lib/auth";
import { STAFF_BOT_USERS } from "@/lib/staffBot/session";
import { describeUserAgent, type UserSession } from "@/lib/userSessions";
import { AUTO_LOCK_OPTIONS, DEFAULT_PREFS, type AccountPrefs, type MyAccount } from "@/lib/myAccountTypes";

// MENING HISOBIM (37-qism). `users` hujjatiga: firstName, lastName, middleName, birthday («MM-DD»), email, avatar,
// prefs (kirgandan keyingi filial, jadval filtrlari, avtomatik qulf), profileUpdatedAt. `fullName` — «Ism Familiya»
// (eski maydon: xodimlar ro'yxati, chek, amallar jurnali shuni o'qiydi). Telegram — xodim boti
// (`staff_bot_users.userId`). Kirishlar — amallar jurnali (`action_log`: login / login_failed shu raqam bilan).

const clean = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** «16.11.2026 | 10:49» → «2026-11-16 10:49» (tartiblash uchun). */
const stampKey = (s: string) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) \| (\d{2}:\d{2})/.exec(s || "");
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}` : "";
};

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function prefsOf(p: unknown): AccountPrefs {
  const x = (p ?? {}) as Partial<AccountPrefs>;
  return {
    startBranch: typeof x.startBranch === "string" && x.startBranch ? x.startBranch : DEFAULT_PREFS.startBranch,
    filterMode: x.filterMode === "inline" || x.filterMode === "separate" ? x.filterMode : "button",
    filtersOpen: !!x.filtersOpen,
    autoLockMin: AUTO_LOCK_OPTIONS.includes(Number(x.autoLockMin)) ? Number(x.autoLockMin) : 0,
  };
}

export async function myAccount(db: Db, me: CurrentUser, scope: BranchScope | null): Promise<MyAccount | null> {
  const u = await db.collection("users").findOne({ _id: new ObjectId(me.id) }, { projection: { passwordHash: 0, passwordEnc: 0 } });
  if (!u) return null;
  const [emp, branches, sessions, bot, logs] = await Promise.all([
    me.hrEmployeeId !== null ? db.collection("hr_employees").findOne({ id: me.hrEmployeeId }, { projection: { _id: 0, turi: 1, photoUrl: 1, email: 1 } }) : null,
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    db.collection<UserSession>("user_sessions").find({ userId: me.id }).toArray(),
    db.collection(STAFF_BOT_USERS).findOne({ userId: me.id, stage: "in" }, { projection: { _id: 0, loggedInAt: 1, tgName: 1, tgUsername: 1 } }),
    db
      .collection("action_log")
      .find({ section: "auth", action: { $in: ["login", "login_failed"] }, $or: [{ "actor.userId": me.id }, { "actor.phone": me.phone }] }, { projection: { _id: 0, at: 1, action: 1, ua: 1, ip: 1, details: 1 } })
      .sort({ at: -1 })
      .limit(6)
      .toArray(),
  ]);
  const name = splitName(String(u.fullName ?? ""));
  const allowed = scope ? branches.filter((b) => scope.allowed.includes(Number(b.id))) : [];
  const role = u.role === "admin" ? "Administrator" : String((ROLE_LABELS as Record<string, string>)[String(emp?.turi ?? "")] ?? emp?.turi ?? "Xodim");
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
  return {
    ok: true,
    id: me.id,
    phone: me.phone,
    firstName: String(u.firstName ?? name.first),
    lastName: String(u.lastName ?? name.last),
    middleName: String(u.middleName ?? ""),
    birthday: String(u.birthday ?? ""),
    email: String(u.email ?? emp?.email ?? ""),
    avatar: String(u.avatar ?? emp?.photoUrl ?? ""),
    roleLabel: role,
    branchesLabel: scope?.isAdmin || allowed.length === branches.length ? `barcha ${branches.length} filial` : allowed.map((b) => b.name).join(", "),
    branchCount: allowed.length,
    branches: allowed.map((b) => ({ id: Number(b.id), name: String(b.name) })),
    telegram: { linked: !!bot, since: String(bot?.loggedInAt ?? ""), name: String(bot?.tgUsername ? `@${bot.tgUsername}` : (bot?.tgName ?? "")) },
    prefs: prefsOf(u.prefs),
    createdAt: iso(u.createdAt),
    updatedAt: iso(u.profileUpdatedAt),
    passwordUpdatedAt: iso(u.passwordUpdatedAt),
    sessions: sessions
      .map((s) => ({ sid: s.sid, label: s.label, ip: s.ip, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: s.sid === me.sid }))
      .sort((a, b) => Number(b.current) - Number(a.current) || stampKey(b.lastSeenAt).localeCompare(stampKey(a.lastSeenAt))),
    logins: logs.map((l) => ({ at: iso(l.at) ?? "", ok: l.action === "login", device: describeUserAgent(String(l.ua ?? "")), ip: String(l.ip ?? ""), reason: String((l.details as { reason?: string } | undefined)?.reason ?? "") })),
  };
}

export async function saveProfile(db: Db, me: CurrentUser, b: Record<string, unknown>) {
  const firstName = clean(b.firstName, 40);
  const lastName = clean(b.lastName, 60);
  if (firstName.length < 2) return { ok: false as const, error: "Ismni yozing" };
  const birthday = /^\d{2}-\d{2}$/.test(String(b.birthday ?? "")) ? String(b.birthday) : "";
  const email = clean(b.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Elektron pochta noto'g'ri" };
  const avatar = /^https:\/\//.test(String(b.avatar ?? "")) ? String(b.avatar) : "";
  await db.collection("users").updateOne(
    { _id: new ObjectId(me.id) },
    { $set: { firstName, lastName, middleName: clean(b.middleName, 60), birthday, email, avatar, fullName: [firstName, lastName].filter(Boolean).join(" "), profileUpdatedAt: new Date() } },
  );
  return { ok: true as const };
}

export async function myPrefs(db: Db, me: CurrentUser): Promise<AccountPrefs> {
  const u = await db.collection("users").findOne({ _id: new ObjectId(me.id) }, { projection: { prefs: 1 } });
  return prefsOf(u?.prefs);
}

export async function savePrefs(db: Db, me: CurrentUser, p: Partial<AccountPrefs>) {
  const cur = await db.collection("users").findOne({ _id: new ObjectId(me.id) }, { projection: { prefs: 1 } });
  const next = prefsOf({ ...prefsOf(cur?.prefs), ...p });
  await db.collection("users").updateOne({ _id: new ObjectId(me.id) }, { $set: { prefs: next } });
  return { ok: true as const, prefs: next };
}

/** Xodim botidan chiqarish (Telegram «Uzish»). */
export async function unlinkTelegram(db: Db, me: CurrentUser) {
  await db.collection(STAFF_BOT_USERS).updateMany(
    { userId: me.id },
    { $set: { stage: "phone" }, $unset: { userId: "", employeeId: "", name: "", isAdmin: "", phone: "", loggedInAt: "", cashboxId: "" } },
  );
  return { ok: true as const };
}
