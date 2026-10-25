"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CalendarClock, Copy, Info, Link2, MoreHorizontal, RefreshCw, Search, SquareArrowOutUpRight, UserPlus, UserRoundCheck, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { DENSITY_CELL, DENSITY_ROW } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { EmptyBlock, ToneBadge, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { cvExpLabel, type CvApplication, type CvStatus } from "@/lib/managementCv";
import { CV_EXP_LEVELS } from "@/constants/managementCv";
import { uzDateIso } from "@/lib/uzTime";
import CvPanelV2 from "./CvPanelV2";
import { CvHireDialog, CvInterviewDialog, CvRejectDialog } from "./cvDialogs";
import CvAddDialogV2 from "./CvAddDialogV2";
import { CV_TONE, applyLink, cvBranchLabel, cvCertText, cvExpText, cvPhoneShow, cvTel, cvTrackLabel, cvTrackText, interviewParts, pushSheetsStatus, submittedParts, useCvSheetsUrl, type CvPlace } from "./cvBits";
import { useCvColumns, type CvColumnKey } from "./cvColumns";

// YANGI VERSIYA — BOSHQARUV → ISHGA QABUL (CV) (rasm «Ishga qabul · Nomzodlar ro'yxati», yorug'/qorong'i,
// 25.10.2026, 13-qism):
//   • sarlavha «Ishga qabul (CV)», «Nomzodlar ochiq anketa orqali keladi · barcha filiallar»; o'ngda
//     «Anketa havolasini nusxalash», «Nomzod qo'shish»;
//   • holat kartalari: Hammasi · Yangi (javob kutmoqda) · Ko'rildi (qaror kerak) · Suhbat (sanalar) ·
//     Ishga olindi · Rad etildi (sababi bilan) — bosilsa filtr;
//   • «Ism yoki telefon», Yo'nalish, Filial, Tajriba, «Ustunlar»; jadval — Nomzod (bosh harflar, ism,
//     telefon, yangisida ko'k nuqta), Yo'nalish, Tajriba, Sertifikat (🎖), Filial, Kelgan, Holat (+ suhbat
//     vaqti / ishga olingan kun / rad sababi), ⋯; pastda «1–8 / 8 ta» va «Ishga olinganlar avtomatik
//     «Xodimlar» ro'yxatiga o'tadi».
// Qator bosilsa — o'ngda nomzod paneli (CvPanelV2). Ma'lumot: GET /api/management-cv?all=1 (admin —
// barcha filiallar; boshqalar — navbar filiali, avvalgidek). RAD ETILGANLAR «Hammasi» da yo'q
// (17.10.2026 qarori) — faqat «Rad etildi» kartasida. Rasmdagi «Namuna» — dizayner izohi.

type Tab = "" | CvStatus;
const TABS: Tab[] = ["", "new", "reviewed", "interview", "accepted", "rejected"];

const norm = (s: string) => (s || "").toLowerCase().replace(/[‘’ʻʼ`']/g, "'").trim();

export default function CvListV2() {
  const { t } = useT();
  const f = useProfileFmt();
  const branch = useBranch();
  const { showSuccess, showError, showToast } = useToast();
  const sheetsUrl = useCvSheetsUrl();
  const columns = useCvColumns();

  const [items, setItems] = useState<CvApplication[] | null>(null);
  const [meta, setMeta] = useState<{ isAdmin: boolean; canHire: boolean; all: boolean; places: CvPlace[] }>({ isAdmin: false, canHire: false, all: false, places: [] });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [tab, setTab] = useState<Tab>("");
  const [q, setQ] = useState("");
  const [fTrack, setFTrack] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fExp, setFExp] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [openId, setOpenId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<null | { kind: "hire" | "interview" | "reject"; cv: CvApplication }>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/management-cv?all=1")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          setItems(d.applications as CvApplication[]);
          setMeta({ isAdmin: Boolean(d.isAdmin), canHire: Boolean(d.canHire), all: Boolean(d.all), places: Array.isArray(d.places) ? (d.places as CvPlace[]) : [] });
          setError(null);
        } else setError(String(d.error || "Arizalar yuklanmadi"));
      })
      .catch(() => alive && setError("Serverga ulanib bo'lmadi"));
    return () => {
      alive = false;
    };
  }, [version]);

  const replace = useCallback((app: CvApplication) => setItems((list) => (list ? list.map((x) => (x.id === app.id ? app : x)) : list)), []);

  /** Holat (Ko'rildi, qayta ko'rib chiqish …) — server javobi ro'yxatga, Sheets'ga ham. */
  const setStatus = useCallback(
    async (cv: CvApplication, status: CvStatus, quiet = false) => {
      setBusyId(cv.id);
      try {
        const res = await fetch(`/api/management-cv/${cv.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
        const d = await res.json();
        if (!d.ok) {
          if (!quiet) showError(t(d.error || "Saqlanmadi"));
          return null;
        }
        const app = d.application as CvApplication;
        replace(app);
        pushSheetsStatus(sheetsUrl, cv.sid, status);
        return app;
      } catch {
        if (!quiet) showError(t("Serverga ulanib bo'lmadi"));
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [replace, sheetsUrl, showError, t],
  );

  /** Panel ochilganda «Yangi» → «Ko'rildi» (eski sahifadagidek). */
  function openCv(cv: CvApplication) {
    setOpenId(cv.id);
    if (cv.status === "new") void setStatus(cv, "reviewed", true);
  }

  // Panel ochiq — Esc bilan yopiladi (ochiq menyu va oynalar Esc'ni o'zi ushlaydi — FloatingPanel/Modal).
  useEffect(() => {
    if (openId === null || dialog || addOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, dialog, addOpen]);

  /* ── Filtrlar ── */
  const list = useMemo(() => items ?? [], [items]);
  const trackOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const cv of list) for (const x of cvTrackLabel(cv).split(",").map((s) => s.trim()).filter(Boolean)) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ value: v, label: t(v), hint: String(n) }));
  }, [list, t]);
  const branchOptions = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const cv of list) {
      const key = cv.branchId === null || cv.branchId === undefined ? "any" : String(cv.branchId);
      const cur = m.get(key) ?? { label: cv.branchId === undefined ? t("Eski arizalar") : cvBranchLabel(cv, t), n: 0 };
      cur.n += 1;
      m.set(key, cur);
    }
    return [...m.entries()].map(([value, v]) => ({ value, label: v.label, hint: String(v.n) }));
  }, [list, t]);
  const expOptions = useMemo(() => CV_EXP_LEVELS.map((x) => ({ value: x, label: t(cvExpLabel(x)) })), [t]);

  const filtered = useMemo(() => {
    const qq = norm(q);
    const digits = q.replace(/\D/g, "");
    return list.filter((cv) => {
      if (qq && !norm(cv.name).includes(qq) && !(digits.length >= 3 && (cv.phone || "").replace(/\D/g, "").includes(digits))) return false;
      if (fTrack && !cvTrackLabel(cv).split(",").map((s) => s.trim()).includes(fTrack)) return false;
      if (fBranch) {
        const key = cv.branchId === null || cv.branchId === undefined ? "any" : String(cv.branchId);
        if (key !== fBranch) return false;
      }
      if (fExp && cv.experience !== fExp) return false;
      return true;
    });
  }, [list, q, fTrack, fBranch, fExp]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { "": 0, new: 0, reviewed: 0, interview: 0, accepted: 0, rejected: 0 };
    for (const cv of filtered) {
      c[cv.status] += 1;
      if (cv.status !== "rejected") c[""] += 1;
    }
    return c;
  }, [filtered]);

  const rows = useMemo(() => filtered.filter((cv) => (tab === "" ? cv.status !== "rejected" : cv.status === tab)), [filtered, tab]);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const thisMonth = uzDateIso().slice(0, 7);
  const monthCount = filtered.filter((cv) => cv.status !== "rejected" && submittedParts(cv.submitted).iso.slice(0, 7) === thisMonth).length;
  const interviewRange = useMemo(() => {
    const days = filtered.flatMap((cv) => (cv.status === "interview" ? [interviewParts(cv.interviewAt)?.iso ?? ""] : [])).filter(Boolean).sort();
    if (!days.length) return "";
    const a = days[0];
    const b = days[days.length - 1];
    if (a === b) return f.dayMonth(a);
    if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${f.dayMonth(b)}`;
    return `${f.dayMonth(a)} – ${f.dayMonth(b)}`;
  }, [filtered, f]);

  // «oktyabrda 7 ta» (inglizchada oy nomi bosh harf bilan qoladi — profileBits.monthLower).
  const monthName = f.monthLower(thisMonth);
  const cardSub: Record<Tab, string> = {
    "": t("{month}da {n} ta", { month: monthName, n: monthCount }),
    new: t("javob kutmoqda"),
    reviewed: t("qaror kerak"),
    interview: interviewRange || t("sana belgilanmagan"),
    accepted: t("xodimlarga qo'shildi"),
    rejected: t("sababi bilan"),
  };

  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const copyLink = () => {
    const link = applyLink(sheetsUrl);
    const done = () => showSuccess(t("Havola nusxalandi: {link}", { link }));
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done).catch(done);
    else done();
  };

  const open = openId === null ? null : (list.find((x) => x.id === openId) ?? null);
  const filtersOn = Boolean(q || fTrack || fBranch || fExp);
  const resetFilters = () => {
    setQ("");
    setFTrack("");
    setFBranch("");
    setFExp("");
    setPage(1);
  };

  /* ── Katak ── */
  const cell = (key: CvColumnKey, cv: CvApplication) => {
    const sub = submittedParts(cv.submitted);
    switch (key) {
      case "track":
        return (
          <span className="block max-w-[180px] truncate text-v2-text" title={cvTrackText(cv, t)}>
            {cvTrackText(cv, t) || "—"}
          </span>
        );
      case "exp":
        return (
          <span className={`whitespace-nowrap ${cv.experience === "Tajribam yo'q" ? "text-v2-text-2" : "text-v2-text"}`} title={cv.experience || undefined}>
            {cvExpText(cv, t)}
          </span>
        );
      case "cert": {
        const c = cvCertText(cv, t);
        return c ? (
          <span className="inline-flex max-w-[140px] items-center gap-1.5 text-v2-text" title={c}>
            <Award className="size-3.5 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{c}</span>
          </span>
        ) : (
          <span className="text-v2-text-3">—</span>
        );
      }
      case "branch":
        return <span className="whitespace-nowrap text-v2-text-2">{cv.branchId === undefined && !cv.branchName ? "—" : cvBranchLabel(cv, t)}</span>;
      case "submitted":
        return <span className="whitespace-nowrap tabular-nums text-v2-text-2">{sub.iso ? f.stamp(sub.iso, sub.hm) : cv.submitted || "—"}</span>;
      case "status": {
        const iv = interviewParts(cv.interviewAt);
        const caption =
          cv.status === "interview" && iv
            ? f.stamp(iv.iso, iv.hm)
            : cv.status === "accepted" && (cv.hiredStart || cv.hiredAt)
              ? f.dayMonth(cv.hiredStart || cv.hiredAt || "")
              : cv.status === "rejected" && cv.rejectReason
                ? cv.rejectReason
                : "";
        return (
          <span className="flex flex-col items-start gap-0.5">
            <ToneBadge tone={CV_TONE[cv.status]}>{t(CV_TONE[cv.status].label)}</ToneBadge>
            {caption && <span className="max-w-[170px] truncate text-v2-caption font-normal tabular-nums text-v2-text-3" title={caption}>{caption}</span>}
          </span>
        );
      }
      case "position":
        return <span className="text-v2-text">{cv.position || "—"}</span>;
      case "load":
        return <span className="text-v2-text-2">{cv.load ? t(cv.load) : "—"}</span>;
      case "salary":
        return <span className="whitespace-nowrap tabular-nums text-v2-text">{cv.expectedSalary || "—"}</span>;
      case "edu":
        return <span className="text-v2-text-2">{cv.edu ? t(cv.edu) : "—"}</span>;
      case "start":
        return <span className="whitespace-nowrap tabular-nums text-v2-text-2">{/^\d{4}-\d{2}-\d{2}$/.test(cv.startDate) ? f.dayMonth(cv.startDate) : cv.startDate || "—"}</span>;
      case "source":
        return <span className="text-v2-text-2">{cv.source ? t(cv.source) : "—"}</span>;
      case "note":
        return <span className="block max-w-[180px] truncate text-v2-text-2" title={cv.adminNote}>{cv.adminNote || "—"}</span>;
      default:
        return null;
    }
  };

  const rowMenu = (cv: CvApplication): ActionMenuEntry[] => {
    const tel = cvTel(cv.phone);
    const out: ActionMenuEntry[] = [{ key: "open", label: t("Ochish"), icon: SquareArrowOutUpRight, onSelect: () => openCv(cv) }];
    if (cv.status !== "accepted" && cv.status !== "rejected") {
      out.push({
        key: "iv",
        label: cv.status === "interview" ? t("Suhbat vaqtini o'zgartirish") : t("Suhbatga chaqirish"),
        icon: CalendarClock,
        onSelect: () => setDialog({ kind: "interview", cv }),
      });
      out.push({
        key: "hire",
        label: t("Ishga olish"),
        icon: UserRoundCheck,
        disabled: !meta.canHire,
        title: meta.canHire ? undefined : t("Xodim qo'shishga ruxsatingiz yo'q"),
        onSelect: () => setDialog({ kind: "hire", cv }),
      });
    }
    if (tel)
      out.push({
        key: "copy",
        label: t("Raqamni nusxalash"),
        icon: Copy,
        onSelect: () => {
          void navigator.clipboard?.writeText(tel);
          showSuccess(t("Nusxa olindi"));
        },
      });
    if (cv.status !== "accepted" && cv.status !== "rejected") {
      out.push({ key: "d", divider: true }, { key: "rej", label: t("Rad etish"), icon: X, danger: true, onSelect: () => setDialog({ kind: "reject", cv }) });
    }
    return out;
  };

  const rowH = DENSITY_ROW[columns.density];
  const cellY = DENSITY_CELL[columns.density];
  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-3 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5 lg:h-full lg:min-h-0">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Ishga qabul (CV)")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Nomzodlar ochiq anketa orqali keladi")} · {meta.all ? t("barcha filiallar") : branchName ? t("{branch} va «istalgan filial»", { branch: branchName }) : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copyLink} className={secondaryBtn}>
            <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Anketa havolasini nusxalash")}
          </button>
          <ActionMenu
            items={[
              { key: "form", label: t("Anketani ochish"), icon: SquareArrowOutUpRight, onSelect: () => window.open("/ariza", "_blank", "noopener") },
              { key: "classic", label: t("Eski ko'rinishda ochish"), icon: RefreshCw, href: "/management-cv?classic=1" },
            ]}
            label={t("Qo'shimcha amallar")}
            width={240}
          >
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
            <UserPlus className="size-4" strokeWidth={2} aria-hidden />
            {t("Nomzod qo'shish")}
          </button>
        </div>
      </div>

      {/* 2. Holat kartalari */}
      <div className="grid grid-cols-2 gap-2 min-[40rem]:grid-cols-3 min-[72rem]:grid-cols-6" role="group" aria-label={t("Holat bo'yicha filtr")}>
        {TABS.map((k) => {
          const on = tab === k;
          return (
            <button
              key={k || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setTab(k === tab && k !== "" ? "" : k);
                setPage(1);
              }}
              className={`flex min-w-0 flex-col items-start gap-0.5 rounded-v2-lg border px-3.5 pb-2.5 pt-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface shadow-v2-sm hover:bg-v2-hover"
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 text-v2-small ${on ? "font-medium text-v2-brand-text" : "text-v2-text-2"}`}>
                {k && <span className={`size-1.5 rounded-full ${CV_TONE[k].dot}`} aria-hidden />}
                {k ? t(CV_TONE[k].label) : t("Hammasi")}
              </span>
              <span className="text-[22px] font-semibold leading-7 tabular-nums text-v2-text">{items ? counts[k] : "—"}</span>
              <span className="w-full truncate text-v2-caption text-v2-text-3">{items ? cardSub[k] : " "}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            type="search"
            placeholder={t("Ism yoki telefon")}
            aria-label={t("Ism yoki telefon")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <V2Select variant="chip" label={t("Yo'nalish")} value={fTrack} onChange={(v) => { setFTrack(v); setPage(1); }} options={trackOptions} />
        <V2Select variant="chip" label={t("Filial")} value={fBranch} onChange={(v) => { setFBranch(v); setPage(1); }} options={branchOptions} searchable={false} />
        <V2Select variant="chip" label={t("Tajriba")} value={fExp} onChange={(v) => { setFExp(v); setPage(1); }} options={expOptions} searchable={false} />
        {filtersOn && (
          <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
            <X className="size-3.5" strokeWidth={2} aria-hidden />
            {t("Tozalash")}
          </button>
        )}
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      {/* 4. Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        {error ? (
          <div className="p-6">
            <EmptyBlock icon={<Info className="size-5" strokeWidth={1.75} aria-hidden />} title={t(error)} action={<button type="button" onClick={() => { setError(null); setVersion((v) => v + 1); }} className={secondaryBtn}><RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />{t("Qayta urinish")}</button>} />
          </div>
        ) : (
          <>
            <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
              <table className="w-full min-w-[860px] border-collapse text-v2-body">
                <thead>
                  <tr>
                    <th className={`${th} pl-4`}>{t("Nomzod")}</th>
                    {columns.shown.map((c) => (
                      <th key={c.key} className={th}>
                        {t(c.label)}
                      </th>
                    ))}
                    <th className="sticky top-0 z-10 w-12 bg-v2-surface-2 py-2.5 pl-1 pr-3 shadow-[inset_0_-1px_0_var(--v2-border)]">
                      <span className="sr-only">{t("Amallar")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!items &&
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={`sk${i}`} className={`${rowH} border-b border-v2-border`} aria-hidden>
                        <td className="pl-4 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-full bg-v2-skeleton" />
                            <div className="h-3 w-36 rounded bg-v2-skeleton" />
                          </div>
                        </td>
                        {columns.shown.map((c) => (
                          <td key={c.key} className="px-3">
                            <div className="h-3 w-20 rounded bg-v2-skeleton" />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))}
                  {items &&
                    pageRows.map((cv) => {
                      const on = openId === cv.id;
                      return (
                        <tr
                          key={cv.id}
                          onClick={() => openCv(cv)}
                          className={`${rowH} cursor-pointer border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}
                        >
                          <td className={`${cellY} pl-4 pr-3`}>
                            <div className="flex min-w-0 items-center gap-2.5">
                              {cv.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cv.photoUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                              ) : (
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                                  {initialsOf(cv.name)}
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCv(cv);
                                    }}
                                    className="truncate text-left font-semibold text-v2-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
                                  >
                                    {cv.name}
                                  </button>
                                  {cv.status === "new" && <span className="size-1.5 shrink-0 rounded-full bg-v2-info" title={t("Yangi ariza")} aria-label={t("Yangi ariza")} />}
                                </span>
                                <span className="block truncate text-v2-caption font-normal tabular-nums text-v2-text-2">{cvPhoneShow(cv.phone) || "—"}</span>
                              </span>
                            </div>
                          </td>
                          {columns.shown.map((c) => (
                            <td key={c.key} className={`${cellY} px-3 text-v2-small`}>
                              {cell(c.key, cv)}
                            </td>
                          ))}
                          <td className={`${cellY} py-0 pl-1 pr-3 text-right`} onClick={(e) => e.stopPropagation()}>
                            <ActionMenu items={rowMenu(cv)} label={t("{name} — amallar", { name: cv.name })} width={240}>
                              {(trigger, isOpen) => (
                                <button
                                  type="button"
                                  {...trigger}
                                  disabled={busyId === cv.id}
                                  title={t("Amallar")}
                                  aria-label={t("{name} — amallar", { name: cv.name })}
                                  className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${isOpen ? "bg-v2-surface-2" : ""}`}
                                >
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </ActionMenu>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {items && rows.length === 0 && (
                <div className="p-6">
                  <EmptyBlock
                    icon={<UserPlus className="size-5" strokeWidth={1.75} aria-hidden />}
                    title={filtersOn ? t("Bu filtr bo'yicha nomzod yo'q") : tab ? t("Bu holatda nomzod yo'q") : t("Hali ariza kelmagan")}
                    text={filtersOn ? undefined : t("Anketa havolasini nusxalab, e'lon yoki Telegram kanalga qo'ying — arizalar shu yerga tushadi.")}
                    action={filtersOn ? <button type="button" onClick={resetFilters} className={secondaryBtn}>{t("Filtrlarni tozalash")}</button> : undefined}
                  />
                </div>
              )}
            </div>
            {items && rows.length > 0 && (
              <V2Pagination
                totalItems={rows.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </div>
      <p className="-mt-2 flex items-center gap-1.5 self-end text-v2-caption font-normal text-v2-text-3">
        <Info className="size-3.5" strokeWidth={1.75} aria-hidden />
        {t("Ishga olinganlar avtomatik «Xodimlar» ro'yxatiga o'tadi")}
      </p>

      {/* 5. Nomzod paneli */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:absolute" onClick={() => setOpenId(null)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] lg:absolute">
            <CvPanelV2
              cv={open}
              isAdmin={meta.isAdmin}
              canHire={meta.canHire}
              busy={busyId === open.id}
              onClose={() => setOpenId(null)}
              onInterview={() => setDialog({ kind: "interview", cv: open })}
              onReject={() => setDialog({ kind: "reject", cv: open })}
              onHire={() => setDialog({ kind: "hire", cv: open })}
              onReopen={() =>
                void setStatus(open, "reviewed").then((app) => {
                  if (app) showSuccess(t("Qayta ko'rib chiqishga qaytarildi — {name}", { name: app.name }));
                })
              }
              onUpdated={replace}
            />
          </div>
        </>
      )}

      {dialog?.kind === "interview" && (
        <CvInterviewDialog
          cv={dialog.cv}
          places={meta.places}
          onClose={() => setDialog(null)}
          onSaved={(app) => {
            replace(app);
            pushSheetsStatus(sheetsUrl, app.sid, app.status);
            const iv = interviewParts(app.interviewAt);
            showToast({ tone: "success", title: t("Suhbat belgilandi — {name}", { name: app.name }), detail: iv ? f.stamp(iv.iso, iv.hm) : undefined });
          }}
        />
      )}
      {dialog?.kind === "reject" && (
        <CvRejectDialog
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onSaved={(app) => {
            replace(app);
            pushSheetsStatus(sheetsUrl, app.sid, app.status);
            setOpenId(null);
            showToast({ tone: "success", title: t("Rad etildi — {name}", { name: app.name }), detail: app.rejectReason || undefined });
          }}
        />
      )}
      {dialog?.kind === "hire" && (
        <CvHireDialog
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onSaved={(app, emp, smsSent) => {
            replace(app);
            pushSheetsStatus(sheetsUrl, app.sid, app.status);
            showToast({
              tone: "success",
              title: t("Ishga olindi — {name}", { name: app.name }),
              detail: [t("«Xodimlar» ro'yxatiga qo'shildi"), smsSent ? t("Kirish taklifi SMS bilan yuborildi") : t("SMS yuborilmadi — taklifni xodim profilidan qayta yuboring")],
              action: { label: t("Xodim profili"), onClick: () => window.location.assign(`/management-xodimlar/${emp.id}`) },
            });
          }}
        />
      )}
      {addOpen && (
        <CvAddDialogV2
          places={meta.places}
          sheetsUrl={sheetsUrl}
          onClose={() => setAddOpen(false)}
          onSaved={(app) => {
            if (app) setItems((list) => (list ? [app, ...list.filter((x) => x.id !== app.id)] : [app]));
            showSuccess(t("Nomzod qo'shildi — {name}", { name: app?.name ?? "" }));
          }}
        />
      )}
    </div>
  );
}

