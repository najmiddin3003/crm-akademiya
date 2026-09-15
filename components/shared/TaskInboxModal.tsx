"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, Eye, X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Segmented from "@/components/ui/Segmented";
import { useTaskInbox } from "@/components/shared/TaskInboxProvider";
import { ApiError } from "@/lib/fetchJson";
import { OUTCOME_LABELS, REPORT_COMMENT_MAX, type InboxTask } from "@/lib/taskInbox";
import { PRIORITY_META, remainingUz, type TaskOutcome } from "@/lib/tasksData";
import { uzStamp } from "@/lib/uzTime";

// XODIMNING SHAXSIY TOPSHIRIQ OYNASI.
//
// Ikki bo'lim (ikkalasi bo'lsa yuqorida segment tanlov):
//   "Menga berilgan" — javob kutayotgan topshiriqlar. Bir nechta bo'lsa
//     chapda ro'yxat, o'ngda tanlangani; bitta bo'lsa faqat o'zi. Izoh
//     MAJBURIY — "Bajarildi" ham, "Bajarilmadi" ham izohsiz yonmaydi
//     (talab), hisobot rahbarga izoh bilan qaytadi.
//   "Hisobotlar" — men bergan topshiriqlarga kelgan javoblar; "Ko'rdim"
//     ro'yxatdan chiqaradi (topshiriqning o'zida hisobot qoladi).
//
// QOLGAN VAQT jonli: har 30 soniyada qayta hisoblanadi, server soatiga
// tekislangan (provider'dagi `skewMs`) — klient soati adashgan bo'lsa ham
// "kechikdi" yolg'on bo'lmasin.

type Tab = "pending" | "reports";

/** Qolgan vaqtning rangi — kartadagi muddat chipi bilan bir mantiq. */
function remainingTone(dueMs: number, nowMs: number): string {
  const h = (dueMs - nowMs) / 3_600_000;
  if (h < 0) return "text-red-600 dark:text-red-400";
  if (h < 6) return "text-orange-600 dark:text-orange-400";
  if (h < 24) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function stamp(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? uzStamp(new Date(t)) : "";
}

function targetOf(t: InboxTask): string {
  if (t.group) return `Guruh: ${t.group}`;
  if (t.student) return t.student;
  return "—";
}

export default function TaskInboxModal() {
  const inbox = useTaskInbox();
  const modal = useModalClose(inbox.closeModal);
  const { pending, reports, skewMs } = inbox;

  // Server vaqtiga tekislangan "hozir" — holatda, render'da `Date.now()` emas.
  // Har 30 soniyada yangilanadi; `skewMs` o'zgarsa (keyingi so'rov) keyingi
  // tick uni o'zi oladi.
  const [nowMs, setNowMs] = useState(() => Date.now() + skewMs);
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now() + skewMs), 30_000);
    return () => clearInterval(t);
  }, [skewMs]);

  const [tabChoice, setTab] = useState<Tab>(pending.length > 0 ? "pending" : "reports");
  // Bitta bo'lim bo'sh bo'lib qolsa (oxirgi javob berildi) ikkinchisi
  // ko'rsatiladi — holatni effektda emas, render'da hosil qilamiz.
  const tab: Tab =
    tabChoice === "pending" && pending.length === 0 && reports.length > 0
      ? "reports"
      : tabChoice === "reports" && reports.length === 0 && pending.length > 0
        ? "pending"
        : tabChoice;

  const [selectedId, setSelectedId] = useState<number | null>(pending[0]?.id ?? null);
  const selected = useMemo(
    () => pending.find((t) => t.id === selectedId) ?? pending[0] ?? null,
    [pending, selectedId],
  );

  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState<TaskOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Boshqa topshiriq tanlanganda izoh o'sha topshiriqqa tegishli — tozalanadi.
  // React'ning "prop o'zgarganda holatni moslash" naqshi: oldingi id render
  // paytida solishtiriladi, effekt kerak emas.
  const [prevSelectedId, setPrevSelectedId] = useState<number | null>(selected?.id ?? null);
  if ((selected?.id ?? null) !== prevSelectedId) {
    setPrevSelectedId(selected?.id ?? null);
    setComment("");
    setError(null);
  }

  const canSend = comment.trim().length > 0 && saving === null && !!selected;

  const send = async (outcome: TaskOutcome) => {
    if (!selected || !canSend) return;
    setSaving(outcome);
    setError(null);
    try {
      await inbox.answer({ id: selected.id, outcome, comment: comment.trim() });
      // Oxirgi topshiriq javoblandi va hisobot ham yo'q — oyna o'zi yopiladi.
      if (pending.length <= 1 && reports.length === 0) modal.close();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Javobni yuborib bo'lmadi");
    } finally {
      setSaving(null);
    }
  };

  const [seeing, setSeeing] = useState<Set<number>>(new Set());
  const see = async (ids: number[]) => {
    setSeeing((s) => new Set([...s, ...ids]));
    try {
      await inbox.markReportsSeen(ids);
      if (reports.length <= ids.length && pending.length === 0) modal.close();
    } catch {
      // Belgilanmadi — qator joyida qoladi, keyingi urinish mumkin.
    } finally {
      setSeeing((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; });
    }
  };

  const total = pending.length + reports.length;
  const title = pending.length > 0 ? "Topshiriq bajarilishi kutilmoqda" : "Topshiriq hisobotlari";
  const subtitle =
    pending.length > 0
      ? pending.length === 1
        ? "Sizga berilgan topshiriq javobingizni kutmoqda"
        : `Sizga berilgan ${pending.length} ta topshiriq javobingizni kutmoqda`
      : reports.length === 1
        ? "Siz bergan topshiriq bo'yicha hisobot keldi"
        : `Siz bergan topshiriqlar bo'yicha ${reports.length} ta hisobot keldi`;

  return (
    <Modal
      onClose={inbox.closeModal}
      controller={modal}
      bare
      size={tab === "pending" && pending.length > 1 ? "4xl" : "2xl"}
      zIndex={190}
      locked={saving !== null}
      panelClassName="overflow-y-auto"
    >
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${pending.length > 0 ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"}`}>
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={modal.close}
          disabled={saving !== null}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          title="Keyinroq"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {pending.length > 0 && reports.length > 0 && (
        <div className="px-5 pt-3">
          <Segmented
            size="sm"
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: "pending", label: `Menga berilgan (${pending.length})` },
              { value: "reports", label: `Hisobotlar (${reports.length})` },
            ]}
          />
        </div>
      )}

      {total === 0 && (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">Kutilayotgan topshiriq yo&apos;q</div>
      )}

      {tab === "pending" && selected && (
        <div className={pending.length > 1 ? "task-inbox-grid" : ""}>
          {pending.length > 1 && (
            <div className="task-inbox-list max-h-[55vh] overflow-y-auto p-3">
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Topshiriqni tanlang
              </div>
              <ul className="space-y-1.5">
                {pending.map((t) => {
                  const active = t.id === selected.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}
                      >
                        <div className="truncate text-[13px] font-semibold">{t.description || t.type || "Topshiriq"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{targetOf(t)}</div>
                        {t.dueMs !== null && (
                          <div className={`mt-1 text-[11px] font-medium tabular-nums ${remainingTone(t.dueMs, nowMs)}`}>
                            {remainingUz(t.dueMs, nowMs)}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`priority-badge priority-${selected.priority}`}>{PRIORITY_META[selected.priority].label}</span>
              {selected.type && (
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{selected.type}</span>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Topshiriq</div>
              <div className="mt-1 whitespace-pre-wrap text-[14px] leading-snug">{selected.description || selected.type || "—"}</div>
            </div>

            <dl className="task-inbox-meta text-[13px]">
              <div>
                <dt className="text-[11px] text-muted-foreground">Kimga</dt>
                <dd className="font-medium">{targetOf(selected)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Bergan</dt>
                <dd className="font-medium">
                  {selected.createdByName || "—"}
                  {selected.createdAt && <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">{stamp(selected.createdAt)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Muddat</dt>
                <dd className="font-medium tabular-nums">{selected.dueMs !== null ? uzStamp(new Date(selected.dueMs)) : selected.date || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Qolgan vaqt</dt>
                <dd className={`text-[15px] font-bold tabular-nums ${selected.dueMs !== null ? remainingTone(selected.dueMs, nowMs) : ""}`}>
                  {selected.dueMs !== null ? remainingUz(selected.dueMs, nowMs) : "—"}
                </dd>
              </div>
            </dl>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="task-inbox-comment">
                Izoh <span className="text-red-500">*</span>
                <span className="ml-1 font-normal">— rahbarga yuboriladi</span>
              </label>
              <textarea
                id="task-inbox-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, REPORT_COMMENT_MAX))}
                rows={4}
                maxLength={REPORT_COMMENT_MAX}
                disabled={saving !== null}
                placeholder="Nima qilindi yoki nega bajarilmadi — qisqacha yozing"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{comment.trim() ? "" : "Tugmalar izoh yozilgach yonadi"}</span>
                <span className="tabular-nums">{comment.length}/{REPORT_COMMENT_MAX}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={modal.close}
                disabled={saving !== null}
                className="mr-auto h-9 px-3 text-sm font-medium text-muted-foreground hover:underline disabled:opacity-50"
              >
                Keyinroq
              </button>
              <button
                type="button"
                onClick={() => void send("bajarilmadi")}
                disabled={!canSend}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-card px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <X className="h-4 w-4" />
                {saving === "bajarilmadi" ? "Yuborilmoqda…" : "Bajarilmadi"}
              </button>
              <button
                type="button"
                onClick={() => void send("bajarildi")}
                disabled={!canSend}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving === "bajarildi" ? "Yuborilmoqda…" : "Bajarildi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "reports" && reports.length > 0 && (
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-2.5">
          {reports.map((t) => {
            const rep = t.report;
            if (!rep) return null;
            const done = rep.outcome === "bajarildi";
            const busy = seeing.has(t.id);
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
                    {done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {OUTCOME_LABELS[rep.outcome]}
                  </span>
                  <span className={`priority-badge priority-${t.priority}`}>{PRIORITY_META[t.priority].label}</span>
                  {t.type && <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{t.type}</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{stamp(rep.at)}</span>
                </div>
                <div className="mt-2 text-[13.5px] font-semibold leading-snug">{t.description || t.type || "Topshiriq"}</div>
                <div className="text-[12px] text-muted-foreground">
                  {targetOf(t)}
                  {t.dueMs !== null && <> · Muddat: <span className="tabular-nums">{uzStamp(new Date(t.dueMs))}</span></>}
                </div>
                <blockquote className="mt-2.5 rounded-lg border-l-[3px] border-primary/60 bg-secondary/50 px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap">
                  {rep.comment}
                </blockquote>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-muted-foreground">
                    Mas&apos;ul: <span className="font-medium text-foreground">{rep.byName || t.staff || "—"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void see([t.id])}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ko&apos;rdim
                  </button>
                </div>
              </div>
            );
          })}
          {reports.length > 1 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void see(reports.map((t) => t.id))}
                disabled={seeing.size > 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                Hammasini ko&apos;rdim
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
