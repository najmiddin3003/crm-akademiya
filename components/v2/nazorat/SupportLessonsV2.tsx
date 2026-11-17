"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Plus, Trash2, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import type { DateRange } from "@/components/ui/DateRangePicker";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2TimeField from "@/components/v2/form/V2TimeField";
import { Field, fieldCls } from "@/components/v2/form/fields";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, SimplePager, TH, downloadCsv } from "@/components/v2/students/lists/listKit";
import { SUPPORT_STATUS_LABELS, type SupportLessonRow, type SupportPayload, type SupportStatus } from "@/lib/supportLessonTypes";

// YANGI VERSIYA — NAZORAT → «SUPPORT DARSLARI» (34-qism, rasm «Support darslari»). Qo'shimcha yordam
// darslari: sana oralig'i, kurs, Excel, «Support dars ochish». Ko'rsatkichlar (darslar, yozilganlar,
// keldi %, navbat), darslar jadvali (qatorni bosish — yozilganlar, navbat, davomat) va «Support ustozlar»
// paneli. Server: /api/support-lessons (lib/supportLessons.ts).

const PAD = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
const STATUS_PILL: Record<SupportStatus, string> = {
  open: "bg-v2-success-bg text-v2-success",
  full: "bg-v2-warning-bg text-v2-warning",
  done: "bg-v2-surface-2 text-v2-text-2",
  unmarked: "bg-v2-danger-bg text-v2-danger",
};
const firstOfMonth = () => {
  const n = new Date();
  return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: new Date(n.getFullYear(), n.getMonth() + 1, 0) };
};

interface Teacher {
  name: string;
  kurs: string;
}
interface Room {
  name: string;
  capacity: number;
}

export default function SupportLessonsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [range, setRange] = useState<DateRange>(firstOfMonth);
  const [course, setCourse] = useState("");
  const [data, setData] = useState<SupportPayload | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    let off = false;
    const s = range.start ?? new Date();
    const p = new URLSearchParams({ from: isoOf(s), to: isoOf(range.end ?? s) });
    if (course) p.set("course", course);
    void fetch(`/api/support-lessons?${p}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setData(j);
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [range, course, ver]);

  useEffect(() => {
    void Promise.all([fetch("/api/teachers").then((r) => r.json()), fetch("/api/rooms").then((r) => r.json())])
      .then(([tt, rr]) => {
        if (tt?.ok) setTeachers((tt.teachers as Teacher[]).filter((x) => x.name));
        if (rr?.ok) setRooms((rr.rooms as Room[]).filter((x) => x.name));
      })
      .catch(() => {});
  }, []);

  const rows = data?.rows ?? [];
  const shown = rows.slice((page - 1) * size, page * size);
  const open = rows.find((r) => r.id === openId) ?? null;
  const k = data?.kpi;
  const reload = () => setVer((v) => v + 1);

  function exportCsv() {
    downloadCsv(
      `support-darslari-${data?.from}_${data?.to}.csv`,
      ["Sana", "Vaqt", "Xona", "Kurs", "Mavzu", "Support ustoz", "Yozildi", "Joy", "Keldi", "Navbat", "Holat"],
      rows.map((r) => [r.date, r.start, r.room, r.course, r.topic, r.teacher, r.seats.length, r.capacity, r.status === "done" || r.status === "unmarked" ? r.came : "", r.queue.length, SUPPORT_STATUS_LABELS[r.status]]),
    );
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Support darslari")}
        subtitle={t("Qo'shimcha yordam darslari — o'quvchi yoziladi, support ustoz o'tadi")}
        actions={
          <>
            <V2DateRange value={range} onChange={(r) => {
                setRange(r);
                setPage(1);
              }} allowAll={false} />
            <V2Select variant="chip" label={t("Kurs")} value={course} onChange={(v) => {
                setCourse(v);
                setPage(1);
              }} options={(data?.courses ?? []).map((c) => ({ value: c, label: c }))} />
            <button type="button" onClick={exportCsv} disabled={!rows.length} className={`${secondaryBtn} disabled:opacity-50`}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              Excel
            </button>
            <button type="button" onClick={() => setAdd(true)} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Support dars ochish")}
            </button>
          </>
        }
      />
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!data && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {data && k && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label={t("Support darslar")} value={k.lessons} sub={t("{a} tasi o'tdi · {b} tasi rejada", { a: k.done, b: k.planned })} />
            <Kpi label={t("Yozilganlar")} value={k.enrolled} sub={t("o'tgan {a} darsga · {b} nafar o'quvchi", { a: k.done, b: k.pupils })} />
            <Kpi label={t("Keldi")} value={k.pct === null ? "—" : `${k.pct}%`} sub={t("{a} ta · yozilgan, lekin kelmagan {b}", { a: k.came, b: k.noShow })} />
            <Kpi label={t("Navbatda")} value={k.queue} sub={t("joy tugagan darslarga")} />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-5`}>{t("Dars")}</th>
                      <th className={TH}>{t("Mavzu")}</th>
                      <th className={TH}>{t("Support ustoz")}</th>
                      <th className={`${TH} text-right`}>{t("Yozildi")}</th>
                      <th className={`${TH} text-right`}>{t("Keldi")}</th>
                      <th className={`${TH} pr-5`}>{t("Holat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                          {t("Bu oraliqda support dars yo'q — «Support dars ochish» bilan qo'shing")}
                        </td>
                      </tr>
                    )}
                    {shown.map((r) => {
                      const past = r.status === "done" || r.status === "unmarked";
                      return (
                        <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover">
                          <td className="py-3 pl-5 pr-3">
                            <div className="font-semibold tabular-nums text-v2-text">
                              {fmt.dayMonth(r.date)} | {r.start}
                            </div>
                            <div className="text-v2-small text-v2-text-2">{r.room ? t("{n}-xona", { n: r.room }) : "—"}</div>
                          </td>
                          <td className="px-3 py-3">
                            {r.course && (
                              <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
                                <span className={`size-2 rounded-[2px] ${FAN_DOT[fanOf(r.course)]}`} aria-hidden />
                                {r.course}
                              </div>
                            )}
                            <div className="font-semibold text-v2-text">{r.topic}</div>
                          </td>
                          <td className="px-3 py-3 text-v2-text">{r.teacher}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            <span className="font-semibold text-v2-text">{r.seats.length}</span>
                            <span className="text-v2-text-2"> / {r.capacity}</span>
                            {r.queue.length > 0 && <div className="text-v2-small text-v2-warning">{t("+{n} navbatda", { n: r.queue.length })}</div>}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-text">{past && r.status === "done" ? r.came : "—"}</td>
                          <td className="py-3 pl-3 pr-5">
                            <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${STATUS_PILL[r.status]}`}>{t(SUPPORT_STATUS_LABELS[r.status])}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <SimplePager
                total={rows.length}
                page={page}
                pageSize={size}
                onPage={setPage}
                onPageSize={(n) => {
                  setSize(n);
                  setPage(1);
                }}
                note={t("Joy tugasa o'quvchi navbatga tushadi")}
              />
            </section>

            <aside className="h-fit rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <h2 className="border-b border-v2-border px-5 py-4 text-v2-section text-v2-text">{t("Support ustozlar")}</h2>
              {data.teachers.length === 0 && <p className="px-5 py-6 text-v2-small text-v2-text-3">{t("Hali dars yo'q")}</p>}
              <ul className="divide-y divide-v2-border">
                {data.teachers.map((x) => (
                  <li key={x.teacher} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-v2-text">{x.teacher}</span>
                      <span className="font-semibold tabular-nums text-v2-text">{x.pct === null ? "—" : `${x.pct}%`}</span>
                    </div>
                    <div className="text-v2-small text-v2-text-2">{[x.course, t("{n} dars", { n: x.lessons }), t("{n} yozilish", { n: x.enrolled })].filter(Boolean).join(" · ")}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                      <div className="h-full rounded-full bg-v2-success" style={{ width: `${x.pct ?? 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {data.teachers.length > 0 && <p className="border-t border-v2-border px-5 py-3 text-v2-small text-v2-text-2">{t("foiz — yozilganlardan kelganlari")}</p>}
            </aside>
          </div>
        </>
      )}

      {add && <CreateDialog teachers={teachers} rooms={rooms} onClose={() => setAdd(false)} onDone={reload} />}
      {open && <ManageDialog l={open} onClose={() => setOpenId(null)} onChange={reload} />}
    </PageShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-8 tabular-nums text-v2-text">{value}</div>
      <div className="mt-1 text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function CreateDialog({ teachers, rooms, onClose, onDone }: { teachers: Teacher[]; rooms: Room[]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [date, setDate] = useState<Date | null>(new Date());
  const [start, setStart] = useState("15:00");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [saving, setSaving] = useState(false);
  const courses = [...new Set(teachers.map((x) => x.kurs).filter(Boolean))];

  async function save(close: () => void) {
    setSaving(true);
    const res = await fetch("/api/support-lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: date ? isoOf(date) : "", start, room, teacher, course, topic, capacity: Number(capacity) }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Support dars ochildi"));
    close();
    onDone();
  }

  return (
    <V2Dialog
      title={t("Support dars ochish")}
      subtitle={t("o'quvchilar yoziladi; joy tugasa — navbat")}
      onClose={onClose}
      saving={saving}
      dirty={!!topic}
      width={560}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Dars ochish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Sana")}>
            <V2DateField value={date} onChange={setDate} />
          </Field>
          <Field label={t("Vaqt")}>
            <V2TimeField value={start} onChange={setStart} />
          </Field>
        </div>
        <Field label={t("Mavzu")}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} className={fieldCls()} placeholder={t("Masalan: Present Perfect va Past Simple")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Support ustoz")}>
            <V2Select
              label={t("Support ustoz")}
              value={teacher}
              searchable="auto"
              placeholder={t("Tanlang")}
              onChange={(v) => {
                setTeacher(v);
                if (!course) setCourse(teachers.find((x) => x.name === v)?.kurs ?? "");
              }}
              options={teachers.map((x) => ({ value: x.name, label: x.name }))}
            />
          </Field>
          <Field label={t("Kurs")} optional>
            <V2Select label={t("Kurs")} value={course} onChange={setCourse} clearable placeholder={t("Tanlanmagan")} options={courses.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label={t("Xona")} optional>
            <V2Select
              label={t("Xona")}
              value={room}
              clearable
              placeholder={t("Tanlanmagan")}
              onChange={(v) => {
                setRoom(v);
                const cap = rooms.find((x) => x.name === v)?.capacity;
                if (cap) setCapacity(String(cap));
              }}
              options={rooms.map((x) => ({ value: x.name, label: t("{n}-xona", { n: x.name }) }))}
            />
          </Field>
          <Field label={t("Joylar soni")}>
            <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={fieldCls()} />
          </Field>
        </div>
      </div>
    </V2Dialog>
  );
}

function ManageDialog({ l, onClose, onChange }: { l: SupportLessonRow; onClose: () => void; onChange: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const started = l.status === "done" || l.status === "unmarked";

  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    const res = await fetch("/api/support-lessons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: l.id, ...body }) })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      showError(t(res?.error || "Saqlab bo'lmadi"));
      return false;
    }
    if (ok) showSuccess(ok);
    onChange();
    return res;
  }

  return (
    <V2Dialog
      title={l.topic}
      subtitle={[`${fmt.dayMonth(l.date)} | ${l.start}`, l.room ? t("{n}-xona", { n: l.room }) : "", l.teacher].filter(Boolean).join(" · ")}
      onClose={onClose}
      saving={busy}
      width={560}
      footer={(api) => (
        <button type="button" onClick={api.requestClose} className={secondaryBtn}>
          {t("Yopish")}
        </button>
      )}
      footerStart={
        !l.seats.some((s) => s.came !== null) ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await patch({ action: "delete" }, t("Dars o'chirildi"))) onClose();
            }}
            className="inline-flex items-center gap-1.5 text-v2-small font-semibold text-v2-danger"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Darsni o'chirish")}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {!started && (
          <Field label={t("O'quvchini yozish")}>
            <StudentSearchField
              placeholder={t("Ism yoki telefon")}
              onPick={async (s) => {
                const r = await patch({ action: "enroll", pupilId: s.id, name: s.name });
                if (r) showSuccess(r.placed === "queue" ? t("Joy yo'q — navbatga qo'shildi") : t("Yozildi"));
              }}
            />
          </Field>
        )}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-v2-small font-semibold text-v2-text">{t("Yozilganlar")}</span>
            <span className="text-v2-small tabular-nums text-v2-text-2">
              {l.seats.length} / {l.capacity}
            </span>
          </div>
          {l.seats.length === 0 && <p className="rounded-v2-md bg-v2-surface-2 px-3 py-3 text-v2-small text-v2-text-3">{t("Hali hech kim yozilmagan")}</p>}
          <ul className="divide-y divide-v2-border rounded-v2-md border border-v2-border empty:hidden">
            {l.seats.map((s) => (
              <li key={s.pupilId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-v2-text">{s.name}</span>
                {started ? (
                  <div className="flex shrink-0 gap-1.5">
                    {[
                      { v: true, label: t("Keldi"), on: "border-v2-success bg-v2-success-bg text-v2-success" },
                      { v: false, label: t("Kelmadi"), on: "border-v2-danger bg-v2-danger-bg text-v2-danger" },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        disabled={busy}
                        aria-pressed={s.came === o.v}
                        onClick={() => void patch({ action: "mark", marks: { [s.pupilId]: s.came === o.v ? null : o.v } })}
                        className={`h-8 rounded-full border px-3 text-v2-small font-semibold ${s.came === o.v ? o.on : "border-v2-border text-v2-text-2"}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button type="button" disabled={busy} onClick={() => void patch({ action: "remove", pupilId: s.pupilId })} aria-label={t("Chiqarish")} className="grid size-8 place-items-center rounded-v2-md text-v2-text-3 hover:bg-v2-hover">
                    <X className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        {l.queue.length > 0 && (
          <div>
            <span className="mb-2 block text-v2-small font-semibold text-v2-text">{t("Navbat")}</span>
            <ol className="divide-y divide-v2-border rounded-v2-md border border-v2-border">
              {l.queue.map((s, i) => (
                <li key={s.pupilId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate text-v2-text">
                    <span className="mr-2 tabular-nums text-v2-text-3">{i + 1}.</span>
                    {s.name}
                  </span>
                  {!started && (
                    <button type="button" disabled={busy} onClick={() => void patch({ action: "remove", pupilId: s.pupilId })} aria-label={t("Chiqarish")} className="grid size-8 place-items-center rounded-v2-md text-v2-text-3 hover:bg-v2-hover">
                      <X className="size-4" strokeWidth={1.75} />
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-1.5 text-v2-small text-v2-text-2">{t("Kimdir chiqsa, navbatdagi birinchi o'quvchi joyga o'tadi")}</p>
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
