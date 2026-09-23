import type { Db } from "mongodb";
import { SOURCE_OTHER } from "@/constants";
import { loadLeadSettings } from "@/lib/leadSettings";
import { listSourceOptions } from "@/lib/studentSources";
import type { SurveyConfig } from "@/lib/survey";

/**
 * So'rovnoma sozlamalari — sahifa (server komponent) ham, qabul route'i ham
 * shu bitta funksiyadan: sahifada ko'ringan tanlov serverda ham yaroqli.
 *
 *   yo'nalishlar, daraja/sinf, vaqtlar — Sozlamalar → Sotuv va marketing → Lidlar;
 *   filiallar (manzil, telefon)       — Boshqaruv → Filiallar;
 *   «qayerdan bildingiz?»             — O'quvchilar oqimidagi manbalar.
 */
export async function loadSurveyConfig(db: Db): Promise<SurveyConfig> {
  const [s, branches, sources] = await Promise.all([
    loadLeadSettings(db),
    db
      .collection("branches")
      .find({}, { projection: { _id: 0, id: 1, name: 1, location: 1, address: 1, phone: 1 } })
      .sort({ id: 1 })
      .toArray(),
    listSourceOptions(db),
  ]);
  const manbalar = sources.map((x) => String(x.name ?? "").trim()).filter((n) => n && n !== SOURCE_OTHER);
  return {
    yonalishlar: s.yonalishlar.filter((y) => y.yoqilgan && y.fanlar.length > 0),
    bosqichlar: s.bosqichlar,
    sinflar: s.sinflar,
    vaqtlar: s.vaqtlar,
    filiallar: branches
      .map((b) => ({
        id: Number(b.id),
        nom: String(b.name ?? "").trim(),
        manzil: String(b.address || b.location || "").trim(),
        shahar: String(b.location ?? "").trim(),
        telefon: String(b.phone ?? "").trim(),
      }))
      .filter((b) => b.id > 0 && b.nom),
    manbalar: [...manbalar, SOURCE_OTHER],
  };
}
