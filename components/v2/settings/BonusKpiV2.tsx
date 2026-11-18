"use client";

import { useState } from "react";
import { BadgeCheck, ChartColumn, HandCoins, Loader2, Target, Trophy, Undo2, UserPlus, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { AmountEditor, Card, Chip, Rule, Soon, Switch } from "@/components/v2/settings/financeKit";
import { NoticeBar, fmtNum } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { BonusKpiSettings, SalesBonusRow } from "@/lib/bonusKpi";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «BONUS VA KPI» (39-qism, rasm «Sozlamalar · Bonus va KPI»).
// Sotuv bonusi (har yangi o'quvchi, reja bajarilsa, birinchi oyda ketsa — qaytadi), moliya bo'limi bonusi, KPI
// summalari. Sotuv bonusi Savdo plani raqamlaridan hozircha hisoblab ko'rsatiladi (o'ng panel). Oylikka avtomatik
// TUSHMAYDI — egasining qarori kerak (SAVOLLAR 521); moliya bonusi va KPI ballari hisobi hali yo'q («Tez orada»).
// Server: /api/bonus-kpi (lib/bonusKpi.ts).

type Data = {
  ok: true;
  today: string;
  settings: BonusKpiSettings;
  admins: number;
  teachers: number;
  branches: Record<string, string>;
  sales: { month: string; day: number; days: number; rows: SalesBonusRow[] };
  log: { text: string; by: string; at: string }[];
};

type Field = "perStudent" | "plan" | "clawback" | "debt" | "handover" | "kpi90" | "kpi80";

export default function BonusKpiV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/bonus-kpi");
  const [busy, setBusy] = useState(false);
  async function save(field: Field, body: { on?: boolean; amount?: number }) {
    setBusy(true);
    const r = await fetch("/api/bonus-kpi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, ...body }) })
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
  const s = d.settings;
  const salesOn = s.perStudent.on || s.plan.on;
  const rows = d.sales.rows.filter((r) => r.done > 0 || r.target > 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const hits = rows.filter((r) => r.willHit);
  const monthL = fmt.monthName(d.sales.month);

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">{t("Moliya")}</div>
        <h1 className="text-v2-page text-v2-text">{t("Bonus va KPI")}</h1>
        <p className="max-w-[680px] text-v2-small text-v2-text-2">{t("Avtomatik bonus qoidalari. Sotuv bonusi Savdo plani bo'yicha hozircha hisoblab ko'rsatiladi; oylikka hozircha Moliya → Bonus orqali qo'lda yoziladi.")}</p>
      </div>
      <NoticeBar>{t("Hisoblangan bonus Oylik chiqarishga avtomatik tushmaydi — buni yoqish rahbar qarori bilan (pulga ta'sir qiladi).")}</NoticeBar>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card icon={Trophy} title={t("Sotuv bonusi")} sub={t("Lidni o'quvchiga aylantirgan xodimga — Savdo plani bilan bog'langan")} chips={<Chip>{t("Qabul admin. · {n}", { n: d.admins })}</Chip>}>
            <Rule icon={UserPlus} tone="bg-v2-success-bg text-v2-success" title={t("Har yangi o'quvchi uchun")} sub={t("Savdo planida admin nomiga yozilgan har yangi o'quvchi")}>
              <AmountEditor key={`ps${s.perStudent.amount}`} initial={s.perStudent.amount} label={t("Har yangi o'quvchi uchun")} disabled={busy} onSave={(n) => void save("perStudent", { amount: n })} />
              <Switch on={s.perStudent.on} label={t("Har yangi o'quvchi uchun")} disabled={busy} onChange={(v) => void save("perStudent", { on: v })} />
            </Rule>
            <Rule icon={Target} tone="bg-v2-info-bg text-v2-info" title={t("Oylik savdo plani bajarilsa")} sub={t("Sotuv va marketing → Savdo plani bo'yicha, oy oxirida")}>
              <AmountEditor key={`pl${s.plan.amount}`} initial={s.plan.amount} label={t("Oylik savdo plani bajarilsa")} disabled={busy} onSave={(n) => void save("plan", { amount: n })} />
              <Switch on={s.plan.on} label={t("Oylik savdo plani bajarilsa")} disabled={busy} onChange={(v) => void save("plan", { on: v })} />
            </Rule>
            <Rule icon={Undo2} tone="bg-v2-danger-bg text-v2-danger" title={t("Birinchi oyda ketsa — qaytadi")} badge={<Soon label={t("Tez orada")} />} sub={t("O'quvchi 30 kun ichida ketsa, bonus keyingi oydan ayiriladi — sozlama saqlanadi, hisobi hali yo'q")}>
              <Switch on={s.clawback.on} label={t("Birinchi oyda ketsa — qaytadi")} disabled={busy} onChange={(v) => void save("clawback", { on: v })} />
            </Rule>
          </Card>
          <Card icon={HandCoins} title={t("Moliya bo'limi bonusi")} sub={t("Kassa mas'ullariga — qarz undirish va toza topshiruv uchun")}>
            <Rule icon={Wallet} tone="bg-v2-warning-bg text-v2-warning" title={t("Qarz undirilsa")} badge={<Soon label={t("Tez orada")} />} sub={t("2 oy va undan ko'p qarz to'langanda — undirilgan summadan")}>
              <AmountEditor key={`db${s.debt.percent}`} initial={s.debt.percent} percent label={t("Qarz undirilsa")} disabled={busy} onSave={(n) => void save("debt", { amount: n })} />
              <Switch on={s.debt.on} label={t("Qarz undirilsa")} disabled={busy} onChange={(v) => void save("debt", { on: v })} />
            </Rule>
            <Rule icon={BadgeCheck} tone="bg-v2-success-bg text-v2-success" title={t("Topshiruvda farq bo'lmasa")} badge={<Soon label={t("Tez orada")} />} sub={t("Oy davomida har kungi topshiruv farqsiz qabul qilinsa")}>
              <AmountEditor key={`ho${s.handover.amount}`} initial={s.handover.amount} label={t("Topshiruvda farq bo'lmasa")} disabled={busy} onSave={(n) => void save("handover", { amount: n })} />
              <Switch on={s.handover.on} label={t("Topshiruvda farq bo'lmasa")} disabled={busy} onChange={(v) => void save("handover", { on: v })} />
            </Rule>
          </Card>
          <Card icon={ChartColumn} title={t("KPI")} sub={t("Oy oxirida har xodimga 0–100% ball — ko'rsatkichlar hisobi tez orada; summalar hozirdan saqlanadi")}>
            <Rule icon={Trophy} tone="bg-v2-brand-bg text-v2-brand" title={t("KPI 90% va undan yuqori")} badge={<Soon label={t("Tez orada")} />} sub={t("Oylikka qo'shiladi")}>
              <AmountEditor key={`k9${s.kpi90}`} initial={s.kpi90} label={t("KPI 90% va undan yuqori")} disabled={busy} onSave={(n) => void save("kpi90", { amount: n })} />
            </Rule>
            <Rule icon={Trophy} tone="bg-v2-surface-2 text-v2-text-2" title={t("KPI 80–89%")} badge={<Soon label={t("Tez orada")} />} sub={t("Oylikka qo'shiladi")}>
              <AmountEditor key={`k8${s.kpi80}`} initial={s.kpi80} label={t("KPI 80–89%")} disabled={busy} onSave={(n) => void save("kpi80", { amount: n })} />
            </Rule>
          </Card>
        </div>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("{m} — sotuv bonusi", { m: monthL })}</h2>
            <p className="text-v2-small text-v2-text-2">{t("{d} holatiga · Savdo plani bo'yicha", { d: fmt.dayMonth(d.today) })}</p>
            {!salesOn ? (
              <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Sotuv bonusi o'chiq — qoidani yoqing")}</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-v2-border">
                  {rows.map((r) => (
                    <li key={r.admin} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link href={`/my-bonus?name=${encodeURIComponent(r.admin)}`} className="block truncate font-semibold text-v2-text hover:text-v2-brand">
                          {r.admin}
                        </Link>
                        <div className="truncate text-v2-small text-v2-text-2">
                          {d.branches[r.branchId] ?? ""} · {t("{n} yangi", { n: r.done })}
                          {r.target ? ` / ${r.target}` : ""}
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums text-v2-text">{fmtNum(r.total)}</span>
                    </li>
                  ))}
                  {!rows.length && <li className="py-6 text-center text-v2-small text-v2-text-3">{t("Bu oy hali yangi o'quvchi yo'q")}</li>}
                </ul>
                <div className="flex items-center justify-between border-t border-v2-border pt-2.5 text-v2-small">
                  <span className="text-v2-text-2">{t("Jami · hozircha")}</span>
                  <span className="font-semibold tabular-nums text-v2-text">{fmtNum(total)}</span>
                </div>
                {hits.length > 0 && (
                  <div className="mt-3 rounded-v2-md bg-v2-brand-bg p-3 text-v2-small text-v2-brand">
                    {t("Prognoz bo'yicha rejani bajaradi: {names} — har biriga +{s}", { names: hits.map((h) => `${h.admin} (${h.forecast}/${h.target})`).join(", "), s: fmtNum(s.plan.amount) })}
                  </div>
                )}
              </>
            )}
            <Link href="/sales-plan" className="mt-3 inline-flex text-v2-small font-semibold text-v2-brand">
              {t("Savdo plani")} →
            </Link>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Qanday ishlaydi")}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-v2-small text-v2-text-2">
              <li>{t("Tizim Savdo plani raqamlaridan har kuni hisoblaydi — admin o'z bonusini telefonida («Bonusim») ko'radi.")}</li>
              <li>{t("Oy oxirida rahbar summani Moliya → Bonus orqali oylikka yozadi.")}</li>
              <li>{t("Avtomatik qo'shish — rahbar qarori bilan yoqiladi.")}</li>
            </ol>
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
