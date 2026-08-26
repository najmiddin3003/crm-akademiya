"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { SettingsListItem } from "@/lib/settingsLists";

// Boshqaruv → Xodimlar jadvalidagi SOLIQ tugmachasi bosilganda chiqadigan
// tanlov: xodimga aynan QAYSI soliq turlari qo'llanishi belgilanadi.
//
// Ro'yxat Sozlamalar → Moliya → Soliq dan keladi (boshqa manba yo'q) va
// faqat FAOL turlar ko'rsatiladi — nofaolini tanlash mumkin emas, chunki
// oylik hisobi ham ularni o'tkazib yuboradi (lib/taxes.ts).
//
// Bir nechta tur tanlanadi. Hech biri tanlanmasa — xodimga soliq
// solinmaydi (tugmacha o'chadi).

function numOf(raw: unknown): number {
  const s = String(raw ?? "").replace(/\s| /g, "").replace(/%/g, "").replace(",", ".");
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** "12%" yoki "500 000 so'm" — turi va qiymatiga qarab. */
function describe(t: SettingsListItem): string {
  const isAmount = /aniq|summa/i.test(String(t.taxType ?? ""));
  return isAmount
    ? `${numOf(t.amount).toLocaleString("ru-RU")} so'm (qat'iy)`
    : `${numOf(t.percent)}% (hisoblangan oylikdan)`;
}

export default function EmployeeTaxModal({
  employeeName,
  selected,
  onClose,
  onSave,
}: {
  employeeName: string;
  /** Hozir biriktirilgan soliq id'lari. */
  selected: number[];
  onClose: () => void;
  onSave: (ids: number[]) => Promise<void> | void;
}) {
  const [items, setItems] = useState<SettingsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ids, setIds] = useState<Set<number>>(new Set(selected));
  // DIQQAT: `selected` — ota komponentda har renderda QAYTA yaratiladigan
  // massiv (`taxTarget.taxIds ?? []`). Uni to'g'ridan-to'g'ri effekt
  // bog'lanishiga qo'yish mumkin emas edi: har render effektni qayta
  // ishga tushirib, ro'yxatni cheksiz qayta yuklayverardi va oyna
  // saqlangandan keyin ham yopilmasdi. Shu bois BOSHLANG'ICH qiymat
  // muzlatiladi — oyna ochiq turganda u o'zgarmasligi kerak ham.
  const [initialSelected] = useState<number[]>(selected);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings-lists?kind=taxes")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        // Nofaol turlar tanlovga chiqmaydi — lekin xodimda allaqachon
        // biriktirilgan bo'lsa ko'rsatiladi, aks holda uni yechib
        // bo'lmay qolardi.
        setItems((d.items as SettingsListItem[]).filter((t) => t.active !== false || initialSelected.includes(t.id)));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialSelected]);

  function toggle(id: number) {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave([...ids]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h3 className="text-[15px] font-semibold">Soliq turlari</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{employeeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-secondary"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-8"><SpinnerBlock size={22} /></div>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4">
              Soliq turlari ro&apos;yxati bo&apos;sh. Avval Sozlamalar &rarr; Moliya &rarr; Soliq
              bo&apos;limida soliq turini qo&apos;shing.
            </p>
          ) : (
            <>
              <p className="text-[12.5px] text-muted-foreground mb-3">
                Bu xodimning oyligidan qaysi soliqlar ushlab qolinsin? Bir nechtasini
                tanlash mumkin — faqat belgilanganlari hisoblanadi.
              </p>
              <div className="space-y-2">
                {items.map((t) => {
                  const on = ids.has(t.id);
                  const inactive = t.active === false;
                  return (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        on ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(t.id)}
                        className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium truncate">
                          {t.name}
                          {inactive && (
                            <span className="ml-1.5 text-[11px] font-normal text-amber-600">nofaol</span>
                          )}
                        </span>
                        <span className="block text-[12px] text-muted-foreground tabular-nums">{describe(t)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {ids.size === 0 && (
                <p className="text-[12px] text-muted-foreground mt-3">
                  Hech biri tanlanmagan — saqlansa bu xodimga soliq solinmaydi.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
