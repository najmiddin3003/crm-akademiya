"use client";
import { useT } from "@/components/shared/Language";

// Nazorat > Davomat analitikasi grafigi — kunlik stacked-bar (SVG, kutubxonasiz).
//
// ILGARI: ustunlar `lib/davomatAnalytics.ts` dagi generator bergan sonlardan
// chizilardi va ranglar/yorliqlar `constants/davomatAnalytics.js` dan olinardi.
// HOZIR: komponent hech narsani o'zi hisoblamaydi — kunlar ham, qatorlar
// (series) ta'rifi ham tashqaridan, bazadagi haqiqiy davomatdan keladi.
//
// TUZATILDI (Y o'qi masshtabi): ilgari `Math.max(500, ...)` turardi — bu
// generator davridan qolgan chegara edi, chunki o'ylab topilgan sonlar
// yuzlab bo'lardi. Haqiqiy davomat sonlari esa bir xonali: bunday paytda
// 374px lik maydonda ustun 5px ham bo'lmay, grafik BO'SH katakday
// ko'rinardi. Endi o'q chegarasi haqiqiy maksimaldan hisoblanadi.

export interface DvaSeries {
  key: string;
  label: string;
  color: string;
}

export interface DvaDay {
  /** "YYYY-MM-DD" */
  iso: string;
  /** "24.08.2026" — ustun tagidagi yozuv */
  label: string;
  /** `series` bilan bir xil tartibdagi sonlar. */
  vals: number[];
}

/**
 * Y o'qi chegarasi va katak qadamini HAQIQIY maksimal qiymatdan hisoblaydi.
 * Qadam 1-2-5 × 10^n ketma-ketligidan olinadi (taxminan 5 ta katak chiqadi)
 * va hech qachon 1 dan kichik bo'lmaydi — ustunlar butun sonni (o'quvchi
 * sonini) ko'rsatadi, kasrli "0.4" kabi yorliqlar ma'nosiz bo'lardi.
 * Maksimal 0 bo'lsa (belgi yo'q kun) o'q 0..4 qilib chiziladi: bu shunchaki
 * bo'sh katak, hech qanday son da'vo qilinmaydi.
 */
function niceScale(max: number): { niceMax: number; step: number } {
  if (!Number.isFinite(max) || max <= 0) return { niceMax: 4, step: 1 };
  const rough = max / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = Math.max(1, Math.round((norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag));
  return { niceMax: Math.ceil(max / step) * step, step };
}

export default function DvaBarChart({ days, series }: { days: DvaDay[]; series: DvaSeries[] }) {
  const { t } = useT();
  if (days.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t("Ma'lumot topilmadi")}</div>;
  }

  const N = days.length;
  const W = Math.max(900, N * 56);
  const H = 460;
  const pad = { l: 50, r: 16, t: 16, b: 70 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const maxTotal = Math.max(...days.map((d) => d.vals.reduce((s, v) => s + v, 0)));
  const { niceMax, step: gridStep } = niceScale(maxTotal);

  const xStep = innerW / N;
  const barW = Math.min(30, xStep * 0.6);

  const gridLines: number[] = [];
  for (let i = 0; i * gridStep <= niceMax; i++) gridLines.push(i * gridStep);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: W, height: H }}>
        {gridLines.map((v) => {
          const y = pad.t + innerH - (v / niceMax) * innerH;
          return (
            <g key={v}>
              <line x1={pad.l} y1={y} x2={pad.l + innerW} y2={y} stroke="currentColor" strokeOpacity={0.06} />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="currentColor" style={{ fontSize: 10, opacity: 0.55 }}>{v}</text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const cx = pad.l + i * xStep + xStep / 2;
          const x = cx - barW / 2;
          let cursorY = pad.t + innerH;
          const lastNonZero = d.vals.reduce((acc, v, k) => (v !== 0 ? k : acc), -1);
          return (
            <g key={d.iso}>
              {d.vals.map((v, k) => {
                if (v === 0) return null;
                const segH = (v / niceMax) * innerH;
                cursorY -= segH;
                return (
                  <rect
                    key={series[k]?.key ?? k}
                    x={x}
                    y={cursorY}
                    width={barW}
                    height={segH}
                    fill={series[k]?.color ?? "#94a3b8"}
                    rx={k === lastNonZero ? 3 : 0}
                    ry={k === lastNonZero ? 3 : 0}
                  >
                    <title>{`${d.label} — ${series[k]?.label ?? ""}: ${v}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {days.map((d, i) => {
          const cx = pad.l + i * xStep + xStep / 2;
          const y = H - pad.b + 16;
          return (
            <text
              key={d.iso}
              x={cx}
              y={y}
              textAnchor="end"
              fill="currentColor"
              style={{ fontSize: 10, opacity: 0.6 }}
              transform={`rotate(-40, ${cx}, ${y})`}
            >
              {t(d.label)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
