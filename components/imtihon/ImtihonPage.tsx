"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownSquare, ChevronDown, FilePlus, Search, Share2, Trash2, XCircle } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { STUDENTS_LIST } from "@/constants/studentsList";
import { IM_LEVELS, IM_SUBJECTS } from "@/constants/imtihon";
import { imMonthLabel, imPct, normalizeMonth, type MonthlyExam } from "@/lib/imtihon";
import { downloadCsv, intOf, normHeader, readFileRows, type ParseResult } from "./importUtils";
import UzbmbView from "./UzbmbView";

// Imtihon bo'limi — referens HTML'dagi "IMTIHON (Oylik imtihon) VIEW" ning
// aynan o'zi: sarlavha + 4 amal tugmasi, ichki tablar (Oylik imtihon | UzBMB),
// 4 ta statistika kartasi, filtrlar, jadval va uch modal (natija kiritish,
// Excel/CSV import, solishtirish).
//
// Ma'lumot HAQIQIY — /api/imtihon/monthly (MongoDB `monthly_exams`).
// UzBMB tabi alohida komponentda (`UzbmbView`).

type MonthlyParsed = Omit<MonthlyExam, "id">;

interface EntryForm {
  student: string;
  subject: string;
  level: string;
  month: string;
  total: string;
  correct: string;
}

function emptyEntry(): EntryForm {
  const d = new Date();
  return {
    student: "",
    subject: IM_SUBJECTS[0],
    level: "",
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    total: "",
    correct: "",
  };
}

function pctCls(p: number): string {
  return p >= 80 ? "text-emerald-600" : p >= 60 ? "text-amber-600" : "text-rose-500";
}

function PctBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 80 ? "bg-emerald-100 text-emerald-700" : pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold tabular-nums ${cls}`}>
      {pct}%
    </span>
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

/** Solishtirish modalidagi progress chizig'i (foizli). */
function CmpBar({ label, val, color, bold }: { label: string; val: number; color: string; bold?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
        <span className={`font-bold tabular-nums ${bold ? "" : "text-muted-foreground"}`}>{val}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, val)}%`, background: color }} />
      </div>
    </div>
  );
}

function avgOf(arr: MonthlyExam[]): number {
  return arr.length ? Math.round(arr.reduce((s, r) => s + r.pct, 0) / arr.length) : 0;
}

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls =
  "w-full h-10 appearance-none rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function ImtihonPage() {
  const { showSuccess, showError } = useToast();

  // Tab holati manzilda: /imtihon (oylik) va /imtihon?tab=uzbmb. Shunda
  // sidebar'dagi "Oylik imtihon" / "UzBMB" havolalari to'g'ridan-to'g'ri
  // kerakli tabni ochadi.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: "oylik" | "uzbmb" = searchParams.get("tab") === "uzbmb" ? "uzbmb" : "oylik";
  const setTab = useCallback(
    (t: "oylik" | "uzbmb") => {
      router.replace(t === "uzbmb" ? `${pathname}?tab=uzbmb` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const [exams, setExams] = useState<MonthlyExam[]>([]);
  const [loading, setLoading] = useState(true);

  // `null` — foydalanuvchi hali tanlamagan, eng oxirgi oy ko'rsatiladi.
  const [fMonth, setFMonth] = useState<string | null>(null);
  const [fSubject, setFSubject] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [search, setSearch] = useState("");

  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState<EntryForm>(emptyEntry);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [parsed, setParsed] = useState<ParseResult<MonthlyParsed> | null>(null);
  const [applying, setApplying] = useState(false);

  const [cmpId, setCmpId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/imtihon/monthly")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setExams(d.exams as MonthlyExam[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const months = useMemo(() => [...new Set(exams.map((r) => r.month))].sort().reverse(), [exams]);
  const fm = fMonth ?? months[0] ?? "";

  const subjects = useMemo(() => [...new Set([...IM_SUBJECTS, ...exams.map((r) => r.subject)])], [exams]);
  const levels = useMemo(
    () => [...new Set([...IM_LEVELS, ...exams.map((r) => r.level).filter(Boolean)])],
    [exams],
  );

  const items = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exams
      .filter((r) => {
        if (fm && r.month !== fm) return false;
        if (fSubject && r.subject !== fSubject) return false;
        if (fLevel && r.level !== fLevel) return false;
        if (q && !r.student.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.pct - a.pct || a.student.localeCompare(b.student));
  }, [exams, fm, fSubject, fLevel, search]);

  // Markaz o'rtachasi — tanlangan oy bo'yicha, boshqa filtrlarsiz.
  const centerAvg = useMemo(() => avgOf(fm ? exams.filter((r) => r.month === fm) : exams), [exams, fm]);

  const best = items.length ? items[0] : null;
  const green = items.filter((r) => r.pct >= 80).length;

  const studentNames = useMemo(() => {
    const names = new Set<string>();
    STUDENTS_LIST.slice(0, 150).forEach((s: { name: string }) => names.add(s.name));
    exams.forEach((r) => names.add(r.student));
    return [...names];
  }, [exams]);

  /* ---- Natija kiritish ---- */
  function openEntry() {
    setEntry(emptyEntry());
    setEntryOpen(true);
  }

  const entryTotal = Number(entry.total) || 0;
  const entryCorrect = Number(entry.correct) || 0;
  const entryValid = entryTotal > 0 && entryCorrect >= 0 && entryCorrect <= entryTotal;
  const entryPct = entryValid ? imPct(entryCorrect, entryTotal) : 0;

  async function saveEntry() {
    const student = entry.student.trim();
    if (!student) return showError("⚠ O'quvchi ismini kiriting");
    if (!entry.subject) return showError("⚠ Fanni tanlang");
    if (!entry.month) return showError("⚠ Oyni tanlang");
    if (entryTotal <= 0) return showError("⚠ Savollar sonini kiriting");
    if (entryCorrect < 0 || entryCorrect > entryTotal) {
      return showError("⚠ To'g'ri javoblar savollar sonidan oshmasin");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/imtihon/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, student, total: entryTotal, correct: entryCorrect }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setExams(data.exams as MonthlyExam[]);
      setEntryOpen(false);
      showSuccess(
        `${data.updated ? "Natija yangilandi" : "Natija saqlandi"} — ${student} · ${entry.subject} · ${entryPct}% (${entryCorrect}/${entryTotal})`,
      );
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  /* ---- O'chirish ---- */
  const remove = useCallback(
    async (r: MonthlyExam) => {
      const res = await fetch(`/api/imtihon/monthly/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setExams((prev) => prev.filter((x) => x.id !== r.id));
      setCmpId((cur) => (cur === r.id ? null : cur));
      showSuccess(`Natija o'chirildi — ${r.student} · ${r.subject} · ${imMonthLabel(r.month)}`);
    },
    [showSuccess, showError],
  );

  /* ---- Eksport / shablon ---- */
  function exportCsv() {
    const list = fm ? exams.filter((r) => r.month === fm) : exams;
    const head = ["O'quvchi", "Fan", "Bosqich", "Oy", "Savollar soni", "To'g'ri javoblar", "O'zlashtirish (%)"];
    const rows = list.map((r) => [r.student, r.subject, r.level || "", r.month, r.total, r.correct, r.pct]);
    downloadCsv([head, ...rows], "oylik_imtihon" + (fm ? "_" + fm : "") + ".csv");
    showSuccess(`📤 Yuklab olindi — ${list.length} ta natija (Excel'da ochiladi)`);
  }

  function downloadTemplate() {
    downloadCsv(
      [
        ["O'quvchi", "Fan", "Bosqich", "Oy", "Savollar soni", "To'g'ri javoblar"],
        ["Avazxonov Asadbek", "Ingliz tili", "1-bosqich", "2026-08", "25", "21"],
        ["Madina Muhammadova", "Matematika", "Abituriyent", "2026-08", "30", "24"],
      ],
      "imtihon_shablon.csv",
    );
    showSuccess("📄 Shablon yuklab olindi — Excel'da to'ldirib, shu oynaga yuklang");
  }

  /* ---- Import ---- */
  function openImport() {
    setParsed(null);
    setImportOpen(true);
  }

  function parseTable(rows: string[][]): ParseResult<MonthlyParsed> {
    if (!rows || rows.length < 2) {
      return { ok: [], errors: ["Faylda ma'lumot topilmadi (sarlavha + kamida 1 qator kerak)"] };
    }
    const head = rows[0].map(normHeader);
    const find = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
    const iName = find("oquvchi", "ism", "student", "fio");
    const iSubj = find("fan", "subject", "yonalish");
    const iLvl = find("bosqich", "daraja", "level");
    const iMonth = find("oy", "month", "sana");
    const iTotal = find("savol", "total", "jami");
    const iCorr = find("togri", "correct", "ball");

    const errors: string[] = [];
    if (iName < 0) errors.push("«O'quvchi» ustuni topilmadi");
    if (iSubj < 0) errors.push("«Fan» ustuni topilmadi");
    if (iTotal < 0) errors.push("«Savollar soni» ustuni topilmadi");
    if (iCorr < 0) errors.push("«To'g'ri javoblar» ustuni topilmadi");
    if (errors.length) return { ok: [], errors };

    const ok: MonthlyParsed[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const student = String(r[iName] || "").trim();
      if (!student) continue;
      const subject = String(r[iSubj] || "").trim();
      const level = iLvl >= 0 ? String(r[iLvl] || "").trim() : "";
      const month = normalizeMonth(iMonth >= 0 ? String(r[iMonth] || "") : "");
      const total = intOf(r[iTotal]);
      const correct = intOf(r[iCorr]);
      if (!subject) {
        errors.push(`${i + 1}-qator (${student}): fan bo'sh`);
        continue;
      }
      if (total <= 0) {
        errors.push(`${i + 1}-qator (${student}): savollar soni noto'g'ri`);
        continue;
      }
      if (correct > total) {
        errors.push(`${i + 1}-qator (${student}): to'g'ri javob (${correct}) savollardan (${total}) ko'p`);
        continue;
      }
      ok.push({ student, subject, level, month, total, correct, pct: imPct(correct, total) });
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
      const res = await fetch("/api/imtihon/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed.ok }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Yuklanmadi");
        return;
      }
      setExams(data.exams as MonthlyExam[]);
      setImportOpen(false);
      showSuccess(`📥 Bazaga qo'shildi — ${data.added} ta yangi, ${data.updated} ta yangilangan natija`);
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
    const monthPool = exams.filter((x) => x.month === cmp.month);
    const subjPool = monthPool.filter((x) => x.subject === cmp.subject);
    const lvlPool = subjPool.filter((x) => x.level === cmp.level);
    const rank = subjPool.slice().sort((a, b) => b.pct - a.pct).findIndex((x) => x.id === cmp.id) + 1;
    const history = exams
      .filter((x) => x.student === cmp.student && x.subject === cmp.subject)
      .sort((a, b) => a.month.localeCompare(b.month));
    const trend = history.length > 1 ? history[history.length - 1].pct - history[history.length - 2].pct : 0;
    return {
      monthPool, subjPool, lvlPool, rank, history, trend,
      centerAvg: avgOf(monthPool),
      subjAvg: avgOf(subjPool),
      lvlAvg: avgOf(lvlPool),
    };
  }, [cmp, exams]);

  useEscapeClose(
    useCallback(() => {
      setEntryOpen(false);
      setImportOpen(false);
      setCmpId(null);
    }, []),
  );

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Imtihon</h1>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Oylik imtihon va UzBMB natijalari — saqlanadi, avtomatik hisoblanadi va solishtiriladi
          </div>
        </div>
        {tab === "oylik" && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
              title="Import uchun tayyor shablon"
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
            <button
              onClick={openEntry}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <FilePlus className="w-4 h-4" />
              <span>Natija kiritish</span>
            </button>
          </div>
        )}
      </div>

      {/* Ichki tablar */}
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-card">
        <button
          onClick={() => setTab("oylik")}
          className={`h-8 px-3.5 rounded-md text-sm font-medium ${tab === "oylik" ? "bg-primary text-white" : "hover:bg-secondary"}`}
        >
          Oylik imtihon
        </button>
        <button
          onClick={() => setTab("uzbmb")}
          className={`h-8 px-3.5 rounded-md text-sm font-medium ${tab === "uzbmb" ? "bg-primary text-white" : "hover:bg-secondary"}`}
        >
          UzBMB
        </button>
      </div>

      {/* Ikkala tab ham DOM'da qoladi (referensdagidek `hidden` bilan
          almashadi) — shunda filtr/qidiruv holati tab almashganda yo'qolmaydi. */}
      <div className={tab === "oylik" ? "space-y-4" : "hidden"}>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label={"Natijalar" + (fm ? " (" + imMonthLabel(fm) + ")" : "")}
            value={items.length}
            sub="kiritilgan imtihon natijasi"
          />
          <StatCard
            label="Markaz o'rtachasi"
            value={centerAvg + "%"}
            sub={fm ? imMonthLabel(fm) + " bo'yicha" : "barcha oylar"}
            color={pctCls(centerAvg)}
          />
          <StatCard
            label="Eng yuqori natija"
            value={best ? best.pct + "%" : "—"}
            sub={best ? best.student : ""}
            color="text-emerald-600"
          />
          <StatCard
            label="80% dan yuqori"
            value={green}
            sub={items.length ? Math.round((green / items.length) * 100) + "% o'quvchi" : ""}
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
              className="h-9 w-40 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Fan — barchasi</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              value={fLevel}
              onChange={(e) => setFLevel(e.target.value)}
              className="h-9 w-44 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Bosqich — barchasi</option>
              {levels.map((s) => (
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
                  <th className="text-left px-4 py-3 whitespace-nowrap">Fan</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Bosqich</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Oy</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Savollar</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">To&apos;g&apos;ri javoblar</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">O&apos;zlashtirish</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Markazga nisbatan</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap w-32" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8">
                      <SpinnerBlock size={22} />
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
                      Natija topilmadi. Filterni o&apos;zgartiring yoki &quot;Natija kiritish&quot; tugmasidan
                      foydalaning.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((r, i) => {
                    const diff = r.pct - centerAvg;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setCmpId(r.id)}
                        className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                        <td className="px-4 py-3 text-[13px] font-medium">{r.student}</td>
                        <td className="px-4 py-3 text-[13px]">{r.subject}</td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">{r.level || "-"}</td>
                        <td className="px-4 py-3 text-[13px] tabular-nums">{imMonthLabel(r.month)}</td>
                        <td className="px-4 py-3 text-[13px] tabular-nums text-right">{r.total}</td>
                        <td className="px-4 py-3 text-[13px] tabular-nums text-right">{r.correct}</td>
                        <td className="px-4 py-3">
                          <PctBadge pct={r.pct} />
                        </td>
                        <td className="px-4 py-3">
                          {diff === 0 ? (
                            <span className="text-[12px] text-muted-foreground">= markaz</span>
                          ) : (
                            <span
                              className={`text-[12px] font-semibold tabular-nums ${diff > 0 ? "text-emerald-600" : "text-rose-500"}`}
                            >
                              {diff > 0 ? "+" : ""}
                              {diff}%
                            </span>
                          )}
                        </td>
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
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={tab === "uzbmb" ? "" : "hidden"}>
        <UzbmbView />
      </div>

      {/* ===== NATIJA KIRITISH MODALI ===== */}
      {entryOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEntryOpen(false);
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[16px] font-semibold">Oylik imtihon natijasi</div>
                <button
                  onClick={() => setEntryOpen(false)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[13px] font-medium mb-1.5">
                    O&apos;quvchi<span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={entry.student}
                    onChange={(e) => setEntry((f) => ({ ...f, student: e.target.value }))}
                    list="im-students-dl"
                    type="text"
                    placeholder="Ism yozing..."
                    className={inputCls}
                  />
                  <datalist id="im-students-dl">
                    {studentNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">
                      Fan<span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={entry.subject}
                      onChange={(e) => setEntry((f) => ({ ...f, subject: e.target.value }))}
                      className={selectCls}
                    >
                      {IM_SUBJECTS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">Bosqich</label>
                    <select
                      value={entry.level}
                      onChange={(e) => setEntry((f) => ({ ...f, level: e.target.value }))}
                      className={selectCls}
                    >
                      <option value="">—</option>
                      {IM_LEVELS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Oy</label>
                  <input
                    value={entry.month}
                    onChange={(e) => setEntry((f) => ({ ...f, month: e.target.value }))}
                    type="month"
                    className={`${inputCls} tabular-nums`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">
                      Savollar soni<span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={entry.total}
                      onChange={(e) => setEntry((f) => ({ ...f, total: e.target.value }))}
                      type="number"
                      min={1}
                      placeholder="25"
                      className={`${inputCls} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5">
                      To&apos;g&apos;ri javoblar<span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={entry.correct}
                      onChange={(e) => setEntry((f) => ({ ...f, correct: e.target.value }))}
                      type="number"
                      min={0}
                      placeholder="20"
                      className={`${inputCls} tabular-nums`}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-3.5 text-center">
                  <div className="text-[12px] text-muted-foreground">O&apos;zlashtirish (avtomatik)</div>
                  {entryValid ? (
                    <div className={`text-[26px] font-bold tabular-nums ${pctCls(entryPct)}`}>{entryPct}%</div>
                  ) : (
                    <div className="text-[20px] font-bold tabular-nums text-muted-foreground">
                      {entryCorrect > entryTotal ? "⚠ to'g'ri javob savoldan ko'p" : "—"}
                    </div>
                  )}
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

      {/* ===== IMPORT MODALI ===== */}
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
                <div className="text-[16px] font-semibold">Excel / CSV dan yuklash</div>
                <button
                  onClick={() => setImportOpen(false)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[13px] text-muted-foreground mb-3">
                Ma&apos;lumotlarni Excel&apos;da jamlab, bir harakat bilan barcha o&apos;quvchilarni bazaga kiriting.
                Ustunlar: <b>O&apos;quvchi, Fan, Bosqich, Oy (2026-08), Savollar soni, To&apos;g&apos;ri javoblar</b>.{" "}
                <button onClick={downloadTemplate} className="text-primary font-medium hover:underline">
                  Tayyor shablonni yuklab olish
                </button>
              </div>
              <label className="block rounded-xl border-2 border-dashed border-border bg-secondary/20 p-6 text-center cursor-pointer hover:bg-secondary/40 transition-colors">
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
                <ArrowDownSquare className="mx-auto mb-2 text-muted-foreground" style={{ width: 28, height: 28 }} />
                <div className="text-[13px] font-medium">Faylni tanlang yoki shu yerga tashlang</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">.xlsx, .xls yoki .csv</div>
              </label>
              {parsed && (
                <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-3.5 text-[13px]">
                  <div className={`font-semibold ${parsed.ok.length ? "text-emerald-600" : "text-rose-500"}`}>
                    {parsed.ok.length ? `✓ ${parsed.ok.length} ta natija o'qildi` : "⚠ Yaroqli qator topilmadi"}
                  </div>
                  {parsed.ok.length > 0 && (
                    <div className="text-muted-foreground mt-1">
                      {parsed.ok.slice(0, 4).map((r, i) => (
                        <div key={i}>
                          {r.student} — {r.subject} — {r.pct}%
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
                      {parsed.errors.length > 5 && <div>… yana {parsed.errors.length - 5} ta xato</div>}
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

      {/* ===== SOLISHTIRISH MODALI ===== */}
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
                    {cmp.subject}
                    {cmp.level ? " · " + cmp.level : ""} · {imMonthLabel(cmp.month)}
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
                  <div className="text-[11px] text-muted-foreground">Natija</div>
                  <div className={`text-[22px] font-bold tabular-nums ${pctCls(cmp.pct)}`}>{cmp.pct}%</div>
                  <div className="text-[11px] text-muted-foreground">
                    {cmp.correct}/{cmp.total} savol
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Fan bo&apos;yicha o&apos;rin</div>
                  <div className="text-[22px] font-bold tabular-nums text-primary">{cmpData.rank}-o&apos;rin</div>
                  <div className="text-[11px] text-muted-foreground">{cmpData.subjPool.length} o&apos;quvchi ichida</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">O&apos;sish (oldingi oyga)</div>
                  <div
                    className={`text-[22px] font-bold tabular-nums ${
                      cmpData.trend > 0 ? "text-emerald-600" : cmpData.trend < 0 ? "text-rose-500" : "text-muted-foreground"
                    }`}
                  >
                    {cmpData.trend > 0 ? "+" : ""}
                    {cmpData.trend}%
                  </div>
                  <div className="text-[11px] text-muted-foreground">{cmpData.history.length} oylik tarix</div>
                </div>
              </div>

              <div className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">
                Solishtirish — {imMonthLabel(cmp.month)}
              </div>
              <div className="space-y-3 mb-4">
                <CmpBar label={cmp.student} val={cmp.pct} color="#2b38ff" bold />
                <CmpBar
                  label={`Markaz o'rtachasi (${cmpData.monthPool.length} natija)`}
                  val={cmpData.centerAvg}
                  color="#94a3b8"
                />
                <CmpBar
                  label={`${cmp.subject} o'rtachasi (${cmpData.subjPool.length})`}
                  val={cmpData.subjAvg}
                  color="#f59e0b"
                />
                {cmp.level ? (
                  <CmpBar
                    label={`${cmp.level} o'rtachasi (${cmpData.lvlPool.length})`}
                    val={cmpData.lvlAvg}
                    color="#10b981"
                  />
                ) : null}
              </div>

              <div className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">
                Oylik tarix — {cmp.subject}
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40">
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-2">Oy</th>
                      <th className="text-right px-3 py-2">Savollar</th>
                      <th className="text-right px-3 py-2">To&apos;g&apos;ri</th>
                      <th className="text-left px-3 py-2">O&apos;zlashtirish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmpData.history.map((h) => (
                      <tr key={h.id} className={`border-b border-border/50 ${h.id === cmp.id ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2 text-[13px]">{imMonthLabel(h.month)}</td>
                        <td className="px-3 py-2 text-[13px] tabular-nums text-right">{h.total}</td>
                        <td className="px-3 py-2 text-[13px] tabular-nums text-right">{h.correct}</td>
                        <td className="px-3 py-2">
                          <PctBadge pct={h.pct} />
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
