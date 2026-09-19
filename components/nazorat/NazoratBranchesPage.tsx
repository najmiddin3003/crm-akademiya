"use client";

import { useEffect, useRef, useState } from "react";
import { Info, MoreVertical } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { useBranches } from "@/hooks/useBranches";
import { downloadTableCsv, downloadTableExcel, type Cell } from "@/lib/exportTable";
import { useT } from "@/components/shared/Language";

// Nazorat > Filiallar holati (/nazorat-branches).
//
// ILGARI: jadval `constants/branches.js` dagi 3 ta QO'LDA YOZILGAN filial va
// ularning 15 ta o'ylab topilgan ko'rsatkichidan (505 buyurtma, 1414 birinchi
// darsga keladigan, 19.8% qarzdorlik...) chizilardi. Ular hech qanday bazaga
// bog'lanmagan sonlar edi, "Jami" qatori esa o'sha uydirmalarni qo'shardi.
//
// HOZIR: filiallar ro'yxati HAQIQIY — /api/branches (MongoDB `branches`,
// Boshqaruv → Filiallar sahifasi boshqaradi).
//
// KO'RSATKICHLAR esa CHIZIQCHA. Sabab: hisobotning har bir ustuni yozuvni
// filialga bog'lashni talab qiladi, bazada esa bunday bog'lanish yo'q —
// `pupils` da ham, `groups` da ham, `orders` da ham filial (branchId)
// maydoni yo'q (filial faqat `hr_employees.branchAssignments` da, ya'ni
// xodimlarda bor). Umumiy sonni bitta filialga yozib qo'yish yoki 0 chiqarish
// yolg'on da'vo bo'lardi, shuning uchun "—" turadi.
//
// OLIB TASHLANGAN: sana tanlagich — hech qanday sonni filtrlamas edi.

interface BranchMetric {
  id: string;
  label: string;
}

// Ustunlar — hisobotning tuzilishi (referensdagi bilan bir xil tartibda).
const METRICS: BranchMetric[] = [
  { id: "buyurtma", label: "Buyurtma" },
  { id: "birinchi", label: "Birinchi darsga keladiganlar" },
  { id: "yangi", label: "Yangi o'quvchi" },
  { id: "aktiv", label: "Aktiv o'quvchilar" },
  { id: "jamiReal", label: "Jami real bor" },
  { id: "guruhOq", label: "Guruh o'quvchilari" },
  { id: "buyKetgan", label: "Buyurtmadan ketganlar" },
  { id: "yangiKetgan", label: "Yangi o'quvchidan ketganlar" },
  { id: "aktivKetgan", label: "Aktiv o'quvchidan ketganlar" },
  { id: "qarzdor", label: "Qarzdorlar" },
  { id: "guruh", label: "Guruh" },
  { id: "birTolov", label: "Birinchi to'lovni qilganlar" },
  { id: "jamiOq", label: "Jami o'quvchi" },
  { id: "jamiAktiv", label: "Jami aktiv" },
  { id: "qarzFoiz", label: "Qarzdorlarning aktivga nisbatan foizi" },
];

/** Hisoblab bo'lmaydigan ko'rsatkich — nol emas, chiziqcha. */
const NA = "—";

export default function NazoratBranchesPage() {
  const { t } = useT();
  const { branches, loading } = useBranches();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const headers = ["№", "Filial", ...METRICS.map((m) => m.label)];
  function exportRows(): Cell[][] {
    return branches.map((b, i) => [i + 1, b.name, ...METRICS.map(() => NA)]);
  }

  function exportCSV() {
    downloadTableCsv(headers, exportRows(), "filiallar-holati.csv");
    setMenuOpen(false);
  }
  function exportExcel() {
    downloadTableExcel(headers, exportRows(), "filiallar-holati.xls");
    setMenuOpen(false);
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground max-w-3xl">
          <Info className="icon icon-sm shrink-0 mt-0.5" />
          <p>
            Filial kesimidagi ko&apos;rsatkichlar hisoblanmaydi: o&apos;quvchi, guruh va
            buyurtma yozuvlari qaysi filialga tegishli ekani bazada saqlanmaydi
            (filial faqat xodimlar kartasida bor). Shu sabab ustunlarda son
            o&apos;rniga &laquo;—&raquo; turadi — nol yozish &laquo;hech narsa yo&apos;q&raquo; degan
            noto&apos;g&apos;ri da&apos;vo bo&apos;lardi.
          </p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="h-10 w-10 rounded-lg hover:bg-secondary inline-flex items-center justify-center border border-border bg-card"
            title={t("Eksport")}
          >
            <MoreVertical className="icon icon-sm" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100">
                  <span className="text-[9px] font-bold text-blue-700">CSV</span>
                </span>
                <span>{t("CSV faylini yuklab olish")}</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100">
                  <span className="text-[9px] font-bold text-emerald-700">XLS</span>
                </span>
                <span>{t("EXCEL faylini yuklab olish")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Asosiy keng jadval.
          Bu sahifada paginatsiya yo'q va pastda yana bitta to'liq jadval
          ("Umumiy natija") turadi — shu sabab boshqa ro'yxat sahifalaridagi
          `page-frame` + `table-frame` zanjiri qo'llanmaydi: ustunli flex'da
          pastdagi blok kontentidan kichrayolmaydi va asosiy jadvalga deyarli
          balandlik qolmasdi. Buning o'rniga scroll qutisiga aniq balandlik
          beriladi — sarlavha shu quti ichida qotib turadi, sahifaning o'zi esa
          odatdagidek scroll bo'laveradi. */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="table-scroll" style={{ maxHeight: "62vh" }}>
          <table className="w-full text-sm min-w-[2400px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 text-left w-12 sticky left-0 bg-secondary/20 z-10">№</th>
                <th className="px-3 py-3 text-left sticky left-12 bg-secondary/20 z-10 min-w-[140px]">{t("Filial")}</th>
                {METRICS.map((m, k) => (
                  <th key={m.id} className={`px-3 py-3 text-right ${k === METRICS.length - 1 ? "pr-5" : ""}`}>{t(m.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {branches.map((b, i) => (
                <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums sticky left-0 bg-card z-10">{i + 1}</td>
                  <td className="px-3 py-3 font-medium sticky left-12 bg-card z-10">{b.name}</td>
                  {METRICS.map((m, k) => (
                    <td key={m.id} className={`px-3 py-3 text-right text-muted-foreground ${k === METRICS.length - 1 ? "pr-5" : ""}`}>
                      {NA}
                    </td>
                  ))}
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={METRICS.length + 2} className="py-16 text-center text-muted-foreground">
                    {loading ? <Spinner size={22} /> : "Filiallar qo'shilmagan"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Umumiy natija */}
      <div>
        <h3 className="text-[14px] font-semibold mb-2 text-muted-foreground">{t("Umumiy natija")}</h3>
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">{t("Filial")}</th>
                <th className="px-5 py-3 text-right">{t("Aktiv")}</th>
                <th className="px-5 py-3 text-right pr-5">{t("Jami real bor")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {branches.map((b, i) => (
                <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{b.name}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{NA}</td>
                  <td className="px-5 py-3 pr-5 text-right text-muted-foreground">{NA}</td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted-foreground">
                    {loading ? <Spinner size={22} /> : "Filiallar qo'shilmagan"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
