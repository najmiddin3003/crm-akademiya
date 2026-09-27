"use client";

import { useEffect, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { Order } from "@/lib/ordersData";
import { useT } from "@/components/shared/Language";

// O'quvchi profili → "Harakatlar tarixi".
//
// ILGARI NIMA NOTO'G'RI EDI: fayl UCHTA QATTIQ YOZILGAN qatorni
// ("Birinchi to'lov: null → {}", "paidAt: null → {}", "Balans: 0 → <summa>")
// va har birida `"Windows", chrome` degan o'ylab topilgan qurilma nomini
// haqiqiy audit izi sifatida chizardi. Faylda birorta so'rov yo'q edi:
// bu qatorlar hech qachon sodir bo'lmagan hodisalar edi.
//
// NIMA UCHUN API YO'LI TANLANDI (bo'sh holatni shundoq qoldirish o'rniga):
// harakatlar jurnali — oddiy ro'yxat shaklidagi ma'lumot, unga tashqi
// xizmat kerak emas. Shu bois GET /api/pupils/:id/activity qo'shildi
// (MongoDB `pupil_activity`) va tab AYNAN SHUNDAN o'qiydi. Yozuvni hali
// hech bir route qo'ymaydi (buning uchun PATCH /api/pupils/:id o'zgargan
// maydonlarni jurnalga yozishi kerak), shuning uchun ro'yxat hozircha
// bo'sh — lekin bo'shligi HAQIQIY so'rov natijasi va yozish qo'shilgan
// kuni tab hech qanday o'zgarishsiz ishlab ketadi.

interface ActivityEntry {
  id: number;
  pupilId: number;
  field: string;
  from: string;
  to: string;
  staff: string;
  kind: string;
  device: string;
  date: string;
  time: string;
}

// `balans` propi endi ishlatilmaydi (u soxta qatorlarni "haqiqiyroq"
// ko'rsatish uchun kerak edi), lekin StudentEditPage uni hali uzatadi —
// tipda ixtiyoriy qilib qoldiramiz.
export default function HarakatlarTabContent({ order }: { order: Order; balans?: number }) {
  const { t } = useT();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pupils/${order.id}/activity`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setEntries(d.entries as ActivityEntry[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [order.id]);

  // Javob kelmaguncha "hech narsa yo'q" deyish mumkin emas.
  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border">
        <SpinnerBlock />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border py-14 text-center">
        <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
        <div className="text-[14px] font-medium">{t("Harakatlar tarixi bo'sh")}</div>
        <div className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">
          Bu o&apos;quvchi bo&apos;yicha jurnalga (<code>{"pupil_activity"}</code>) hali birorta yozuv
          tushmagan — tizim o&apos;zgarishlarni hozircha qayd qilmaydi.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-4 flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-[14px]">{entry.staff || "—"}</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <svg className="icon icon-xs"><use href="#i-calendar" /></svg>
              {entry.date || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 16 14" />
              </svg>
              {entry.time || "—"}
            </span>
          </div>
          <div className="table-box">
            <table className="w-full text-sm border-collapse">
              <thead className="text-[12px] text-muted-foreground uppercase bg-secondary/20">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">{t("Ism")}</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">{t("Harakatlar")}</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">{t("Xodim")}</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">{t("Turi")}</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">{t("Qurilma nomi")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-[13px] border border-border">{entry.field || "—"}</td>
                  <td className="px-4 py-3 text-[13px] border border-border">
                    <div>{entry.from || "—"}</div>
                    <div className="text-muted-foreground">&rarr;</div>
                    <div>{entry.to || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px] border border-border">{entry.staff || "—"}</td>
                  <td className="px-4 py-3 text-[13px] border border-border">{entry.kind || "—"}</td>
                  {/* Qurilma nomi jurnalga yozilmagan bo'lsa "—" — ilgari
                      bu yerda har doim `"Windows", chrome` turardi. */}
                  <td className="px-4 py-3 text-[13px] border border-border">{entry.device || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
