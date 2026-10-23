"use client";

import { ListChecks } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { STATUS_RANK, STATUS_TONE, isOpen, ms, uzDateOf, uzTimeOf, type StaffTask, type Tone } from "@/lib/staffTasks";
import { V2_STATUS_LABEL } from "@/components/v2/tasks/taskBitsV2";

// YANGI VERSIYA — XODIM PROFILI → «TOPSHIRIQLAR» (rasm «Xodim profili», 20.10.2026):
// sarlavha + «Hammasi»; har qator — muhimlik raqami (kvadratda), nomi, ostida muddat
// («Muddat: 15-oktabr | 18:00 · ko'rildi», «Qayta muddat: …», «10-oktabr | 17:20 da
// tasdiqlandi») va o'ngda holat belgisi. Manba — /tasks bilan bitta (/api/staff-tasks,
// qamrov serverda). Holat nomlari Topshiriqlar ro'yxati bilan bir xil (taskBitsV2 →
// V2_STATUS_LABEL): «Yangi» — «Faol» (rasmlar «Xodim profili» va «Topshiriqlar», SAVOLLAR
// 129, 134). Rasmdagi «Namuna» belgisi — dizaynerning izohi (namuna ma'lumot), interfeysda yo'q.

const MAX = 5;

const TONE: Record<Tone, string> = {
  pri: "bg-v2-info-bg text-v2-info",
  vio: "bg-v2-violet-bg text-v2-violet",
  amber: "bg-v2-warning-bg text-v2-warning",
  hot: "bg-v2-warning-bg text-v2-warning",
  ok: "bg-v2-success-bg text-v2-success",
  bad: "bg-v2-danger-bg text-v2-danger",
  gray: "bg-v2-surface-2 text-v2-text-2",
};

export default function EmployeeTasksCard({
  tasks,
  employeeId,
  canAssign,
}: {
  /** null — yuklanmoqda; undefined — olib bo'lmadi. */
  tasks: StaffTask[] | null | undefined;
  employeeId: number;
  canAssign: boolean;
}) {
  const { t, months } = useT();

  const stamp = (iso: string | null | undefined) => {
    const v = ms(iso);
    if (!Number.isFinite(v)) return "";
    const d = uzDateOf(v);
    return `${Number(d.slice(8, 10))}-${(months[Number(d.slice(5, 7)) - 1] ?? "").toLowerCase()} | ${uzTimeOf(v)}`;
  };

  const sub = (k: StaffTask): string => {
    if (k.status === "yakunlandi") return t("{when} da tasdiqlandi", { when: stamp(k.completedAt) });
    if (k.status === "bekor") return k.cancelReason ? t("Bekor qilindi: {reason}", { reason: k.cancelReason }) : t("Bekor qilindi");
    if (k.status === "bajarilmadi") return t("Muddat: {when}", { when: stamp(k.deadline) });
    if (k.redeadline) return t("Qayta muddat: {when}", { when: stamp(k.redeadline) });
    const seen = isOpen(k.status) ? ` · ${k.seenAt ? t("ko'rildi") : t("ko'rilmagan")}` : "";
    return `${t("Muddat: {when}", { when: stamp(k.deadline) })}${seen}`;
  };

  const list = (tasks ?? [])
    .filter((k) => k.employeeId === employeeId)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (isOpen(a.status) ? ms(a.deadline) - ms(b.deadline) : ms(b.createdAt) - ms(a.createdAt)));
  const shown = list.slice(0, MAX);

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={t("Topshiriqlar")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-v2-section text-v2-text">{t("Topshiriqlar")}</h2>
        {list.length > 0 && (
          <Link href="/tasks" className="text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
            {list.length > MAX ? t("Hammasi · {n}", { n: list.length }) : t("Hammasi")}
          </Link>
        )}
      </div>

      {tasks === null ? (
        <div className="mt-4 space-y-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-7 rounded-v2-md bg-v2-skeleton" />
              <div className="h-3 flex-1 rounded bg-v2-skeleton" />
            </div>
          ))}
        </div>
      ) : tasks === undefined ? (
        <p className="mt-3 text-v2-small text-v2-text-3">{t("Topshiriqlarni olib bo'lmadi.")}</p>
      ) : shown.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-3">
          <p className="text-v2-small text-v2-text-2">{t("Bu xodimga topshiriq berilmagan.")}</p>
          {canAssign && (
            <Link href={`/tasks?new=1&employee=${employeeId}`} className="inline-flex items-center gap-1.5 text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
              <ListChecks className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Topshiriq berish")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-v2-border">
          {shown.map((k) => (
            <li key={k.id}>
              <Link href={`/tasks?open=${k.id}`} className="group flex items-start gap-3 py-2.5 focus-visible:outline-none">
                <span
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-small font-semibold tabular-nums text-v2-text"
                  title={t("Muhimlik: {n}", { n: k.priority })}
                >
                  {k.priority}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-small font-semibold text-v2-text underline-offset-2 group-hover:underline">{k.title}</span>
                  <span className="mt-0.5 block truncate text-v2-caption text-v2-text-2">{sub(k)}</span>
                </span>
                <span className={`mt-0.5 inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-v2-sm px-2 text-v2-caption font-medium ${TONE[STATUS_TONE[k.status]]}`}>
                  {t(V2_STATUS_LABEL[k.status])}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
