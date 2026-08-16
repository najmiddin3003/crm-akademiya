"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "./SettingsForm";
import {
  CHECK_FIELDS,
  CHECK_LANGUAGES,
  CHECK_MODES,
  CHECK_MODE_DEFAULTS,
  CHECK_TOGGLES,
} from "@/constants/settingsCheck";

// Umumiy sozlamalar → Chek. Chek "Moliya" va "Buyurtma" rejimlarida alohida
// bosiladi, shuning uchun ikkala rejim bitta hujjatda mustaqil saqlanadi:
// { moliya: {...}, buyurtma: {...} }. Rejim tugmasi faqat qaysi to'plam
// tahrirlanayotganini almashtiradi — saqlashda ikkalasi ham yuboriladi.

const STORAGE_KEY = "system.check";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

interface CheckSettings {
  logoName: string;
  titleText: string;
  titleSize: number | "";
  titleBold: boolean;
  footerText: string;
  footerSize: number | "";
  footerBold: boolean;
  language: string;
  fields: Record<string, boolean>;
  // Umumiy toggllar (autoPrint, showQr, ...) — ro'yxati constants faylida.
  [key: string]: unknown;
}

type CheckData = Record<string, CheckSettings>;

const MODES = CHECK_MODES as { key: string; label: string }[];
const TOGGLES = CHECK_TOGGLES as { key: string; label: string }[];
const FIELDS = CHECK_FIELDS as { key: string; label: string }[];
const MODE_DEFAULTS = CHECK_MODE_DEFAULTS as unknown as CheckSettings;

// `fields` ichki obyekt bo'lgani uchun yuza merge yetmaydi — uni alohida
// qo'shamiz, aks holda yangi maydon qo'shilganda eski hujjatda u yo'qoladi.
function withDefaults(saved?: Partial<CheckSettings>): CheckSettings {
  return {
    ...MODE_DEFAULTS,
    ...(saved ?? {}),
    fields: { ...MODE_DEFAULTS.fields, ...(saved?.fields ?? {}) },
  };
}

function emptyData(): CheckData {
  return Object.fromEntries(MODES.map((m) => [m.key, withDefaults()]));
}

export default function CheckTab() {
  const { showSuccess, showError } = useToast();
  const [mode, setMode] = useState(MODES[0].key);
  const [data, setData] = useState<CheckData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(STORAGE_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const saved = (d.values ?? {}) as Record<string, Partial<CheckSettings>>;
        setData(Object.fromEntries(MODES.map((m) => [m.key, withDefaults(saved[m.key])])));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cur = data[mode];

  // Barcha o'zgarishlar faqat joriy rejim ichiga tushadi.
  function set(patch: Partial<CheckSettings>) {
    setData((prev) => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  }

  function setField(key: string, v: boolean) {
    setData((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], fields: { ...prev[mode].fields, [key]: v } },
    }));
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
      showSuccess("Sozlamalar saqlandi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8 text-center text-sm text-muted-foreground">
        Yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h3 className="text-[15px] font-semibold">Chek sozlamalari</h3>
          <div className="flex items-center gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
                  mode === m.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          <div className="py-3">
            <label className="block text-[13px] font-medium mb-1.5">Logo</label>
            {/* Fayl yuklash backend'i hali yo'q — rasmning o'zi yuborilmaydi,
                faqat tanlangan fayl nomi saqlanadi. */}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => set({ logoName: e.target.files?.[0]?.name ?? "" })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {cur.logoName && (
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                Tanlangan fayl: {cur.logoName}
              </div>
            )}
          </div>

          <TextGroup
            title="Sarlavha"
            text={cur.titleText}
            size={cur.titleSize}
            bold={cur.titleBold}
            onText={(v) => set({ titleText: v })}
            onSize={(v) => set({ titleSize: v })}
            onBold={(v) => set({ titleBold: v })}
          />

          <TextGroup
            title="Chek tag yozuvi"
            text={cur.footerText}
            size={cur.footerSize}
            bold={cur.footerBold}
            onText={(v) => set({ footerText: v })}
            onSize={(v) => set({ footerSize: v })}
            onBold={(v) => set({ footerBold: v })}
          />

          <div className="py-3">
            <label className="block text-[13px] font-medium mb-1.5">Chek tili</label>
            <div className="relative">
              <select
                value={cur.language}
                onChange={(e) => set({ language: e.target.value })}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {(CHECK_LANGUAGES as string[]).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <use href="#i-chevron-down" />
              </svg>
            </div>
          </div>

          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-4 py-3">
              <span className="text-[13px]">{t.label}</span>
              <Toggle on={Boolean(cur[t.key])} onChange={(v) => set({ [t.key]: v })} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        {/* Ikkala karta sarlavhasi bir xil ko'rinsin — birinchisi ham
            text-[15px] font-semibold. */}
        <h3 className="text-[15px] font-semibold mb-2">Chekda ko&apos;rinadigan maydonlar</h3>
        <div className="divide-y divide-border">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4 py-3">
              <span className="text-[13px]">{f.label}</span>
              <Toggle on={Boolean(cur.fields[f.key])} onChange={(v) => setField(f.key, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
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

// "Matni + Hajmi + Bold" uchligi ikki joyda takrorlanadi (sarlavha va tag
// yozuvi), shu bois alohida ajratildi.
function TextGroup({
  title,
  text,
  size,
  bold,
  onText,
  onSize,
  onBold,
}: {
  title: string;
  text: string;
  size: number | "";
  bold: boolean;
  onText: (v: string) => void;
  onSize: (v: number | "") => void;
  onBold: (v: boolean) => void;
}) {
  return (
    // Pastki bo'shliqni "Bold" qatorining py-3 i beradi — aks holda guruh
    // oxirida qo'shaloq padding chiqib, boshqa qatorlar bilan mos kelmaydi.
    <div className="pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </div>
      <div className="grid gap-3 grid-cols-[minmax(0,1fr)_140px] pt-1">
        <div>
          <label className="block text-[13px] font-medium mb-1.5">Matni</label>
          <input value={text} onChange={(e) => onText(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[13px] font-medium mb-1.5">Hajmi (px)</label>
          <input
            type="number"
            placeholder="14"
            value={String(size ?? "")}
            // Bo'sh maydonni 0 ga aylantirmaymiz — foydalanuvchi tozalab
            // qayta yozishi mumkin bo'lsin.
            onChange={(e) => onSize(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        <span className="text-[13px]">Bold</span>
        <Toggle on={bold} onChange={onBold} />
      </div>
    </div>
  );
}
