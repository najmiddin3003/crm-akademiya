"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/Button";
import SourceOptionsModal from "@/components/sales/SourceOptionsModal";

// Sotuv va marketing → O'quvchilar oqimi (/sales-sources).
//
// O'quvchi QAYERDAN kelgani `pupils.source` da — qo'shish oynasidagi
// majburiy "Manba" maydoni (commit 9ef88c7).
//
// MUHIM: maydon 04.09.2026 da majburiy qilingan. Undan OLDIN qo'shilgan
// o'quvchilarda u hech qachon to'lmaydi. Shu sabab ULUSH faqat manbasi
// MA'LUM bo'lganlardan hisoblanadi, "noma'lum" esa alohida ko'rsatiladi.
//
// ──────────────────────────────────────────────────────────────────
// KO'RINISH QARORLARI (nega aynan shunday)
//
// 1) FORMA. Ma'lumotning vazifasi — manbalarni MIQDOR bo'yicha
//    solishtirish. Bunga gorizontal BAR to'g'ri keladi: nomlar uzun va
//    har xil uzunlikda, tartiblash tabiiy, 2 ta manbada ham, 8 tasida
//    ham bir xil ishlaydi.
//
//    PIE/DONUT ATAYLAB ISHLATILMADI. Ikki bo'lakli pie — klassik
//    anti-naqsh (burchaklarni solishtirish uzunlikni solishtirishdan
//    ancha qiyin), ustiga manbalar 8 tagacha bo'lishi mumkin.
//
// 2) "Ma'lum / jami" nisbati uchun ikki rangli chiziq emas, METER —
//    bitta nisbat uchun to'g'ri forma. Bu yon foyda ham berdi: ikkinchi
//    rang umuman kerak bo'lmadi.
//
// 3) RANG. Bitta hue (brendning teali). Uzunlik allaqachon miqdorni
//    ko'rsatgani uchun ranglarni ko'paytirish ma'lumot qo'shmaydi,
//    faqat shovqin qiladi. `hsl(var(--primary))` — ilovaning o'z
//    o'zgaruvchisi, ya'ni tungi rejim o'z-o'zidan to'g'ri ishlaydi.
//
// 4) Matn rang TOKENLARIDA (muted/foreground), qator rangida EMAS.
//    Har bir qatorda nom va son yozilgan, ya'ni ma'lumot faqat rangga
//    tayanmaydi.

interface Payload {
  sources: { name: string; n: number }[];
  known: number;
  unknown: number;
  total: number;
}

/**
 * Gorizontal bar qatori.
 *
 * Mark spetsifikatsiyasi: qalinligi 24px dan oshmaydi; ma'lumot uchi
 * 4px yumaloq, ASOSDA to'g'ri burchak (chiziq qayerdan boshlanishi
 * aniq ko'rinsin); bitta asosdan o'sadi.
 */
function BarRow({ name, value, max, share }: { name: string; value: number; max: number; share: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="group" title={`${name}: ${value} ta o'quvchi (${share.toFixed(1)}%)`}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[13px] font-medium truncate">{name}</span>
        <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
          {value} ta · {share.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 w-full rounded-sm" style={{ background: "hsl(var(--primary) / 0.10)" }}>
        <div
          className="h-3 transition-[width] duration-500 ease-out"
          style={{
            // Eng kichik qiymat ham ko'rinib tursin (2%), lekin
            // uzunlikni yolg'on ko'rsatmasin — 2% ko'z ilg'amaydigan
            // darajada kichik.
            width: `${Math.max(2, pct)}%`,
            background: "hsl(var(--primary))",
            // Ma'lumot uchi yumaloq, asos to'g'ri burchak.
            borderRadius: "2px 4px 4px 2px",
          }}
        />
      </div>
    </div>
  );
}

/** Bitta nisbat — to'ldirilgan yo'lakcha. Track bir xil hue'ning och qadami. */
function Meter({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[13px] font-medium">Manbasi ko&apos;rsatilgan o&apos;quvchilar</span>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {value} / {total} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full" style={{ background: "hsl(var(--primary) / 0.10)" }}>
        <div
          className="h-2.5 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(0.5, pct)}%`, background: "hsl(var(--primary))" }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, color }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={`text-[22px] font-bold tabular-nums ${color || ""}`}>{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  );
}

export default function StudentSourcesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);

  // Ro'yxat oynasida nom o'zgartirilsa o'quvchilarning `source` matni ham
  // tuzatiladi (app/api/student-sources/options/manage), ya'ni taqsimot
  // eskirib qoladi — shu bois qayta o'qish kerak.
  const load = useCallback(() => {
    fetch("/api/student-sources")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d as Payload); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const max = data?.sources[0]?.n ?? 0;
  const top = data?.sources[0];
  // Ikkinchi o'rin bilan farqi — "eng ko'p" qanchalik ustunligini
  // ko'rsatadi. Bitta manba bo'lsa ma'nosi yo'q.
  const lead = useMemo(() => {
    if (!data || data.sources.length < 2) return null;
    return data.sources[0].n - data.sources[1].n;
  }, [data]);

  return (
    <div className="container mx-auto max-w-[1000px] p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold">O&apos;quvchilar oqimi</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            O&apos;quvchilar markazga qayerdan kelayotgani — qo&apos;shish oynasidagi
            &laquo;Manba&raquo; maydoni bo&apos;yicha.
          </p>
        </div>
        {/* Tanlovlar ro'yxati aynan SHU sahifadan boshqariladi: diagramma
            nimadan yasalgani va uni kim to'ldirishi bir joyda tursin. */}
        <Button variant="outline" lucideIcon={Settings2} onClick={() => setManageOpen(true)} className="shrink-0">
          Manbalar ro&apos;yxati
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Eng ko'p manba"
          value={top ? top.name : "—"}
          hint={top ? `${top.n} ta o'quvchi${lead && lead > 0 ? ` · 2-o'rindan +${lead}` : ""}` : "ma'lumot yig'ilmoqda"}
        />
        <StatCard
          label="Manbasi ma'lum"
          value={data?.known ?? 0}
          color="text-primary"
          hint="ulush shulardan hisoblanadi"
        />
        <StatCard
          label="Ko'rsatilmagan"
          value={data?.unknown ?? 0}
          hint="maydon qo'shilishidan oldingilar"
        />
      </div>

      {/* Qamrov — bitta nisbat, shu bois meter. */}
      {data && (
        <div className="rounded-2xl bg-card border border-border p-5">
          <Meter value={data.known} total={data.total} />
          {data.unknown > 0 && (
            <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">
              <strong>{data.unknown}</strong> ta o&apos;quvchida manba ko&apos;rsatilmagan —
              &laquo;Manba&raquo; maydoni <strong>04.09.2026</strong> da qo&apos;shilgan, undan
              oldin qo&apos;shilganlar qayerdan kelgani ma&apos;lum emas. Quyidagi ulushlar
              faqat manbasi ma&apos;lum <strong>{data.known}</strong> ta o&apos;quvchidan
              hisoblangan.
            </p>
          )}
        </div>
      )}

      {/* Taqsimot — miqdorni solishtirish, gorizontal bar. */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="text-[14px] font-semibold mb-4">Manbalar bo&apos;yicha taqsimot</div>
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size={22} /></div>
        ) : (data?.sources.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-trending-up" /></svg>
            </div>
            <h3 className="text-[15px] font-semibold mb-1">Hali ma&apos;lumot yig&apos;ilmagan</h3>
            <p className="text-[13px] text-muted-foreground max-w-md">
              Yangi o&apos;quvchi qo&apos;shilganda &laquo;Manba&raquo; tanlanadi va u shu yerda
              ko&apos;rinadi.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data!.sources.map((s) => (
              <BarRow
                key={s.name}
                name={s.name}
                value={s.n}
                max={max}
                share={data!.known > 0 ? (s.n / data!.known) * 100 : 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Jadval ko'rinishi — ma'lumot faqat grafikda qolmasin (nusxa
          olish, saralash va skrinshotsiz o'qish uchun). */}
      {(data?.sources.length ?? 0) > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left">Manba</th>
                <th className="px-5 py-3 text-right">O&apos;quvchi</th>
                <th className="px-5 py-3 text-right">Ulush</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data!.sources.map((s) => (
                <tr key={s.name} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-2.5 font-medium">{s.name}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{s.n}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                    {data!.known > 0 ? ((s.n / data!.known) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
              <tr className="bg-secondary/10 font-medium">
                <td className="px-5 py-2.5">Jami (manbasi ma&apos;lum)</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{data!.known}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {manageOpen && (
        <SourceOptionsModal onClose={() => setManageOpen(false)} onChanged={load} />
      )}
    </div>
  );
}
