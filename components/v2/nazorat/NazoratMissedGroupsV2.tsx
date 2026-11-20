"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowRight, CircleCheck, Info } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useT } from "@/components/shared/Language";
import { useNazoratAttendance } from "@/components/nazorat/useNazoratAttendance";
import { NoteLine } from "@/components/v2/reports/reportUi";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { B, PageHead, PageShell, SummaryLine, TH, dmy, fmtNum } from "@/components/v2/students/lists/listKit";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import StaffName from "@/components/v2/ui/StaffName";
import { ROW_TINT } from "@/components/v2/ui/table";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { nazoratAttMarkedKeys, nazoratAttMissedLessons, nazoratAttSplitGroups, nazoratAttStartOfMonth } from "./nazoratAttCalc";

// YANGI VERSIYA — NAZORAT → «DAVOMAT QILINMAGAN GURUHLAR» (/nazorat-missed-groups, 28-qism, rasmsiz — 34-qism
// Nazorat va ro'yxat sahifalari qolipida). Eski sahifa (components/nazorat/NazoratMissedGroupsPage.tsx)
// o'zgarmagan; versiya app/(app)/nazorat-missed-groups/page.tsx da serverda tanlanadi.
//   • sarlavha, sana oralig'i (sukut — oy boshidan bugungacha);
//   • xulosa qatori: qoldirilgan darslar soni (faoliyat muddati ma'lum guruh yo'q bo'lsa «—»), guruhlar,
//     «Jami summa —» (dars narxi maydoni yo'q — eskisidagidek son o'ylab topilmaydi);
//   • boshlanish sanasi yo'q guruhlar — ogohlantirish (nomlari guruh sahifasiga havola);
//   • jadval: №, Guruh (fan nuqtasi, kurs · daraja, nomi · vaqti), Sana (+ hafta kuni), O'qituvchi; sahifalash.
// Hisob — eskisidan aynan nusxa (./nazoratAttCalc.ts). Eslatma/jarima amallari — «Davomat nazorati» sahifasida.

const COLS = 4;

export default function NazoratMissedGroupsV2() {
  const { t, lang } = useT();
  const fmt = useProfileFmt();
  const { groups, marks, loading } = useNazoratAttendance();
  const [range, setRange] = useState<DateRange>(() => ({ start: nazoratAttStartOfMonth(new Date()), end: new Date() }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const markedKeys = useMemo(() => nazoratAttMarkedKeys(marks), [marks]);
  const { bounded, unbounded } = useMemo(() => nazoratAttSplitGroups(groups), [groups]);
  const rows = useMemo(() => nazoratAttMissedLessons(bounded, markedKeys, range), [bounded, markedKeys, range]);
  const groupCount = useMemo(() => new Set(rows.map((r) => r.groupId)).size, [rows]);

  const noBounds = !loading && bounded.length === 0;
  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  const period = rangeLabel(range, lang, t);
  const shownUnbounded = unbounded.slice(0, 8);

  return (
    <PageShell>
      <PageHead
        title={t("Davomat qilinmagan guruhlar")}
        subtitle={`${t("Jadval bo'yicha dars bo'lgan, lekin davomat belgisi qo'yilmagan kunlar")} · ${period}`}
        actions={
          <Link href="/nazorat-davomat" className={secondaryBtn}>
            {t("Davomat nazorati")}
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
          allowAll={false}
          align="start"
        />
      </div>

      <SummaryLine
        items={[
          <span key="n" title={noBounds ? t("Faoliyat muddati ma'lum bo'lgan guruh yo'q — sanani baholab bo'lmaydi.") : undefined}>
            {t("Qoldirilgan darslar")} <B tone={!loading && !noBounds && rows.length > 0 ? "danger" : undefined}>{loading ? "…" : noBounds ? "—" : fmtNum(rows.length)}</B>
          </span>,
          !loading && !noBounds && rows.length > 0 ? (
            <span key="g">
              {t("Guruhlar")} <B>{fmtNum(groupCount)}</B>
            </span>
          ) : null,
          <span key="s" className="inline-flex items-center gap-1" title={t("Qoldirilgan dars uchun yo'qotilgan tushumni hisoblab bo'lmaydi: bazada dars narxi maydoni yo'q.")}>
            {t("Jami summa")} <span className="text-v2-text-3">—</span>
            <Info className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          </span>,
        ]}
      />

      {/* Boshlanish sanasi yo'q guruhlar — ular haqida «dars qoldirildi» deyilmaydi. */}
      {!loading && unbounded.length > 0 && (
        <div className="flex items-start gap-3 rounded-v2-md border border-v2-warning/40 bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0">
            <p>
              <b className="font-semibold">{t("{n} ta guruh hisobotga kirmadi", { n: unbounded.length })}</b> —{" "}
              {t(
                "faoliyat boshlanish sanasi yo'q (boshlanish sanasi ham, davri ham bo'sh). Guruh o'sha kuni bo'lgan-bo'lmaganini baza aytmaydi, shuning uchun «dars qoldirildi» deb yozilmaydi. Guruh sahifasida boshlanish sanasini to'ldirsangiz, darhol hisobotga qo'shiladi.",
              )}
            </p>
            <p className="mt-1 text-v2-text-2">
              {shownUnbounded.map((g, i) => (
                <Fragment key={g.id}>
                  {i > 0 && ", "}
                  <Link href={`/groups/${g.id}`} className="rounded-v2-sm font-medium text-v2-brand-text underline-offset-2 hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none">
                    {g.name || `#${g.id}`}
                  </Link>
                </Fragment>
              ))}
              {unbounded.length > shownUnbounded.length && ` ${t("va yana {n} ta", { n: unbounded.length - shownUnbounded.length })}`}
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[640px] border-collapse text-v2-body">
            <caption className="sr-only">{t("Davomat qilinmagan guruhlar")}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-14 pl-4`}>
                  №
                </th>
                <th scope="col" className={TH}>
                  {t("Guruh")}
                </th>
                <th scope="col" className={TH}>
                  {t("Sana")}
                </th>
                <th scope="col" className={`${TH} pr-4`}>
                  {t("O'qituvchi")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    <td className="py-3 pl-4 pr-2.5">
                      <div className="h-3 w-5 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5 py-3">
                      <div className="h-3 w-40 rounded bg-v2-skeleton" />
                      <div className="mt-1.5 h-2.5 w-20 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5 py-3">
                      <div className="h-3 w-24 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5 py-3 pr-4">
                      <div className="h-3 w-28 rounded bg-v2-skeleton" />
                    </td>
                  </tr>
                ))
              ) : slice.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className={`flex size-10 items-center justify-center rounded-v2-md bg-v2-surface shadow-v2-sm ${noBounds ? "text-v2-text-3" : "text-v2-success"}`}>
                        {noBounds ? <Info className="size-5" strokeWidth={1.75} aria-hidden /> : <CircleCheck className="size-5" strokeWidth={1.75} aria-hidden />}
                      </span>
                      <div className="text-v2-section text-v2-text">
                        {noBounds ? t("Faoliyat muddati ma'lum bo'lgan guruh yo'q — hisobotni tuzib bo'lmaydi") : t("Bu davrda davomat qilinmagan dars yo'q")}
                      </div>
                      {!noBounds && <p className="max-w-md text-v2-small text-v2-text-2">{t("Jadval bo'yicha o'tgan har bir darsga kamida bitta belgi qo'yilgan.")}</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                slice.map((r, i) => {
                  const title = [r.course, r.level].filter(Boolean).join(" · ") || r.groupName || `#${r.groupId}`;
                  const sub = [r.groupName, r.time].filter(Boolean).join(" · ");
                  return (
                    <tr key={r.key} className={`border-b border-v2-border ${ROW_TINT.hover}`}>
                      <td className="py-3 pl-4 pr-2.5 tabular-nums text-v2-text-3">{start + i + 1}</td>
                      <td className="px-2.5 py-3">
                        <span className="flex min-w-0 items-start gap-2.5">
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(r.course)]}`} aria-hidden />
                          <span className="min-w-0">
                            <Link
                              href={`/groups/${r.groupId}?tab=jurnal`}
                              className="block truncate rounded-v2-sm font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none"
                            >
                              {title}
                            </Link>
                            {sub && <span className="block truncate text-v2-small tabular-nums text-v2-text-3">{sub}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <span className="block tabular-nums text-v2-text">{dmy(r.date)}</span>
                        <span className="block text-v2-small text-v2-text-3">{fmt.weekday(r.date)}</span>
                      </td>
                      <td className="px-2.5 py-3 pr-4 text-v2-text">
                        <StaffName name={r.teacher} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <V2Pagination
            totalItems={rows.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>

      <NoteLine>
        {t("Faqat faoliyat muddati ma'lum guruhlar, bugungacha. Eslatma va jarima — «Davomat nazorati» sahifasida; o'qituvchilar kesimida —")}{" "}
        <Link href="/reports/davomat-oqituvchilar" className="rounded-v2-sm text-v2-brand-text underline-offset-2 hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none">
          {t("Hisobotlar → Davomat")}
        </Link>
        .
      </NoteLine>
    </PageShell>
  );
}
