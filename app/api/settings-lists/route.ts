import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import {
  REASONS_SEED,
  PAYMENT_METHODS_SEED,
  PARTNERS_SEED,
  HOLIDAYS_SEED,
  THIRD_PERSONS_SEED,
  MONTHLY_PERCENTS_SEED,
  ASSESSMENT_LEVELS_SEED,
  ACTIVITIES_SEED,
  DEGREES_MANAGER_SEED,
  DEGREES_TEACHER_SEED,
  HASHTAGS_SEED,
  STUDENT_CATEGORIES_SEED,
  SMS_DEVICES_SEED,
  LEAD_COLORS_SEED,
} from "@/constants/settingsLists";
import {
  SETTINGS_LIST_KINDS,
  pickListFields,
  type SettingsListItem,
  type SettingsListKind,
} from "@/lib/settingsLists";
import { slugifyMethod } from "@/lib/paymentMethods";

// Sozlamalar ro'yxatlari backend'i — `?kind=` bilan barcha oddiy CRUD
// ro'yxatlariga xizmat qiladi (Sabablar, To'lov turlari, Hamkorlar,
// grading tizimi, Hashtag …). Hammasi bir xil shaklda bo'lgani uchun
// har biriga alohida route yozilmadi.

const SEEDS: Record<SettingsListKind, unknown[]> = {
  reasons: REASONS_SEED,
  "payment-methods": PAYMENT_METHODS_SEED,
  partners: PARTNERS_SEED,
  holidays: HOLIDAYS_SEED,
  "third-persons": THIRD_PERSONS_SEED,
  "monthly-percents": MONTHLY_PERCENTS_SEED,
  "assessment-levels": ASSESSMENT_LEVELS_SEED,
  activities: ACTIVITIES_SEED,
  "degrees-manager": DEGREES_MANAGER_SEED,
  "degrees-teacher": DEGREES_TEACHER_SEED,
  hashtags: HASHTAGS_SEED,
  "student-categories": STUDENT_CATEGORIES_SEED,
  "sms-devices": SMS_DEVICES_SEED,
  "lead-colors": LEAD_COLORS_SEED,
};

function isKind(v: string | null): v is SettingsListKind {
  return !!v && v in SETTINGS_LIST_KINDS;
}

async function seedIfEmpty(col: Collection, kind: SettingsListKind) {
  const seed = SEEDS[kind];
  // Seed bo'sh bo'lishi mumkin (masalan Bayram kunlari) — insertMany([])
  // MongoDB'da xato beradi, shuning uchun oldindan tekshiramiz.
  if (seed.length > 0 && (await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(seed)));
  }
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKind(kind)) {
    return NextResponse.json(
      { ok: false, error: `Noto'g'ri "kind" — ruxsat: ${Object.keys(SETTINGS_LIST_KINDS).join(", ")}` },
      { status: 400 },
    );
  }
  const db = await ensureIndexes();
  const col = db.collection(SETTINGS_LIST_KINDS[kind]);
  await seedIfEmpty(col, kind);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const items = rows.map(({ _id, ...rest }) => rest as unknown as SettingsListItem);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKind(kind)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri kind" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const fields = pickListFields(body);
  const name = String(fields.name ?? "");
  if (!name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection(SETTINGS_LIST_KINDS[kind]);
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // Yangi qo'shilgan yozuv hech qachon "tizimli" bo'lmaydi — o'chirilishi mumkin.
  const item = { ...fields, id: nextId, kind, name, system: false } as unknown as SettingsListItem;

  // To'lov turi kassaning `methodTotals` maydonida kalit bo'lib ishlatiladi —
  // nomdan barqaror slug yasaymiz va takrorlanmasligini ta'minlaymiz.
  if (kind === "payment-methods") {
    const existing = await col.find({}).toArray();
    const used = new Set(existing.map((r) => String(r.key)));
    let key = slugifyMethod(name);
    let n = 2;
    while (used.has(key)) key = `${slugifyMethod(name)}${n++}`;
    item.key = key;
  }
  await col.insertOne({ ...item });
  return NextResponse.json({ ok: true, item });
}
