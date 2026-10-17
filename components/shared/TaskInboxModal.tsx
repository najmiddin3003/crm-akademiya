"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, ClipboardList, Eye, X } from "lucide-react";
import Link from "@/components/ui/Link";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Segmented from "@/components/ui/Segmented";
import { useTaskInbox } from "@/components/shared/TaskInboxProvider";
import { ApiError } from "@/lib/fetchJson";
import { OUTCOME_LABELS, REPORT_COMMENT_MAX, type InboxStaffTask, type InboxTask } from "@/lib/taskInbox";
import { ACTIVE_STATUSES, STATUS_LABEL, STATUS_TONE, ms, type Tone } from "@/lib/staffTasks";
import { PRIORITY_META, remainingUz, type TaskOutcome } from "@/lib/tasksData";
import { uzStamp } from "@/lib/uzTime";
import { useT, type TFn } from "@/components/shared/Language";

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
//
// 17.10.2026 dan XODIM TOPSHIRIQLARI (/tasks) ham shu oynada — foydalanuvchi:
// «rahbar oynasiga o'zi bergan topshiriqlarni ham ko'rinadigan qil»:
//   "Menga berilgan" — menga berilgan, yopilmagan topshiriqlar;
//   "Men bergan"     — men bergan, yopilmagan (tasdig'imni kutayotgani tepada).
// Qator /tasks?open=<id> ni ochadi — Bajardim/tasdiqlash/qaytarish o'sha
// kartada (fayl, havola, tarix bilan). Yuqoridagi eski ikki bo'lim (`tasks`
// kolleksiyasi) endi "O'quvchi vazifalari" va "Hisobotlar" nomi bilan.

type Tab = "staff" | "pending" | "given" | "reports";

/** Holat chipi ranglari — /tasks dagi `stk-tone-*` bilan bir ma'noda. */
const TONE_CLASS: Record<Tone, string> = {
  pri: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  vio: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  hot: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  bad: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  gray: "bg-secondary text-muted-foreground",
};

/** Xodim topshiriqlari ro'yxati — har qator /tasks dagi kartani ochadi. */
function StaffTaskRows({ items, given, nowMs, t, onOpen }: {
  items: InboxStaffTask[];
  given: boolean;
  nowMs: number;
  t: TFn;
  onOpen: () => void;
}) {
  return (
    <div className="max-h-[65vh] overflow-y-auto p-3">
      <ul className="space-y-1.5">
        {items.map((x) => {
          const due = ms(x.deadline);
          const active = ACTIVE_STATUSES.includes(x.status);
          const who = given ? x.employeeName : x.createdByName ? `${t("Bergan")}: ${x.createdByName}` : "";
          return (
            <li key={x.id}>
              <Link
                href={`/tasks?open=${x.id}`}
                onClick={onOpen}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{x.title || t("Topshiriq")}</div>
                  {who && <div className="truncate text-[12px] text-muted-foreground">{who}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[STATUS_TONE[x.status]]}`}>
                    {t(STATUS_LABEL[x.status])}
                  </span>
                  {active && Number.isFinite(due) && (
                    <div className={`mt-1 text-[11px] font-medium tabular-nums ${remainingTone(due, nowMs)}`}>{remainingUz(due, nowMs)}</div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end pt-2">
        <Link href="/tasks" onClick={onOpen} className="text-[12px] font-medium text-primary hover:underline">
          {t("Barcha topshiriqlar")} →
        </Link>
      </div>
    </div>
  );
}

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

function targetOf(task: InboxTask, label = "Guruh"): string {
  if (task.group) return `${label}: ${task.group}`;
  if (task.student) return task.student;
  return "—";
}

export default function TaskInboxModal() {
  const inbox = useTaskInbox();
  const modal = useModalClose(inbox.closeModal);
  const { pending, reports, staffMine, staffGiven, skewMs } = inbox;
  const { t } = useT();

  // Server vaqtiga tekislangan "hozir" — holatda, render'da `Date.now()` emas.
  // Har 30 soniyada yangilanadi; `skewMs` o'zgarsa (keyingi so'rov) keyingi
  // tick uni o'zi oladi.
  const [nowMs, setNowMs] = useState(() => Date.now() + skewMs);
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now() + skewMs), 30_000);
    return () => clearInterval(timer);
  }, [skewMs]);

  // Bo'limlar — faqat bo'shlari emas. Sukut: harakatimni kutayotgani
  // (menga berilgan faol → javob kutayotgan vazifa → tasdig'imni kutayotgan
  // → hisobot). Tanlangan bo'lim bo'shab qolsa sukutga qaytadi — holat
  // effektda emas, render'da hosil qilinadi.
  const staffActive = staffMine.filter((x) => ACTIVE_STATUSES.includes(x.status)).length;
  const givenWaiting = staffGiven.filter((x) => x.status === "tasdiq_kutilmoqda").length;
  const available: Tab[] = [
    ...(staffMine.length > 0 ? (["staff"] as const) : []),
    ...(pending.length > 0 ? (["pending"] as const) : []),
    ...(staffGiven.length > 0 ? (["given"] as const) : []),
    ...(reports.length > 0 ? (["reports"] as const) : []),
  ];
  const preferred: Tab = staffActive > 0
    ? "staff"
    : pending.length > 0
      ? "pending"
      : givenWaiting > 0
        ? "given"
        : reports.length > 0
          ? "reports"
          : (available[0] ?? "staff");
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const tab: Tab = tabChoice !== null && available.includes(tabChoice) ? tabChoice : preferred;

  const [selectedId, setSelectedId] = useState<number | null>(pending[0]?.id ?? null);
  const selected = useMemo(
    () => pending.find((task) => task.id === selectedId) ?? pending[0] ?? null,
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
      if (pending.length <= 1 && reports.length === 0 && staffMine.length === 0 && staffGiven.length === 0) modal.close();
    } catch (e) {
      setError(e instanceof ApiError ? t(e.message) : t("Javobni yuborib bo'lmadi"));
    } finally {
      setSaving(null);
    }
  };

  const [seeing, setSeeing] = useState<Set<number>>(new Set());
  const see = async (ids: number[]) => {
    setSeeing((s) => new Set([...s, ...ids]));
    try {
      await inbox.markReportsSeen(ids);
      if (reports.length <= ids.length && pending.length === 0 && staffMine.length === 0 && staffGiven.length === 0) modal.close();
    } catch {
      // Belgilanmadi — qator joyida qoladi, keyingi urinish mumkin.
    } finally {
      setSeeing((s) => { const n = new Set(s); ids.forEach((i) => n.delete(i)); return n; });
    }
  };

  const total = pending.length + reports.length + staffMine.length + staffGiven.length;
  const head =
    tab === "staff"
      ? {
          title: t("Menga berilgan topshiriqlar"),
          subtitle: staffActive > 0 ? t("Bajarish kerak: {n} ta", { n: staffActive }) : t("Hammasi bajarilgan — rahbar tasdig'ini kutmoqda"),
          alert: staffActive > 0,
        }
      : tab === "given"
        ? {
            title: t("Men bergan topshiriqlar"),
            subtitle: t("Tasdig'ingizni kutmoqda: {n} ta · jami {m} ta", { n: givenWaiting, m: staffGiven.length }),
            alert: false,
          }
        : tab === "pending"
          ? {
              title: t("Topshiriq bajarilishi kutilmoqda"),
              subtitle: pending.length === 1
                ? t("Sizga berilgan topshiriq javobingizni kutmoqda")
                : t("Sizga berilgan {n} ta topshiriq javobingizni kutmoqda", { n: pending.length }),
              alert: true,
            }
          : {
              title: t("Topshiriq hisobotlari"),
              subtitle: reports.length === 1
                ? t("Siz bergan topshiriq bo'yicha hisobot keldi")
                : t("Siz bergan topshiriqlar bo'yicha {n} ta hisobot keldi", { n: reports.length }),
              alert: false,
            };
  const tabLabel: Record<Tab, string> = {
    staff: t("Menga berilgan ({n})", { n: staffMine.length }),
    pending: t("O'quvchi vazifalari ({n})", { n: pending.length }),
    given: t("Men bergan ({n})", { n: staffGiven.length }),
    reports: t("Hisobotlar ({reports})", { reports: reports.length }),
  };

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
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${head.alert ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"}`}>
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight">{head.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{head.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={modal.close}
          disabled={saving !== null}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          title={t("Keyinroq")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {available.length > 1 && (
        <div className="px-5 pt-3">
          <Segmented
            size="sm"
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={available.map((value) => ({ value, label: tabLabel[value] }))}
          />
        </div>
      )}

      {total === 0 && (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">{t("Kutilayotgan topshiriq yo'q")}</div>
      )}

      {tab === "staff" && staffMine.length > 0 && (
        <StaffTaskRows items={staffMine} given={false} nowMs={nowMs} t={t} onOpen={modal.close} />
      )}

      {tab === "given" && staffGiven.length > 0 && (
        <StaffTaskRows items={staffGiven} given nowMs={nowMs} t={t} onOpen={modal.close} />
      )}

      {tab === "pending" && selected && (
        <div className={pending.length > 1 ? "task-inbox-grid" : ""}>
          {pending.length > 1 && (
            <div className="task-inbox-list max-h-[55vh] overflow-y-auto p-3">
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Topshiriqni tanlang")}
              </div>
              <ul className="space-y-1.5">
                {pending.map((task) => {
                  const active = task.id === selected.id;
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(task.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}
                      >
                        <div className="truncate text-[13px] font-semibold">{task.description || task.type || t("Topshiriq")}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{targetOf(task, t("Guruh"))}</div>
                        {task.dueMs !== null && (
                          <div className={`mt-1 text-[11px] font-medium tabular-nums ${remainingTone(task.dueMs, nowMs)}`}>
                            {remainingUz(task.dueMs, nowMs)}
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
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{t(selected.type)}</span>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Topshiriq")}</div>
              <div className="mt-1 whitespace-pre-wrap text-[14px] leading-snug">{selected.description || selected.type || "—"}</div>
            </div>

            <dl className="task-inbox-meta text-[13px]">
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("Kimga")}</dt>
                <dd className="font-medium">{targetOf(selected, t("Guruh"))}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("Bergan")}</dt>
                <dd className="font-medium">
                  {selected.createdByName || "—"}
                  {selected.createdAt && <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">{stamp(selected.createdAt)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("Muddat")}</dt>
                <dd className="font-medium tabular-nums">{selected.dueMs !== null ? uzStamp(new Date(selected.dueMs)) : selected.date || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("Qolgan vaqt")}</dt>
                <dd className={`text-[15px] font-bold tabular-nums ${selected.dueMs !== null ? remainingTone(selected.dueMs, nowMs) : ""}`}>
                  {selected.dueMs !== null ? remainingUz(selected.dueMs, nowMs) : "—"}
                </dd>
              </div>
            </dl>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="task-inbox-comment">
                {t("Izoh")} <span className="text-red-500">*</span>
                <span className="ml-1 font-normal">{t("— rahbarga yuboriladi")}</span>
              </label>
              <textarea
                id="task-inbox-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, REPORT_COMMENT_MAX))}
                rows={4}
                maxLength={REPORT_COMMENT_MAX}
                disabled={saving !== null}
                placeholder={t("Nima qilindi yoki nega bajarilmadi — qisqacha yozing")}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{comment.trim() ? "" : t("Tugmalar izoh yozilgach yonadi")}</span>
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
                {t("Keyinroq")}
              </button>
              <button
                type="button"
                onClick={() => void send("bajarilmadi")}
                disabled={!canSend}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-card px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <X className="h-4 w-4" />
                {saving === "bajarilmadi" ? t("Yuborilmoqda…") : t("Bajarilmadi")}
              </button>
              <button
                type="button"
                onClick={() => void send("bajarildi")}
                disabled={!canSend}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving === "bajarildi" ? t("Yuborilmoqda…") : t("Bajarildi")}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "reports" && reports.length > 0 && (
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-2.5">
          {reports.map((task) => {
            const rep = task.report;
            if (!rep) return null;
            const done = rep.outcome === "bajarildi";
            const busy = seeing.has(task.id);
            return (
              <div key={task.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
                    {done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {t(OUTCOME_LABELS[rep.outcome])}
                  </span>
                  <span className={`priority-badge priority-${task.priority}`}>{t(PRIORITY_META[task.priority].label)}</span>
                  {task.type && <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{t(task.type)}</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{stamp(rep.at)}</span>
                </div>
                <div className="mt-2 text-[13.5px] font-semibold leading-snug">{task.description || task.type || t("Topshiriq")}</div>
                <div className="text-[12px] text-muted-foreground">
                  {targetOf(task, t("Guruh"))}
                  {task.dueMs !== null && <> · {t("Muddat")}: <span className="tabular-nums">{uzStamp(new Date(task.dueMs))}</span></>}
                </div>
                <blockquote className="mt-2.5 rounded-lg border-l-[3px] border-primary/60 bg-secondary/50 px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap">
                  {rep.comment}
                </blockquote>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-muted-foreground">
                    {t("Mas'ul")}: <span className="font-medium text-foreground">{rep.byName || task.staff || "—"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void see([task.id])}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t("Ko'rdim")}
                  </button>
                </div>
              </div>
            );
          })}
          {reports.length > 1 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void see(reports.map((task) => task.id))}
                disabled={seeing.size > 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                {t("Hammasini ko'rdim")}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
