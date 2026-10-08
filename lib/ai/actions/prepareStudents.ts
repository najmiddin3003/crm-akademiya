import { SOURCE_FROM_ORDER } from "@/constants";
import { ABSENCE_REASONS, ATTENDANCE_OPTIONS, type AttendanceStatus } from "@/lib/attendance";
import { withBranch, withPupilBranch } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import { lessonExpectedOn } from "@/lib/groupRules";
import { groupLabel } from "@/lib/groups";
import type { HrEmployee } from "@/lib/hrEmployees";
import { canTransition, holatMeta, holatOf, HOLATLAR, isHolat, type LeadHolat } from "@/lib/leadHolat";
import { withLeadScope } from "@/lib/leadScope";
import { loadLeadSettings } from "@/lib/leadSettings";
import type { Order } from "@/lib/ordersData";
import { phoneSearchPattern } from "@/lib/phoneSearch";
import { isPupilStatus, pupilFullName, pupilStatusOf, type PupilStatus } from "@/lib/pupilsData";
import { formatPhone, phoneKey } from "@/lib/studentBot/phone";
import { listSourceOptions } from "@/lib/studentSources";
import { isActiveTeacher } from "@/lib/teachersData";
import { authorNameOf, type AiContext } from "../context";
import { maskPhone } from "../mask";
import type { AiActionField } from "../protocol";
import { optDate, optInt, optString, ToolInputError, type ToolArgs } from "../tools/types";
import { ask, CANDIDATES, norm, ok, pickByName, resolvePupil, type PrepareResult, type Step } from "./prepare";

// 5-BOSQICH QORALAMALARI (08.10.2026) — yangi o'quvchi, guruhga qo'shish /
// chiqarish, davomat, o'quvchi holati, lid bosqichi. lib/ai/actions/prepare.ts
// bilan bir xil qoida: hech narsa YOZMAYDI, model aytgan har qiymat
// ro'yxatdan qidiriladi, topilmasa yoki bir nechtasi mos kelsa — qoralama
// tuzilmaydi, modelga nomzodlar qaytadi. Taxmin yo'q.
//
// Yozuv tasdiqdan keyin web bilan UMUMIY yadrolar orqali bo'ladi
// (lib/pupilWrite.ts, lib/groupStudents.ts, lib/attendanceWrite.ts,
// lib/leadHolatServer.ts) — ular qiymatlarni YANA tekshiradi.

const DAY_NAMES = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

/** "2026-10-08" → "08.10.2026". */
export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// ── Guruh ───────────────────────────────────────────────────────────

export interface GroupDoc {
  id: number;
  name?: string;
  course?: string;
  level?: string;
  teacher?: string;
  day?: string;
  time?: string;
  status?: string;
  studentIds?: number[];
  startDate?: string;
  endDate?: string;
  period?: string;
  branchId?: number;
}

const GROUP_FIELDS = {
  _id: 0,
  id: 1,
  name: 1,
  course: 1,
  level: 1,
  teacher: 1,
  day: 1,
  time: 1,
  status: 1,
  studentIds: 1,
  startDate: 1,
  endDate: 1,
  period: 1,
  branchId: 1,
};

/** Kartadagi ko'rinish: "Ingliz tili (5-guruh) · Dilnoza · Toq kunlar 14:00 - 16:00". */
export function describeGroup(g: GroupDoc): string {
  const when = [g.day, g.time].filter(Boolean).join(" ");
  return [groupLabel({ id: g.id, name: g.name ?? "", course: g.course ?? "" }), g.teacher, when].filter(Boolean).join(" · ");
}

/** So'rovdagi "guruh", "ustoz" kabi so'zlar moslikka xalaqit bermasin. */
const GROUP_STOP = /^(guruh\w*|gurux\w*|group|ustoz\w*|domla\w*|o'qituvchi\w*|teacher|kurs\w*|dars\w*|#)$/;

/**
 * Guruhlar ichidan so'rovga mos keladiganlari. Raqam ("5", "5-guruh",
 * "#5") — guruh nomi (odatda raqami), bo'lmasa id. Aks holda har bir so'z
 * kurs / nom / daraja / ustoz / kun / vaqt ichida bo'lishi shart.
 */
export function matchGroups(groups: readonly GroupDoc[], query: string): GroupDoc[] {
  const q = norm(query);
  const num = /^#?(\d+)(?:\s*-?\s*(?:guruh\w*|gurux\w*))?$/.exec(q) ?? /(?:^|\s)(\d+)\s*-?\s*guruh/.exec(q);
  if (num) {
    const byName = groups.filter((g) => norm(String(g.name ?? "")) === num[1]);
    if (byName.length) return byName;
    const byId = groups.filter((g) => String(g.id) === num[1]);
    if (byId.length) return byId;
  }
  const tokens = q.split(" ").filter((t) => t.length >= 2 && !GROUP_STOP.test(t));
  if (tokens.length === 0) return [];
  return groups.filter((g) => {
    const text = norm([g.name, g.course, g.level, g.teacher, g.day, g.time].filter(Boolean).join(" "));
    return tokens.every((t) => text.includes(t));
  });
}

/**
 * Guruh — `groupId` (avvalgi nomzodlardan yoki list_groups dan) yoki nom /
 * kurs / ustoz bo'yicha. Qamrov — joriy filial (route'lar bilan bir xil).
 */
export async function resolveGroup(ctx: AiContext, args: ToolArgs): Promise<Step<GroupDoc>> {
  const id = optInt(args, "groupId", 1, 1_000_000_000);
  if (id !== null) {
    const g = await ctx.db.collection("groups").findOne(withBranch({ id }, ctx.scope), { projection: GROUP_FIELDS });
    if (!g) return ask({ problem: "No group with this groupId in the current branch. Search by name, or call list_groups." });
    return ok(g as unknown as GroupDoc);
  }
  const query = optString(args, "group", 100);
  if (!query) return ask({ problem: "Which group? Ask the user (group number, course or teacher), or call list_groups and pass groupId." });
  const all = (await ctx.db
    .collection("groups")
    .find(withBranch({}, ctx.scope), { projection: GROUP_FIELDS })
    .toArray()) as unknown as GroupDoc[];
  const hits = matchGroups(all, query);
  if (hits.length === 0) {
    return ask({ problem: `No group in the current branch matches "${query}". Call list_groups to see the groups, or ask the user.` });
  }
  if (hits.length > 1) {
    return ask({
      problem: "Several groups match. Ask the user which one, then call again with groupId.",
      candidates: hits.slice(0, CANDIDATES * 2).map((g) => ({ groupId: g.id, group: describeGroup(g), status: g.status || undefined })),
      more: hits.length > CANDIDATES * 2 || undefined,
    });
  }
  return ok(hits[0]);
}

// ── Kichik yordamchilar ─────────────────────────────────────────────

/** Ixtiyoriy sana; berilmasa `fallback`. */
function dateOr(args: ToolArgs, key: string, fallback: string): string {
  return optDate(args, key) || fallback;
}

/** O'quvchilar hovuzidagi ism-telefonlar (guruh a'zolari va h.k.). */
async function pupilNames(ctx: AiContext, ids: readonly number[]): Promise<Map<number, { name: string; phone: string; status: PupilStatus }>> {
  if (ids.length === 0) return new Map();
  const rows = await ctx.db
    .collection("pupils")
    .find(withPupilBranch({ id: { $in: [...ids] } }, ctx.scope), { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1 } })
    .toArray();
  return new Map(
    rows.map((r) => [
      Number(r.id),
      {
        name: pupilFullName({ firstName: String(r.firstName ?? ""), lastName: String(r.lastName ?? "") }),
        phone: String(r.phone ?? ""),
        status: pupilStatusOf({ status: r.status as PupilStatus | undefined }),
      },
    ]),
  );
}

// ── Yangi o'quvchi ──────────────────────────────────────────────────

/**
 * YANGI O'QUVCHI — «O'quvchi qo'shish» oynasi bilan bir xil maydonlar
 * (yadro: lib/pupilWrite.ts → createPupil): ism va manba MAJBURIY,
 * telefon "94 155 88 55" ko'rinishida. Ixtiyoriy ravishda darhol guruhga.
 *
 * TAKROR: shu telefonli o'quvchi filial hovuzida bo'lsa qoralama
 * tuzilmaydi — model xodimdan "o'sha odammi?" deb so'raydi (aka-uka bitta
 * telefonni ishlatishi mumkin — shunda `allowDuplicatePhone: true`).
 */
export async function preparePupilCreate(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const firstName = optString(args, "firstName", 60);
  const lastName = optString(args, "lastName", 60);
  if (!firstName) return ask({ problem: "What is the new student's first and last name? Ask the user." });

  const phoneIn = optString(args, "phone", 30);
  const phone = phoneIn ? phoneKey(phoneIn) : null;
  if (phoneIn && !phone) return ask({ problem: `"${phoneIn}" is not a full Uzbek phone number (9 digits). Ask the user to check it.` });
  const extraIn = optString(args, "extraPhone", 30);
  const extra = extraIn ? phoneKey(extraIn) : null;
  if (extraIn && !extra) return ask({ problem: `"${extraIn}" is not a full Uzbek phone number (9 digits). Ask the user to check it.` });

  const birthDate = optDate(args, "birthDate");
  if (birthDate && birthDate >= ctx.today) return ask({ problem: "The birth date must be in the past. Ask the user to check it." });

  const categories = (await ctx.db.collection("edu_categories").find({}, { projection: { _id: 0, name: 1 } }).toArray())
    .map((c) => String(c.name ?? "").trim())
    .filter(Boolean);
  const categoryIn = optString(args, "category", 60);
  let category = "";
  if (categoryIn) {
    const c = pickByName(categories, (x) => x, categoryIn);
    if (!c) return ask({ problem: `Unknown category "${categoryIn}". Use one of the listed names, or leave it empty.`, categories });
    category = c;
  }

  const sources = (await listSourceOptions(ctx.db)).map((s) => s.name);
  const sourceIn = optString(args, "source", 80);
  if (!sourceIn) {
    return ask({
      problem: "Where did the student hear about the center (source)? It is required — ask the user. If none of the listed fits, the user may name their own and you pass it with customSource: true.",
      sources,
    });
  }
  const source = args.customSource === true ? sourceIn : pickByName(sources, (s) => s, sourceIn);
  if (!source) return ask({ problem: `Unknown source "${sourceIn}". Use one of the listed names (or customSource: true if the user insists).`, sources });

  const projection = { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1 };
  if (phone && args.allowDuplicatePhone !== true) {
    const pattern = phoneSearchPattern(phone);
    const same = pattern
      ? await ctx.db.collection("pupils").find(withPupilBranch({ phone: { $regex: pattern } }, ctx.scope), { projection }).limit(CANDIDATES).toArray()
      : [];
    if (same.length) {
      return ask({
        problem:
          "A student with this phone number already exists in this branch. Ask the user whether it is the same person. To put an existing " +
          "student into a group use propose_group_membership; if it really is a different person (for example a sibling with the same " +
          "phone), call again with allowDuplicatePhone: true.",
        existing: same.map((r) => ({
          pupilId: r.id,
          name: pupilFullName({ firstName: String(r.firstName ?? ""), lastName: String(r.lastName ?? "") }),
          phone: maskPhone(String(r.phone ?? "")),
          status: r.status || "Aktiv",
        })),
      });
    }
  }
  // Ismdoshlar — to'xtatmaydi (bazada yuzlab takroriy ism bor), faqat modelga eslatma.
  const fullName = pupilFullName({ firstName, lastName });
  const sameName = await ctx.db
    .collection("pupils")
    .countDocuments(withPupilBranch({ firstName: { $regex: `^${escapeRx(firstName)}$`, $options: "i" }, lastName: { $regex: `^${escapeRx(lastName)}$`, $options: "i" } }, ctx.scope));

  let group: GroupDoc | null = null;
  let joinedAt = "";
  if (optString(args, "group", 100) || args.groupId !== undefined) {
    const g = await resolveGroup(ctx, args);
    if (!g.ok) return g;
    if (g.value.status === "finished") return ask({ problem: "That group is finished; a student cannot be added to it. Ask the user for another group." });
    group = g.value;
    joinedAt = dateOr(args, "joinedAt", ctx.today);
  }

  const fields: AiActionField[] = [
    { key: "pupil", value: fullName },
    { key: "phone", value: [phone ? formatPhone(phone) : "—", extra ? formatPhone(extra) : ""].filter(Boolean).join(", ") },
    ...(birthDate ? [{ key: "birth_date" as const, value: dmy(birthDate) }] : []),
    ...(category ? [{ key: "category" as const, value: category }] : []),
    { key: "source", value: source },
    { key: "branch", value: ctx.branchName },
    ...(group ? [{ key: "group" as const, value: describeGroup(group) }, { key: "joined_at" as const, value: dmy(joinedAt) }] : []),
  ];
  return {
    ok: true,
    draft: {
      kind: "pupil",
      payload: {
        values: {
          firstName,
          lastName,
          phone: phone ? formatPhone(phone) : "",
          extraPhone: extra ? formatPhone(extra) : "",
          category,
          birthDate,
          source,
        },
        branchId: ctx.scope.branchId,
        groupId: group?.id ?? null,
        joinedAt: group ? joinedAt : null,
      },
      fields,
      forModel: {
        action: "new student",
        name: fullName,
        phone: phone ? maskPhone(formatPhone(phone)) : undefined,
        source,
        branch: ctx.branchName,
        group: group ? describeGroup(group) : undefined,
        lessonsCountFrom: group ? joinedAt : undefined,
        sameNameStudents: sameName || undefined,
        sameNameNote: sameName ? "Students with the same name already exist — mention it so the user can check this is not a duplicate." : undefined,
      },
    },
  };
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Guruhga qo'shish / chiqarish ────────────────────────────────────

/**
 * GURUH A'ZOLIGI — guruh sahifasidagi «O'quvchi qo'shish» va «Guruhdan
 * chiqarish» bilan bir xil (yadro: lib/groupStudents.ts). Qo'shishda
 * darslar `joinedAt` kunidan sanaladi (sukut — bugun); chiqarishda a'zolik
 * bugun yopiladi, o'tgan darslari qarz bo'lib qoladi.
 */
export async function prepareMembership(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const op = optString(args, "op", 10);
  if (op !== "add" && op !== "remove") throw new ToolInputError('"op" must be "add" or "remove"');
  const pupil = await resolvePupil(ctx, args);
  if (!pupil.ok) return pupil;
  const p = pupil.value;
  const group = await resolveGroup(ctx, args);
  if (!group.ok) return group;
  const g = group.value;
  const inGroup = (g.studentIds ?? []).includes(p.id);
  const status = (await pupilNames(ctx, [p.id])).get(p.id)?.status ?? "Aktiv";

  if (op === "add") {
    if (g.status === "finished") return ask({ problem: "That group is finished; a student cannot be added to it. Ask the user for another group." });
    if (inGroup) return ask({ problem: `${p.name} is already in this group. Nothing to do — tell the user.` });
    const joinedAt = dateOr(args, "joinedAt", ctx.today);
    return {
      ok: true,
      draft: {
        kind: "membership",
        payload: { op, pupilId: p.id, groupId: g.id, joinedAt },
        fields: [
          { key: "op", value: "Guruhga qo'shish" },
          { key: "pupil", value: p.phone ? `${p.name} · ${formatPhone(p.phone)}` : p.name },
          { key: "group", value: describeGroup(g) },
          { key: "joined_at", value: dmy(joinedAt) },
          ...(status !== "Aktiv" ? [{ key: "effect" as const, value: `Diqqat: o'quvchi holati — ${status}` }] : []),
        ],
        forModel: {
          action: "add student to group",
          student: p.name,
          group: describeGroup(g),
          lessonsCountFrom: joinedAt,
          studentStatus: status !== "Aktiv" ? status : undefined,
        },
      },
    };
  }

  if (!inGroup) {
    const mine = await ctx.db
      .collection("groups")
      .find(withBranch({ studentIds: p.id }, ctx.scope), { projection: GROUP_FIELDS })
      .toArray();
    return ask({
      problem: `${p.name} is not in that group.`,
      studentGroups: (mine as unknown as GroupDoc[]).map((x) => ({ groupId: x.id, group: describeGroup(x) })),
    });
  }
  return {
    ok: true,
    draft: {
      kind: "membership",
      payload: { op, pupilId: p.id, groupId: g.id, joinedAt: null },
      fields: [
        { key: "op", value: "Guruhdan chiqarish" },
        { key: "pupil", value: p.phone ? `${p.name} · ${formatPhone(p.phone)}` : p.name },
        { key: "group", value: describeGroup(g) },
        { key: "date", value: dmy(ctx.today) },
        { key: "effect", value: "O'tgan darslari qarzdorlik hisobida qoladi" },
      ],
      forModel: {
        action: "remove student from group",
        student: p.name,
        group: describeGroup(g),
        note: "Membership ends today; lessons before today stay in the debt calculation.",
      },
    },
  };
}

// ── Davomat ─────────────────────────────────────────────────────────

const STATUS_KEYS = ATTENDANCE_OPTIONS.map((o) => o.key);
const STATUS_LABEL = new Map(ATTENDANCE_OPTIONS.map((o) => [o.key, o.label]));
/** Model ba'zan yorliq yoki sinonim yozadi — kalitga keltiriladi. */
const STATUS_WORDS: Record<string, AttendanceStatus> = {
  keldi: "keldi",
  kelgan: "keldi",
  bor: "keldi",
  present: "keldi",
  kechikdi: "kechikdi",
  kechikkan: "kechikdi",
  late: "kechikdi",
  birinchi: "birinchi",
  "birinchi dars": "birinchi",
  first: "birinchi",
  sababli: "sababli",
  excused: "sababli",
  sababsiz: "sababsiz",
  kelmadi: "sababsiz",
  absent: "sababsiz",
};

export function attendanceStatusOf(raw: unknown): AttendanceStatus | null {
  if (typeof raw !== "string") return null;
  const k = norm(raw);
  if ((STATUS_KEYS as string[]).includes(k)) return k as AttendanceStatus;
  return STATUS_WORDS[k] ?? null;
}

const MAX_MARKS = 60;

interface MarkIn {
  pupilId?: unknown;
  pupil?: unknown;
  status?: unknown;
  reason?: unknown;
  note?: unknown;
}

/**
 * DAVOMAT — guruh sahifasidagi davomat jadvali bilan bir xil (yadro:
 * lib/attendanceWrite.ts). Faqat guruh a'zolari, faqat dars kuni (jadvalda
 * boshqa kunga ustun yo'q) va kelajak sanaga emas. `others` — ro'yxatda
 * aytilmagan barcha a'zolarga bitta holat ("hamma keldi, faqat Ali
 * sababsiz"). Holati o'zgarmaydigan belgi yozilmaydi.
 *
 * Gamifikatsiya cheklovi (kim, qaysi kunga) tasdiq paytida yadroda
 * tekshiriladi — rad etilgan belgilar kartada ko'rinadi.
 */
export async function prepareAttendance(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const group = await resolveGroup(ctx, args);
  if (!group.ok) return group;
  const g = group.value;
  const date = dateOr(args, "date", ctx.today);
  if (date > ctx.today) return ask({ problem: "Attendance cannot be marked for a future date. Ask the user for the date." });
  const wd = weekdayOf(date);
  if (!lessonExpectedOn(g, date, wd)) {
    return ask({
      problem:
        g.status !== "active"
          ? `This group is not active (status: ${g.status || "—"}), so it has no lessons to mark.`
          : `${dmy(date)} (${DAY_NAMES[wd]}) is not a lesson day of this group (days: ${g.day || "—"}) or is outside its period. Ask the user to check the date.`,
    });
  }

  const ids = g.studentIds ?? [];
  if (ids.length === 0) return ask({ problem: "This group has no students." });
  const members = await pupilNames(ctx, ids);
  const roster = ids.filter((id) => members.has(id)).map((id) => ({ pupilId: id, name: members.get(id)!.name }));

  const rawMarks = args.marks;
  if (rawMarks !== undefined && rawMarks !== null && !Array.isArray(rawMarks)) throw new ToolInputError('"marks" must be an array');
  const marksIn = ((rawMarks ?? []) as MarkIn[]).slice(0, MAX_MARKS + 1);
  if (marksIn.length > MAX_MARKS) throw new ToolInputError(`at most ${MAX_MARKS} marks at once`);
  const othersRaw = optString(args, "others", 20);
  const others = othersRaw ? attendanceStatusOf(othersRaw) : null;
  if (othersRaw && !others) throw new ToolInputError(`"others" must be one of: ${STATUS_KEYS.join(", ")}`);
  if (marksIn.length === 0 && !others) {
    return ask({ problem: "Who came and who did not? Ask the user. Statuses: keldi, kechikdi, birinchi (first lesson), sababli (excused), sababsiz (absent).", students: roster });
  }

  const chosen = new Map<number, { status: AttendanceStatus; reason: string | null; note: string | null }>();
  for (const m of marksIn) {
    if (!m || typeof m !== "object") throw new ToolInputError('"marks" items must be objects');
    const status = attendanceStatusOf(m.status);
    if (!status) throw new ToolInputError(`mark status must be one of: ${STATUS_KEYS.join(", ")}`);
    let pid: number | null = null;
    if (m.pupilId !== undefined && m.pupilId !== null) {
      const n = Number(m.pupilId);
      if (!Number.isInteger(n) || !members.has(n)) {
        return ask({ problem: `pupilId ${String(m.pupilId)} is not a student of this group.`, students: roster });
      }
      pid = n;
    } else {
      const name = typeof m.pupil === "string" ? m.pupil.trim() : "";
      if (!name) throw new ToolInputError('each mark needs "pupil" (name) or "pupilId"');
      const hit = pickByName(roster, (r) => r.name, name);
      if (!hit) {
        const similar = roster.filter((r) => norm(r.name).includes(norm(name)));
        return ask({
          problem: similar.length
            ? `Several students of this group match "${name}". Ask the user which one, then use pupilId.`
            : `No student of this group matches "${name}". Ask the user to check the name.`,
          students: similar.length ? similar : roster,
        });
      }
      pid = hit.pupilId;
    }
    // Sabab faqat «Sababli» da; ro'yxatda yo'q sabab — «Boshqa» + izoh.
    let reason: string | null = null;
    let note: string | null = typeof m.note === "string" && m.note.trim() ? m.note.trim().slice(0, 500) : null;
    if (status === "sababli" && typeof m.reason === "string" && m.reason.trim()) {
      const r = pickByName(ABSENCE_REASONS, (x) => x, m.reason);
      if (r) reason = r;
      else {
        reason = "Boshqa";
        note = [m.reason.trim(), note].filter(Boolean).join(" — ").slice(0, 500);
      }
    }
    chosen.set(pid, { status, reason, note: status === "sababli" ? note : null });
  }
  if (others) {
    for (const r of roster) if (!chosen.has(r.pupilId)) chosen.set(r.pupilId, { status: others, reason: null, note: null });
  }

  const existing = new Map(
    (await ctx.db
      .collection("attendance")
      .find({ groupId: g.id, date, pupilId: { $in: [...chosen.keys()] } }, { projection: { _id: 0, pupilId: 1, status: 1 } })
      .toArray()).map((x) => [Number(x.pupilId), String(x.status ?? "")]),
  );

  const lines: string[] = [];
  const marks: { pupilId: number; status: AttendanceStatus; reason: string | null; note: string | null }[] = [];
  const counts = new Map<string, number>();
  let unchanged = 0;
  for (const r of roster) {
    const c = chosen.get(r.pupilId);
    if (!c) continue;
    const before = existing.get(r.pupilId);
    if (before === c.status) {
      unchanged++;
      continue;
    }
    marks.push({ pupilId: r.pupilId, ...c });
    const label = STATUS_LABEL.get(c.status) ?? c.status;
    counts.set(label, (counts.get(label) ?? 0) + 1);
    const was = before ? ` (oldin: ${STATUS_LABEL.get(before as AttendanceStatus) ?? before})` : "";
    lines.push(`${r.name} — ${label}${c.reason ? `, ${c.reason}` : ""}${was}`);
  }
  if (marks.length === 0) return ask({ problem: "All these marks are already saved exactly like this. Nothing to change — tell the user." });
  const notMarked = roster.filter((r) => !chosen.has(r.pupilId) && !existing.has(r.pupilId)).map((r) => r.name);

  const summary = [...counts.entries()].map(([k, v]) => `${k}: ${v}`).concat(unchanged ? [`O'zgarishsiz: ${unchanged}`] : []).join(" · ");
  return {
    ok: true,
    draft: {
      kind: "attendance",
      payload: { groupId: g.id, date, marks },
      fields: [
        { key: "group", value: describeGroup(g) },
        { key: "date", value: `${dmy(date)}, ${DAY_NAMES[wd]}` },
        { key: "marks", value: lines.join("\n") },
        { key: "summary", value: summary },
        ...(notMarked.length ? [{ key: "effect" as const, value: `Belgisiz qoladi: ${notMarked.join(", ")}` }] : []),
      ],
      forModel: {
        action: "attendance",
        group: describeGroup(g),
        date,
        marks: marks.length,
        summary,
        studentsLeftWithoutMark: notMarked.length ? notMarked : undefined,
      },
    },
  };
}

// ── O'quvchi holati ─────────────────────────────────────────────────

const STATUS_SYNONYMS: Record<string, PupilStatus> = {
  aktiv: "Aktiv",
  active: "Aktiv",
  faol: "Aktiv",
  faollashtirish: "Aktiv",
  muzlatilgan: "Muzlatilgan",
  muzlatish: "Muzlatilgan",
  frozen: "Muzlatilgan",
  freeze: "Muzlatilgan",
  arxiv: "Arxiv",
  arxivlash: "Arxiv",
  archive: "Arxiv",
  archived: "Arxiv",
};

/**
 * O'QUVCHI HOLATI — profildagi «Holatni o'zgartirish» bilan bir xil (yadro:
 * lib/pupilWrite.ts → setPupilStatus). Aktiv bo'lmagan holatga sabab SHART
 * (xodimning o'z so'zi). Arxivda o'quvchi barcha guruhlardan chiqariladi —
 * kartada qaysilaridan ekani ko'rinadi.
 */
export async function preparePupilStatus(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const pupil = await resolvePupil(ctx, args);
  if (!pupil.ok) return pupil;
  const p = pupil.value;
  const raw = optString(args, "status", 20);
  const to = isPupilStatus(raw) ? raw : (STATUS_SYNONYMS[norm(raw)] ?? null);
  if (!to) return ask({ problem: "Which status? Aktiv (active), Muzlatilgan (frozen) or Arxiv (archived) — ask the user." });
  const reason = optString(args, "reason", 300);
  if (to !== "Aktiv" && !reason) return ask({ problem: "Why? A reason is required for this status — ask the user and use their words." });
  const from = (await pupilNames(ctx, [p.id])).get(p.id)?.status ?? "Aktiv";
  if (from === to) return ask({ problem: `${p.name} is already "${to}". Nothing to change — tell the user.` });

  const groups =
    to === "Arxiv"
      ? ((await ctx.db.collection("groups").find({ studentIds: p.id }, { projection: GROUP_FIELDS }).toArray()) as unknown as GroupDoc[])
      : [];
  return {
    ok: true,
    draft: {
      kind: "status",
      payload: { pupilId: p.id, status: to, reason: to === "Aktiv" ? "" : reason },
      fields: [
        { key: "pupil", value: p.phone ? `${p.name} · ${formatPhone(p.phone)}` : p.name },
        { key: "status", value: `${from} → ${to}` },
        ...(to !== "Aktiv" ? [{ key: "reason" as const, value: reason }] : []),
        ...(groups.length ? [{ key: "effect" as const, value: `Guruhlardan chiqariladi: ${groups.map(describeGroup).join("; ")}` }] : []),
      ],
      forModel: {
        action: "student status change",
        student: p.name,
        from,
        to,
        reason: to !== "Aktiv" ? reason : undefined,
        removedFromGroups: groups.length ? groups.map(describeGroup) : undefined,
      },
    },
  };
}

// ── Lid bosqichi ────────────────────────────────────────────────────

const LEAD_FIELDS = {
  _id: 0,
  id: 1,
  branchNo: 1,
  name: 1,
  phone: 1,
  course: 1,
  category: 1,
  holat: 1,
  status: 1,
  leadStatus: 1,
  stage: 1,
  firstLesson: 1,
  firstLessonStatus: 1,
  groupId: 1,
  teacher: 1,
  branchId: 1,
  moderator: 1,
};

type LeadDoc = Order & { branchId?: number };

function leadLabel(o: LeadDoc): string {
  return [o.branchNo ? `#${o.branchNo}` : `#${o.id}`, o.name, o.course].filter(Boolean).join(" · ");
}

/** Lid — `leadId` yoki ism / telefon / "#raqam". Qamrov — Lidlar sahifasi bilan bir xil (`withLeadScope`). */
async function resolveLead(ctx: AiContext, args: ToolArgs): Promise<Step<LeadDoc>> {
  const author = authorNameOf(ctx);
  const scoped = (f: Record<string, unknown>) => withLeadScope(f, ctx.scope, author);
  const id = optInt(args, "leadId", 1, 1_000_000_000);
  if (id !== null) {
    const o = await ctx.db.collection("orders").findOne(scoped({ id }), { projection: LEAD_FIELDS });
    if (!o) return ask({ problem: "No lead with this leadId is visible to the user. Search by name instead." });
    return ok(o as unknown as LeadDoc);
  }
  const query = optString(args, "lead", 100);
  if (!query) return ask({ problem: "Which lead? Ask the user for the name or phone." });
  const num = /^#\s*(\d+)$/.exec(query);
  let filter: Record<string, unknown>;
  if (num) filter = { branchNo: Number(num[1]) };
  else {
    const pattern = phoneSearchPattern(query);
    filter = /^[\d\s()+-]+$/.test(query) && pattern
      ? { phone: { $regex: pattern } }
      : { $and: norm(query).split(" ").filter((t) => t.length >= 2).slice(0, 4).map((t) => ({ name: { $regex: escapeRx(t), $options: "i" } })) };
    if (Array.isArray(filter.$and) && filter.$and.length === 0) return ask({ problem: "The lead search text is too short." });
  }
  const rows = (await ctx.db
    .collection("orders")
    .find(scoped(filter), { projection: LEAD_FIELDS })
    .sort({ id: -1 })
    .limit(CANDIDATES + 1)
    .toArray()) as unknown as LeadDoc[];
  if (rows.length === 0) return ask({ problem: `No lead matches "${query}". Ask the user to check.` });
  if (rows.length > 1) {
    return ask({
      problem: "Several leads match. Ask the user which one (newest first), then call again with leadId.",
      candidates: rows.slice(0, CANDIDATES).map((o) => ({
        leadId: o.id,
        lead: leadLabel(o),
        phone: maskPhone(o.phone ?? ""),
        stage: holatMeta(holatOf(o)).nom,
      })),
      more: rows.length > CANDIDATES || undefined,
    });
  }
  return ok(rows[0]);
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * LID BOSQICHI — Lidlar sahifasidagi holat tugmalari bilan bir xil (yadro:
 * lib/leadHolatServer.ts → applyHolatChange; o'tish qoidasi — canTransition):
 *   bog   — bog'lanildi;
 *   sinov — sinov darsi: sana (bugundan oldin emas), vaqt, ixtiyoriy ustoz;
 *   guruh — o'quvchi (telefon/ism bo'yicha topiladi, bo'lmasa lid
 *           ma'lumotidan yaratiladi) guruhga qo'shiladi, keyin holat;
 *   rad   — rad etdi: sabab Sozlamalardagi ro'yxatdan.
 */
export async function prepareLeadStage(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const lead = await resolveLead(ctx, args);
  if (!lead.ok) return lead;
  const o = lead.value;
  const toRaw = optString(args, "to", 10);
  if (!isHolat(toRaw) || toRaw === "yangi") {
    throw new ToolInputError('"to" must be one of: bog (contacted), sinov (trial lesson), guruh (joined a group), rad (rejected)');
  }
  const to: LeadHolat = toRaw;
  const from = holatOf(o);
  if (!canTransition(from, to)) {
    return ask({
      problem: `The lead is at "${holatMeta(from).nom}"; it cannot move to "${holatMeta(to).nom}" (the funnel only goes forward; a joined lead is final).`,
      allowedNext: HOLATLAR.filter((h) => canTransition(from, h.id)).map((h) => ({ to: h.id, stage: h.nom })),
    });
  }

  const fields: AiActionField[] = [
    { key: "lead", value: leadLabel(o) },
    { key: "stage", value: `${holatMeta(from).nom} → ${holatMeta(to).nom}` },
  ];
  const payload: Record<string, unknown> = { orderId: o.id, to };
  const forModel: Record<string, unknown> = { action: "lead stage change", lead: leadLabel(o), from: holatMeta(from).nom, to: holatMeta(to).nom };

  if (to === "sinov") {
    const date = optDate(args, "date");
    if (!date) return ask({ problem: "On which date is the trial lesson? Ask the user." });
    if (date < ctx.today) return ask({ problem: "The trial lesson date must not be in the past. Ask the user." });
    const time = optString(args, "time", 5);
    const tm = TIME_RE.exec(time);
    if (!tm) return ask({ problem: "At what time (HH:MM)? Ask the user." });
    const vaqt = `${tm[1].padStart(2, "0")}:${tm[2]}`;
    let teacher = "";
    const teacherIn = optString(args, "teacher", 100);
    if (teacherIn) {
      const rows = await ctx.db
        .collection("hr_employees")
        .find(scopedEmployeeFilter({ turi: "teacher" }, ctx.scope), { projection: { _id: 0, name: 1, turi: 1, archReason: 1 } })
        .toArray();
      const teachers = rows
        .filter((r) => isActiveTeacher(r as unknown as Pick<HrEmployee, "turi" | "archReason">))
        .map((r) => String(r.name ?? "").trim())
        .filter(Boolean);
      const hit = pickByName(teachers, (x) => x, teacherIn);
      if (!hit) return ask({ problem: `No active teacher matches "${teacherIn}". Use one of the listed names or leave it empty.`, teachers });
      teacher = hit;
    }
    payload.sinov = { sana: date, vaqt, oqituvchi: teacher };
    fields.push({ key: "trial", value: [`${dmy(date)} ${vaqt}`, teacher].filter(Boolean).join(" · ") });
    forModel.trialLesson = { date, time: vaqt, teacher: teacher || undefined };
  }

  if (to === "rad") {
    const reasons = (await loadLeadSettings(ctx.db)).radSabablar;
    const reasonIn = optString(args, "reason", 200);
    if (!reasonIn) return ask({ problem: "Why did the lead refuse? Ask the user and pick one of the listed reasons.", reasons });
    const reason = pickByName(reasons, (x) => x, reasonIn);
    if (!reason) return ask({ problem: `"${reasonIn}" is not in the rejection reasons list. Use one of the listed reasons.`, reasons });
    payload.radSabab = reason;
    fields.push({ key: "reason", value: reason });
    forModel.reason = reason;
  }

  if (to === "guruh") {
    const group = await resolveGroup(ctx, args);
    if (!group.ok) return group;
    const g = group.value;
    if (g.status === "finished") return ask({ problem: "That group is finished. Ask the user for another group." });
    if (o.branchId !== undefined && g.branchId !== undefined && g.branchId !== o.branchId) {
      return ask({ problem: "That group belongs to another branch than the lead. Ask the user for a group of the lead's branch." });
    }
    const joinedAt = dateOr(args, "joinedAt", ctx.today);
    const existing = await findPupilForLead(ctx, o);
    payload.groupId = g.id;
    payload.joinedAt = joinedAt;
    payload.pupilId = existing?.id ?? null;
    fields.push(
      { key: "group", value: describeGroup(g) },
      { key: "joined_at", value: dmy(joinedAt) },
      { key: "pupil", value: existing ? `${existing.name} (mavjud o'quvchi)` : `${o.name} — yangi o'quvchi yaratiladi` },
    );
    forModel.group = describeGroup(g);
    forModel.lessonsCountFrom = joinedAt;
    forModel.student = existing ? `existing student ${existing.name}` : "a new student will be created from the lead";
  }

  return { ok: true, draft: { kind: "stage", payload, fields, forModel } };
}

/**
 * Lidning o'quvchisi — avval telefon, bo'lmasa to'liq ism bo'yicha
 * (lib/enrollStudent.ts → findPupilForOrder bilan bir xil tartib), filial
 * hovuzida. Topilmasa `null` — tasdiqda lid ma'lumotidan yaratiladi.
 */
export async function findPupilForLead(ctx: AiContext, o: Pick<Order, "name" | "phone">): Promise<{ id: number; name: string } | null> {
  const projection = { _id: 0, id: 1, firstName: 1, lastName: 1 };
  const toPick = (r: Record<string, unknown>) => ({
    id: Number(r.id),
    name: pupilFullName({ firstName: String(r.firstName ?? ""), lastName: String(r.lastName ?? "") }),
  });
  const key = phoneKey(o.phone);
  const pattern = key ? phoneSearchPattern(key) : null;
  if (pattern) {
    const byPhone = await ctx.db.collection("pupils").findOne(withPupilBranch({ phone: { $regex: pattern } }, ctx.scope), { projection });
    if (byPhone) return toPick(byPhone);
  }
  const name = (o.name ?? "").trim();
  if (!name) return null;
  const [first, ...rest] = name.split(/\s+/);
  const byName = await ctx.db.collection("pupils").findOne(
    withPupilBranch(
      {
        firstName: { $regex: `^${escapeRx(first)}$`, $options: "i" },
        lastName: { $regex: `^${escapeRx(rest.join(" "))}$`, $options: "i" },
      },
      ctx.scope,
    ),
    { projection },
  );
  return byName ? toPick(byName) : null;
}

/** Lid ma'lumotidan yangi o'quvchining qiymatlari (lib/enrollStudent.ts bilan bir xil: manba — «Buyurtmadan»). */
export function pupilValuesFromLead(o: Pick<Order, "name" | "phone" | "category">) {
  const [firstName, ...rest] = (o.name ?? "").trim().split(/\s+/);
  const key = phoneKey(o.phone);
  return {
    firstName: firstName || (o.name ?? "").trim(),
    lastName: rest.join(" "),
    phone: key ? formatPhone(key) : (o.phone ?? ""),
    extraPhone: "",
    category: o.category || "",
    birthDate: "",
    source: SOURCE_FROM_ORDER as string,
  };
}
