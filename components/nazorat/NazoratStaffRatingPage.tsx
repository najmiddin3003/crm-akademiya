"use client";

import { Info } from "lucide-react";
import { useT } from "@/components/shared/Language";

// Nazorat > Xodimlar reytingi (/nazorat-staff-rating).
//
// ILGARI: `lib/staffRating.ts` modul yuklanishida LCG generator bilan 61 ta
// SOXTA baho yozuvi yasardi (o'qituvchilar "weight" bo'yicha tanlanar,
// baho `seed % 100` dan chiqar edi), "O'rtacha reyting" ham o'sha
// yozuvlardan hisoblanardi.
//
// KEYIN (oraliq holat): generator olib tashlandi, lekin uning o'rniga
// `useMemo<StaffRating[]>(() => [], [])` — ya'ni HECH QACHON to'lmaydigan
// bo'sh massiv qoldi. Sana oralig'i tanlagichi, yettita select, qator
// chizadigan blok va Pagination o'sha bo'sh massivni filtrlab, sahifalab
// turardi: foydalanuvchi bosadi, tanlaydi — natija esa hech qachon
// o'zgarmaydi. Bu ishlaydigan boshqaruvga o'xshab ko'rinadigan O'LIK
// boshqaruv edi.
//
// HOZIR: ishlay olmaydigan boshqaruvlar butunlay OLIB TASHLANDI. Yozuvlar
// yo'q, chunki manba yo'q: `staff_ratings` kolleksiyasi ham, API route ham,
// darsdan keyin baho so'raydigan forma ham mavjud emas. Sahifada nima
// yetishmayotgani ochiq yozib qo'yilgan, "O'rtacha reyting" va "Umumiy soni"
// o'rnida esa CHIZIQCHA turadi — 0.0 yoki 0 yozish "hamma nol baho oldi",
// "nol ta baho qo'yilgan" degan yolg'on da'vo bo'lardi. Jadval sarlavhalari
// qoldirildi: hisobot manba paydo bo'lganda qanday ustunlardan iborat
// bo'lishini ko'rsatib turadi.

function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="#facc15">
      <polygon points="10,1.5 12.6,7.4 19,8.2 14.2,12.5 15.6,18.8 10,15.5 4.4,18.8 5.8,12.5 1,8.2 7.4,7.4" />
    </svg>
  );
}

export default function NazoratStaffRatingPage() {
  const { t } = useT();
  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* O'rtacha reyting — yozuv yo'q, shuning uchun CHIZIQCHA. */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("O'rtacha reyting:")}</span>
        <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
          <span>—</span>
          <StarIcon />
        </span>
      </div>

      {/* Ma'lumot manbasi yo'qligini ochiq aytamiz — bo'sh jadval "xatolik"
          emas, hali baho yig'iladigan joy yo'qligini bildiradi. */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
        <Info className="icon icon-sm shrink-0 mt-0.5" />
        <p>
          Baholar hali yig&apos;ilmaydi: tizimda o&apos;quvchi o&apos;qituvchiga baho qo&apos;yadigan
          forma ham, bahoni saqlaydigan kolleksiya ham yo&apos;q. Shu sabab ro&apos;yxat bo&apos;sh,
          o&apos;rtacha reyting va umumiy son o&apos;rnida chiziqcha turadi. Filtrlar ham
          ko&apos;rsatilmaydi — filtrlaydigan yozuvning o&apos;zi yo&apos;q.
        </p>
      </div>

      {/* Jadval — faqat sarlavhalar: hisobot qanday ustunlardan iborat
          bo'lishini ko'rsatadi. */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          {/* "0" emas, chiziqcha: nol baho qo'yilgan degan da'vo emas,
              baho umuman yig'ilmaydi. */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium"
            title={t("Baho yozuvlari uchun manba yo'q — sonni hisoblab bo'lmaydi.")}
          >
            <span>{t("Umumiy soni:")}</span>
            <span className="tabular-nums">—</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">{t("O'qituvchi")}</th>
                <th className="px-5 py-3 text-left">{t("O'quvchi")}</th>
                <th className="px-5 py-3 text-left">{t("Kurs")}</th>
                <th className="px-5 py-3 text-left">{t("Guruh")}</th>
                <th className="px-5 py-3 text-left">{t("Dars sanasi")}</th>
                <th className="px-5 py-3 text-left">{t("Izoh")}</th>
                <th className="px-5 py-3 text-left">{t("Sana")}</th>
                <th className="px-5 py-3 text-center pr-5">{t("Baho")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td colSpan={9} className="py-16 text-center text-muted-foreground">
                  {t("Baho yozuvlari tizimga kelmaydi")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
