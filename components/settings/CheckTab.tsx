"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { Toggle } from "./SettingsForm";
import SettingsNote from "./SettingsNote";
import {
  CHECK_FIELDS,
  CHECK_LANGUAGES,
  CHECK_MODES,
  CHECK_MODE_DEFAULTS,
  CHECK_TOGGLES,
} from "@/constants/settingsCheck";
import Select from "@/components/ui/Select";

// Umumiy sozlamalar → Chek. Chek "Moliya" va "Buyurtma" rejimlarida alohida
// bosiladi, shuning uchun ikkala rejim bitta hujjatda mustaqil saqlanadi:
// { moliya: {...}, buyurtma: {...} }. Rejim tugmasi faqat qaysi to'plam
// tahrirlanayotganini almashtiradi — saqlashda ikkalasi ham yuboriladi.

const STORAGE_KEY = "system.check";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

interface CheckSettings {
  /** Tanlangan faylning nomi — faqat ko'rsatish uchun. */
  logoName: string;
  /**
   * Cloudinary'dagi rasmning haqiqiy manzili. Ilgari bu maydon umuman yo'q
   * edi: fayl tanlansa faqat NOMI saqlanardi, rasm esa hech qayerga
   * yuborilmasdi — ya'ni chekka logo hech qachon chiqmasdi. Endi rasm
   * /api/upload/image orqali yuklanadi va manzili shu yerda turadi.
   */
  logoUrl: string;
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
// `logoUrl` shu yerda qo'shiladi: constants/settingsCheck.js boshqa
// egalikda, shu bois yangi maydonning boshlang'ich qiymati komponent
// tomonda beriladi.
const MODE_DEFAULTS: CheckSettings = {
  ...(CHECK_MODE_DEFAULTS as unknown as CheckSettings),
  logoUrl: "",
};

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
  const [uploading, setUploading] = useState(false);

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

  // Logotip HAQIQATAN yuklanadi (Cloudinary → /api/upload/image), keyin
  // qaytgan manzil joriy rejimga yoziladi. Yuklash muvaffaqiyatsiz bo'lsa
  // holat umuman o'zgarmaydi — "tanlangan fayl" ko'rinib, aslida hech narsa
  // saqlanmagan vaziyat bo'lmasin.
  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // `folder` yubormaymiz: lib/cloudinary.ts dagi oq ro'yxatda chek
      // logosi uchun papka yo'q, notanish nom "boshqa" ga tushadi.
      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showError(data.error || "Rasm yuklanmadi");
        return;
      }
      set({ logoUrl: String(data.url), logoName: file.name });
      showSuccess("Logotip yuklandi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setUploading(false);
    }
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
      <div className="rounded-2xl bg-card border border-border p-8">
        <SpinnerBlock />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Logotip endi haqiqatan yuklanadi, ammo "system.check" hujjatini
          o'qiydigan chek chop etish ekrani repoda yo'q (grep bilan
          tekshirildi). Shu bois sozlamalar rost saqlanadi-yu, hozircha
          hech qanday bosma chekka aylanmaydi — buni yashirmaymiz. */}
      <SettingsNote>
        Sozlamalar saqlanadi, lekin chekni chop etadigan ekran hali qo&apos;shilmagan &mdash;
        bu yerdagi matn, o&apos;lcham va maydon tanlovlari hozircha hech qanday bosma chekka
        ta&apos;sir qilmaydi.
      </SettingsNote>

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
            <input
              type="file"
              // /api/upload/image faqat shu uch turni qabul qiladi — brauzer
              // oynasida ham aynan shular ko'rinsin.
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Qiymatni tozalaymiz — aks holda ayni fayl qayta tanlansa
                // change hodisasi umuman kelmaydi.
                e.target.value = "";
                if (file) void uploadLogo(file);
              }}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
            <div className="mt-1.5 text-[12px] text-muted-foreground">
              PNG, JPG yoki WEBP; 5 MB gacha.
            </div>

            {uploading && (
              <div className="mt-2 text-[12px] text-muted-foreground">Yuklanmoqda…</div>
            )}

            {/* Yuklangan rasmning O'ZINI ko'rsatamiz: fayl nomi ko'rinib
                turgani rasm saqlanganini bildirmaydi. */}
            {cur.logoUrl && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary manzili tashqi va o'lchami oldindan noma'lum */}
                <img
                  src={cur.logoUrl}
                  alt={cur.logoName || "Chek logotipi"}
                  className="h-12 w-auto max-w-[160px] rounded-lg border border-border bg-card object-contain p-1"
                />
                <span className="text-[12px] text-muted-foreground truncate min-w-0">
                  {cur.logoName}
                </span>
                <button
                  type="button"
                  onClick={() => set({ logoUrl: "", logoName: "" })}
                  className="h-8 px-3 shrink-0 rounded-lg border border-border text-[13px] font-medium text-rose-600 hover:bg-rose-500/10"
                >
                  O&apos;chirish
                </button>
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
            <Select value={cur.language} onChange={(v) => set({ language: v })} options={(CHECK_LANGUAGES as string[]).map((l) => ({ value: l, label: l }))} />
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
