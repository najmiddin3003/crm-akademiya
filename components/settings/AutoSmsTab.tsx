"use client";

import { useEffect, useRef, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "./SettingsForm";
import {
  AUTO_SMS_ABSENT_STATUSES,
  AUTO_SMS_ABSENT_SUBS,
  AUTO_SMS_BRANCHES,
  AUTO_SMS_DEFAULTS,
  AUTO_SMS_SCENARIOS,
} from "@/constants/settingsAutoSms";

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
const DEFAULTS = AUTO_SMS_DEFAULTS as unknown as AutoSmsData;

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
        showError(resData.error || "Saqlanmadi");
        return;
      }
      savedRef.current = data;
      showSuccess("Sozlamalar saqlandi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
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
        <h3 className="text-[15px] font-semibold">Avto sms yoqish</h3>

        <div className="pt-3">
          <label className="block text-[13px] font-medium mb-1.5">Filiallar</label>
          <div className="relative">
            <select
              value={data.branch}
              onChange={(e) => setData((p) => ({ ...p, branch: e.target.value }))}
              className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {(AUTO_SMS_BRANCHES as string[]).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <use href="#i-chevron-down" />
            </svg>
          </div>
        </div>
      </div>

      {SCENARIOS.map((s) => {
        const sc = data.scenarios[s.key];
        return (
          <div key={s.key} className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-[15px] font-semibold">{s.title}</h3>
              <Toggle on={sc.on} onChange={(v) => setScenario(s.key, { on: v })} />
            </div>

            {s.extra === "absent" && (
              <div className="pt-3 space-y-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Davomat holati</label>
                  <div className="relative">
                    <select
                      value={String(sc.status ?? "")}
                      onChange={(e) => setScenario(s.key, { status: e.target.value })}
                      className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {(AUTO_SMS_ABSENT_STATUSES as string[]).map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <use href="#i-chevron-down" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[13px]">
                  <span>Yo&apos;qlama qilgandan</span>
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
                  <span>minut keyin sms yuborsin</span>
                </div>
              </div>
            )}

            {s.extra === "consecutive" && (
              <div className="pt-3 flex items-center gap-2 flex-wrap text-[13px]">
                <span>Ketma-ket</span>
                <input
                  type="number"
                  value={String(sc.days ?? "")}
                  onChange={(e) =>
                    setScenario(s.key, { days: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  className={`${inputCls} w-24`}
                />
                <span>kun</span>
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
                      <span className="text-[13px] font-medium">{sub.title}</span>
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
          Bekor qilish
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

function MessageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="pt-3">
      <label className="block text-[13px] font-medium mb-1.5">Xabar matni</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={areaCls} />
    </div>
  );
}

// Kalit ustiga bosilganda o'sha blokning matniga qo'shiladi — shu bois
// jadval har bir blok bilan birga chiziladi.
function VarTable({ vars, onPick }: { vars: VarDef[]; onPick: (v: string) => void }) {
  const rowCls = "grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center";
  return (
    <div className="pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Mavjud o&apos;zgaruvchilar
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className={`${rowCls} bg-secondary/50 text-[12px] font-medium text-muted-foreground`}>
          <div className="px-3 py-2">Key</div>
          <div className="px-3 py-2">Tavsif</div>
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
