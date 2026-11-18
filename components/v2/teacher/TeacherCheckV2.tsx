"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Coins, Eye, FileText, Info, Loader2, Lock, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { fieldCls } from "@/components/v2/form/fields";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, FanPill, teacherPost, teacherQs } from "./teacherBits";

// YANGI VERSIYA — O'QITUVCHI · UY VAZIFALARINI TEKSHIRISH (45-qism, rasmlar «uy vazifasini tekshirish: ✓/✗, ball, tanga»,
// telefonda «vazifalarni tekshirish», «ishni baholash»). Chapda vazifalar (oxirgi 45 kun) — ochilgani o'quvchilar
// bilan: kutayotganlar, baholanganlar, «Darsda yo'q · hisobga olinmaydi». O'ngda baholash: Bajarildi / Bajarilmadi,
// ball (0…maks), izoh; «Saqlash va keyingisi». Tanga — o'quvchi bugun shu guruhda darsda bo'lsa darhol (gamifikatsiya
// «Uy vazifasi»), bo'lmasa keyingi darsda dars oynasidan o'zi yoziladi.
// O'quvchi ishni kabinetdan yuborishi (rasm, audio) hali yo'q — ish rasmi o'rnida izoh.

interface Row {
  pupilId: number;
  name: string;
  absent: string | null;
  check: { done: boolean; score: number | null; note: string; at: string; coin: number | null } | null;
}
interface Task {
  id: number;
  groupId: number;
  group: string;
  level: string;
  name: string;
  note: string;
  maxScore: number;
  createdAt: string;
  deadline: string;
  deadlineIso: string | null;
  rows: Row[];
}
interface Board {
  ok: true;
  today: string;
  groups: { id: number; title: string; level: string }[];
  tasks: Task[];
}
type Filter = "wait" | "done" | "all";

const pending = (t: Task) => t.rows.filter((r) => !r.check && !r.absent);

export default function TeacherCheckV2({ teacher, taskId }: { teacher?: string; taskId?: number }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data, error, reload } = useReportData<Board>(`/api/teacher?view=checks${teacherQs(teacher)}`);
  const [filter, setFilter] = useState<Filter>("wait");
  const [group, setGroup] = useState<string>("");
  const [openTask, setOpenTask] = useState<number | null>(taskId ?? null);
  const [sel, setSel] = useState<{ taskId: number; pupilId: number } | null>(null);
  const [showDone, setShowDone] = useState(false);

  const tasks = useMemo(() => {
    const all = data?.tasks ?? [];
    return all
      .filter((x) => !group || String(x.groupId) === group)
      .filter((x) => (filter === "wait" ? pending(x).length > 0 : filter === "done" ? x.rows.some((r) => r.check) : true));
  }, [data, group, filter]);

  // Birinchi ochilganda — `taskId` yoki birinchi kutayotgan vazifa va undagi birinchi ish.
  const firstTask = openTask ?? tasks[0]?.id ?? null;
  const cur = tasks.find((x) => x.id === firstTask) ?? null;
  const selected = sel && cur && sel.taskId === cur.id ? sel : cur ? (pending(cur)[0] ? { taskId: cur.id, pupilId: pending(cur)[0].pupilId } : null) : null;
  const row = cur && selected ? (cur.rows.find((r) => r.pupilId === selected.pupilId) ?? null) : null;

  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Ma'lumot yuklanmadi")}</NoticeBar>
      </div>
    );
  if (!data)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );

  const waitN = data.tasks.reduce((a, x) => a + pending(x).length, 0);
  const doneN = data.tasks.reduce((a, x) => a + x.rows.filter((r) => r.check).length, 0);
  const goNext = () => {
    if (!cur || !selected) return;
    const list = pending(cur).filter((r) => r.pupilId !== selected.pupilId);
    if (list[0]) setSel({ taskId: cur.id, pupilId: list[0].pupilId });
    else setSel(null);
  };
  const order = cur ? [...pending(cur), ...cur.rows.filter((r) => r.check)] : [];
  const idx = row ? order.findIndex((r) => r.pupilId === row.pupilId) : -1;

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {teacher ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name}", { name: teacher })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Uy vazifalarini tekshirish")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[t("Guruhlarim"), t("{n} ta guruh", { n: data.groups.length }), t("{n} ta ish kutmoqda", { n: waitN })].join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
            {(
              [
                ["wait", t("Kutmoqda · {n}", { n: waitN })],
                ["done", t("Tekshirilgan · {n}", { n: doneN })],
                ["all", t("Hammasi")],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`h-8 rounded-v2-sm px-3 text-v2-small ${filter === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="w-48">
            <V2Select value={group} onChange={setGroup} label={t("Guruh")} variant="value" placeholder={t("Barcha guruhlar")} emptyLabel={t("Barcha guruhlar")} options={data.groups.map((g) => ({ value: String(g.id), label: g.title }))} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <Card className="!p-0 sm:!p-0">
          {tasks.length === 0 ? (
            <p className="p-5 text-v2-small text-v2-text-3">{filter === "wait" ? t("Kutayotgan ish yo'q — hammasi tekshirilgan.") : t("Vazifa yo'q.")}</p>
          ) : (
            tasks.map((x) => {
              const open = x.id === firstTask;
              const wait = pending(x);
              const checked = x.rows.filter((r) => r.check);
              const absent = x.rows.filter((r) => r.absent && !r.check);
              return (
                <div key={x.id} className="border-b border-v2-border last:border-0">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenTask(open ? -1 : x.id);
                      setSel(null);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-v2-surface-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                      <FileText className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-v2-body font-semibold text-v2-text">{x.name}</span>
                        <FanPill course={x.group}>{x.level || x.group}</FanPill>
                      </span>
                      <span className="block text-v2-caption text-v2-text-3">{[x.note, x.createdAt ? t("berilgan {d}", { d: x.createdAt.split("|")[0].trim() }) : null, x.deadline ? t("muddat {d}", { d: x.deadline }) : null].filter(Boolean).join(" · ")}</span>
                      {open ? (
                        <>
                          <span className="mt-2 flex justify-between text-v2-caption text-v2-text-2">
                            <span>
                              {t("Baholandi")} <b className="text-v2-text">{checked.length} / {x.rows.length - absent.length}</b>
                            </span>
                            <span>
                              ✓ {checked.filter((r) => r.check!.done).length} · × {checked.filter((r) => !r.check!.done).length}
                            </span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-v2-track">
                            <span className="block h-full rounded-full bg-v2-success" style={{ width: `${(checked.length / Math.max(1, x.rows.length - absent.length)) * 100}%` }} />
                          </span>
                          {wait.length ? (
                            <span className="mt-1.5 flex items-center gap-1 text-v2-caption text-v2-warning">
                              <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
                              {t("{n} ta ish qoldi — keyin yangi vazifa ochiladi", { n: wait.length })}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </span>
                    {!open ? (
                      <span className="shrink-0 text-v2-small text-v2-text-2">
                        <b className="text-v2-text">{wait.length}</b> {t("ta")}
                        <ChevronDown className="ml-1 inline size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    ) : null}
                  </button>
                  {open ? (
                    <ul className="border-t border-v2-border">
                      {wait.map((r) => (
                        <PupilLine key={r.pupilId} r={r} active={row?.pupilId === r.pupilId} onClick={() => setSel({ taskId: x.id, pupilId: r.pupilId })} max={x.maxScore} />
                      ))}
                      {(showDone ? checked : checked.slice(0, 3)).map((r) => (
                        <PupilLine key={r.pupilId} r={r} active={row?.pupilId === r.pupilId} onClick={() => setSel({ taskId: x.id, pupilId: r.pupilId })} max={x.maxScore} />
                      ))}
                      {checked.length > 3 && !showDone ? (
                        <li>
                          <button type="button" onClick={() => setShowDone(true)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-v2-surface-2">
                            <span>
                              <span className="block text-v2-small font-semibold text-v2-text">{t("Yana {n} ta baholangan", { n: checked.length - 3 })}</span>
                              <span className="block text-v2-caption text-v2-text-3">{checked.slice(3, 7).map((r) => `${r.name.split(" ")[0]} ${r.check!.score ?? "×"}`).join(" · ")}</span>
                            </span>
                            <ChevronDown className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                          </button>
                        </li>
                      ) : null}
                      {absent.length ? (
                        <li className="bg-v2-surface-2 px-4 py-3">
                          <div className="text-v2-small font-semibold text-v2-text-2">{t("Darsda yo'q · hisobga olinmaydi")}</div>
                          <div className="text-v2-caption text-v2-text-3">{absent.map((r) => `${r.name} — ${r.absent === "sababli" ? t("sababli") : t("kelmadi")}`).join(" · ")}</div>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              );
            })
          )}
        </Card>

        {cur && row ? (
          <GradePanel
            key={`${cur.id}:${row.pupilId}`}
            task={cur}
            row={row}
            teacher={teacher}
            onPrev={idx > 0 ? () => setSel({ taskId: cur.id, pupilId: order[idx - 1].pupilId }) : undefined}
            onNext={idx >= 0 && idx < order.length - 1 ? () => setSel({ taskId: cur.id, pupilId: order[idx + 1].pupilId }) : undefined}
            onSaved={(next) => {
              reload();
              if (next) goNext();
            }}
            fmtDay={fmt.dayMonth}
          />
        ) : (
          <Card>
            <p className="py-10 text-center text-v2-small text-v2-text-3">{t("Chapdan o'quvchini tanlang.")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function PupilLine({ r, active, onClick, max }: { r: Row; active: boolean; onClick: () => void; max: number }) {
  const { t } = useT();
  return (
    <li>
      <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-l-[3px] px-4 py-3 text-left ${active ? "border-v2-brand bg-v2-brand-bg" : "border-transparent hover:bg-v2-surface-2"}`}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v2-info-bg text-[0.6875rem] font-semibold text-v2-info">{initialsOf(r.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-v2-body font-semibold text-v2-text">{r.name}</span>
          <span className="block text-v2-caption text-v2-text-3">{r.check ? t("baholandi {d}", { d: r.check.at.slice(11, 16) }) : t("kutmoqda")}</span>
        </span>
        {r.check ? (
          r.check.done ? (
            <span className="shrink-0 text-v2-small font-semibold text-v2-success">
              ✓ {r.check.score ?? ""} / {max}
            </span>
          ) : (
            <span className="shrink-0 text-v2-small font-semibold text-v2-danger">× {r.check.coin ?? ""}</span>
          )
        ) : active ? (
          <span className="shrink-0 rounded-v2-sm bg-v2-brand px-2 py-0.5 text-v2-caption text-v2-on-brand">{t("Ochiq")}</span>
        ) : null}
      </button>
    </li>
  );
}

function GradePanel({
  task,
  row,
  teacher,
  onPrev,
  onNext,
  onSaved,
  fmtDay,
}: {
  task: Task;
  row: Row;
  teacher?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onSaved: (next: boolean) => void;
  fmtDay: (iso: string) => string;
}) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const [done, setDone] = useState<boolean | null>(row.check ? row.check.done : null);
  const [score, setScore] = useState<number | null>(row.check?.score ?? null);
  const [note, setNote] = useState(row.check?.note ?? "");
  const [saving, setSaving] = useState(false);
  const left = pending(task).filter((r) => r.pupilId !== row.pupilId).length;

  const save = async (next: boolean) => {
    if (done === null) return;
    setSaving(true);
    const r = await teacherPost<{ coin: { amount: number } | { skipped: string } | null }>({ action: "check", taskId: task.id, pupilId: row.pupilId, done, score: done ? score : 0, note }, teacher);
    setSaving(false);
    if (!r.ok) return showError(r.error);
    const c = r.coin;
    showSuccess(c && "amount" in c ? t("Saqlandi · tanga {n}", { n: c.amount > 0 ? `+${c.amount}` : c.amount }) : c && "skipped" in c ? `${t("Saqlandi")} · ${t(c.skipped)}` : t("Saqlandi"));
    onSaved(next);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v2-info-bg text-v2-small font-semibold text-v2-info">{initialsOf(row.name)}</span>
          <div className="min-w-0">
            <div className="text-v2-section text-v2-text">{row.name}</div>
            <div className="text-v2-caption text-v2-text-3">{[task.group, task.name].join(" · ")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {task.deadlineIso ? <span className="rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-caption text-v2-text-2">{t("Muddat · {d}", { d: fmtDay(task.deadlineIso) })}</span> : null}
          <button type="button" disabled={!onPrev} onClick={onPrev} aria-label={t("Oldingi")} className="grid size-8 place-items-center rounded-v2-md border border-v2-border-strong text-v2-text-2 disabled:opacity-40">
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" disabled={!onNext} onClick={onNext} aria-label={t("Keyingi")} className="grid size-8 place-items-center rounded-v2-md border border-v2-border-strong text-v2-text-2 disabled:opacity-40">
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small text-v2-text">
        <FileText className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <span>
          <b className="font-semibold">{t("Topshiriq:")}</b> {task.note || task.name} · {t("Maks. {n} ball", { n: task.maxScore })}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-h-48 flex-col items-center justify-center rounded-v2-md border border-dashed border-v2-border-strong bg-v2-surface-2 p-6 text-center">
          <Info className="size-6 text-v2-text-3" strokeWidth={1.5} aria-hidden />
          <p className="mt-2 max-w-xs text-v2-small text-v2-text-2">{t("O'quvchi ishini kabinetdan yuborishi (rasm, audio) tez orada. Hozircha daftar yoki darsdagi tekshiruv bo'yicha baholang.")}</p>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Natija")}</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDone(true)} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border text-v2-small font-semibold ${done === true ? "border-v2-success bg-v2-success-bg text-v2-success" : "border-v2-border-strong text-v2-text"}`}>
                <Check className="size-4" strokeWidth={2} aria-hidden />
                {t("Bajarildi")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDone(false);
                  setScore(null);
                }}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border text-v2-small font-semibold ${done === false ? "border-v2-danger bg-v2-danger-bg text-v2-danger" : "border-v2-border-strong text-v2-text"}`}
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
                {t("Bajarilmadi")}
              </button>
            </div>
          </div>
          {done !== false ? (
            <div>
              <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Ball · {n} dan", { n: task.maxScore })}</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(task.maxScore, 20) + 1 }, (_, i) => i).map((n) => (
                  <button key={n} type="button" onClick={() => {
                      setScore(n);
                      if (done === null) setDone(true);
                    }} className={`size-10 rounded-v2-md border text-v2-small font-semibold tabular-nums ${score === n ? "border-v2-brand bg-v2-brand text-v2-on-brand" : "border-v2-border-strong text-v2-text hover:bg-v2-surface-2"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-v2-small font-semibold text-v2-text">{t("Izoh o'quvchiga")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={t("Masalan: imloga e'tibor bering")} className={fieldCls(undefined, "h-auto py-2")} />
          </label>
          <p className="flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
            <Coins className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
            {t("Tanga avtomatik — vazifa ✓ yoki × bo'yicha (Sozlamalar → Tanga tizimi). O'quvchi bugun darsda bo'lsa darhol, bo'lmasa keyingi darsda yoziladi.")}
          </p>
          {left === 0 && !row.check ? (
            <p className="flex items-start gap-2 rounded-v2-md bg-v2-success-bg px-3 py-2.5 text-v2-small text-v2-success">
              <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Bu vazifadagi oxirgi ish. Saqlasangiz {g}ga yangi vazifa berish ochiladi.", { g: task.level || task.group })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving || done === null} onClick={() => void save(false)} className={`${primaryBtn} disabled:opacity-50`}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
              {t("Saqlash")}
            </button>
            {left > 0 ? (
              <button type="button" disabled={saving || done === null} onClick={() => void save(true)} className={`${secondaryBtn} disabled:opacity-50`}>
                {t("Saqlash va keyingisi")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
