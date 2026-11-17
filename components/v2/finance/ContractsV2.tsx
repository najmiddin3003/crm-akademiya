"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, Segmented, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, SearchBox, SegmentPills, SimplePager, TH, matchQuery } from "@/components/v2/students/lists/listKit";
import { RELATION_LABELS, VIEW_LABELS, type ContractPrefill, type ContractRow, type ContractView, type SignerRelation } from "@/lib/studentContractTypes";

// YANGI VERSIYA — MOLIYA → «SHARTNOMALAR» (32-qism, rasm «Shartnomalar»). O'quvchi bilan o'qish va to'lov
// shartnomalari reyestri: Hammasi / Imzolangan / Imzo kutilmoqda / Muddati tugaydi / Bekor qilingan, qidiruv,
// filial; jadval Raqam, O'quvchi, Imzolovchi, Oylik narx, Amal qilish muddati, Holat, amal («Imzolandi»,
// «Uzaytirish», ×). «Shartnoma tuzish» oynasi. Server: /api/student-contracts (lib/studentContracts.ts).

type Seg = "all" | "signed" | "pending" | "expiring" | "cancelled";
const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");
const PILL: Record<ContractView, string> = {
  pending: "bg-v2-warning-bg text-v2-warning",
  signed: "bg-v2-success-bg text-v2-success",
  expiring: "bg-v2-info-bg text-v2-info",
  expired: "bg-v2-danger-bg text-v2-danger",
  cancelled: "bg-v2-surface-2 text-v2-text-2",
};
const inSeg = (v: ContractView, s: Seg) => s === "all" || (s === "expiring" ? v === "expiring" || v === "expired" : v === s);

export default function ContractsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [add, setAdd] = useState(false);
  const [extend, setExtend] = useState<ContractRow | null>(null);
  const [cancel, setCancel] = useState<ContractRow | null>(null);
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    let off = false;
    void fetch("/api/student-contracts", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setRows(j.contracts);
          setBranches(j.branches);
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [ver]);

  const all = useMemo(() => (rows ?? []).filter((c) => !branch || String(c.branchId) === branch), [rows, branch]);
  const filtered = useMemo(() => all.filter((c) => inSeg(c.view, seg) && matchQuery(q, c.pupilName, c.signerName, c.no, c.groupLabel)), [all, seg, q]);
  const shown = filtered.slice((page - 1) * size, page * size);
  const cnt = (s: Seg) => all.filter((c) => inSeg(c.view, s)).length;
  const reload = () => setVer((v) => v + 1);
  const bName = (id: number) => branches.find((b) => b.id === id)?.name ?? "";

  async function sign(c: ContractRow) {
    setBusy(c.id);
    const r = await fetch("/api/student-contracts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", id: c.id }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(0);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("{no} — qog'ozda imzolandi", { no: c.no }));
    reload();
  }

  function statusSub(c: ContractRow): string {
    if (c.view === "pending") return t("tuzildi · {d}", { d: fmt.dayMonth(c.createdAt.slice(0, 10)) });
    if (c.view === "cancelled") return [c.cancelledAt ? fmt.dayMonth(c.cancelledAt.slice(0, 10)) : "", c.cancelReason].filter(Boolean).join(" · ");
    const via = c.signedVia === "kabinet" ? t("kabinetda") : t("qog'ozda");
    return [via, c.signedAt ? fmt.stamp(c.signedAt.slice(0, 10), c.signedAt.slice(11, 16)) : ""].filter(Boolean).join(" · ");
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Shartnomalar")}
        subtitle={t("{b} · o'qish va to'lov shartnomalari", { b: branch ? bName(Number(branch)) : t("Barcha filiallar") })}
        actions={
          <>
            <Link href="/contract" className={secondaryBtn}>
              <FileText className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Shablon")}
            </Link>
            <button type="button" onClick={() => setAdd(true)} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Shartnoma tuzish")}
            </button>
          </>
        }
      />
      <NoticeBar>{t("Shartnoma o'quvchi guruhga yozilganda tuziladi va ota-ona (yoki 18 yoshdan katta o'quvchining o'zi) qog'ozda imzolaydi — imzolangach «Imzolandi» bosiladi.")}</NoticeBar>
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!rows && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentPills
              items={[
                { key: "all", label: t("Hammasi"), count: all.length },
                { key: "signed", label: t("Imzolangan"), count: cnt("signed") },
                { key: "pending", label: t("Imzo kutilmoqda"), count: cnt("pending") },
                { key: "expiring", label: t("Muddati tugaydi"), count: cnt("expiring") },
                { key: "cancelled", label: t("Bekor qilingan"), count: cnt("cancelled") },
              ]}
              value={seg}
              onChange={(v) => {
                setSeg(v as Seg);
                setPage(1);
              }}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SearchBox
                value={q}
                onChange={(v) => {
                  setQ(v);
                  setPage(1);
                }}
                placeholder={t("Ism yoki raqam")}
              />
              {branches.length > 1 && <V2Select variant="chip" label={t("Filial")} value={branch} onChange={setBranch} clearable options={branches.map((b) => ({ value: String(b.id), label: b.name }))} />}
            </div>
          </div>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} pl-5`}>{t("Raqam")}</th>
                    <th className={TH}>{t("O'quvchi")}</th>
                    <th className={TH}>{t("Imzolovchi")}</th>
                    <th className={`${TH} text-right`}>{t("Oylik narx")}</th>
                    <th className={TH}>{t("Amal qilish muddati")}</th>
                    <th className={TH}>{t("Holat")}</th>
                    <th className={`${TH} pr-5 text-right`}>{t("Amallar")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                        {all.length ? t("Mos shartnoma topilmadi") : t("Hali shartnoma yo'q — «Shartnoma tuzish» bilan qo'shing")}
                      </td>
                    </tr>
                  )}
                  {shown.map((c) => (
                    <tr key={c.id} className="border-b border-v2-border last:border-b-0">
                      <td className="whitespace-nowrap py-3 pl-5 pr-3 tabular-nums text-v2-text-2">{c.no}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-v2-text">{c.pupilName}</div>
                        <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
                          {c.course && <span className={`size-2 rounded-[2px] ${FAN_DOT[fanOf(c.course)]}`} aria-hidden />}
                          {[c.groupLabel, bName(c.branchId)].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-v2-text">{c.signerName}</div>
                        <div className="text-v2-small text-v2-text-2">{t(RELATION_LABELS[c.signerRelation])}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-text">{nf(c.price)}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-v2-text">
                        {fmt.ddmmyyyy(c.from)} – {fmt.ddmmyyyy(c.to)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${PILL[c.view]}`}>
                          {c.view === "expiring" ? t("{n} kunda tugaydi", { n: c.daysLeft ?? 0 }) : t(VIEW_LABELS[c.view])}
                        </span>
                        <div className="mt-0.5 text-v2-small text-v2-text-2">{statusSub(c)}</div>
                      </td>
                      <td className="py-3 pl-3 pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.view === "pending" && (
                            <button type="button" disabled={busy === c.id} onClick={() => void sign(c)} className={`${secondaryBtn} h-9 disabled:opacity-50`}>
                              {t("Imzolandi")}
                            </button>
                          )}
                          {(c.view === "expiring" || c.view === "expired") && (
                            <button type="button" onClick={() => setExtend(c)} className={`${secondaryBtn} h-9`}>
                              {t("Uzaytirish")}
                            </button>
                          )}
                          {c.view !== "cancelled" && (
                            <button type="button" onClick={() => setCancel(c)} aria-label={t("Bekor qilish")} title={t("Bekor qilish")} className="grid size-9 place-items-center rounded-v2-md text-v2-text-3 hover:bg-v2-hover hover:text-v2-danger">
                              <X className="size-4" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
            />
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            {[
              [t("Shablon"), t("Shartnoma matni — O'quv bo'limi → Shartnoma shablonlari. Narx, muddat va imzolovchi shu yerda kiritiladi.")],
              [t("Narx o'zgarsa"), t("Guruh narxi o'zgarganda eski shartnoma bekor qilinib, yangi narx bilan qaytadan tuziladi.")],
              [t("O'quvchi ketsa"), t("Shartnoma sababi bilan «Bekor qilingan» bo'ladi va ro'yxatda saqlanib qoladi.")],
            ].map(([h, b]) => (
              <div key={h} className="rounded-v2-lg border border-v2-border bg-v2-surface-2 px-4 py-3">
                <div className="font-semibold text-v2-text">{h}</div>
                <p className="mt-0.5 text-v2-small text-v2-text-2">{b}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {add && <CreateDialog onClose={() => setAdd(false)} onDone={reload} />}
      {extend && <ExtendDialog c={extend} onClose={() => setExtend(null)} onDone={reload} />}
      {cancel && <CancelDialog c={cancel} onClose={() => setCancel(null)} onDone={reload} />}
    </PageShell>
  );
}

const PAD = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
const dateOf = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

async function send(method: string, body: unknown) {
  return fetch("/api/student-contracts", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => null);
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [pre, setPre] = useState<ContractPrefill | null>(null);
  const [groupId, setGroupId] = useState("");
  const [relation, setRelation] = useState<SignerRelation>("onasi");
  const [signer, setSigner] = useState("");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState<Date | null>(new Date());
  const [to, setTo] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(id: number) {
    const r = (await fetch(`/api/student-contracts?prefill=${id}`)
      .then((x) => x.json())
      .catch(() => null)) as ContractPrefill | null;
    if (!r?.ok) return showError(t("O'quvchi topilmadi"));
    setPre(r);
    const g = r.groups[0];
    setGroupId(g ? String(g.id) : "");
    if (g?.price) setPrice(String(g.price));
    const p = r.parents[0];
    setRelation(p?.relation ?? "onasi");
    setSigner(p?.name ?? "");
    setPhone(p?.phone ?? "");
    setTo(dateOf(r.defaultTo));
  }

  function chooseRelation(v: string) {
    const rel = v as SignerRelation;
    setRelation(rel);
    const p = pre?.parents.find((x) => x.relation === rel);
    if (rel === "o'zi") {
      setSigner(pre?.pupil.name ?? "");
      setPhone(pre?.pupil.phone ?? "");
    } else if (p) {
      setSigner(p.name);
      setPhone(p.phone);
    }
  }

  async function save(close: () => void) {
    if (!pre) return showError(t("O'quvchini tanlang"));
    setSaving(true);
    const r = await send("POST", { pupilId: pre.pupil.id, groupId: groupId || null, signerRelation: relation, signerName: signer, signerPhone: phone, price: Number(price), from: from ? isoOf(from) : "", to: to ? isoOf(to) : "" });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Shartnoma tuzildi · {no}", { no: r.contract.no }));
    close();
    onDone();
  }

  return (
    <V2Dialog
      title={t("Shartnoma tuzish")}
      subtitle={t("o'qish va to'lov shartnomasi")}
      onClose={onClose}
      saving={saving}
      dirty={!!pre}
      width={580}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving || !pre} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Shartnoma tuzish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("O'quvchi")}>
          {pre ? (
            <div className="flex items-center justify-between rounded-v2-md border border-v2-border-strong px-3 py-2">
              <span className="truncate font-semibold text-v2-text">{pre.pupil.name}</span>
              <button type="button" onClick={() => setPre(null)} className="text-v2-small font-semibold text-v2-brand">
                {t("O'zgartirish")}
              </button>
            </div>
          ) : (
            <StudentSearchField onPick={(s) => void pick(s.id)} placeholder={t("Ism yoki telefon")} />
          )}
        </Field>
        {pre && (
          <>
            <Field label={t("Guruh")}>
              <V2Select
                label={t("Guruh")}
                value={groupId}
                placeholder={pre.groups.length ? t("Tanlang") : t("Guruhda emas")}
                onChange={(v) => {
                  setGroupId(v);
                  const g = pre.groups.find((x) => String(x.id) === v);
                  if (g?.price) setPrice(String(g.price));
                }}
                options={pre.groups.map((g) => ({ value: String(g.id), label: g.label }))}
              />
            </Field>
            <Field label={t("Imzolovchi")}>
              <Segmented
                label={t("Imzolovchi")}
                value={relation}
                onChange={chooseRelation}
                options={[
                  { value: "onasi", label: t("Onasi") },
                  { value: "otasi", label: t("Otasi") },
                  { value: "o'zi", label: t("O'zi (18+)") },
                  { value: "vasiy", label: t("Vasiy") },
                ]}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Imzolovchining ismi")}>
                <input value={signer} onChange={(e) => setSigner(e.target.value)} disabled={relation === "o'zi"} className={fieldCls()} />
              </Field>
              <Field label={t("Telefon")} optional>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={fieldCls()} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("Oylik narx")}>
                <MoneyField value={price} onChange={setPrice} />
              </Field>
              <Field label={t("Boshlanishi")}>
                <V2DateField value={from} onChange={setFrom} />
              </Field>
              <Field label={t("Tugashi")}>
                <V2DateField value={to} onChange={setTo} />
              </Field>
            </div>
          </>
        )}
      </div>
    </V2Dialog>
  );
}

function ExtendDialog({ c, onClose, onDone }: { c: ContractRow; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const base = dateOf(c.to);
  const [to, setTo] = useState<Date | null>(new Date(base.getFullYear() + (base.getMonth() >= 5 ? 1 : 0), 4, 31));
  const [saving, setSaving] = useState(false);
  async function save(close: () => void) {
    setSaving(true);
    const r = await send("PATCH", { action: "extend", id: c.id, to: to ? isoOf(to) : "" });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Muddat uzaytirildi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Muddatni uzaytirish")}
      subtitle={`${c.no} · ${c.pupilName}`}
      onClose={onClose}
      saving={saving}
      width={440}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Uzaytirish")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <p className="text-v2-small text-v2-text-2">{t("Hozirgi muddat: {a} – {b}", { a: fmt.ddmmyyyy(c.from), b: fmt.ddmmyyyy(c.to) })}</p>
        <Field label={t("Yangi tugash sanasi")}>
          <V2DateField value={to} onChange={setTo} />
        </Field>
      </div>
    </V2Dialog>
  );
}

function CancelDialog({ c, onClose, onDone }: { c: ContractRow; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const quick = [t("o'quvchi ketdi"), t("narx o'zgardi — qayta tuziladi"), t("xato tuzilgan")];
  async function save(close: () => void) {
    setSaving(true);
    const r = await send("PATCH", { action: "cancel", id: c.id, reason });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Shartnoma bekor qilindi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Shartnomani bekor qilish")}
      subtitle={`${c.no} · ${c.pupilName}`}
      onClose={onClose}
      saving={saving}
      dirty={!!reason}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Orqaga")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving || !reason.trim()} className="inline-flex h-10 items-center rounded-v2-md bg-v2-danger px-4 font-semibold text-white disabled:opacity-50">
            {t("Bekor qilish")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label={t("Sabab")}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldCls()} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {quick.map((x) => (
            <button key={x} type="button" onClick={() => setReason(x)} className="h-8 rounded-full border border-v2-border px-3 text-v2-small text-v2-text">
              {x}
            </button>
          ))}
        </div>
      </div>
    </V2Dialog>
  );
}
