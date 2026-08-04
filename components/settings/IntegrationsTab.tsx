"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { INTEGRATIONS, INTEGRATION_CATEGORIES } from "@/constants/integrations";

// Sozlamalar → Integratsiyalar. Referensdagidek: yuqorida kategoriya
// filtrlari, pastda provayder kartalari va "O'rnatish / O'rnatilgan" holati.
//
// Holat MongoDB `settings` kolleksiyasida "integration.installed" kaliti
// ostida saqlanadi (kalit → boolean), shuning uchun yangi provayder
// qo'shilganda migratsiya kerak emas.

interface Integration {
  key: string;
  name: string;
  category: string;
  installed: boolean;
}

const ALL = INTEGRATIONS as Integration[];
const STORAGE_KEY = "integration.installed";

// Referensdagi qo'shimcha filtrlar — kategoriya emas, holat bo'yicha.
const EXTRA_TABS = ["Installed", "Active"];

export default function IntegrationsTab() {
  const { showSuccess, showError } = useToast();
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${STORAGE_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        // Saqlanmagan provayder uchun konfiguratsiyadagi boshlang'ich holat.
        const base = Object.fromEntries(ALL.map((i) => [i.key, i.installed]));
        setInstalled({ ...base, ...d.values });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (filter === "All") return ALL;
    if (filter === "Installed" || filter === "Active") return ALL.filter((i) => installed[i.key]);
    return ALL.filter((i) => i.category === filter);
  }, [filter, installed]);

  const grouped = useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const i of visible) {
      if (!map.has(i.category)) map.set(i.category, []);
      map.get(i.category)!.push(i);
    }
    return Array.from(map.entries());
  }, [visible]);

  async function toggle(key: string) {
    const next = { ...installed, [key]: !installed[key] };
    setInstalled(next);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_KEY, values: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setInstalled(installed); // qaytarib qo'yamiz
        return;
      }
      showSuccess(next[key] ? "O'rnatildi" : "O'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setInstalled(installed);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap rounded-2xl bg-card border border-border p-2">
        {["All", ...INTEGRATION_CATEGORIES, ...EXTRA_TABS].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
              filter === c ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl bg-card border border-border p-10 text-center text-sm text-muted-foreground">
          Yuklanmoqda…
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-10 text-center text-sm text-muted-foreground">
          Integratsiya topilmadi
        </div>
      ) : (
        grouped.map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-[14px] font-semibold">{category}</h3>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
              {items.map((i) => {
                const on = !!installed[i.key];
                return (
                  <div key={i.key} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-[15px] font-semibold text-center">{i.name}</span>
                    </div>
                    <button
                      onClick={() => toggle(i.key)}
                      className={`h-9 rounded-lg border text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                        on
                          ? "border-border text-muted-foreground hover:bg-secondary"
                          : "border-primary text-primary hover:bg-primary/10"
                      }`}
                    >
                      {on ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {on ? "O'rnatilgan" : "O'rnatish"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
