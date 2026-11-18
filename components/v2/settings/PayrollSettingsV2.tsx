"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Calculator, Check, CirclePlus, Loader2, Percent, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { Avatar, NoticeBar, TH, fmtNum } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { PayrollExample, PayrollKind, PayrollSettingsRow } from "@/lib/payrollSettings";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «OYLIK VA SOLIQ» (39-qism, rasm «Sozlamalar · Oylik va soliq»).
// Oylik turlari (bosilsa jadval shu turga kesiladi), xodimlar jadvali, soliqlar, foiz darajalari, bitta xodimning
// shu oydagi hisobi va hisoblash qoidalari. Sahifa faqat KO'RSATADI — raqamlar Oylik chiqarish bilan bir xil
// hisobdan (/api/payroll-settings → lib/payrollSettings.ts). Qoidalar tizimda qat'iy — rasmdagi tugmachalar o'rniga
// «tizim qoidasi» belgisi (SAVOLLAR 520).

type Data = {
  ok: true;
  month: string;
  day: number;
  daysIn: number;
  rows: PayrollSettingsRow[];
  tiers: { id: number; name: string; percent: number; staff: number }[];
  taxes: { id: number; name: string; type: "percent" | "amount"; value: number; active: boolean; staff: number }[];
  example: PayrollExample | null;
  exampleId: number | null;
};

const KIND_LABEL: Record<PayrollKind, string> = { foiz: "Tushumdan foiz", fixed: "Oklad", mixed: "Oklad + foiz" };
const KIND_TONE: Record<PayrollKind, string> = { foiz: "bg-v2-brand-bg text-v2-brand", fixed: "bg-v2-surface-2 text-v2-text-2", mixed: "bg-v2-info-bg text-v2-info" };
const TURI: Record<string, string> = { teacher: "Ustoz", moderator: "Moderator", admin: "Admin", staff: "Xodim" };

function Card({ icon: Icon, title, sub, children, aside }: { icon: typeof Wallet; title: string; sub?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
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

function ExRow({ label, value, tone, strong }: { label: React.ReactNode; value: number; tone?: "danger" | "success"; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-v2-border py-2 last:border-0">
      <span className="text-v2-small text-v2-text-2">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${tone === "danger" ? "text-v2-danger" : tone === "success" ? "font-semibold text-v2-success" : "text-v2-text"}`}>
        {tone === "danger" && value > 0 ? "−" : ""}
        {fmtNum(value)}
      </span>
    </div>
  );
}

export default function PayrollSettingsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [exampleId, setExampleId] = useState<number | null>(null);
  const { data: d, error } = useReportData<Data>(`/api/payroll-settings${exampleId ? `?example=${exampleId}` : ""}`);
  const [kind, setKind] = useState<PayrollKind | "all">("all");
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    const conf = (d?.rows ?? []).filter((r) => r.configured);
    const of = (k: PayrollKind) => conf.filter((r) => r.kind === k);
    return { foiz: of("foiz"), fixed: of("fixed"), mixed: of("mixed"), unset: (d?.rows ?? []).filter((r) => !r.configured) };
  }, [d]);

  if (error) return <div className="p-6"><NoticeBar>{t("Faqat direktor uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );

  const mostPct = (rows: PayrollSettingsRow[]) => {
    const c = new Map<number, number>();
    for (const r of rows) c.set(r.percent, (c.get(r.percent) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const turiCount = (rows: PayrollSettingsRow[]) => {
    const c = new Map<string, number>();
    for (const r of rows) c.set(r.turi, (c.get(r.turi) ?? 0) + 1);
    return [...c.entries()].map(([k, n]) => `${n} ${t(TURI[k] ?? k).toLowerCase()}`).join(", ");
  };
  const cards: { k: PayrollKind; icon: typeof Wallet; big: string; sub: string; rows: PayrollSettingsRow[] }[] = [
    { k: "foiz", icon: Percent, big: groups.foiz.length ? `${mostPct(groups.foiz)}%` : "—", sub: t("guruh o'quvchilari to'lovidan"), rows: groups.foiz },
    { k: "fixed", icon: CalendarDays, big: t("oy kunlariga"), sub: t("kun hisobida bo'linadi"), rows: groups.fixed },
    { k: "mixed", icon: CirclePlus, big: groups.mixed.length ? `${t("oklad")} + ${mostPct(groups.mixed)}%` : "—", sub: t("oklad va tushumdan foiz"), rows: groups.mixed },
  ];
  const list = (kind === "all" ? d.rows : d.rows.filter((r) => r.configured && r.kind === kind));
  const shown = showAll ? list : list.slice(0, 8);
  const ex = d.example;
  const monthL = fmt.monthLower(d.month);
  const rules: [string, string][] = [
    [t("Foiz sof tushumdan"), t("O'quvchiga qaytarilgan pul ayriladi; boshqa ustozga o'tgan o'quvchi tushumi kunlarga qarab bo'linadi")],
    [t("To'lov qaysi oy uchun bo'lsa — o'sha oyga"), t("Kelgusi oy uchun oldindan to'lov joriy oy oyligiga qo'shilmaydi — o'z oyida hisoblanadi")],
    [t("Oklad oy kunlariga bo'linadi"), t("Ishga kirgan kundan (yoki ketgan kungacha) — oklad × ishlangan kun / oy kunlari")],
    [t("Bonus qo'shiladi, jarima ayriladi"), t("Moliya → Bonus va jarimalardagi shu oy yozuvlari")],
    [t("Soliq hisoblangan oylikdan"), t("Faqat kartasida soliq biriktirilgan xodimga; hisoblangan oylikdan oshmaydi")],
    [t("Avans oylikdan ayiriladi"), t("Oy davomida berilgan avans va chiqarilgan oylik to'lanadigan qoldiqdan ayriladi")],
    [t("To'lanmagan qoldiq keyingi oyga o'tadi"), t("Qarzdorlik ham — keyingi oy hisobiga «o'tgan oydan» bo'lib qo'shiladi")],
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("Moliya")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Oylik va soliq")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Ustoz va xodim oyligi qanday hisoblanadi. Raqamlar Oylik chiqarish bilan bir xil hisobdan; oklad, foiz va soliq xodim kartasida o'zgartiriladi.")}</p>
        </div>
        <Link href="/finance-payroll" className="inline-flex h-9 items-center gap-1.5 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-v2-small font-semibold text-v2-text">
          {t("Oylik chiqarish")} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card icon={Wallet} title={t("Oylik turlari")} sub={t("Har xodimga bittasi biriktiriladi · kartani bossangiz o'sha turdagilar chiqadi")}>
            <div className="grid gap-3 sm:grid-cols-3">
              {cards.map((c) => {
                const on = kind === c.k;
                return (
                  <button key={c.k} type="button" aria-pressed={on} onClick={() => setKind(on ? "all" : c.k)} className={`rounded-v2-lg border p-3 text-left transition-colors ${on ? "border-v2-brand ring-1 ring-v2-brand" : "border-v2-border hover:bg-v2-surface-2"}`}>
                    <span className={`flex size-7 items-center justify-center rounded-v2-sm ${KIND_TONE[c.k]}`}>
                      <c.icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="mt-2 text-v2-small font-semibold text-v2-text">{t(KIND_LABEL[c.k])}</div>
                    <div className="text-[20px] font-semibold text-v2-text">{c.big}</div>
                    <div className="text-v2-caption text-v2-text-2">{c.sub}</div>
                    <div className="mt-2 text-v2-small font-semibold text-v2-brand">{c.rows.length ? turiCount(c.rows) : t("hech kim")}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-v2-small">
              <span className="font-semibold text-v2-text">{kind === "all" ? t("Barcha xodimlar") : t(KIND_LABEL[kind])}</span>
              <span className="text-v2-text-2">· {list.length}</span>
              {groups.unset.length > 0 && kind === "all" && <span className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("{n} tasida oylik sozlanmagan", { n: groups.unset.length })}</span>}
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-v2-small">
                <thead>
                  <tr className="border-b border-v2-border">
                    <th className={TH}>{t("Xodim")}</th>
                    <th className={TH}>{t("Oylik turi")}</th>
                    <th className={`${TH} text-right`}>{t("Stavka")}</th>
                    <th className={`${TH} text-right`}>{t("{m} oyligi", { m: monthL })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-v2-border">
                  {shown.map((r) => (
                    <tr key={r.id} className={r.id === d.exampleId ? "bg-v2-brand-bg/40" : ""}>
                      <td className="py-2 pr-3">
                        <button type="button" onClick={() => r.configured && setExampleId(r.id)} className="flex items-center gap-2 text-left" title={r.configured ? t("Misolda ko'rsatish") : undefined}>
                          <Avatar name={r.name} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-v2-text">{r.name}</span>
                            <span className="block text-v2-caption text-v2-text-2">{t(TURI[r.turi] ?? r.turi)}{r.taxable ? ` · ${t("soliq")}` : ""}</span>
                          </span>
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        {r.configured ? <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption font-semibold ${KIND_TONE[r.kind]}`}>{t(KIND_LABEL[r.kind])}</span> : <span className="rounded-v2-sm bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("Sozlanmagan")}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-v2-text">{!r.configured ? "—" : r.kind === "foiz" ? `${r.percent}%` : r.kind === "fixed" ? fmtNum(r.fixedSalary) : `${fmtNum(r.fixedSalary)} + ${r.percent}%`}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-v2-text">{r.configured ? fmtNum(r.earned) : "—"}</td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-v2-text-3">{t("Bu turdagi xodim yo'q")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-v2-small text-v2-text-2">
              <span>{t("{m}: 1–{d} kun holatiga ({n} kundan)", { m: fmt.monthName(d.month), d: d.day, n: d.daysIn })}</span>
              {list.length > 8 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="font-semibold text-v2-brand">
                  {showAll ? t("Qisqartirish") : t("Yana {n} xodim", { n: list.length - 8 })}
                </button>
              )}
            </div>
          </Card>
          <Card icon={Calculator} title={t("Hisoblash qoidalari")} sub={t("Oylik chiqarishdagi hisob shu qoidalar bilan qilinadi — ular tizimda qat'iy")}>
            <ul className="divide-y divide-v2-border">
              {rules.map(([a, b]) => (
                <li key={a} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-v2-small font-semibold text-v2-text">{a}</div>
                    <div className="text-v2-small text-v2-text-2">{b}</div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">
                    <Check className="size-3" aria-hidden /> {t("tizim qoidasi")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Soliq va ushlanmalar")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("Kartasida soliq biriktirilgan xodimning hisoblangan oyligidan ushlanadi")}</p>
            <ul className="mt-2 divide-y divide-v2-border">
              {d.taxes.map((x) => (
                <li key={x.id} className={`flex items-center gap-3 py-2.5 ${x.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-v2-text">{x.name}</div>
                    <div className="text-v2-small text-v2-text-2">{x.active ? t("{n} xodimga biriktirilgan", { n: x.staff }) : t("O'chirilgan")}</div>
                  </div>
                  <span className="rounded-v2-sm border border-v2-border px-2 py-1 font-semibold tabular-nums text-v2-text">{x.type === "percent" ? `${x.value}%` : fmtNum(x.value)}</span>
                </li>
              ))}
              {!d.taxes.length && <li className="py-4 text-center text-v2-small text-v2-text-3">{t("Soliq qo'shilmagan")}</li>}
            </ul>
            <Link href="/settings-finance?tab=tax" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Soliqlarni tahrirlash")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
          {ex && (
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="font-semibold text-v2-text">{t("Misol: {name}", { name: ex.name })}</h2>
              <p className="mb-2 text-v2-small text-v2-text-2">
                {t(KIND_LABEL[ex.kind])} · {monthL}
              </p>
              {ex.kind !== "foiz" && <ExRow label={t("Oklad · {s} × {a}/{b} kun", { s: fmtNum(ex.fixedSalary), a: ex.okladDays, b: ex.daysIn })} value={ex.okladPart} />}
              {ex.kind !== "fixed" && <ExRow label={t("{p}% × tushum ({c} so'm)", { p: ex.percent, c: fmtNum(ex.collected) })} value={ex.foizPart} />}
              {ex.bonus > 0 && <ExRow label={t("Bonus")} value={ex.bonus} />}
              {ex.jarima > 0 && <ExRow label={t("Jarima")} value={ex.jarima} tone="danger" />}
              <ExRow label={t("Jami oylik")} value={ex.earned} strong />
              {ex.taxLines.map((l) => (
                <ExRow key={l.name} label={`${l.name} · ${l.detail}`} value={l.amount} tone="danger" />
              ))}
              <ExRow label={t("Qo'lga")} value={ex.net} tone="success" />
              <p className="mt-2 text-v2-caption text-v2-text-2">{t("Bugungi holat — avans va o'tgan oy qoldig'i hisobga olinmagan. Boshqa xodimni ko'rish uchun jadvaldagi ismini bosing.")}</p>
            </section>
          )}
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Foiz darajalari")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("Xodim kartasidagi «Oladigan foizi» shu ro'yxatdan tanlanadi")}</p>
            <ul className="mt-2 divide-y divide-v2-border">
              {d.tiers.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-v2-text">{x.name}</span>
                  <span className="text-v2-small text-v2-text-2">{t("{n} xodim", { n: x.staff })}</span>
                  <span className="w-12 text-right font-semibold tabular-nums text-v2-text">{x.percent}%</span>
                </li>
              ))}
              {!d.tiers.length && <li className="py-4 text-center text-v2-small text-v2-text-3">{t("Daraja qo'shilmagan")}</li>}
            </ul>
            <Link href="/settings-finance?tab=monthly" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Darajalarni tahrirlash")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
