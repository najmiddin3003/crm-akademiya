"use client";

import { useEffect, useMemo, useState } from "react";
import DonutChart from "@/components/ui/DonutChart";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import {
  TURNSTILE_IO_PERSON_TYPES,
  TURNSTILE_IO_STATUSES,
  TURNSTILE_IO_STATUS_LABELS,
  type TurnstileIoRecord,
} from "@/lib/turnstileIo";
import Select from "@/components/ui/Select";

// Nazorat → Turniket kirish-chiqish analitikasi (sidebar: Nazorat >
// Hisobotlar > Turniket kirish-chiqish analitikasi, href /nazorat-turnstile-io).
// Ma'lumot HAQIQIY — /api/turnstile-io (MongoDB `turnstile_io`).
//
// Chapda tanlangan davr bo'yicha holat taqsimoti (donut + "Jami: N"),
// o'ngda odamlar jadvali: kirgan/chiqqan vaqti va holati. Barcha 4 filtr
// (sana oralig'i, foydalanuvchi turi, odam, holati) haqiqatan filtrlaydi.


const STATUS_TONE: Record<string, string> = {
  kelgan: "text-emerald-600",
  kechikkan: "text-amber-600",
  kelmagan: "text-rose-600",
};

function todayRange(): DateRange {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { start, end: start };
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function NazoratTurnstileIoPage() {
  const [records, setRecords] = useState<TurnstileIoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange>(() => todayRange());
  const [personType, setPersonType] = useState<string>("employee");
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/turnstile-io")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRecords(d.records); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Odam ro'yxati tanlangan foydalanuvchi turiga bog'liq — tur o'zgarganda
  // tanlangan odam ro'yxatdan chiqib ketmasligi uchun tozalanadi.
  const personOptions = useMemo(
    () =>
      Array.from(
        new Set(records.filter((r) => !personType || r.personType === personType).map((r) => r.personName)),
      ).sort(),
    [records, personType],
  );

  const filtered = useMemo(() => {
    const startIso = dateRange.start ? toIso(dateRange.start) : null;
    const endIso = dateRange.end ? toIso(dateRange.end) : null;
    return records.filter((r) => {
      if (startIso && r.date < startIso) return false;
      if (endIso && r.date > endIso) return false;
      if (personType && r.personType !== personType) return false;
      if (person && r.personName !== person) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }, [records, dateRange, personType, person, status]);

  // Diagramma "Holati" filtridan mustaqil — aks holda bitta holat tanlanganda
  // taqsimot doim 100% ko'rinardi va statistikaning ma'nosi yo'qolardi.
  const chartRows = useMemo(() => {
    const startIso = dateRange.start ? toIso(dateRange.start) : null;
    const endIso = dateRange.end ? toIso(dateRange.end) : null;
    return records.filter((r) => {
      if (startIso && r.date < startIso) return false;
      if (endIso && r.date > endIso) return false;
      if (personType && r.personType !== personType) return false;
      if (person && r.personName !== person) return false;
      return true;
    });
  }, [records, dateRange, personType, person]);

  const slices = useMemo(
    () =>
      TURNSTILE_IO_STATUSES.map((s) => ({
        label: s.label,
        value: chartRows.filter((r) => r.status === s.key).length,
        color: s.color,
      })),
    [chartRows],
  );

  return (
    <div className="page-frame-lg container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Sarlavha + filtrlar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[18px] font-semibold tracking-tight">Turniket kirish-chiqish analitikasi</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
          <Select value={personType} onChange={(v) => { setPersonType(v); setPerson(""); }} options={TURNSTILE_IO_PERSON_TYPES.map((t) => ({ value: t.key, label: t.label }))} className="w-36" />
          <Select value={person} onChange={(v) => setPerson(v)} options={personOptions.map((n) => ({ value: n, label: n }))} placeholder={personType === "student" ? "O'quvchi" : "Xodim"} clearable className="w-52" />
          <Select value={status} onChange={(v) => setStatus(v)} options={TURNSTILE_IO_STATUSES.map((s) => ({ value: s.key, label: s.label }))} placeholder="Holati" clearable className="w-36" />
        </div>
      </div>

      {/* Ustun kengliklari `--cols` orqali (globals.css → .grid-frame):
          `lg:grid-cols-[...]` klassi bu loyihada ishlamaydi. */}
      <div
        className="grid-frame grid gap-4"
        style={{ "--cols": "380px minmax(0, 1fr)" } as React.CSSProperties}
      >
        {/* Statistika */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <h3 className="text-[15px] font-semibold mb-4">Bugungi statistika</h3>
          <div className="flex flex-col items-center gap-3">
            <DonutChart slices={slices} centerLabel="" size={240} />
            <div className="flex items-center justify-center gap-3 flex-wrap text-[12px]">
              {TURNSTILE_IO_STATUSES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <div className="text-[13px] text-muted-foreground">
              Jami: <span className="font-semibold tabular-nums text-foreground">{chartRows.length}</span>
            </div>
          </div>
        </div>

        {/* Jadval */}
        <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 text-left">To&apos;liq ismi</th>
                  <th className="px-5 py-3 text-left">Kirgan vaqti</th>
                  <th className="px-5 py-3 text-left">Chiqqan vaqti</th>
                  <th className="px-5 py-3 text-left pr-5">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{r.personName}</td>
                    <td className="px-5 py-3 tabular-nums text-[13px]">{r.enterTime || "-"}</td>
                    <td className="px-5 py-3 tabular-nums text-[13px]">{r.exitTime || "-"}</td>
                    <td className={`px-5 py-3 pr-5 text-[13px] font-medium ${STATUS_TONE[r.status]}`}>
                      {TURNSTILE_IO_STATUS_LABELS[r.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
              </div>
              <h3 className="text-[15px] font-semibold mb-1">
                {loading ? <Spinner size={22} /> : "Ma'lumotlar topilmadi"}
              </h3>
              {!loading && (
                <p className="text-[13px] text-muted-foreground max-w-sm">
                  Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
