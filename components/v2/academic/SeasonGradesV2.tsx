"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Info, Loader2, Plus, Send, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { fieldCls, TextInput } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { avgOf, type GroupSeasonState, type SeasonGroupDetail, type SeasonPayload, type SeasonPupilRow } from "@/lib/seasonGradeTypes";

// YANGI VERSIYA — O'QUV BO'LIMI → «MAVSUMIY BAHOLASH» (36-qism, rasmlar «Mavsumiy baholash», «Baholash — telefon»).
// Ustoz chorak oxirida har o'quvchini kurs mezonlari bo'yicha 1–5 baholaydi; chapda guruhlar holati bilan, o'ngda
// tanlangan guruh jadvali. Telefonda — guruh → o'quvchilar → pastdan chiqadigan baholash varaqasi
// («Saqlash va keyingisi»). «Ota-onalarga yuborish» — tayyor guruhlar botga va kabinetga ketadi.
// Server: /api/season-grades (lib/seasonGrades.ts).

const STATE: Record<GroupSeasonState, { label: string; cls: string }> = {
  progress: { label: "Jarayonda", cls: "bg-v2-warning-bg text-v2-warning" },
  ready: { label: "Tayyor", cls: "bg-v2-info-bg text-v2-info" },
  sent: { label: "Yuborilgan", cls: "bg-v2-success-bg text-v2-success" },
  none: { label: "Boshlanmagan", cls: "bg-v2-surface-2 text-v2-text-2" },
};
const SCORE_CLS = ["", "bg-v2-danger-bg text-v2-danger", "bg-v2-danger-bg text-v2-danger", "bg-v2-warning-bg text-v2-warning", "bg-v2-info-bg text-v2-info", "bg-v2-success-bg text-v2-success"];
const avgCls = (a: number | null) => (a === null ? "text-v2-text-3" : a >= 4.5 ? "bg-v2-success-bg text-v2-success" : a >= 3.5 ? "bg-v2-info-bg text-v2-info" : a >= 3 ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-danger-bg text-v2-danger");
const num = (n: number | null) => (n === null ? "—" : n.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export default function SeasonGradesV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [season, setSeason] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [crit, setCrit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { data: d, error, reload } = useReportData<SeasonPayload>(`/api/season-grades${season ? `?season=${season}` : ""}`);
  const key = d?.season ?? season;
  const groups = (d?.groups ?? []).filter((g) => (!course || g.course === course) && (!teacher || g.teacher === teacher));
  const cur = groups.find((g) => g.id === sel) ?? groups[0] ?? null;
  const { data: gd, reload: reloadG } = useReportData<SeasonGroupDetail>(cur && key ? `/api/season-grades?season=${key}&group=${cur.id}` : null);
  const [grading, setGrading] = useState<number | null>(null);
  const cnt = (s: GroupSeasonState) => (d?.groups ?? []).filter((g) => g.state === s).length;
  const daysLeft = d ? Math.ceil((Date.parse(d.deadline) - Date.parse(d.today)) / 86_400_000) : 0;
  const ready = cnt("ready");

  async function send() {
    const r = await fetch("/api/season-grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", season: key }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return showError(t(r?.error || "Yuborib bo'lmadi"));
    showSuccess(r.bot ? t("{g} guruh yuborildi · botga {n} ta xabar", { g: r.groups, n: r.delivered }) : t("{g} guruh yuborildi · kabinetda ko'rinadi (bot sozlanmagan)", { g: r.groups }));
    reload();
    reloadG();
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Mavsumiy baholash")}
        subtitle={t("Ustoz chorak oxirida har o'quvchini mezonlar bo'yicha baholaydi, natija ota-onaga boradi")}
        actions={
          <>
            <button type="button" onClick={() => setCrit(true)} disabled={!d} className={secondaryBtn}>
              {t("Mezonlar")}
            </button>
            <button type="button" onClick={() => setConfirm(true)} disabled={!ready} className={`${primaryBtn} disabled:opacity-50`}>
              <Send className="size-4" aria-hidden /> {t("Ota-onalarga yuborish")}
              {ready > 0 && <span className="rounded-full bg-white/25 px-1.5 text-v2-caption">{ready}</span>}
            </button>
          </>
        }
      />
      {d && (
        <div className="flex flex-wrap items-center gap-2">
          <V2Select variant="value" label={t("Chorak")} value={key} onChange={setSeason} options={d.seasons.map((s) => ({ value: s.key, label: t(s.label) }))} searchable={false} />
          <V2Select variant="chip" label={t("Kurs")} emptyLabel="Hammasi" value={course} onChange={setCourse} options={d.courses.map((c) => ({ value: c, label: c }))} searchable={false} />
          <V2Select variant="chip" label={t("Ustoz")} emptyLabel="Hammasi" value={teacher} onChange={setTeacher} options={d.teachers.map((c) => ({ value: c, label: c }))} />
          <span className={`ml-auto text-v2-small font-semibold ${daysLeft < 0 ? "text-v2-danger" : "text-v2-warning"}`}>
            {daysLeft < 0 ? t("muddat {d} da tugagan", { d: fmt.dayMonth(d.deadline) }) : t("muddat {d}gacha · {n} kun qoldi", { d: fmt.dayMonth(d.deadline), n: daysLeft })}
          </span>
        </div>
      )}
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className={`overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${mobileOpen ? "max-lg:hidden" : ""}`}>
            <div className="px-4 py-3">
              <h2 className="font-semibold text-v2-text">{t("Guruhlar · {n}", { n: groups.length })}</h2>
              <p className="text-v2-small text-v2-text-2">{t("{a} yuborilgan · {b} tayyor · {c} jarayonda · {e} boshlanmagan", { a: cnt("sent"), b: cnt("ready"), c: cnt("progress"), e: cnt("none") })}</p>
            </div>
            <ul className="divide-y divide-v2-border border-t border-v2-border">
              {groups.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => (setSel(g.id), setMobileOpen(true))} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-v2-hover ${cur?.id === g.id ? "lg:bg-v2-brand-bg" : ""}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-v2-text">{g.name}</span>
                      <span className="block truncate text-v2-small text-v2-text-2">
                        {g.teacher || "—"} · {g.graded} / {g.total}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-v2-caption font-semibold ${STATE[g.state].cls}`}>{t(STATE[g.state].label)}</span>
                    <ChevronRight className="size-4 shrink-0 text-v2-text-3 lg:hidden" aria-hidden />
                  </button>
                </li>
              ))}
              {!groups.length && <li className="px-4 py-6 text-center text-v2-small text-v2-text-3">{t("Guruh yo'q")}</li>}
            </ul>
          </section>

          <div className={`space-y-4 ${mobileOpen ? "" : "max-lg:hidden"}`}>
            {cur && (
              <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => setMobileOpen(false)} aria-label={t("Orqaga")} className="lg:hidden">
                    <ArrowLeft className="size-5 text-v2-text" aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 font-semibold text-v2-text">
                      <span className={`size-2.5 rounded-[2px] ${FAN_DOT[fanOf(cur.course)]}`} aria-hidden />
                      {cur.name}
                    </h2>
                    <p className="truncate text-v2-small text-v2-text-2">{[cur.teacher, cur.day && cur.time ? `${cur.day.toLowerCase()} ${cur.time}` : "", cur.room && `${cur.room}-xona`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2 text-v2-small text-v2-text-2">
                    <b className="text-v2-text">
                      {cur.graded} / {cur.total}
                    </b>{" "}
                    {t("baholandi")}
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-v2-surface-2">
                      <span className={`block h-full rounded-full ${cur.graded >= cur.total ? "bg-v2-success" : "bg-v2-warning"}`} style={{ width: `${cur.total ? (cur.graded / cur.total) * 100 : 0}%` }} />
                    </span>
                  </div>
                </div>
                {!gd ? (
                  <div className="flex items-center gap-2 border-t border-v2-border px-4 py-6 text-v2-small text-v2-text-3">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto border-t border-v2-border lg:block">
                      <table className="w-full border-collapse text-v2-body">
                        <thead>
                          <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                            <th className={`${TH} pl-4`}>{t("O'quvchi")}</th>
                            {gd.criteria.map((c) => (
                              <th key={c} className={`${TH} text-center`}>
                                {t(c)}
                              </th>
                            ))}
                            <th className={`${TH} text-center`}>{t("O'rtacha")}</th>
                            <th className={`${TH} pr-4`}>{t("Ustoz izohi")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gd.pupils.map((p) => (
                            <tr key={p.pupilId} onClick={() => gd.group.state !== "sent" && setGrading(p.pupilId)} className={`border-b border-v2-border ${gd.group.state !== "sent" ? "cursor-pointer hover:bg-v2-hover" : ""}`}>
                              <td className="py-2 pl-4 pr-3 font-semibold text-v2-text">{p.name}</td>
                              {gd.criteria.map((c) => (
                                <td key={c} className="px-2 py-2 text-center">
                                  {p.scores[c] ? <span className={`inline-flex size-7 items-center justify-center rounded-v2-sm font-semibold ${SCORE_CLS[p.scores[c]]}`}>{p.scores[c]}</span> : <span className="text-v2-text-3">—</span>}
                                </td>
                              ))}
                              <td className="px-2 py-2 text-center">
                                <span className={`inline-flex rounded-v2-sm px-1.5 py-0.5 font-semibold tabular-nums ${avgCls(p.avg)}`}>{num(p.avg)}</span>
                              </td>
                              <td className="max-w-[220px] truncate py-2 pl-3 pr-4 text-v2-small text-v2-text-2">{p.note || (p.avg === null ? <span className="text-v2-brand">{t("Baholash")}</span> : "")}</td>
                            </tr>
                          ))}
                          <tr className="bg-v2-surface-2">
                            <td className="py-2 pl-4 pr-3 font-semibold text-v2-text">{t("Guruh o'rtachasi")}</td>
                            {gd.criteria.map((c) => (
                              <td key={c} className="px-2 py-2 text-center font-semibold tabular-nums text-v2-text">
                                {num(gd.avgBy[c])}
                              </td>
                            ))}
                            <td colSpan={2} className="py-2 pl-2 pr-4 text-v2-small text-v2-text-2">
                              {(() => {
                                const w = gd.criteria.filter((c) => gd.avgBy[c] !== null).sort((a, b) => (gd.avgBy[a] ?? 9) - (gd.avgBy[b] ?? 9))[0];
                                return w ? t("eng bo'sh joy — {c}", { c: t(w).toLowerCase() }) : "";
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <ul className="divide-y divide-v2-border border-t border-v2-border lg:hidden">
                      {gd.pupils.map((p) => (
                        <li key={p.pupilId}>
                          <button type="button" disabled={gd.group.state === "sent"} onClick={() => setGrading(p.pupilId)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                            <Avatar name={p.name} />
                            <span className="min-w-0 flex-1 truncate font-semibold text-v2-text">{p.name}</span>
                            <span className={`rounded-v2-sm px-1.5 py-0.5 font-semibold tabular-nums ${avgCls(p.avg)}`}>{num(p.avg)}</span>
                            <ChevronRight className="size-4 text-v2-text-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
                      {[5, 4, 3, 2].map((n) => (
                        <span key={n} className="inline-flex items-center gap-1.5">
                          <span className={`size-3 rounded-[3px] ${SCORE_CLS[n]}`} /> {n === 5 ? t("5 — a'lo") : n === 4 ? t("4 — yaxshi") : n === 3 ? t("3 — o'rtacha") : t("1–2 — e'tibor kerak")}
                        </span>
                      ))}
                      <span className="ml-auto">{gd.group.state === "sent" ? t("yuborilgan — o'zgartirib bo'lmaydi") : t("qatorni bosing — baholash varaqasi ochiladi")}</span>
                    </div>
                  </>
                )}
              </section>
            )}
            <section className="flex gap-3 rounded-v2-lg border border-v2-info/30 bg-v2-info-bg p-4">
              <Send className="mt-0.5 size-5 shrink-0 text-v2-info" aria-hidden />
              <div>
                <div className="font-semibold text-v2-text">{t("Yuborilganda har ota-onaga alohida hisobot boradi")}</div>
                <p className="text-v2-small text-v2-text-2">{t("Kabinetda va Telegram botda: mezonlar bo'yicha baho, ustoz izohi va o'tgan chorak bilan taqqoslash. Faqat hamma o'quvchisi baholangan guruhlar yuboriladi.")}</p>
              </div>
            </section>
            <p className="flex items-center gap-2 text-v2-small text-v2-text-2">
              <Info className="size-4 shrink-0" aria-hidden /> {t("Mezonlar kurs bo'yicha — «Mezonlar» tugmasi. Til kurslarida sukut bo'yicha 5 ta, boshqalarida 4 ta.")}
            </p>
          </div>
        </div>
      )}
      {grading !== null && gd && <GradeSheet d={gd} season={key} label={d?.label ?? ""} start={grading} onClose={() => setGrading(null)} onSaved={() => (reloadG(), reload())} />}
      {crit && d && <CriteriaDialog d={d} initial={cur?.course ?? d.courses[0] ?? ""} onClose={() => setCrit(false)} onDone={() => (reload(), reloadG())} />}
      {confirm && (
        <V2Confirm
          title={t("Ota-onalarga yuborish")}
          body={t("{n} ta tayyor guruh baholari ota-onalarga yuboriladi. Yuborilgandan keyin baholarni o'zgartirib bo'lmaydi.", { n: ready })}
          confirmLabel={t("Yuborish")}
          tone="brand"
          icon={Send}
          onConfirm={() => {
            setConfirm(false);
            void send();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </PageShell>
  );
}

function GradeSheet({ d, season, label, start, onClose, onSaved }: { d: SeasonGroupDetail; season: string; label: string; start: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const [idx, setIdx] = useState(() => Math.max(0, d.pupils.findIndex((p) => p.pupilId === start)));
  const p: SeasonPupilRow | undefined = d.pupils[idx];
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...(p?.scores ?? {}) }));
  const [note, setNote] = useState(p?.note ?? "");
  const [saving, setSaving] = useState(false);
  const avg = useMemo(() => avgOf(scores, d.criteria), [scores, d.criteria]);
  if (!p) return null;
  const go = (i: number) => {
    const n = d.pupils[i];
    setIdx(i);
    setScores({ ...(n?.scores ?? {}) });
    setNote(n?.note ?? "");
  };
  async function save(next: boolean) {
    setSaving(true);
    const r = await fetch("/api/season-grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "grade", season, groupId: d.group.id, pupilId: p!.pupilId, scores, note }) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    onSaved();
    if (next && idx + 1 < d.pupils.length) go(idx + 1);
    else {
      showSuccess(t("Baholar saqlandi"));
      onClose();
    }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={p.name} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div data-ui="v2" className="w-full max-w-md rounded-t-[20px] bg-v2-surface p-4 shadow-v2-lg sm:rounded-v2-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-v2-border-strong sm:hidden" aria-hidden />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold text-v2-text">{p.name}</div>
            <div className="text-v2-small text-v2-text-2">
              {idx + 1} / {d.pupils.length} · {t(label)} · {t("1 — past, 5 — a'lo")}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Yopish")} className="rounded-v2-md p-1 text-v2-text-2 hover:bg-v2-hover">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="divide-y divide-v2-border">
          {d.criteria.map((c) => (
            <div key={c} className="flex items-center justify-between gap-2 py-2">
              <span className="text-v2-body text-v2-text">{t(c)}</span>
              <div role="radiogroup" aria-label={t(c)} className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={scores[c] === n} onClick={() => setScores((s) => ({ ...s, [c]: n }))} className={`size-10 rounded-v2-md border text-v2-body font-semibold ${scores[c] === n ? "border-v2-brand bg-v2-brand text-white" : "border-v2-border-strong text-v2-text hover:bg-v2-hover"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <label className="mt-3 block text-v2-small font-semibold text-v2-text">
          {t("Izoh")} <span className="font-normal text-v2-text-3">({t("ixtiyoriy")})</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className={fieldCls("default", "mt-1 h-auto py-2 font-normal")} />
        </label>
        <div className="mt-2 flex justify-between text-v2-small text-v2-text-2">
          <span>
            {t("O'rtacha")}: <b className="text-v2-text">{num(avg)}</b>
          </span>
          <span>{t("o'tgan chorak: {n}", { n: num(p.prevAvg) })}</span>
        </div>
        <button type="button" onClick={() => void save(true)} disabled={saving || avg === null} className={`${primaryBtn} mt-3 h-12 w-full justify-center disabled:opacity-50`}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {idx + 1 < d.pupils.length ? t("Saqlash va keyingisi") : t("Saqlash")}
        </button>
      </div>
    </div>
  );
}

function CriteriaDialog({ d, initial, onClose, onDone }: { d: SeasonPayload; initial: string; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [course, setCourse] = useState(initial);
  const [list, setList] = useState<string[]>(() => [...(d.criteria[initial] ?? [])]);
  const [saving, setSaving] = useState(false);
  const pick = (c: string) => (setCourse(c), setList([...(d.criteria[c] ?? [])]));
  async function save(close: () => void) {
    setSaving(true);
    const r = await fetch("/api/season-grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "criteria", course, criteria: list }) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Mezonlar saqlandi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Mezonlar")}
      subtitle={t("Kurs bo'yicha — shu kursdagi barcha guruhlar shu mezonlar bilan baholanadi")}
      onClose={onClose}
      saving={saving}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={primaryBtn}>
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <V2Select label={t("Kurs")} value={course} onChange={pick} options={d.courses.map((c) => ({ value: c, label: c }))} searchable={false} />
        <ul className="space-y-2">
          {list.map((c, i) => (
            <li key={i} className="flex gap-2">
              <TextInput value={c} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? e.target.value : x)))} maxLength={30} aria-label={t("Mezon {n}", { n: i + 1 })} />
              <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label={t("O'chirish")} className="rounded-v2-md px-2 text-v2-text-3 hover:text-v2-danger">
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {list.length < 8 && (
          <button type="button" onClick={() => setList((l) => [...l, ""])} className={secondaryBtn}>
            <Plus className="size-4" aria-hidden /> {t("Mezon qo'shish")}
          </button>
        )}
        <p className="text-v2-caption text-v2-text-2">{t("Mezon o'zgarsa — shu chorakda allaqachon qo'yilgan baholar eski mezon bo'yicha qoladi; o'rtacha yangi mezonlar bilan hisoblanadi.")}</p>
      </div>
    </V2Dialog>
  );
}
