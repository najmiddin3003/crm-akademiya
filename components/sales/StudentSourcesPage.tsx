"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner";

// Sotuv va marketing → O'quvchilar oqimi (/sales-sources).
//
// O'quvchi QAYERDAN kelgani `pupils.source` da — O'quvchi qo'shish
// oynasidagi majburiy "Manba" maydoni (commit 9ef88c7).
//
// MUHIM: maydon 04.09.2026 da majburiy qilingan. Undan OLDIN qo'shilgan
// o'quvchilarda u hech qachon to'lmaydi va to'lmaydi ham — ular qayerdan
// kelgani endi noma'lum. Shu sabab ULUSH faqat manbasi MA'LUM bo'lgan
// o'quvchilardan hisoblanadi, "noma'lum" esa alohida ko'rsatiladi.
// Aks holda birinchi kunlarda "Tavsiya 71%" degan yozuv 5 ta yozuvdan
// chiqib, katta ko'rinardi.

interface Payload {
  sources: { name: string; n: number }[];
  known: number;
  unknown: number;
  total: number;
}

/** Ulush chizig'i — qo'shni analitika sahifalaridagi bilan bir xil uslub. */
function Bar({ label, value, max, share }: { label: string; value: number; max: number; share: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value} ta &middot; {share.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}

export default function StudentSourcesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-sources")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setData(d as Payload); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const max = data?.sources[0]?.n ?? 0;
  const top = data?.sources[0];

  return (
    <div className="container mx-auto max-w-[1200px] p-4 md:p-5 space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold">O&apos;quvchilar oqimi</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          O&apos;quvchilar markazga qayerdan kelayotgani — qo&apos;shish oynasidagi
          &laquo;Manba&raquo; maydoni bo&apos;yicha.
        </p>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[12px] text-muted-foreground">Manbasi ma&apos;lum</div>
          <div className="text-[20px] font-bold tabular-nums text-emerald-600">{data?.known ?? 0}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">ulush shulardan hisoblanadi</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[12px] text-muted-foreground">Manbasi ko&apos;rsatilmagan</div>
          <div className="text-[20px] font-bold tabular-nums text-muted-foreground">{data?.unknown ?? 0}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">maydon qo&apos;shilishidan oldingilar</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[12px] text-muted-foreground">Eng ko&apos;p manba</div>
          <div className="text-[20px] font-bold">{top ? top.name : "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {top ? `${top.n} ta o'quvchi` : "ma'lumot yig'ilmoqda"}
          </div>
        </div>
      </div>

      {/* HALOL OGOHLANTIRISH — raqamlar chalg'itmasligi uchun. */}
      {(data?.unknown ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px]">
          <strong>{data!.unknown}</strong> ta o&apos;quvchida manba ko&apos;rsatilmagan —
          &laquo;Manba&raquo; maydoni <strong>04.09.2026</strong> da qo&apos;shilgan, undan oldin
          qo&apos;shilgan o&apos;quvchilar qayerdan kelgani ma&apos;lum emas. Quyidagi ulushlar
          faqat manbasi ma&apos;lum bo&apos;lgan <strong>{data!.known}</strong> ta o&apos;quvchidan
          hisoblangan.
        </div>
      )}

      {/* Taqsimot */}
      <div className="rounded-2xl bg-card border border-border p-5">
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
              <Bar
                key={s.name}
                label={s.name}
                value={s.n}
                max={max}
                share={data!.known > 0 ? (s.n / data!.known) * 100 : 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
