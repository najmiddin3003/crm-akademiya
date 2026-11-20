"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Check, CheckCircle2, Clock, Pencil, RefreshCw, Send, Trash2, UserCog, X, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { B, Badge, PageHead, PageShell, PersonCell, SearchBox, SegmentPills, SummaryLine, TH, type BadgeTone } from "@/components/v2/students/lists/listKit";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { ROLE_LABELS } from "@/constants/employees";
import type { TempStaffRow } from "@/app/api/temp-staff/route";
import { collapseBranchPools, sameBranchPool } from "@/lib/branchPools";
import { workTimeLabel } from "@/lib/workTime";
import { ArchiveDialogV2, EditStaffDialogV2, SmsInviteDialogV2, type InviteResult, type TempBranch } from "./TempStaffDialogsV2";
import WorkTimeDialogV2 from "./WorkTimeDialogV2";

// YANGI VERSIYA — «VAQTINCHALIK TUGMA» (/vaqtinchalik, faqat admin; 55-qism, rasmsiz, 20.11.2026 —
// O'quvchilar ro'yxati / Bonus qolipida). Sarlavha — yangi menyudagi nomi «Vaqtinchalik bo'lim»
// (components/v2/shell/sidebarSections.ts V2_LABELS). Eski versiyada — components/temp/TempStaffPage.tsx, o'zgarmagan.
// Nima uchun bor va qo'riqchi qayerda — app/(app)/vaqtinchalik/page.tsx izohida.
//
// Ma'lumot va amallar eski sahifa bilan BITTA: GET /api/temp-staff (to'rtala filial, qamrovsiz),
// PATCH /api/temp-staff/:id (tahrir, arxiv, admin tasdig'i ✓/✗), DELETE /api/temp-staff/:id (xodim + hisob +
// sessiyalar + SMS kodlari), POST /api/temp-staff/invite (faollashtirish SMS'i), PUT /api/temp-staff/work-time.
// Filtrlar eskisidagi uchtasi: Filial (hovuz 1+2 — bitta), Holat (endi tabletkalar, soni bilan), Hisob.
// Belgilash FILTRLANGAN qatorlar ustida (ko'rinmayotgan xodimga SMS ketmasin). Sahifalash yo'q — eskisidagidek.

type StateKey = "all" | "active" | "archived";

/** Ro'yxatni o'qiydi va SHUNCHAKI qaytaradi — holatga yozish chaqiruvchida (eskisidagi sabab). */
type ListResult = { employees: TempStaffRow[]; branches: TempBranch[]; maxBatch: number } | { error: string };

async function fetchList(): Promise<ListResult> {
  try {
    const res = await fetch("/api/temp-staff");
    const data = await res.json();
    if (!data.ok) return { error: data.error || "Ro'yxat yuklanmadi" };
    return {
      employees: data.employees as TempStaffRow[],
      branches: data.branches as TempBranch[],
      maxBatch: Number(data.maxBatch) || 25,
    };
  } catch {
    return { error: "Serverga ulanib bo'lmadi" };
  }
}

const roleOf = (turi: string) => ROLE_LABELS[turi as keyof typeof ROLE_LABELS] ?? turi;

const TD = "px-2.5 py-2.5 align-middle";
const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-40";
const MINI_BTN =
  "inline-flex size-7 items-center justify-center rounded-v2-md transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-30";
const COLS = 9;

/**
 * Hisob holati — «nega raqam band?» va «kimga SMS kerak?» savollariga javob:
 * yashil — faollashgan; qizil — hisob umuman yo'q; sariq — taklif ketgan, hali faollashmagan.
 */
function AccountBadge({ status }: { status: string | null }) {
  const { t } = useT();
  const [label, tone]: [string, BadgeTone] =
    status === null ? [t("Hisob yo'q"), "danger"] : status === "active" ? [t("Faollashgan"), "success"] : status === "invited" ? [t("Taklif yuborilgan"), "warning"] : [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export default function TempStaffV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<TempStaffRow[]>([]);
  const [branches, setBranches] = useState<TempBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [query, setQuery] = useState("");
  // Uch ALOHIDA o'lchov (eskisidagidek): filial, xodimning o'zi (aktiv/arxiv), hisob holati.
  const [branchFilter, setBranchFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<StateKey>("all");
  const [accountFilter, setAccountFilter] = useState("");

  const [editTarget, setEditTarget] = useState<TempStaffRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TempStaffRow | null>(null);
  const [workTimeOpen, setWorkTimeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TempStaffRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busyRef = useRef(false);

  // ── SMS ── Belgilanganlar ro'yxat qayta yuklanganda ham saqlanadi, lekin MAVJUD qatorlar bilan kesiladi.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [maxBatch, setMaxBatch] = useState(25);
  /** Tasdiq oynasi (`null` — yopiq); `skipped` — tanlangan, lekin SMS ketmaydiganlar soni. */
  const [smsTargets, setSmsTargets] = useState<{ list: TempStaffRow[]; skipped: number } | null>(null);
  /** Oxirgi yuborish natijasi — qatorlar kesimida (toast o'chib ketadi, sabab esa kerak bo'lib turadi). */
  const [smsResults, setSmsResults] = useState<InviteResult[] | null>(null);

  // Filial almashtirilganda QAYTA so'ralmaydi — ro'yxat ataylab qamrovsiz.
  useEffect(() => {
    let cancelled = false;
    fetchList()
      .then((d) => {
        if (cancelled) return;
        if ("error" in d) {
          showError(t(d.error));
          setFailed(true);
          return;
        }
        setRows(d.employees);
        setBranches(d.branches);
        setMaxBatch(d.maxBatch);
        setFailed(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version, showError, t]);

  /** Amaldan keyin ro'yxatni yangilash (hodisa ishlovchisidan). */
  async function reload() {
    const d = await fetchList();
    if ("error" in d) {
      showError(t(d.error));
      return;
    }
    setRows(d.employees);
    setBranches(d.branches);
    setMaxBatch(d.maxBatch);
    setFailed(false);
    // O'chirilgan xodim tanlovda osilib qolmasin (aks holda «Xodim topilmadi» kelardi).
    setSelected((prev) => {
      const alive = new Set(d.employees.map((e) => e.id));
      return new Set([...prev].filter((id) => alive.has(id)));
    });
  }

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const branchOptions = useMemo(() => collapseBranchPools(branches).map((b) => ({ value: String(b.id), label: b.name })), [branches]);

  // Qidiruv ism, telefon (raqamlari ikkala tomondan), vazifa, pochta va filial nomi bo'yicha — eskisidagidek.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const branchId = branchFilter ? Number(branchFilter) : null;
    return rows.filter((r) => {
      // Xodim bir nechta filialda bo'lishi mumkin; hovuz (1+2) — bitta filial (lib/branchPools.ts).
      if (branchId !== null && !r.branchIds.some((id) => sameBranchPool(id, branchId))) return false;
      if (accountFilter) {
        const ok =
          accountFilter === "none"
            ? r.accountStatus === null
            : accountFilter === "invited"
              ? r.accountStatus === "invited"
              : accountFilter === "pending"
                ? r.approval === "pending"
                : accountFilter === "rejected"
                  ? r.approval === "rejected"
                  : accountFilter === "active"
                    ? r.accountStatus === "active" && r.approval !== "pending" && r.approval !== "rejected"
                    : true;
        if (!ok) return false;
      }
      if (!q) return true;
      const hay = [r.name, roleOf(r.turi), r.email, ...r.branchIds.map((id) => branchName.get(id) ?? "")].join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      return qDigits.length > 0 && r.phone.replace(/\D/g, "").includes(qDigits);
    });
  }, [rows, query, branchName, branchFilter, accountFilter]);

  const filtered = useMemo(
    () => (stateFilter === "all" ? base : base.filter((r) => (stateFilter === "archived" ? Boolean(r.archReason) : !r.archReason))),
    [base, stateFilter],
  );
  const counts = useMemo(() => {
    const archived = base.filter((r) => r.archReason).length;
    return { all: base.length, active: base.length - archived, archived };
  }, [base]);
  const noAccount = filtered.filter((r) => r.accountStatus === null).length;
  const pending = filtered.filter((r) => r.approval === "pending").length;

  const anyFilter = !!query.trim() || !!branchFilter || !!accountFilter || stateFilter !== "all";
  function clearFilters() {
    setQuery("");
    setBranchFilter("");
    setAccountFilter("");
    setStateFilter("all");
  }

  // ── Belgilash — FILTRLANGAN qatorlar ustida ──
  const selectedInView = filtered.filter((r) => selected.has(r.id)).length;
  const allFilteredSelected = filtered.length > 0 && selectedInView === filtered.length;

  function toggleOne(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAllFiltered(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  // ── Faollashtirish SMS'i — bittalab ham, ko'plab ham shu yo'ldan; ikkalasi ham tasdiq oynasi bilan. ──
  function askSend(targets: TempStaffRow[]) {
    if (targets.length === 0) {
      showError(t("Xodim tanlanmagan"));
      return;
    }
    // Faollashgan va raqamsiz xodim ro'yxatga kirmaydi — oynadagi son HAQIQATDA ketadigan SMS soni.
    const list = targets.filter((x) => x.accountStatus !== "active" && x.phone);
    if (list.length === 0) {
      showError(t("Tanlanganlarning hammasi faollashgan yoki raqamsiz — yuboriladigan SMS yo'q"));
      return;
    }
    setSmsResults(null);
    setSmsTargets({ list, skipped: targets.length - list.length });
  }

  /** Admin tasdig'i ✓ / ✗ — optimistik: holat darhol qimirlaydi, xato bo'lsa eski qiymat qaytadi. */
  async function decideApproval(r: TempStaffRow, approval: "approved" | "rejected") {
    const before = r.approval;
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, approval } : x)));
    try {
      const res = await fetch(`/api/temp-staff/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
      showSuccess(approval === "approved" ? t("{name} — kirishga ruxsat berildi", { name: r.name }) : t("{name} — kirish rad etildi", { name: r.name }));
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, approval: before } : x)));
      showError(t(e instanceof Error ? e.message : "Saqlanmadi"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || busyRef.current) return;
    const target = deleteTarget;
    busyRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`/api/temp-staff/${target.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      const r = data.removed as { users: number; sessions: number; codes: number };
      // Nima o'chganini AYTAMIZ: sahifaning maqsadi raqamni bo'shatish.
      showSuccess(t("O'chirildi — hisob: {users}, sessiya: {sessions}, SMS kodi: {codes}. Raqam endi bo'sh.", { users: r.users, sessions: r.sessions, codes: r.codes }));
      setRows((prev) => prev.filter((x) => x.id !== target.id));
      setSelected((prev) => {
        if (!prev.has(target.id)) return prev;
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      busyRef.current = false;
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const branchesText = (r: TempStaffRow) => (r.branchIds.length === 0 ? "" : [...new Set(r.branchIds.map((id) => branchName.get(id) ?? `${t("Filial")} ${id}`))].join(", "));

  return (
    <PageShell>
      <PageHead
        title={t("Vaqtinchalik bo'lim")}
        subtitle={t("To'rtala filial xodimlari bir ro'yxatda: faollashtirish SMS'i, kirish tasdig'i, tahrir, arxiv, ish vaqti va butunlay o'chirish")}
        actions={
          <>
            <button type="button" onClick={() => setWorkTimeOpen(true)} disabled={loading} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              <Clock className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Ish vaqtini belgilash")}
            </button>
            <button
              type="button"
              onClick={() => askSend(rows.filter((r) => selected.has(r.id)))}
              disabled={selected.size === 0}
              title={selected.size === 0 ? t("Avval xodimlarni belgilang") : undefined}
              className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Send className="size-4" strokeWidth={2} aria-hidden />
              {t("Tanlanganlarga SMS")}
              {selected.size > 0 && <span className="tabular-nums">({selected.size})</span>}
            </button>
          </>
        }
      />

      <div className="flex items-start gap-2.5 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0">
          <b className="font-semibold">{t("Diqqat:")}</b>{" "}
          {t("bu yerdagi «O'chirish» xodimni butunlay o'chiradi — hisobi, sessiyalari va SMS kodlari bilan birga, ya'ni telefon raqami qayta ishlatishga bo'shaydi. Amal qaytarilmaydi.")}
        </span>
      </div>

      {/* Oxirgi yuborish natijasi — sababi («soatlik chegara», «raqam yo'q») kerak bo'lib turadi. */}
      {smsResults && (
        <div className="shrink-0 rounded-v2-lg border border-v2-border bg-v2-surface px-4 py-3 shadow-v2-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-v2-body font-semibold text-v2-text">
              {t("SMS natijasi — yuborildi: {sent}, yuborilmadi: {failed}", { sent: smsResults.filter((r) => r.ok).length, failed: smsResults.filter((r) => !r.ok).length })}
            </span>
            <button
              type="button"
              onClick={() => setSmsResults(null)}
              className="inline-flex h-8 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <X className="size-3.5" strokeWidth={2} aria-hidden />
              {t("Yopish")}
            </button>
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-v2-small">
            {smsResults.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                {r.ok ? (
                  <CheckCircle2 className="mt-px size-4 shrink-0 text-v2-success" strokeWidth={1.75} aria-label={t("Yuborildi")} />
                ) : (
                  <XCircle className="mt-px size-4 shrink-0 text-v2-danger" strokeWidth={1.75} aria-label={t("Yuborilmadi")} />
                )}
                <span className="min-w-0 text-v2-text">
                  {r.name}
                  {r.error && <span className={r.ok ? "text-v2-text-2" : "text-v2-danger"}> — {t(r.error)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder={t("Ism, telefon, vazifa yoki filial")} width={280} />
        <SegmentPills<StateKey>
          value={stateFilter}
          onChange={setStateFilter}
          items={[
            { key: "all", label: t("Hammasi"), count: counts.all },
            { key: "active", label: t("Aktiv"), count: counts.active },
            { key: "archived", label: t("Arxivda"), count: counts.archived },
          ]}
        />
        <V2Select variant="chip" label={t("Filial")} value={branchFilter} onChange={setBranchFilter} options={branchOptions} searchable={false} />
        <V2Select
          variant="chip"
          label={t("Hisob")}
          value={accountFilter}
          onChange={setAccountFilter}
          options={[
            { value: "none", label: t("Hisob yo'q") },
            { value: "invited", label: t("SMS ketgan — hali faollashmagan") },
            { value: "pending", label: t("Tasdiq kutmoqda") },
            { value: "rejected", label: t("Rad etilgan") },
            { value: "active", label: t("Faollashgan") },
          ]}
          searchable={false}
        />
        {anyFilter && (
          <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
            <X className="size-3.5" strokeWidth={2} aria-hidden />
            {t("Tozalash")}
          </button>
        )}
      </div>

      <SummaryLine
        items={[
          <span key="n">
            {t("Topildi:")} <B>{loading ? "—" : filtered.length}</B> / {loading ? "—" : rows.length}
          </span>,
          !loading && (
            <span key="na">
              {t("Hisob yo'q")}: <B tone={noAccount > 0 ? "danger" : undefined}>{noAccount}</B>
            </span>
          ),
          !loading && pending > 0 && (
            <span key="p">
              {t("Tasdiq kutmoqda")}: <B>{pending}</B>
            </span>
          ),
          selected.size > 0 && (
            <span key="s" className="text-v2-brand-text">
              {t("{n} ta belgilandi", { n: selected.size })}
            </span>
          ),
          selected.size > maxBatch && (
            <span key="b" className="font-medium text-v2-danger">
              {t("Bir marta {maxBatch} tagacha — belgilanganini kamaytiring", { maxBatch })}
            </span>
          ),
        ]}
      />

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[1120px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-10 pl-4 pr-2`}>
                  <V2Checkbox
                    checked={allFilteredSelected}
                    indeterminate={selectedInView > 0 && !allFilteredSelected}
                    onChange={toggleAllFiltered}
                    disabled={filtered.length === 0}
                    label={t("Ko'rinib turgan qatorlarni belgilash")}
                    title={t("Ko'rinib turgan qatorlarni belgilash")}
                  />
                </th>
                <th className={`${TH} w-12`}>№</th>
                <th className={TH}>{t("Xodim")}</th>
                <th className={TH}>{t("Vazifasi")}</th>
                <th className={TH}>{t("Filiallar")}</th>
                <th className={TH}>{t("Ish vaqti")}</th>
                <th className={TH}>{t("Hisob")}</th>
                <th className={TH}>{t("Holat")}</th>
                <th className={`${TH} w-40 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
                    <td className="py-3 pl-4 pr-2">
                      <div className="size-4 rounded-[4px] bg-v2-skeleton" />
                    </td>
                    <td className={TD}>
                      <div className="h-3 w-5 rounded bg-v2-skeleton" />
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-v2-full bg-v2-skeleton" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-32 rounded bg-v2-skeleton" />
                          <div className="h-2.5 w-24 rounded bg-v2-skeleton" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: COLS - 3 }, (_, j) => (
                      <td key={j} className={TD}>
                        <div className="h-3 w-20 rounded bg-v2-skeleton" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <UserCog className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && rows.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button
                            type="button"
                            onClick={() => {
                              setLoading(true);
                              setVersion((v) => v + 1);
                            }}
                            className={`${secondaryBtn} mt-2`}
                          >
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : anyFilter ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotlar topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          <button type="button" onClick={clearFilters} className={`${secondaryBtn} mt-2`}>
                            {t("Filtrlarni tozalash")}
                          </button>
                        </>
                      ) : (
                        <div className="text-v2-section text-v2-text">{t("Ma'lumotlar topilmadi")}</div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((r, i) => {
                  const on = selected.has(r.id);
                  const archived = Boolean(r.archReason);
                  const done = r.accountStatus === "active";
                  const label = r.name || `#${r.id}`;
                  const br = branchesText(r);
                  const wt = workTimeLabel(r);
                  return (
                    <tr key={r.id} className={`border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                      <td className="py-2.5 pl-4 pr-2">
                        <V2Checkbox checked={on} onChange={(v) => toggleOne(r.id, v)} label={t("{name} — belgilash", { name: label })} />
                      </td>
                      <td className={`${TD} tabular-nums text-v2-text-3`}>{i + 1}</td>
                      <td className={`${TD} max-w-[280px]`}>
                        <PersonCell name={r.name || "-"} sub={formatPhoneDisplay(r.phone) || "—"} />
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{r.turi ? t(roleOf(r.turi)) : <span className="text-v2-text-3">—</span>}</td>
                      <td className={`${TD} max-w-[220px]`}>
                        {br ? (
                          <span className="block truncate text-v2-small text-v2-text-2" title={br}>
                            {br}
                          </span>
                        ) : (
                          <span className="text-v2-text-3">—</span>
                        )}
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{wt || <span className="text-v2-small text-v2-text-3">{t("Kiritilmagan")}</span>}</td>
                      <td className={TD}>
                        <div className="flex min-w-[170px] flex-wrap items-center gap-1.5">
                          <AccountBadge status={r.accountStatus} />
                          {/* IKKI BOSQICH: ✓ / ✗ tasdiq holati YONIDA — amal aynan shu holatga tegishli. */}
                          {r.approval === "pending" && <Badge tone="info">{done ? t("Tasdiq kutmoqda") : t("Tasdiq talab qilinadi")}</Badge>}
                          {r.approval === "rejected" && <Badge tone="danger">{t("Rad etilgan")}</Badge>}
                          {r.approval === "approved" && (
                            <Badge tone="success" title={t("Ikki bosqichli kirish — admin tasdiqlagan")}>
                              {t("Tasdiqlangan")}
                            </Badge>
                          )}
                          {r.approval !== "" && (
                            <span className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => void decideApproval(r, "approved")}
                                disabled={r.approval === "approved"}
                                title={t("Kirishga ruxsat berish")}
                                aria-label={`${label} — ${t("Kirishga ruxsat berish")}`}
                                className={`${MINI_BTN} text-v2-success hover:bg-v2-success-bg disabled:hover:bg-transparent`}
                              >
                                <Check className="size-4" strokeWidth={1.75} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => void decideApproval(r, "rejected")}
                                disabled={r.approval === "rejected"}
                                title={t("Kirishni rad etish")}
                                aria-label={`${label} — ${t("Kirishni rad etish")}`}
                                className={`${MINI_BTN} text-v2-danger hover:bg-v2-danger-bg disabled:hover:bg-transparent`}
                              >
                                <X className="size-4" strokeWidth={1.75} aria-hidden />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={TD}>
                        {archived ? (
                          <div className="min-w-[110px]">
                            <Badge tone="neutral" title={`${r.archReason}${r.archDate ? ` — ${r.archDate}` : ""}`}>
                              {t("Arxivda")}
                            </Badge>
                            <span className="mt-0.5 block truncate text-v2-caption text-v2-text-3">
                              {t(r.archReason)}
                              {r.archDate && <span className="tabular-nums"> · {r.archDate}</span>}
                            </span>
                          </div>
                        ) : (
                          <Badge tone="success">{t("Aktiv")}</Badge>
                        )}
                      </td>
                      <td className={`${TD} pr-4`}>
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Faollashgan hisobga yuborilmaydi: parol bor, havola hech narsa bermaydi (server ham rad etadi). */}
                          <button
                            type="button"
                            onClick={() => askSend([r])}
                            disabled={done}
                            title={done ? t("Hisob allaqachon faollashgan") : t("Faollashtirish SMS'ini yuborish")}
                            aria-label={`${label} — ${t("Faollashtirish SMS'ini yuborish")}`}
                            className={`${ICON_BTN} hover:bg-v2-brand-bg hover:text-v2-brand-text disabled:hover:bg-transparent disabled:hover:text-v2-text-2`}
                          >
                            <Send className="size-4" strokeWidth={1.75} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(r)}
                            title={t("Tahrirlash")}
                            aria-label={`${label} — ${t("Tahrirlash")}`}
                            className={`${ICON_BTN} hover:bg-v2-surface-2 hover:text-v2-text`}
                          >
                            <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(r)}
                            title={archived ? t("Arxivdan chiqarish") : t("Arxivlash")}
                            aria-label={`${label} — ${archived ? t("Arxivdan chiqarish") : t("Arxivlash")}`}
                            className={`${ICON_BTN} hover:bg-v2-surface-2 hover:text-v2-text`}
                          >
                            {archived ? <ArchiveRestore className="size-4" strokeWidth={1.75} aria-hidden /> : <Archive className="size-4" strokeWidth={1.75} aria-hidden />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            title={t("Butunlay o'chirish")}
                            aria-label={`${label} — ${t("Butunlay o'chirish")}`}
                            className={`${ICON_BTN} text-v2-danger hover:bg-v2-danger-bg`}
                          >
                            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {workTimeOpen && <WorkTimeDialogV2 rows={rows} branches={branches} onClose={() => setWorkTimeOpen(false)} onSaved={reload} />}
      {editTarget && <EditStaffDialogV2 row={editTarget} onClose={() => setEditTarget(null)} onSaved={reload} />}
      {archiveTarget && <ArchiveDialogV2 row={archiveTarget} onClose={() => setArchiveTarget(null)} onSaved={reload} />}
      {smsTargets && (
        <SmsInviteDialogV2
          targets={smsTargets}
          maxBatch={maxBatch}
          onClose={() => setSmsTargets(null)}
          onSent={async (results) => {
            setSmsResults(results);
            await reload();
          }}
        />
      )}
      {deleteTarget && (
        <V2Confirm
          title={t("Xodimni butunlay o'chirasizmi?")}
          body={
            <div className="space-y-2">
              <p>
                <b className="font-semibold text-v2-text">{deleteTarget.name || `#${deleteTarget.id}`}</b>
                {deleteTarget.phone ? <span className="tabular-nums"> — {formatPhoneDisplay(deleteTarget.phone)}</span> : null}
              </p>
              {/* Aynan nima o'chishi ro'yxat bo'lib turadi: amal qaytarilmaydi. */}
              <p>{t("Birga o'chadi:")}</p>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>{t("xodim yozuvi")}</li>
                <li>{t("hisobi (shu raqamni band qilib turgani)")}</li>
                <li>{t("ochiq sessiyalari")}</li>
                <li>{t("faollashtirish SMS kodlari (soatlik chegara ham bo'shaydi)")}</li>
              </ul>
              <p className="font-medium text-v2-text">{t("Shundan keyin bu raqam bilan yangi xodim qo'shsa bo'ladi. Amal qaytarilmaydi.")}</p>
            </div>
          }
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("Butunlay o'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            if (!busyRef.current) setDeleteTarget(null);
          }}
        />
      )}
    </PageShell>
  );
}
