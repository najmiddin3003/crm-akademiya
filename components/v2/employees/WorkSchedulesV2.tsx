"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, Clock, Info, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2TimeField from "@/components/v2/form/V2TimeField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { HrEmployee } from "@/lib/hrEmployees";
import { dailyMinutes, toMin, weeklyHours, type WorkSchedule, type WorkScheduleKind } from "@/lib/workSchedules";
import { Avatar, NoticeBar, PageHead, PageShell, SearchBox, TH } from "@/components/v2/students/lists/listKit";

// YANGI VERSIYA — BOSHQARUV → ISH JADVALLARI (31-qism, rasm «Ish jadvallari», yorug'/qorong'i).
//
// Jadval — xodimlarga biriktiriladigan ish rejimi shabloni (`work_schedules`; xodimda
// `branchAssignments[].scheduleId`). Rasmdagi vaqt, tanaffus, ish kunlari, tur (belgilangan soat /
// dars jadvali bo'yicha / navbatchilik) — yangi maydonlar (lib/workSchedules.ts), eski yozuvlarda bo'sh.
// MUHIM: kechikish hozir jadvaldan EMAS — o'qituvchi birinchi darsiga, qolganlar xodim kartasidagi ish
// vaqtiga qarab o'lchanadi (lib/attendanceCheck.ts); jadval vaqtini xodimlarga ko'chirish — SAVOLLAR 423.
// Pastda tanlangan jadval: haftalik chiziq va amaldagi qoidalar. Eski sahifa — `?classic=1`.

const DAYS = ["Du", "Se", "Chor", "Pa", "Ju", "Sha", "Ya"];
const DOTS = ["bg-v2-brand", "bg-v2-info", "bg-v2-violet", "bg-v2-success", "bg-v2-warning", "bg-v2-danger"];
const KIND_LABEL: Record<WorkScheduleKind, string> = { fixed: "Belgilangan soat", lessons: "Dars jadvali bo'yicha", shift: "Navbatchilik" };
const ROLE_LABEL: Record<string, string> = { teacher: "O'qituvchi", moderator: "Moderator", admin: "Admin", staff: "Xodim" };

const kindOf = (s: WorkSchedule): WorkScheduleKind => s.kind ?? "fixed";
const tr = (a?: string, b?: string) => (a && b ? `${a}–${b}` : "");

function useData() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    () =>
      Promise.all([
        fetch("/api/work-schedules", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/hr-employees", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]),
    [],
  );
  const apply = useCallback(([s, e]: [{ ok?: boolean; schedules?: WorkSchedule[] } | null, { ok?: boolean; employees?: HrEmployee[] } | null]) => {
    if (s?.ok) setSchedules(s.schedules ?? []);
    if (e?.ok) setEmployees(e.employees ?? []);
    setLoading(false);
  }, []);
  const reload = useCallback(() => load().then(apply), [load, apply]);
  useEffect(() => {
    load().then(apply);
  }, [load, apply]);
  return { schedules, employees, loading, reload };
}

export default function WorkSchedulesV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { schedules, employees, loading, reload } = useData();

  const [tab, setTab] = useState<"active" | "archive">("active");
  const [q, setQ] = useState("");
  const [branchF, setBranchF] = useState("");
  const [role, setRole] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [edit, setEdit] = useState<WorkSchedule | "new" | null>(null);
  const [delFor, setDelFor] = useState<WorkSchedule | null>(null);
  const [showPeople, setShowPeople] = useState(false);

  const activeEmps = useMemo(() => employees.filter((e) => !e.archReason), [employees]);
  /** Jadval → xodimlar (filial biriktiruvlari bo'yicha) va qaysi filiallarda. */
  const people = useMemo(() => {
    const m = new Map<number, { emp: HrEmployee; branches: Set<number> }[]>();
    for (const e of activeEmps) {
      for (const a of e.branchAssignments ?? []) {
        if (!a.scheduleId) continue;
        if (branchF && String(a.branchId) !== branchF) continue;
        const list = m.get(a.scheduleId) ?? [];
        const hit = list.find((x) => x.emp.id === e.id);
        if (hit) hit.branches.add(a.branchId);
        else list.push({ emp: e, branches: new Set([a.branchId]) });
        m.set(a.scheduleId, list);
      }
    }
    return m;
  }, [activeEmps, branchF]);

  const list = useMemo(
    () =>
      schedules.filter((s) => {
        if ((tab === "active") !== (s.active !== false)) return false;
        const ppl = people.get(s.id) ?? [];
        if (q.trim() && !`${s.name} ${s.description ?? ""} ${ppl.map((p) => p.emp.name).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
        if (role && !ppl.some((p) => p.emp.turi === role)) return false;
        return true;
      }),
    [schedules, tab, q, role, people],
  );
  const counts = { active: schedules.filter((s) => s.active !== false).length, archive: schedules.filter((s) => s.active === false).length };
  const sel = list.find((s) => s.id === selId) ?? list[0] ?? null;
  const assigned = new Set([...people.values()].flat().map((p) => p.emp.id)).size;
  const dotOf = (s: WorkSchedule) => DOTS[(schedules.findIndex((x) => x.id === s.id) + DOTS.length) % DOTS.length];
  const branchName = (id: number) => branch.branches.find((b) => b.id === id)?.name ?? `#${id}`;

  async function patch(s: WorkSchedule, body: Record<string, unknown>, msg: string) {
    const res = await fetch(`/api/work-schedules/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(msg);
    void reload();
  }
  async function remove(s: WorkSchedule) {
    const res = await fetch(`/api/work-schedules/${s.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    setDelFor(null);
    if (!res?.ok) return showError(t(res?.error || "O'chirib bo'lmadi"));
    showSuccess(t("Jadval o'chirildi"));
    void reload();
  }

  function timeCell(s: WorkSchedule) {
    const k = kindOf(s);
    if (k === "lessons")
      return (
        <>
          <span className="block font-semibold text-v2-text">{t("birinchi darsdan {n} daq. oldin", { n: s.leadMinutes ?? 15 })}</span>
          <span className="block text-v2-small text-v2-text-3">{t("oxirgi dars tugaguncha")}</span>
        </>
      );
    if (!s.start || !s.end) return <span className="text-v2-text-3">{t("vaqt kiritilmagan")}</span>;
    if (k === "shift")
      return (
        <>
          <span className="block font-semibold text-v2-text">{t("{a} dan {b} gacha", { a: s.start, b: s.end })}</span>
          <span className="block text-v2-small text-v2-text-3">{t("navbat bilan")}</span>
        </>
      );
    const br = tr(s.breakStart, s.breakEnd);
    return (
      <>
        <span className="block font-semibold tabular-nums text-v2-text">{tr(s.start, s.end)}</span>
        <span className="block text-v2-small text-v2-text-3">{br ? `${t("tanaffus")} ${br}` : t("tanaffussiz")}</span>
      </>
    );
  }

  function daysCell(s: WorkSchedule) {
    const k = kindOf(s);
    if (k === "lessons") return <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text-2">{t("guruh kunlari")}</span>;
    if (k === "shift") return <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text-2">{t("har {n}-kunda", { n: (s.shiftOn ?? 1) + (s.shiftOff ?? 0) })}</span>;
    const on = new Set(s.days ?? []);
    return (
      <span className="inline-flex gap-1">
        {DAYS.map((d, i) => (
          <span key={d} className={`rounded-v2-sm px-1 py-0.5 text-[11px] font-medium ${on.has(i + 1) ? "bg-v2-brand-bg text-v2-brand-text" : "bg-v2-surface-2 text-v2-text-3"}`}>{t(d)}</span>
        ))}
      </span>
    );
  }

  function hoursCell(s: WorkSchedule) {
    const h = weeklyHours(s);
    if (kindOf(s) === "lessons") return <span className="text-v2-text-2">{t("darsga qarab")}</span>;
    if (h === null) return <span className="text-v2-text-3">—</span>;
    return <span className="font-semibold tabular-nums text-v2-text">{kindOf(s) === "shift" ? "≈ " : ""}{t("{n} soat", { n: h })}</span>;
  }

  function peopleCell(s: WorkSchedule) {
    const ppl = people.get(s.id) ?? [];
    if (!ppl.length) return <span className="text-v2-text-3">{t("xodim yo'q")}</span>;
    const br = new Set(ppl.flatMap((p) => [...p.branches]));
    return (
      <span className="flex items-center gap-2">
        <span className="flex -space-x-2">
          {ppl.slice(0, 3).map((p) => (
            <span key={p.emp.id} className="rounded-v2-full ring-2 ring-v2-surface"><Avatar name={p.emp.name} /></span>
          ))}
        </span>
        <span className="whitespace-nowrap">
          <b className="block text-v2-small font-semibold text-v2-text">{t("{n} xodim", { n: ppl.length })}</b>
          <span className="block text-v2-caption text-v2-text-3">{br.size > 1 ? t("{n} filialda", { n: br.size }) : t("{name}da", { name: branchName([...br][0]) })}</span>
        </span>
      </span>
    );
  }

  function rowMenu(s: WorkSchedule): ActionMenuEntry[] {
    return [
      { key: "h", heading: s.name },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEdit(s) },
      s.active !== false
        ? { key: "arc", label: t("Arxivga olish"), icon: Archive, onSelect: () => void patch(s, { active: false }, t("Arxivga olindi")) }
        : { key: "res", label: t("Faollashtirish"), icon: RotateCcw, onSelect: () => void patch(s, { active: true }, t("Faollashtirildi")) },
      { key: "d", divider: true },
      {
        key: "del",
        label: t("O'chirish"),
        icon: Trash2,
        danger: true,
        disabled: (people.get(s.id) ?? []).length > 0,
        title: (people.get(s.id) ?? []).length > 0 ? t("Jadvalga xodim biriktirilgan") : undefined,
        onSelect: () => setDelFor(s),
      },
    ];
  }

  const segBtn = (on: boolean) => `inline-flex h-7 items-center gap-1.5 rounded-v2-sm px-2.5 text-v2-small font-medium transition-colors ${on ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"}`;

  return (
    <PageShell>
      <PageHead
        title={t("Ish jadvallari")}
        subtitle={[t("Barcha filiallar uchun umumiy"), t("{n} ta jadval", { n: schedules.length }), t("{n} xodim", { n: assigned })].join(" · ")}
        actions={
          <button type="button" onClick={() => setEdit("new")} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Jadval qo'shish")}
          </button>
        }
      />

      <NoticeBar
        icon={Info}
        action={
          <Link href="/vaqtinchalik" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-v2-brand-text hover:underline">
            {t("Ish vaqtini belgilash")}
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        }
      >
        {t("Jadval — xodimga biriktiriladigan shablon. Kechikish o'qituvchida birinchi darsiga, boshqa xodimda kartasidagi ish vaqtiga qarab o'lchanadi.")}
      </NoticeBar>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-v2-md bg-v2-surface-2 p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "active"} onClick={() => setTab("active")} className={segBtn(tab === "active")}>
            {t("Faol")} <span className="tabular-nums text-v2-text-3">{counts.active}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "archive"} onClick={() => setTab("archive")} className={segBtn(tab === "archive")}>
            {t("Arxiv")} <span className="tabular-nums text-v2-text-3">{counts.archive}</span>
          </button>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder={t("Jadval yoki xodim")} width={220} />
        <V2Select variant="chip" label={t("Filial")} value={branchF} onChange={setBranchF} searchable={false} options={branch.branches.map((b) => ({ value: String(b.id), label: b.name }))} />
        <V2Select variant="chip" label={t("Rol")} value={role} onChange={setRole} searchable={false} options={Object.entries(ROLE_LABEL).map(([v, l]) => ({ value: v, label: t(l) }))} />
      </div>

      <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} pl-4`}>{t("Jadval")}</th>
                <th className={TH}>{t("Ish vaqti")}</th>
                <th className={TH}>{t("Ish kunlari")}</th>
                <th className={`${TH} text-right`}>{t("Haftada")}</th>
                <th className={TH}>{t("Xodimlar")}</th>
                <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-b border-v2-border" aria-hidden>
                    <td colSpan={6} className="px-4 py-4"><div className="h-3 rounded bg-v2-skeleton" style={{ width: `${85 - i * 10}%` }} /></td>
                  </tr>
                ))}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6">
                    <div className="rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center text-v2-small text-v2-text-2">
                      {schedules.length === 0 ? t("Hali ish jadvali yo'q — «Jadval qo'shish» bilan boshlang.") : t("Mos jadval topilmadi")}
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                list.map((s) => {
                  const on = sel?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a")) return;
                        setSelId(s.id);
                      }}
                      aria-selected={on || undefined}
                      className={`cursor-pointer border-b border-v2-border last:border-b-0 ${on ? "bg-v2-brand-bg shadow-[inset_3px_0_0_var(--v2-brand)]" : "hover:bg-v2-hover"}`}
                    >
                      <td className="py-2.5 pl-4 pr-2.5">
                        <span className="flex items-center gap-2">
                          <span className={`size-2 shrink-0 rounded-full ${dotOf(s)}`} aria-hidden />
                          <span className="font-semibold text-v2-text">{s.name}</span>
                        </span>
                        <span className="block pl-4 text-v2-small text-v2-text-3">{s.description || t(KIND_LABEL[kindOf(s)])}</span>
                      </td>
                      <td className="px-2.5 py-2.5">{timeCell(s)}</td>
                      <td className="px-2.5 py-2.5">{daysCell(s)}</td>
                      <td className="px-2.5 py-2.5 text-right whitespace-nowrap">{hoursCell(s)}</td>
                      <td className="px-2.5 py-2.5">{peopleCell(s)}</td>
                      <td className="py-2.5 pl-1 pr-3 text-right">
                        <ActionMenu items={rowMenu(s)} label={t("{name} — amallar", { name: s.name })}>
                          {(trigger) => (
                            <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: s.name })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
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
        </div>
      </div>

      {sel && (
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-v2-border px-4 py-3">
            <span className={`size-2.5 rounded-v2-sm ${dotOf(sel)}`} aria-hidden />
            <h2 className="text-v2-section text-v2-text">{sel.name}</h2>
            <span className="text-v2-small text-v2-text-2">
              {kindOf(sel) === "fixed"
                ? [tr(sel.start, sel.end), daySpan(sel.days ?? [], t), tr(sel.breakStart, sel.breakEnd) ? `${t("tanaffus")} ${tr(sel.breakStart, sel.breakEnd)}` : ""].filter(Boolean).join(" · ")
                : t(KIND_LABEL[kindOf(sel)])}
            </span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setShowPeople((v) => !v)} className={`${secondaryBtn} h-8!`} aria-expanded={showPeople}>
                <Users className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Xodimlar · {n}", { n: (people.get(sel.id) ?? []).length })}
              </button>
              <button type="button" onClick={() => setEdit(sel)} className={`${secondaryBtn} h-8!`}>
                <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Tahrirlash")}
              </button>
            </div>
          </div>
          {showPeople && (
            <div className="flex flex-wrap gap-2 border-b border-v2-border px-4 py-3">
              {(people.get(sel.id) ?? []).length === 0 && <span className="text-v2-small text-v2-text-3">{t("Bu jadvalga hali xodim biriktirilmagan — xodim kartasida «Ish jadvali» tanlanadi.")}</span>}
              {(people.get(sel.id) ?? []).map((p) => (
                <Link key={p.emp.id} href={`/management-xodimlar/${p.emp.id}`} className="inline-flex items-center gap-2 rounded-v2-md border border-v2-border px-2 py-1 text-v2-small hover:bg-v2-surface-2">
                  <Avatar name={p.emp.name} />
                  <span>
                    <b className="block font-semibold text-v2-text">{p.emp.name}</b>
                    <span className="block text-v2-caption text-v2-text-3">{t(ROLE_LABEL[p.emp.turi] ?? p.emp.turi)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <WeekTimeline s={sel} color={dotOf(sel)} />
            <div>
              <div className="mb-2 text-v2-small text-v2-text-2">{t("Qoidalar")}</div>
              <ul className="space-y-2.5 text-v2-small">
                <Rule dot="bg-v2-warning" title={t("Kechikish")} text={kindOf(sel) === "lessons" ? t("«Keldim» birinchi dars boshlanganidan keyin bosilsa") : t("«Keldim» xodim ish vaqti boshlanganidan keyin bosilsa (filialda ruxsat etilgan daqiqa bilan)")} />
                <Rule dot="bg-v2-danger" title={t("Kelmadi")} text={kindOf(sel) === "lessons" ? t("dars boshlanib 5 daqiqada «Keldim» bo'lmasa — rahbarga xabar") : t("kun davomida «Keldim» bo'lmasa — Xodimlar davomatida")} />
                <Rule dot="bg-v2-text-3" title={t("Bayram kunlari")} text={t("Dam olish kuni — Sozlamalardagi bayram kunlari bo'yicha")} />
              </ul>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-v2-border px-4 py-2.5 text-v2-small text-v2-text-3">
            <Clock className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Jadval o'zgarsa — o'tgan kunlar davomati qayta hisoblanmaydi.")}
          </div>
        </section>
      )}

      {edit && <ScheduleDialogV2 item={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(id) => { setSelId(id); void reload(); }} />}
      {delFor && (
        <V2Confirm
          title={t("Jadval o'chirilsinmi?")}
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

function daySpan(days: number[], t: (s: string) => string): string {
  if (!days.length) return "";
  const sorted = [...days].sort();
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  return contiguous && sorted.length > 2 ? `${t(DAYS[sorted[0] - 1])}–${t(DAYS[sorted[sorted.length - 1] - 1])}` : sorted.map((d) => t(DAYS[d - 1])).join(", ");
}

function Rule({ dot, title, text }: { dot: string; title: string; text: string }) {
  return (
    <li className="flex gap-2">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span>
        <b className="block font-semibold text-v2-text">{title}</b>
        <span className="text-v2-text-2">{text}</span>
      </span>
    </li>
  );
}

/** Haftalik chiziq: 06:00–22:00 (navbatchilikda 00–24), ish vaqti brend, tanaffus och. */
function WeekTimeline({ s, color }: { s: WorkSchedule; color: string }) {
  const { t } = useT();
  const kind = kindOf(s);
  const from = kind === "shift" ? 0 : 6 * 60;
  const to = kind === "shift" ? 24 * 60 : 22 * 60;
  const pos = (m: number) => `${((Math.min(Math.max(m, from), to) - from) / (to - from)) * 100}%`;
  const a = toMin(s.start);
  const b = toMin(s.end);
  const ba = toMin(s.breakStart);
  const bb = toMin(s.breakEnd);
  const ticks = kind === "shift" ? [0, 6, 12, 18, 24] : [6, 9, 12, 15, 18, 21];
  if (kind === "lessons" || a === null || b === null) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-v2-md bg-v2-surface-2 px-6 text-center text-v2-small text-v2-text-2">
        {kind === "lessons" ? t("Ish vaqti har kuni guruh darslariga qarab — o'qituvchining dars jadvalida ko'rinadi.") : t("Vaqt kiritilmagan — «Tahrirlash» bilan qo'shing.")}
      </div>
    );
  }
  const on = new Set(kind === "shift" ? [1, 2, 3, 4, 5, 6, 7] : (s.days ?? []));
  const daily = dailyMinutes(s);
  return (
    <div>
      <div className="relative ml-12 h-5 text-v2-caption tabular-nums text-v2-text-3">
        {ticks.map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: pos(h * 60) }}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
      <div className="space-y-1.5">
        {DAYS.map((d, i) => {
          const work = on.has(i + 1);
          return (
            <div key={d} className="flex items-center gap-2">
              <span className="w-10 text-v2-small text-v2-text-2">{t(d)}</span>
              <div className="relative h-4 flex-1 rounded-v2-sm bg-v2-surface-2">
                {work && b > a && <span className={`absolute inset-y-0 rounded-v2-sm ${color}`} style={{ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` }} />}
                {work && kind === "shift" && b <= a && <span className={`absolute inset-y-0 rounded-v2-sm ${color} opacity-60`} style={{ left: 0, right: 0 }} />}
                {work && ba !== null && bb !== null && (
                  <span className="absolute inset-y-0 border-x border-v2-warning bg-v2-warning-bg" style={{ left: pos(ba), width: `calc(${pos(bb)} - ${pos(ba)})` }} />
                )}
                {!work && <span className="absolute inset-y-0 left-1 flex items-center text-v2-caption text-v2-text-3">{t("dam olish kuni")}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ml-12 mt-2 flex flex-wrap gap-4 text-v2-caption text-v2-text-2">
        <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-v2-sm ${color}`} />{t("Ish vaqti")}{daily !== null ? ` · ${t("kuniga {n} soat", { n: Math.round((daily / 60) * 10) / 10 })}` : ""}</span>
        {ba !== null && bb !== null && <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-v2-sm border border-v2-warning bg-v2-warning-bg" />{t("tanaffus")}</span>}
      </div>
    </div>
  );
}

/** «Jadval qo'shish» / tahrirlash — o'ngdan panel (rasm yo'q, «Formalar» qoidasi). */
function ScheduleDialogV2({ item, onClose, onSaved }: { item: WorkSchedule | null; onClose: () => void; onSaved: (id: number) => void }) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [kind, setKind] = useState<WorkScheduleKind>(item ? kindOf(item) : "fixed");
  const [start, setStart] = useState(item?.start ?? "09:00");
  const [end, setEnd] = useState(item?.end ?? "18:00");
  const [hasBreak, setHasBreak] = useState(Boolean(item ? item.breakStart : true));
  const [breakStart, setBreakStart] = useState(item?.breakStart || "13:00");
  const [breakEnd, setBreakEnd] = useState(item?.breakEnd || "14:00");
  const [days, setDays] = useState<number[]>(item?.days ?? [1, 2, 3, 4, 5, 6]);
  const [shiftOn, setShiftOn] = useState(String(item?.shiftOn ?? 1));
  const [shiftOff, setShiftOff] = useState(String(item?.shiftOff ?? 2));
  const [lead, setLead] = useState(String(item?.leadMinutes ?? 15));
  const [saving, setSaving] = useState(false);

  async function save(close: () => void) {
    if (!name.trim()) return showError(t("Jadval nomini kiriting"));
    if (kind === "fixed" && days.length === 0) return showError(t("Kamida bitta ish kunini tanlang"));
    setSaving(true);
    const body = {
      name: name.trim(),
      description,
      kind,
      start: kind === "lessons" ? "" : start,
      end: kind === "lessons" ? "" : end,
      breakStart: kind === "fixed" && hasBreak ? breakStart : "",
      breakEnd: kind === "fixed" && hasBreak ? breakEnd : "",
      days: kind === "fixed" ? days : [],
      shiftOn: Number(shiftOn) || 1,
      shiftOff: Number(shiftOff) || 0,
      leadMinutes: Number(lead) || 0,
    };
    const res = await fetch(item ? `/api/work-schedules/${item.id}` : "/api/work-schedules", {
      method: item ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(item ? t("Jadval saqlandi") : t("Jadval qo'shildi"));
    onSaved(Number(res.schedule?.id ?? item?.id));
    close();
  }

  return (
    <V2Dialog
      variant="right"
      title={item ? t("Jadvalni tahrirlash") : t("Jadval qo'shish")}
      subtitle={t("Xodimga kartasida biriktiriladi")}
      onClose={onClose}
      saving={saving}
      dirty={!item ? Boolean(name) : name !== item.name}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>{t("Saqlash")}</button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="ws-name">
          <TextInput id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Masalan: Kunduzgi")} />
        </Field>
        <Field label={t("Kimlar uchun")} optional htmlFor="ws-desc">
          <TextInput id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Masalan: Rahbar, menejer, moderator")} />
        </Field>
        <Field label={t("Turi")}>
          <Segmented label={t("Turi")} value={kind} onChange={(v) => setKind(v as WorkScheduleKind)} options={(Object.keys(KIND_LABEL) as WorkScheduleKind[]).map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))} />
        </Field>
        {kind === "lessons" ? (
          <Field label={t("Birinchi darsdan necha daqiqa oldin")} htmlFor="ws-lead">
            <TextInput id="ws-lead" inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value.replace(/\D/g, ""))} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Boshlanishi")} htmlFor="ws-start">
              <V2TimeField id="ws-start" value={start} onChange={setStart} />
            </Field>
            <Field label={t("Tugashi")} htmlFor="ws-end">
              <V2TimeField id="ws-end" value={end} onChange={setEnd} />
            </Field>
          </div>
        )}
        {kind === "fixed" && (
          <>
            <Field label={t("Ish kunlari")}>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => {
                  const on = days.includes(i + 1);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== i + 1) : [...cur, i + 1].sort()))}
                      className={`h-8 min-w-11 rounded-v2-md border px-2 text-v2-small font-medium ${on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text-2 hover:bg-v2-surface-2"}`}
                    >
                      {t(d)}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("Tanaffus")}>
              <Segmented label={t("Tanaffus")} value={hasBreak ? "yes" : "no"} onChange={(v) => setHasBreak(v === "yes")} options={[{ value: "yes", label: t("Bor") }, { value: "no", label: t("Tanaffussiz") }]} />
            </Field>
            {hasBreak && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("Tanaffus boshlanishi")} htmlFor="ws-bs">
                  <V2TimeField id="ws-bs" value={breakStart} onChange={setBreakStart} />
                </Field>
                <Field label={t("Tanaffus tugashi")} htmlFor="ws-be">
                  <V2TimeField id="ws-be" value={breakEnd} onChange={setBreakEnd} />
                </Field>
              </div>
            )}
          </>
        )}
        {kind === "shift" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Necha sutka ishlaydi")} htmlFor="ws-on">
              <TextInput id="ws-on" inputMode="numeric" value={shiftOn} onChange={(e) => setShiftOn(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label={t("Necha sutka dam")} htmlFor="ws-off">
              <TextInput id="ws-off" inputMode="numeric" value={shiftOff} onChange={(e) => setShiftOff(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
