"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { SettingsGroup } from "@/lib/settings";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// Sozlamalardagi oddiy "maydonlar + Saqlash" formasi uchun umumiy komponent.
// FunctionalityTab dagi kartalar ham, alohida tablar ham shundan foydalanadi —
// farqi faqat `storageKey` va maydon konfiguratsiyasida.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-secondary"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

export function defaultsOfGroups(groups: SettingsGroup[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const g of groups) for (const f of g.fields) out[f.key] = f.default;
  return out;
}

export default function SettingsForm({
  storageKey,
  groups,
  header,
  note,
}: {
  storageKey: string;
  groups: SettingsGroup[];
  header?: React.ReactNode;
  // Qiymatlari bazaga yozilsa ham, mahsulotda ularni o'qiydigan kod hali
  // bo'lmagan formalar uchun rost izoh (SettingsNote). Sababi shu
  // komponentda tushuntirilgan.
  note?: React.ReactNode;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultsOfGroups(groups));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(storageKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        // Saqlangan qiymatlar defaultlar ustiga — yangi maydon qo'shilganda
        // eski hujjat buzilmaydi.
        setValues({ ...defaultsOfGroups(groups), ...d.values });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storageKey, groups]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: storageKey, values }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      showSuccess(t("Sozlamalar saqlandi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  function set(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div className="space-y-4">
      {header}

      {note}

      {loading ? (
        <div className="rounded-2xl bg-card border border-border p-8">
          <SpinnerBlock />
        </div>
      ) : (
        groups.map((g, gi) => (
          <div key={g.title ?? gi} className="rounded-2xl bg-card border border-border p-5">
            {g.title && (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {t(g.title)}
              </div>
            )}
            <div className="divide-y divide-border">
              {g.fields.map((f) => {
                const value = values[f.key];

                if (f.type === "toggle") {
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                      <span className="text-[13px]">{t(f.label)}</span>
                      <Toggle on={Boolean(value)} onChange={(v) => set(f.key, v)} />
                    </div>
                  );
                }

                // Radio — bir nechta variantdan bittasi, har biriga izoh bilan
                // (referensdagi "Filter ko'rinishi" shunday ko'rinadi).
                if (f.type === "radio") {
                  return (
                    <div key={f.key} className="py-3 space-y-2">
                      {f.label && <div className="text-[13px] font-medium">{t(f.label)}</div>}
                      {(f.options ?? []).map((o) => {
                        const [val, hint] = o.split("|");
                        return (
                          <label
                            key={val}
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              value === val ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name={f.key}
                              checked={value === val}
                              onChange={() => set(f.key, val)}
                              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                            />
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium">{val}</span>
                              {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <div key={f.key} className="py-3">
                    {f.label && <label className="block text-[13px] font-medium mb-1.5">{t(f.label)}</label>}
                    {f.type === "select" ? (
                      <Select value={String(value ?? "")} onChange={(v) => set(f.key, v)} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
                    ) : (
                      <div className="relative">
                        <input
                          type={f.type === "number" ? "number" : f.type === "time" ? "time" : "text"}
                          value={String(value ?? "")}
                          onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                          className={f.suffix ? `${inputCls} pr-14` : inputCls}
                        />
                        {/* inset-y-0 + flex: transform bilan markazlash bu
                            yerda bir necha piksel surilib qolardi. */}
                        {f.suffix && (
                          <span className="absolute inset-y-0 right-3 flex items-center text-[12px] text-muted-foreground pointer-events-none">
                            {f.suffix}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || loading}
          className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t("Saqlanmoqda…") : t("Saqlash")}
        </button>
      </div>
    </div>
  );
}
