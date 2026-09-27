"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, Building2, Download, ExternalLink, FilePlus, LayoutGrid, Link2, Lock, Paperclip, Search, Wallet, X, XCircle } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  CV_ANY_BRANCH,
  CV_APPS_SCRIPT,
  CV_EDU_LEVELS,
  CV_EXP_LEVELS,
  CV_LOADS,
  CV_POSITIONS,
  CV_SOURCES,
  CV_STATUS,
  CV_STATUS_ORDER,
  CV_SUBJECT_GROUPS,
} from "@/constants/managementCv";
import { CV_NOTE_MAX, type CvApplication, type CvFile, type CvStatus } from "@/lib/managementCv";
import { activeCvFilters, CV_BRANCH_ANY, cvMatches, NO_CV_FILTERS, subjectMatches, textKey, type CvFacet, type CvFilters } from "@/lib/cvFilters";
import Select from "@/components/ui/Select";
import MoneyInput from "@/components/ui/MoneyInput";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import CvFormModal from "./CvFormModal";

// Boshqaruv → Ishga qabul (CV). Referens HTML'dagi "ISHGA QABUL (CV) VIEW"
// bo'limining aynan o'zi: sarlavha + 4 ta amal tugmasi, 5 ta statistika
// kartasi, filtr/qidiruv paneli, arizalar jadvali va modallar (ariza
// tafsiloti, fayl ko'rish, Google Sheets sozlash, yangi anketa —
// CvFormModal.tsx, ommaviy /ariza bilan bir xil savollar).
//
// Ma'lumot HAQIQIY — /api/management-cv (MongoDB `cv_applications`).
// Google Sheets ulanishi referensdagidek ixtiyoriy: URL brauzerda
// (localStorage) saqlanadi, jadvaldagi yangi qatorlar bazaga ko'chiriladi.
//
// FILIAL (19.09.2026): ro'yxat navbarda tanlangan filialniki — kesish
// serverda (route `cvBranchFilter`), filial almashganda sahifa qayta
// yuklanadi (BranchContext). "Qaysi filial bo'lsa ham" va eski arizalar
// hammasida ko'rinadi. Yangi ommaviy anketa (/ariza) rasm, filial,
// bandlik, ta'lim darajasi va fayllar bilan keladi — jadval va tafsilot
// ikkala avlodni ham chizadi.

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

/**
 * Nomzod rasmi (yangi anketa) yoki bosh harflar (eski). `onOpen` berilsa
 * rasm bosiladi va kattalashtirib ko'rsatiladi (PhotoViewer) — jadval
 * qatorining o'z bosilishi (tafsilot) ishlamaydi.
 */
function Avatar({ cv, size = 32, onOpen }: { cv: CvApplication; size?: number; onOpen?: () => void }) {
  const { t } = useT();
  const initials = cv.name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  if (cv.photoUrl && onOpen) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        title={t("Rasmni kattalashtirish")}
        aria-label={t("Rasmni kattalashtirish")}
        className="shrink-0 rounded-lg cursor-zoom-in transition hover:ring-2 hover:ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cv.photoUrl} alt="" className="block rounded-lg object-cover" style={{ width: size, height: size }} />
      </button>
    );
  }
  return cv.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cv.photoUrl} alt="" className="rounded-lg object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="inline-flex items-center justify-center rounded-lg bg-secondary text-[11px] font-semibold text-muted-foreground shrink-0" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

/**
 * "Tajriba" ustuni — eski anketada erkin matn (bir necha jumla) bo'lgani
 * uchun jadval buzilib ketardi (19.09.2026). Faqat shu ustun 15 belgigacha
 * qisqartiriladi, to'lig'i `title` da va tafsilot oynasida.
 */
const EXPERIENCE_MAX = 15;
function shortExperience(v: string): string {
  const s = v.split("—")[0].trim() || "-";
  return s.length > EXPERIENCE_MAX ? s.slice(0, EXPERIENCE_MAX).trimEnd() + "…" : s;
}

function fmtBytes(size: number): string {
  return size > 1048576 ? (size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(size / 1024)) + " KB";
}

/**
 * Nomzod fayli — CLOUDINARY HAVOLASI EMAS, o'z serverimiz orqali
 * (/api/management-cv/:id/file): PDF'ni Cloudinary ochiq havoladan
 * bermaydi (401), server esa API orqali olib oqizadi. Bosilganda modal
 * ichida ochiladi (PDF — iframe, rasm — img, boshqasi — yuklab olish).
 */
function fileViewUrl(cvId: number, kind: "cv" | "doc", index = 0): string {
  return `/api/management-cv/${cvId}/file?kind=${kind}&i=${index}`;
}

type FileView = { f: CvFile; url: string };

function FileChip({ f, onOpen }: { f: CvFile; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 text-[12px] hover:bg-secondary">
      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="max-w-[220px] truncate">{f.name}</span>
      <span className="text-muted-foreground">{fmtBytes(f.size)}</span>
    </button>
  );
}

function isPdf(f: CvFile): boolean {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}
function isImage(f: CvFile): boolean {
  return /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
}

/** Fayl ko'rish modali — PDF va rasm ichida ochiladi, DOC(X) faqat yuklab olinadi. */
function FileViewer({ view, onClose }: { view: FileView; onClose: () => void }) {
  const { t } = useT();
  const { f, url } = view;
  const inline = isPdf(f) || isImage(f);
  return (
    <Modal onClose={onClose} bare size="5xl" zIndex={140} panelClassName="overflow-hidden">
      {(modal) => (
        <div className="flex flex-col" style={{ height: "min(88vh, 900px)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
            <div className="min-w-0 flex items-center gap-2 text-[13px]">
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate font-medium">{f.name}</span>
              <span className="text-muted-foreground shrink-0">{fmtBytes(f.size)}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={url} target="_blank" rel="noopener" title={t("Yangi oynada ochish")} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-secondary text-[12px]">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("Yangi oynada ochish")}</span>
              </a>
              <a href={url} download={f.name} title={t("Yuklab olish")} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-secondary text-[12px]">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("Yuklab olish")}</span>
              </a>
              <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground" aria-label={t("Yopish")}>
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-secondary/40">
            {isPdf(f) ? (
              <iframe src={url} title={f.name} className="w-full h-full border-0 bg-white" />
            ) : isImage(f) ? (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={f.name} className="max-w-full max-h-full object-contain rounded-md" />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[13px] text-muted-foreground p-6 text-center">
                <span>{t("Bu turdagi faylni brauzerda ko'rsatib bo'lmaydi — yuklab olib oching.")}</span>
                <a href={url} download={f.name} className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-primary text-white text-[13px] font-medium hover:opacity-90">
                  <Download className="w-4 h-4" />
                  {t("Yuklab olish")}
                </a>
              </div>
            )}
            {!inline && null}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Nomzod rasmi katta ko'rinishda — jadvaldagi yoki tafsilotdagi rasm bosilganda. */
function PhotoViewer({ cv, onClose }: { cv: CvApplication; onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal onClose={onClose} bare size="xl" zIndex={140} panelClassName="overflow-hidden">
      {(modal) => (
        <>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
            <div className="min-w-0 text-[13px]">
              <div className="truncate font-medium">{cv.name}</div>
              {(cv.position || cv.ref) && (
                <div className="truncate text-[11.5px] text-muted-foreground">{[cv.position, cv.ref].filter(Boolean).join(" · ")}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={cv.photoUrl} target="_blank" rel="noopener" title={t("Yangi oynada ochish")} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-secondary text-[12px]">
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("Yangi oynada ochish")}</span>
              </a>
              <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground" aria-label={t("Yopish")}>
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center bg-secondary/40 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cv.photoUrl} alt={cv.name} onClick={modal.close} className="max-w-full max-h-[75vh] object-contain rounded-md cursor-zoom-out" />
          </div>
        </>
      )}
    </Modal>
  );
}

function StatusBadge({ status }: { status: CvStatus }) {
  const { t } = useT();
  const s = CV_STATUS[status] || CV_STATUS.new;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>
      {t(s.label)}
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

/**
 * Jadvaldagi "Izoh" ustuni — 10 belgidan keyin "…" (27.09.2026 talabi);
 * to'lig'i `title` da va tafsilot oynasining oxirida.
 */
const NOTE_PREVIEW = 10;
function shortNote(v: string): string {
  const chars = Array.from(v.replace(/\s+/g, " ").trim());
  return chars.length > NOTE_PREVIEW ? chars.slice(0, NOTE_PREVIEW).join("").trimEnd() + "…" : chars.join("");
}

function fmtNoteAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Admin izohi — tafsilot oynasining OXIRIDA (CV ko'rib chiqilgach nomzod
 * bilan nima gaplashilgani). Faqat adminga chiziladi; server ham faqat
 * admindan qabul qiladi. Ariza almashganda `key` bilan qayta tug'iladi.
 */
function CvAdminNote({ cv, focus, onSaved }: { cv: CvApplication; focus: boolean; onSaved: (app: CvApplication) => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [draft, setDraft] = useState(cv.adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const dirty = draft.trim() !== (cv.adminNote ?? "");

  // Jadvaldagi izoh bosilgan bo'lsa — oyna ochilishi bilan izohga tushamiz.
  useEffect(() => {
    if (focus) boxRef.current?.scrollIntoView({ block: "center" });
  }, [focus]);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/management-cv/${cv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: draft }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      const app = data.application as CvApplication;
      onSaved(app);
      setDraft(app.adminNote ?? "");
      showSuccess(app.adminNote ? t("Izoh saqlandi") : t("Izoh o'chirildi"));
    } catch {
      showError(t("Saqlanmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={boxRef}>
      <div className="flex items-center justify-between gap-2 mt-4 mb-1">
        <div className="text-[12px] font-bold uppercase tracking-wider text-primary">{t("Admin izohi")}</div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="w-3 h-3" />
          {t("Faqat admin ko'radi")}
        </span>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
        maxLength={CV_NOTE_MAX}
        rows={4}
        placeholder={t("Suhbatda nima gaplashildi, kelishuvlar, taassurot…")}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-relaxed resize-y min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="flex items-center justify-between gap-2 flex-wrap mt-1.5">
        <span className="text-[11.5px] text-muted-foreground">
          {dirty
            ? t("Saqlanmagan o'zgarish bor")
            : cv.adminNote && cv.adminNoteAt
              ? t("Oxirgi o'zgarish: {name} · {date}", { name: cv.adminNoteBy || "—", date: fmtNoteAt(cv.adminNoteAt) })
              : ""}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="h-8 px-3.5 rounded-lg bg-primary text-white text-[12.5px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t("Saqlanmoqda…") : t("Izohni saqlash")}
        </button>
      </div>
    </div>
  );
}

export default function CvPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const branch = useBranch();
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  // Admin izohi (ustun va tafsilotdagi bo'lim) — faqat adminga; server ham
  // boshqalarga izohni bermaydi.
  const isAdmin = branch.isAdmin;
  const colCount = isAdmin ? 12 : 11;

  const [items, setItems] = useState<CvApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<CvFilters>(NO_CV_FILTERS);
  const setFilter = <K extends keyof CvFilters>(key: K, value: CvFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const [search, setSearch] = useState("");

  const [detailId, setDetailId] = useState<number | null>(null);
  /** Tafsilot jadvaldagi izoh bosilib ochildi — oyna izohga tushadi. */
  const [noteFocus, setNoteFocus] = useState(false);
  const [fileView, setFileView] = useState<FileView | null>(null);
  /** Rasmi kattalashtirib ko'rsatilayotgan nomzod. */
  const [photoView, setPhotoView] = useState<CvApplication | null>(null);
  const [acting, setActing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);

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
        if (manual) showError(t("Google Sheets ulanmagan — avval 'Google Sheets' tugmasi orqali sozlang"));
        return;
      }
      if (syncBusy.current) return;
      syncBusy.current = true;
      try {
        const res = await fetch(`${sheetsUrl}${sheetsUrl.includes("?") ? "&" : "?"}t=${Date.now()}`);
        const data = await res.json();
        if (!data || !data.ok || !Array.isArray(data.items)) {
          setSheetsOk(false);
          if (manual) showError(t("Sheets javobi noto'g'ri — 3-qadamni tekshiring"));
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
          showSuccess(t("📥 Google Sheets'dan {fresh} ta yangi CV yuklandi", { fresh: fresh.length }));
        } else if (manual) {
          showSuccess(t("Sheets bilan sinxron ✓ — yangi ariza yo'q"));
        }
      } catch {
        setSheetsOk(false);
        if (manual) showError(t("Sheets'ga ulanib bo'lmadi — internet yoki URL ni tekshiring"));
      } finally {
        syncBusy.current = false;
      }
    },
    [sheetsUrl, items, load, showSuccess, showError, t],
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
  }, [sheetsUrl, t]);

  /** CRM → Sheets: holat o'zgarishini jadvalga ham yozamiz. */
  const pushStatus = useCallback(
    (sid: string | undefined, status: CvStatus) => {
      if (!sheetsUrl || !sid) return;
      fetch(sheetsUrl, { method: "POST", body: JSON.stringify({ action: "status", sid, status }) }).catch(() => {});
    },
    [sheetsUrl],
  );

  /* ---- Filtr / qidiruv (lib/cvFilters.ts) ---- */
  const q = search.toLowerCase().trim();
  // Filial filtri: navbardagi filial (ro'yxat shu bo'yicha kesilgan) va
  // ro'yxatda uchragan boshqa filial bo'lsa o'sha; oxirida "Istalgan".
  const branchIds = useMemo(() => {
    const ids = new Set<number>();
    if (branch.branchId !== null) ids.add(branch.branchId);
    for (const c of items) if (typeof c.branchId === "number") ids.add(c.branchId);
    return [...ids].sort((a, b) => a - b);
  }, [items, branch.branchId]);
  const visible = useMemo(() => items.filter((c) => cvMatches(c, filters, q)), [items, filters, q]);
  const activeFilters = activeCvFilters(filters);

  const count = useCallback((k: CvStatus) => items.filter((c) => c.status === k).length, [items]);

  // Yo'nalish tanlovlari — eski ro'yxat + ma'lumotda uchraydigan yangi vakansiyalar.
  const positionValues = useMemo(() => {
    const seen = new Set<string>(CV_POSITIONS as string[]);
    for (const c of items) if (c.position) seen.add(c.position);
    return [...seen];
  }, [items]);

  // Variant yonidagi son — BOSHQA filtrlar (va qidiruv) qo'llanganda shu
  // variantga nechta ariza tushadi: tanlashdan oldin natija ko'rinib tursin.
  const facetOptions = useMemo(() => {
    const pool = (facet: CvFacet) => items.filter((c) => cvMatches(c, filters, q, facet));
    const withCounts = (facet: CvFacet, values: string[], test: (c: CvApplication, v: string) => boolean) => {
      const rows = pool(facet);
      return values.map((v) => ({ value: v, label: v, hint: String(rows.filter((c) => test(c, v)).length) }));
    };
    // Fanlar anketadagi guruhlar bilan; standartga to'g'ri kelmaydigan qo'lda
    // yozilganlari (eski anketa) "Boshqa" guruhida.
    const standard = (CV_SUBJECT_GROUPS as { label: string; subjects: string[] }[]).flatMap((g) =>
      g.subjects.map((s) => ({ s, group: t(g.label) })),
    );
    const extra = new Map<string, string>();
    for (const c of items) {
      const s = (c.subject || "").trim();
      if (!s || s === "-" || standard.some((o) => subjectMatches(s, o.s))) continue;
      if (!extra.has(textKey(s))) extra.set(textKey(s), s);
    }
    const subjectRows = pool("subject");
    const branchRows = pool("branch");
    const subject = [...standard, ...[...extra.values()].map((s) => ({ s, group: t("Boshqa") }))].map(({ s, group }) => ({
      value: s,
      label: s,
      group,
      hint: String(subjectRows.filter((c) => subjectMatches(c.subject, s)).length),
    }));
    return {
      position: withCounts("position", positionValues, (c, v) => c.position === v),
      subject,
      exp: withCounts("exp", CV_EXP_LEVELS as string[], (c, v) => (c.experience || "").trim() === v),
      edu: withCounts("edu", CV_EDU_LEVELS as string[], (c, v) => c.edu === v),
      load: withCounts("load", CV_LOADS as string[], (c, v) => c.load === v),
      source: withCounts("source", CV_SOURCES as string[], (c, v) => c.source === v),
      status: withCounts("status", CV_STATUS_ORDER as string[], (c, v) => c.status === v).map((o) => ({
        ...o,
        label: CV_STATUS[o.value as CvStatus].label,
      })),
      branch: [
        ...branchIds.map((id) => ({
          value: String(id),
          label: branch.branches.find((b) => b.id === id)?.name || items.find((c) => c.branchId === id)?.branchName || String(id),
          hint: String(branchRows.filter((c) => c.branchId === id).length),
        })),
        { value: CV_BRANCH_ANY, label: "Istalgan", hint: String(branchRows.filter((c) => c.branchId === null).length) },
      ],
    };
  }, [items, filters, q, positionValues, branchIds, branch.branches, t]);

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
        if (notify) showError(t(data.error || "Saqlanmadi"));
        return null;
      }
      const updated = data.application as CvApplication;
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      pushStatus(cv.sid, status);
      if (notify) {
        if (status === "interview") showSuccess(t("Suhbatga chaqirildi — {name}", { name: updated.name }));
        else if (status === "rejected") showSuccess(t("CV rad etildi — {name}", { name: updated.name }));
        else if (status === "accepted") {
          const role = updated.position === "O'qituvchi" ? "O'qituvchi (foiz 40%)" : updated.position;
          showSuccess(t("Ishga olindi — Xodimlar ro'yxatiga qo'shildi: {name} · {role}", { name: updated.name, role }));
        }
      }
      return updated;
    },
    [pushStatus, showSuccess, showError, t],
  );

  /** Ariza ochilganda "Yangi" holati referensdagidek "Ko'rib chiqilgan"ga o'tadi. */
  function openDetail(cv: CvApplication, toNote = false) {
    setNoteFocus(toNote);
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
    const done = () => showSuccess(t("🔗 Havola nusxalandi: {link}", { link }));
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
    const done = () => showSuccess(t("📋 Apps Script kodi nusxalandi — endi uni Apps Script muharririga qo'ying"));
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
        showSuccess(t("✓ Google Sheets ulandi — arizalar jadvalga yoziladi va shu yerda ko'rinadi"));
      } else {
        setSheetsTest("⚠ Javob noto'g'ri — 3-qadamni tekshiring");
        setSheetsOk(false);
      }
    } catch {
      setSheetsTest("⚠ Ulanib bo'lmadi — URL va 'Anyone' ruxsatini tekshiring");
      setSheetsOk(false);
    }
  }

  /* ---- Yangi anketa (CvFormModal — ommaviy /ariza bilan bir xil) ---- */
  function openForm() {
    setFormOpen(true);
  }

  async function onFormSaved(app: CvApplication | null) {
    await load();
    if (app) showSuccess(t("CV qabul qilindi — {name}, ariza \"Yangi\" holatida", { name: app.name }));
  }

  const closeDetail = useCallback(() => setDetailId(null), []);
  const modal = useModalClose(closeDetail);

  const dotCls = sheetsOk === true ? "bg-emerald-500" : sheetsOk === false ? "bg-rose-500" : "bg-slate-400";

  return (
    <div className="page-frame-lg container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("Ishga qabul — CV arizalari")}</h1>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {t("Anketa asosida kelgan CV lar; munosiblarini tanlab Xodimlar ro'yxatiga qo'shing")}
          </div>
          {branchName && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[12px]">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{branchName}</span>
              <span className="text-muted-foreground">· {t("shu filial arizalari (+ filial tanlamaganlar)")}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openSheets}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <LayoutGrid className="w-4 h-4 text-emerald-600" />
            <span>{t("Google Sheets")}</span>
            {sheetsUrl && <span className={`h-2 w-2 rounded-full ${dotCls}`} />}
          </button>
          {sheetsUrl && (
            <button
              onClick={() => syncSheets(true)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary"
              title={t("Sheets'dan yangilash")}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={shareLink}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15"
          >
            <Link2 className="w-4 h-4" />
            <span>{t("Ariza havolasini ulashish")}</span>
          </button>
          <button
            onClick={openForm}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <FilePlus className="w-4 h-4" />
            <span>{t("CV to'ldirish (yangi ariza)")}</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label={t("Jami CV")} value={items.length} />
        <StatCard label={t("Yangi")} value={count("new")} color="text-blue-600" />
        <StatCard label={t("Suhbatga chaqirilgan")} value={count("interview")} color="text-amber-600" />
        <StatCard label={t("Ishga olingan")} value={count("accepted")} color="text-emerald-600" />
        <StatCard label={t("Rad etilgan")} value={count("rejected")} color="text-rose-500" />
      </div>

      {/* Filtrlar (lib/cvFilters.ts). Variant yonidagi son — boshqa filtrlar
          bilan shu variantni tanlasangiz nechta ariza chiqadi.
          TO'R (27.09.2026, "2 qator to'liq"): keng ekranda (2xl, 6 ustun)
          aniq 2 ta to'la qator — maosh va qidiruv 2 ustundan: 1-qator
          yo'nalish·fan·tajriba·maosh(2)·ta'lim, 2-qator bandlik·manba·holat·
          filial·qidiruv(2). lg–xl (4 ustun) — 3 to'la qator (qidiruv 3
          ustun), sm (2 ustun) — 5 qator. Kataklar teng kenglikda, bo'sh joy
          qolmaydi. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-2">
        <div className="min-w-0">
          <Select value={filters.position} onChange={(v) => setFilter("position", v)} options={facetOptions.position} placeholder={t("Yo'nalish — barchasi")} searchPlaceholder={t("Qidirish")} clearable size="sm" />
        </div>
        <div className="min-w-0">
          <Select value={filters.subject} onChange={(v) => setFilter("subject", v)} options={facetOptions.subject} placeholder={t("Fan — barchasi")} searchPlaceholder={t("Qidirish")} clearable size="sm" />
        </div>
        <div className="min-w-0">
          <Select
            multiple
            values={filters.exp}
            onChangeMany={(v) => setFilter("exp", v)}
            options={facetOptions.exp}
            placeholder={t("Tajriba — barchasi")}
            summary={(n) => (n === 1 ? t(filters.exp[0]) : t("Tajriba: {n} ta", { n }))}
            clearable
            size="sm"
          />
        </div>
        <div
          title={t("Kutilayotgan oylik maosh")}
          className="2xl:col-span-2 min-w-0 flex items-center gap-1.5 h-9 rounded-lg border border-border bg-card pl-2.5 pr-2 text-[13px] focus-within:ring-2 focus-within:ring-primary/30"
        >
          <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">{t("Maosh")}</span>
          <MoneyInput value={filters.salaryFrom} onChange={(v) => setFilter("salaryFrom", v)} placeholder={t("dan")} aria-label={`${t("Maosh")} ${t("dan")}`} className="min-w-0 flex-1 bg-transparent tabular-nums focus:outline-none" />
          <span className="text-muted-foreground shrink-0">–</span>
          <MoneyInput value={filters.salaryTo} onChange={(v) => setFilter("salaryTo", v)} placeholder={t("gacha")} aria-label={`${t("Maosh")} ${t("gacha")}`} className="min-w-0 flex-1 bg-transparent tabular-nums focus:outline-none" />
        </div>
        <div className="min-w-0">
          <Select value={filters.edu} onChange={(v) => setFilter("edu", v)} options={facetOptions.edu} placeholder={t("Ta'lim — barchasi")} clearable size="sm" />
        </div>
        <div className="min-w-0">
          <Select value={filters.load} onChange={(v) => setFilter("load", v)} options={facetOptions.load} placeholder={t("Bandlik — barchasi")} clearable size="sm" />
        </div>
        <div className="min-w-0">
          <Select value={filters.source} onChange={(v) => setFilter("source", v)} options={facetOptions.source} placeholder={t("Manba — barchasi")} clearable size="sm" />
        </div>
        <div className="min-w-0">
          <Select value={filters.status} onChange={(v) => setFilter("status", v)} options={facetOptions.status} placeholder={t("Holat — barchasi")} clearable size="sm" />
        </div>
        <div className="min-w-0">
          <Select value={filters.branch} onChange={(v) => setFilter("branch", v)} options={facetOptions.branch} placeholder={t("Filial — barchasi")} clearable size="sm" />
        </div>
        <div className="lg:col-span-3 2xl:col-span-2 min-w-0 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder={t("Ism, fan yoki telefon bo'yicha qidirish")}
              className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => setFilters(NO_CV_FILTERS)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              {t("Tozalash")}
            </button>
          )}
          <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-secondary/60 text-xs shrink-0">
            <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
            <span className="font-bold tabular-nums">{visible.length}</span>
          </div>
        </div>
      </div>

      {/* Table — thead tepada qotadi, faqat qatorlar scroll (globals.css .page-frame-lg) */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("F.I.Sh")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Yo'nalish")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Fan / soha")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Filial")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Tajriba")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Kutilayotgan maosh")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Telefon")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Topshirilgan")}</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">{t("Holati")}</th>
                {isAdmin && <th className="text-left px-4 py-3 whitespace-nowrap">{t("Izoh")}</th>}
                <th className="text-right px-4 py-3 whitespace-nowrap w-24" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8">
                    <SpinnerBlock size={22} />
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
                    {t("CV topilmadi. Filterni o'zgartirib ko'ring.")}
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
                    <td className="px-4 py-3 text-[13px] font-medium">
                      <span className="inline-flex items-center gap-2.5">
                        <Avatar cv={c} onOpen={() => setPhotoView(c)} />
                        <span>
                          {c.name}
                          {c.ref && <span className="block text-[11px] font-normal text-muted-foreground tabular-nums">{c.ref}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px]">
                      {c.position}
                      {c.load && <span className="block text-[11px] text-muted-foreground">{t(c.load)}</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px]">{c.subject || "-"}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">
                      {c.branchId ? c.branchName || c.branchId : c.branchId === null ? t("Istalgan") : "-"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap" title={c.experience || undefined}>
                      {c.experience ? shortExperience(c.experience) : "-"}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{c.expectedSalary || "-"} {t("so'm")}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{c.phone}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{c.submitted}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                        {c.adminNote ? (
                          <button
                            type="button"
                            title={c.adminNote}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(c, true);
                            }}
                            className="text-left hover:text-primary hover:underline underline-offset-2"
                          >
                            {shortNote(c.adminNote)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(c);
                        }}
                        className="h-8 px-3 rounded-md bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/15"
                      >
                        {t("Ko'rish")}
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
        <Modal onClose={closeDetail} controller={modal} bare size="2xl" zIndex={120} panelClassName="overflow-y-auto">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3">
                  <Avatar cv={detail} size={64} onOpen={() => setPhotoView(detail)} />
                  <div>
                  <div className="text-[18px] font-semibold">{detail.name}</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    {detail.position}
                    {detail.subject && detail.subject !== "-" ? ` · ${detail.subject}` : ""} · {detail.phone}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <StatusBadge status={detail.status} />
                    {detail.ref && <span className="text-[11px] tabular-nums text-muted-foreground">{detail.ref}</span>}
                    {detail.branchId !== undefined && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        {detail.branchId ? detail.branchName || detail.branchId : t(CV_ANY_BRANCH)}
                      </span>
                    )}
                  </div>
                  </div>
                </div>
                <button
                  onClick={modal.close}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground flex-shrink-0"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <DetailSection title={t("Shaxsiy ma'lumotlar")} />
              <DetailRow label={t("Yashash manzili")} value={detail.address} />
              <DetailRow label={t("Tug'ilgan sana")} value={detail.birth} />
              <DetailRow label="Telegram" value={detail.telegram ? "@" + detail.telegram : ""} />
              <DetailRow label={detail.ref ? t("Oxirgi ish joyi va lavozimi") : t("Hozirgi ish holati")} value={detail.currentJob} />
              <DetailRow label={t("Bandlik turi")} value={detail.load ? t(detail.load) : ""} />
              <DetailRow label={t("Vakansiyani qayerdan bilgan")} value={detail.source ? t(detail.source) : ""} />
              <DetailRow label={t("CRM'da kiritdi")} value={detail.enteredBy} />

              <DetailSection title={t("Ta'lim va tajriba")} />
              <DetailRow label={t("Ta'lim darajasi")} value={detail.edu ? t(detail.edu) : ""} />
              <DetailRow label={t("Oliygoh")} value={detail.university} />
              <DetailRow label={t("Ish tajribasi")} value={detail.experience ? t(detail.experience) : ""} />
              <DetailRow label={t("Qaysi o'quv markaz/maktablarda ishlagan")} value={detail.schools} />
              <DetailRow label={t("Yutuqlar va sertifikatlar")} value={detail.achievements} />
              <DetailRow label={t("Qanday darajadagi o'quvchilarga dars bera oladi")} value={detail.levels} />

              <DetailSection title={t("Ish haqida")} />
              <DetailRow label={t("Qachondan boshlay oladi")} value={detail.startDate} />
              <DetailRow label={t("Kutilayotgan oylik maosh")} value={`${detail.expectedSalary || "-"} so'm`} />
              <DetailRow label={t("Qanday natija beradi")} value={detail.results} />

              <DetailSection title={t("Motivatsiya")} />
              <DetailRow label={t("Nega aynan bizning markaz")} value={detail.whyUs} />
              <DetailRow label="5 yillik rejalari" value={detail.plans5} />
              <DetailRow label={t("Ish tanlashda muhim omillar")} value={(detail.priorities || []).join(", ")} />
              <DetailRow label={t("Kuchli tomonlari")} value={(detail.strengths || []).join(", ")} />
              <DetailRow label={t("Qo'shimcha")} value={detail.extra} />

              {(detail.cvFile || (detail.docs && detail.docs.length > 0)) && (
                <>
                  <DetailSection title={t("Fayllar")} />
                  <div className="flex flex-wrap gap-2 py-2">
                    {detail.cvFile && (
                      <FileChip f={detail.cvFile} onOpen={() => setFileView({ f: detail.cvFile as CvFile, url: fileViewUrl(detail.id, "cv") })} />
                    )}
                    {(detail.docs || []).map((f, i) => (
                      <FileChip key={`${f.url}-${i}`} f={f} onOpen={() => setFileView({ f, url: fileViewUrl(detail.id, "doc", i) })} />
                    ))}
                  </div>
                </>
              )}

              {isAdmin && (
                <CvAdminNote
                  key={detail.id}
                  cv={detail}
                  focus={noteFocus}
                  onSaved={(app) => setItems((prev) => prev.map((c) => (c.id === app.id ? app : c)))}
                />
              )}

              <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border flex-wrap">
                {detail.status === "accepted" ? (
                  <span className="text-[13px] text-emerald-600 font-medium mr-auto">
                    {t("✓ Xodimlar ro'yxatiga qo'shilgan")}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => act(detail, "rejected")}
                      disabled={acting}
                      className="h-9 px-4 rounded-lg border border-rose-300 bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 disabled:opacity-60"
                    >
                      {t("Rad etish")}
                    </button>
                    <button
                      onClick={() => act(detail, "interview")}
                      disabled={acting}
                      className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
                    >
                      {t("Suhbatga chaqirish")}
                    </button>
                    <button
                      onClick={() => act(detail, "accepted")}
                      disabled={acting}
                      className="h-9 px-5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {t("✓ Ishga olish")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </Modal>
      )}

      {fileView && <FileViewer view={fileView} onClose={() => setFileView(null)} />}
      {photoView && <PhotoViewer cv={photoView} onClose={() => setPhotoView(null)} />}

      {/* ===== GOOGLE SHEETS SOZLASH MODALI ===== */}
      {sheetsOpen && (
        <Modal onClose={() => setSheetsOpen(false)} bare size="2xl" zIndex={120} panelClassName="overflow-y-auto">{(modal) => (<>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[17px] font-semibold">{t("Google Sheets bilan bog'lash")}</div>
                <button
                  onClick={modal.close}
                  className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[13px] text-muted-foreground mb-4">
                {t("Bir marta sozlaysiz — keyin barcha arizalar to'g'ridan-to'g'ri Google jadvalingizga tushadi va shu yerda ko'rinadi (istalgan qurilmadan).")}
              </div>

              <div className="space-y-3 text-[13px]">
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                  <div className="font-semibold mb-1">{t("1-qadam. Yangi jadval oching")}</div>
                  <div className="text-muted-foreground">
                    {t("Brauzerda")}{" "}<b>sheets.new</b>{" "}{t("deb yozing — yangi Google Sheets ochiladi. Nomini masalan \"Akademiya CV\" qilib qo'ying.")}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                  <div className="font-semibold mb-1">{t("2-qadam. Apps Script kodini qo'ying")}</div>
                  <div className="text-muted-foreground mb-2">
                    {t("Jadvalda:")}{" "}<b>{t("Kengaytmalar (Extensions) → Apps Script")}</b>{" "}{t("— ochilgan muharrirdagi hamma narsani o'chirib, quyidagi kodni qo'ying va saqlang:")}
                  </div>
                  <button
                    onClick={copyScript}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-[13px] font-medium hover:opacity-90"
                  >
                    {t("📋 Kodni nusxalash")}
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                  <div className="font-semibold mb-1">{t("3-qadam. Web App qilib joylang")}</div>
                  <div className="text-muted-foreground">
                    {t("Apps Script'da:")}{" "}<b>{t("Deploy → New deployment → Web app")}</b>. &quot;Execute as&quot; = <b>{t("Me")}</b>,
                    &quot;Who has access&quot; = <b>{t("Anyone")}</b>. <b>{t("Deploy")}</b> bosing, ruxsat bering va chiqqan{" "}
                    <b>URL</b>{" "}{t("ni nusxalang (…/exec bilan tugaydi).")}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5">
                  <div className="font-semibold mb-1.5 text-slate-900">{t("4-qadam. URL ni shu yerga qo'ying")}</div>
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
                      {t("Saqlash va tekshirish")}
                    </button>
                    <span className="text-[12px] text-muted-foreground">{sheetsTest}</span>
                  </div>
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {t("Eslatma: \"Ariza havolasini ulashish\" tugmasi Sheets manzilini havola ichiga qo'shib beradi — nomzod istalgan telefonda ochsa ham arizasi jadvalingizga tushadi.")}
                </div>
              </div>
            </div>
          </>)}</Modal>
      )}

      {/* ===== CV FORM MODAL (anketa) — ommaviy /ariza bilan bir xil ===== */}
      {formOpen && <CvFormModal sheetsUrl={sheetsUrl} onClose={() => setFormOpen(false)} onSaved={onFormSaved} />}
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
