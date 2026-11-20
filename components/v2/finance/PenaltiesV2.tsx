"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, ImageIcon, Loader2, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useLang, useT } from "@/components/shared/Language";
import { usePersonHref, type PersonKind } from "@/components/shared/PersonDirectory";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field } from "@/components/v2/form/fields";
import { B, Badge, PageHead, PageShell, SearchBox, SegmentPills, SummaryLine, fmtNum } from "@/components/v2/students/lists/listKit";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { PENALTY_CANCEL_REASONS } from "@/constants/penalties";
import type { Penalty } from "@/lib/penalties";
import { PenaltyCreateDialogV2 } from "./finAwardDialogV2";

// YANGI VERSIYA — MOLIYA → «JARIMA» (/finance-penalty, rasmsiz — Bonus sahifasi bilan bir qolipda,
// 20.11.2026). Eski versiyada — components/finance/PenaltiesPage.tsx, o'zgarmagan.
//
// Ma'lumot va amallar eski sahifa bilan BITTA: GET /api/penalties; qo'shish — POST /api/penalties
// (./finAwardDialogV2, rasm avval /api/upload/image ga); jarima O'CHIRILMAYDI — «Bekor qilish»:
// PATCH /api/penalties/:id { reason } (sabab ixtiyoriy), yozuv ro'yxatda «Bekor qilingan» bo'lib qoladi.
// XODIM jarimasi oylikdan ushlanadi, bekor qilingani — yo'q (lib/payrollSources.ts:
// type "employee", status ≠ "cancelled").
// Eski sahifada filtr yo'q edi — bu yerda holat tabletkalari va ism bo'yicha qidiruv (brauzerda).

// /api/penalties qaytaradigan qator — eski sahifadagi kengaytirilgan tur (balans manbasi yo'q — null).
type PenaltyRow = Omit<Penalty, "before" | "after"> & {
  before: number | null;
  after: number | null;
};

type PenTab = "all" | "active" | "cancelled";

const PEN_TYPE_LABEL: Record<string, string> = { employee: "Xodim jarimasi", student: "O'quvchi jarimasi" };

/** "DD.MM.YYYY HH:mm" → kun. */
function penDay(s: string): Date | null {
  const [datePart] = (s || "").split(" ");
  const [d, m, y] = (datePart || "").split(".").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function penNum(n: number | null | undefined): string {
  return n == null ? "—" : fmtNum(n);
}

function PenPerson({ name, kind }: { name: string; kind?: PersonKind }) {
  const text = (name || "").trim();
  const href = usePersonHref(text, kind);
  if (!text) return <span className="text-v2-text-3">—</span>;
  const cls = "block truncate font-semibold text-v2-text";
  if (!href) return <span className={cls} title={text}>{text}</span>;
  return (
    <Link href={href} title={text} className={`${cls} underline-offset-2 hover:text-v2-brand-text hover:underline`}>
      {text}
    </Link>
  );
}

const TH = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "px-2.5 py-2.5 align-middle";
const COLS = 11;

export default function PenaltiesV2() {
  const { t } = useT();
  const [lang] = useLang();

  const [rows, setRows] = useState<PenaltyRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<PenTab>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [addOpen, setAddOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PenaltyRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/penalties")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setRows(d.penalties);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const all = useMemo(() => rows ?? [], [rows]);
  const cancelledCount = useMemo(() => all.filter((p) => p.status === "cancelled").length, [all]);
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      all.filter(
        (p) =>
          (tab === "all" || (tab === "cancelled" ? p.status === "cancelled" : p.status !== "cancelled")) &&
          (!needle || (p.recipientName || "").toLowerCase().includes(needle)),
      ),
    [all, tab, needle],
  );
  const activeSum = useMemo(() => filtered.reduce((s, p) => (p.status === "cancelled" ? s : s + (Number(p.amount) || 0)), 0), [filtered]);
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const narrowed = tab !== "all" || !!needle;

  return (
    <PageShell>
      <PageHead
        title={t("Jarimalar")}
        subtitle={t("Xodim jarimasi shu oy oyligidan ushlanadi; bekor qilingani hisobga olinmaydi")}
        actions={
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Jarima qo'shish")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentPills<PenTab>
          items={[
            { key: "all", label: t("Hammasi"), count: all.length },
            { key: "active", label: t("Amalda"), count: all.length - cancelledCount },
            { key: "cancelled", label: t("Bekor qilingan"), count: cancelledCount },
          ]}
          value={tab}
          onChange={(k) => {
            setTab(k);
            setPage(1);
          }}
        />
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder={t("Ism bo'yicha qidirish")}
            width={240}
          />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="n">
            {t("Umumiy soni:")} <B>{rows ? fmtNum(filtered.length) : "—"}</B>
          </span>,
          <span key="s">
            {t("Amaldagi jarimalar:")} <B tone="danger">{rows ? `${fmtNum(activeSum)} ${t("so'm")}` : "—"}</B>
          </span>,
        ]}
      />

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[1180px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={TH}>{t("To'liq ismi")}</th>
                <th className={`${TH} text-right`}>{t("Oldingi miqdor")}</th>
                <th className={`${TH} text-right`}>{t("Miqdori")}</th>
                <th className={`${TH} text-right`}>{t("Keyingi miqdor")}</th>
                <th className={TH}>{t("Izoh")}</th>
                <th className={TH}>{t("Sababi")}</th>
                <th className={TH}>{t("Holati")}</th>
                <th className={TH}>{t("Yaratilgan sanasi")}</th>
                <th className={TH}>{t("Rasm")}</th>
                <th className={`${TH} pr-4`}>
                  <span className="sr-only">{t("Harakatlar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows &&
                !failed &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                    <td className={`${TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-36 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-16 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-16 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-28 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-5 w-16 rounded-v2-full bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-24 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-12 rounded bg-v2-skeleton" /></td>
                    <td className={`${TD} pr-4`} />
                  </tr>
                ))}

              {((failed && !rows) || (rows && slice.length === 0)) && (
                <tr>
                  <td colSpan={COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <ShieldAlert className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !rows ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : narrowed ? (
                        <div className="text-v2-section text-v2-text">{t("Jarima topilmadi")}</div>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hali jarima yozilmagan")}</div>
                          <button type="button" onClick={() => setAddOpen(true)} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("Jarima qo'shish")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {slice.map((p, i) => {
                const isCancelled = p.status === "cancelled";
                const day = penDay(p.createdAt);
                const time = (p.createdAt || "").split(" ")[1] ?? "";
                return (
                  <tr key={p.id} className={`h-14 border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className={`${TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                    <td className={`${TD} max-w-[240px]`}>
                      <PenPerson name={p.recipientName} kind={p.type === "employee" ? "staff" : p.type === "student" ? "student" : undefined} />
                      <span className="block truncate text-v2-caption text-v2-text-3">{PEN_TYPE_LABEL[p.type] ? t(PEN_TYPE_LABEL[p.type]) : p.type || "—"}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-v2-text-2`}>{penNum(p.before)}</td>
                    <td className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums ${isCancelled ? "text-v2-text-3 line-through" : "text-v2-danger"}`}>{fmtNum(p.amount)}</td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-v2-text-2`}>{penNum(p.after)}</td>
                    <td className={`${TD} max-w-[220px]`}>
                      {p.note ? <span className="block truncate text-v2-text-2" title={p.note}>{p.note}</span> : <span className="text-v2-text-3">—</span>}
                    </td>
                    <td className={`${TD} max-w-[200px]`}>
                      {p.reason ? <span className="block truncate text-v2-text-2" title={p.reason}>{t(p.reason)}</span> : <span className="text-v2-text-3">—</span>}
                    </td>
                    <td className={TD}>
                      {isCancelled ? (
                        <Badge tone="neutral">{t("Bekor qilingan")}</Badge>
                      ) : p.status ? (
                        <span className="text-v2-text-2">{p.status}</span>
                      ) : (
                        <Badge tone="warning">{t("Amalda")}</Badge>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-v2-text-2`} title={p.createdAt}>
                      {day ? dayMonthLabel(day, lang) : p.createdAt || "—"}
                      {day && time && (
                        <>
                          {" "}
                          <span className="text-v2-text-3">|</span> {time}
                        </>
                      )}
                    </td>
                    <td className={TD}>
                      {/* Eski yozuvlarda faqat fayl NOMI turishi mumkin — havola emas, matn (eski sahifa kabi). */}
                      {p.image ? (
                        p.image.startsWith("http") ? (
                          <a
                            href={p.image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-v2-brand-text underline-offset-2 hover:underline"
                          >
                            <ImageIcon className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Ko'rish")}
                          </a>
                        ) : (
                          <span className="block max-w-[140px] truncate text-v2-text-2" title={p.image}>
                            {p.image}
                          </span>
                        )
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
                    <td className={`${TD} pr-4 text-right`}>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(p)}
                          aria-label={`${p.recipientName} — ${t("Bekor qilish")}`}
                          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-v2-md px-2 text-v2-small font-medium text-v2-text-2 transition-colors hover:bg-v2-danger-bg hover:text-v2-danger focus-visible:outline-none focus-visible:shadow-v2-focus"
                        >
                          <Ban className="size-4" strokeWidth={1.75} aria-hidden />
                          {t("Bekor qilish")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
      </div>

      {addOpen && <PenaltyCreateDialogV2 onClose={() => setAddOpen(false)} onSaved={(p) => setRows((prev) => [p as PenaltyRow, ...(prev ?? [])])} />}
      {cancelTarget && (
        <PenaltyCancelDialogV2
          penalty={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={(updated) => setRows((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev))}
        />
      )}
    </PageShell>
  );
}

/* ───────────────────────── Bekor qilish oynasi ───────────────────────── */

function PenaltyCancelDialogV2({ penalty, onClose, onCancelled }: { penalty: PenaltyRow; onClose: () => void; onCancelled: (p: PenaltyRow) => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const busyRef = useRef(false);

  async function confirmCancel() {
    if (busyRef.current) return;
    busyRef.current = true;
    setCancelling(true);
    try {
      const res = await fetch(`/api/penalties/${penalty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Bekor qilinmadi"));
        busyRef.current = false;
        setCancelling(false);
        return;
      }
      onCancelled(data.penalty as PenaltyRow);
      showSuccess(t("Jarima bekor qilindi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      modal.close();
    } finally {
      busyRef.current = false;
      setCancelling(false);
    }
  }

  return (
    <V2Dialog
      title={t("Jarimani bekor qilasizmi?")}
      subtitle={`${penalty.recipientName} — ${fmtNum(penalty.amount)} ${t("so'm")}`}
      onClose={onClose}
      controller={modal}
      saving={cancelling}
      onSubmit={() => void confirmCancel()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={cancelling} className={secondaryBtn}>
            {t("Orqaga")}
          </button>
          <button
            type="button"
            onClick={() => void confirmCancel()}
            disabled={cancelling}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-v2-md bg-v2-danger px-4 text-v2-body font-semibold text-v2-on-danger transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
          >
            {cancelling && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {cancelling ? t("Bekor qilinmoqda…") : t("Jarimani bekor qilish")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label={t("Sababi")} optional>
          <V2Select
            label={t("Sababi")}
            value={cancelReason}
            onChange={setCancelReason}
            options={PENALTY_CANCEL_REASONS.map((r: string) => ({ value: r, label: r }))}
            placeholder="Tanlang"
            searchable={false}
          />
        </Field>
        <p className="text-v2-small text-v2-text-2">
          {penalty.type === "employee"
            ? t("Yozuv ro'yxatda «Bekor qilingan» bo'lib qoladi va xodim oyligidan ushlanmaydi. Buni qaytarib bo'lmaydi.")
            : t("Yozuv ro'yxatda «Bekor qilingan» bo'lib qoladi. Buni qaytarib bo'lmaydi.")}
        </p>
      </div>
    </V2Dialog>
  );
}
