"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, DoorOpen } from "lucide-react";
import Link from "@/components/ui/Link";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useT } from "@/components/shared/Language";
import { StackBar } from "@/components/v2/reports/report35";
import { ErrorBanner } from "@/components/v2/reports/reportUi";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, Badge, NoticeBar, PageHead, PageShell, TH, fmtNum, type BadgeTone } from "@/components/v2/students/lists/listKit";
import StaffName from "@/components/v2/ui/StaffName";
import { ROW_TINT } from "@/components/v2/ui/table";
import V2DateRange, { rangeLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { TURNSTILE_IO_PERSON_TYPES, TURNSTILE_IO_STATUSES, TURNSTILE_IO_STATUS_LABELS, type TurnstileIoRecord, type TurnstileIoStatus } from "@/lib/turnstileIo";
import { NazoratTurnstileLocationChip } from "./nazoratTurnstileLocation";

// YANGI VERSIYA — NAZORAT → «TURNIKET KIRISH-CHIQISH ANALITIKASI» (/nazorat-turnstile-io, 28-qism, rasmsiz —
// 34-qism «Xodimlar davomati» qolipida). Eski sahifa (components/nazorat/NazoratTurnstileIoPage.tsx) o'zgarmagan;
// versiya app/(app)/nazorat-turnstile-io/page.tsx da serverda tanlanadi. Ma'lumot — o'sha GET /api/turnstile-io
// (`turnstile_io`: har odam uchun KUNLIK jamlanma — birinchi kirish, oxirgi chiqish, holat; turniket ulanmagan,
// yangi yozuvlar xodimlar botidagi «Ishga keldim»dan, joylashuv bilan).
//   • filtrlar: sana oralig'i (sukut — bugun), foydalanuvchi turi (sukut — Xodim), odam;
//   • holat kataklari: Jami (segmentli chiziq) · Kelgan · Kechikkan · Kelmagan — bosilsa jadval o'sha holatga
//     filtrlanadi (eskisidagi «Holati» tanlovi); sonlar holat filtridan MUSTAQIL (eskisidagi donut qoidasi);
//   • jadval: odam (+ sana), kirgan, chiqqan, joylashuv (oyna — xarita), holat; sahifalash.

const STATUS_TONE: Record<TurnstileIoStatus, { tone: BadgeTone; bar: string }> = {
  kelgan: { tone: "success", bar: "bg-v2-success" },
  kechikkan: { tone: "warning", bar: "bg-v2-warning" },
  kelmagan: { tone: "danger", bar: "bg-v2-danger" },
};

const COLS = 5;

function todayRange(): DateRange {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { start, end: start };
}

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const share = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function NazoratTurnstileIoV2() {
  const { t, lang } = useT();
  const fmt = useProfileFmt();
  const [records, setRecords] = useState<TurnstileIoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ver, setVer] = useState(0);

  const [range, setRange] = useState<DateRange>(() => todayRange());
  const [personType, setPersonType] = useState<string>("employee");
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/turnstile-io", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setRecords(d.records);
          setError(false);
        } else setError(true);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ver]);

  // Odam ro'yxati tanlangan foydalanuvchi turiga bog'liq (tur o'zgarsa tanlangan odam tozalanadi).
  const personOptions = useMemo(
    () => Array.from(new Set(records.filter((r) => !personType || r.personType === personType).map((r) => r.personName))).sort().map((n) => ({ value: n, label: n })),
    [records, personType],
  );

  // Holat filtridan mustaqil qatorlar — kataklardagi sonlar (eskisidagi diagramma qoidasi).
  const chartRows = useMemo(() => {
    const startIso = range.start ? toIso(range.start) : null;
    const endIso = range.end ? toIso(range.end) : null;
    return records.filter((r) => {
      if (startIso && r.date < startIso) return false;
      if (endIso && r.date > endIso) return false;
      if (personType && r.personType !== personType) return false;
      if (person && r.personName !== person) return false;
      return true;
    });
  }, [records, range, personType, person]);
  const filtered = useMemo(() => (status ? chartRows.filter((r) => r.status === status) : chartRows), [chartRows, status]);
  const counts = useMemo(() => {
    const c: Record<TurnstileIoStatus, number> = { kelgan: 0, kechikkan: 0, kelmagan: 0 };
    for (const r of chartRows) if (r.status in c) c[r.status] += 1;
    return c;
  }, [chartRows]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const period = rangeLabel(range, lang, t);
  const personLabel = personType === "student" ? t("O'quvchi") : t("Xodim");
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const cells: { key: "" | TurnstileIoStatus; label: string; value: number; sub: string; dot?: string }[] = [
    { key: "", label: t("Jami"), value: chartRows.length, sub: period },
    ...TURNSTILE_IO_STATUSES.map((s) => ({ key: s.key, label: t(s.label), value: counts[s.key], sub: t("{p}% jamidan", { p: share(counts[s.key], chartRows.length) }), dot: STATUS_TONE[s.key].bar })),
  ];

  return (
    <PageShell>
      <PageHead
        title={t("Turniket kirish-chiqish analitikasi")}
        subtitle={`${t("Har bir odam uchun kunlik jamlanma — birinchi kirish, oxirgi chiqish va holat")} · ${period}`}
      />

      <NoticeBar
        icon={DoorOpen}
        action={
          <Link href="/nazorat-qr" className="inline-flex items-center gap-1 rounded-v2-sm font-semibold text-v2-brand-text hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none">
            {t("Xodimlar davomati")}
            <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Link>
        }
      >
        {t("Turniket qurilmasi hozir ulanmagan — yangi yozuvlar xodimlar botidagi «Ishga keldim» belgilashlaridan (joylashuv bilan).")}
      </NoticeBar>

      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange value={range} onChange={resetPage(setRange)} align="start" />
        <V2Select
          variant="value"
          label={t("Foydalanuvchi turi")}
          value={personType}
          onChange={(v) => {
            setPersonType(v);
            setPerson("");
            setPage(1);
          }}
          options={TURNSTILE_IO_PERSON_TYPES.map((x) => ({ value: x.key, label: x.label }))}
          searchable={false}
          clearable={false}
        />
        <V2Select variant="chip" label={personLabel} value={person} onChange={resetPage(setPerson)} options={personOptions} />
      </div>

      {error && (
        <ErrorBanner
          message="Ma'lumot olinmadi"
          onRetry={() => {
            setLoading(true);
            setVer((v) => v + 1);
          }}
        />
      )}

      {/* Holatlar — bosilsa jadval filtrlanadi */}
      <div role="group" aria-label={t("Holati")} className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm min-[64rem]:grid-cols-4">
        {cells.map((c) => {
          const on = status === c.key;
          return (
            <button
              key={c.key || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setStatus(c.key);
                setPage(1);
              }}
              className={`relative min-w-0 px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] ${on ? "bg-v2-brand-bg" : "bg-v2-surface hover:bg-v2-surface-2"}`}
            >
              <span className="flex items-center gap-1.5">
                {c.dot && <span className={`size-2.5 shrink-0 rounded-[3px] ${c.dot}`} aria-hidden />}
                <span className={`truncate text-v2-small ${on ? "font-semibold text-v2-brand-text" : "text-v2-text-2"}`}>{c.label}</span>
              </span>
              {loading ? (
                <span className="mt-2 block h-6 w-12 rounded bg-v2-skeleton" aria-hidden />
              ) : (
                <span className="mt-0.5 block text-[22px] font-semibold leading-8 tabular-nums text-v2-text">{fmtNum(c.value)}</span>
              )}
              {c.key === "" ? (
                <span className="mt-1 block">
                  <StackBar h="h-1.5" parts={TURNSTILE_IO_STATUSES.map((s) => ({ v: loading ? 0 : counts[s.key], c: STATUS_TONE[s.key].bar }))} />
                </span>
              ) : (
                <span className="mt-0.5 block truncate text-v2-caption text-v2-text-2">{loading ? " " : c.sub}</span>
              )}
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[760px] border-collapse text-v2-body">
            <caption className="sr-only">{t("Turniket kirish-chiqish analitikasi")}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${TH} pl-4`}>
                  {t("To'liq ismi")}
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  {t("Kirgan vaqti")}
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  {t("Chiqqan vaqti")}
                </th>
                <th scope="col" className={TH}>
                  {t("Joylashuv")}
                </th>
                <th scope="col" className={`${TH} pr-4 text-right`}>
                  {t("Holati")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    <td className="py-3 pl-4 pr-2.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-v2-full bg-v2-skeleton" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-32 rounded bg-v2-skeleton" />
                          <div className="h-2.5 w-16 rounded bg-v2-skeleton" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: COLS - 1 }, (_, j) => (
                      <td key={j} className="px-2.5 py-3">
                        <div className="ml-auto h-3 w-14 rounded bg-v2-skeleton" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : slice.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <DoorOpen className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="text-v2-section text-v2-text">{records.length === 0 ? t("Kirish-chiqish yozuvi hali yo'q") : t("Ma'lumotlar topilmadi")}</div>
                      <p className="max-w-md text-v2-small text-v2-text-2">
                        {records.length === 0
                          ? t("Xodim xodimlar botida «Ishga keldim» ni bosganda yozuv shu yerda paydo bo'ladi.")
                          : t("Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.")}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                slice.map((r) => {
                  const tone = STATUS_TONE[r.status];
                  return (
                    <tr key={r.id} className={`border-b border-v2-border ${ROW_TINT.hover}`}>
                      <td className="py-2.5 pl-4 pr-2.5">
                        <div className="flex min-w-[190px] items-center gap-3">
                          <Avatar name={r.personName} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-v2-text">{r.personType === "employee" ? <StaffName name={r.personName} /> : r.personName}</span>
                            <span className="block truncate text-v2-small text-v2-text-3">{fmt.dayMonth(r.date)}</span>
                          </span>
                        </div>
                      </td>
                      <td className={`px-2.5 py-2.5 text-right tabular-nums ${r.enterTime ? "font-semibold text-v2-text" : "text-v2-text-3"}`}>{r.enterTime || "—"}</td>
                      <td className={`px-2.5 py-2.5 text-right tabular-nums ${r.exitTime ? "text-v2-text-2" : "text-v2-text-3"}`}>{r.exitTime || "—"}</td>
                      <td className="max-w-[300px] px-2.5 py-2.5">
                        <NazoratTurnstileLocationChip loc={r.location} person={r.personName} when={`${r.date} · ${r.enterTime ?? ""}`} />
                      </td>
                      <td className="py-2.5 pl-2.5 pr-4 text-right">
                        {tone ? <Badge tone={tone.tone}>{t(TURNSTILE_IO_STATUS_LABELS[r.status])}</Badge> : <span className="text-v2-text-3">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <V2Pagination
            totalItems={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
