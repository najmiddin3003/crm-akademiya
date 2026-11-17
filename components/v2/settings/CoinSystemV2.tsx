"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Loader2, Trophy } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NUMERIC_SETTINGS, type GamLevel, type GamRole, type GamSettings, type NumericSettingKey } from "@/lib/gamification/types";

// YANGI VERSIYA — SOZLAMALAR → GAMIFIKATSIYA → «TANGA TIZIMI» (33-qism). Modul (yoqish / o'chirish —
// darhol, tasdiq bilan); Cheklovlar, Toifalar va chegirma, Guruhlar musobaqasi, Darajalar (nomi va
// chegarasi — o'zgartirishda nechta o'quvchi ko'tarilishi oldindan ko'rinadi), Doimiy qoidalar.
// Raqamli maydonlar va darajalar — pastdagi «N ta o'zgarish saqlanmagan» qatori bilan birga saqlanadi.
// Faqat direktor o'zgartiradi (server ham). Server: GET/PUT /api/gamification/settings,
// PUT /api/gamification/levels (?preview=1).

type Draft = Partial<Record<NumericSettingKey, string>>;

const LIMIT_FIELDS: { key: NumericSettingKey; label: string; hint: string; unit: string }[] = [
  { key: "activityGroupLimitPerLesson", label: "Darsdagi faollik — guruhga bir darsda", hint: "ustoz +1…+5 tugmalari shu limitdan beradi", unit: "tanga" },
  { key: "dailyDeductionLimit", label: "Qo'lda ayirish — o'quvchidan kuniga", hint: "uy vazifasi ✗ va sabablar; davomat −10 kirmaydi", unit: "tanga" },
  { key: "objectionDays", label: "E'tiroz va «Sababli» muddati", hint: "admin shu muddatda tuzatishi mumkin", unit: "kun" },
  { key: "wishlistMax", label: "Istaklar ro'yxati — maksimum", hint: "o'quvchi kabinetida", unit: "ta" },
  { key: "monthCloseDay", label: "Oy yakuni — keyingi oyning", hint: "reyting va musobaqa shu kuni tunda qayd etiladi", unit: "-kuni" },
];

const LEVEL_TONE = ["bg-v2-surface-2 text-v2-text-2", "bg-v2-success-bg text-v2-success", "bg-v2-info-bg text-v2-info", "bg-v2-violet-bg text-v2-violet", "bg-v2-warning-bg text-v2-warning"];

interface DiscountItem {
  id: number;
  title: string;
  priceCoins: number;
  kind: string;
  discountPercent: number | null;
}

export default function CoinSystemV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<GamSettings | null>(null);
  const [role, setRole] = useState<GamRole | null>(null);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [levels, setLevels] = useState<GamLevel[] | null>(null);
  const [preview, setPreview] = useState<number[] | null>(null);
  const [discounts, setDiscounts] = useState<DiscountItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [askToggle, setAskToggle] = useState<boolean | null>(null);
  const [ver, setVer] = useState(0);

  useEffect(() => {
    let off = false;
    void Promise.all([
      gamApi<{ settings: GamSettings; role: GamRole; levelCounts: number[] }>("/api/gamification/settings?counts=1"),
      gamApi<{ items: DiscountItem[] }>("/api/gamification/shop"),
    ]).then(([s, sh]) => {
      if (off) return;
      if (!s.ok) {
        setErr(s.error);
        return;
      }
      setSettings(s.settings);
      setRole(s.role);
      setCounts(s.levelCounts ?? null);
      setLevels(s.settings.levels.map((l) => ({ ...l })));
      setDraft({});
      setPreview(null);
      if (sh.ok) setDiscounts(sh.items.filter((i) => i.kind === "discount"));
    });
    return () => {
      off = true;
    };
  }, [ver]);

  const canEdit = role === "director";
  const levelsChanged = useMemo(
    () => !!settings && !!levels && levels.some((l, i) => l.name.trim() !== settings.levels[i]?.name || l.minEarned !== settings.levels[i]?.minEarned),
    [settings, levels],
  );

  // Darajalar o'zgarsa — nechta o'quvchi qaysi darajaga tushishini serverdan oldindan so'raymiz.
  useEffect(() => {
    if (!levelsChanged || !levels || !canEdit) return;
    let off = false;
    const h = window.setTimeout(() => {
      void gamApi<{ counts: number[] }>("/api/gamification/levels?preview=1", { method: "PUT", body: { levels } }).then((r) => {
        if (!off) setPreview(r.ok ? r.counts : null);
      });
    }, 350);
    return () => {
      off = true;
      window.clearTimeout(h);
    };
  }, [levels, levelsChanged, canEdit]);

  const val = useCallback((k: NumericSettingKey) => (draft[k] !== undefined ? draft[k]! : String(settings?.[k] ?? "")), [draft, settings]);
  const numChanges = settings ? (Object.keys(draft) as NumericSettingKey[]).filter((k) => draft[k] !== String(settings[k])) : [];
  const badField = (k: NumericSettingKey) => {
    const v = val(k);
    const [lo, hi] = NUMERIC_SETTINGS[k];
    return !/^\d+$/.test(v) || Number(v) < lo || Number(v) > hi;
  };
  const changeList: string[] = [
    ...numChanges.map((k) => `${t(labelOf(k))} ${settings![k]} → ${draft[k]}`),
    ...(levelsChanged && levels && settings
      ? levels.flatMap((l, i) => {
          const o = settings.levels[i];
          const out: string[] = [];
          if (o && l.minEarned !== o.minEarned) out.push(t("{name} chegarasi {a} → {b}", { name: t(o.name), a: o.minEarned, b: l.minEarned }));
          if (o && l.name.trim() !== o.name) out.push(`${t(o.name)} → ${l.name.trim()}`);
          return out;
        })
      : []),
  ];
  const dirty = changeList.length > 0;

  function labelOf(k: NumericSettingKey): string {
    const f = LIMIT_FIELDS.find((x) => x.key === k);
    if (f) return f.label;
    if (k === "kidsMaxGrade") return "Kichiklar toifasi";
    if (k === "competitionWinnerCoins") return "G'olib guruh o'quvchisiga";
    if (k === "competitionMinMembers") return "Qatnashish — kamida";
    return k;
  }

  async function save() {
    if (!settings || !levels || saving) return;
    const bad = numChanges.find(badField);
    if (bad) {
      const [lo, hi] = NUMERIC_SETTINGS[bad];
      showError(t("«{f}» {lo}–{hi} oralig'ida butun son bo'lsin", { f: t(labelOf(bad)), lo, hi }));
      return;
    }
    setSaving(true);
    if (numChanges.length) {
      const body = Object.fromEntries(numChanges.map((k) => [k, draft[k]]));
      const r = await gamApi<{ settings: GamSettings; removedWishes: number }>("/api/gamification/settings", { method: "PUT", body });
      if (!r.ok) {
        setSaving(false);
        showError(t(r.error));
        return;
      }
      if (r.removedWishes) showSuccess(t("Toifaga mos kelmay qolgan {n} ta istak olib tashlandi", { n: r.removedWishes }));
    }
    if (levelsChanged) {
      const r = await gamApi<{ up: number }>("/api/gamification/levels", { method: "PUT", body: { levels: levels.map((l) => ({ ...l, name: l.name.trim() })) } });
      if (!r.ok) {
        setSaving(false);
        showError(t(r.error));
        return;
      }
    }
    setSaving(false);
    showSuccess(t("Saqlandi"));
    setVer((v) => v + 1);
  }

  async function toggle(on: boolean) {
    setAskToggle(null);
    const r = await gamApi<{ settings: GamSettings }>("/api/gamification/settings", { method: "PUT", body: { enabled: on } });
    if (!r.ok) return showError(t(r.error));
    showSuccess(on ? t("Gamifikatsiya yoqildi") : t("Gamifikatsiya o'chirildi — balanslar saqlanadi"));
    setVer((v) => v + 1);
  }

  if (!settings || !levels) {
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        {err ? t(err) : <Loader2 className="size-4 animate-spin" aria-hidden />}
      </div>
    );
  }

  const numInput = (k: NumericSettingKey, unit: string) => (
    <div className="flex shrink-0 items-center gap-2">
      <span className="block w-20">
        <input
          value={val(k)}
          disabled={!canEdit}
          inputMode="numeric"
          aria-label={t(labelOf(k))}
          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
          className={fieldCls(badField(k) ? "error" : "default", "text-right tabular-nums font-semibold")}
        />
      </span>
      <span className="w-14 text-v2-small text-v2-text-2">{t(unit)}</span>
    </div>
  );
  const total = (counts ?? []).reduce((a, n) => a + n, 0);
  const firstChanged = levels.findIndex((l, i) => l.minEarned !== settings.levels[i]?.minEarned);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <div className="flex items-center gap-2 text-v2-small text-v2-text-2">
          {t("Gamifikatsiya")}
        </div>
        <h1 className="text-v2-page text-v2-text">{t("Tanga tizimi")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Faqat direktor o'zgartiradi. O'zgarish keyingi yozuvlarga qo'llanadi — o'tgan yozuvlar o'zgarmaydi.")}</p>
      </div>

      {/* Modul */}
      <section className="flex items-center gap-4 rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
        <span className={`grid size-11 shrink-0 place-items-center rounded-v2-md ${settings.enabled ? "bg-v2-brand-bg text-v2-brand" : "bg-v2-surface-2 text-v2-text-3"}`}>
          <Trophy className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b className="font-semibold text-v2-text">{t("Gamifikatsiya moduli")}</b>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-v2-caption font-semibold ${settings.enabled ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>
              <span className={`size-1.5 rounded-full ${settings.enabled ? "bg-v2-success" : "bg-v2-text-3"}`} aria-hidden />
              {settings.enabled ? t("Yoqilgan") : t("O'chiq")}
            </span>
            {settings.startDate && <span className="text-v2-small text-v2-text-2">{t("{date} dan", { date: fmt.dayMonth(settings.startDate) })}</span>}
          </div>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {settings.enabled ? t("O'quvchilarga tanga yozilmoqda. O'chirilsa yangi tanga yozilmaydi, balanslar saqlanadi.") : t("Yoqilgan kundan boshlab tanga yoziladi.")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label={t("Gamifikatsiya moduli")}
          disabled={!canEdit}
          onClick={() => setAskToggle(!settings.enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${settings.enabled ? "bg-v2-brand" : "bg-v2-border-strong"}`}
        >
          <span className={`absolute top-1 size-5 rounded-full bg-v2-surface shadow transition-all ${settings.enabled ? "left-6" : "left-1"}`} />
        </button>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Cheklovlar */}
        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <h2 className="px-5 pb-1 pt-4 text-v2-h3 font-semibold text-v2-text">{t("Cheklovlar")}</h2>
          {LIMIT_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-4 border-b border-v2-border px-5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">{t(f.label)}</div>
                <div className="text-v2-small text-v2-text-2">{t(f.hint)}</div>
              </div>
              {numInput(f.key, f.unit)}
            </div>
          ))}
        </section>

        <div className="space-y-4">
          {/* Toifalar va chegirma */}
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
            <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Toifalar va chegirma")}</h2>
            <div className="mt-3 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">{t("Kichiklar toifasi — shu sinfgacha")}</div>
                <div className="text-v2-small text-v2-text-2">{t("qolganlari kattalar · do'kon shunga qarab ajraladi")}</div>
              </div>
              {numInput("kidsMaxGrade", "-sinf")}
            </div>
            {discounts.map((d) => (
              <div key={d.id} className="mt-3 rounded-v2-md bg-v2-violet-bg px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="font-semibold text-v2-text">
                    {t(d.title)} · {t("{n} tanga", { n: d.priceCoins })}
                  </b>
                  <Link href="/gamification-shop" className="shrink-0 text-v2-small font-semibold text-v2-brand hover:underline">
                    {t("Tahrirlash")}
                  </Link>
                </div>
                <p className="mt-0.5 text-v2-small text-v2-text-2">{t("oyiga 1 marta, keyingi oyga o'tmaydi · Moliyada o'zi yoziladi · ustoz foizi to'liq narxdan")}</p>
              </div>
            ))}
          </section>

          {/* Guruhlar musobaqasi */}
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
            <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Guruhlar musobaqasi")}</h2>
            <div className="mt-3 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">{t("G'olib guruhning har bir o'quvchisiga")}</div>
                <div className="text-v2-small text-v2-text-2">{t("0 — tanga yozilmaydi")}</div>
              </div>
              {numInput("competitionWinnerCoins", "tanga")}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-v2-text">
                  {t("Qatnashish — kamida")}
                  <span className="rounded-v2-sm bg-v2-violet-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-violet">{t("Taklif")}</span>
                </div>
                <div className="text-v2-small text-v2-text-2">{t("kam o'quvchili guruh o'rin olmaydi · 1 — cheklovsiz")}</div>
              </div>
              {numInput("competitionMinMembers", "o'quvchi")}
            </div>
          </section>
        </div>
      </div>

      {/* Darajalar */}
      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="px-5 pt-4">
          <h2 className="text-v2-h3 font-semibold text-v2-text">
            {t("Darajalar")} · {t("{n} ta", { n: levels.length })}
          </h2>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{t("«Jami topilgan» tanga bo'yicha — sarflash va ayirish darajani tushirmaydi · chegaralar o'sib borishi, nomlar takrorlanmasligi kerak")}</p>
        </div>
        <div className="mt-3 grid grid-cols-[2.5rem_minmax(0,1fr)_9rem_minmax(8rem,auto)] items-center gap-x-4 border-b border-v2-border px-5 pb-2 text-v2-small text-v2-text-2">
          <span />
          <span>{t("Nomi")}</span>
          <span>{t("Chegara")}</span>
          <span className="text-right">
            {t("Hozir")} · {t("{n} faol hamyon", { n: total })}
          </span>
        </div>
        {levels.map((l, i) => {
          const changed = l.minEarned !== settings.levels[i]?.minEarned;
          const now = counts?.[i] ?? 0;
          const next = preview?.[i];
          return (
            <div key={l.position} className={`grid grid-cols-[2.5rem_minmax(0,1fr)_9rem_minmax(8rem,auto)] items-center gap-x-4 border-b border-v2-border px-5 py-2.5 last:border-b-0 ${changed ? "bg-v2-brand-bg" : ""}`}>
              <span className={`grid size-8 place-items-center rounded-full text-v2-small font-semibold ${LEVEL_TONE[i] ?? LEVEL_TONE[0]}`}>{l.position}</span>
              <input
                value={l.name}
                disabled={!canEdit}
                aria-label={t("{n}-daraja nomi", { n: l.position })}
                onChange={(e) => setLevels((ls) => ls!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className={fieldCls("default")}
              />
              <span className="flex items-center gap-2">
                <span className="block w-24">
                <input
                  value={String(l.minEarned)}
                  disabled={!canEdit || i === 0}
                  inputMode="numeric"
                  aria-label={t("{n}-daraja chegarasi", { n: l.position })}
                  onChange={(e) => setLevels((ls) => ls!.map((x, j) => (j === i ? { ...x, minEarned: Number(e.target.value.replace(/\D/g, "").slice(0, 6)) || 0 } : x)))}
                  className={fieldCls("default", `text-right tabular-nums font-semibold ${i === 0 ? "bg-v2-surface-2!" : ""}`)}
                />
                </span>
                <span className="text-v2-small text-v2-text-2">{t("tanga")}</span>
              </span>
              <span className="text-right">
                {next !== undefined && next !== now ? (
                  <>
                    <b className="font-semibold text-v2-brand-text">{t("{a} → {b} o'quvchi", { a: now, b: next })}</b>
                    {changed && <span className="block text-v2-caption text-v2-text-2">{t("chegara {n} edi", { n: settings.levels[i].minEarned })}</span>}
                  </>
                ) : (
                  <b className="font-semibold tabular-nums text-v2-text">{i === 0 ? t("{n} o'quvchi", { n: now }) : now}</b>
                )}
              </span>
            </div>
          );
        })}
        {firstChanged >= 0 && preview && counts && (
          <div className="mx-5 my-4 flex gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
            <span>
              {t("Chegara {n} bo'lsa, «{name}» darajasidagilar soni {a} → {b} bo'ladi va yangi ko'tarilganlar nishon oladi. Keyin chegarani oshirsangiz, erishganlar o'z darajasida qoladi.", {
                n: levels[firstChanged].minEarned,
                name: levels[firstChanged].name,
                a: counts[firstChanged] ?? 0,
                b: preview[firstChanged] ?? 0,
              })}
            </span>
          </div>
        )}
      </section>

      {/* Doimiy qoidalar */}
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface-2 p-5">
        <h2 className="text-v2-h3 font-semibold text-v2-text">
          {t("Doimiy qoidalar")} <span className="text-v2-small font-normal text-v2-text-2">{t("o'zgarmaydi")}</span>
        </h2>
        <ul className="mt-3 grid list-disc gap-x-8 gap-y-2 pl-5 text-v2-small text-v2-text-2 marker:text-v2-text-3 md:grid-cols-2">
          <li>{t("Balans 0 dan pastga tushmaydi")}</li>
          <li>{t("Sabab bilan ayirishda izoh majburiy")}</li>
          <li>{t("Tangalar yil oxirida yonmaydi — yig'ilib boradi")}</li>
          <li>{t("Ketgan o'quvchi tangalari muzlatiladi, qaytsa tiklanadi")}</li>
          <li>{t("Filial almashtirsa, tangalar o'quvchi bilan ko'chadi")}</li>
          <li>{t("Har yozuvda kim, qachon va qaysi darsda bergani saqlanadi")}</li>
        </ul>
      </section>

      {/* Saqlash qatori */}
      {dirty && canEdit && (
        <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-v2-border bg-v2-surface px-5 py-3 shadow-v2-md sm:-mx-5">
          <span className="size-2 rounded-full bg-v2-warning" aria-hidden />
          <span className="min-w-0 flex-1 text-v2-small text-v2-text-2">
            <b className="font-semibold text-v2-text">{t("{n} ta o'zgarish saqlanmagan", { n: changeList.length })}</b> · {changeList.join(" · ")}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft({});
              setLevels(settings.levels.map((l) => ({ ...l })));
              setPreview(null);
            }}
            disabled={saving}
            className={secondaryBtn}
          >
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {saving ? t("Saqlanmoqda…") : t("O'zgarishni saqlash")}
          </button>
        </div>
      )}

      {askToggle !== null && (
        <V2Confirm
          tone={askToggle ? "brand" : "danger"}
          title={askToggle ? t("Gamifikatsiyani yoqish") : t("Gamifikatsiyani o'chirish")}
          body={askToggle ? t("Bugundan boshlab davomat, uy vazifasi va faollik uchun tanga yoziladi.") : t("Yangi tanga yozilmaydi, balanslar va tarix saqlanadi. Keyin qayta yoqish mumkin.")}
          confirmLabel={askToggle ? t("Yoqish") : t("O'chirish")}
          onCancel={() => setAskToggle(null)}
          onConfirm={() => void toggle(askToggle)}
        />
      )}
    </div>
  );
}
