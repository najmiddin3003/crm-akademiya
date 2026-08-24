"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { Toggle } from "./SettingsForm";
import SettingsNote from "./SettingsNote";
import { FIELD_MODES } from "@/constants/settingsFields";

// Sozlamalar → Sotuv va marketing → "So'raladigan bo'limlar".
// Yuqorida rejim tugmalari (o'quvchi / buyurtma / birinchi dars), pastda
// tanlangan rejimning maydonlari toggle bilan.
//
// Uchala rejim bitta "sale-marketing.field" hujjatida, lekin alohida
// obyektlarda saqlanadi — referensda ular mustaqil sozlanadi.

interface FieldDef {
  key: string;
  label: string;
  default: boolean;
}

interface ModeDef {
  key: string;
  label: string;
  fields: FieldDef[];
}

type FieldValues = Record<string, Record<string, boolean>>;

const MODES = FIELD_MODES as ModeDef[];
const STORAGE_KEY = "sale-marketing.field";

// Har bir rejim uchun boshlang'ich holat. Alohida obyekt yasaymiz, chunki
// order va firstLesson bir xil ro'yxatdan foydalanadi — havola umumiy
// bo'lib qolsa, bittasini o'zgartirish ikkinchisiga ham ta'sir qilardi.
function buildDefaults(): FieldValues {
  const out: FieldValues = {};
  for (const m of MODES) {
    out[m.key] = Object.fromEntries(m.fields.map((f) => [f.key, f.default]));
  }
  return out;
}

// Saqlangan qiymatlarni defaultlar ustiga yozamiz — rejim ichida ham,
// shuning uchun yangi maydon qo'shilganda eski hujjat buzilmaydi.
function withDefaults(saved: unknown): FieldValues {
  const base = buildDefaults();
  const src = (saved ?? {}) as Record<string, Record<string, boolean> | undefined>;
  const out: FieldValues = {};
  for (const m of MODES) out[m.key] = { ...base[m.key], ...(src[m.key] ?? {}) };
  return out;
}

export default function FieldSettingsTab() {
  const { showSuccess, showError } = useToast();
  const [mode, setMode] = useState(MODES[0].key);
  const [values, setValues] = useState<FieldValues>(buildDefaults);
  // Serverdan yuklangan holat — "Qaytarish" shunga qaytaradi (saqlanmagan
  // bo'lsa bu defaultlarning o'zi bo'ladi).
  const [initial, setInitial] = useState<FieldValues>(buildDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(STORAGE_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const merged = withDefaults(d.values);
        setValues(merged);
        setInitial(merged);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const active = useMemo(
    () => MODES.find((m) => m.key === mode) ?? MODES[0],
    [mode],
  );

  function set(fieldKey: string, v: boolean) {
    setValues((prev) => ({ ...prev, [mode]: { ...prev[mode], [fieldKey]: v } }));
  }

  // Barcha rejimlarni qaytaramiz: saqlash ham bitta hujjatni to'liq yozadi,
  // shuning uchun "bekor qilish" ham to'liq bo'lgani mantiqiy.
  function reset() {
    setValues(initial);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_KEY, values }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setInitial(values); // endi "Qaytarish" shu holatga qaytadi
      showSuccess("Sozlamalar saqlandi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap rounded-2xl bg-card border border-border p-2">
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

      {/* Sozlama bazaga to'g'ri yoziladi, lekin "sale-marketing.field" hujjatini
          o'qiydigan forma yo'q: o'quvchi kartochkasi, buyurtma va birinchi dars
          formalari o'z maydonlarini o'zgarmas ro'yxatdan chizadi. Ya'ni bu
          yerdagi belgi hozircha hech qaysi formaning ko'rinishini o'zgartirmaydi —
          shuni yashirmaymiz. */}
      <SettingsNote>
        Tanlov saqlanadi, lekin o&apos;quvchi kartochkasi va buyurtma / birinchi dars formalari
        hozircha uni o&apos;qimaydi &mdash; ular maydonlarni o&apos;zgarmas ro&apos;yxat bo&apos;yicha ko&apos;rsatadi.
      </SettingsNote>

      {loading ? (
        <div className="rounded-2xl bg-card border border-border p-8">
          <SpinnerBlock />
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {active.label}
          </div>
          <div className="divide-y divide-border">
            {active.fields.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[13px]">{f.label}</span>
                <Toggle
                  on={Boolean(values[active.key]?.[f.key])}
                  onChange={(v) => set(f.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={reset}
          disabled={saving || loading}
          className="h-10 px-6 rounded-lg border border-border text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          Qaytarish
        </button>
        <button
          onClick={save}
          disabled={saving || loading}
          className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
