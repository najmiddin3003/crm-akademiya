"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, RotateCcw, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { api } from "@/components/staff-tasks/api";
import { DEFAULT_LEAD_SETTINGS, type LeadFan, type LeadSettings, type LeadYonalish } from "@/lib/leadSettings";
import { Toggle } from "./SettingsForm";

// Sozlamalar → Sotuv va marketing → Lidlar (lib/leadSettings.ts).
//
// Ommaviy so'rovnoma (/sorovnoma) va Lidlar sahifasi shu ro'yxatlardan
// o'qiydi. Yo'nalishlar soni qat'iy — uchta (so'rovnomadagi animatsiyali
// plitkalar shularga bog'langan), qolgani to'liq tahrirlanadi. Filiallar va
// «qayerdan bildingiz?» manbalari — o'z bo'limlarida (pastdagi izoh).
// Saqlash bitta tugma bilan (PUT /api/lead-settings): ro'yxatlar bir-biriga
// bog'liq emas, lekin yarim saqlangan forma chalkashtirmasin.

const inputCls =
  "h-9 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const iconBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Oddiy satrlar ro'yxati — tahrirlash, tartib, o'chirish, qo'shish. */
function ListEditor({ items, onChange, placeholder, min = 1 }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; min?: number }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.replace(/\s+/g, " ").trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      {items.map((x, i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={inputCls} value={x} maxLength={120} onChange={(e) => onChange(items.map((y, k) => (k === i ? e.target.value : y)))} />
          <button type="button" className={iconBtn} disabled={i === 0} onClick={() => onChange(move(items, i, -1))} title={t("Yuqoriga")}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} title={t("Pastga")}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} disabled={items.length <= min} onClick={() => onChange(items.filter((_, k) => k !== i))} title={t("O'chirish")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1 pt-1">
        <input
          className={inputCls}
          value={draft}
          maxLength={120}
          placeholder={t(placeholder)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outline" lucideIcon={Plus} onClick={add} disabled={!draft.trim()}>
          {t("Qo'shish")}
        </Button>
      </div>
    </div>
  );
}

/** Yo'nalish kartasi — nomi, savoli, ko'rinishi va fanlar (ixtiyoriy guruh bilan). */
function YonalishCard({ y, onChange }: { y: LeadYonalish; onChange: (y: LeadYonalish) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const setFan = (i: number, patch: Partial<LeadFan>) => onChange({ ...y, fanlar: y.fanlar.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const add = () => {
    const nom = draft.replace(/\s+/g, " ").trim();
    if (!nom || y.fanlar.some((f) => f.nom === nom)) return;
    const guruh = y.fanlar[y.fanlar.length - 1]?.guruh;
    onChange({ ...y, fanlar: [...y.fanlar, guruh ? { nom, guruh } : { nom }] });
    setDraft("");
  };
  const hint = y.id === "til" ? t("Chet tili — daraja shkalasi so'raladi") : t("Sinf so'raladi");
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{hint}</div>
        </div>
        <span className="text-[12.5px] text-muted-foreground">{t("So'rovnomada")}</span>
        <Toggle on={y.yoqilgan} onChange={(v) => onChange({ ...y, yoqilgan: v })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted-foreground">{t("Nomi (plitkada)")}</span>
          <input className={inputCls} value={y.nom} maxLength={60} onChange={(e) => onChange({ ...y, nom: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted-foreground">{t("Savol")}</span>
          <input className={inputCls} value={y.savol} maxLength={80} onChange={(e) => onChange({ ...y, savol: e.target.value })} />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-[12px] font-medium text-muted-foreground">{t("Kurslar / fanlar")}</span>
        <div className="space-y-1.5">
          {y.fanlar.map((f, i) => (
            <div key={i} className="flex items-center gap-1">
              <input className={inputCls} value={f.nom} maxLength={120} onChange={(e) => setFan(i, { nom: e.target.value })} />
              <input className={`${inputCls} max-w-[40%]`} value={f.guruh ?? ""} maxLength={60} placeholder={t("Guruh (ixtiyoriy)")} onChange={(e) => setFan(i, { guruh: e.target.value || undefined })} />
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => onChange({ ...y, fanlar: move(y.fanlar, i, -1) })} title={t("Yuqoriga")}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className={iconBtn} disabled={i === y.fanlar.length - 1} onClick={() => onChange({ ...y, fanlar: move(y.fanlar, i, 1) })} title={t("Pastga")}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className={iconBtn} disabled={y.fanlar.length <= 1} onClick={() => onChange({ ...y, fanlar: y.fanlar.filter((_, k) => k !== i) })} title={t("O'chirish")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1 pt-1">
            <input
              className={inputCls}
              value={draft}
              maxLength={120}
              placeholder={t("Yangi kurs yoki fan")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button variant="outline" lucideIcon={Plus} onClick={add} disabled={!draft.trim()}>
              {t("Qo'shish")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <div className="text-[14px] font-semibold">{title}</div>
        {sub && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export default function LeadSettingsTab() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [s, setS] = useState<LeadSettings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    api<{ settings: LeadSettings }>("/api/lead-settings").then((r) => {
      if (off) return;
      const v = r.ok ? r.settings : DEFAULT_LEAD_SETTINGS;
      setS(v);
      setSaved(JSON.stringify(v));
      if (!r.ok) showError(r.error);
    });
    return () => {
      off = true;
    };
  }, [showError]);

  if (!s) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8">
        <SpinnerBlock />
      </div>
    );
  }

  const dirty = JSON.stringify(s) !== saved;
  const save = async () => {
    setSaving(true);
    const r = await api<{ settings: LeadSettings }>("/api/lead-settings", { method: "PUT", body: { settings: s } });
    setSaving(false);
    if (!r.ok) return showError(r.error);
    setS(r.settings);
    setSaved(JSON.stringify(r.settings));
    showSuccess(t("Sozlamalar saqlandi"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{t("Lidlar va so'rovnoma")}</div>
          <p className="text-[12.5px] text-muted-foreground">{t("Sinov darsiga yozilish so'rovnomasi va Lidlar sahifasidagi ro'yxatlar.")}</p>
        </div>
        <a href="/sorovnoma" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary">
          <ExternalLink className="h-4 w-4" />
          {t("So'rovnomani ochish")}
        </a>
        <Button variant="outline" lucideIcon={RotateCcw} onClick={() => setS(DEFAULT_LEAD_SETTINGS)} disabled={saving}>
          {t("Standartga qaytarish")}
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("Saqlash")}
        </Button>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("Filiallar (manzil va telefon) — ")}
        <Link href="/management-filiallar" className="font-medium text-primary hover:underline">
          {t("Boshqaruv → Filiallar")}
        </Link>
        {t("; «Bizni qayerdan bildingiz?» variantlari — O'quvchilar oqimidagi manbalar. So'rovnomadan kelgan lid filialning Telegram topigiga tushadi.")}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {s.yonalishlar.map((y) => (
          <YonalishCard key={y.id} y={y} onChange={(ny) => setS({ ...s, yonalishlar: s.yonalishlar.map((x) => (x.id === ny.id ? ny : x)) })} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Chet tili darajasi shkalasi")} sub={t("Birinchisi — «0 dan». So'rovnomada slayder shu bosqichlar bo'ylab suriladi.")}>
          <ListEditor items={s.bosqichlar} onChange={(v) => setS({ ...s, bosqichlar: v })} placeholder="Yangi bosqich" min={2} />
        </Card>
        <Card title={t("Sinflar")} sub={t("Fanlar va Prezident maktabi yo'nalishida so'raladi.")}>
          <ListEditor items={s.sinflar} onChange={(v) => setS({ ...s, sinflar: v })} placeholder="Yangi sinf" />
        </Card>
        <Card title={t("Qulay vaqtlar")} sub={t("«Qaysi vaqt qulay?» savolining variantlari.")}>
          <ListEditor items={s.vaqtlar} onChange={(v) => setS({ ...s, vaqtlar: v })} placeholder="Yangi vaqt oralig'i" />
        </Card>
        <Card title={t("Rad etish sabablari")} sub={t("Lid kartasidagi «Rad etdi» oynasida chiqadi.")}>
          <ListEditor items={s.radSabablar} onChange={(v) => setS({ ...s, radSabablar: v })} placeholder="Yangi sabab" />
        </Card>
      </div>
    </div>
  );
}
