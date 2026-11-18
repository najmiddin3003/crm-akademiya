"use client";

import { ArrowLeft, ChartColumn, Loader2, Target, Trophy } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { NoticeBar, fmtNum } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { SalesBonusRow } from "@/lib/bonusKpi";

// YANGI VERSIYA — «BONUSIM» (39-qism, rasm «Bonusim», telefon). Xodimning shu oydagi sotuv bonusi (hozircha), Savdo
// plani bo'yicha jarayon, ko'rsatkichlar va o'tgan oy. Qoidalar — Sozlamalar → Bonus va KPI; server /api/my-bonus.

type Data = {
  ok: true;
  name: string;
  month: string;
  prevMonth: string;
  enabled: boolean;
  perStudent: number;
  planBonus: number;
  current: SalesBonusRow | null;
  previous: SalesBonusRow | null;
  kpi: {
    leads: number;
    convPct: number | null;
    forecast: number;
    target: number;
  } | null;
};

export default function MyBonusV2({ name }: { name?: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data: d, error } = useReportData<Data>(
    `/api/my-bonus${name ? `?name=${encodeURIComponent(name)}` : ""}`,
  );
  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Bonus ma'lumoti topilmadi")}</NoticeBar>
      </div>
    );
  if (!d)
    return (
      <div
        data-ui="v2"
        className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
        {t("Yuklanmoqda…")}
      </div>
    );
  const c = d.current;
  const done = c?.done ?? 0;
  const target = c?.target ?? d.kpi?.target ?? 0;
  const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const left = Math.max(0, target - done);
  const monthN = fmt.monthName(d.month);
  return (
    <div
      data-ui="v2"
      className="min-h-full bg-v2-surface-2 font-v2 text-v2-text"
    >
      <div className="mx-auto max-w-[520px] space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Link
            href={name ? "/settings-bonus" : "/home"}
            aria-label={t("Orqaga")}
            className="flex size-9 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold text-v2-text">
              {t("Bonusim")}
            </h1>
            <p className="truncate text-v2-small text-v2-text-2">
              {monthN} · {d.name}
            </p>
          </div>
        </div>
        {!d.enabled ? (
          <NoticeBar>
            {t(
              "Avtomatik sotuv bonusi hozircha yoqilmagan. Bonus Oylik chiqarishda rahbar tomonidan yoziladi.",
            )}
          </NoticeBar>
        ) : (
          <section className="rounded-v2-lg bg-v2-brand-bg p-4">
            <div className="text-v2-small font-semibold text-v2-brand">
              {t("{m} bonusi · hozircha", { m: monthN })}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[32px] font-semibold tabular-nums text-v2-text">
                {fmtNum(c?.total ?? 0)}
              </span>
              <span className="text-v2-text-2">{t("so'm")}</span>
            </div>
            {d.perStudent > 0 && (
              <div className="text-v2-small text-v2-text-2">
                {t("{n} yangi o'quvchi × {s}", {
                  n: done,
                  s: fmtNum(d.perStudent),
                })}
              </div>
            )}
            {target > 0 && (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-v2-surface">
                  <div
                    className="h-full rounded-full bg-v2-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between gap-2 text-v2-small">
                  <span className="font-semibold text-v2-text">
                    {t("Savdo plani {a} / {b}", { a: done, b: target })}
                  </span>
                  {left > 0 && d.planBonus > 0 && (
                    <span className="text-v2-text-2">
                      {t("yana {n} ta → +{s}", {
                        n: left,
                        s: fmtNum(d.planBonus),
                      })}
                    </span>
                  )}
                  {left === 0 && (
                    <span className="font-semibold text-v2-success">
                      {t("reja bajarildi")}
                    </span>
                  )}
                </div>
              </>
            )}
          </section>
        )}
        {d.kpi && (
          <>
            <div className="text-v2-small font-semibold text-v2-text-2">
              {t("Ko'rsatkichlar · {m}", { m: fmt.monthLower(d.month) })}
            </div>
            <ul className="divide-y divide-v2-border rounded-v2-lg border border-v2-border bg-v2-surface">
              <li className="flex items-center gap-3 p-3">
                <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-success-bg text-v2-success">
                  <Target className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-v2-text">
                    {t("Liddan o'quvchiga")}
                  </div>
                  <div className="text-v2-small text-v2-text-2">
                    {t("{n} lid", { n: d.kpi.leads })}
                  </div>
                </div>
                <span className="font-semibold tabular-nums text-v2-success">
                  {d.kpi.convPct === null ? "—" : `${d.kpi.convPct}%`}
                </span>
              </li>
              <li className="flex items-center gap-3 p-3">
                <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-info-bg text-v2-info">
                  <ChartColumn className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-v2-text">
                    {t("Oy oxiriga prognoz")}
                  </div>
                  <div className="text-v2-small text-v2-text-2">
                    {t("hozirgi sur'at bo'yicha")}
                  </div>
                </div>
                <span className="font-semibold tabular-nums text-v2-text">
                  {t("{n} ta", { n: d.kpi.forecast })}
                </span>
              </li>
            </ul>
          </>
        )}
        {d.previous && d.enabled && (
          <>
            <div className="text-v2-small font-semibold text-v2-text-2">
              {t("O'tgan oy")}
            </div>
            <div className="flex items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-3">
              <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                <Trophy className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">
                  {fmt.monthName(d.prevMonth)}
                </div>
                <div className="text-v2-small text-v2-text-2">
                  {t("{n} yangi o'quvchi", { n: d.previous.done })}
                  {d.previous.target
                    ? ` · ${d.previous.done >= d.previous.target ? t("reja bajarildi") : t("reja {n}", { n: d.previous.target })}`
                    : ""}
                </div>
              </div>
              <span className="font-semibold tabular-nums text-v2-text">
                {fmtNum(d.previous.total)}
              </span>
            </div>
          </>
        )}
        <p className="text-v2-small text-v2-text-2">
          {t(
            "Hisob Savdo plani bo'yicha. Bonus oy oxirida Oylik chiqarishda «Bonus» ustuniga rahbar tomonidan yoziladi.",
          )}
        </p>
      </div>
    </div>
  );
}
