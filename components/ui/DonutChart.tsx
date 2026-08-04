"use client";

// Qayta ishlatiladigan donut diagramma (SVG, kutubxonasiz). Har bir segment
// alohida <circle> — stroke-dasharray/dashoffset orqali chiziladi, orasida
// 2px sirt-rangli bo'shliq (dataviz ko'nikmasi: "surface gap" — segmentlarni
// ajratish uchun bo'shliq, chegara chizig'i emas). Ulush >=8% bo'lgan
// segmentlarga foiz yorlig'i qo'yiladi (kichiklariga qo'yilmaydi — ustma-ust
// tushib chalkashmasligi uchun, aniq qiymatlar doim yonidagi jadvalda bor).
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const GAP = 3; // px bo'shliq har segment orasida

export default function DonutChart({
  slices,
  centerLabel,
  size = 220,
  showLabels = true,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  size?: number;
  showLabels?: boolean;
}) {
  const SIZE = size;
  const STROKE = Math.round(size * (34 / 220));
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let cumulative = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--secondary)" strokeWidth={STROKE} opacity={total > 0 ? 0 : 0.4} />
        {total > 0 &&
          slices
            .filter((s) => s.value > 0)
            .map((s) => {
              const fraction = s.value / total;
              const rawLength = fraction * CIRCUMFERENCE;
              const length = Math.max(rawLength - GAP, 0);
              const offset = -(cumulative / CIRCUMFERENCE) * CIRCUMFERENCE;
              cumulative += rawLength;
              return (
                <circle
                  key={s.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
      </svg>
      {/* Foiz yorliqlari — faqat >=8% ulushga ega segmentlarga (kichiklari jadvalda) */}
      {showLabels && total > 0 &&
        (() => {
          let acc = 0;
          return slices
            .filter((s) => s.value > 0)
            .map((s) => {
              const fraction = s.value / total;
              const midAngle = (acc + fraction / 2) * 2 * Math.PI - Math.PI / 2;
              acc += fraction;
              if (fraction < 0.08) return null;
              const r = RADIUS;
              const x = SIZE / 2 + r * Math.cos(midAngle);
              const y = SIZE / 2 + r * Math.sin(midAngle);
              return (
                <span
                  key={s.label}
                  className="absolute text-[11px] font-semibold text-white pointer-events-none"
                  style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
                >
                  {(fraction * 100).toFixed(fraction * 100 < 10 ? 1 : 0)}%
                </span>
              );
            });
        })()}
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-center" style={{ padding: size < 100 ? 2 : 24 }}>
          <span className="font-semibold tabular-nums" style={{ fontSize: size < 100 ? 9 : 18 }}>{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
