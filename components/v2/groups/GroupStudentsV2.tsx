"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Download, MessageSquare, MoreHorizontal, Plus, UserMinus, UserRound } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import SmsModal from "@/components/orders/SmsModal";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import { useStudentLists } from "@/components/v2/students/lists/useStudentLists";
import V2Dialog from "@/components/v2/form/V2Dialog";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import { Field } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE, roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { ROW_TINT } from "@/components/v2/ui/table";
import { isNewStudent, type StudentListRow } from "@/lib/studentListsTypes";
import type { RosterGroup, RosterMember, RosterPayload } from "@/lib/groupRoster";
import type { StudentRow } from "@/lib/studentsData";
import {
  B,
  Badge,
  PageHead,
  PageShell,
  PersonCell,
  SearchBox,
  SummaryLine,
  TH,
  dmy,
  downloadCsv,
  fmtNum,
  fmtPhone,
  matchQuery,
  todayIso,
} from "@/components/v2/students/lists/listKit";

// YANGI VERSIYA — GURUH → GURUH O'QUVCHILARI (31-qism, rasm «Guruh o'quvchilari», yorug'/qorong'i).
//
// Guruhlar bo'limlarga bo'lingan jadval: sarlavha qatorida guruh (fan nuqtasi, o'qituvchi, jadval,
// xona, holat) va o'ng tomonda bandlik («6 / 12 o'rin»; xona sig'imi kam bo'lsa «xonada 8 o'rin»);
// ostida a'zolar — qo'shilgan kuni, holati (Yangi / Faol — O'quvchilar bo'limi qoidasi), joriy oy
// davomati, balans va «Ko'chirish». Ma'lumot: /api/groups/roster (a'zolik, davomat, sig'im) +
// /api/students/lists (ism, holat, balans). Ko'chirish — guruh sahifasidagi bilan bir xil so'rovlar.
// Eski sahifa — `?classic=1`.

type Row = { g: RosterGroup; m: RosterMember; s: StudentListRow | undefined };

const SLACK = 1000;

function useRoster() {
  const [data, setData] = useState<RosterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const apply = useCallback((res: RosterPayload | { ok: false } | null) => {
    if (res?.ok) setData(res);
    setLoading(false);
  }, []);
  const load = useCallback(
    () =>
      fetch("/api/groups/roster", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)
        .then(apply),
    [apply],
  );
  useEffect(() => {
    fetch("/api/groups/roster", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then(apply);
  }, [apply]);
  return { groups: data?.groups ?? [], month: data?.month ?? "", loading, reload: load };
}

function groupTitle(g: Pick<RosterGroup, "name" | "course">): string {
  return /^\d+$/.test(g.name) && g.course ? `${g.name} · ${g.course}` : g.name;
}

export default function GroupStudentsV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { groups, loading: rLoading, reload: reloadRoster } = useRoster();
  const { rows: students, asOf, loading: sLoading, reload: reloadStudents } = useStudentLists();
  const loading = rLoading || sLoading;

  const [q, setQ] = useState("");
  const [teacher, setTeacher] = useState("");
  const [gStatus, setGStatus] = useState("");
  const [pStatus, setPStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveFor, setMoveFor] = useState<Row | null>(null);
  const [removeFor, setRemoveFor] = useState<Row | null>(null);
  const [smsFor, setSmsFor] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const statusOf = useCallback(
    (s: StudentListRow | undefined): { key: string; label: string } => {
      if (!s) return { key: "", label: "" };
      if (s.status === "Muzlatilgan") return { key: "Muzlatilgan", label: "Muzlatilgan" };
      return isNewStudent(s, asOf) ? { key: "Yangi", label: "Yangi" } : { key: "Faol", label: "Faol" };
    },
    [asOf],
  );

  const reloadAll = () => {
    void reloadRoster();
    void reloadStudents();
  };

  const teacherOptions = useMemo(() => [...new Set(groups.map((g) => g.teacher).filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [groups]);

  const sections = useMemo(() => {
    return groups
      .filter((g) => (!teacher || g.teacher === teacher) && (!gStatus || g.status === gStatus))
      .map((g) => {
        const rows: Row[] = g.members
          .map((m) => ({ g, m, s: byId.get(m.pupilId) }))
          .filter((r) => matchQuery(q, r.s?.name, r.s?.phone) && (!pStatus || statusOf(r.s).key === pStatus))
          .sort((a, b) => (a.s?.name ?? "").localeCompare(b.s?.name ?? "", "uz"));
        return { g, rows };
      })
      .filter((sec) => sec.rows.length > 0 || (!q && !pStatus));
  }, [groups, teacher, gStatus, q, pStatus, byId, statusOf]);

  const memberCount = sections.reduce((n, sec) => n + sec.rows.length, 0);
  const freeSeats = sections.reduce((n, { g }) => {
    const cap = g.capacity ?? g.roomCapacity;
    return cap ? n + Math.max(0, cap - g.members.length) : n;
  }, 0);
  const neverCame = sections.reduce((n, sec) => n + sec.rows.filter((r) => r.m.neverCame).length, 0);
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const COLS = 7;
  const keyOf = (r: Row) => `${r.g.id}:${r.m.pupilId}`;
  const allKeys = sections.flatMap((sec) => sec.rows.map(keyOf));
  const selCount = allKeys.filter((k) => selected.has(k)).length;

  const toggle = (k: string, on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });

  async function moveTo(r: Row, target: { id: number; name?: string }) {
    if (target.id === r.g.id) {
      showError(t("O'quvchi allaqachon shu guruhda"));
      return;
    }
    const add = await fetch(`/api/groups/${target.id}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: r.m.pupilId }),
    })
      .then((x) => x.json())
      .catch(() => null);
    if (!add?.ok) {
      showError(t(add?.error || "Yangi guruhga qo'shib bo'lmadi"));
      return;
    }
    const del = await fetch(`/api/groups/${r.g.id}/students?pupilId=${r.m.pupilId}`, { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => null);
    setMoveFor(null);
    reloadAll();
    if (!del?.ok) {
      showError(t("Yangi guruhga qo'shildi, ammo eskisidan chiqarib bo'lmadi"));
      return;
    }
    showSuccess(t("{moveFor} — \"{id}\" guruhiga ko'chirildi", { moveFor: r.s?.name ?? "", id: target.name || target.id }));
  }

  async function remove(r: Row) {
    const res = await fetch(`/api/groups/${r.g.id}/students?pupilId=${r.m.pupilId}`, { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => null);
    setRemoveFor(null);
    if (!res?.ok) {
      showError(t(res?.error || "Guruhdan chiqarib bo'lmadi"));
      return;
    }
    showSuccess(t("Guruhdan chiqarildi"));
    reloadAll();
  }

  function exportCsv() {
    const list = sections.flatMap((sec) => sec.rows).filter((r) => selected.size === 0 || selected.has(keyOf(r)));
    downloadCsv(
      "guruh-oquvchilari.csv",
      ["Guruh", "O'qituvchi", "O'quvchi", "Telefon", "Qo'shilgan", "Holati", "Davomat (keldi)", "Davomat (darslar)", "Balans"],
      list.map((r) => [groupTitle(r.g), r.g.teacher, r.s?.name ?? r.m.pupilId, fmtPhone(r.s?.phone ?? ""), dmy(r.m.joinedAt), statusOf(r.s).label, r.m.came, r.m.held, r.s ? -r.s.debt : ""]),
    );
  }

  function rowMenu(r: Row): ActionMenuEntry[] {
    const name = r.s?.name ?? String(r.m.pupilId);
    return [
      { key: "h", heading: name },
      { key: "open", label: t("Profilni ochish"), icon: UserRound, href: `/student-edit/${r.m.pupilId}` },
      { key: "move", label: t("Boshqa guruhga ko'chirish"), icon: ArrowRightLeft, onSelect: () => setMoveFor(r) },
      { key: "sms", label: t("SMS yuborish"), icon: MessageSquare, disabled: !r.s?.phone, onSelect: () => setSmsFor(r) },
      { key: "d", divider: true },
      { key: "rm", label: t("Guruhdan chiqarish"), icon: UserMinus, danger: true, onSelect: () => setRemoveFor(r) },
    ];
  }

  function groupHeader(g: RosterGroup) {
    const tone = GROUP_TONE[g.status] ?? GROUP_TONE.active;
    const cap = g.capacity ?? g.roomCapacity;
    const n = g.members.length;
    const pct = cap ? Math.min(100, Math.round((n / cap) * 100)) : 0;
    const roomShort = g.capacity !== null && g.roomCapacity !== null && g.roomCapacity < g.capacity;
    const meta = [g.teacher || t("o'qituvchisiz"), [g.day, timeLabel(g.time)].filter(Boolean).join(" ").toLowerCase(), roomLabel(g.room)].filter(Boolean).join(" · ");
    return (
      <tr key={`g${g.id}`} className="border-b border-v2-border bg-v2-surface-2">
        <td colSpan={COLS} className="px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
            <Link href={`/groups/${g.id}`} className="font-semibold text-v2-text hover:text-v2-brand-text hover:underline">
              {groupTitle(g)}
            </Link>
            <span className="text-v2-small text-v2-text-2">{meta}</span>
            <span className={`rounded-v2-full px-2 py-0.5 text-v2-caption ${tone.badge}`}>{t(tone.label)}</span>
            <span className="ml-auto inline-flex items-center gap-3 text-v2-small text-v2-text-2">
              {roomShort && <span className="text-v2-warning">{t("xonada {n} o'rin", { n: g.roomCapacity ?? 0 })}</span>}
              {cap ? (
                <>
                  <span className="h-1.5 w-20 overflow-hidden rounded-v2-full bg-v2-border" aria-hidden>
                    <span className={`block h-full rounded-v2-full ${n > cap ? "bg-v2-danger" : "bg-v2-brand"}`} style={{ width: `${Math.max(4, pct)}%` }} />
                  </span>
                  <span className="tabular-nums">
                    <b className="font-semibold text-v2-text">{n}</b> / {cap} {t("o'rin")}
                  </span>
                </>
              ) : (
                <span className="tabular-nums">
                  <b className="font-semibold text-v2-text">{n}</b> {t("o'quvchi")} · {t("sig'im kiritilmagan")}
                </span>
              )}
            </span>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <PageShell>
      <PageHead
        title={t("Guruh o'quvchilari")}
        subtitle={[branchName, t("har bir guruhdagi o'quvchilar, davomat va bo'sh o'rinlar")].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtn}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Export")}
            </button>
            <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Guruhga qo'shish")}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder={t("Ism yoki telefon")} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={teacher} onChange={setTeacher} options={teacherOptions} />
        <V2Select
          variant="chip"
          label={t("Guruh holati")}
          value={gStatus}
          onChange={setGStatus}
          searchable={false}
          options={(["gathering", "active", "frozen"] as const).map((k) => ({ value: k, label: t(GROUP_TONE[k].label) }))}
        />
        <V2Select
          variant="chip"
          label={t("O'quvchi holati")}
          value={pStatus}
          onChange={setPStatus}
          searchable={false}
          options={["Yangi", "Faol", "Muzlatilgan"].map((v) => ({ value: v, label: t(v) }))}
        />
      </div>

      <SummaryLine
        items={[
          <span key="g"><B>{sections.length}</B> {t("ta guruh")}</span>,
          <span key="s"><B>{memberCount}</B> {t("ta o'quvchi")}</span>,
          <span key="f">{t("Bo'sh o'rin")} <B>{freeSeats}</B></span>,
          <span key="n">{t("Guruhga qo'shilgandan beri kelmagan")} <B tone={neverCame ? "danger" : undefined}>{neverCame}</B></span>,
          selCount > 0 && <span key="x" className="text-v2-brand-text">{t("{n} ta belgilandi", { n: selCount })}</span>,
        ]}
      />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-10 pl-4 pr-2`}>
                  <V2Checkbox
                    checked={allKeys.length > 0 && selCount === allKeys.length}
                    indeterminate={selCount > 0 && selCount < allKeys.length}
                    onChange={(on) => setSelected(on ? new Set(allKeys) : new Set())}
                    label={t("Hammasini belgilash")}
                  />
                </th>
                <th className={TH}>{t("O'quvchi")}</th>
                <th className={TH}>{t("Qo'shilgan")}</th>
                <th className={TH}>{t("Holati")}</th>
                <th className={TH}>{t("Davomat · joriy oy")}</th>
                <th className={`${TH} text-right`}>{t("Balans")}</th>
                <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-v2-border" aria-hidden>
                    <td colSpan={COLS} className="px-4 py-3"><div className="h-3 rounded bg-v2-skeleton" style={{ width: `${80 - i * 8}%` }} /></td>
                  </tr>
                ))}
              {!loading && sections.length === 0 && (
                <tr>
                  <td colSpan={COLS} className="p-6">
                    <div className="rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center text-v2-small text-v2-text-2">
                      {groups.length === 0 ? t("Faol guruh yo'q") : t("Mos o'quvchi topilmadi")}
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                sections.map(({ g, rows }) => (
                  <Fragment key={g.id}>
                    {groupHeader(g)}
                    {rows.length === 0 && (
                      <tr className="border-b border-v2-border">
                        <td colSpan={COLS} className="px-4 py-3 pl-12 text-v2-small text-v2-text-3">{t("Guruhda hali o'quvchi yo'q")}</td>
                      </tr>
                    )}
                    {rows.map((r) => {
                      const k = keyOf(r);
                      const on = selected.has(k);
                      const st = statusOf(r.s);
                      const bal = r.s ? (Math.abs(r.s.debt) < SLACK ? 0 : -r.s.debt) : 0;
                      return (
                        <tr key={k} className={`group border-b border-v2-border ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                          <td className="py-2 pl-4 pr-2"><V2Checkbox checked={on} onChange={(v) => toggle(k, v)} label={t("{name} — belgilash", { name: r.s?.name ?? "" })} /></td>
                          <td className="px-2.5 py-2"><PersonCell id={r.m.pupilId} name={r.s?.name ?? `#${r.m.pupilId}`} sub={fmtPhone(r.s?.phone ?? "") || "—"} /></td>
                          <td className="px-2.5 py-2 tabular-nums text-v2-text">{dmy(r.m.joinedAt) || <span className="text-v2-text-3">—</span>}</td>
                          <td className="px-2.5 py-2">
                            {st.key ? <Badge tone={st.key === "Yangi" ? "info" : st.key === "Faol" ? "success" : "neutral"}>{t(st.label)}</Badge> : <span className="text-v2-text-3">—</span>}
                          </td>
                          <td className="px-2.5 py-2 whitespace-nowrap tabular-nums">
                            <b className={`font-semibold ${r.m.held > 0 && r.m.came === 0 ? "text-v2-danger" : "text-v2-text"}`}>{r.m.came}</b>
                            <span className="text-v2-text"> / {r.m.held}</span> <span className="text-v2-small text-v2-text-3">{t("dars")}</span>
                          </td>
                          <td className={`px-2.5 py-2 text-right whitespace-nowrap tabular-nums ${bal < 0 ? "font-semibold text-v2-danger" : bal > 0 ? "font-semibold text-v2-success" : "text-v2-text"}`}>
                            {bal > 0 ? "+" : ""}
                            {fmtNum(bal)} {t("so'm")}
                          </td>
                          <td className="py-2 pl-1 pr-3">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => setMoveFor(r)} className={`${secondaryBtn} h-8!`}>{t("Ko'chirish")}</button>
                              <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: r.s?.name ?? "" })}>
                                {(trigger) => (
                                  <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: r.s?.name ?? "" })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
                                    <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                  </button>
                                )}
                              </ActionMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-v2-border px-4 py-2.5 text-v2-small text-v2-text-2">
          <span className="tabular-nums">
            <b className="font-semibold text-v2-text">{sections.length}</b> {t("guruh")} · <b className="font-semibold text-v2-text">{memberCount}</b> {t("o'quvchi")}
          </span>
          <span className="ml-auto text-v2-text-3">{t("«Ko'chirish» — o'quvchini boshqa guruhga o'tkazadi, to'lov va davomat tarixi saqlanadi")}</span>
        </div>
      </div>

      {moveFor && <GroupPickerModal onClose={() => setMoveFor(null)} onSelect={(target) => void moveTo(moveFor, target)} />}
      {removeFor && (
        <V2Confirm
          title={t("Guruhdan chiqarilsinmi?")}
          body={t("{name} «{group}» guruhidan chiqariladi. O'tgan darslari hisobda qoladi, o'quvchining o'zi o'chirilmaydi.", { name: removeFor.s?.name ?? "", group: groupTitle(removeFor.g) })}
          confirmLabel={t("Chiqarish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setRemoveFor(null)}
          onConfirm={() => void remove(removeFor)}
        />
      )}
      {smsFor?.s && (
        <SmsModal
          studentName={smsFor.s.name}
          phone={smsFor.s.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("SMS yuborildi"));
            setSmsFor(null);
          }}
          onError={showError}
        />
      )}
      {addOpen && <AddToGroupDialog groups={groups} onClose={() => setAddOpen(false)} onSaved={reloadAll} />}
    </PageShell>
  );
}

/** «Guruhga qo'shish» — guruh, o'quvchi va qaysi kundan (rasm yo'q, «Formalar» qoidasi). */
function AddToGroupDialog({ groups, onClose, onSaved }: { groups: RosterGroup[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const [groupId, setGroupId] = useState("");
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [joinedAt, setJoinedAt] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  async function save(close: () => void) {
    if (!groupId || !student) {
      showError(t("Guruh va o'quvchini tanlang"));
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: student.id, joinedAt }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(t(res?.error || "Guruhga qo'shishda xatolik yuz berdi"));
      return;
    }
    showSuccess(t("{name} guruhga qo'shildi", { name: student.name }));
    onSaved();
    close();
  }

  return (
    <V2Dialog
      title={t("Guruhga qo'shish")}
      subtitle={t("O'quvchi tanlangan kundan boshlab shu guruhda hisoblanadi")}
      onClose={onClose}
      saving={saving}
      dirty={Boolean(groupId || student)}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>{t("Qo'shish")}</button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Guruh")}>
          <V2Select
            label={t("Guruh")}
            placeholder={t("Tanlang")}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: String(g.id), label: [groupTitle(g), g.teacher].filter(Boolean).join(" · "), hint: `${g.members.length}` }))}
          />
        </Field>
        <Field label={t("O'quvchi")}>
          {student ? (
            <div className="flex items-center justify-between gap-3 rounded-v2-md border border-v2-border-field px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-v2-text">{student.name}</span>
                <span className="block text-v2-small text-v2-text-3">{fmtPhone(student.phone)}</span>
              </span>
              <button type="button" onClick={() => setStudent(null)} className="text-v2-small font-semibold text-v2-brand-text hover:underline">{t("O'zgartirish")}</button>
            </div>
          ) : (
            <StudentSearchField onPick={setStudent} placeholder={t("Ism yoki telefon")} />
          )}
        </Field>
        <Field label={t("Qaysi kundan")} hint={t("Darslar shu kundan hisoblanadi (Qarzdorlar hisoboti)")}>
          <IsoDateField value={joinedAt} onChange={setJoinedAt} />
        </Field>
      </div>
    </V2Dialog>
  );
}
