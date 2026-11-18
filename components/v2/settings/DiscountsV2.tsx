"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, CalendarClock, Clock, Loader2, Lock, Percent, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { AmountEditor, Card, Rule, Soon, Switch } from "@/components/v2/settings/financeKit";
import { Avatar, NoticeBar, fmtNum } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { DiscountRules } from "@/lib/discountRules";
import { EXCEPTION_LABELS, EXCEPTION_TYPES, type ExceptionType } from "@/lib/priceExceptionTypes";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «CHEGIRMALAR» (39-qism, rasm «Sozlamalar · Chegirmalar»).
// «Admin chegarasi» — haqiqiy: Chegirma va istisnolar shu chegaradan katta imtiyozni direktor tasdig'iga yuboradi.
// Avtomatik chegirmalar (aka-uka, ikki kurs, oldindan to'lov) saqlanadi, lekin hali qo'llanmaydi — qarzga ta'sir
// qiladi, egasining qarori kerak (SAVOLLAR 522); har biri yoqilsa nechta o'quvchiga mos kelishi ko'rsatiladi.
// O'ngda shu oy berilgan imtiyozlar va direktor tasdig'ini kutayotganlar. Server: /api/discount-rules.

type Data = {
  ok: true;
  month: string;
  rules: DiscountRules;
  total: number;
  pupils: number;
  kpi: Record<ExceptionType, { sum: number; pupils: number; count: number }>;
  pending: { id: number; pupilName: string; type: ExceptionType; amount: number; basePrice: number | null; percent: number | null; createdBy: string; createdAt: string }[];
  pendingCount: number;
  preview: { twoCourses: number; sibling: number };
  log: { text: string; by: string; at: string }[];
};
type Field = "sibling" | "twoCourses" | "prepay" | "limitPercent" | "limitSum";

export default function DiscountsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/discount-rules");
  const [busy, setBusy] = useState(false);
  async function save(field: Field, body: { on?: boolean; value?: number }) {
    setBusy(true);
    const r = await fetch("/api/discount-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, ...body }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    reload();
  }
  if (error) return <div className="p-6"><NoticeBar>{t("Faqat direktor uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const r = d.rules;
  const autos: { f: "sibling" | "twoCourses" | "prepay"; icon: typeof Users; title: string; sub: string; fit: string | null }[] = [
    { f: "sibling", icon: Users, title: t("Aka-uka, opa-singil"), sub: t("Ikkinchi va keyingi farzandga · ona telefoni bir xil bo'lsa"), fit: t("Mos keladi: {n} o'quvchi", { n: d.preview.sibling }) },
    { f: "twoCourses", icon: BookOpen, title: t("Ikki va undan ko'p kurs"), sub: t("Ikkinchi kursning narxiga"), fit: t("Mos keladi: {n} o'quvchi", { n: d.preview.twoCourses }) },
    { f: "prepay", icon: CalendarClock, title: t("Oldindan to'lov"), sub: t("3 oylik to'lov bir martada qilinsa"), fit: null },
  ];
  const chips = EXCEPTION_TYPES.filter((k) => d.kpi[k]?.count);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">{t("Moliya")}</div>
        <h1 className="text-v2-page text-v2-text">{t("Chegirmalar")}</h1>
        <p className="max-w-[680px] text-v2-small text-v2-text-2">{t("Avtomatik chegirmalar va admin chegarasi. Har bir o'quvchiga berilgan chegirma va alohida narx — Hisobotlar → Chegirma va istisnolarda.")}</p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card icon={Percent} title={t("Avtomatik chegirmalar")} sub={t("Shart bajarilsa admin hech narsa yozmaydi — chegirma o'zi qo'llanadi")}>
            {autos.map((a) => (
              <Rule key={a.f} icon={a.icon} tone="bg-v2-surface-2 text-v2-text-2" title={a.title} badge={<Soon label={t("Tez orada")} />} sub={a.fit ? `${a.sub} · ${a.fit}` : a.sub}>
                <AmountEditor key={`${a.f}${r[a.f].percent}`} initial={r[a.f].percent} percent label={a.title} disabled={busy} onSave={(n) => void save(a.f, { value: n })} />
                <Switch on={r[a.f].on} label={a.title} disabled={busy} onChange={(v) => void save(a.f, { on: v })} />
              </Rule>
            ))}
            <li className="pt-3">
              <NoticeBar>{t("Avtomatik qo'llash hali yoqilmagan: qoidalar saqlanadi, to'lov va qarz hisobi o'zgarmaydi. Hozircha chegirma Chegirma va istisnolar orqali qo'lda beriladi.")}</NoticeBar>
            </li>
          </Card>
          <Card icon={Lock} title={t("Qoidalar")} sub={t("Admin bergan chegirma, alohida narx, kechirilgan qarz va dars haqi")}>
            <Rule icon={Percent} tone="bg-v2-warning-bg text-v2-warning" title={t("Admin chegarasi — foiz")} sub={t("Guruh narxining shu foizidan katta imtiyoz direktor tasdig'iga boradi")}>
              <AmountEditor key={`lp${r.limitPercent}`} initial={r.limitPercent} percent label={t("Admin chegarasi — foiz")} disabled={busy} onSave={(n) => void save("limitPercent", { value: n })} />
            </Rule>
            <Rule icon={Percent} tone="bg-v2-warning-bg text-v2-warning" title={t("Admin chegarasi — summa")} sub={t("Shu summadan katta imtiyoz ham direktor tasdig'iga boradi")}>
              <AmountEditor key={`ls${r.limitSum}`} initial={r.limitSum} label={t("Admin chegarasi — summa")} disabled={busy} onSave={(n) => void save("limitSum", { value: n })} />
            </Rule>
            <Rule icon={Lock} tone="bg-v2-surface-2 text-v2-text-2" title={t("Qachondan")} sub={t("Oylik chegirma tanlangan oydan kuchga kiradi — o'tgan oylar qayta hisoblanmaydi")}>
              <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">{t("tizim qoidasi")}</span>
            </Rule>
            <Rule icon={Lock} tone="bg-v2-surface-2 text-v2-text-2" title={t("Ustoz ulushi")} sub={t("Ustoz foizi o'quvchi haqiqatan to'lagan summadan hisoblanadi")}>
              <Link href="/settings-payroll" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                {t("Oylik va soliq")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Rule>
          </Card>
        </div>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("{m}da imtiyozlar", { m: fmt.monthName(d.month) })}</h2>
            <p className="text-v2-small text-v2-text-2">{t("barcha filiallar · tasdiqlanganlar")}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[26px] font-semibold tabular-nums text-v2-text">{d.total ? `−${fmtNum(d.total)}` : "0"}</span>
              <span className="text-v2-small text-v2-text-2">{t("so'm · {n} o'quvchi", { n: d.pupils })}</span>
            </div>
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {chips.map((k) => (
                  <span key={k} className="rounded-full border border-v2-border px-2.5 py-1 text-v2-caption text-v2-text-2">
                    {t(EXCEPTION_LABELS[k])} · {d.kpi[k].count}
                  </span>
                ))}
              </div>
            )}
            <Link href="/reports-discounts" className="mt-3 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Chegirma va istisnolar")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="flex items-center gap-2 font-semibold text-v2-text">
              <Clock className="size-4 text-v2-warning" aria-hidden /> {t("Direktor tasdig'i kutmoqda")}
              {d.pendingCount > 0 && <span className="rounded-full bg-v2-warning-bg px-2 text-v2-caption text-v2-warning">{d.pendingCount}</span>}
            </h2>
            <ul className="mt-2 divide-y divide-v2-border">
              {d.pending.map((p) => (
                <li key={p.id} className="flex gap-3 py-2.5">
                  <Avatar name={p.pupilName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-v2-text">{p.pupilName}</div>
                    <div className="text-v2-small text-v2-text-2">
                      {t(EXCEPTION_LABELS[p.type])} · {fmtNum(p.amount)} {p.percent ? `(${p.percent}%)` : ""} · {p.createdBy}
                    </div>
                  </div>
                </li>
              ))}
              {!d.pending.length && <li className="py-4 text-center text-v2-small text-v2-text-3">{t("Kutayotgan so'rov yo'q")}</li>}
            </ul>
            {d.pendingCount > 0 && (
              <Link href="/reports-discounts" className="mt-2 flex h-9 items-center justify-center rounded-v2-md border border-v2-border text-v2-small font-semibold text-v2-text">
                {t("Ko'rib chiqish")}
              </Link>
            )}
          </section>
          {d.log.length > 0 && (
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="font-semibold text-v2-text">{t("So'nggi o'zgarishlar")}</h2>
              <ul className="mt-2 divide-y divide-v2-border">
                {d.log.map((l, i) => (
                  <li key={i} className="py-2">
                    <div className="text-v2-small font-semibold text-v2-text">{l.text}</div>
                    <div className="text-v2-caption text-v2-text-2">{[fmt.dayMonth(l.at.slice(0, 10)), l.by].filter(Boolean).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
