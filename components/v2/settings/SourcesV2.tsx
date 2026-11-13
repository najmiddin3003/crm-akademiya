"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Camera,
  Globe,
  Info,
  Loader2,
  Lock,
  Megaphone,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Send,
  SquareArrowOutUpRight,
  ThumbsUp,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { BOT_SOURCE, SURVEY_SOURCE } from "@/lib/leadSettings";
import { conversionPct, type SourceCount, type SourcePeriod } from "@/lib/sourceStats";

// YANGI VERSIYA — SOZLAMALAR → LIDLAR → «MANBALAR» (rasm «Sozlamalar · Manbalar»,
// yorug'/qorong'i, 24-qism, 13.11.2026; `/sales-sources`, eski «O'quvchilar oqimi»
// diagrammasi `?view=old` da qoldi).
//
//   • Ro'yxat — `student_sources` (o'quvchi formasi, so'rovnomadagi «Qayerdan bildingiz?»,
//     bot) + tizim kanallari «Sayt so'rovnomasi», «Telegram bot» (lid o'zi yoziladi) +
//     lidlarda uchragan, ro'yxatda yo'q qiymatlar (eski «Sayt», qo'lda yozilgan) +
//     «Ko'rsatilmagan». Har lid BITTA qatorda (lib/sourceStats.ts → leadManbaOf).
//   • «Lid → o'quvchi» — davr (bu oy / o'tgan oy / butun davr) lidlaridan nechtasi
//     «Guruhga qo'shildi»; ostida o'quvchi kartalarida shu manba (butun davr).
//   • Turi «Pullik/Bepul» — belgi (kassa «Reklama» chiqimi bilan bog'lanish hali yo'q).
//   • Holat — Faol/Nofaol: nofaol yangi tanlovlarda chiqmaydi, eskilarda saqlanadi;
//     O'chirish — faqat hech qayerda ishlatilmagan manbaga.
// API: GET /api/student-sources?view=leads&period=…, yozish —
// /api/student-sources/options/manage (POST / PATCH { name | active | paid } / DELETE).

const th = "bg-v2-surface-2 px-3 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
const MANAGE = "/api/student-sources/options/manage";

interface SourceOpt {
  id: number;
  name: string;
  system?: boolean;
  active?: boolean;
  paid?: boolean;
}

interface LeadsView {
  period: SourcePeriod;
  bounds: { from: string; to: string } | null;
  options: SourceOpt[];
  leads: SourceCount[];
  total: { leads: number; students: number };
  pupils: { name: string; n: number }[];
  usedNames: string[];
}

type RowKind = "option" | "survey" | "bot" | "extra" | "none";

interface Row {
  key: string;
  kind: RowKind;
  name: string;
  opt: SourceOpt | null;
  leads: number;
  students: number;
  pupils: number;
}

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

function iconOf(kind: RowKind, name: string): IconType {
  if (kind === "survey") return Globe;
  if (kind === "bot") return Send;
  const n = name.toLowerCase();
  if (n.includes("insta")) return Camera;
  if (n.includes("telegram")) return Send;
  if (n.includes("facebook")) return ThumbsUp;
  if (n.includes("youtube") || n.includes("tiktok")) return Play;
  if (n.includes("sayt") || n.includes("veb") || n.includes("web")) return Globe;
  if (n.includes("banner") || n.includes("flyer") || n.includes("flayer") || n.includes("varaq")) return Newspaper;
  if (n.includes("tavsiya") || n.includes("tanish") || n.includes("referal") || n.includes("do'st")) return Users;
  return Megaphone;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

async function send(method: "POST" | "PATCH" | "DELETE", body?: object, query = ""): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(MANAGE + query, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json().catch(() => null);
    return d?.ok ? { ok: true } : { ok: false, error: String(d?.error || "Saqlanmadi") };
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

export default function SourcesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { branchId, branches } = useBranch();
  const [period, setPeriod] = useState<SourcePeriod>("month");
  const [data, setData] = useState<LeadsView | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  /** Javob qaysi so'rovniki ("month:0") — farq qilsa, yangisi yuklanmoqda. */
  const [loadedKey, setLoadedKey] = useState("");
  const [form, setForm] = useState<null | { opt: SourceOpt | null }>(null);
  const [del, setDel] = useState<SourceOpt | null>(null);
  const key = `${period}:${version}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let off = false;
    fetch(`/api/student-sources?view=leads&period=${period}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (off) return;
        if (!r.ok || !d?.ok) setError(String(d?.error || "Ma'lumot yuklanmadi"));
        else {
          setData(d as LeadsView);
          setError("");
        }
        setLoadedKey(`${period}:${version}`);
      })
      .catch(() => {
        if (off) return;
        setError("Serverga ulanib bo'lmadi");
        setLoadedKey(`${period}:${version}`);
      });
    return () => {
      off = true;
    };
  }, [period, version]);
  const reload = () => setVersion((v) => v + 1);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const leadMap = new Map(data.leads.map((r) => [r.name, r]));
    const pupilMap = new Map<string, number>();
    for (const p of data.pupils) pupilMap.set(p.name, (pupilMap.get(p.name) ?? 0) + p.n);
    const used = new Set<string>();
    const make = (key: string, kind: RowKind, name: string, opt: SourceOpt | null): Row => {
      used.add(name);
      const l = leadMap.get(name);
      return { key, kind, name, opt, leads: l?.leads ?? 0, students: l?.students ?? 0, pupils: kind === "option" || kind === "extra" ? pupilMap.get(name) ?? 0 : 0 };
    };
    const out: Row[] = data.options.map((o) => make(`o${o.id}`, "option", o.name, o));
    out.push(make("survey", "survey", SURVEY_SOURCE, null), make("bot", "bot", BOT_SOURCE, null));
    const extras = data.leads.filter((r) => r.name && !used.has(r.name));
    for (const r of extras) out.push(make(`x:${r.name}`, "extra", r.name, null));
    const none = leadMap.get("");
    if (none) out.push({ key: "none", kind: "none", name: "", opt: null, leads: none.leads, students: none.students, pupils: 0 });
    return out;
  }, [data]);

  const maxLeads = Math.max(1, ...rows.map((r) => r.leads));
  const paidCount = data ? data.options.filter((o) => o.paid && o.active !== false).length : 0;
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
  const periodText = data?.bounds ? `${ddmm(data.bounds.from)} – ${ddmm(data.bounds.to)}.${data.bounds.to.slice(0, 4)}` : t("butun davr");

  async function patch(opt: SourceOpt, body: object, message: string) {
    const r = await send("PATCH", { id: opt.id, ...body });
    if (!r.ok) return showError(t(r.error));
    showSuccess(message);
    reload();
  }

  const menuOf = (r: Row): ActionMenuEntry[] => {
    const o = r.opt;
    if (!o) return [];
    const active = o.active !== false;
    const inUse = data?.usedNames.includes(o.name) ?? true;
    const items: ActionMenuEntry[] = [
      {
        key: "active",
        label: active ? t("Nofaol qilish") : t("Faollashtirish"),
        icon: Power,
        disabled: Boolean(o.system),
        onSelect: () =>
          void patch(o, { active: !active }, active ? t("«{name}» nofaol — yangi tanlovlarda chiqmaydi", { name: o.name }) : t("«{name}» yana faol", { name: o.name })),
      },
    ];
    if (!o.system) {
      items.push({ key: "d", divider: true });
      items.push({ key: "del", label: inUse ? t("O'chirib bo'lmaydi — ishlatilgan") : t("O'chirish"), icon: Trash2, danger: !inUse, disabled: inUse, onSelect: () => setDel(o) });
    }
    return items;
  };

  const typeChip = (paid: boolean) => (
    <span
      className={`inline-flex whitespace-nowrap rounded-v2-sm border px-1.5 py-px text-v2-caption font-medium ${
        paid ? "border-v2-warning/30 bg-v2-warning-bg text-v2-warning" : "border-v2-border bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {paid ? t("Pullik") : t("Bepul")}
    </span>
  );

  const howCell = (r: Row) => {
    if (r.kind === "survey" || r.kind === "bot") {
      return (
        <>
          <span className="flex items-center gap-1 text-v2-small text-v2-text">
            <Zap className="size-3.5 shrink-0 text-v2-brand-text" strokeWidth={1.75} aria-hidden />
            {t("Avtomatik")} · <span className="font-semibold">{r.kind === "survey" ? t("So'rovnoma sahifasi") : t("O'quvchilar boti")}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-v2-caption font-normal text-v2-text-3">
            <Lock className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
            {t("tizim manbasi · «Qayerdan bildingiz?» javobi «Boshqa» bo'lsa")}
          </span>
        </>
      );
    }
    if (r.kind === "extra") return <span className="text-v2-small text-v2-text-2">{t("Ro'yxatda yo'q — eski yozuv yoki qo'lda yozilgan")}</span>;
    if (r.kind === "none") return <span className="text-v2-small text-v2-text-2">{t("Qo'lda qo'shilgan lid — o'quvchi kartasi bo'lmagan")}</span>;
    const active = r.opt?.active !== false;
    return (
      <>
        <span className="block text-v2-small text-v2-text">{t("Qo'lda — o'quvchi kartasida tanlanadi")}</span>
        <span className="mt-0.5 block text-v2-caption font-normal text-v2-text-3">
          {active ? t("va so'rovnoma / botdagi «Qayerdan bildingiz?»da") : t("nofaol — yangi tanlovlarda chiqmaydi")}
        </span>
      </>
    );
  };

  const nameOf = (r: Row) => (r.kind === "none" ? t("Ko'rsatilmagan") : t(r.name));

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[44rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Lidlar")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Manbalar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Lid qayerdan kelgani. O'quvchi formasidagi «Manba», so'rovnoma va botdagi «Qayerdan bildingiz?» va lid hisobi shu ro'yxatdan olinadi.")}
          </p>
        </div>
        <button type="button" onClick={() => setForm({ opt: null })} className={primaryBtn}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Manba qo'shish")}
        </button>
      </div>

      {error && !data ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(error)}</p>
          <button type="button" onClick={reload} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <section className="shrink-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("Manbalar")}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
              {t("Lid → o'quvchi")}
              {loading && data && <Loader2 className="size-4 animate-spin text-v2-text-3" strokeWidth={2} aria-hidden />}
            </h2>
            <div className="w-full min-[30rem]:w-[300px]">
              <Segmented
                value={period}
                onChange={(v) => setPeriod(v as SourcePeriod)}
                label={t("Davr")}
                options={[
                  { value: "month", label: t("Bu oy") },
                  { value: "prev", label: t("O'tgan oy") },
                  { value: "all", label: t("Butun davr") },
                ]}
              />
            </div>
          </div>
          <div className="relative overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[54rem] border-collapse">
              <thead>
                <tr>
                  <th className={`${th} pl-4`}>{t("Manba")}</th>
                  <th className={`${th} w-[92px]`}>{t("Turi")}</th>
                  <th className={`${th} w-[30%]`}>{t("Qanday yoziladi")}</th>
                  <th className={`${th} w-[180px]`}>{t("Lid → o'quvchi")}</th>
                  <th className={`${th} w-[104px]`}>{t("Holat")}</th>
                  <th className={`${th} w-[84px] pr-3`}>
                    <span className="sr-only">{t("Amallar")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!data &&
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="h-[58px] border-b border-v2-border" aria-hidden>
                      <td className="pl-4 pr-3">
                        <div className="h-3 w-32 rounded bg-v2-skeleton" />
                      </td>
                      <td className="px-3">
                        <div className="h-5 w-14 rounded bg-v2-skeleton" />
                      </td>
                      <td className="px-3">
                        <div className="h-3 w-44 rounded bg-v2-skeleton" />
                      </td>
                      <td className="px-3">
                        <div className="h-3 w-24 rounded bg-v2-skeleton" />
                      </td>
                      <td className="px-3">
                        <div className="h-3 w-12 rounded bg-v2-skeleton" />
                      </td>
                      <td />
                    </tr>
                  ))}
                {rows.map((r) => {
                  const Icon = iconOf(r.kind, r.name);
                  const active = r.kind !== "option" || r.opt?.active !== false;
                  const muted = r.kind === "extra" || r.kind === "none";
                  const pct = conversionPct(r.students, r.leads);
                  const locked = r.kind === "survey" || r.kind === "bot";
                  return (
                    <tr key={r.key} className={`border-b border-v2-border last:border-b-0 ${active && !muted ? "" : "opacity-70"}`}>
                      <td className="py-2.5 pl-4 pr-3">
                        <span className="flex items-center gap-2.5">
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-text-2" aria-hidden>
                            <Icon className="size-4" strokeWidth={1.75} />
                          </span>
                          <span className={`truncate text-v2-small font-semibold ${muted ? "text-v2-text-2" : "text-v2-text"}`}>{nameOf(r)}</span>
                          {r.opt?.system && <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-label={t("Tizim manbasi — nomi o'zgarmaydi")} />}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{r.kind === "option" ? typeChip(Boolean(r.opt?.paid)) : locked ? typeChip(false) : <span className="text-v2-text-3">—</span>}</td>
                      <td className="px-3 py-2.5">{howCell(r)}</td>
                      <td className="px-3 py-2.5">
                        <span className="block text-v2-small tabular-nums text-v2-text">
                          <span className="font-semibold">{r.leads}</span>
                          <span className="text-v2-text-3"> → </span>
                          <span className="font-semibold">{r.students}</span>
                          {pct !== null && <span className="text-v2-text-2"> · {pct}%</span>}
                        </span>
                        <span className="mt-1 block h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-v2-brand-bg" aria-hidden>
                          <span className="block h-full rounded-full bg-v2-brand" style={{ width: `${Math.round((r.leads / maxLeads) * 100)}%`, opacity: r.leads ? 1 : 0 }} />
                        </span>
                        {r.pupils > 0 && (
                          <span className="mt-1 block text-v2-caption font-normal text-v2-text-3">{t("kartada {n} o'quvchi", { n: r.pupils })}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {muted ? (
                          <span className="text-v2-text-3">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text">
                            <span className={`size-1.5 rounded-full ${active ? "bg-v2-success" : "bg-v2-text-3"}`} aria-hidden />
                            {active ? t("Faol") : t("Nofaol")}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-1 pr-3 text-right">
                        {r.opt ? (
                          <span className="inline-flex items-center gap-0.5">
                            <button type="button" onClick={() => setForm({ opt: r.opt })} title={t("Tahrirlash")} aria-label={t("{name} — tahrirlash", { name: r.name })} className={iconBtn}>
                              <Pencil className="size-4" strokeWidth={1.75} />
                            </button>
                            <ActionMenu items={menuOf(r)} label={t("{name} — amallar", { name: r.name })} width={248}>
                              {(trigger, open) => (
                                <button type="button" {...trigger} title={t("Amallar")} aria-label={t("{name} — amallar", { name: r.name })} className={`${iconBtn} ${open ? "bg-v2-surface-2" : ""}`}>
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </ActionMenu>
                          </span>
                        ) : locked ? (
                          <span className="inline-flex size-8 items-center justify-center text-v2-text-3" title={t("Tizim manbasi — lid o'zi yoziladi")}>
                            <Lock className="size-4" strokeWidth={1.75} aria-label={t("Tizim manbasi — lid o'zi yoziladi")} />
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border bg-v2-surface-2 px-4 py-2.5 text-v2-caption font-normal text-v2-text-2">
              <span className="tabular-nums">
                {t("Jami {leads} lid → {students} o'quvchi", { leads: data.total.leads, students: data.total.students })}
                {" · "}
                {t("{n} ta pullik manba", { n: paidCount })}
                {branchName ? ` · ${branchName}` : ""}
                {" · "}
                {periodText}
              </span>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-1.5 text-v2-caption font-normal text-v2-text-2">
        <p className="flex items-start gap-1.5">
          <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Har lid bitta manbada: so'rovnoma va botda — odam tanlagan «Qayerdan bildingiz?» javobi, qo'lda qo'shilgan lidda — o'quvchi kartasidagi manba. «O'quvchi» — lid «Guruhga qo'shildi» holatida. Davr — lid kelgan sana bo'yicha.")}
        </p>
        <p className="flex items-start gap-1.5">
          <Power className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Ishlatilgan manba o'chirilmaydi — «Nofaol» qilinadi: yangi tanlovlarda chiqmaydi, eski lid va o'quvchilarda saqlanadi.")}
        </p>
        <p className="flex items-start gap-1.5">
          <Megaphone className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("«Pullik» hozircha belgi — kassadagi «Reklama» chiqimi bilan bog'lanish keyingi bosqichda.")}
        </p>
        <Link
          href="/sales-sources?view=old"
          className="inline-flex items-center gap-1.5 self-start text-v2-small text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline"
        >
          <SquareArrowOutUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t("O'quvchilar oqimi diagrammasi — eski ko'rinishda")}
        </Link>
      </div>

      {form && (
        <SourceDialog
          opt={form.opt}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            showSuccess(message);
            reload();
          }}
        />
      )}
      {del && (
        <V2Confirm
          title={t("«{name}» manbasini o'chirasizmi?", { name: del.name })}
          body={t("Hech qayerda ishlatilmagan — ro'yxatdan butunlay olib tashlanadi.")}
          confirmLabel={t("O'chirish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            const o = del;
            setDel(null);
            void (async () => {
              const r = await send("DELETE", undefined, `?id=${o.id}`);
              if (!r.ok) return showError(t(r.error));
              showSuccess(t("«{name}» o'chirildi", { name: o.name }));
              reload();
            })();
          }}
        />
      )}
    </div>
  );
}

function SourceDialog({ opt, onClose, onSaved }: { opt: SourceOpt | null; onClose: () => void; onSaved: (message: string) => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(opt?.name ?? "");
  const [paid, setPaid] = useState(Boolean(opt?.paid));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = Boolean(opt?.system);
  const dirty = opt ? name.trim() !== opt.name || paid !== Boolean(opt.paid) : Boolean(name.trim());

  async function submit() {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return setErr(t("Manba nomini kiriting"));
    setSaving(true);
    const body: Record<string, unknown> = { paid };
    if (!locked) body.name = clean;
    const r = opt ? await send("PATCH", { id: opt.id, ...body }) : await send("POST", body);
    setSaving(false);
    if (!r.ok) return setErr(t(r.error));
    onSaved(opt ? t("«{name}» saqlandi", { name: clean }) : t("«{name}» qo'shildi", { name: clean }));
    modal.close();
  }

  return (
    <V2Dialog
      title={opt ? t("Manbani tahrirlash") : t("Manba qo'shish")}
      subtitle={
        locked
          ? t("Tizim manbasi — nomi o'zgarmaydi")
          : opt
            ? t("Nom o'zgarsa, eski o'quvchi va lidlardagi yozuv ham yangilanadi")
            : t("O'quvchi formasida va so'rovnomadagi «Qayerdan bildingiz?»da chiqadi")
      }
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void submit()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {opt ? t("Saqlash") : t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="src-name" error={err || undefined}>
          <TextInput
            id="src-name"
            value={name}
            disabled={locked}
            onChange={(e) => {
              setName(e.target.value);
              if (err) setErr("");
            }}
            maxLength={60}
            placeholder={t("Masalan: Flayer")}
            autoComplete="off"
          />
        </Field>
        <Field label={t("Turi")}>
          <Segmented
            value={paid ? "paid" : "free"}
            onChange={(v) => setPaid(v === "paid")}
            label={t("Turi")}
            options={[
              { value: "free", label: t("Bepul") },
              { value: "paid", label: t("Pullik") },
            ]}
          />
        </Field>
        <p className="text-v2-caption font-normal text-v2-text-3">{t("«Pullik» — reklamaga pul sarflanadigan kanal (Instagram reklama, flayer). Hozircha belgi.")}</p>
      </div>
    </V2Dialog>
  );
}
