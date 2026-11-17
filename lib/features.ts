import type { Db } from "mongodb";
import { gamificationEnabled, setEnabled } from "@/lib/gamification/settings";
import type { GamActor } from "@/lib/gamification/actor";
import { loadSurveyOpen, saveSurveyOpen } from "@/lib/surveyOpen";

// FUNKSIYALAR (37-qism, rasm «Funksiyalar»). Markaz bo'yicha imkoniyatlar bitta sahifada:
//   • Modullar — mavjud sozlamalarga ulangan: Gamifikatsiya (lib/gamification/settings.ts), So'rovnoma sahifasi ochiq
//     (lib/surveyOpen.ts);
//   • Menyu bo'limlari — o'chirilgan bo'lim yangi versiya menyusida va qidiruvda HECH KIMDA ko'rinmaydi (ma'lumot
//     saqlanadi; manzil bilan ochilsa sahifa ishlaydi) — `app_settings` «menu_hidden»;
//   • «Tez orada» — dizayndagi, tizimda hali yo'q imkoniyatlar (yoqib bo'lmaydi).
// Har o'zgarish `feature_log` ga yoziladi («So'nggi o'zgarishlar»).

export const FEATURE_LOG = "feature_log";
export const MENU_SECTIONS: { key: string; label: string }[] = [
  { key: "tasks", label: "Topshiriqlar" },
  { key: "leads", label: "Lidlar" },
  { key: "groups", label: "Guruh" },
  { key: "students", label: "O'quvchilar" },
  { key: "education", label: "O'quv bo'limi" },
  { key: "imtihon", label: "Imtihon" },
  { key: "finance", label: "Moliya" },
  { key: "sales", label: "Sotuv va marketing" },
  { key: "reports", label: "Hisobotlar" },
  { key: "nazorat", label: "Nazorat" },
  { key: "boshqaruv", label: "Boshqaruv" },
];

export async function hiddenMenu(db: Db): Promise<string[]> {
  const d = await db.collection("app_settings").findOne({ key: "menu_hidden" });
  return ((d?.keys as string[]) ?? []).filter((k) => MENU_SECTIONS.some((s) => s.key === k));
}

export async function featuresPage(db: Db) {
  const [gam, survey, hidden, log] = await Promise.all([
    gamificationEnabled(db),
    loadSurveyOpen(db),
    hiddenMenu(db),
    db.collection(FEATURE_LOG).find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(6).toArray(),
  ]);
  return {
    ok: true as const,
    modules: { gamification: gam, survey },
    menu: MENU_SECTIONS.map((s) => ({ ...s, on: !hidden.includes(s.key) })),
    log: log.map((l) => ({ text: String(l.text), by: String(l.by ?? ""), at: String(l.at) })),
  };
}

async function logIt(db: Db, text: string, by: string) {
  await db.collection(FEATURE_LOG).insertOne({ text, by, at: new Date().toISOString() });
}

export async function setFeature(db: Db, key: string, on: boolean, actor: GamActor) {
  const by = actor.name;
  if (key === "gamification") {
    await setEnabled(db, actor, on);
    await logIt(db, `Gamifikatsiya — ${on ? "yoqildi" : "o'chirildi"}`, by);
    return { ok: true as const };
  }
  if (key === "survey") {
    await saveSurveyOpen(db, on, by);
    await logIt(db, `So'rovnoma sahifasi — ${on ? "ochildi" : "yopildi"}`, by);
    return { ok: true as const };
  }
  const sec = MENU_SECTIONS.find((s) => `menu:${s.key}` === key);
  if (sec) {
    const cur = await hiddenMenu(db);
    const next = on ? cur.filter((k) => k !== sec.key) : [...new Set([...cur, sec.key])];
    await db.collection("app_settings").updateOne({ key: "menu_hidden" }, { $set: { key: "menu_hidden", keys: next } }, { upsert: true });
    await logIt(db, `Menyu: ${sec.label} — ${on ? "ko'rsatildi" : "yashirildi"}`, by);
    return { ok: true as const };
  }
  return { ok: false as const, error: "Bu funksiya hali ishga tushmagan" };
}
