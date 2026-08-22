"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownSquare, ChevronDown, FilePlus, Search, Share2, Trash2, XCircle } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useStudents } from "@/hooks/useStudents";
import { UB_MAIN_SUBJECTS } from "@/constants/imtihon";
import {
  UB_CFG,
  imMonthLabel,
  normalizeMonth,
  ubCalc,
  ubFmt,
  ubR1,
  type UzbmbExam,
} from "@/lib/imtihon";
import { downloadCsv, intOf, normHeader, readFileRows, type ParseResult } from "./importUtils";

// Imtihon → UzBMB tabi. Referens HTML'dagi "UZBMB" konteyneri va uning uch
// modali (natija kiritish, import, solishtirish) bilan bir xil.
//
// Ma'lumot HAQIQIY — /api/imtihon/uzbmb (MongoDB `uzbmb_exams`).

type UbParsed = Omit<UzbmbExam, "id" | "b1" | "b2" | "maj" | "total">;

interface EntryForm {
  student: string;
  month: string;
  b1s: string;
  b1c: string;
  b1cert: boolean;
  b1m: string;
  b2s: string;
  b2c: string;
  b2cert: boolean;
  b2m: string;
  m1: string;
  m2: string;
  m3: string;
}

function emptyEntry(): EntryForm {
  const d = new Date();
  return {
    student: "",
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    b1s: UB_MAIN_SUBJECTS[0],
    b1c: "",
    b1cert: false,
    b1m: "",
    b2s: "Fizika",
    b2c: "",
    b2cert: false,
    b2m: "",
    m1: "",
    m2: "",
    m3: "",
  };
}

function BallBadge({ total }: { total: number }) {
  const p = total / UB_CFG.MAX;
  const cls =
    p >= 0.8 ? "bg-emerald-100 text-emerald-700" : p >= 0.6 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[13px] font-bold tabular-nums ${cls}`}>
      {ubFmt(total)}
    </span>
  );
}

/** Solishtirish modalidagi progress chizig'i. */
function CmpBar({ label, val, max, color, bold }: { label: string; val: number; max: number; color: string; bold?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
        <span className={`font-bold tabular-nums ${bold ? "" : "text-muted-foreground"}`}>
          {ubFmt(val)} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (val / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums ${color || ""}`}>{value}</div>
      {sub ? <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div> : null}
    </div>
  );
}

const numInputCls =
  "w-full h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls =
  "w-full h-9 appearance-none rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function UzbmbView() {
  const { showSuccess, showError } = useToast();

  const [exams, setExams] = useState<UzbmbExam[]>([]);
  const [loading, setLoading] = useState(true);

  // `null` — foydalanuvchi hali tanlamagan, eng oxirgi oy ko'rsatiladi.
  const [fMonth, setFMonth] = useState<string | null>(null);
  const [fSubject, setFSubject] = useState("");
  const [search, setSearch] = useState("");

  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState<EntryForm>(emptyEntry);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [parsed, setParsed] = useState<ParseResult<UbParsed> | null>(null);
  const [applying, setApplying] = useState(false);

  const [cmpId, setCmpId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/imtihon/uzbmb")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setExams(d.exams as UzbmbExam[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const months = useMemo(
    () => [...new Set(exams.map((r) => r.month))].sort().reverse(),
    [exams],
  );
  const fm = fMonth ?? months[0] ?? "";

  const subjects = useMemo(
    () => [...new Set([...UB_MAIN_SUBJECTS, ...exams.map((r) => r.b1s)])],
    [exams],
  );

  const items = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exams
      .filter((r) => {
        if (fm && r.month !== fm) return false;
        if (fSubject && r.b1s !== fSubject) return false;
        if (q && !r.student.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.total - a.total || a.student.localeCompare(b.student));
  }, [exams, fm, fSubject, search]);

  const avg = useMemo(() => {
    const pool = fm ? exams.filter((r) => r.month === fm) : exams;
    return pool.length ? ubR1(pool.reduce((s, r) => s + r.total, 0) / pool.length) : 0;
  }, [exams, fm]);

  const best = items.length ? items[0] : null;
  const strong = items.filter((r) => r.total >= 150).length;

  // O'quvchilar bazadan (/api/pupils) + imtihon yozuvlarida uchraganlari
  // (o'quvchi keyin o'chirilgan bo'lishi mumkin).
  const { names: pupilNames } = useStudents();
  const studentNames = useMemo(() => {
    const names = new Set<string>(pupilNames);
    exams.forEach((r) => names.add(r.student));
    return [...names];
  }, [exams, pupilNames]);

  /* ---- Natija kiritish ---- */
  function openEntry() {
    setEntry(emptyEntry());
    setEntryOpen(true);
  }

  const entryCalc = useMemo(() => {
    const g = (v: string) => Math.max(0, Number(v) || 0);
    return ubCalc({
      b1cert: entry.b1cert,
      b1m: g(entry.b1m),
      b2cert: entry.b2cert,
      b2m: g(entry.b2m),
      b1c: Math.min(UB_CFG.b1max, g(entry.b1c)),
      b2c: Math.min(UB_CFG.b2max, g(entry.b2c)),
      m1: Math.min(UB_CFG.mmax, g(entry.m1)),
      m2: Math.min(UB_CFG.mmax, g(entry.m2)),
      m3: Math.min(UB_CFG.mmax, g(entry.m3)),
    });
  }, [entry]);

  const entryRatio = entryCalc.total / UB_CFG.MAX;
  const entryBallCls =
    entryRatio >= 0.8
      ? "text-emerald-600"
      : entryRatio >= 0.6
        ? "text-amber-600"
        : entryCalc.total > 0
          ? "text-rose-500"
          : "text-muted-foreground";
  const entryBarColor = entryRatio >= 0.8 ? "#10b981" : entryRatio >= 0.6 ? "#f59e0b" : "#2b38ff";

  async function saveEntry() {
    const student = entry.student.trim();
    if (!student) return showError("⚠ O'quvchi ismini kiriting");
    if (!entry.month) return showError("⚠ Oyni tanlang");
    if (entry.b1s === entry.b2s) return showError("⚠ 1-blok va 2-blok fani bir xil bo'lmasin");
    setSaving(true);
    try {
      const res = await fetch("/api/imtihon/uzbmb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, student }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setExams(data.exams as UzbmbExam[]);
      setEntryOpen(false);
      const saved = (data.exams as UzbmbExam[]).find(
        (r) => r.student.toLowerCase() === student.toLowerCase() && r.month === normalizeMonth(entry.month),
      );
      showSuccess(
        `${data.updated ? "Natija yangilandi" : "UzBMB natijasi saqlandi"} — ${student}: ${ubFmt(saved?.total ?? entryCalc.total)} / 189 ball`,
      );
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  /* ---- O'chirish ---- */
  const remove = useCallback(
    async (r: UzbmbExam) => {
      const res = await fetch(`/api/imtihon/uzbmb/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setExams((prev) => prev.filter((x) => x.id !== r.id));
      setCmpId((cur) => (cur === r.id ? null : cur));
      showSuccess(`Natija o'chirildi — ${r.student} · ${imMonthLabel(r.month)}`);
    },
    [showSuccess, showError],
  );

  /* ---- Eksport / shablon ---- */
  function exportCsv() {
    const list = fm ? exams.filter((r) => r.month === fm) : exams;
    const head = [
      "O'quvchi", "1-blok fani", "1-blok to'g'ri", "1-blok ball",
      "2-blok fani", "2-blok to'g'ri", "2-blok ball",
      "Ona tili", "Matematika", "Tarix", "Majburiy ball", "Jami ball (189)", "Oy",
    ];
    const rows = list.map((r) => [
      r.student, r.b1s, r.b1c ?? "", ubFmt(r.b1),
      r.b2s, r.b2c ?? "", ubFmt(r.b2),
      r.m1, r.m2, r.m3, ubFmt(r.maj), ubFmt(r.total), r.month,
    ]);
    downloadCsv([head, ...rows], "uzbmb" + (fm ? "_" + fm : "") + ".csv");
    showSuccess(`📤 Yuklab olindi — ${list.length} ta UzBMB natijasi`);
  }

  function downloadTemplate() {
    downloadCsv(
      [
        ["O'quvchi", "1-blok fani", "1-blok to'g'ri", "2-blok fani", "2-blok to'g'ri", "Ona tili", "Matematika", "Tarix", "Oy"],
        ["Muhammadamin Dehqanov", "Matematika", "26", "Fizika", "24", "8", "9", "7", "2026-08"],
        ["Salohiddin Rahimjanov", "Kimyo", "27", "Biologiya", "25", "9", "7", "8", "2026-08"],
      ],
      "uzbmb_shablon.csv",
    );
    showSuccess("📄 Shablon yuklab olindi — Excel'da to'ldirib, shu oynaga yuklang");
  }

  /* ---- Import ---- */
  function openImport() {
    setParsed(null);
    setImportOpen(true);
  }

  function parseTable(rows: string[][]): ParseResult<UbParsed> {
    if (!rows || rows.length < 2) return { ok: [], errors: ["Faylda ma'lumot topilmadi"] };
    const head = rows[0].map(normHeader);
    const find = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
    const iName = find("oquvchi", "ism", "student");
    const iB1s = find("1blokfani", "1blokfan", "asosiy1");
    const iB1c = find("1bloktogri", "1blokto");
    const iB2s = find("2blokfani", "2blokfan", "asosiy2");
    const iB2c = find("2bloktogri", "2blokto");
    const iM1 = find("onatili");
    const iM2 = head.findIndex((h, i) => h.includes("matematika") && i !== iB1s && i !== iB2s);
    const iM3 = find("tarix");
    const iMonth = find("oy", "month", "sana");

    const errors: string[] = [];
    if (iName < 0) errors.push("«O'quvchi» ustuni topilmadi");
    if (iB1s < 0 || iB1c < 0) errors.push("«1-blok fani» va «1-blok to'g'ri» ustunlari kerak");
    if (iB2s < 0 || iB2c < 0) errors.push("«2-blok fani» va «2-blok to'g'ri» ustunlari kerak");
    if (iM1 < 0 || iM2 < 0 || iM3 < 0) errors.push("Majburiy fanlar (Ona tili, Matematika, Tarix) ustunlari kerak");
    if (errors.length) return { ok: [], errors };

    const ok: UbParsed[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const student = String(r[iName] || "").trim();
      if (!student) continue;
      const gi = (idx: number, mx: number) => Math.min(mx, Math.max(0, intOf(r[idx])));
      const month = normalizeMonth(iMonth >= 0 ? String(r[iMonth] || "") : "");
      const b1cRaw = intOf(r[iB1c]);
      const b2cRaw = intOf(r[iB2c]);
      if (b1cRaw > 30 || b2cRaw > 30) {
        errors.push(`${i + 1}-qator (${student}): blok javoblari 30 dan oshmasin`);
        continue;
      }
      const b1s = String(r[iB1s] || "").trim();
      const b2s = String(r[iB2s] || "").trim();
      if (!b1s || !b2s) {
        errors.push(`${i + 1}-qator (${student}): blok fanlari bo'sh`);
        continue;
      }
      ok.push({
        student, month, b1s, b2s,
        b1c: gi(iB1c, 30), b2c: gi(iB2c, 30),
        m1: gi(iM1, 10), m2: gi(iM2, 10), m3: gi(iM3, 10),
      });
    }
    return { ok, errors };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileRows(file)
      .then((rows) => setParsed(parseTable(rows)))
      .catch((err: Error) => setParsed({ ok: [], errors: [err.message] }));
  }

  async function applyImport() {
    if (!parsed || !parsed.ok.length) return;
    setApplying(true);
    try {
      const res = await fetch("/api/imtihon/uzbmb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed.ok }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Yuklanmadi");
        return;
      }
      setExams(data.exams as UzbmbExam[]);
      setImportOpen(false);
      showSuccess(`📥 Bazaga qo'shildi — ${data.added} ta yangi, ${data.updated} ta yangilangan UzBMB natijasi`);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setApplying(false);
    }
  }

  /* ---- Solishtirish ---- */
  const cmp = cmpId === null ? null : exams.find((r) => r.id === cmpId) || null;
  const cmpData = useMemo(() => {
    if (!cmp) return null;
    const pool = exams.filter((x) => x.month === cmp.month);
    const poolAvg = pool.length ? ubR1(pool.reduce((s, x) => s + x.total, 0) / pool.length) : 0;
    const rank = pool.slice().sort((a, b) => b.total - a.total).findIndex((x) => x.id === cmp.id) + 1;
    const history = exams.filter((x) => x.student === cmp.student).sort((a, b) => a.month.localeCompare(b.month));
    const trend = history.length > 1 ? ubR1(history[history.length - 1].total - history[history.length - 2].total) : 0;
    return { pool, poolAvg, rank, history, trend };
  }, [cmp, exams]);

  useEscapeClose(
    useCallback(() => {
      setEntryOpen(false);
      setImportOpen(false);
      setCmpId(null);
    }, []),
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
        >
          <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
            CSV
          </span>
          <span>Shablon</span>
        </button>
        <button
          onClick={openImport}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15"
        >
          <ArrowDownSquare className="w-4 h-4" />
          <span>Fayl yuklash (Excel/CSV)</span>
        </button>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
        >
          <Share2 className="w-4 h-4" />
          <span>Yuklab olish</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={openEntry}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <FilePlus className="w-4 h-4" />
          <span>Natija kiritish</span>
        </button>
      </div>

      {/* Ball tizimi eslatmasi */}
      <div className="rounded-xl border border-border bg-secondary/20 px-4 py-2.5 flex items-center gap-4 flex-wrap text-[12px]">
        <span className="font-semibold text-primary">UzBMB ball tizimi:</span>
        <span>
          1-blok (asosiy fan): 30 savol × <b>3.1</b> = 93 ball
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          2-blok (asosiy fan): 30 savol × <b>2.1</b> = 63 ball
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          3 majburiy fan: 10 tadan × <b>1.1</b> = 33 ball
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="font-bold">Maksimal: 189 ball</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={"Natijalar" + (fm ? " (" + imMonthLabel(fm) + ")" : "")}
          value={items.length}
          sub="UzBMB imtihon natijasi"
        />
        <StatCard
          label="O'rtacha ball"
          value={ubFmt(avg)}
          sub="189 balldan"
          color={avg >= 151.2 ? "text-emerald-600" : avg >= 113.4 ? "text-amber-600" : "text-rose-500"}
        />
        <StatCard
          label="Eng yuqori ball"
          value={best ? ubFmt(best.total) : "—"}
          sub={best ? best.student : ""}
          color="text-emerald-600"
        />
        <StatCard
          label="150+ ball olganlar"
          value={strong}
          sub={items.length ? Math.round((strong / items.length) * 100) + "% o'quvchi" : ""}
          color="text-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <select
            value={fm}
            onChange={(e) => setFMonth(e.target.value)}
            className="h-9 w-40 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Barcha oylar</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {imMonthLabel(m)}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <select
            value={fSubject}
            onChange={(e) => setFSubject(e.target.value)}
            className="h-9 w-44 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">1-blok fani — barchasi</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="flex-1" />
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="O'quvchi bo'yicha qidirish"
            className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{items.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">O&apos;quvchi</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">1-blok (×3.1)</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">2-blok (×2.1)</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Majburiy (×1.1)</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Jami ball (189)</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Oy</th>
                <th className="text-right px-4 py-3 whitespace-nowrap w-32" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <SpinnerBlock size={22} />
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
                    Natija topilmadi. &quot;Natija kiritish&quot; yoki fayl yuklashdan foydalaning.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => setCmpId(r.id)}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">{r.student}</td>
                    <td className="px-4 py-3">
                      <div className="text-[13px]">
                        {r.b1s} — <b className="tabular-nums">{ubFmt(r.b1)}</b>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {r.b1cert ? "🏅 Sertifikat (qo'lda)" : `${r.b1c}/30 savol`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px]">
                        {r.b2s} — <b className="tabular-nums">{ubFmt(r.b2)}</b>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {r.b2cert ? "🏅 Sertifikat (qo'lda)" : `${r.b2c}/30 savol`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] tabular-nums">
                        <b>{ubFmt(r.maj)}</b> / 33
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {r.m1}+{r.m2}+{r.m3} to&apos;g&apos;ri
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <BallBadge total={r.total} />
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{imMonthLabel(r.month)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCmpId(r.id);
                        }}
                        className="h-8 px-3 rounded-md bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/15"
                      >
                        Solishtirish
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(r);
                        }}
                        className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 inline-flex items-center justify-center text-muted-foreground"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== UZBMB NATIJA KIRITISH ===== */}
      {entryOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEntryOpen(false);
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[16px] font-semibold">UzBMB natijasi</div>
                <button
                  onClick={() => setEntryOpen(false)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">
                      O&apos;quvchi<span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={entry.student}
                      onChange={(e) => setEntry((f) => ({ ...f, student: e.target.value }))}
                      list="ub-students-dl"
                      type="text"
                      placeholder="Ism yozing..."
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <datalist id="ub-students-dl">
                      {studentNames.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">Oy</label>
                    <input
                      value={entry.month}
                      onChange={(e) => setEntry((f) => ({ ...f, month: e.target.value }))}
                      type="month"
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 tabular-nums"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border p-3 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Asosiy fanlar</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium mb-1">
                        1-blok fani (×3.1)<span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={entry.b1s}
                        onChange={(e) => setEntry((f) => ({ ...f, b1s: e.target.value }))}
                        className={selectCls}
                      >
                        {UB_MAIN_SUBJECTS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1">
                        {entry.b1cert ? "Sertifikat balli (0–93)" : "To'g'ri (0–30)"}
                      </label>
                      {entry.b1cert ? (
                        <input
                          value={entry.b1m}
                          onChange={(e) => setEntry((f) => ({ ...f, b1m: e.target.value }))}
                          type="number"
                          min={0}
                          max={93}
                          step={0.1}
                          placeholder="Ball (0–93)"
                          className="w-full h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm tabular-nums text-slate-900"
                        />
                      ) : (
                        <input
                          value={entry.b1c}
                          onChange={(e) => setEntry((f) => ({ ...f, b1c: e.target.value }))}
                          type="number"
                          min={0}
                          max={30}
                          placeholder="0"
                          className={numInputCls}
                        />
                      )}
                      <label className="flex items-center gap-1.5 mt-1.5 text-[11px] cursor-pointer text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={entry.b1cert}
                          onChange={(e) => setEntry((f) => ({ ...f, b1cert: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                        <span>🏅 Sertifikat bor — ball qo&apos;lda</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1">
                        2-blok fani (×2.1)<span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={entry.b2s}
                        onChange={(e) => setEntry((f) => ({ ...f, b2s: e.target.value }))}
                        className={selectCls}
                      >
                        {UB_MAIN_SUBJECTS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1">
                        {entry.b2cert ? "Sertifikat balli (0–63)" : "To'g'ri (0–30)"}
                      </label>
                      {entry.b2cert ? (
                        <input
                          value={entry.b2m}
                          onChange={(e) => setEntry((f) => ({ ...f, b2m: e.target.value }))}
                          type="number"
                          min={0}
                          max={63}
                          step={0.1}
                          placeholder="Ball (0–63)"
                          className="w-full h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm tabular-nums text-slate-900"
                        />
                      ) : (
                        <input
                          value={entry.b2c}
                          onChange={(e) => setEntry((f) => ({ ...f, b2c: e.target.value }))}
                          type="number"
                          min={0}
                          max={30}
                          placeholder="0"
                          className={numInputCls}
                        />
                      )}
                      <label className="flex items-center gap-1.5 mt-1.5 text-[11px] cursor-pointer text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={entry.b2cert}
                          onChange={(e) => setEntry((f) => ({ ...f, b2cert: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                        <span>🏅 Sertifikat bor — ball qo&apos;lda</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-3 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Majburiy fanlar (10 tadan, ×1.1)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {([["m1", "Ona tili"], ["m2", "Matematika"], ["m3", "O'zb. tarixi"]] as const).map(([k, label]) => (
                      <div key={k}>
                        <label className="block text-[12px] font-medium mb-1">{label}</label>
                        <input
                          value={entry[k]}
                          onChange={(e) => setEntry((f) => ({ ...f, [k]: e.target.value }))}
                          type="number"
                          min={0}
                          max={10}
                          placeholder="0"
                          className={numInputCls}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5">
                  <div className="text-[12px] text-slate-500 text-center">
                    1-blok: {ubFmt(entryCalc.b1)} · 2-blok: {ubFmt(entryCalc.b2)} · Majburiy: {ubFmt(entryCalc.maj)}
                  </div>
                  <div className="text-center mt-1">
                    <span className={`text-[28px] font-bold tabular-nums ${entryBallCls}`}>{ubFmt(entryCalc.total)}</span>
                    <span className="text-[14px] text-slate-500 font-medium"> / 189 ball</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, entryRatio * 100)}%`, background: entryBarColor }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => setEntryOpen(false)}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm disabled:opacity-60"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={saveEntry}
                  disabled={saving}
                  className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saqlanmoqda…" : "Saqlash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== UZBMB IMPORT ===== */}
      {importOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[16px] font-semibold">UzBMB — Excel / CSV dan yuklash</div>
                <button
                  onClick={() => setImportOpen(false)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[13px] text-muted-foreground mb-3">
                Ustunlar:{" "}
                <b>
                  O&apos;quvchi, 1-blok fani, 1-blok to&apos;g&apos;ri, 2-blok fani, 2-blok to&apos;g&apos;ri, Ona tili,
                  Matematika, Tarix, Oy
                </b>
                . Ballar avtomatik hisoblanadi.{" "}
                <button onClick={downloadTemplate} className="text-primary font-medium hover:underline">
                  Shablonni yuklab olish
                </button>
              </div>
              <label className="block rounded-xl border-2 border-dashed border-border bg-secondary/20 p-6 text-center cursor-pointer hover:bg-secondary/40 transition-colors">
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
                <ArrowDownSquare className="mx-auto mb-2 text-muted-foreground" style={{ width: 28, height: 28 }} />
                <div className="text-[13px] font-medium">Faylni tanlang</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">.xlsx, .xls yoki .csv</div>
              </label>
              {parsed && (
                <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-3.5 text-[13px]">
                  <div className={`font-semibold ${parsed.ok.length ? "text-emerald-600" : "text-rose-500"}`}>
                    {parsed.ok.length
                      ? `✓ ${parsed.ok.length} ta natija o'qildi (ballar avtomatik hisoblandi)`
                      : "⚠ Yaroqli qator topilmadi"}
                  </div>
                  {parsed.ok.length > 0 && (
                    <div className="text-muted-foreground mt-1">
                      {parsed.ok.slice(0, 4).map((r, i) => (
                        <div key={i}>
                          {r.student} — {ubFmt(ubCalc(r).total)} / 189
                        </div>
                      ))}
                      {parsed.ok.length > 4 && <div>… va yana {parsed.ok.length - 4} ta</div>}
                    </div>
                  )}
                  {parsed.errors.length > 0 && (
                    <div className="text-rose-500 mt-2">
                      {parsed.errors.slice(0, 5).map((e, i) => (
                        <div key={i}>{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => setImportOpen(false)}
                  className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm"
                >
                  Yopish
                </button>
                <button
                  onClick={applyImport}
                  disabled={!parsed || parsed.ok.length === 0 || applying}
                  className="h-9 px-5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {applying ? "Qo'shilmoqda…" : "Bazaga qo'shish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== UZBMB SOLISHTIRISH ===== */}
      {cmp && cmpData && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCmpId(null);
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[18px] font-semibold">{cmp.student}</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    UzBMB · {cmp.b1s} + {cmp.b2s} · {imMonthLabel(cmp.month)}
                  </div>
                </div>
                <button
                  onClick={() => setCmpId(null)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground flex-shrink-0"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Jami ball</div>
                  <div
                    className={`text-[22px] font-bold tabular-nums ${
                      cmp.total / 189 >= 0.8 ? "text-emerald-600" : cmp.total / 189 >= 0.6 ? "text-amber-600" : "text-rose-500"
                    }`}
                  >
                    {ubFmt(cmp.total)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">189 balldan</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Markaz bo&apos;yicha o&apos;rin</div>
                  <div className="text-[22px] font-bold tabular-nums text-primary">{cmpData.rank}-o&apos;rin</div>
                  <div className="text-[11px] text-muted-foreground">{cmpData.pool.length} o&apos;quvchi ichida</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">O&apos;sish (oldingi oyga)</div>
                  <div
                    className={`text-[22px] font-bold tabular-nums ${
                      cmpData.trend > 0 ? "text-emerald-600" : cmpData.trend < 0 ? "text-rose-500" : "text-muted-foreground"
                    }`}
                  >
                    {cmpData.trend > 0 ? "+" : ""}
                    {ubFmt(cmpData.trend)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{cmpData.history.length} ta imtihon</div>
                </div>
              </div>

              <div className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">Bloklar kesimida</div>
              <div className="space-y-3 mb-4">
                <CmpBar
                  label={`1-blok — ${cmp.b1s}${cmp.b1cert ? " (🏅 Sertifikat)" : ` (${cmp.b1c}/30 × 3.1)`}`}
                  val={cmp.b1}
                  max={93}
                  color="#2b38ff"
                  bold
                />
                <CmpBar
                  label={`2-blok — ${cmp.b2s}${cmp.b2cert ? " (🏅 Sertifikat)" : ` (${cmp.b2c}/30 × 2.1)`}`}
                  val={cmp.b2}
                  max={63}
                  color="#7c3aed"
                  bold
                />
                <CmpBar
                  label={`Majburiy fanlar (${cmp.m1}+${cmp.m2}+${cmp.m3} × 1.1)`}
                  val={cmp.maj}
                  max={33}
                  color="#f59e0b"
                  bold
                />
                <CmpBar
                  label={`Markaz o'rtachasi (${cmpData.pool.length} natija)`}
                  val={cmpData.poolAvg}
                  max={189}
                  color="#94a3b8"
                />
              </div>

              <div className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">Imtihonlar tarixi</div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40">
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-2">Oy</th>
                      <th className="text-left px-3 py-2">1-blok</th>
                      <th className="text-left px-3 py-2">2-blok</th>
                      <th className="text-right px-3 py-2">Majburiy</th>
                      <th className="text-left px-3 py-2">Jami</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmpData.history.map((h) => (
                      <tr key={h.id} className={`border-b border-border/50 ${h.id === cmp.id ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2 text-[13px]">{imMonthLabel(h.month)}</td>
                        <td className="px-3 py-2 text-[13px] tabular-nums">{ubFmt(h.b1)}</td>
                        <td className="px-3 py-2 text-[13px] tabular-nums">{ubFmt(h.b2)}</td>
                        <td className="px-3 py-2 text-[13px] tabular-nums text-right">{ubFmt(h.maj)}</td>
                        <td className="px-3 py-2">
                          <BallBadge total={h.total} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
