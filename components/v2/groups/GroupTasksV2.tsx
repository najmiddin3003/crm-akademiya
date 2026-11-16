"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, ExternalLink, Info, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import V2TimeField from "@/components/v2/form/V2TimeField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { ROW_TINT } from "@/components/v2/ui/table";
import { useGroups } from "@/hooks/useGroups";
import type { Group } from "@/lib/groups";
import type { GroupTask } from "@/lib/groupTasks";
import { daysBetween } from "@/lib/studentListsTypes";
import {
  B,
  EmptyRow,
  NoticeBar,
  PageHead,
  PageShell,
  SearchBox,
  SimplePager,
  SkeletonRows,
  SortHead,
  SummaryLine,
  TableCard,
  TH,
  downloadCsv,
  monthName,
  todayIso,
} from "@/components/v2/students/lists/listKit";

// YANGI VERSIYA — GURUH → BARCHA VAZIFALAR (31-qism, rasm «Barcha vazifalar», yorug'/qorong'i).
//
// Manba — `group_tasks` (guruh sahifasidagi Topshiriqlar bilan bitta ro'yxat), joriy filial guruhlari
// bo'yicha (guruhsiz vazifalar ham). Rasmdagi «Topshirdi 4/6», «Tekshirildi», «Tekshirilmagan» tabi va
// «Muddati o'tib topshirmaganlar» paneli uchun bazada ma'lumot yo'q — o'quvchi vazifani topshirgani
// yozilmaydi (SAVOLLAR 420). Shu sabab ular chizilmadi. Tur yorliqlari: «Vazifa» — «Uy vazifasi»,
// «Test» / «Imtihon» — «Test va imtihon» tabi. Eski sahifa — `?classic=1`.

type Tab = "all" | "hw" | "test";
type SortKey = "deadline" | "name" | "created";

const TEST_TYPES = new Set(["Test", "Imtihon"]);
const TYPE_LABEL: Record<string, string> = { Vazifa: "Uy vazifasi" };
const TYPE_TONE: Record<string, string> = {
  Vazifa: "bg-v2-brand-bg text-v2-brand-text",
  Test: "bg-v2-violet-bg text-v2-violet",
  Imtihon: "bg-v2-violet-bg text-v2-violet",
};

/** "30.05.2026 | 06:03" yoki "2026-05-30…" → "2026-05-30". */
function isoOf(v: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v || "");
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : "";
}
const dm = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "");
const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

function useTasks() {
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const apply = useCallback((j: { ok?: boolean; tasks?: GroupTask[] } | null) => {
    if (j?.ok) setTasks(j.tasks ?? []);
    setLoading(false);
  }, []);
  const reload = useCallback(
    () =>
      fetch("/api/group-tasks", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)
        .then(apply),
    [apply],
  );
  useEffect(() => {
    fetch("/api/group-tasks", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then(apply);
  }, [apply]);
  return { tasks, loading, reload };
}

export default function GroupTasksV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { tasks: all, loading: tLoading, reload } = useTasks();
  const { groups, loading: gLoading } = useGroups();
  const loading = tLoading || gLoading;
  const today = todayIso();
  const month = today.slice(0, 7);

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [given, setGiven] = useState<string>(month);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "deadline", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [edit, setEdit] = useState<GroupTask | "new" | null>(null);
  const [delFor, setDelFor] = useState<GroupTask | null>(null);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  // Joriy filial guruhlari (va guruhsiz) vazifalari.
  const tasks = useMemo(() => all.filter((x) => !x.groupId || groupById.has(x.groupId)), [all, groupById]);
  const months = useMemo(() => [...new Set(tasks.map((x) => isoOf(x.createdAt).slice(0, 7)).filter(Boolean))].sort().reverse(), [tasks]);

  const base = useMemo(
    () =>
      tasks.filter((x) => {
        if (q.trim() && !x.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
        if (group && String(x.groupId) !== group) return false;
        const g = groupById.get(x.groupId);
        if (teacher && (g?.teacher || x.teacher) !== teacher) return false;
        if (given && isoOf(x.createdAt).slice(0, 7) !== given) return false;
        return true;
      }),
    [tasks, q, group, teacher, given, groupById],
  );
  const counts = { all: base.length, hw: base.filter((x) => x.type === "Vazifa").length, test: base.filter((x) => TEST_TYPES.has(x.type)).length };
  const filtered = useMemo(() => {
    const list = tab === "all" ? base : base.filter((x) => (tab === "hw" ? x.type === "Vazifa" : TEST_TYPES.has(x.type)));
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c =
        sort.key === "name" ? a.name.localeCompare(b.name, "uz") : sort.key === "created" ? isoOf(a.createdAt).localeCompare(isoOf(b.createdAt)) : isoOf(a.deadline).localeCompare(isoOf(b.deadline));
      return c !== 0 ? c * sign : b.id - a.id;
    });
  }, [base, tab, sort]);

  const overdue = filtered.filter((x) => isoOf(x.deadline) && isoOf(x.deadline) < today).length;
  const thisWeek = filtered.filter((x) => {
    const d = isoOf(x.deadline);
    return d && d >= today && daysBetween(today, d) <= 7;
  }).length;
  const groupCount = new Set(filtered.map((x) => x.groupId).filter(Boolean)).size;
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const teacherOptions = useMemo(() => [...new Set(groups.map((g) => g.teacher).filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [groups]);
  const groupOptions = useMemo(() => groups.map((g) => ({ value: String(g.id), label: [g.name, g.course, g.teacher].filter(Boolean).join(" · ") })), [groups]);
  const COLS = 5;

  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "name" ? "asc" : "desc" }));
    setPage(1);
  };

  async function remove(x: GroupTask) {
    const res = await fetch(`/api/group-tasks/${x.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    setDelFor(null);
    if (!res?.ok) {
      showError(t(res?.error || "O'chirib bo'lmadi"));
      return;
    }
    showSuccess(t("Vazifa o'chirildi"));
    void reload();
  }

  function deadlineBadge(iso: string) {
    if (!iso) return null;
    const left = daysBetween(today, iso);
    if (left < 0) return <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("muddati o'tdi")}</span>;
    if (left === 0) return <span className="rounded-v2-sm bg-v2-warning-bg px-1.5 py-px text-v2-caption text-v2-warning">{t("bugun")}</span>;
    return <span className="rounded-v2-sm bg-v2-info-bg px-1.5 py-px text-v2-caption text-v2-info">{t("{n} kun qoldi", { n: left })}</span>;
  }

  function rowMenu(x: GroupTask): ActionMenuEntry[] {
    return [
      { key: "h", heading: x.name },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEdit(x) },
      ...(x.groupId ? [{ key: "g", label: t("Guruhni ochish"), icon: ExternalLink, href: `/groups/${x.groupId}` }] : []),
      { key: "d", divider: true },
      { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setDelFor(x) },
    ];
  }

  function exportCsv() {
    downloadCsv(
      "barcha-vazifalar.csv",
      ["ID", "Vazifa", "Turi", "Guruh", "O'qituvchi", "Berilgan", "Muddat", "Maks. ball", "Izoh"],
      filtered.map((x) => {
        const g = groupById.get(x.groupId);
        return [x.id, x.name, TYPE_LABEL[x.type] ?? x.type, g ? g.name : x.groupName, g?.teacher || x.teacher, dmy(isoOf(x.createdAt)), x.deadline, x.maxScore, x.note];
      }),
    );
  }

  const tabCls = (on: boolean) =>
    `-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-v2-body transition-colors ${on ? "border-v2-brand font-semibold text-v2-text" : "border-transparent text-v2-text-2 hover:text-v2-text"}`;

  return (
    <PageShell>
      <PageHead
        title={t("Barcha vazifalar")}
        subtitle={[branchName, t("{n} ta guruhga berilgan uy vazifalari va testlar", { n: groupCount }), given ? monthName(given) : ""].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtn}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Export")}
            </button>
            <button type="button" onClick={() => setEdit("new")} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Vazifa berish")}
            </button>
          </>
        }
      />

      <NoticeBar
        icon={Info}
        action={
          <Link href="/settings-gamification" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-v2-brand-text hover:underline">
            {t("Tanga qoidalari")}
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        }
      >
        {t("Guruh sahifasidagi «Topshiriqlar» bilan bitta ro'yxat. Uy vazifasi bajarilgani darsda «Tanga berish»da belgilanadi.")}
      </NoticeBar>

      <div className="flex border-b border-v2-border" role="tablist">
        {(
          [
            ["all", t("Hammasi"), counts.all],
            ["hw", t("Uy vazifasi"), counts.hw],
            ["test", t("Test va imtihon"), counts.test],
          ] as const
        ).map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={tabCls(tab === k)}>
            {label}
            <span className="text-v2-caption tabular-nums text-v2-text-3">{n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Vazifa nomi")} />
        <V2Select variant="chip" label={t("Guruh")} value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={groupOptions} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={teacher} onChange={(v) => { setTeacher(v); setPage(1); }} options={teacherOptions} />
        <V2Select
          variant="chip"
          label={t("Berilgan")}
          value={given}
          onChange={(v) => { setGiven(v); setPage(1); }}
          searchable={false}
          options={(months.includes(month) ? months : [month, ...months]).map((m) => ({ value: m, label: `${monthName(m)} ${m.slice(0, 4)}` }))}
        />
      </div>

      <SummaryLine
        items={[
          <span key="n"><B>{filtered.length}</B> {t("ta vazifa")}</span>,
          <span key="o">{t("Muddati o'tgan")} <B>{overdue}</B></span>,
          <span key="w">{t("7 kun ichida muddati")} <B>{thisWeek}</B></span>,
        ]}
      />

      <TableCard footer={<SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}>
        <thead>
          <tr>
            <th className={`${TH} pl-4`}><SortHead label={t("Vazifa")} k="name" sort={sort} onSort={onSort} /></th>
            <th className={TH}>{t("Guruh")}</th>
            <th className={TH}><SortHead label={t("Muddat")} k="deadline" sort={sort} onSort={onSort} /></th>
            <th className={`${TH} text-right`}>{t("Maks. ball")}</th>
            <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={COLS} />}
          {!loading && slice.length === 0 && (
            <EmptyRow
              cols={COLS}
              title={tasks.length === 0 ? t("Hozircha vazifa yo'q") : t("Mos vazifa topilmadi")}
              hint={tasks.length === 0 ? t("Guruhga uy vazifasi yoki test bering — shu yerda chiqadi.") : t("Oy, guruh yoki qidiruvni o'zgartirib ko'ring.")}
              action={
                <button type="button" onClick={() => setEdit("new")} className={`${primaryBtn} mt-2`}>
                  <Plus className="size-4" strokeWidth={2} aria-hidden />
                  {t("Vazifa berish")}
                </button>
              }
            />
          )}
          {!loading &&
            slice.map((x) => {
              const g = groupById.get(x.groupId);
              const dl = isoOf(x.deadline);
              return (
                <tr key={x.id} className={`group border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2.5">
                    <span className="block max-w-[340px] truncate font-semibold text-v2-text" title={x.note || x.name}>{x.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-v2-small text-v2-text-3">
                      <span className={`rounded-v2-sm px-1.5 py-px text-v2-caption ${TYPE_TONE[x.type] ?? "bg-v2-surface-2 text-v2-text-2"}`}>{t(TYPE_LABEL[x.type] ?? x.type)}</span>
                      {isoOf(x.createdAt) && <span>{t("berilgan")} {dm(isoOf(x.createdAt))}</span>}
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5">
                    {g || x.groupName ? (
                      <div className="min-w-[150px]">
                        <span className="flex items-center gap-1.5">
                          <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g?.course)]}`} aria-hidden />
                          <span className="truncate text-v2-text">{g ? [g.name, /^\d+$/.test(g.name) ? g.course : ""].filter(Boolean).join(" · ") : x.groupName}</span>
                        </span>
                        <span className="block truncate pl-3.5 text-v2-small text-v2-text-3">{g?.teacher || x.teacher || t("o'qituvchisiz")}</span>
                      </div>
                    ) : (
                      <span className="text-v2-text-3">{t("guruhsiz")}</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">
                    {dl ? (
                      <>
                        <span className="block tabular-nums text-v2-text">{dmy(dl)}</span>
                        <span className="mt-0.5 inline-block">{deadlineBadge(dl)}</span>
                      </>
                    ) : (
                      <span className="text-v2-text-3">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums text-v2-text">{x.maxScore || <span className="text-v2-text-3">—</span>}</td>
                  <td className="py-2.5 pl-1 pr-3 text-right">
                    <ActionMenu items={rowMenu(x)} label={t("{name} — amallar", { name: x.name })}>
                      {(trigger) => (
                        <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: x.name })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </ActionMenu>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </TableCard>

      {edit && <TaskDialogV2 task={edit === "new" ? null : edit} groups={groups} onClose={() => setEdit(null)} onSaved={() => void reload()} />}
      {delFor && (
        <V2Confirm
          title={t("Vazifa o'chirilsinmi?")}
          body={t("«{name}» butunlay o'chiriladi.", { name: delFor.name })}
          confirmLabel={t("O'chirish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setDelFor(null)}
          onConfirm={() => void remove(delFor)}
        />
      )}
    </PageShell>
  );
}

/** «Vazifa berish» / tahrirlash (rasm yo'q, «Formalar» qoidasi). */
function TaskDialogV2({ task, groups, onClose, onSaved }: { task: GroupTask | null; groups: Group[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const initDeadline = task ? isoOf(task.deadline) : "";
  const initTime = task && /\|\s*(\d{2}:\d{2})/.exec(task.deadline)?.[1];
  const [groupId, setGroupId] = useState(task ? String(task.groupId || "") : "");
  const [type, setType] = useState(task?.type || "Vazifa");
  const [name, setName] = useState(task?.name ?? "");
  const [date, setDate] = useState(initDeadline);
  const [time, setTime] = useState(initTime || "18:00");
  const [maxScore, setMaxScore] = useState(task ? String(task.maxScore || "") : "10");
  const [note, setNote] = useState(task?.note ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = !task ? Boolean(name || groupId || date) : name !== task.name || date !== initDeadline || note !== task.note || type !== task.type || maxScore !== String(task.maxScore || "");

  async function save(close: () => void) {
    if (!name.trim()) {
      showError(t("Vazifa nomini kiriting"));
      return;
    }
    if (!task && !groupId) {
      showError(t("Guruhni tanlang"));
      return;
    }
    const g = groups.find((x) => String(x.id) === groupId);
    const deadline = date ? `${date}T${time || "00:00"}` : "";
    setSaving(true);
    const res = await fetch(task ? `/api/group-tasks/${task.id}` : "/api/group-tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        task
          ? { type, name: name.trim(), deadline, maxScore, note }
          : { groupId: Number(groupId), groupName: g?.name ?? "", teacher: g?.teacher ?? "", type, name: name.trim(), deadline, maxScore, note },
      ),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(t(res?.error || "Saqlab bo'lmadi"));
      return;
    }
    showSuccess(task ? t("Vazifa saqlandi") : t("Vazifa berildi"));
    onSaved();
    close();
  }

  return (
    <V2Dialog
      variant="right"
      title={task ? t("Vazifani tahrirlash") : t("Vazifa berish")}
      subtitle={task ? task.name : t("Guruhga uy vazifasi yoki test")}
      onClose={onClose}
      saving={saving}
      dirty={dirty}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>{task ? t("Saqlash") : t("Vazifa berish")}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {!task && (
          <Field label={t("Guruh")}>
            <V2Select
              label={t("Guruh")}
              placeholder={t("Tanlang")}
              value={groupId}
              onChange={setGroupId}
              options={groups.map((g) => ({ value: String(g.id), label: [g.name, g.course, g.teacher].filter(Boolean).join(" · ") }))}
            />
          </Field>
        )}
        <Field label={t("Turi")}>
          <Segmented
            label={t("Turi")}
            value={type}
            onChange={setType}
            options={[
              { value: "Vazifa", label: t("Uy vazifasi") },
              { value: "Test", label: t("Test") },
              { value: "Imtihon", label: t("Imtihon") },
              { value: "Loyiha", label: t("Loyiha") },
            ]}
          />
        </Field>
        <Field label={t("Vazifa nomi")} htmlFor="task-name">
          <TextInput id="task-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Masalan: Unit 2 — 20 ta yangi so'z")} />
        </Field>
        <div className="grid grid-cols-[1fr_120px_110px] gap-3">
          <Field label={t("Muddat")} htmlFor="task-date">
            <IsoDateField id="task-date" value={date} onChange={setDate} />
          </Field>
          <Field label={t("Vaqti")} htmlFor="task-time">
            <V2TimeField id="task-time" value={time} onChange={setTime} />
          </Field>
          <Field label={t("Maks. ball")} htmlFor="task-score">
            <TextInput id="task-score" inputMode="numeric" value={maxScore} onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <Field label={t("Izoh")} optional>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
      </div>
    </V2Dialog>
  );
}
