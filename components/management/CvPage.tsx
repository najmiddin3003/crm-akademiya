"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, FilePlus, LayoutGrid, Link2, Search, XCircle } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import {
  CV_APPS_SCRIPT,
  CV_POSITIONS,
  CV_QUESTIONS,
  CV_STATUS,
  CV_STATUS_ORDER,
} from "@/constants/managementCv";
import type { CvApplication, CvStatus } from "@/lib/managementCv";
import Select from "@/components/ui/Select";

// Boshqaruv → Ishga qabul (CV). Referens HTML'dagi "ISHGA QABUL (CV) VIEW"
// bo'limining aynan o'zi: sarlavha + 4 ta amal tugmasi, 5 ta statistika
// kartasi, filtr/qidiruv paneli, arizalar jadvali va uchta modal (ariza
// tafsiloti, Google Sheets sozlash, yangi anketa).
//
// Ma'lumot HAQIQIY — /api/management-cv (MongoDB `cv_applications`).
// Google Sheets ulanishi referensdagidek ixtiyoriy: URL brauzerda
// (localStorage) saqlanadi, jadvaldagi yangi qatorlar bazaga ko'chiriladi.

const CV_SHEETS_KEY = "tizimli_cv_sheets_url";

// Google Sheets manzili brauzerda (localStorage) saqlanadi. `Theme.tsx` dagi
// kabi tashqi do'kon sifatida o'qiymiz: serverda bo'sh, gidratatsiyadan keyin
// haqiqiy qiymat — shunda "ulangan" belgisi mos ravishda chiziladi.
const sheetsListeners = new Set<() => void>();

function subscribeSheetsUrl(cb: () => void) {
  sheetsListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    sheetsListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readSheetsUrl(): string {
  try {
    return localStorage.getItem(CV_SHEETS_KEY) || "";
  } catch {
    return "";
  }
}

function readServerSheetsUrl(): string {
  return "";
}

function writeSheetsUrl(url: string) {
  try {
    localStorage.setItem(CV_SHEETS_KEY, url);
  } catch {
    // localStorage o'chirilgan bo'lsa ham sahifa ishlayversin.
  }
  for (const cb of sheetsListeners) cb();
}

interface CvQuestion {
  k: string;
  q: string;
  req?: boolean;
  type?: "date" | "select" | "multi" | "textarea";
  opts?: string[];
}

const QUESTIONS = CV_QUESTIONS as CvQuestion[];

type FormValues = Record<string, string | string[]>;

function emptyForm(): FormValues {
  const out: FormValues = {};
  for (const f of QUESTIONS) out[f.k] = f.type === "multi" ? [] : "";
  return out;
}

function StatusBadge({ status }: { status: CvStatus }) {
  const s = CV_STATUS[status] || CV_STATUS.new;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

/** Ariza tafsilotidagi bitta qator — qiymati bo'sh bo'lsa chizilmaydi. */
function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b border-border/50">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

function DetailSection({ title }: { title: string }) {
  return <div className="text-[12px] font-bold uppercase tracking-wider text-primary mt-4 mb-1">{title}</div>;
}

export default function CvPage() {
  const { showSuccess, showError } = useToast();

  const [items, setItems] = useState<CvApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterPos, setFilterPos] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [detailId, setDetailId] = useState<number | null>(null);
  const [acting, setActing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [sheetsOpen, setSheetsOpen] = useState(false);
  const sheetsUrl = useSyncExternalStore(subscribeSheetsUrl, readSheetsUrl, readServerSheetsUrl);
  const [sheetsDraft, setSheetsDraft] = useState("");
  const [sheetsTest, setSheetsTest] = useState("");
  /** null — hali tekshirilmagan, true — ulandi, false — ulanmadi. */
  const [sheetsOk, setSheetsOk] = useState<boolean | null>(null);

  const syncBusy = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/management-cv");
    const data = await res.json();
    if (data.ok) setItems(data.applications as CvApplication[]);
    return data.ok ? (data.applications as CvApplication[]) : null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/management-cv")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setItems(d.applications as CvApplication[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Google Sheets → CRM: jadvaldagi yangi arizalarni bazaga ko'chirish ---- */
  const syncSheets = useCallback(
    async (manual: boolean) => {
      if (!sheetsUrl) {
        if (manual) showError("Google Sheets ulanmagan — avval 'Google Sheets' tugmasi orqali sozlang");
        return;
      }
      if (syncBusy.current) return;
      syncBusy.current = true;
      try {
        const res = await fetch(`${sheetsUrl}${sheetsUrl.includes("?") ? "&" : "?"}t=${Date.now()}`);
        const data = await res.json();
        if (!data || !data.ok || !Array.isArray(data.items)) {
          setSheetsOk(false);
          if (manual) showError("Sheets javobi noto'g'ri — 3-qadamni tekshiring");
          return;
        }
        setSheetsOk(true);
        const known = new Set(items.map((c) => c.sid).filter(Boolean));
        const fresh = (data.items as Record<string, unknown>[]).filter(
          (r) => typeof r.sid === "string" && r.sid && !known.has(r.sid),
        );
        for (const r of fresh) {
          await fetch("/api/management-cv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(r),
          });
        }
        if (fresh.length > 0) {
          await load();
          showSuccess(`📥 Google Sheets'dan ${fresh.length} ta yangi CV yuklandi`);
        } else if (manual) {
          showSuccess("Sheets bilan sinxron ✓ — yangi ariza yo'q");
        }
      } catch {
        setSheetsOk(false);
        if (manual) showError("Sheets'ga ulanib bo'lmadi — internet yoki URL ni tekshiring");
      } finally {
        syncBusy.current = false;
      }
    },
    [sheetsUrl, items, load, showSuccess, showError],
  );

  // Ulangan bo'lsa — ochilganda va har 60 soniyada avto-tekshirish. Birinchi
  // tekshiruv ham taymer orqali (render paytida emas) boshlanadi.
  useEffect(() => {
    if (!sheetsUrl) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) syncSheets(false);
    };
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 60000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetsUrl]);

  /** CRM → Sheets: holat o'zgarishini jadvalga ham yozamiz. */
  const pushStatus = useCallback(
    (sid: string | undefined, status: CvStatus) => {
      if (!sheetsUrl || !sid) return;
      fetch(sheetsUrl, { method: "POST", body: JSON.stringify({ action: "status", sid, status }) }).catch(() => {});
    },
    [sheetsUrl],
  );

  /* ---- Filtr / qidiruv ---- */
  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((c) => {
      if (filterPos && c.position !== filterPos) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.subject || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
      );
    });
  }, [items, filterPos, filterStatus, search]);

  const count = useCallback((k: CvStatus) => items.filter((c) => c.status === k).length, [items]);

  const detail = detailId === null ? null : items.find((c) => c.id === detailId) || null;

  /* ---- Holatni o'zgartirish (rad etish / suhbat / ishga olish) ---- */
  const setStatus = useCallback(
    async (cv: CvApplication, status: CvStatus, notify: boolean) => {
      const res = await fetch(`/api/management-cv/${cv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (notify) showError(data.error || "Saqlanmadi");
        return null;
      }
      const updated = data.application as CvApplication;
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      pushStatus(cv.sid, status);
      if (notify) {
        if (status === "interview") showSuccess(`Suhbatga chaqirildi — ${updated.name}`);
        else if (status === "rejected") showSuccess(`CV rad etildi — ${updated.name}`);
        else if (status === "accepted") {
          const role = updated.position === "O'qituvchi" ? "O'qituvchi (foiz 40%)" : updated.position;
          showSuccess(`Ishga olindi — Xodimlar ro'yxatiga qo'shildi: ${updated.name} · ${role}`);
        }
      }
      return updated;
    },
    [pushStatus, showSuccess, showError],
  );

  /** Ariza ochilganda "Yangi" holati referensdagidek "Ko'rib chiqilgan"ga o'tadi. */
  function openDetail(cv: CvApplication) {
    setDetailId(cv.id);
    if (cv.status === "new") setStatus(cv, "reviewed", false);
  }

  async function act(cv: CvApplication, status: CvStatus) {
    setActing(true);
    try {
      await setStatus(cv, status, true);
    } finally {
      setActing(false);
    }
  }

  /* ---- Havolani ulashish ---- */
  function shareLink() {
    const base = `${window.location.origin}/ariza`;
    // Havola Sheets manzilini o'zi bilan olib yuradi — nomzod istalgan
    // qurilmadan ochsa ham arizasi o'sha jadvalga tushadi.
    const link = sheetsUrl ? `${base}#s=${encodeURIComponent(btoa(sheetsUrl))}` : base;
    const done = () => showSuccess(`🔗 Havola nusxalandi: ${link}`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done).catch(done);
    else done();
  }

  /* ---- Sheets sozlamasi ---- */
  function openSheets() {
    setSheetsDraft(sheetsUrl);
    setSheetsTest("");
    setSheetsOpen(true);
  }

  function copyScript() {
    const done = () => showSuccess("📋 Apps Script kodi nusxalandi — endi uni Apps Script muharririga qo'ying");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(CV_APPS_SCRIPT).then(done).catch(done);
    else done();
  }

  async function saveSheetsUrl() {
    const url = sheetsDraft.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      setSheetsTest("⚠ To'g'ri URL kiriting (https://...)");
      return;
    }
    writeSheetsUrl(url);
    setSheetsTest("Tekshirilmoqda...");
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}ping=${Date.now()}`);
      const data = await res.json();
      if (data && data.ok !== undefined) {
        setSheetsTest("✓ Ulandi! Arizalar endi jadvalga tushadi.");
        setSheetsOk(true);
        showSuccess("✓ Google Sheets ulandi — arizalar jadvalga yoziladi va shu yerda ko'rinadi");
      } else {
        setSheetsTest("⚠ Javob noto'g'ri — 3-qadamni tekshiring");
        setSheetsOk(false);
      }
    } catch {
      setSheetsTest("⚠ Ulanib bo'lmadi — URL va 'Anyone' ruxsatini tekshiring");
      setSheetsOk(false);
    }
  }

  /* ---- Yangi anketa ---- */
  function openForm() {
    setForm(emptyForm());
    setFormOpen(true);
  }

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleMulti(k: string, opt: string) {
    setForm((f) => {
      const cur = (f[k] as string[]) || [];
      return { ...f, [k]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }

  async function submitForm() {
    const val = (k: string) => String(form[k] ?? "").trim();
    if (!val("name")) return showError("⚠ Ism va familiyani kiriting");
    if (!val("phone")) return showError("⚠ Telefon raqamni kiriting");
    if (!val("position")) return showError("⚠ Yo'nalishni tanlang");
    setSubmitting(true);
    try {
      const res = await fetch("/api/management-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      await load();
      setFormOpen(false);
      showSuccess(`CV qabul qilindi — ${data.application.name}, ariza "Yangi" holatida`);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  }

  const closeDetail = useCallback(() => setDetailId(null), []);
  useEscapeClose(
    useCallback(() => {
      setDetailId(null);
      setFormOpen(false);
      setSheetsOpen(false);
    }, []),
  );

  const dotCls = sheetsOk === true ? "bg-emerald-500" : sheetsOk === false ? "bg-rose-500" : "bg-slate-400";

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ishga qabul — CV arizalari</h1>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Anketa asosida kelgan CV lar; munosiblarini tanlab Xodimlar ro&apos;yxatiga qo&apos;shing
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openSheets}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <LayoutGrid className="w-4 h-4 text-emerald-600" />
            <span>Google Sheets</span>
            {sheetsUrl && <span className={`h-2 w-2 rounded-full ${dotCls}`} />}
          </button>
          {sheetsUrl && (
            <button
              onClick={() => syncSheets(true)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary"
              title="Sheets'dan yangilash"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={shareLink}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15"
          >
            <Link2 className="w-4 h-4" />
            <span>Ariza havolasini ulashish</span>
          </button>
          <button
            onClick={openForm}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <FilePlus className="w-4 h-4" />
            <span>CV to&apos;ldirish (yangi ariza)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Jami CV" value={items.length} />
        <StatCard label="Yangi" value={count("new")} color="text-blue-600" />
        <StatCard label="Suhbatga chaqirilgan" value={count("interview")} color="text-amber-600" />
        <StatCard label="Ishga olingan" value={count("accepted")} color="text-emerald-600" />
        <StatCard label="Rad etilgan" value={count("rejected")} color="text-rose-500" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterPos} onChange={(v) => setFilterPos(v)} options={(CV_POSITIONS as string[]).map((p) => ({ value: p, label: p }))} placeholder="Yo'nalish — barchasi" clearable size="sm" className="w-44" />
        <Select value={filterStatus} onChange={(v) => setFilterStatus(v)} options={(CV_STATUS_ORDER as CvStatus[]).map((s) => ({ value: s, label: CV_STATUS[s].label }))} placeholder="Holat — barchasi" clearable size="sm" className="w-44" />
        <div className="flex-1" />
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder="Ism, fan yoki telefon bo'yicha qidirish"
            className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{visible.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">F.I.Sh</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Yo&apos;nalish</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Fan / soha</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Tajriba</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Kutilayotgan maosh</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Telefon</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Topshirilgan</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Holati</th>
                <th className="text-right px-4 py-3 whitespace-nowrap w-24" />
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
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
                    CV topilmadi. Filterni o&apos;zgartirib ko&apos;ring.
                  </td>
                </tr>
              )}
              {!loading &&
                visible.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-[13px]">{c.position}</td>
                    <td className="px-4 py-3 text-[13px]">{c.subject || "-"}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">
                      {(c.experience || "").split("—")[0].trim() || "-"}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{c.expectedSalary || "-"} so&apos;m</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{c.phone}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{c.submitted}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(c);
                        }}
                        className="h-8 px-3 rounded-md bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/15"
                      >
                        Ko&apos;rish
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== CV DETAIL MODAL ===== */}
      {detail && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-[18px] font-semibold">{detail.name}</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    {detail.position}
                    {detail.subject && detail.subject !== "-" ? ` · ${detail.subject}` : ""} · {detail.phone}
                  </div>
                  <div className="mt-1.5">
                    <StatusBadge status={detail.status} />
                  </div>
                </div>
                <button
                  onClick={closeDetail}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground flex-shrink-0"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <DetailSection title="Shaxsiy ma'lumotlar" />
              <DetailRow label="Yashash manzili" value={detail.address} />
              <DetailRow label="Tug'ilgan sana" value={detail.birth} />
              <DetailRow label="Hozirgi ish holati" value={detail.currentJob} />

              <DetailSection title="Ta'lim va tajriba" />
              <DetailRow label="Oliygoh" value={detail.university} />
              <DetailRow label="Ish tajribasi" value={detail.experience} />
              <DetailRow label="Qaysi o'quv markaz/maktablarda ishlagan" value={detail.schools} />
              <DetailRow label="Yutuqlar va sertifikatlar" value={detail.achievements} />
              <DetailRow label="Qanday darajadagi o'quvchilarga dars bera oladi" value={detail.levels} />

              <DetailSection title="Ish haqida" />
              <DetailRow label="Qachondan boshlay oladi" value={detail.startDate} />
              <DetailRow label="Kutilayotgan oylik maosh" value={`${detail.expectedSalary || "-"} so'm`} />
              <DetailRow label="Qanday natija beradi" value={detail.results} />

              <DetailSection title="Motivatsiya" />
              <DetailRow label="Nega aynan bizning markaz" value={detail.whyUs} />
              <DetailRow label="5 yillik rejalari" value={detail.plans5} />
              <DetailRow label="Ish tanlashda muhim omillar" value={(detail.priorities || []).join(", ")} />
              <DetailRow label="Kuchli tomonlari" value={(detail.strengths || []).join(", ")} />
              <DetailRow label="Qo'shimcha" value={detail.extra} />

              <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border flex-wrap">
                {detail.status === "accepted" ? (
                  <span className="text-[13px] text-emerald-600 font-medium mr-auto">
                    ✓ Xodimlar ro&apos;yxatiga qo&apos;shilgan
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => act(detail, "rejected")}
                      disabled={acting}
                      className="h-9 px-4 rounded-lg border border-rose-300 bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 disabled:opacity-60"
                    >
                      Rad etish
                    </button>
                    <button
                      onClick={() => act(detail, "interview")}
                      disabled={acting}
                      className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
                    >
                      Suhbatga chaqirish
                    </button>
                    <button
                      onClick={() => act(detail, "accepted")}
                      disabled={acting}
                      className="h-9 px-5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60"
                    >
                      ✓ Ishga olish
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== GOOGLE SHEETS SOZLASH MODALI ===== */}
      {sheetsOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetsOpen(false);
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[17px] font-semibold">Google Sheets bilan bog&apos;lash</div>
                <button
                  onClick={() => setSheetsOpen(false)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[13px] text-muted-foreground mb-4">
                Bir marta sozlaysiz — keyin barcha arizalar to&apos;g&apos;ridan-to&apos;g&apos;ri Google jadvalingizga
                tushadi va shu yerda ko&apos;rinadi (istalgan qurilmadan).
              </div>

              <div className="space-y-3 text-[13px]">
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                  <div className="font-semibold mb-1">1-qadam. Yangi jadval oching</div>
                  <div className="text-muted-foreground">
                    Brauzerda <b>sheets.new</b> deb yozing — yangi Google Sheets ochiladi. Nomini masalan
                    &quot;Akademiya CV&quot; qilib qo&apos;ying.
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                  <div className="font-semibold mb-1">2-qadam. Apps Script kodini qo&apos;ying</div>
                  <div className="text-muted-foreground mb-2">
                    Jadvalda: <b>Kengaytmalar (Extensions) → Apps Script</b> — ochilgan muharrirdagi hamma narsani
                    o&apos;chirib, quyidagi kodni qo&apos;ying va saqlang:
                  </div>
                  <button
                    onClick={copyScript}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-[13px] font-medium hover:opacity-90"
                  >
                    📋 Kodni nusxalash
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                  <div className="font-semibold mb-1">3-qadam. Web App qilib joylang</div>
                  <div className="text-muted-foreground">
                    Apps Script&apos;da: <b>Deploy → New deployment → Web app</b>. &quot;Execute as&quot; = <b>Me</b>,
                    &quot;Who has access&quot; = <b>Anyone</b>. <b>Deploy</b> bosing, ruxsat bering va chiqqan{" "}
                    <b>URL</b> ni nusxalang (…/exec bilan tugaydi).
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5">
                  <div className="font-semibold mb-1.5 text-slate-900">4-qadam. URL ni shu yerga qo&apos;ying</div>
                  <input
                    value={sheetsDraft}
                    onChange={(e) => setSheetsDraft(e.target.value)}
                    type="text"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={saveSheetsUrl}
                      className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-600"
                    >
                      Saqlash va tekshirish
                    </button>
                    <span className="text-[12px] text-muted-foreground">{sheetsTest}</span>
                  </div>
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Eslatma: &quot;Ariza havolasini ulashish&quot; tugmasi Sheets manzilini havola ichiga qo&apos;shib
                  beradi — nomzod istalgan telefonda ochsa ham arizasi jadvalingizga tushadi.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CV FORM MODAL (anketa) ===== */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[17px] font-semibold">Ishga qabul anketasi</div>
                <button
                  onClick={() => setFormOpen(false)}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[12px] text-muted-foreground mb-4">
                Akademiya o&apos;quv markazi — jamoamizga qo&apos;shilish uchun anketani to&apos;ldiring. Faqat jiddiy
                nomzodlar ko&apos;rib chiqiladi.
              </div>

              <div className="space-y-3">
                {QUESTIONS.map((f, i) => (
                  <div key={f.k}>
                    <label className="block text-[13px] font-medium mb-1">
                      {i + 1}. {f.q}
                      {f.req && <span className="text-rose-500">*</span>}
                    </label>
                    {f.type === "select" ? (
                      <Select value={String(form[f.k] ?? "")} onChange={(v) => setField(f.k, v)} options={(f.opts || []).map((o) => ({ value: o, label: o }))} placeholder="Tanlang" clearable />
                    ) : f.type === "multi" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {(f.opts || []).map((o) => (
                          <label key={o} className="flex items-center gap-2 text-[13px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={((form[f.k] as string[]) || []).includes(o)}
                              onChange={() => toggleMulti(f.k, o)}
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                            <span>{o}</span>
                          </label>
                        ))}
                      </div>
                    ) : f.type === "textarea" ? (
                      <textarea
                        value={String(form[f.k] ?? "")}
                        onChange={(e) => setField(f.k, e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                      />
                    ) : (
                      <input
                        value={String(form[f.k] ?? "")}
                        onChange={(e) => setField(f.k, e.target.value)}
                        type={f.type === "date" ? "date" : "text"}
                        className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
                <button
                  onClick={() => setFormOpen(false)}
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm disabled:opacity-60"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={submitForm}
                  disabled={submitting}
                  className="h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Yuborilmoqda…" : "Anketani yuborish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums ${color || ""}`}>{value}</div>
    </div>
  );
}
