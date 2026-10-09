import type { Document } from "mongodb";
import { maskPhone } from "../mask";
import { optInt, optString, ToolInputError, type AiTool, type ToolArgs } from "./types";

// ISTALGAN MA'LUMOT — FAQAT ADMIN, FAQAT O'QISH (5-bosqich, 08.10.2026).
//
// Foydalanuvchi talabi: "admin bergan barcha savollarga javob berishi
// kerak". Har savolga alohida vosita yozib bo'lmaydi — bu vosita model
// Mongo so'rovini o'zi tuzadi (find / count / distinct / aggregate) va
// bazaning OQ RO'YXATDAGI kolleksiyalaridan o'qiydi. Avval `describe` bilan
// kolleksiyaning haqiqiy maydonlarini ko'radi.
//
// XAVFSIZLIK (model matni — begona kirish deb qaraladi):
//   • faqat `ctx.isAdmin` (vosita boshqalarga umuman ko'rsatilmaydi);
//   • faqat o'qish: yozadigan bosqichlar ($out, $merge) va JS bajaradigan
//     operatorlar ($where, $function, $accumulator) rad etiladi; $lookup /
//     $unionWith / $graphLookup faqat oq ro'yxatdagi kolleksiyaga;
//   • parol, xesh, token, sessiya kabi maydonlar natijadan O'CHIRILADI,
//     telefonlar yashiriladi (94 *** ** 55) — butun AI bilan bir xil qoida;
//     so'rovning O'ZIDA ham ularga murojaat (taxallus, $$ROOT, filtr) rad
//     etiladi — `assertSafe` (09.10.2026);
//   • har so'rov 8 soniya, natija — ko'pi bilan 100 qator va ~16 ming belgi.
// Kolleksiyalar: foydalanuvchilar, sessiyalar, tasdiq kodlari, sinxron
// navbatlari va Telegram bog'lanishlari ro'yxatda YO'Q.

const MAX_FIND = 100;
const MAX_AGG = 200;
const MAX_CHARS = 16_000;
const MAX_TIME_MS = 8_000;
const SAMPLE = 30;

/** Kolleksiya → modelga qisqa tavsif (asosiy maydonlar va formatlar). */
export const DATA_COLLECTIONS: Record<string, string> = {
  // Maydonlar YOZADIGAN koddagi shakldan (09.10.2026 tekshirildi) — model
  // noto'g'ri maydon bilan filtrlasa "0 ta" deb xato javob berardi.
  pupils:
    "Students. id, firstName, lastName, phone, status (Aktiv | Muzlatilgan | Arxiv; missing = Aktiv), statusReason, statusChangedAt (YYYY-MM-DD), " +
    "createdAt ('DD.MM.YYYY | HH:mm' string), source, category, birthDate (YYYY-MM-DD), coin, moderator, father*/mother* (parents), " +
    "branchId (missing = branch 1). NEVER use the `balance` field: it is stale and never updated — " +
    "debts and paid money come from debtors_report / pupil_details.",
  groups:
    "Groups (current season). id, name (usually a number), course, level, teacher, assistant, day ('Toq kunlar', 'Juft kunlar', 'Du,Ju' …), " +
    "time ('14:00 - 16:00'), room, status (gathering | active | frozen | archive), archivedAt, studentIds [pupils.id], startDate, endDate, branchId (missing = branch 1).",
  group_memberships: "Membership history: groupId, pupilId, joinedAt (YYYY-MM-DD), leftAt (null = still in the group).",
  attendance: "Attendance marks: groupId, pupilId, date (YYYY-MM-DD), status (keldi | kechikdi | birinchi | sababli | sababsiz), grade (1–5), reason, note.",
  transaction_entries:
    "Cash journal (Tranzaksiyalar): id, date (YYYY-MM-DD), time (HH:mm), studentName (student or person), pupilId, amount (+ in, − out), " +
    "txType (payIn | payOut | transfer), txName (category), paymentType (method name), cashboxId, group, teacherName, moderator (who recorded), " +
    "status ('' | waiting | cancelled — exclude cancelled from sums), periodMonth (YYYY-MM), note.",
  transactions: "Finance report rows (Moliya hisobotlari): date (YYYY-MM-DD), amount (+ income / − expense), category, method, cashboxId.",
  cashboxes: "Cashboxes: id, name, balance, methodTotals {methodKey: amount}, moderator (responsible employee), isPrimary, archived.",
  orders:
    "Leads (Lidlar): id, branchNo (number shown as #N; branches 1 and 2 share one count since 2026-10-09, older numbers repeat in both), name, phone, course, level, created ('DD.MM.YYYY | HH:mm'), holat (yangi | bog | sinov | " +
    "guruh | rad; missing on old leads), status, firstLesson ('DD.MM.YYYY | HH:mm'), teacher, group, groupId, moderator, source, radSabab, branchId (missing = branch 1).",
  hr_employees:
    "Employees: id, name, phone, turi (role, e.g. teacher), kurs (subjects), percent (teacher %), branchIds [branches the employee works in], payrollBranchId (the ONE branch whose payroll pays them), archReason (non-empty = archived), " +
    "archDate, created, lastActive.",
  staff_tasks:
    "Staff tasks (Topshiriqlar): id, title, desc, employeeId, employeeName, branchId, deadline (ISO), priority (1–5), status, " +
    "fineAmount (fine if not done), createdAt, doneAt.",
  turnstile_io:
    "Check-ins (turnstile / 'Ishga keldim' QR): date (YYYY-MM-DD), personType (employee | student), personName, enterTime / exitTime " +
    "('HH:mm'; null = did not come / did not leave), status (kelgan | kechikkan | kelmagan); QR records also have source 'qr', employeeId, " +
    "branchId, lateMinutes.",
  branches: "Branches: id, name.",
  rooms: "Rooms: id, name, capacity, branchId.",
  offline_courses: "Offline courses: id, name, price and levels.",
  online_courses: "Online courses.",
  salary_runs: "Payroll runs (Oylik chiqarish): id, month (YYYY-MM), employees and amounts.",
  penalties:
    "Penalties (jarimalar) of employees AND students: id, type (employee | student), recipientName, amount, note (what the penalty is for), " +
    "status ('' | cancelled — always exclude cancelled; `reason` is the cancellation reason), createdAt ('DD.MM.YYYY HH:mm' string), cashboxId. " +
    "Payroll counts only type employee and status not cancelled.",
  bonuses:
    "Bonuses of employees and students: id, type (employee | student), recipientName, givenBy, amount, note, " +
    "createdAt ('DD.MM.YYYY HH:mm' string), cashboxId.",
  pupil_comments: "Comments on students: id, pupilId, text, date (YYYY-MM-DD), time (HH:mm), by (author), createdAt.",
  group_exams: "Group exams and results.",
  monthly_exams: "Monthly exam results.",
  contracts: "Student contracts.",
  planned_expenses: "Planned expenses.",
  sales_plans: "Sales plans.",
  sms_messages: "Sent SMS log: phone, text, status, date.",
  transaction_types: "Kirim / chiqim categories (transaction types).",
  edu_categories: "Education categories of students.",
  student_sources: "Student source options (where they heard about the center).",
  teacher_handovers: "Teacher handovers.",
  work_schedules: "Employee work schedules.",
  seasonal_assessments: "Seasonal assessments of students.",
  surveys: "Surveys.",
};

const ALLOWED = new Set(Object.keys(DATA_COLLECTIONS));

/** Natijadan olib tashlanadigan maydonlar (sir): "studentPasswordHash", "access_token", "tgChatId" … */
const SECRET_WORDS = /(password|passwd|pwd|hash|salt|token|secret|session|cookie|otp|pincode|apikey|accesscode|telegramid|tgid|chatid)/;
export function isSecretKey(k: string): boolean {
  return SECRET_WORDS.test(k.toLowerCase().replace(/[_-]/g, ""));
}
const PHONE_KEY = /phone|telefon|tel$|mobile/i;

/**
 * Rad etiladigan operatorlar: JS bajarish, yozish, server holati — va
 * maydon NOMINI satr bilan oladiganlar ($getField "studentPasswordHash",
 * $objectToArray: hujjatni {k, v} juftlariga aylantirib, sirni yoki
 * telefonni oddiy "v" kaliti ostida chiqarardi).
 */
const BANNED_OPS = new Set([
  "$where",
  "$function",
  "$accumulator",
  "$out",
  "$merge",
  "$currentOp",
  "$listSessions",
  "$listLocalSessions",
  "$planCacheStats",
  "$indexStats",
  "$collStats",
  "$changeStream",
  "$getField",
  "$setField",
  "$unsetField",
  "$objectToArray",
  "$arrayToObject",
]);
const ALLOWED_STAGES = new Set([
  "$match",
  "$project",
  "$addFields",
  "$set",
  "$unset",
  "$group",
  "$sort",
  "$limit",
  "$skip",
  "$count",
  "$unwind",
  "$lookup",
  "$unionWith",
  "$graphLookup",
  "$facet",
  "$bucket",
  "$bucketAuto",
  "$sortByCount",
  "$replaceRoot",
  "$replaceWith",
  "$sample",
]);

/** "$a.b" → ["a", "b"]; "$$this.phone" → ["phone"] (o'zgaruvchi nomi tushiriladi). */
function refSegments(ref: string): string[] {
  const path = ref.startsWith("$$") ? ref.slice(2).split(".").slice(1) : ref.slice(1).split(".");
  return path.filter(Boolean);
}

/** Telefon maydonida ruxsat etilmaydigan filtr operatorlari — qism/oraliq bo'yicha qidiruv raqamni bosqichma-bosqich tiklardi. */
const PHONE_FILTER_OPS = new Set(["$regex", "$options", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$all", "$not", "$elemMatch"]);

/**
 * So'rov ichidagi HAR kalit va $-havolani tekshiradi (09.10.2026). Ilgari
 * faqat natija KALITI nomi bo'yicha tozalanardi — `{$project: {h:
 * "$studentPasswordHash"}}`, `$$ROOT` yoki `{$push: "$phone"}` bilan parol
 * xeshi va to'liq telefon OpenAI'ga ketardi. Endi KIRISHda:
 *   • `$$ROOT` / `$$CURRENT` (butun hujjat) — rad;
 *   • sir maydoniga har qanday murojaat (kalit, `$yo'l`, `$$o'zgaruvchi.yo'l`) — rad
 *     (filtr ham: `{studentPasswordHash: {$regex}}` xeshni harfma-harf tiklardi);
 *   • telefon maydoni ifodada (`$phone`) — rad; nomi bilan chiqarish mumkin
 *     (`{phone: 1}` — natijada yashirilgan bo'ladi), filtrda faqat tenglik/bor-yo'qligi.
 * Boshqa kolleksiyaga murojaat faqat oq ro'yxatga.
 */
export function assertSafe(value: unknown, depth = 0): void {
  if (depth > 30) throw new ToolInputError("query is nested too deeply");
  if (typeof value === "string") {
    if (/^\$\$(ROOT|CURRENT)\b/i.test(value)) {
      throw new ToolInputError("whole-document variables ($$ROOT, $$CURRENT) are not allowed; name the fields you need");
    }
    if (value.length > 1 && value.startsWith("$")) {
      const seg = refSegments(value);
      if (seg.some((s) => isSecretKey(s))) throw new ToolInputError("this field is not available");
      if (seg.some((s) => PHONE_KEY.test(s))) {
        throw new ToolInputError("phone fields cannot be used inside expressions; request them by name (they come back masked)");
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) assertSafe(v, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (BANNED_OPS.has(k)) throw new ToolInputError(`operator ${k} is not allowed (read-only, no JavaScript)`);
    if (!k.startsWith("$")) {
      // Maydon yo'li kalit sifatida (filtr, proyeksiya, saralash, chiqish nomi).
      const seg = k.split(".");
      if (seg.some((s) => isSecretKey(s))) throw new ToolInputError("this field is not available");
      if (
        seg.some((s) => PHONE_KEY.test(s)) &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).some((op) => PHONE_FILTER_OPS.has(op))
      ) {
        throw new ToolInputError("searching inside phone numbers is not allowed here; use search_pupils to find a student by phone");
      }
    }
    if ((k === "$lookup" || k === "$graphLookup" || k === "$unionWith") && v && typeof v === "object") {
      const from = typeof v === "string" ? v : String((v as Record<string, unknown>).from ?? (v as Record<string, unknown>).coll ?? "");
      if (!ALLOWED.has(from)) throw new ToolInputError(`${k} may only use these collections: ${[...ALLOWED].join(", ")}`);
    }
    if (k === "$unionWith" && typeof v === "string" && !ALLOWED.has(v)) {
      throw new ToolInputError(`$unionWith may only use these collections: ${[...ALLOWED].join(", ")}`);
    }
    assertSafe(v, depth + 1);
  }
}

/** Natijani tozalaydi: sirlar o'chadi, telefon yashiriladi, uzun matn va ro'yxat qisqaradi. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 12) return "…";
  if (Array.isArray(value)) {
    const out = value.slice(0, 50).map((v) => redact(v, depth + 1));
    if (value.length > 50) out.push(`… +${value.length - 50} more`);
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    // ObjectId / Decimal128 — matn ko'rinishida.
    if (typeof (o as { toHexString?: unknown }).toHexString === "function") return undefined;
    if ((o as { _bsontype?: unknown })._bsontype === "Decimal128") return Number(String(o));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      // `_id` TASHLANMAYDI: $group / $sortByCount / $bucket natijasida guruh
      // kaliti aynan shu yerda (ustoz nomi, oy …). Hujjatning ObjectId'si
      // yuqoridagi `toHexString` tarmog'ida baribir tushib qoladi.
      if (isSecretKey(k)) continue;
      if (PHONE_KEY.test(k)) {
        if (typeof v === "string" || typeof v === "number") {
          out[k] = maskPhone(String(v));
          continue;
        }
        // Telefonlar ro'yxati (`extraPhones`, `$push` natijasi) — har biri yashiriladi.
        if (Array.isArray(v)) {
          out[k] = v.slice(0, 50).map((x) => (typeof x === "string" || typeof x === "number" ? maskPhone(String(x)) : redact(x, depth + 1)));
          continue;
        }
      }
      const r = redact(v, depth + 1);
      if (r !== undefined) out[k] = r; // ObjectId (hujjatning `_id`) — kalit ham chiqmasin
    }
    return out;
  }
  if (typeof value === "string" && value.length > 300) return `${value.slice(0, 300)}…`;
  return value;
}

/** Qatorlar JSON hajmiga sig'guncha qisqartiriladi. */
function fit(rows: unknown[]): { rows: unknown[]; cut: number } {
  let n = rows.length;
  while (n > 0 && JSON.stringify(rows.slice(0, n)).length > MAX_CHARS) n = Math.floor(n * 0.7);
  return { rows: rows.slice(0, n), cut: rows.length - n };
}

function objArg(args: ToolArgs, key: string): Record<string, unknown> | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new ToolInputError(`"${key}" must be a JSON object`);
  return v as Record<string, unknown>;
}

/** Namunaviy hujjatlardan maydonlar va turlari (birinchi darajali, ichki obyekt — "object"). */
export function fieldSchema(docs: readonly Record<string, unknown>[]): Record<string, { type: string; seenIn: number; example?: unknown }> {
  const out: Record<string, { type: string; seenIn: number; example?: unknown }> = {};
  for (const d of docs) {
    for (const [k, v] of Object.entries(d)) {
      if (k === "_id" || isSecretKey(k)) continue;
      const type = Array.isArray(v) ? "array" : v === null ? "null" : v instanceof Date ? "date" : typeof v;
      const cur = out[k] ?? (out[k] = { type, seenIn: 0 });
      cur.seenIn++;
      if (cur.type !== type && type !== "null") cur.type = cur.type === "null" ? type : `${cur.type}|${type}`;
      if (cur.example === undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
        cur.example = PHONE_KEY.test(k) && (typeof v === "string" || typeof v === "number") ? maskPhone(String(v)) : redact(Array.isArray(v) ? v.slice(0, 3) : v);
      }
    }
  }
  return out;
}

export const queryData: AiTool = {
  name: "query_data",
  description:
    "ADMIN ONLY, READ-ONLY access to the CRM database for any question the other tools do not cover. Steps: (1) op 'describe' on a " +
    "collection to see its real fields and example values; (2) op 'find' / 'count' / 'distinct' / 'aggregate' with a MongoDB filter or " +
    "pipeline. Dates are mostly 'YYYY-MM-DD' strings; some are 'DD.MM.YYYY | HH:mm' strings (use $regex on them). Phones come back masked " +
    "and secret fields are removed; $$ROOT, phone or secret fields inside expressions and searching inside phone numbers are rejected. " +
    "In grouped results ($group, $sortByCount, $bucket) the group key is in _id. " +
    "Prefer the specialised tools when they fit (their numbers match the CRM pages). Say which branch your numbers cover. " +
    "Branches 1 and 2 (Chortoq) are ONE pool: their students, groups, rooms, leads, attendance and employee list are shown together, " +
    "so for a branch 1 or 2 question match branchId $in [1, 2] (a missing branchId means branch 1; employees: branchIds). Only cashboxes " +
    "(cashboxes.branchId, by responsible person), payroll (hr_employees.payrollBranchId) and staff check-ins (turnstile_io.branchId = building) " +
    `stay per branch. Collections: ${Object.entries(DATA_COLLECTIONS)
      .map(([k, v]) => `${k} — ${v}`)
      .join(" | ")}`,
  parameters: {
    type: "object",
    properties: {
      op: { type: "string", enum: ["describe", "find", "count", "distinct", "aggregate"] },
      collection: { type: "string", enum: Object.keys(DATA_COLLECTIONS) },
      filter: { type: "object", description: "MongoDB filter (find, count, distinct)." },
      projection: { type: "object", description: "find: fields to return, e.g. {firstName:1,lastName:1}." },
      sort: { type: "object", description: "find: e.g. {date:-1}." },
      limit: { type: "integer", description: `find: rows (default 30, at most ${MAX_FIND}).` },
      skip: { type: "integer" },
      field: { type: "string", description: "distinct: field name." },
      pipeline: { type: "array", items: { type: "object" }, description: "aggregate: stages ($match, $group, $sort, $project, $lookup, $unwind, $count …)." },
    },
    required: ["op", "collection"],
    additionalProperties: false,
  },
  pages: [],
  visible: (ctx) => ctx.isAdmin === true,
  async run(ctx, args) {
    if (!ctx.isAdmin) return { error: "Only administrators can use this tool." };
    const op = optString(args, "op", 12);
    const name = optString(args, "collection", 40);
    if (!ALLOWED.has(name)) throw new ToolInputError(`unknown collection; use one of: ${[...ALLOWED].join(", ")}`);
    const col = ctx.db.collection(name);
    const filter = objArg(args, "filter") ?? {};
    assertSafe(filter);

    if (op === "describe") {
      const [total, sample] = await Promise.all([
        col.estimatedDocumentCount(),
        col.aggregate<Record<string, unknown>>([{ $sample: { size: SAMPLE } }], { maxTimeMS: MAX_TIME_MS }).toArray(),
      ]);
      return {
        collection: name,
        about: DATA_COLLECTIONS[name],
        documents: total,
        fields: fieldSchema(sample),
        _ui: { note: `${name}: ${total} ta hujjat` },
      };
    }

    if (op === "count") {
      const n = await col.countDocuments(filter as Document, { maxTimeMS: MAX_TIME_MS });
      return { collection: name, filter, count: n, _ui: { note: `${name}: ${n} ta` } };
    }

    if (op === "distinct") {
      const field = optString(args, "field", 80);
      if (!field || field.startsWith("$")) throw new ToolInputError('"field" is required for distinct');
      if (isSecretKey(field)) throw new ToolInputError("this field is not available");
      const values = await col.distinct(field, filter as Document, { maxTimeMS: MAX_TIME_MS });
      const shown = values.slice(0, MAX_AGG).map((v) => (PHONE_KEY.test(field) ? maskPhone(String(v)) : redact(v)));
      return {
        collection: name,
        field,
        values: shown,
        totalValues: values.length,
        truncated: values.length > shown.length || undefined,
        _ui: { note: `${name}.${field}: ${values.length} ta qiymat` },
      };
    }

    if (op === "find") {
      const projection = objArg(args, "projection");
      const sort = objArg(args, "sort");
      if (projection) assertSafe(projection);
      if (sort) assertSafe(sort);
      const limit = optInt(args, "limit", 1, MAX_FIND) ?? 30;
      const skip = optInt(args, "skip", 0, 1_000_000) ?? 0;
      const [rowsRaw, total] = await Promise.all([
        col
          .find(filter as Document, { projection: projection as Document | undefined, maxTimeMS: MAX_TIME_MS })
          .sort((sort ?? {}) as Document)
          .skip(skip)
          .limit(limit)
          .toArray(),
        col.countDocuments(filter as Document, { maxTimeMS: MAX_TIME_MS }),
      ]);
      const { rows, cut } = fit(rowsRaw.map((r) => redact(r)));
      return {
        collection: name,
        matched: total,
        returned: rows.length,
        rows,
        truncated: cut > 0 || total > skip + rowsRaw.length || undefined,
        hint: cut > 0 ? "Result was too large: use a projection with fewer fields or a smaller limit." : undefined,
        _ui: { note: `${name}: ${total} ta mos · ${rows.length} ta ko'rsatildi` },
      };
    }

    if (op === "aggregate") {
      const pipeline = args.pipeline;
      if (!Array.isArray(pipeline) || pipeline.length === 0) throw new ToolInputError('"pipeline" must be a non-empty array of stages');
      if (pipeline.length > 20) throw new ToolInputError("at most 20 stages");
      for (const stage of pipeline) {
        if (!stage || typeof stage !== "object" || Array.isArray(stage) || Object.keys(stage).length !== 1) {
          throw new ToolInputError("each stage must be an object with exactly one $operator");
        }
        const key = Object.keys(stage)[0];
        if (!ALLOWED_STAGES.has(key)) throw new ToolInputError(`stage ${key} is not allowed`);
      }
      assertSafe(pipeline);
      const rowsRaw = await col
        .aggregate([...(pipeline as Document[]), { $limit: MAX_AGG + 1 }], { maxTimeMS: MAX_TIME_MS, allowDiskUse: false })
        .toArray();
      const more = rowsRaw.length > MAX_AGG;
      const { rows, cut } = fit(rowsRaw.slice(0, MAX_AGG).map((r) => redact(r)));
      return {
        collection: name,
        returned: rows.length,
        rows,
        truncated: more || cut > 0 || undefined,
        hint: more || cut > 0 ? "Result was cut: aggregate further ($group / $count) or add $limit." : undefined,
        _ui: { note: `${name}: ${rows.length} ta natija` },
      };
    }

    throw new ToolInputError('"op" must be describe, find, count, distinct or aggregate');
  },
};
