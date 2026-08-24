"use client";

import Link from "next/link";
import { Info } from "lucide-react";

// Nazorat > Turniket analitikasi (/nazorat-turnstile).
//
// ILGARI: `lib/turnstile.ts` LCG generatori (seed = i*9301+49297) bilan 87 ta
// SOXTA turniket voqeasi yasardi — ism, kirish/chiqish vaqti, "rejalashtirilgan
// boshlanish", kechikish daqiqalari va hatto turniket qurilmasining nomi ham
// o'ylab topilgan edi.
//
// KEYIN (oraliq holat): generator olib tashlandi, lekin o'rniga
// `useMemo<TurnstileEvent[]>(() => [], [])` — hech qachon to'lmaydigan bo'sh
// massiv qoldi. Sana oralig'i, "Foydalanuvchi turi" va "Turi" tanlovlari
// hamda Pagination o'sha bo'sh massivni filtrlab-sahifalab turardi, jadval
// tepasida esa "Umumiy soni: 0" yozuvi turardi. Bu ikki tomondan noto'g'ri
// edi: boshqaruvlar ishlaydiganday ko'rinib hech narsa qilmasdi, "0" esa
// "shu oraliqda nol marta kirish-chiqish bo'ldi" degan FAKT da'vosi bo'lardi —
// aslida esa tizimga birorta ham voqea umuman kelmaydi.
//
// HOZIR: ishlay olmaydigan boshqaruvlar olib tashlandi, son o'rnida
// CHIZIQCHA turadi, sabab esa quyidagi izohda ochiq yozilgan. Bu jadval har
// bir turniket VOQEASINI (kirish/chiqish urinishini) va rejadan chetlanishni
// talab qiladi — buning uchun turniket qurilmasi bilan integratsiya kerak,
// loyihada esa na integratsiya, na voqealar kolleksiyasi bor.
//
// Bazada MAVJUD yagona turniket manbasi — `turnstile_io` kolleksiyasi
// (/api/turnstile-io): u voqealarni emas, har bir odam uchun KUNLIK
// jamlanmani (birinchi kirish, oxirgi chiqish, holat) saqlaydi va
// "Turniket kirish-chiqish analitikasi" sahifasida ko'rsatiladi. Uning
// yozuvlarida bu jadval so'raydigan rejalashtirilgan vaqt, kechikish
// daqiqalari va qurilma nomi yo'q — shuning uchun ular bu yerga
// ko'chirilmaydi.

export default function NazoratTurnstilePage() {
  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <h2 className="text-[18px] font-semibold tracking-tight">Turniket analitikasi</h2>

      {/* Manba yo'qligini ochiq aytamiz. */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
        <Info className="icon icon-sm shrink-0 mt-0.5" />
        <p>
          Turniket voqealari (har bir kirish/chiqish urinishi, rejalashtirilgan vaqtdan
          kechikish va qurilma nomi) tizimga kelmaydi — turniket qurilmasi bilan
          integratsiya yo&apos;q. Shu sabab bu yerda sana, foydalanuvchi turi va voqea
          turi bo&apos;yicha filtrlar ko&apos;rsatilmaydi: filtrlaydigan yozuvning o&apos;zi yo&apos;q.
          Mavjud turniket ma&apos;lumoti kunlik jamlanma ko&apos;rinishida{" "}
          <Link href="/nazorat-turnstile-io" className="text-primary hover:underline">
            Turniket kirish-chiqish analitikasi
          </Link>{" "}
          sahifasida ko&apos;rsatiladi.
        </p>
      </div>

      {/* Jadval — faqat sarlavhalar: integratsiya paydo bo'lganda hisobot
          qanday ustunlardan iborat bo'lishini ko'rsatib turadi. */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          {/* "0" emas, chiziqcha: nol voqea sodir bo'lgan degan da'vo emas,
              voqealar umuman tizimga kelmaydi. */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium"
            title="Turniket voqealari uchun manba yo'q — sonni hisoblab bo'lmaydi."
          >
            <span>Umumiy soni:</span>
            <span className="tabular-nums">—</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1800px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 text-left w-12">№</th>
                <th className="px-3 py-3 text-left min-w-[180px]">To&apos;liq ismi</th>
                <th className="px-3 py-3 text-left">Foydalanuvchi turi</th>
                <th className="px-3 py-3 text-left">Voqea turi</th>
                <th className="px-3 py-3 text-left">Vaqti</th>
                <th className="px-3 py-3 text-left">Rejalashtirilgan bo...</th>
                <th className="px-3 py-3 text-left">Rejalashtirilgan tu...</th>
                <th className="px-3 py-3 text-center">Kechikish mavjud</th>
                <th className="px-3 py-3 text-right">Kechikish (daq.)</th>
                <th className="px-3 py-3 text-center">Erta ketish mavjud</th>
                <th className="px-3 py-3 text-right">Erta ketish (daq.)</th>
                <th className="px-3 py-3 text-left pr-5">Turniket nomi</th>
              </tr>
            </thead>
          </table>
        </div>

        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
            <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
          </div>
          <h3 className="text-[15px] font-semibold mb-1">Ma&apos;lumotlar topilmadi</h3>
          <p className="text-[13px] text-muted-foreground max-w-sm">
            Turniket voqealari tizimga hali kelmaydi.
          </p>
        </div>
      </div>
    </div>
  );
}
