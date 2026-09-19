"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import SettingsNote from "./SettingsNote";
import { INTEGRATIONS, INTEGRATION_CATEGORIES } from "@/constants/integrations";
import { useT } from "@/components/shared/Language";

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
  const { t } = useT();
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
        showError(t(data.error || "Saqlanmadi"));
        setInstalled(installed); // qaytarib qo'yamiz
        return;
      }
      // Ilgari bu yerda "O'rnatildi" chiqardi — bu yolg'on da'vo edi: hech
      // narsa o'rnatilmaydi, faqat belgi saqlanadi. Toast endi aynan sodir
      // bo'lgan ishni aytadi.
      showSuccess(next[key] ? t("Belgilandi") : t("Belgi olib tashlandi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
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

      {/* Kartani bosish faqat "integration.installed" hujjatidagi belgini
          o'zgartiradi: hisob ma'lumoti (kalit, token, telefon) so'ralmaydi,
          ulanish tekshirilmaydi va bu belgini o'qiydigan boshqa kod yo'q.
          Shu bois bu ro'yxat — reja/belgi taxtasi, ishlaydigan do'kon emas. */}
      <SettingsNote>
        Bu yerda faqat qaysi xizmatdan foydalanish rejalashtirilgani belgilanadi. Haqiqiy
        ulanish yo&apos;q: hisob ma&apos;lumotlari so&apos;ralmaydi, aloqa tekshirilmaydi va belgi
        tizimning boshqa bo&apos;limlariga ta&apos;sir qilmaydi.
      </SettingsNote>

      {loading ? (
        <div className="rounded-2xl bg-card border border-border p-10">
          <SpinnerBlock />
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-10 text-center text-sm text-muted-foreground">
          {t("Integratsiya topilmadi")}
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
                      {/* "O'rnatilgan" emas: hech qanday provayder o'rnatilmaydi,
                          faqat shu karta belgilanadi. */}
                      {on ? t("Belgilangan") : t("Belgilash")}
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
