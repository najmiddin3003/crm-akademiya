import type { ProfileEntry, ProfileGroup, ProfileMark, PupilProfilePayload } from "@/lib/pupilProfile";
import { entryGroupId } from "./profileLedger";

// YANGI VERSIYA — O'QUVCHI HARAKATLARI (Umumiy → «So'nggi harakatlar», Tarix tabi).
//
// Eski profildagi «Harakatlar tarixi» manbasi (`pupil_activity`) HECH QACHON
// yozilmaydi (StudentQuickPanel izohi) — shu bois tarix mavjud ma'lumotdan yig'iladi:
// to'lovlar va qaytarimlar (bir kunda, bir oy uchun, bir turda, bir kassaga bir necha
// to'lov — bitta qator «2 ta to'lov · 620 000 so'm», rasmdagidek), davomatdagi
// qoldirilgan / kechikkan / birinchi darslar (har darsdagi «keldi» tarixni bosib
// ketmasin), guruhga qo'shilish va chiqish, holat o'zgarishi, ro'yxatga olingan kun.
// Matnlar — komponentda (tarjima bilan); bu yerda faqat tartiblangan yozuvlar.

export type ActivityKind = "payment" | "refund" | "cancelled" | "absent" | "excused" | "late" | "first" | "joined" | "left" | "status" | "created";
export type ActivityFilter = "all" | "payments" | "attendance" | "groups";

export interface ActivityItem {
  key: string;
  kind: ActivityKind;
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:MM" yoki "" (vaqti noma'lum). */
  time: string;
  /** To'lov(lar) — guruhlangan bo'lsa bir nechta. */
  entries?: ProfileEntry[];
  mark?: ProfileMark;
  group?: ProfileGroup | null;
}

export const ACTIVITY_FILTER: Record<ActivityKind, Exclude<ActivityFilter, "all">> = {
  payment: "payments",
  refund: "payments",
  cancelled: "payments",
  absent: "attendance",
  excused: "attendance",
  late: "attendance",
  first: "attendance",
  joined: "groups",
  left: "groups",
  status: "groups",
  created: "groups",
};

function isoOf(s: string): string {
  const v = (s || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function hmOf(s: string): string {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec((s || "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Bir qatorga qo'shiladigan to'lovlar: bir kun, bir oy uchun, bir tur, bir kassa, bir holat. */
const sameBatch = (a: ProfileEntry, b: ProfileEntry) =>
  a.txType === "payIn" &&
  b.txType === "payIn" &&
  a.status !== "cancelled" &&
  a.status === b.status &&
  a.date === b.date &&
  a.periodMonth === b.periodMonth &&
  a.paymentType === b.paymentType &&
  a.cashboxId === b.cashboxId;

export function buildActivity(data: PupilProfilePayload): ActivityItem[] {
  const items: ActivityItem[] = [];
  const groupById = new Map(data.groups.map((g) => [g.id, g]));

  // To'lovlar (server yangi → eski tartibda beradi).
  const sorted = [...data.entries].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) || b.id - a.id);
  for (let i = 0; i < sorted.length; ) {
    const head = sorted[i];
    const batch = [head];
    let j = i + 1;
    while (j < sorted.length && sameBatch(head, sorted[j])) batch.push(sorted[j++]);
    i = j;
    const gid = entryGroupId(head, data.groups);
    const kind: ActivityKind = head.status === "cancelled" ? "cancelled" : head.txType === "payOut" ? "refund" : "payment";
    items.push({
      key: `e${head.id}`,
      kind,
      date: isoOf(head.date),
      time: hmOf(head.time),
      entries: batch,
      group: batch.every((e) => entryGroupId(e, data.groups) === gid) && gid !== null ? (groupById.get(gid) ?? null) : null,
    });
  }

  // Davomat — faqat e'tiborga loyiq belgilar.
  for (const m of data.marks) {
    const kind: ActivityKind | null =
      m.status === "sababsiz" ? "absent" : m.status === "sababli" ? "excused" : m.status === "kechikdi" ? "late" : m.status === "birinchi" ? "first" : null;
    if (!kind) continue;
    const at = isoOf(m.markedAt);
    items.push({
      key: `m${m.groupId}:${m.date}`,
      kind,
      date: m.date,
      time: at === m.date ? hmOf(m.markedAt) : "",
      mark: m,
      group: groupById.get(m.groupId) ?? null,
    });
  }

  // Guruhlar: qo'shilgan va chiqqan kun.
  for (const g of data.groups) {
    if (g.joinedAt) items.push({ key: `j${g.id}`, kind: "joined", date: g.joinedAt, time: "", group: g });
    if (g.leftAt) items.push({ key: `l${g.id}`, kind: "left", date: g.leftAt, time: "", group: g });
  }

  // Holat o'zgarishi.
  const statusIso = isoOf(data.pupil.statusChangedAt);
  if (statusIso) items.push({ key: "status", kind: "status", date: statusIso, time: hmOf(data.pupil.statusChangedAt) });

  // Ro'yxatga olingan kun.
  const createdIso = isoOf(data.pupil.createdAt);
  if (createdIso) items.push({ key: "created", kind: "created", date: createdIso, time: hmOf(data.pupil.createdAt) });

  // Yangisi tepada. Vaqti noma'lum yozuv kun oxirida turadi (shu kuni boshqa ish bo'lsa ham
  // guruhga qo'shilish/holat — odatda kun davomida, aniq vaqt yo'q).
  const sortKey = (x: ActivityItem) => `${x.date} ${x.time || "23:59"}`;
  return items.filter((x) => x.date).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}
