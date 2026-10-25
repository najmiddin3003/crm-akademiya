"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { UB_MAJ_KEYS, UB_MAJ_SHORT, avgOf, ballBands, rankOf, schemeMax, type UbResult, type UbScheme, type UbTest } from "@/lib/uzbmb";
import type { UbTestData } from "@/lib/uzbmbServer";
import { fmtBall, fmtDelta, fmtNum, isoToDate, useUbPupilHistory, type SheetRow } from "./ubCore";

// YANGI VERSIYA — UZBMB «TAQQOSLASH» KARTASI (rasm «UzBMB · Natijalar va taqqoslash», 25.10.2026):
//   «Taqqoslash · o'rtacha ball, 189 dan» — Bu guruh · №3 (ko'k), Filial o'rtachasi · №3, Bu guruh ·
//   №2 test (kulrang); «Fanlar bo'yicha o'zlashtirish» (to'g'ri javoblar ulushi; eng pasti sariq va
//   80% dan past bo'lsa ostida ogohlantirish); «Ball oralig'i» — ≥ 150, 120–149, < 120.
//   O'quvchi qatori bosilsa — o'sha o'quvchining UzBMB testlari («← Taqqoslash»).

function BallRow({ label, value, max, strong = false }: { label: string; value: number | null; max: number; strong?: boolean }) {
  const { lang } = useT();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-v2-small">
        <span className={`min-w-0 truncate ${strong ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-v2-text">{value === null ? "—" : fmtBall(value, lang)}</span>
      </div>
      <span className="mt-1.5 block h-2 overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
        {value !== null && <span className={`block h-full rounded-v2-full ${strong ? "bg-v2-series-1" : "bg-v2-track"}`} style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} />}
      </span>
    </div>
  );
}

interface Mastery {
  key: string;
  /** Blok fani nomi (sozlamadan) yoki majburiy fanning qisqa nomi (tarjima qilinadi). */
  label: string;
  pct: number;
  /** Majburiy fan; `clash` — xuddi shu nomli blok fani ham bor («Matematika (majburiy)»). */
  maj?: boolean;
  clash?: boolean;
}

/** Fanlar bo'yicha o'zlashtirish: to'g'ri javoblar / savollar (sertifikatli blok kirmaydi). */
export function subjectMastery(results: UbResult[], scheme: UbScheme): Mastery[] {
  const acc = new Map<string, { label: string; got: number; of: number; order: number }>();
  const add = (key: string, label: string, got: number, of: number, order: number) => {
    const cur = acc.get(key) ?? { label, got: 0, of: 0, order };
    cur.got += got;
    cur.of += of;
    acc.set(key, cur);
  };
  results.forEach((r, i) => {
    if (!r.b1cert && r.b1c !== null && r.b1s) add(`b:${r.b1s}`, r.b1s, r.b1c, scheme.b1.q, i * 2);
    if (!r.b2cert && r.b2c !== null && r.b2s) add(`b:${r.b2s}`, r.b2s, r.b2c, scheme.b2.q, i * 2 + 1);
  });
  const blockNames = new Set([...acc.values()].map((v) => v.label));
  UB_MAJ_KEYS.forEach((k, j) => {
    for (const r of results) if (r[k] !== null) add(`m:${k}`, UB_MAJ_SHORT[k], r[k]!, scheme.maj.q, 100000 + j);
  });
  return [...acc.entries()]
    .filter(([, v]) => v.of > 0)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, v]) => ({
      key,
      label: v.label,
      pct: Math.round((v.got / v.of) * 100),
      ...(key.startsWith("m:") ? { maj: true, clash: blockNames.has(v.label) } : {}),
    }));
}

export default function UbSideCard({
  data,
  test,
  rows,
  picked,
  onBack,
}: {
  data: UbTestData | null;
  test: UbTest | null;
  /** Guruh varag'i (natijalar ko'rinishidagi qatorlar). */
  rows: SheetRow[];
  picked: SheetRow | null;
  onBack: () => void;
}) {
  const { t, lang } = useT();
  const history = useUbPupilHistory(picked?.pupilId ?? null);
  const max = test ? schemeMax(test.scheme).total : 189;
  const labelOf = (m: Mastery) => (m.maj ? `${t(m.label)}${m.clash ? ` ${t("(majburiy)")}` : ""}` : m.label);

  const cmp = useMemo(() => {
    const groupDone = rows.flatMap((r) => (r.saved?.complete ? [r.saved] : []));
    const pupils = new Set(rows.map((r) => r.pupilId));
    const prevGroup = (data?.prevResults ?? []).filter((r) => r.complete && pupils.has(r.pupilId)).map((r) => r.total);
    const all = (data?.results ?? []).filter((r) => r.complete).map((r) => r.total);
    const mastery = test ? subjectMastery(rows.flatMap((r) => (r.saved ? [r.saved] : [])), test.scheme) : [];
    const low = mastery.length >= 2 ? mastery.reduce((m, x) => (x.pct < m.pct ? x : m), mastery[0]) : null;
    const b = ballBands(max);
    return {
      group: avgOf(groupDone.map((r) => r.total)),
      branch: avgOf(all),
      prev: avgOf(prevGroup),
      mastery,
      low: low && low.pct < 80 ? low : null,
      bands: b,
      counts: {
        hi: groupDone.filter((r) => r.total >= b.hi).length,
        mid: groupDone.filter((r) => r.total >= b.mid && r.total < b.hi).length,
        low: groupDone.filter((r) => r.total < b.mid).length,
      },
    };
  }, [rows, data, test, max]);

  if (picked) {
    const done = rows.flatMap((r) => (r.saved?.complete ? [r.saved.total] : []));
    const mine = picked.saved?.complete ? picked.saved.total : null;
    return (
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm" aria-label={picked.name}>
        <button type="button" onClick={onBack} className="-ml-1 inline-flex h-7 items-center gap-1 rounded-v2-sm px-1 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Taqqoslash")}
        </button>
        <h2 className="mt-2 text-v2-section text-v2-text">{picked.name}</h2>
        <p className="mt-0.5 text-v2-small text-v2-text-2">
          {mine !== null ? t("Guruhda {rank}-o'rin · {n} tadan", { rank: rankOf(mine, done), n: done.length }) : t("Bu testda natija to'liq kiritilmagan")}
        </p>
        {mine !== null && (
          <div className="mt-3 flex items-center gap-2.5">
            <span className="block h-2 flex-1 overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
              <span className="block h-full rounded-v2-full bg-v2-series-1" style={{ width: `${Math.min(100, (mine / max) * 100)}%` }} />
            </span>
            <span className="shrink-0 text-v2-small font-semibold tabular-nums text-v2-text">
              {fmtBall(mine, lang)} <span className="font-normal text-v2-text-2">/ {fmtNum(max, lang)}</span>
            </span>
          </div>
        )}
        <div className="mt-4 border-t border-v2-border pt-4">
          <h3 className="text-v2-small font-semibold text-v2-text">{t("UzBMB testlari")}</h3>
          {history === null ? (
            <div className="mt-2 space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 rounded bg-v2-skeleton" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="mt-2 text-v2-small text-v2-text-3">{t("Saqlangan natijalari yo'q.")}</p>
          ) : (
            <ul className="mt-2 space-y-2.5">
              {history.map((h, i) => {
                const older = history.slice(i + 1).find((x) => x.complete);
                const d = isoToDate(h.date);
                return (
                  <li key={h.testId}>
                    <div className="flex items-baseline justify-between gap-2 text-v2-small">
                      <span className="min-w-0 truncate text-v2-text">
                        №{h.no} <span className="text-v2-text-3">· {d ? dayMonthLabel(d, lang) : h.date}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {h.complete ? (
                          <>
                            <span className="font-semibold text-v2-text">{fmtBall(h.total, lang)}</span>
                            {older && (
                              <span className={`ml-1.5 text-v2-caption ${h.total - older.total >= 0 ? "text-v2-success" : "text-v2-danger"}`}>{fmtDelta(h.total - older.total, lang)}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-v2-caption text-v2-text-3">{t("to'liq emas")}</span>
                        )}
                      </span>
                    </div>
                    {h.complete && (
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
                        <span className="block h-full rounded-v2-full bg-v2-series-1" style={{ width: `${Math.min(100, (h.total / h.max) * 100)}%` }} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    );
  }

  const no = test?.no;
  const prevNo = data?.prev?.no;
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm" aria-label={t("Taqqoslash")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-v2-section text-v2-text">{t("Taqqoslash")}</h2>
        <span className="text-v2-caption font-normal text-v2-text-3">{t("o'rtacha ball, {max} dan", { max: fmtNum(max, lang) })}</span>
      </div>
      <div className="mt-3 space-y-3">
        <BallRow label={no ? t("Bu guruh · №{no}", { no }) : t("Bu guruh")} value={cmp.group} max={max} strong />
        <BallRow label={no ? t("Filial o'rtachasi · №{no}", { no }) : t("Filial o'rtachasi")} value={cmp.branch} max={max} />
        {prevNo !== undefined && <BallRow label={t("Bu guruh · №{no} test", { no: prevNo })} value={cmp.prev} max={max} />}
      </div>

      <div className="mt-4 border-t border-v2-border pt-4">
        <h3 className="text-v2-small font-semibold text-v2-text">{t("Fanlar bo'yicha o'zlashtirish")}</h3>
        {cmp.mastery.length === 0 ? (
          <p className="mt-2 text-v2-small text-v2-text-3">{t("Natija kiritilgach chiqadi.")}</p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {cmp.mastery.map((m) => {
              const low = cmp.low?.key === m.key;
              return (
                <li key={m.key} className="grid grid-cols-[minmax(0,6.5rem)_1fr_2.75rem] items-center gap-2.5 text-v2-small">
                  <span className="truncate text-v2-text-2">{labelOf(m)}</span>
                  <span className={`block h-1.5 overflow-hidden rounded-v2-full ${low ? "bg-v2-warning-bg" : "bg-v2-brand-bg"}`} aria-hidden>
                    <span className={`block h-full rounded-v2-full ${low ? "bg-v2-warning" : "bg-v2-brand"}`} style={{ width: `${m.pct}%` }} />
                  </span>
                  <span className={`text-right font-semibold tabular-nums ${low ? "text-v2-warning" : "text-v2-text"}`}>{m.pct}%</span>
                </li>
              );
            })}
          </ul>
        )}
        {cmp.low && (
          <div role="note" className="mt-3 flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
            <span>
              <b className="font-semibold">{t("{subject} eng past — {pct}%.", { subject: labelOf(cmp.low), pct: cmp.low.pct })}</b> {t("Keyingi testgacha shu fanga e'tibor.")}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-v2-border pt-4">
        <h3 className="text-v2-small font-semibold text-v2-text">{t("Ball oralig'i")}</h3>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {(
            [
              [`≥ ${cmp.bands.hi}`, cmp.counts.hi],
              [`${cmp.bands.mid}–${cmp.bands.hi - 1}`, cmp.counts.mid],
              [`< ${cmp.bands.mid}`, cmp.counts.low],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
              <div className="text-v2-caption font-normal tabular-nums text-v2-text-2">{label}</div>
              <div className="mt-0.5 text-v2-section font-semibold tabular-nums text-v2-text">{n}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
