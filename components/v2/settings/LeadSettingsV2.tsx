"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Clock, GraduationCap, Hash, Info, LayoutGrid, Loader2, MessageSquare, Pencil, Phone, Plus, RotateCcw, Send, Store, UserRound, Users, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { TextInput } from "@/components/v2/form/fields";
import { Switch } from "@/components/v2/settings/financeKit";
import ListItemDialogV2, { type ListField } from "@/components/v2/settings/ListItemDialogV2";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { FIELD_MODES } from "@/constants/settingsFields";
import { DEFAULT_LEAD_SETTINGS, type LeadSettings, type LeadYonalish } from "@/lib/leadSettings";

// YANGI VERSIYA — SOZLAMALAR → LIDLAR → «LID SOZLAMALARI» (40-qism, rasmlar «Lid sozlamalari · yo'nalish va
// ro'yxatlar / belgi va teglar / forma maydonlari»).
//   1) Yo'nalish va ro'yxatlar — so'rovnoma yo'nalishlari (fanlar, «So'rovnomada»), daraja bosqichlari, qulay vaqtlar,
//      sinflar, lid «Rad etdi» sabablari. Saqlash — eski Lidlar tabi bilan bir hujjat (/api/lead-settings, PUT),
//      har o'zgarish darhol; sonlar — shu oy lidlarda (/api/lead-settings/stats). O'ngda so'rovnoma ko'rinishi.
//   2) Belgi va teglar — telefon raqami belgilari va hashtaglar (/api/settings-lists; saqlanadi, lid kartasida hali
//      chiqmaydi — SAVOLLAR 531), o'quvchi turlari — O'quv bo'limi → Kategoriya.
//   3) Forma maydonlari — «sale-marketing.field» (o'quvchi / buyurtma / birinchi dars); formalar hali o'qimaydi.

type Tab = "royxatlar" | "teglar" | "maydonlar";
type Stats = { ok: true; month: string; leads: number; course: Record<string, number>; yonalish: Record<string, number>; vaqt: Record<string, number>; sinf: Record<string, number>; rad: Record<string, number>; categories: { name: string; pupils: number }[]; noCategory: number };
type ListRow = { id: number; name: string; emoji?: string; color?: string };

const YON_ICON = { fan: BookOpen, til: MessageSquare, pm: GraduationCap } as const;
const YON_TONE = { fan: "bg-v2-warning-bg text-v2-warning", til: "bg-v2-info-bg text-v2-info", pm: "bg-v2-brand-bg text-v2-brand" } as const;

function Card({ icon: Icon, tone = "bg-v2-brand-bg text-v2-brand", title, sub, children, aside }: { icon: typeof Info; tone?: string; title: React.ReactNode; sub?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${tone}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-v2-text">{title}</h2>
          {sub && <p className="text-v2-small text-v2-text-2">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Chip({ label, count, onRemove, removeLabel }: { label: string; count?: number; onRemove?: () => void; removeLabel: string }) {
  return (
    <span className="group inline-flex items-center gap-1.5 rounded-full border border-v2-border bg-v2-surface px-3 py-1 text-v2-small text-v2-text">
      {label}
      {!!count && <span className="rounded-full bg-v2-surface-2 px-1.5 text-v2-caption tabular-nums text-v2-text-2">{count}</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`${removeLabel}: ${label}`} className="-mr-1 flex size-4 items-center justify-center rounded-full text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-danger">
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** «+ Qo'shish» chipi — bosilganda kichik maydon ochiladi, Enter bilan qo'shadi. */
function AddChip({ label, onAdd }: { label: string; onAdd: (v: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-v2-brand/50 px-3 py-1 text-v2-small font-semibold text-v2-brand">
        <Plus className="size-3.5" aria-hidden /> {label}
      </button>
    );
  const done = () => {
    if (v.trim()) onAdd(v.trim());
    setV("");
    setOpen(false);
  };
  return (
    <span className="inline-flex w-48">
      <TextInput
        autoFocus
        value={v}
        maxLength={60}
        aria-label={label}
        placeholder={t("Nomi va Enter")}
        onChange={(e) => setV(e.target.value)}
        onBlur={done}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            done();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
    </span>
  );
}

function ListRows({ items, counts, onEdit, onRemove, icon: Icon, removeLabel, editLabel }: { items: string[]; counts: Record<string, number>; onEdit: (i: number) => void; onRemove: (i: number) => void; icon: typeof Info; removeLabel: string; editLabel: string }) {
  return (
    <ul className="divide-y divide-v2-border">
      {items.map((x, i) => (
        <li key={x} className="flex items-center gap-2 py-2">
          <Icon className="size-4 shrink-0 text-v2-text-3" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-v2-small font-semibold text-v2-text">{x}</span>
          {!!counts[x] && <span className="text-v2-caption tabular-nums text-v2-text-2">{counts[x]}</span>}
          <button type="button" onClick={() => onEdit(i)} aria-label={editLabel} className="flex size-7 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
            <Pencil className="size-3.5" aria-hidden />
          </button>
          <button type="button" onClick={() => onRemove(i)} aria-label={removeLabel} className="flex size-7 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function LeadSettingsV2({ initialTab = "royxatlar" }: { initialTab?: Tab }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [s, setS] = useState<LeadSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const { data: st } = useReportData<Stats>("/api/lead-settings/stats");
  const [saving, setSaving] = useState(false);
  const [reset, setReset] = useState(false);
  const [rename, setRename] = useState<{ title: string; value: string; apply: (v: string) => LeadSettings } | null>(null);
  const [yonEdit, setYonEdit] = useState<LeadYonalish | null>(null);

  useEffect(() => {
    let off = false;
    fetch("/api/lead-settings")
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (d?.ok) setS(d.settings as LeadSettings);
        else setFailed(true);
      })
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, []);

  async function save(next: LeadSettings, msg = "Saqlandi") {
    setSaving(true);
    const r = await fetch("/api/lead-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: next }) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    setS(r.settings as LeadSettings);
    showSuccess(t(msg));
  }

  const switchTab = (k: Tab) => {
    setTab(k);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", k);
    window.history.replaceState(null, "", u);
  };

  if (failed) return <div className="p-6"><NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar></div>;
  if (!s)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );

  const c = (k: keyof Omit<Stats, "ok" | "month" | "leads" | "categories" | "noCategory">) => (st ? st[k] : {});
  const monthL = st ? fmt.monthLower(st.month) : "";
  const setYon = (id: string, patch: Partial<LeadYonalish>) => save({ ...s, yonalishlar: s.yonalishlar.map((y) => (y.id === id ? { ...y, ...patch } : y)) });
  const listEdit = (key: "vaqtlar" | "sinflar" | "radSabablar" | "bosqichlar", i: number, title: string) =>
    setRename({ title, value: s[key][i], apply: (v) => ({ ...s, [key]: s[key].map((x, j) => (j === i ? v : x)) }) });
  const listRemove = (key: "vaqtlar" | "sinflar" | "radSabablar" | "bosqichlar", i: number) => {
    if (s[key].length <= (key === "bosqichlar" ? 2 : 1)) return showError(t("Ro'yxatda kamida bitta qiymat qolishi kerak"));
    void save({ ...s, [key]: s[key].filter((_, j) => j !== i) }, "O'chirildi");
  };
  const listAdd = (key: "vaqtlar" | "sinflar" | "radSabablar" | "bosqichlar", v: string) => {
    if (s[key].includes(v)) return showError(t("Bu qiymat ro'yxatda bor"));
    void save({ ...s, [key]: [...s[key], v] }, "Qo'shildi");
  };
  const firstYon = s.yonalishlar.find((y) => y.yoqilgan) ?? s.yonalishlar[0];

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("Lidlar")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Lid sozlamalari")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Birinchi dars so'rovnomasi va Lidlar sahifasidagi ro'yxatlar, lid kartasidagi belgi va teglar, formalarda so'raladigan maydonlar.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "royxatlar" && (
            <button type="button" onClick={() => setReset(true)} className="inline-flex h-9 items-center gap-1.5 px-2 text-v2-small font-semibold text-v2-text-2 hover:text-v2-text">
              <RotateCcw className="size-4" aria-hidden /> {t("Standartga qaytarish")}
            </button>
          )}
          <a href="/sorovnoma" target="_blank" rel="noreferrer" className={secondaryBtn}>
            <ArrowUpRight className="size-4" aria-hidden /> {t("So'rovnomani ochish")}
          </a>
        </div>
      </div>
      <div role="tablist" aria-label={t("Lid sozlamalari bo'limlari")} className="inline-flex flex-wrap gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
        {(
          [
            ["royxatlar", t("Yo'nalish va ro'yxatlar")],
            ["teglar", t("Belgi va teglar")],
            ["maydonlar", t("Forma maydonlari")],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} className={`h-8 rounded-v2-sm px-3 text-v2-small font-semibold ${tab === k ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "royxatlar" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Card icon={LayoutGrid} title={`${t("Yo'nalishlar")} · ${s.yonalishlar.length}`} sub={t("So'rovnomada plitka bo'lib chiqadi, kurslar — keyingi savolda. Raqam — {m}da shu kursni so'ragan lidlar", { m: monthL })}>
              <div className="divide-y divide-v2-border">
                {s.yonalishlar.map((y) => {
                  const Icon = YON_ICON[y.id];
                  const groups = [...new Set(y.fanlar.map((f) => f.guruh ?? ""))];
                  return (
                    <div key={y.id} className={`py-4 first:pt-0 last:pb-0 ${y.yoqilgan ? "" : "opacity-60"}`}>
                      <div className="flex flex-wrap items-start gap-3">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-v2-md ${YON_TONE[y.id]}`}>
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-v2-text">{t(y.nom)}</span>
                            <span className={`rounded-v2-sm px-1.5 text-v2-caption font-semibold ${y.id === "til" ? "bg-v2-info-bg text-v2-info" : "bg-v2-surface-2 text-v2-text-2"}`}>{y.id === "til" ? t("daraja so'raladi") : t("sinf so'raladi")}</span>
                          </div>
                          <div className="text-v2-small text-v2-text-2">
                            «{t(y.savol)}» · {t("{n} ta kurs", { n: y.fanlar.length })} · {t("{m}da {n} lid", { m: monthL, n: c("yonalish")[y.id] ?? 0 })}
                          </div>
                        </div>
                        <span className="text-v2-small text-v2-text-2">{t("So'rovnomada")}</span>
                        <Switch on={y.yoqilgan} label={t("So'rovnomada")} disabled={saving} onChange={(v) => void setYon(y.id, { yoqilgan: v })} />
                        <button type="button" onClick={() => setYonEdit(y)} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                          <Pencil className="size-4" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-3 space-y-2 pl-11">
                        {groups.map((g) => (
                          <div key={g || "-"}>
                            {g && <div className="mb-1.5 text-v2-caption text-v2-text-2">{t(g)}</div>}
                            <div className="flex flex-wrap gap-2">
                              {y.fanlar
                                .filter((f) => (f.guruh ?? "") === g)
                                .map((f) => (
                                  <Chip
                                    key={f.nom}
                                    label={t(f.nom)}
                                    count={c("course")[f.nom]}
                                    removeLabel={t("O'chirish")}
                                    onRemove={y.fanlar.length > 1 ? () => void setYon(y.id, { fanlar: y.fanlar.filter((x) => x.nom !== f.nom) }) : undefined}
                                  />
                                ))}
                              {g === groups[groups.length - 1] && <AddChip label={t("Kurs")} onAdd={(v) => (y.fanlar.some((x) => x.nom === v) ? showError(t("Bu qiymat ro'yxatda bor")) : void setYon(y.id, { fanlar: [...y.fanlar, g ? { nom: v, guruh: g } : { nom: v }] }))} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card icon={BarChart3} tone="bg-v2-info-bg text-v2-info" title={`${t("Chet tili darajalari")} · ${s.bosqichlar.length}`} sub={t("So'rovnomada slayder shu bosqichlar bo'ylab suriladi · birinchisi — «0 dan»")}>
              <ol className="flex flex-wrap gap-2">
                {s.bosqichlar.map((b, i) => (
                  <li key={b} className="inline-flex items-center gap-1.5 rounded-full border border-v2-border px-3 py-1 text-v2-small text-v2-text">
                    <span className={`size-2 rounded-full ${i === 0 ? "bg-v2-brand" : "bg-v2-border-strong"}`} />
                    <button type="button" onClick={() => listEdit("bosqichlar", i, t("Bosqich"))} className="hover:text-v2-brand">
                      {b}
                    </button>
                    {i > 0 && (
                      <button type="button" onClick={() => listRemove("bosqichlar", i)} aria-label={t("O'chirish")} className="text-v2-text-3 hover:text-v2-danger">
                        <X className="size-3" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
                <AddChip label={t("Bosqich")} onAdd={(v) => listAdd("bosqichlar", v)} />
              </ol>
              <p className="mt-3 text-v2-small text-v2-text-2">{t("«Bilmayman — daraja testi topshiraman» varianti doim chiqadi")}</p>
            </Card>
            <Card icon={ArrowUpRight} tone="bg-v2-surface-2 text-v2-text-2" title={t("Boshqa joyda sozlanadi")} sub={t("So'rovnomadagi qolgan savollar va lid qayerga tushishi")}>
              <ul className="divide-y divide-v2-border text-v2-small">
                {[
                  [Store, t("Filiallar"), t("«Qaysi filial?» — manzil va telefon Umumiy → Filiallar'dan olinadi"), "/management-filiallar"],
                  [Users, t("Manbalar"), t("«Bizni qayerdan bildingiz?» variantlari — Lidlar → Manbalar"), "/sales-sources"],
                  [Send, t("So'rovnoma sahifasi"), t("Havola, QR, ochiq/yopiq va matnlar"), "/settings-sales?tab=leads"],
                ].map(([I, a, b, href]) => {
                  const Ic = I as typeof Info;
                  return (
                    <li key={String(a)}>
                      <Link href={String(href)} className="flex items-center gap-3 py-2.5 hover:text-v2-brand">
                        <Ic className="size-4 shrink-0 text-v2-text-3" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-v2-text">{String(a)}</span>
                          <span className="block text-v2-text-2">{String(b)}</span>
                        </span>
                        <ArrowRight className="size-4 text-v2-text-3" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
          <div className="space-y-4">
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="font-semibold text-v2-text">{t("So'rovnomada shunday ko'rinadi")}</h2>
              <p className="text-v2-small text-v2-text-2">{t("birinchi darsga yozilish · 1-qadam")}</p>
              <div className="mt-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-3">
                <div className="text-v2-caption font-semibold text-v2-text-2">{t("Nimani o'rganmoqchisiz?")}</div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {s.yonalishlar
                    .filter((y) => y.yoqilgan)
                    .map((y) => (
                      <span key={y.id} className={`flex min-h-10 items-center justify-center rounded-v2-md border px-1 text-center text-[11px] font-semibold ${y.id === firstYon?.id ? "border-v2-brand bg-v2-brand-bg text-v2-brand" : "border-v2-border bg-v2-surface text-v2-text"}`}>
                        {t(y.nom)}
                      </span>
                    ))}
                </div>
                {firstYon && (
                  <>
                    <div className="mt-3 text-v2-caption font-semibold text-v2-text">{t(firstYon.savol)}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {firstYon.fanlar.slice(0, 6).map((f, i) => (
                        <span key={f.nom} className={`rounded-v2-sm border px-1.5 py-0.5 text-[11px] ${i === 0 ? "border-v2-brand bg-v2-brand-bg text-v2-brand" : "border-v2-border bg-v2-surface text-v2-text"}`}>
                          {t(f.nom)}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <Link href="/settings-sales?tab=leads" className="mt-3 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                {t("So'rovnoma sahifasi: havola, QR va matnlar")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </section>
            <Card icon={Clock} tone="bg-v2-surface-2 text-v2-text-2" title={`${t("Qulay vaqtlar")} · ${s.vaqtlar.length}`} sub={t("«Qaysi vaqt qulay?» savolining variantlari")}>
              <ListRows items={s.vaqtlar} counts={c("vaqt")} icon={Clock} removeLabel={t("O'chirish")} editLabel={t("Tahrirlash")} onEdit={(i) => listEdit("vaqtlar", i, t("Vaqt"))} onRemove={(i) => listRemove("vaqtlar", i)} />
              <div className="mt-2">
                <AddChip label={t("Vaqt")} onAdd={(v) => listAdd("vaqtlar", v)} />
              </div>
            </Card>
            <Card icon={GraduationCap} tone="bg-v2-surface-2 text-v2-text-2" title={`${t("Sinflar")} · ${s.sinflar.length}`} sub={t("Fanlar va Prezident maktabi yo'nalishida so'raladi")}>
              <div className="flex flex-wrap gap-1.5">
                {s.sinflar.map((x, i) => (
                  <Chip key={x} label={x} count={c("sinf")[x]} removeLabel={t("O'chirish")} onRemove={() => listRemove("sinflar", i)} />
                ))}
                <AddChip label={t("Sinf")} onAdd={(v) => listAdd("sinflar", v)} />
              </div>
            </Card>
            <Card icon={X} tone="bg-v2-danger-bg text-v2-danger" title={`${t("Rad etish sabablari")} · ${s.radSabablar.length}`} sub={t("Lid kartasidagi «Rad etdi» oynasida · soni — {m}", { m: monthL })}>
              <ListRows items={s.radSabablar} counts={c("rad")} icon={MessageSquare} removeLabel={t("O'chirish")} editLabel={t("Tahrirlash")} onEdit={(i) => listEdit("radSabablar", i, t("Sabab"))} onRemove={(i) => listRemove("radSabablar", i)} />
              <div className="mt-2">
                <AddChip label={t("Sabab")} onAdd={(v) => listAdd("radSabablar", v)} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "teglar" && <TagsTab stats={st ?? null} />}
      {tab === "maydonlar" && <FieldsTab />}

      {reset && (
        <V2Confirm
          tone="brand"
          icon={RotateCcw}
          title={t("Standartga qaytarasizmi?")}
          body={t("Yo'nalishlar, kurslar, bosqichlar, vaqtlar, sinflar va rad sabablari boshlang'ich ro'yxatga qaytadi.")}
          confirmLabel={t("Qaytarish")}
          onConfirm={() => {
            setReset(false);
            void save(DEFAULT_LEAD_SETTINGS, "Standart ro'yxat tiklandi");
          }}
          onCancel={() => setReset(false)}
        />
      )}
      {rename && <RenameDialog title={rename.title} value={rename.value} onClose={() => setRename(null)} onSave={(v) => void save(rename.apply(v)).then(() => setRename(null))} />}
      {yonEdit && <RenameDialog title={t("Yo'nalish")} value={yonEdit.nom} second={{ label: t("Savol"), value: yonEdit.savol }} onClose={() => setYonEdit(null)} onSave={(v, q) => void setYon(yonEdit.id, { nom: v, savol: q || yonEdit.savol }).then(() => setYonEdit(null))} />}
    </div>
  );
}

function RenameDialog({ title, value, second, onClose, onSave }: { title: string; value: string; second?: { label: string; value: string }; onClose: () => void; onSave: (v: string, second?: string) => void }) {
  const { t } = useT();
  const [v, setV] = useState(value);
  const [q, setQ] = useState(second?.value ?? "");
  return (
    <V2Confirm
      tone="brand"
      icon={Pencil}
      title={title}
      body={
        <div className="mt-2 space-y-2 text-left">
          <TextInput value={v} onChange={(e) => setV(e.target.value)} maxLength={60} aria-label={title} />
          {second && <TextInput value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} aria-label={second.label} placeholder={second.label} />}
        </div>
      }
      confirmLabel={t("Saqlash")}
      onConfirm={() => (v.trim() ? onSave(v.trim(), q.trim()) : undefined)}
      onCancel={onClose}
    />
  );
}

const COLOR_NAMES: Record<string, string> = { "#0f766e": "feruza", "#2563eb": "ko'k", "#7c3aed": "binafsha", "#6b7280": "kulrang", "#dc2626": "qizil", "#16a34a": "yashil", "#d97706": "sariq" };

function TagsTab({ stats }: { stats: Stats | null }) {
  const { t } = useT();
  const { showError } = useToast();
  const { data: colors, reload: rc } = useReportData<{ ok: true; items: ListRow[] }>("/api/settings-lists?kind=lead-colors");
  const { data: tags, reload: rt } = useReportData<{ ok: true; items: ListRow[] }>("/api/settings-lists?kind=hashtags");
  const [edit, setEdit] = useState<ListRow | "new" | null>(null);
  async function addTag(v: string) {
    const name = v.startsWith("#") ? v : `#${v.replace(/\s+/g, "_")}`;
    const r = await fetch("/api/settings-lists?kind=hashtags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) showError(t(r?.error || "Saqlab bo'lmadi"));
    rt();
  }
  async function del(kind: string, id: number, reload: () => void) {
    const r = await fetch(`/api/settings-lists/${id}?kind=${kind}`, { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) showError(t(r?.error || "O'chirib bo'lmadi"));
    reload();
  }
  const fields: ListField[] = [
    { key: "name", label: "Nomi", kind: "text", placeholder: "Masalan: Onasi" },
    { key: "emoji", label: "Belgi (emoji)", kind: "text", optional: true, placeholder: "👩", max: 4 },
    { key: "color", label: "Rangi", kind: "segment", options: Object.entries(COLOR_NAMES).map(([value, label]) => ({ value, label })) },
  ];
  const total = (stats?.categories ?? []).reduce((a, x) => a + x.pupils, 0) + (stats?.noCategory ?? 0);
  return (
    <div className="space-y-4">
      <NoticeBar>{t("Raqam belgilari va hashtaglar saqlanadi, lekin lid va o'quvchi kartasida hali tanlanmaydi — kartaga ulash keyingi bosqichda.")}</NoticeBar>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card icon={Phone} title={`${t("Telefon raqami belgilari")} · ${colors?.items.length ?? 0}`} sub={t("Har raqam kimniki — kartada rangli belgi")}>
          <ul className="divide-y divide-v2-border">
            {(colors?.items ?? []).map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: x.color || "#6b7280" }} aria-hidden />
                <span className="min-w-0 flex-1 text-v2-small font-semibold text-v2-text">
                  {x.emoji ? `${x.emoji} ` : ""}
                  {x.name}
                </span>
                <span className="text-v2-caption text-v2-text-2">{t(COLOR_NAMES[String(x.color ?? "").toLowerCase()] ?? "")}</span>
                <button type="button" onClick={() => setEdit(x)} aria-label={t("Tahrirlash")} className="flex size-7 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                  <Pencil className="size-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => void del("lead-colors", x.id, rc)} aria-label={t("O'chirish")} className="flex size-7 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            {!colors?.items.length && <li className="py-4 text-center text-v2-small text-v2-text-3">{t("Belgi qo'shilmagan")}</li>}
          </ul>
          <button type="button" onClick={() => setEdit("new")} className={`${secondaryBtn} mt-3`}>
            <Plus className="size-4" aria-hidden /> {t("Belgi qo'shish")}
          </button>
        </Card>
        <div className="space-y-4">
          <Card icon={Hash} tone="bg-v2-info-bg text-v2-info" title={`${t("Hashtaglar")} · ${tags?.items.length ?? 0}`} sub={t("Lid va o'quvchiga qo'yiladi, ro'yxatlarda filtr bo'ladi")}>
            <div className="flex flex-wrap gap-2">
              {(tags?.items ?? []).map((x) => (
                <Chip key={x.id} label={x.name} removeLabel={t("O'chirish")} onRemove={() => void del("hashtags", x.id, rt)} />
              ))}
              <AddChip label={t("Hashtag")} onAdd={(v) => void addTag(v)} />
            </div>
          </Card>
          <Card
            icon={UserRound}
            tone="bg-v2-warning-bg text-v2-warning"
            title={`${t("O'quvchi turlari")} · ${stats?.categories.length ?? 0}`}
            sub={t("O'quvchi kartasida bitta tur tanlanadi — ro'yxat O'quv bo'limi → Kategoriya'da")}
            aside={
              <Link href="/edu-category" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                {t("Tahrirlash")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            <ul className="divide-y divide-v2-border text-v2-small">
              {(stats?.categories ?? []).map((x) => (
                <li key={x.name} className="flex justify-between py-2">
                  <span className="font-semibold text-v2-text">{x.name}</span>
                  <span className="tabular-nums text-v2-text">{x.pupils}</span>
                </li>
              ))}
              {!!stats?.noCategory && (
                <li className="flex justify-between py-2 text-v2-text-2">
                  <span>{t("Tur tanlanmagan")}</span>
                  <span className="tabular-nums">{stats.noCategory}</span>
                </li>
              )}
              <li className="flex justify-between bg-v2-surface-2 px-2 py-2 font-semibold text-v2-text">
                <span>{t("Jami")}</span>
                <span className="tabular-nums">{total}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
      {edit && (
        <ListItemDialogV2
          kind="lead-colors"
          id={edit === "new" ? undefined : edit.id}
          title={edit === "new" ? t("Belgi qo'shish") : t("Belgini tahrirlash")}
          fields={fields}
          initial={edit === "new" ? { name: "", emoji: "", color: "#0f766e" } : { name: edit.name, emoji: edit.emoji ?? "", color: String(edit.color ?? "#0f766e").toLowerCase() }}
          onClose={() => setEdit(null)}
          onDone={rc}
        />
      )}
    </div>
  );
}

type FieldValues = Record<string, Record<string, boolean>>;
const FIELD_KEY = "sale-marketing.field";
const MODES = FIELD_MODES as { key: string; label: string; fields: { key: string; label: string; default: boolean }[] }[];

function FieldsTab() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [mode, setMode] = useState(MODES[0].key);
  const [vals, setVals] = useState<FieldValues | null>(null);
  useEffect(() => {
    let off = false;
    fetch(`/api/settings?key=${encodeURIComponent(FIELD_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        const saved = (d?.values ?? {}) as FieldValues;
        const out: FieldValues = {};
        for (const m of MODES) out[m.key] = Object.fromEntries(m.fields.map((f) => [f.key, typeof saved[m.key]?.[f.key] === "boolean" ? saved[m.key][f.key] : f.default]));
        setVals(out);
      })
      .catch(() => null);
    return () => {
      off = true;
    };
  }, []);
  async function toggle(fk: string, v: boolean) {
    if (!vals) return;
    const next = { ...vals, [mode]: { ...vals[mode], [fk]: v } };
    setVals(next);
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: FIELD_KEY, values: next }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) {
      setVals(vals);
      return showError(t(r?.error || "Saqlab bo'lmadi"));
    }
    showSuccess(t("Saqlandi"));
  }
  if (!vals)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const m = MODES.find((x) => x.key === mode) ?? MODES[0];
  const on = m.fields.filter((f) => vals[mode]?.[f.key]).length;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card icon={UserRound} title={t("Formada so'raladigan maydonlar")} sub={t("Yoqilgan maydonlar qo'shish oynasida chiqadi · {a} / {b} yoqilgan", { a: on, b: m.fields.length })}>
        <div role="tablist" className="mb-3 inline-flex flex-wrap gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
          {MODES.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={mode === x.key} onClick={() => setMode(x.key)} className={`h-8 rounded-v2-sm px-3 text-v2-small font-semibold ${mode === x.key ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {t(x.label)}
            </button>
          ))}
        </div>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {mode === "student" && (
            <li className="flex items-center gap-3 border-b border-v2-border py-2.5 text-v2-small text-v2-text-2">
              <span className="min-w-0 flex-1 font-semibold text-v2-text">{t("Ism")}</span> {t("doim · majburiy")}
            </li>
          )}
          {m.fields.map((f) => (
            <li key={f.key} className="flex items-center gap-3 border-b border-v2-border py-2.5">
              <span className={`min-w-0 flex-1 text-v2-small ${vals[mode]?.[f.key] ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{t(f.label)}</span>
              <Switch on={!!vals[mode]?.[f.key]} label={t(f.label)} onChange={(v) => void toggle(f.key, v)} />
            </li>
          ))}
        </ul>
      </Card>
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
        <h2 className="font-semibold text-v2-text">{t("Hozirgi holat")}</h2>
        <p className="mt-1 text-v2-small text-v2-text-2">{t("Tanlov saqlanadi, lekin o'quvchi va lid qo'shish oynalari hali o'z maydonlari bilan ochiladi — formaga ulash keyingi bosqichda.")}</p>
        <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Ism va Manba doim so'raladi — ularni o'chirib bo'lmaydi.")}
        </div>
      </section>
    </div>
  );
}
