"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, CircleAlert, Clock3, History, MessageSquare, Printer, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { fmtSum } from "@/components/v2/employees/employeeBits";
import { methodDot } from "@/components/v2/form/fields";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import type { ProfileEntry } from "@/lib/pupilProfile";
import { entryGroupId, isActiveEntry, type MonthCell } from "./profileLedger";
import { DebtKpi, IncompleteNote } from "./profileKpis";
import { Card, EmptyBlock, KpiCell, KpiStrip, PayStateIcon, SegTabs, groupTitle, linkBtn } from "./profileBits";
import type { TabProps } from "./profileTypes";

// YANGI VERSIYA — O'QUVCHI SAHIFASI · TO'LOVLAR (rasm «O'quvchi sahifasi · To'lovlar»,
// 23.10.2026):
//   ko'rsatkichlar — Qarzdorlik («SMS eslatma yuborish») | Oylik to'lov («2 guruh ·
//     320 000 + 300 000») | Jami to'langan («iyundan beri · 6 ta to'lov»);
//   «Oylar bo'yicha» — guruh × oy: ✓ to'langan, ◐ qisman («qoldi · 300 000 dan»), ⓘ qarz
//     (joriy oyda «Shu oyni to'lash →»), ◷ kelgusi oy, — guruhda emas; joriy oy ustuni
//     ajratilgan («joriy»); pastda «Oy bo'yicha qarz, so'm»; izoh;
//   «To'lovlar tarixi» — Chek · Sana · Summa · To'lov turi · Qaysi oy uchun · Guruh ·
//     Kassa; guruh bo'yicha segment; «Jami».
// Qarz qoidasi — profileLedger.ts (SAVOLLAR 149).

const PAGE = 30;

export default function ProfilePaymentsTab(props: TabProps) {
  const { data, ledger, fmt, onSms } = props;
  const { t } = useT();
  const firstYear = ledger.firstPaidMonth?.slice(0, 4);
  const since = ledger.firstPaidMonth
    ? firstYear === ledger.curMonth.slice(0, 4)
      ? t("{month}dan beri", { month: fmt.monthLower(ledger.firstPaidMonth) })
      : t("{month} {year}-yildan beri", { month: fmt.monthLower(ledger.firstPaidMonth), year: firstYear ?? "" })
    : "";

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip label={t("Ko'rsatkichlar")}>
        <DebtKpi ledger={ledger} fmt={fmt}>
          {data.pupil.phone.trim() && (
            <button type="button" onClick={onSms} className={`${linkBtn} mt-1`}>
              <MessageSquare className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("SMS eslatma yuborish")}
            </button>
          )}
        </DebtKpi>
        <KpiCell
          label={t("Oylik to'lov")}
          value={`${fmtSum(ledger.monthlyFee)} ${t("so'm")}`}
          sub={
            ledger.feeParts.length > 1
              ? `${t("{n} guruh", { n: ledger.feeParts.length })} · ${ledger.feeParts.map(fmtSum).join(" + ")}`
              : ledger.feeParts.length === 1
                ? t("{n} guruh", { n: 1 })
                : data.groups.some((g) => g.current)
                  ? t("narx belgilanmagan")
                  : t("guruhga qo'shilmagan")
          }
        />
        <KpiCell
          label={t("Jami to'langan")}
          value={`${fmtSum(ledger.totalPaid)} ${t("so'm")}`}
          sub={ledger.paymentsCount > 0 ? `${since} · ${t("{n} ta to'lov", { n: ledger.paymentsCount })}` : t("to'lov hali yo'q")}
        />
      </KpiStrip>

      <MonthsGrid {...props} />
      <HistoryTable {...props} since={since} />
    </div>
  );
}

/* ── Oylar bo'yicha ───────────────────────────────────────────────── */

function MonthsGrid({ ledger, fmt, canPay, onPay }: TabProps) {
  const { t } = useT();
  const cur = ledger.curMonth;
  const unassigned = ledger.months.filter((m) => (ledger.unassigned[m] ?? 0) > 0).reduce((s, m) => s + (ledger.unassigned[m] ?? 0), 0);
  const colCur = "bg-v2-brand-bg/45";
  // Ko'rinadigan oylarda katagi yo'q guruh (masalan bahorda chiqib ketgan) — qator ko'rsatilmaydi.
  const rows = ledger.rows.filter((r) => ledger.months.some((m) => r.cells[m]));

  const cellView = (c: MonthCell | undefined, groupId: number) => {
    if (!c || c.state === "none") return <span className="text-v2-text-3">—</span>;
    const pay = () => onPay({ groupId, month: c.month, amount: c.remaining });
    const isCur = c.month === cur;
    if (c.state === "paid")
      return (
        <span className="block whitespace-nowrap">
          <span className="inline-flex items-center gap-1 tabular-nums text-v2-text">
            <Check className="size-3.5 shrink-0 text-v2-success" strokeWidth={2.5} aria-hidden />
            {fmtSum(c.paid)}
          </span>
          {c.extra > 0 && c.month <= cur ? (
            <span className="block text-v2-caption tabular-nums text-v2-success">{t("+{sum} ortiqcha", { sum: fmtSum(c.extra) })}</span>
          ) : c.month > cur ? (
            <span className="block text-v2-caption text-v2-text-3">{t("oldindan")}</span>
          ) : null}
        </span>
      );
    if (c.state === "future")
      return (
        <span className="block whitespace-nowrap">
          <span className="inline-flex items-center gap-1 tabular-nums text-v2-text-2">
            <Clock3 className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={2} aria-hidden />
            {fmtSum(c.expected ?? 0)}
          </span>
          <span className="block text-v2-caption text-v2-text-3">{t("kelgusi oy")}</span>
        </span>
      );
    if (c.state === "noprice")
      return (
        <span className="text-v2-caption text-v2-text-3" title={t("Kurs narxi belgilanmagan — Sozlamalar → Kurslar")}>
          {t("narx yo'q")}
        </span>
      );
    const debt = c.state === "debt";
    const pillCls = `inline-flex items-center gap-1 whitespace-nowrap rounded-v2-full border px-2 py-0.5 font-semibold tabular-nums ${
      debt ? "border-v2-danger bg-v2-danger-bg text-v2-danger" : "border-v2-warning/40 bg-v2-warning-bg text-v2-warning"
    }`;
    const pill = (
      <>
        {debt ? <CircleAlert className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden /> : <PayStateIcon state="partial" size="sm" />}
        {fmtSum(c.remaining)}
      </>
    );
    return (
      <span className="block whitespace-nowrap">
        {canPay ? (
          <button type="button" onClick={pay} title={t("To'lash")} className={`${pillCls} transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus`}>
            {pill}
          </button>
        ) : (
          <span className={pillCls}>{pill}</span>
        )}
        {debt ? (
          isCur && canPay ? (
            <span className="mt-0.5 block">
              <button type="button" onClick={pay} className={`${linkBtn} text-v2-caption`}>
                {t("Shu oyni to'lash")}
                <ArrowRight className="size-3" strokeWidth={1.75} aria-hidden />
              </button>
            </span>
          ) : null
        ) : (
          <span className="mt-0.5 block text-v2-caption text-v2-text-3">{t("qoldi · {sum} dan", { sum: fmtSum(c.expected ?? 0) })}</span>
        )}
      </span>
    );
  };

  return (
    <Card
      title={t("Oylar bo'yicha")}
      sub={t("To'lov qaysi oy uchun qilingan bo'lsa, o'sha oyga yoziladi")}
      flush
      action={
        canPay && (
          <button
            type="button"
            onClick={() => onPay()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand px-3 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
            {t("To'lov qabul qilish")}
          </button>
        )
      }
    >
      {rows.length === 0 || ledger.empty ? (
        <div className="border-t border-v2-border">
          <EmptyBlock
            icon={<Wallet className="size-5" strokeWidth={1.75} />}
            title={t("Oylar bo'yicha hisob yo'q")}
            text={t("Guruh darslari boshlangach, har oy uchun to'lov holati shu yerda ko'rinadi.")}
          />
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto border-t border-v2-border">
            <table className="w-full min-w-[40rem] border-collapse text-v2-small">
              <thead>
                <tr className="bg-v2-surface-2 text-left">
                  <th scope="col" className="sticky left-0 z-[1] min-w-[11rem] bg-v2-surface-2 px-4 py-2 font-medium text-v2-text-2">
                    {t("Guruh")}
                  </th>
                  {ledger.months.map((m) => (
                    <th key={m} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${m === cur ? `${colCur} font-semibold text-v2-text` : "text-v2-text-2"}`}>
                      {fmt.monthName(m)}
                      {m === cur && <span className="ml-1.5 rounded-v2-full bg-v2-brand-bg px-1.5 py-px text-v2-caption font-medium text-v2-brand-text">{t("joriy")}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.group.id} className="border-t border-v2-border">
                    <th scope="row" className="sticky left-0 z-[1] bg-v2-surface px-4 py-2.5 text-left font-normal">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(r.group.course)]}`} aria-hidden />
                        <span className="truncate font-semibold text-v2-text">{groupTitle(r.group)}</span>
                      </span>
                      <span className="mt-0.5 block pl-4 text-v2-caption tabular-nums text-v2-text-3">
                        {r.group.monthlyPrice !== null ? t("{sum} so'm / oy", { sum: fmtSum(r.group.monthlyPrice) }) : t("narx belgilanmagan")}
                      </span>
                    </th>
                    {ledger.months.map((m) => {
                      const c = r.cells[m];
                      // Qisman oy (oy o'rtasida qo'shilgan/chiqqan): summa darslar ulushidan.
                      const partialMonth = c && c.expected !== null && c.lessons < c.fullLessons;
                      return (
                        <td
                          key={m}
                          title={partialMonth ? t("{a} / {b} dars — {sum} so'm", { a: c.lessons, b: c.fullLessons, sum: fmtSum(c.expected ?? 0) }) : undefined}
                          className={`px-3 py-2.5 align-top ${m === cur ? colCur : ""}`}
                        >
                          {cellView(c, r.group.id)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-v2-border">
                  <th scope="row" className="sticky left-0 z-[1] bg-v2-surface px-4 py-2.5 text-left font-semibold text-v2-text">
                    {t("Oy bo'yicha qarz, so'm")}
                  </th>
                  {ledger.months.map((m) => (
                    <td key={m} className={`px-3 py-2.5 tabular-nums ${m === cur ? `${colCur} font-semibold text-v2-text` : "text-v2-text-2"}`}>
                      {m > cur ? "—" : fmtSum(ledger.monthDebt[m] ?? 0)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
            {(
              [
                ["paid", t("To'langan")],
                ["partial", t("Qisman")],
                ["debt", t("Qarz")],
                ["future", t("Kelgusi oy")],
                ["none", t("Guruhda emas")],
              ] as const
            ).map(([s, label]) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <PayStateIcon state={s} size="sm" />
                {label}
              </span>
            ))}
          </div>
          {(ledger.olderDebt > 0 || unassigned > 0 || ledger.incomplete || (ledger.offset > 0 && ledger.monthDebtSum > 0)) && (
            <div className="space-y-1 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
              {ledger.incomplete && (
                <div>
                  <IncompleteNote ledger={ledger} />
                  <p className="mt-0.5 pl-5">
                    {ledger.unpricedPaid > 0 && `${t("Shu guruhlarga yozilgan {sum} so'm to'lov qarz hisobiga kirmadi.", { sum: fmtSum(ledger.unpricedPaid) })} `}
                    <Link href="/offline-courses" className="font-medium text-v2-brand-text underline-offset-2 hover:underline">
                      {t("Narxni Sozlamalar → Kurslar'da kiriting")}
                    </Link>
                  </p>
                </div>
              )}
              {ledger.offset > 0 && ledger.monthDebtSum > 0 && (
                <p>
                  {t("Boshqa oylarda ortiqcha to'langan {offset} so'm qarzdan ayrildi: oylar bo'yicha {a} so'm, jami qarz", {
                    offset: fmtSum(ledger.offset),
                    a: fmtSum(ledger.monthDebtSum),
                  })}{" "}
                  <b className="font-semibold tabular-nums text-v2-text">
                    {fmtSum(ledger.debt)} {t("so'm")}
                  </b>
                  .
                </p>
              )}
              {ledger.olderDebt > 0 && (
                <p>
                  {t("Oldingi oylardan qarz:")} <b className="font-semibold tabular-nums text-v2-danger">{fmtSum(ledger.olderDebt)} {t("so'm")}</b>
                </p>
              )}
              {unassigned > 0 && (
                <p>{t("Guruhga bog'lab bo'lmagan to'lov: {sum} so'm — o'qituvchisi o'quvchining guruhlariga to'g'ri kelmaydi.", { sum: fmtSum(unassigned) })}</p>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ── To'lovlar tarixi ─────────────────────────────────────────────── */

function HistoryTable({ data, fmt, onReceipt, since }: TabProps & { since: string }) {
  const { t } = useT();
  const [gf, setGf] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const groupById = useMemo(() => new Map(data.groups.map((g) => [g.id, g])), [data.groups]);
  const withGroup = useMemo(() => data.entries.map((e) => ({ e, gid: entryGroupId(e, data.groups) })), [data.entries, data.groups]);
  const gids = [...new Set(withGroup.map((x) => x.gid).filter((x): x is number => x !== null))];
  const options = [{ value: "all", label: t("Hammasi") }, ...gids.map((id) => ({ value: String(id), label: groupById.get(id)?.course || groupById.get(id)?.label || `#${id}` }))];
  const filter = options.some((o) => o.value === gf) ? gf : "all";
  const list = filter === "all" ? withGroup : withGroup.filter((x) => String(x.gid) === filter);
  const active = list.filter((x) => isActiveEntry(x.e));
  const total = active.reduce((s, x) => s + x.e.amount, 0);
  const curYear = data.asOf.slice(0, 4);

  const row = ({ e, gid }: { e: ProfileEntry; gid: number | null }) => {
    const cancelled = e.status === "cancelled";
    const refund = e.txType === "payOut";
    const g = gid !== null ? groupById.get(gid) : undefined;
    const pm = e.periodMonth;
    return (
      <tr key={e.id} className={`border-t border-v2-border transition-colors hover:bg-v2-hover ${cancelled ? "text-v2-text-3" : ""}`}>
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={() => onReceipt(e)}
            disabled={cancelled}
            title={t("Chekni ko'rish")}
            aria-label={t("Chekni ko'rish")}
            className="inline-flex size-7 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="size-3.5" strokeWidth={1.75} />
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
          <span className={cancelled ? "" : "text-v2-text"}>{fmt.dayMonth(e.date)}</span>
          {e.time && <span className="text-v2-text-3"> | {e.time}</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
          <span className={`font-semibold ${cancelled ? "line-through" : refund ? "text-v2-danger" : "text-v2-text"}`}>{fmtSum(e.amount)}</span>
          {!cancelled && e.paid !== e.amount && e.paid > e.amount && (
            <span className="block text-v2-caption font-normal text-v2-text-3">{t("+{sum} tanga chegirmasi", { sum: fmtSum(e.paid - e.amount) })}</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-full ${cancelled ? "bg-v2-text-3" : methodDot(e.paymentMethodKey || e.paymentType)}`} aria-hidden />
            {refund ? t("Qaytarim") : e.paymentType ? t(e.paymentType) : "—"}
          </span>
          {cancelled && <span className="ml-2 rounded-v2-full bg-v2-surface-2 px-1.5 py-px text-v2-caption">{t("bekor qilingan")}</span>}
          {e.status === "waiting" && <span className="ml-2 rounded-v2-full bg-v2-warning-bg px-1.5 py-px text-v2-caption text-v2-warning">{t("kutilmoqda")}</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          {fmt.monthName(pm)}
          {pm.slice(0, 4) !== curYear && <span className="text-v2-text-3"> {pm.slice(0, 4)}</span>}
        </td>
        <td className="px-3 py-2">
          {g ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
              <span className="truncate">{groupTitle(g)}</span>
            </span>
          ) : (
            <span className="text-v2-text-3" title={e.teacherName ? t("O'qituvchi: {name}", { name: e.teacherName }) : undefined}>
              —
            </span>
          )}
        </td>
        <td className="px-3 py-2">{e.cashboxName || <span className="text-v2-text-3">—</span>}</td>
      </tr>
    );
  };

  const th = "whitespace-nowrap px-3 py-2 text-left font-medium text-v2-text-2";
  return (
    <Card
      title={t("To'lovlar tarixi")}
      count={t("{n} ta", { n: list.length })}
      flush
      action={options.length > 2 && <SegTabs value={filter} onChange={(v) => { setGf(v); setLimit(PAGE); }} options={options} label={t("Guruh")} />}
    >
      {data.entries.length === 0 ? (
        <div className="border-t border-v2-border">
          <EmptyBlock icon={<History className="size-5" strokeWidth={1.75} />} title={t("Hali to'lov qilinmagan")} text={t("Qabul qilingan to'lovlar shu yerda chek bilan ko'rinadi.")} />
        </div>
      ) : (
        <div className="relative overflow-x-auto border-t border-v2-border">
          <table className="w-full min-w-[46rem] border-collapse text-v2-small">
            <thead>
              <tr className="bg-v2-surface-2">
                <th scope="col" className="w-14 px-4 py-2 text-left font-medium text-v2-text-2">{t("Chek")}</th>
                <th scope="col" className={th}>{t("Sana")}</th>
                <th scope="col" className={`${th} text-right`}>{t("Summa, so'm")}</th>
                <th scope="col" className={th}>{t("To'lov turi")}</th>
                <th scope="col" className={th}>{t("Qaysi oy uchun")}</th>
                <th scope="col" className={th}>{t("Guruh")}</th>
                <th scope="col" className={th}>{t("Kassa")}</th>
              </tr>
            </thead>
            <tbody>{list.slice(0, limit).map(row)}</tbody>
            <tfoot>
              <tr className="border-t border-v2-border bg-v2-surface-2">
                <th scope="row" colSpan={2} className="px-4 py-2.5 text-left font-semibold text-v2-text">
                  {t("Jami")}
                </th>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{fmtSum(total)}</td>
                <td colSpan={4} className="px-3 py-2.5 text-v2-caption text-v2-text-2">
                  {[filter === "all" ? since : "", t("{n} ta to'lov", { n: active.filter((x) => x.e.txType === "payIn").length })].filter(Boolean).join(" · ")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {list.length > limit && (
        <div className="border-t border-v2-border px-4 py-2.5">
          <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={linkBtn}>
            {t("Yana {n} ta ko'rsatish", { n: Math.min(PAGE, list.length - limit) })}
          </button>
        </div>
      )}
      {data.legacyCount > 0 && (
        <div className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
          {t("Eski tizimdagi to'lovlar (09.2026 gacha): {n} ta.", { n: data.legacyCount })}{" "}
          <Link href={`/student-edit/${data.pupil.id}?src=list&classic=1&tab=tranzaksiya`} className="font-medium text-v2-brand-text underline-offset-2 hover:underline">
            {t("Eski ko'rinishda ochish")}
          </Link>
        </div>
      )}
    </Card>
  );
}
