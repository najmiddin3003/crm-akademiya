import type { Db, Document } from "mongodb";
import { branchForInsert, withBranch, withPupilBranch, type BranchScope } from "@/lib/branchScope";
import { ARCHIVED_GROUPS_COLLECTION } from "@/lib/groups";
import { pupilFullName } from "@/lib/pupilsData";
import { uzStamp } from "@/lib/uzTime";
import {
  DATE_RE,
  UB_DEFAULT_SCHEME,
  UB_DEFAULT_SUBJECTS,
  blockSubjects,
  cellsCalc,
  cellsEmpty,
  cleanCells,
  cleanScheme,
  cleanSubjects,
  defaultTestName,
  monthOfDate,
  sameSubject,
  schemeMax,
  type UbCells,
  type UbConfig,
  type UbResult,
  type UbTest,
  type UbTestRow,
} from "@/lib/uzbmb";

// UzBMB — server mantiqi (12-qism, 25.10.2026). Route'lar yupqa: sessiya/ruxsat va JSON — u yerda,
// qamrov va yozish — shu yerda (Node sinovi route'siz chaqira olsin).
//
// QAMROV: test navbardagi filial (hovuzi bilan — 1+2 Chortoq bitta) bo'yicha ko'rinadi (`withBranch`);
// natijalar testga bog'langan — test ko'rinsa, uning hamma natijasi ko'rinadi. Guruh va o'quvchi
// yozishda ham joriy filialda bo'lishi shart (Sarhisob bilan bir xil qoida).

export const UB = { settings: "uzbmb_settings", tests: "uzbmb_tests", results: "uzbmb_exams" } as const;

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const isDupKey = (e: unknown) => (e as { code?: number } | null)?.code === 11000;

/* ── Sozlama ────────────────────────────────────────────────────────────── */

export async function loadUbConfig(db: Db): Promise<UbConfig> {
  const doc = await db.collection(UB.settings).findOne({ key: "main" }, { projection: { _id: 0 } });
  if (!doc) return { scheme: UB_DEFAULT_SCHEME, subjects: [...UB_DEFAULT_SUBJECTS] };
  const scheme = cleanScheme(doc.scheme) ?? UB_DEFAULT_SCHEME;
  const subjects = cleanSubjects(doc.subjects);
  return {
    scheme,
    subjects: subjects.ok ? subjects.subjects : [...UB_DEFAULT_SUBJECTS],
    ...(doc.updatedAt ? { updatedAt: String(doc.updatedAt) } : {}),
    ...(doc.updatedBy ? { updatedBy: String(doc.updatedBy) } : {}),
  };
}

/** `{ scheme?, subjects? }` — berilgani almashtiriladi. */
export async function saveUbConfig(db: Db, input: unknown, author: string): Promise<{ ok: true; config: UbConfig } | Fail> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const cur = await loadUbConfig(db);
  let { scheme, subjects } = cur;
  if (o.scheme !== undefined) {
    const s = cleanScheme(o.scheme);
    if (!s) return fail("Savollar soni 1 dan 100 gacha, koeffitsiyent 0,1 dan 10 gacha bo'lsin");
    scheme = s;
  }
  if (o.subjects !== undefined) {
    const r = cleanSubjects(o.subjects);
    if (!r.ok) return fail(r.error);
    subjects = r.subjects;
  }
  if (blockSubjects({ subjects }).length < 2) return fail("Kamida ikkita faol blok fani bo'lishi kerak");
  const updatedAt = uzStamp();
  await db.collection(UB.settings).updateOne({ key: "main" }, { $set: { scheme, subjects, updatedAt, updatedBy: author } }, { upsert: true });
  return { ok: true, config: { scheme, subjects, updatedAt, updatedBy: author } };
}

/* ── Testlar ────────────────────────────────────────────────────────────── */

const TEST_PROJ = { _id: 0, id: 1, branchId: 1, no: 1, name: 1, date: 1, scheme: 1, createdAt: 1, createdBy: 1 } as const;

function asTest(d: Document): UbTest {
  return {
    id: Number(d.id),
    branchId: Number(d.branchId),
    no: Number(d.no),
    name: String(d.name ?? ""),
    date: String(d.date ?? ""),
    scheme: cleanScheme(d.scheme) ?? UB_DEFAULT_SCHEME,
    createdAt: String(d.createdAt ?? ""),
    createdBy: String(d.createdBy ?? ""),
  };
}

async function findTest(db: Db, scope: BranchScope, id: number): Promise<UbTest | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const d = await db.collection(UB.tests).findOne(withBranch({ id }, scope), { projection: TEST_PROJ });
  return d ? asTest(d) : null;
}

export async function listTests(db: Db, scope: BranchScope): Promise<{ tests: UbTestRow[]; legacyCount: number }> {
  const docs = await db.collection(UB.tests).find(withBranch({}, scope), { projection: TEST_PROJ }).sort({ no: -1, id: -1 }).toArray();
  const tests = docs.map(asTest);
  const ids = tests.map((t) => t.id);
  const [agg, legacyCount] = await Promise.all([
    ids.length
      ? db
          .collection(UB.results)
          .aggregate<{ _id: number; n: number; groups: number[] }>([
            { $match: { testId: { $in: ids } } },
            { $group: { _id: "$testId", n: { $sum: 1 }, groups: { $addToSet: "$groupId" } } },
          ])
          .toArray()
      : Promise.resolve([]),
    // Testga bog'lanmagan eski natijalar (25.10.2026 gacha, oyma-oy) — eski ko'rinishda ochiladi.
    db.collection(UB.results).countDocuments(withBranch({ testId: { $exists: false } }, scope)),
  ]);
  const by = new Map(agg.map((a) => [Number(a._id), a]));
  return {
    tests: tests.map((t) => ({ ...t, resultCount: by.get(t.id)?.n ?? 0, groupCount: by.get(t.id)?.groups.length ?? 0 })),
    legacyCount,
  };
}

function cleanTestName(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function createTest(db: Db, scope: BranchScope, input: unknown, author: string): Promise<{ ok: true; test: UbTest } | Fail> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const date = String(o.date ?? "").trim();
  if (!DATE_RE.test(date)) return fail("Test sanasini tanlang");
  const cfg = await loadUbConfig(db);
  const col = db.collection(UB.tests);
  const last = await col.find(withBranch({}, scope), { projection: { no: 1 } }).sort({ no: -1 }).limit(1).toArray();
  const no = (Number(last[0]?.no) || 0) + 1;
  const name = cleanTestName(o.name) || defaultTestName(no);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const top = await col.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
    const test: UbTest = { id: (Number(top[0]?.id) || 0) + 1, branchId: branchForInsert(scope), no, name, date, scheme: cfg.scheme, createdAt: uzStamp(), createdBy: author };
    try {
      await col.insertOne({ ...test });
      return { ok: true, test };
    } catch (e) {
      if (!isDupKey(e)) throw e;
    }
  }
  return fail("Test saqlanmadi — qayta urinib ko'ring", 409);
}

export async function updateTest(db: Db, scope: BranchScope, id: number, input: unknown): Promise<{ ok: true; test: UbTest } | Fail> {
  const test = await findTest(db, scope, id);
  if (!test) return fail("Test topilmadi", 404);
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const set: Partial<UbTest> = {};
  if (o.name !== undefined) {
    const name = cleanTestName(o.name);
    if (!name) return fail("Test nomini kiriting");
    set.name = name;
  }
  if (o.date !== undefined) {
    const date = String(o.date).trim();
    if (!DATE_RE.test(date)) return fail("Test sanasini tanlang");
    set.date = date;
  }
  if (Object.keys(set).length) await db.collection(UB.tests).updateOne({ id: test.id }, { $set: set });
  return { ok: true, test: { ...test, ...set } };
}

/** Faqat natijasiz test o'chadi — natija bor bo'lsa avval ular o'chiriladi (kiritish jadvalida). */
export async function deleteTest(db: Db, scope: BranchScope, id: number): Promise<{ ok: true } | Fail> {
  const test = await findTest(db, scope, id);
  if (!test) return fail("Test topilmadi", 404);
  const n = await db.collection(UB.results).countDocuments({ testId: test.id });
  if (n > 0) return fail(`Bu testda ${n} ta natija bor — o'chirib bo'lmaydi`, 409);
  await db.collection(UB.tests).deleteOne({ id: test.id });
  return { ok: true };
}

/* ── Natijalar ──────────────────────────────────────────────────────────── */

const RESULT_PROJ = {
  _id: 0,
  id: 1,
  testId: 1,
  groupId: 1,
  pupilId: 1,
  student: 1,
  date: 1,
  b1s: 1,
  b2s: 1,
  b1c: 1,
  b1cert: 1,
  b1m: 1,
  b2c: 1,
  b2cert: 1,
  b2m: 1,
  m1: 1,
  m2: 1,
  m3: 1,
  b1: 1,
  b2: 1,
  maj: 1,
  total: 1,
  complete: 1,
} as const;

const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function asResult(d: Document): UbResult {
  const b1cert = Boolean(d.b1cert);
  const b2cert = Boolean(d.b2cert);
  return {
    id: Number(d.id),
    testId: Number(d.testId),
    groupId: Number(d.groupId),
    pupilId: Number(d.pupilId),
    student: String(d.student ?? ""),
    date: String(d.date ?? ""),
    b1s: String(d.b1s ?? ""),
    b2s: String(d.b2s ?? ""),
    b1c: b1cert ? null : numOrNull(d.b1c),
    b1cert,
    b1m: b1cert ? numOrNull(d.b1m) : null,
    b2c: b2cert ? null : numOrNull(d.b2c),
    b2cert,
    b2m: b2cert ? numOrNull(d.b2m) : null,
    m1: numOrNull(d.m1),
    m2: numOrNull(d.m2),
    m3: numOrNull(d.m3),
    b1: Number(d.b1) || 0,
    b2: Number(d.b2) || 0,
    maj: Number(d.maj) || 0,
    total: Number(d.total) || 0,
    complete: d.complete !== false,
  };
}

/** Guruh nomi — «Biologiya · 9-11-sinflar · 12» (yangi versiyadagi guruh yorlig'i). */
export function ubGroupLabel(g: Document): string {
  const course = String(g.course ?? "").trim();
  const level = String(g.level ?? "").trim();
  const num = String(g.name ?? "").trim();
  const head = [course, level].filter(Boolean).join(" · ");
  if (!head) return num ? `${num}-guruh` : `#${g.id}`;
  return num ? `${head} · ${num}` : head;
}

async function groupLabels(db: Db, ids: number[]): Promise<Record<number, string>> {
  if (!ids.length) return {};
  const proj = { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1 } };
  const [live, archived] = await Promise.all([
    db.collection("groups").find({ id: { $in: ids } }, proj).toArray(),
    db.collection(ARCHIVED_GROUPS_COLLECTION).find({ id: { $in: ids } }, proj).toArray(),
  ]);
  const out: Record<number, string> = {};
  for (const g of [...archived, ...live]) out[Number(g.id)] = ubGroupLabel(g);
  return out;
}

export interface UbTestData {
  test: UbTest;
  /** Oldingi test (raqami kichigi) — «№2 testdan» va «Bu guruh · №2 test». */
  prev: UbTest | null;
  results: UbResult[];
  prevResults: Pick<UbResult, "pupilId" | "groupId" | "total" | "complete">[];
  /** Guruhning oxirgi saqlangan yo'nalishi (har qanday testda) — «Yo'nalish · avto». */
  lastDirections: Record<number, { b1s: string; b2s: string }>;
  groupLabels: Record<number, string>;
}

export async function testData(db: Db, scope: BranchScope, id: number): Promise<{ ok: true; data: UbTestData } | Fail> {
  const test = await findTest(db, scope, id);
  if (!test) return fail("Test topilmadi", 404);
  const tests = db.collection(UB.tests);
  const [prevDoc, scopeTests] = await Promise.all([
    tests.find(withBranch({ no: { $lt: test.no } }, scope), { projection: TEST_PROJ }).sort({ no: -1, id: -1 }).limit(1).toArray(),
    tests.find(withBranch({}, scope), { projection: { _id: 0, id: 1 } }).toArray(),
  ]);
  const prev = prevDoc[0] ? asTest(prevDoc[0]) : null;
  const res = db.collection(UB.results);
  const [results, prevResults, dirs] = await Promise.all([
    res.find({ testId: test.id }, { projection: RESULT_PROJ }).sort({ id: 1 }).toArray(),
    prev ? res.find({ testId: prev.id }, { projection: { _id: 0, pupilId: 1, groupId: 1, total: 1, complete: 1 } }).toArray() : Promise.resolve([]),
    res
      .aggregate<{ _id: number; b1s: string; b2s: string }>([
        { $match: { testId: { $in: scopeTests.map((t) => Number(t.id)) }, b1s: { $nin: [null, ""] }, b2s: { $nin: [null, ""] } } },
        { $sort: { date: -1, id: -1 } },
        { $group: { _id: "$groupId", b1s: { $first: "$b1s" }, b2s: { $first: "$b2s" } } },
      ])
      .toArray(),
  ]);
  const list = results.map(asResult);
  const prevList = prevResults.map((d) => ({ pupilId: Number(d.pupilId), groupId: Number(d.groupId), total: Number(d.total) || 0, complete: d.complete !== false }));
  const ids = [...new Set([...list.map((r) => r.groupId), ...prevList.map((r) => r.groupId)].filter((n) => Number.isFinite(n)))];
  return {
    ok: true,
    data: {
      test,
      prev,
      results: list,
      prevResults: prevList,
      lastDirections: Object.fromEntries(dirs.map((d) => [Number(d._id), { b1s: d.b1s, b2s: d.b2s }])),
      groupLabels: await groupLabels(db, ids),
    },
  };
}

export const UB_SHEET_MAX_ROWS = 300;

/**
 * Guruh varag'ini saqlash: `{ groupId, date, rows: [{ pupilId, b1s, b2s, ...kataklar }] }`.
 * Faqat O'ZGARGAN qatorlar keladi (mijoz solishtiradi). Bo'sh qator — natija o'chadi. Har qatorda
 * o'z yo'nalishi (guruhdagi boshqa yo'nalishli o'quvchi o'z fanlarida qoladi). Bitta o'quvchi —
 * bitta testda bitta natija: boshqa guruh bilan saqlangan bo'lsa, shu guruhga o'tadi.
 */
export async function saveSheet(
  db: Db,
  scope: BranchScope,
  testId: number,
  input: unknown,
  author: string,
): Promise<{ ok: true; saved: number; removed: number; skipped: number; results: UbResult[] } | Fail> {
  const test = await findTest(db, scope, testId);
  if (!test) return fail("Test topilmadi", 404);
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const groupId = Number(o.groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) return fail("Guruhni tanlang");
  const group = await db.collection("groups").findOne(withBranch({ id: groupId }, scope), { projection: { _id: 0, id: 1, branchId: 1 } });
  if (!group) return fail("Guruh topilmadi", 404);
  const date = DATE_RE.test(String(o.date ?? "")) ? String(o.date) : test.date;
  if (!Array.isArray(o.rows)) return fail("Noto'g'ri so'rov");
  if (o.rows.length === 0) return fail("O'zgargan natija yo'q");
  if (o.rows.length > UB_SHEET_MAX_ROWS) return fail("Juda ko'p qator");

  const cfg = await loadUbConfig(db);
  const allowed = blockSubjects(cfg, { inactive: true });
  const canon = (raw: unknown) => {
    const name = String(raw ?? "").trim();
    return allowed.find((s) => sameSubject(s.name, name))?.name ?? null;
  };

  type Row = { pupilId: number; b1s: string; b2s: string; cells: UbCells; clear: boolean };
  const rows: Row[] = [];
  const seen = new Set<number>();
  for (const raw of o.rows as unknown[]) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const pupilId = Number(r.pupilId);
    if (!Number.isInteger(pupilId) || pupilId <= 0 || seen.has(pupilId)) continue;
    const c = cleanCells(r, test.scheme);
    if (!c.ok) return fail(c.error);
    const clear = cellsEmpty(c.cells);
    const b1s = canon(r.b1s);
    const b2s = canon(r.b2s);
    if (!clear) {
      if (!b1s || !b2s) return fail("Yo'nalishni tanlang (1-blok va 2-blok fani)");
      if (b1s === b2s) return fail("1-blok va 2-blok fani bir xil bo'lmasin");
    }
    seen.add(pupilId);
    rows.push({ pupilId, b1s: b1s ?? "", b2s: b2s ?? "", cells: c.cells, clear });
  }
  if (!rows.length) return fail("O'zgargan natija yo'q");

  // O'quvchilar ismi BAZADAN (joriy filial, hovuz bilan) — boshqa filialniki o'tkazib yuboriladi.
  const ids = rows.map((r) => r.pupilId);
  const res = db.collection(UB.results);
  const [pupils, existing] = await Promise.all([
    db.collection("pupils").find(withPupilBranch({ id: { $in: ids } }, scope), { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } }).toArray(),
    res.find({ testId: test.id, pupilId: { $in: ids } }, { projection: { _id: 1, id: 1, pupilId: 1 } }).toArray(),
  ]);
  const nameOf = new Map(pupils.map((p) => [Number(p.id), pupilFullName({ firstName: String(p.firstName ?? ""), lastName: String(p.lastName ?? "") })]));
  const exOf = new Map(existing.map((d) => [Number(d.pupilId), d]));
  const branchId = Number.isFinite(Number(group.branchId)) ? Number(group.branchId) : branchForInsert(scope);
  const now = uzStamp();

  let saved = 0;
  let removed = 0;
  let skipped = 0;
  let nextId = 0;
  const takeId = async () => {
    if (!nextId) {
      const top = await res.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
      nextId = (Number(top[0]?.id) || 0) + 1;
    }
    return nextId++;
  };

  for (const r of rows) {
    const ex = exOf.get(r.pupilId);
    const student = nameOf.get(r.pupilId);
    if (student === undefined) {
      skipped += 1;
      continue;
    }
    if (r.clear) {
      if (ex) {
        await res.deleteOne({ _id: ex._id });
        removed += 1;
      }
      continue;
    }
    const calc = cellsCalc(r.cells, test.scheme);
    const doc = {
      testId: test.id,
      groupId,
      pupilId: r.pupilId,
      student,
      date,
      month: monthOfDate(date),
      b1s: r.b1s,
      b2s: r.b2s,
      ...r.cells,
      // Eski maydonlar (bot, eski ko'rinish) — sertifikatsiz blokda `b1m` 0, majburiy kiritilmagani 0 emas, null.
      b1m: r.cells.b1cert ? r.cells.b1m : 0,
      b2m: r.cells.b2cert ? r.cells.b2m : 0,
      b1: calc.b1 ?? 0,
      b2: calc.b2 ?? 0,
      maj: calc.maj,
      total: calc.total,
      complete: calc.complete,
      branchId,
      updatedAt: now,
      updatedBy: author,
    };
    if (ex) {
      await res.updateOne({ _id: ex._id }, { $set: doc });
      saved += 1;
      continue;
    }
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt += 1) {
      try {
        await res.insertOne({ id: await takeId(), ...doc, createdAt: now, createdBy: author });
        done = true;
      } catch (e) {
        if (!isDupKey(e)) throw e;
        // Bir vaqtda boshqa xodim shu o'quvchini saqlagan bo'lsa — uning yozuvini yangilaymiz.
        const raced = await res.findOne({ testId: test.id, pupilId: r.pupilId }, { projection: { _id: 1 } });
        if (raced) {
          await res.updateOne({ _id: raced._id }, { $set: doc });
          done = true;
        } else {
          nextId = 0; // id to'qnashdi — yangisini olamiz
        }
      }
    }
    if (!done) return fail("Natija saqlanmadi — qayta urinib ko'ring", 409);
    saved += 1;
  }

  const fresh = await res.find({ testId: test.id }, { projection: RESULT_PROJ }).sort({ id: 1 }).toArray();
  return { ok: true, saved, removed, skipped, results: fresh.map(asResult) };
}

export interface UbHistoryRow {
  testId: number;
  no: number;
  name: string;
  date: string;
  b1s: string;
  b2s: string;
  b1: number;
  b2: number;
  maj: number;
  total: number;
  complete: boolean;
  max: number;
}

/** O'quvchining UzBMB testlari (joriy filial testlari) — o'ng kartadagi tarix. */
export async function pupilHistory(db: Db, scope: BranchScope, pupilId: number): Promise<UbHistoryRow[]> {
  if (!Number.isInteger(pupilId) || pupilId <= 0) return [];
  const tests = (await db.collection(UB.tests).find(withBranch({}, scope), { projection: TEST_PROJ }).toArray()).map(asTest);
  if (!tests.length) return [];
  const byId = new Map(tests.map((t) => [t.id, t]));
  const rows = await db
    .collection(UB.results)
    .find({ pupilId, testId: { $in: tests.map((t) => t.id) } }, { projection: RESULT_PROJ })
    .toArray();
  return rows
    .map(asResult)
    .map((r) => {
      const t = byId.get(r.testId)!;
      return { testId: t.id, no: t.no, name: t.name, date: r.date || t.date, b1s: r.b1s, b2s: r.b2s, b1: r.b1, b2: r.b2, maj: r.maj, total: r.total, complete: r.complete, max: schemeMax(t.scheme).total };
    })
    .sort((a, b) => b.no - a.no);
}
