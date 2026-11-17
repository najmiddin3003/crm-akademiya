"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, PhoneField, Segmented, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, SearchBox, SegmentPills, SimplePager, TH, matchQuery } from "@/components/v2/students/lists/listKit";
import {
  FEEDBACK_FROM_OPTIONS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPES,
  statusOf,
  type FeedbackRecord,
  type FeedbackStatus,
  type FeedbackType,
} from "@/components/nazorat/feedbackTypes";

// YANGI VERSIYA — NAZORAT → «FIKR-MULOHAZA» (34-qism, rasmlar «Fikr-mulohaza» va «… · qo'shish»). Shikoyat,
// taklif, maqtov — kim mas'ul va qanday hal bo'ldi. Ko'rsatkichlar, holat tabletkalari (Yangi / Ko'rib
// chiqilmoqda / Hal qilindi), qidiruv, Turi / Kimdan / Filial; jadval (qatorni bosish — holat, mas'ul, natija).
// «Fikr qo'shish» — telefon yoki yuzma-yuz aytilgan fikr. Server: /api/feedback (GET, POST, PATCH).

type Seg = "all" | FeedbackStatus;
const TYPE_PILL: Record<string, string> = {
  Shikoyat: "bg-v2-danger-bg text-v2-danger",
  Taklif: "bg-v2-info-bg text-v2-info",
  Maqtov: "bg-v2-success-bg text-v2-success",
  Boshqa: "bg-v2-surface-2 text-v2-text-2",
};
const STATUS_PILL: Record<FeedbackStatus, string> = {
  yangi: "bg-v2-warning-bg text-v2-warning",
  korib: "bg-v2-info-bg text-v2-info",
  hal: "bg-v2-success-bg text-v2-success",
};

const parseStamp = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
  return m ? { iso: `${m[1]}-${m[2]}-${m[3]}`, hm: `${m[4]}:${m[5]}`, ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) } : null;
};

export default function FeedbackV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [rows, setRows] = useState<FeedbackRecord[] | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [filial, setFilial] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<FeedbackRecord | null>(null);
  const [admins, setAdmins] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    let off = false;
    void fetch("/api/feedback", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) setRows(j.feedbacks);
        else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [ver]);

  useEffect(() => {
    void Promise.all([fetch("/api/moderators").then((r) => r.json()), fetch("/api/branches").then((r) => r.json())])
      .then(([m, b]) => {
        if (m?.ok) setAdmins((m.moderators as { name: string }[]).map((x) => x.name).filter(Boolean));
        if (b?.ok) setBranches((b.branches as { name: string }[]).map((x) => x.name).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  const all = useMemo(() => rows ?? [], [rows]);
  const filtered = useMemo(
    () => all.filter((f) => (seg === "all" || statusOf(f) === seg) && (!type || f.type === type) && (!from || f.from === from) && (!filial || f.filial === filial) && matchQuery(q, f.name, f.phone, f.izoh, f.pupilName ?? "")),
    [all, seg, type, from, filial, q],
  );
  const shown = filtered.slice((page - 1) * size, page * size);
  const cnt = (s: FeedbackStatus) => all.filter((f) => statusOf(f) === s).length;
  const byType = (ty: FeedbackType) => all.filter((f) => f.type === ty);
  const complaints = byType("Shikoyat");
  const resolved = complaints.filter((f) => statusOf(f) === "hal" && f.resolvedAt);
  const avgDays = resolved.length
    ? Math.round((resolved.reduce((a, f) => a + Math.max(0, (parseStamp(f.resolvedAt ?? "")?.ms ?? 0) - (parseStamp(f.createdAt)?.ms ?? 0)), 0) / resolved.length / 86_400_000) * 10) / 10
    : null;
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <PageShell flow>
      <PageHead
        title={t("Fikr-mulohaza")}
        subtitle={t("Shikoyat, taklif va maqtovlar — kim mas'ul va qanday hal bo'ldi")}
        actions={
          <button type="button" onClick={() => setAdd(true)} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Fikr qo'shish")}
          </button>
        }
      />
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!rows && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {rows && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile n={complaints.length} tone="bg-v2-danger-bg text-v2-danger" title={t("Shikoyat")} sub={t("{n} tasi hali ochiq", { n: complaints.filter((f) => statusOf(f) !== "hal").length })} />
            <Tile n={byType("Taklif").length} tone="bg-v2-info-bg text-v2-info" title={t("Taklif")} sub={t("{n} tasi amalga oshirildi", { n: byType("Taklif").filter((f) => statusOf(f) === "hal").length })} />
            <Tile n={byType("Maqtov").length} tone="bg-v2-success-bg text-v2-success" title={t("Maqtov")} sub={t("{n} tasi yetkazildi", { n: byType("Maqtov").filter((f) => statusOf(f) === "hal").length })} />
            <Tile n={avgDays === null ? "—" : String(avgDays).replace(".", ",")} tone="bg-v2-surface-2 text-v2-text-2" title={t("O'rtacha hal qilish")} sub={t("kun · shikoyatlar bo'yicha")} />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <SegmentPills
              items={[
                { key: "all", label: t("Hammasi"), count: all.length },
                { key: "yangi", label: t("Yangi"), count: cnt("yangi") },
                { key: "korib", label: t("Ko'rib chiqilmoqda"), count: cnt("korib") },
                { key: "hal", label: t("Hal qilindi"), count: cnt("hal") },
              ]}
              value={seg}
              onChange={reset(setSeg)}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={reset(setQ)} placeholder={t("Ism, telefon yoki matn")} />
              <V2Select variant="chip" label={t("Turi")} value={type} onChange={reset(setType)} options={FEEDBACK_TYPES.map((x) => ({ value: x, label: t(x) }))} />
              <V2Select variant="chip" label={t("Kimdan")} value={from} onChange={reset(setFrom)} options={FEEDBACK_FROM_OPTIONS.map((x) => ({ value: x, label: t(x) }))} />
              <V2Select variant="chip" label={t("Filial")} value={filial} onChange={reset(setFilial)} options={[...new Set(all.map((f) => f.filial).filter(Boolean))].map((x) => ({ value: x, label: x }))} />
            </div>
          </div>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} pl-5`}>{t("Turi")}</th>
                    <th className={TH}>{t("Kimdan")}</th>
                    <th className={TH}>{t("Mazmuni")}</th>
                    <th className={TH}>{t("Holat · mas'ul")}</th>
                    <th className={`${TH} pr-5`}>{t("Kelgan")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                        {all.length ? t("Mos fikr topilmadi") : t("Hali fikr yo'q — «Fikr qo'shish» bilan yozib qo'ying")}
                      </td>
                    </tr>
                  )}
                  {shown.map((f) => {
                    const st = statusOf(f);
                    const at = parseStamp(f.createdAt);
                    return (
                      <tr key={f.id} onClick={() => setEdit(f)} className="cursor-pointer border-b border-v2-border align-top last:border-b-0 hover:bg-v2-hover">
                        <td className="py-3 pl-5 pr-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${TYPE_PILL[f.type] ?? TYPE_PILL.Boshqa}`}>{t(f.type)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-v2-text">{f.name || t("Ismi yashirilgan")}</div>
                          <div className="text-v2-small text-v2-text-2">{[f.from ? t(f.from).toLowerCase() : "", f.pupilName].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="max-w-[28rem] px-3 py-3">
                          <div className="text-v2-text">{f.izoh}</div>
                          {f.filial && <div className="text-v2-small text-v2-text-2">{f.filial}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${STATUS_PILL[st]}`}>
                            <span className="size-1.5 rounded-full bg-current" aria-hidden />
                            {t(FEEDBACK_STATUS_LABELS[st])}
                          </span>
                          <div className={`mt-1 text-v2-small ${f.assignee ? "text-v2-text-2" : "text-v2-warning"}`}>
                            {f.assignee ? [f.assignee, f.resolution].filter(Boolean).join(" · ") : t("mas'ul tayinlanmagan")}
                          </div>
                        </td>
                        <td className="py-3 pl-3 pr-5">
                          <div className="tabular-nums text-v2-text">{at ? `${fmt.dayMonth(at.iso)} | ${at.hm}` : "—"}</div>
                          <div className="text-v2-small text-v2-text-2">{f.source ? t(f.source) : f.createdBy ? t("Admin yozdi") : ""}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <SimplePager
              total={filtered.length}
              page={page}
              pageSize={size}
              onPage={setPage}
              onPageSize={(n) => {
                setSize(n);
                setPage(1);
              }}
              note={t("yangilari tepada")}
            />
          </section>
        </>
      )}

      {add && <AddDialog admins={admins} branches={branches} onClose={() => setAdd(false)} onDone={() => setVer((v) => v + 1)} />}
      {edit && <ManageDialog f={edit} admins={admins} onClose={() => setEdit(null)} onDone={() => setVer((v) => v + 1)} />}
    </PageShell>
  );
}

function Tile({ n, tone, title, sub }: { n: number | string; tone: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-3 shadow-v2-sm sm:gap-4 sm:p-4">
      <span className={`grid size-12 shrink-0 place-items-center rounded-v2-md text-[22px] font-semibold tabular-nums ${tone}`}>{n}</span>
      <div className="min-w-0">
        <div className="font-semibold text-v2-text">{title}</div>
        <div className="text-v2-small text-v2-text-2">{sub}</div>
      </div>
    </div>
  );
}

function AddDialog({ admins, branches, onClose, onDone }: { admins: string[]; branches: string[]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [from, setFrom] = useState<string>("Ota-ona");
  const [pupil, setPupil] = useState<{ id: number; name: string; groups: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<FeedbackType>("Taklif");
  const [izoh, setIzoh] = useState("");
  const [assignee, setAssignee] = useState("");
  const [filial, setFilial] = useState(branches[0] ?? "");
  const [saving, setSaving] = useState(false);
  const needPupil = from === "O'quvchi" || from === "Ota-ona";

  async function save(close: () => void) {
    if (!izoh.trim()) return showError(t("Izohni kiriting"));
    setSaving(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        name: name.trim() || (from === "O'quvchi" ? pupil?.name ?? "" : ""),
        phone: phone ? `+998 ${phone}` : "",
        type,
        izoh,
        assignee,
        filial,
        pupilId: pupil?.id ?? null,
        pupilName: from === "Ota-ona" ? pupil?.name ?? "" : "",
        source: "Admin yozdi",
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Fikr saqlandi"));
    close();
    onDone();
  }

  return (
    <V2Dialog
      title={t("Fikr-mulohaza qo'shish")}
      subtitle={t("telefon yoki yuzma-yuz aytilgan fikrni yozib qo'ying")}
      onClose={onClose}
      saving={saving}
      dirty={!!izoh || !!name}
      width={560}
      footerStart={assignee ? <span className="text-v2-small text-v2-text-2">{t("Mas'ul ro'yxatda ko'radi")}</span> : undefined}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Fikrni saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Kimdan")}>
          <Segmented label={t("Kimdan")} value={from} onChange={setFrom} options={FEEDBACK_FROM_OPTIONS.map((x) => ({ value: x, label: t(x) }))} />
        </Field>
        {needPupil && (
          <Field label={from === "Ota-ona" ? t("Qaysi o'quvchining ota-onasi") : t("O'quvchi")}>
            {pupil ? (
              <div className="flex items-center justify-between rounded-v2-md border border-v2-border-strong px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-v2-text">{pupil.name}</div>
                  <div className="truncate text-v2-small text-v2-text-2">{pupil.groups}</div>
                </div>
                <button type="button" onClick={() => setPupil(null)} className="text-v2-small font-semibold text-v2-brand">
                  {t("O'zgartirish")}
                </button>
              </div>
            ) : (
              <StudentSearchField onPick={(s) => setPupil({ id: s.id, name: s.name, groups: s.groups })} placeholder={t("Ism yoki telefon")} />
            )}
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Ism")} optional>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls()} placeholder={from === "Ota-ona" ? t("Dildora Rahimova (onasi)") : ""} />
          </Field>
          <Field label={t("Telefon")} optional>
            <PhoneField value={phone} onChange={setPhone} />
          </Field>
        </div>
        <Field label={t("Turi")}>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map((x) => (
              <button key={x} type="button" aria-pressed={type === x} onClick={() => setType(x)} className={`h-10 rounded-full border px-4 text-v2-small font-semibold ${type === x ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border text-v2-text"}`}>
                {t(x)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("Izoh")}>
          <textarea value={izoh} onChange={(e) => setIzoh(e.target.value)} rows={3} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Mas'ul")} optional>
            <V2Select label={t("Mas'ul")} value={assignee} onChange={setAssignee} placeholder={t("Tanlanmagan")} clearable searchable="auto" options={admins.map((x) => ({ value: x, label: x }))} />
          </Field>
          <Field label={t("Filial")}>
            <V2Select label={t("Filial")} value={filial} onChange={setFilial} options={branches.map((x) => ({ value: x, label: x }))} />
          </Field>
        </div>
      </div>
    </V2Dialog>
  );
}

function ManageDialog({ f, admins, onClose, onDone }: { f: FeedbackRecord; admins: string[]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<string>(statusOf(f));
  const [assignee, setAssignee] = useState(f.assignee ?? "");
  const [resolution, setResolution] = useState(f.resolution ?? "");
  const [saving, setSaving] = useState(false);
  async function save(close: () => void) {
    setSaving(true);
    const res = await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id, status, assignee, resolution }) })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t(f.type)}
      subtitle={[f.name || t("Ismi yashirilgan"), f.filial].filter(Boolean).join(" · ")}
      onClose={onClose}
      saving={saving}
      width={520}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-body text-v2-text">{f.izoh}</p>
        <Field label={t("Holat")}>
          <Segmented label={t("Holat")} value={status} onChange={setStatus} options={(["yangi", "korib", "hal"] as FeedbackStatus[]).map((x) => ({ value: x, label: t(FEEDBACK_STATUS_LABELS[x]) }))} />
        </Field>
        <Field label={t("Mas'ul")} optional>
          <V2Select label={t("Mas'ul")} value={assignee} onChange={setAssignee} placeholder={t("Tanlanmagan")} clearable searchable="auto" options={admins.map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label={t("Natija")} optional>
          <input value={resolution} onChange={(e) => setResolution(e.target.value)} className={fieldCls()} placeholder={t("Masalan: usta chaqirildi")} />
        </Field>
      </div>
    </V2Dialog>
  );
}
