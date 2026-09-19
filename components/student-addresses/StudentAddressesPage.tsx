"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { MapPinOff } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import { pupilFullName } from "@/lib/pupilsData";
import { useT } from "@/components/shared/Language";

// O'quvchilar → O'quvchilar manzillari (href /student-addresses).
//
// ILGARI: sahifa constants/studentAddresses.js dagi generatordan 140 ta
// BUTUNLAY O'YLAB TOPILGAN o'quvchini olardi — tasodifiy ism, tasodifiy
// telefon, tasodifiy "Chilonzor tumani" va Toshkent markazi atrofida
// SEED'LANGAN koordinatalar. Xaritadagi har bir nuqta yolg'on edi: bunday
// o'quvchi ham, bunday manzil ham bazada yo'q.
//
// ENDI: manzillar HAQIQIY manbadan — pupils.addresses[] (o'quvchi
// profilidagi "Manzil" tabi yozadi) va pupils.address (profil formasidagi
// "Uy manzili" maydoni).
//
// NEGA XARITA YO'Q: saqlanadigan manzil — faqat MATN. PupilAddress modeli
// { id, name, type } dan iborat (lib/pupilsData.ts), PATCH /api/pupils/:id
// ham aynan shu uchta maydonni saqlaydi — koordinata (lat/lng) hech qayerda
// yo'q va geokodlash xizmati ham ulanmagan. Koordinatani o'zimiz "taxmin
// qilish" — aynan olib tashlangan yolg'onning o'zi bo'lardi. Shu sabab
// manzillar RO'YXAT ko'rinishida ko'rsatiladi va sababi ekranda yozib
// qo'yilgan. Geokodlash qo'shilgach xarita qaytariladi.
//
// "Barcha filiallar" tanlovi ham olib tashlandi: o'quvchi yozuvida filial
// maydoni umuman yo'q, ya'ni u ilgari ham faqat o'ylab topilgan `filial`
// qiymatini filtrlardi.

interface AddressRow {
  key: string;
  pupilId: number;
  pupilName: string;
  phone: string;
  /** Manzil matni — pupils.addresses[].name yoki pupils.address. */
  text: string;
  /** "Uy" / "Ish" / ... yoki "" (profil formasidagi manzilda tur so'ralmaydi). */
  type: string;
  /** Qaysi maydondan kelgani — foydalanuvchi qayerdan tahrirlashini bilsin. */
  source: string;
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export default function StudentAddressesPage() {
  const { t } = useT();
  // Manzil maydonlari standart to'plamda YO'Q — ataylab so'raymiz.
  // Manzili borlar serverda ajratiladi — ilgari 6 747 dan 198 tasi qolardi.
  const { pupils, loading } = useStudents({ extra: ["address", "addresses"] as const, hasAddress: true });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const rows = useMemo<AddressRow[]>(() => {
    const out: AddressRow[] = [];
    for (const p of pupils) {
      const pupilName = pupilFullName(p);
      const phone = (p.phone ?? "").trim();

      // "Manzil" tabidagi yozuvlar (bir o'quvchida bir nechta bo'lishi mumkin).
      for (const a of p.addresses ?? []) {
        const text = (a.name ?? "").trim();
        if (!text) continue;
        out.push({
          key: `${p.id}-a${a.id}`,
          pupilId: p.id,
          pupilName,
          phone,
          text,
          type: (a.type ?? "").trim(),
          source: "Manzil tabi",
        });
      }

      // Profil formasidagi "Uy manzili" — alohida maydon, tabdagi ro'yxatga
      // kirmaydi, shuning uchun u ham qator sifatida ko'rsatiladi.
      const single = (p.address ?? "").trim();
      if (single) {
        out.push({
          key: `${p.id}-home`,
          pupilId: p.id,
          pupilName,
          phone,
          text: single,
          type: "",
          source: "Uy manzili",
        });
      }
    }
    return out;
  }, [pupils]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.pupilName} ${r.phone} ${r.text} ${r.type}`.toLowerCase().includes(q));
  }, [rows, search]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-[18px] font-semibold tracking-tight">{t("O'quvchilar manzillari")}</h1>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
            <span className="font-bold tabular-nums">{filtered.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
          </div>
          <div className="relative w-64">
            <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              type="text"
              placeholder={t("Qidirish")}
              className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* Xarita nega yo'qligi — ekranda ochiq aytiladi. */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
        <MapPinOff className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <p>
          Xarita ko&apos;rsatilmayapti: o&apos;quvchining manzili tizimda faqat MATN sifatida
          saqlanadi (<span className="font-medium">pupils.addresses</span> va{" "}
          <span className="font-medium">pupils.address</span>), koordinata maydoni yo&apos;q va
          geokodlash xizmati ulanmagan. Belgilarni xaritaga qo&apos;yish uchun koordinatani
          o&apos;ylab topish kerak bo&apos;lardi — shu sabab manzillar ro&apos;yxat ko&apos;rinishida.
        </p>
      </div>

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
                    <th className="text-left px-3 py-3">{t("Manzil")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Manzil turi")}</th>
                    <th className="text-left px-3 py-3 whitespace-nowrap">{t("Manba")}</th>
                    <th className="text-right px-3 py-3 whitespace-nowrap w-24" />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r, i) => (
                    <tr key={r.key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                      <td className="px-3 py-3 text-[13px] font-medium whitespace-nowrap">
                        <Link href={`/student-edit/${r.pupilId}`} className="hover:text-primary hover:underline">{r.pupilName}</Link>
                      </td>
                      <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">
                        {r.phone || <Dash />}
                      </td>
                      <td className="px-3 py-3 text-[13px]">{r.text}</td>
                      <td className="px-3 py-3 text-[13px]">{r.type || <Dash />}</td>
                      <td className="px-3 py-3 text-[12px] text-muted-foreground whitespace-nowrap">{t(r.source)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Link href={`/student-edit/${r.pupilId}?src=list&tab=manzil`} className="text-primary hover:underline text-[12px]">
                          {t("Batafsil")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {slice.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        {rows.length === 0
                          ? t("Hech bir o'quvchiga manzil kiritilmagan. Manzilni o'quvchi profilidagi \"Manzil\" tabida qo'shing.")
                          : t("Manzil topilmadi")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              totalItems={filtered.length}
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
