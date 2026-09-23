"use client";

import { loadBalancesByIdCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { Info } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import { pupilFullName, pupilStatusOf } from "@/lib/pupilsData";
import { useT } from "@/components/shared/Language";

// O'quvchilar → Joriy oyda obunasi tugaydiganlar (href /expiring-subs).
//
// ILGARI: butun sahifa constants/expiringSubs.js dagi generatorga tayanardi —
// 370 ta o'ylab topilgan o'quvchi, tasodifiy ism/telefon, COST_BUCKETS dan
// tasodifiy "dars narxi" va tasodifiy balans (~70% i ataylab chuqur
// qarzdorlikda "chiroyli" ko'rinsin uchun). Yuqoridagi uchta raqam —
// "Jami darslar narxi", "Joriy balans", "Kutilayotgan balans" — aynan shu
// soxta pullar yig'indisi edi, ya'ni ekranda MILLIARDLAB yolg'on so'm turardi.
// "Statusi" filtri (To'langan/Qarzdor/Kritik) ham o'sha generator qo'ygan
// belgini filtrlardi.
//
// ENDI:
//   • odamlar — /api/pupils (haqiqiy o'quvchilar, holati "Aktiv" bo'lganlar);
//   • "Joriy balans" — /api/students/balances, ya'ni transaction_entries
//     dagi bekor qilinmagan payIn yozuvlari yig'indisi (HAQIQIY to'lovlar).
//     pupils.balance maydoni o'qilmaydi — uni hech bir API yangilamaydi.
//
// MANBASI YO'Q QIYMATLAR (rule b — "—", 0 emas):
//   • "Jami darslar narxi": tizimda dars narxi × dars soni yuritilmaydi
//     (app/api/students/balances/route.ts izohi ham shuni aytadi);
//   • "Kutilayotgan balans": u = joriy balans − jami darslar narxi, ya'ni
//     yo'q qiymatdan kelib chiqadi;
//   • "Statusi" filtri (To'langan/Qarzdor/Kritik): to'lanishi KERAK bo'lgan
//     summa yo'q ekan, kimning qarzdor ekanini aytib bo'lmaydi — shuning
//     uchun filtr butunlay olib tashlandi (ishlamaydigan boshqaruv
//     qoldirilmaydi).
//
// SAHIFA NOMI HAQIDA: obuna tugash sanasi maydoni ham hech qayerda yo'q,
// shuning uchun ro'yxatni "joriy oyda tugaydiganlar" bo'yicha toraytirib
// bo'lmaydi. Buni yashirmasdan ekranda aytamiz.

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}
function balCls(n: number): string {
  return n < 0 ? "text-rose-600 font-semibold" : n > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground";
}

/** Manbasi bo'lmagan qiymat. */
function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

interface Row {
  id: number;
  name: string;
  phone: string;
  balance: number;
}

export default function ExpiringSubsPage() {
  const { t } = useT();
  // SERVERDA filtrlanadi (pastda ham `Aktiv` sharti bor edi) va faqat
  // id/ism/telefon so'raladi — sahifa boshqa maydonni ishlatmaydi.
  const { pupils, loading: pupilsLoading } = useStudents({ light: true, status: "Aktiv" });
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    loadBalancesByIdCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      // Xato bo'lsa balans ustuni bo'sh qoladi — ilgari ham shunday edi.
      .catch(() => {})
      .finally(() => { if (!cancelled) setBalancesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loading = pupilsLoading || balancesLoading;

  const rows = useMemo<Row[]>(() => {
    return pupils
      // Holat — HAQIQIY maydon (pupils.status). Arxiv/muzlatilgan o'quvchining
      // obunasi haqida gap ketmaydi.
      .filter((p) => pupilStatusOf(p) === "Aktiv")
      .map((p) => {
        const name = pupilFullName(p);
        return {
          id: p.id,
          name,
          phone: (p.phone ?? "").trim(),
          // To'lov yozuvi bo'lmasa 0 — bu "ma'lumot yo'q" emas, "hali
          // to'lov qilinmagan" degani (yig'indi bo'sh to'plam ustidan).
          balance: balances[p.id] ?? 0,
        };
      });
  }, [pupils, balances]);

  // Faqat HAQIQIY balanslar yig'indisi. Qolgan ikki ko'rsatkichning manbasi
  // yo'q, shuning uchun ular hisoblanmaydi ham.
  const currentBalance = useMemo(() => rows.reduce((sum, r) => sum + r.balance, 0), [rows]);

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Statistika */}
      <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-[13px]">
        <span>
          <span className="text-muted-foreground font-medium">{t("Jami darslar narxi")}</span>
          <span className="ml-1"><Dash /></span>
        </span>
        <span className="border-l border-border pl-6">
          <span className="text-muted-foreground font-medium">{t("Joriy balans")}</span>
          <span className={`font-semibold tabular-nums ml-1 ${currentBalance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {loading ? "…" : fmtUZS(currentBalance)}
          </span>
        </span>
        <span className="border-l border-border pl-6">
          <span className="text-muted-foreground font-medium">{t("Kutilayotgan balans")}</span>
          <span className="ml-1"><Dash /></span>
        </span>
      </div>

      {/* Nima uchun ba'zi raqamlar "—" ekanini ekranda aytamiz. */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <p>
          {t("Tizimda obuna tugash sanasi ham, dars narxi × dars soni hisobi ham yuritilmaydi. Shu sabab ro'yxatni \"joriy oyda tugaydiganlar\" bo'yicha ajratib bo'lmaydi — quyida barcha")}{" "}<span className="font-medium">{t("aktiv")}</span>{" "}
          o&apos;quvchilar ko&apos;rsatilgan. &quot;Jami darslar narxi&quot; va &quot;Kutilayotgan balans&quot;
          ustunlari manbasiz, shuning uchun &quot;—&quot;. &quot;Joriy balans&quot; esa
          haqiqiy: bu o&apos;quvchi qilgan to&apos;lovlar yig&apos;indisi.
        </p>
      </div>

      {/* Umumiy soni */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
          <span className="font-bold tabular-nums">{rows.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <SpinnerBlock />
        ) : (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-3 py-3 whitespace-nowrap w-12">№</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("O'quvchini ismi")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Telefon raqam")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Jami darslar narxi")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Joriy balans")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Kutilayotgan balans")}</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap w-24" />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r, i) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                      <td className="px-3 py-3 text-[13px] font-medium">
                        <Link href={`/student-edit/${r.id}?src=list`} className="hover:text-primary hover:underline">{r.name}</Link>
                      </td>
                      <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">
                        {r.phone || <Dash />}
                      </td>
                      {/* Dars narxi hisobi yo'q (rule b). */}
                      <td className="px-3 py-3 text-[13px]"><Dash /></td>
                      <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${balCls(r.balance)}`}>{fmtUZS(r.balance)}</td>
                      {/* Joriy balans − jami darslar narxi: ikkinchisi yo'q. */}
                      <td className="px-3 py-3 text-[13px]"><Dash /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Link href={`/student-edit/${r.id}?src=list`} className="text-primary hover:underline text-[12px]">{t("Batafsil")}</Link>
                      </td>
                    </tr>
                  ))}
                  {slice.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        {t("Aktiv o'quvchi topilmadi")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              totalItems={rows.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </>
        )}
      </div>
    </div>
  );
}
