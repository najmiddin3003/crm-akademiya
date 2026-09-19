"use client";

import { useEffect, useRef, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "./SettingsForm";
import SettingsNote from "./SettingsNote";
import { useBranches } from "@/hooks/useBranches";
import {
  AUTO_SMS_ABSENT_STATUSES,
  AUTO_SMS_ABSENT_SUBS,
  AUTO_SMS_DEFAULTS,
  AUTO_SMS_SCENARIOS,
} from "@/constants/settingsAutoSms";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// Sotuv va marketing → Avto sms. Yuqorida umumiy yoqish va filial, pastda
// har bir hodisa uchun alohida karta: toggle + xabar matni + o'zgaruvchilar
// jadvali. Jadvaldagi kalit bosilganda o'sha blokning matniga qo'shiladi.
//
// Hammasi bitta hujjatda saqlanadi:
// { enabled, branch, scenarios: { <kalit>: { on, text, ...qo'shimcha } } }

const STORAGE_KEY = "sale-marketing.auto-sms";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const areaCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

interface VarDef {
  key: string;
  desc: string;
}

interface ScenarioDef {
  key: string;
  title: string;
  default: boolean;
  extra?: string;
  vars: VarDef[];
}

interface SubDef {
  key: string;
  title: string;
  default: boolean;
  vars: VarDef[];
}

interface SubBlock {
  on: boolean;
  text: string;
}

interface Scenario {
  on: boolean;
  text?: string;
  // "Darsga kelmasa" uchun
  status?: string;
  delayMinutes?: number | "";
  // "Ketma-ket davomat" uchun
  days?: number | "";
  [key: string]: unknown;
}

interface AutoSmsData {
  enabled: boolean;
  branch: string;
  scenarios: Record<string, Scenario>;
}

const SCENARIOS = AUTO_SMS_SCENARIOS as unknown as ScenarioDef[];
const SUBS = AUTO_SMS_ABSENT_SUBS as unknown as SubDef[];

// AUTO_SMS_DEFAULTS.branch — AUTO_SMS_BRANCHES[0], ya'ni "Tanlang" degan
// o'rinbosar satr (constants/settingsAutoSms.js). Filiallar ro'yxati endi
// bazadan kelgani uchun bu satr HECH QACHON birorta haqiqiy filial nomiga
// to'g'ri kelmaydi: controlled <select> da mos <option> topilmay
// selectedIndex -1 bo'lardi va maydon birinchi ochilishda BO'SH ko'rinardi —
// go'yo hech narsa tanlanmagandek, lekin "Tanlang" o'rinbosari ham
// ko'rinmasdi. Bo'sh satr esa "tanlanmagan" ning to'g'ri ifodasi va pastdagi
// <option value=""> bilan aniq mos tushadi.
// (Bu o'rinbosar constants/settingsAutoSms.js da — u fayl bu ishning
//  egaligiga kirmagani uchun qiymat shu yerda tozalanadi.)
const DEFAULTS: AutoSmsData = {
  ...(AUTO_SMS_DEFAULTS as unknown as AutoSmsData),
  branch: "",
};

// `scenarios` ichma-ich obyekt bo'lgani uchun yuza merge yetmaydi: har bir
// ssenariy, undan keyin ost-bloklar ham alohida birlashtiriladi — yangi
// maydon qo'shilganda eski hujjat buzilmasin.
function withDefaults(saved?: Partial<AutoSmsData>): AutoSmsData {
  const savedScenarios = (saved?.scenarios ?? {}) as Record<string, Partial<Scenario>>;
  return {
    ...DEFAULTS,
    ...(saved ?? {}),
    scenarios: Object.fromEntries(
      SCENARIOS.map((s) => {
        const base = DEFAULTS.scenarios[s.key];
        const cur = savedScenarios[s.key] ?? {};
        const merged: Scenario = { ...base, ...cur };
        for (const sub of SUBS) {
          if (!base[sub.key]) continue;
          merged[sub.key] = {
            ...(base[sub.key] as SubBlock),
            ...((cur[sub.key] as Partial<SubBlock>) ?? {}),
          };
        }
        return [s.key, merged];
      })
    ),
  };
}

export default function AutoSmsTab() {
  const { t } = useT();
  // Filiallar bazadan — ilgari bu ro'yxat faqat ["Tanlang"] edi, ya'ni
  // birorta haqiqiy filialni tanlab bo'lmasdi.
  const { branches, loading: branchesLoading } = useBranches();
  const branchNames = branches.map((b) => b.name).filter(Boolean);
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<AutoSmsData>(withDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // "Bekor qilish" oxirgi saqlangan holatga qaytaradi. useRef argumentni faqat
  // birinchi renderda oladi — shu bois defaultlarni qayta yig'masdan
  // boshlang'ich `data` ni beramiz.
  const savedRef = useRef<AutoSmsData>(data);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(STORAGE_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const merged = withDefaults(d.values as Partial<AutoSmsData>);
        savedRef.current = merged;
        setData(merged);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function setScenario(key: string, patch: Partial<Scenario>) {
    setData((prev) => ({
      ...prev,
      scenarios: { ...prev.scenarios, [key]: { ...prev.scenarios[key], ...patch } },
    }));
  }

  function setSub(key: string, subKey: string, patch: Partial<SubBlock>) {
    setData((prev) => {
      const sc = prev.scenarios[key];
      const sub = { ...(sc[subKey] as SubBlock), ...patch };
      return { ...prev, scenarios: { ...prev.scenarios, [key]: { ...sc, [subKey]: sub } } };
    });
  }

  // O'zgaruvchi matn oxiriga qo'shiladi (kursor holatini tiklash shart emas —
  // referensda ham shunday). Oxirgi probellarni avval kesamiz: faqat
  // probeldan iborat matnda o'zgaruvchi oldiga ortiqcha bo'shliq tushmasin.
  function appendVar(text: string, v: string) {
    const base = text.replace(/\s+$/, "");
    return base ? `${base} ${v}` : v;
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_KEY, values: data }),
      });
      const resData = await res.json();
      if (!resData.ok) {
        showError(t(resData.error || "Saqlanmadi"));
        return;
      }
      savedRef.current = data;
      showSuccess(t("Sozlamalar saqlandi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8">
        <SpinnerBlock />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border p-5">
        {/* Referensda "Avto sms yoqish" — sarlavha, umumiy kalit emas: har bir
            ssenariy o'z toggle'i bilan mustaqil yoqiladi. `enabled` maydoni
            saqlash shaklida qoldirilgan, lekin UI'da ko'rsatilmaydi. */}
        <h3 className="text-[15px] font-semibold">{t("Avto sms yoqish")}</h3>

        {/* NEGA BU IZOH BOR: sahifa nomi "Avto sms", lekin tizimda hodisani
            kutib turadigan rejalashtiruvchi (cron/queue) yo'q — toggle,
            filial, "necha minutdan keyin" va "ketma-ket necha kun" qiymatlari
            saqlanadi-yu, ularni o'qib SMS yuboradigan kod yo'q. Yagona
            haqiqiy foydalanuvchi — SmsModal (Buyurtma → SMS yuborish): u shu
            yerdagi XABAR MATNLARINI qo'lda yuborish uchun shablon sifatida
            oladi. Shuni ochiq aytmasak, sozlagan odam sms avtomatik ketyapti
            deb o'ylab qoladi. */}
        <div className="pt-3">
          <SettingsNote>
            Xabar matnlari &quot;SMS yuborish&quot; oynasida tayyor shablon bo&apos;lib chiqadi va
            shu yerdan qo&apos;lda yuboriladi. Avtomatik yuborish esa hali ishlamaydi: belgilar,
            filial va vaqt qiymatlari saqlanadi, lekin ularni kutib turadigan xizmat yo&apos;q.
          </SettingsNote>
        </div>

        <div className="pt-3">
          <label className="block text-[13px] font-medium mb-1.5">{t("Filiallar")}</label>
          <Select value={branchNames.includes(data.branch) ? data.branch : ""} onChange={(v) => setData((p) => ({ ...p, branch: v }))} options={branchNames.map((b) => ({ value: b, label: b }))} placeholder={branchesLoading
                  ? "Yuklanmoqda…"
                  : branchNames.length === 0
                    ? t("Filial qo'shilmagan")
                    : "Tanlang"} clearable />
        </div>
      </div>

      {SCENARIOS.map((s) => {
        const sc = data.scenarios[s.key];
        return (
          <div key={s.key} className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-[15px] font-semibold">{t(s.title)}</h3>
              <Toggle on={sc.on} onChange={(v) => setScenario(s.key, { on: v })} />
            </div>

            {s.extra === "absent" && (
              <div className="pt-3 space-y-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1.5">{t("Davomat holati")}</label>
                  <Select value={String(sc.status ?? "")} onChange={(v) => setScenario(s.key, { status: v })} options={(AUTO_SMS_ABSENT_STATUSES as string[]).map((st) => ({ value: st, label: st }))} />
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[13px]">
                  <span>{t("Yo'qlama qilgandan")}</span>
                  <input
                    type="number"
                    // Bo'sh maydonni 0 ga aylantirmaymiz — tozalab qayta
                    // yozish imkoni qolsin.
                    value={String(sc.delayMinutes ?? "")}
                    onChange={(e) =>
                      setScenario(s.key, {
                        delayMinutes: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className={`${inputCls} w-24`}
                  />
                  <span>{t("minut keyin sms yuborsin")}</span>
                </div>
              </div>
            )}

            {s.extra === "consecutive" && (
              <div className="pt-3 flex items-center gap-2 flex-wrap text-[13px]">
                <span>{t("Ketma-ket")}</span>
                <input
                  type="number"
                  value={String(sc.days ?? "")}
                  onChange={(e) =>
                    setScenario(s.key, { days: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  className={`${inputCls} w-24`}
                />
                <span>{t("kun")}</span>
              </div>
            )}

            {s.vars.length > 0 && (
              <>
                <MessageField
                  value={String(sc.text ?? "")}
                  onChange={(v) => setScenario(s.key, { text: v })}
                />
                <VarTable
                  vars={s.vars}
                  onPick={(v) => setScenario(s.key, { text: appendVar(String(sc.text ?? ""), v) })}
                />
              </>
            )}

            {/* "Darsga kelmasa" da xabar ikki manzilga ketadi — har birining
                o'z toggli, matni va jadvali bor. */}
            {s.extra === "absent" &&
              SUBS.map((sub) => {
                const sb = sc[sub.key] as SubBlock;
                return (
                  <div key={sub.key} className="mt-3 rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[13px] font-medium">{t(sub.title)}</span>
                      <Toggle on={sb.on} onChange={(v) => setSub(s.key, sub.key, { on: v })} />
                    </div>
                    <MessageField
                      value={sb.text}
                      onChange={(v) => setSub(s.key, sub.key, { text: v })}
                    />
                    <VarTable
                      vars={sub.vars}
                      onPick={(v) => setSub(s.key, sub.key, { text: appendVar(sb.text, v) })}
                    />
                  </div>
                );
              })}
          </div>
        );
      })}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setData(savedRef.current)}
          disabled={saving}
          className="h-10 px-6 rounded-lg border border-border text-sm font-medium hover:bg-secondary"
        >
          {t("Bekor qilish")}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t("Saqlanmoqda…") : t("Saqlash")}
        </button>
      </div>
    </div>
  );
}

function MessageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  return (
    <div className="pt-3">
      <label className="block text-[13px] font-medium mb-1.5">{t("Xabar matni")}</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={areaCls} />
    </div>
  );
}

// Kalit ustiga bosilganda o'sha blokning matniga qo'shiladi — shu bois
// jadval har bir blok bilan birga chiziladi.
function VarTable({ vars, onPick }: { vars: VarDef[]; onPick: (v: string) => void }) {
  const { t } = useT();
  const rowCls = "grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center";
  return (
    <div className="pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {t("Mavjud o'zgaruvchilar")}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className={`${rowCls} bg-secondary/50 text-[12px] font-medium text-muted-foreground`}>
          <div className="px-3 py-2">{t("Key")}</div>
          <div className="px-3 py-2">{t("Tavsif")}</div>
        </div>
        <div className="divide-y divide-border border-t border-border">
          {vars.map((v) => (
            <div key={v.key} className={rowCls}>
              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onPick(v.key)}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  {v.key}
                </button>
              </div>
              <div className="px-3 py-2 text-[12px] text-muted-foreground">{v.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
