"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Gift, Info, Link2, Loader2, Plus, Settings, Tag, Ticket, UserPlus } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, NoticeBar, PageHead, PageShell, SearchBox, SegmentPills, SimplePager, TH, matchQuery } from "@/components/v2/students/lists/listKit";
import {
  REF_KINDS,
  REF_KIND_LABELS,
  REF_STATE_LABELS,
  REF_VIA_LABELS,
  type LinkRow,
  type RefKind,
  type RefState,
  type RefVia,
  type ReferralsPayload,
  type ReferrerRow,
} from "@/lib/referralTypes";

// YANGI VERSIYA — SOTUV VA MARKETING → «REFERALLAR» (29-qism). Taklif qilingan o'quvchi birinchi oyini to'liq
// to'lasa — taklif qilganga +1 referal; referallar sovg'aga almashtiriladi. Tablar: Taklif qiluvchilar,
// Taklif qilinganlar, Sovg'alar va so'rovlar. O'ng panel — taklif qiluvchi (balans, so'rov, sovg'alar, kod, QR
// havola, takliflari). Oynalar: taklif qiluvchi qo'shish, referal biriktirish, sovg'a, rad etish.
// Server: /api/referrals (lib/referrals.ts).

type Tab = "referrers" | "links" | "gifts";
type Data = ReferralsPayload;
const KIND_PILL: Record<RefKind, string> = {
  ustoz: "bg-v2-info-bg text-v2-info",
  oquvchi: "bg-v2-success-bg text-v2-success",
  "ota-ona": "bg-v2-violet-bg text-v2-violet",
  boshqa: "bg-v2-surface-2 text-v2-text-2",
};
const STATE_PILL: Record<RefState, string> = {
  lid: "bg-v2-surface-2 text-v2-text-2",
  sinov: "bg-v2-info-bg text-v2-info",
  guruh: "bg-v2-info-bg text-v2-info",
  qisman: "bg-v2-warning-bg text-v2-warning",
  hisoblandi: "bg-v2-success-bg text-v2-success",
  rad: "bg-v2-danger-bg text-v2-danger",
};
const VIA_ICON: Record<RefVia, typeof Tag> = { kod: Tag, havola: Link2, tavsiya: UserPlus, sertifikat: Ticket };

async function api(body: Record<string, unknown>) {
  return fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => null);
}
const refLink = (code: string) => (typeof window === "undefined" ? `/sorovnoma?ref=${code}` : `${window.location.origin}/sorovnoma?ref=${code}`);

function KindBadge({ kind }: { kind: RefKind }) {
  const { t } = useT();
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-caption font-semibold ${KIND_PILL[kind]}`}>{t(REF_KIND_LABELS[kind])}</span>;
}

/** Keyingi sovg'a: eng arzon yetmaydigani (progress) yoki hozir olish mumkin bo'lgan eng qimmati. */
function nextGift(r: ReferrerRow, gifts: Data["gifts"]) {
  const active = gifts.filter((g) => g.active && g.stock > 0);
  const can = active.filter((g) => g.price <= r.balance).sort((a, b) => b.price - a.price)[0];
  const next = active.filter((g) => g.price > r.balance).sort((a, b) => a.price - b.price)[0];
  return { can, next };
}

export default function ReferralsV2() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("referrers");
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [addRef, setAddRef] = useState(false);
  const [linkFor, setLinkFor] = useState(false);
  const reload = () => setVer((v) => v + 1);

  useEffect(() => {
    let off = false;
    void fetch("/api/referrals", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setD(j);
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [ver]);

  const k = d?.kpi;
  const current = d?.referrers.find((r) => r.id === open) ?? null;

  return (
    <PageShell flow>
      <PageHead
        title={t("Referallar")}
        subtitle={t("Taklif qilingan o'quvchi birinchi oyini to'liq to'lasa, taklif qilganga +1 referal · referallar sovg'aga almashtiriladi")}
        actions={
          <>
            <Link href="/settings-referral" className={secondaryBtn}>
              <Settings className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Qoidalar")}
            </Link>
            <button type="button" onClick={() => setAddRef(true)} className={primaryBtn}>
              <UserPlus className="size-4" strokeWidth={2} aria-hidden />
              {t("Taklif qiluvchi qo'shish")}
            </button>
          </>
        }
      />
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!d && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {d && k && (
        <>
          <section className="grid grid-cols-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm xl:grid-cols-4">
            <Kpi label={t("Taklif qiluvchilar")} value={k.referrers} sub={REF_KINDS.filter((x) => k.byKind[x]).map((x) => `${k.byKind[x]} ${t(REF_KIND_LABELS[x]).toLowerCase()}`).join(" · ") || "—"} />
            <Kpi label={t("Taklif qilinganlar")} value={k.invited} sub={t("{n} tasi to'lov qildi · {p}%", { n: k.paid, p: k.invited ? Math.round((k.paid / k.invited) * 100) : 0 })} />
            <Kpi label={t("Hisoblangan referallar")} value={k.counted} sub={t("shu oyda {a} · o'tgan oyda {b}", { a: k.thisMonth, b: k.prevMonth })} />
            <Kpi label={t("Sovg'alar")} value={k.pendingRequests} unit={t("so'rov")} icon sub={t("{a} tasi berildi · balanslarda {b} referal", { a: k.given, b: k.balances })} />
          </section>

          <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-v2-border px-1">
            {(
              [
                ["referrers", t("Taklif qiluvchilar"), String(d.referrers.length)],
                ["links", t("Taklif qilinganlar"), String(d.links.length)],
                ["gifts", t("Sovg'alar va so'rovlar"), k.pendingRequests ? t("{n} yangi", { n: k.pendingRequests }) : ""],
              ] as [Tab, string, string][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-v2-body font-semibold ${tab === key ? "border-v2-brand text-v2-text" : "border-transparent text-v2-text-2 hover:text-v2-text"}`}
              >
                {label}
                {count && <span className={`rounded-full px-1.5 text-v2-caption ${key === "gifts" ? "bg-v2-brand text-white" : "text-v2-text-3"}`}>{count}</span>}
              </button>
            ))}
          </div>

          {tab === "referrers" && <ReferrersTab d={d} onOpen={setOpen} />}
          {tab === "links" && <LinksTab d={d} onLink={() => setLinkFor(true)} />}
          {tab === "gifts" && <GiftsTab d={d} onChange={reload} />}
        </>
      )}

      {current && d && <ReferrerDrawer r={current} d={d} onClose={() => setOpen(null)} onChange={reload} />}
      {addRef && d && <AddReferrerDialog d={d} onClose={() => setAddRef(false)} onDone={reload} />}
      {linkFor && d && <LinkDialog d={d} onClose={() => setLinkFor(false)} onDone={reload} />}
    </PageShell>
  );
}

function Kpi({ label, value, sub, unit, icon }: { label: string; value: number; sub: string; unit?: string; icon?: boolean }) {
  return (
    <div className="border-v2-border p-4 [&:nth-child(-n+2)]:border-b xl:border-r xl:last:border-r-0 xl:[&:nth-child(-n+2)]:border-b-0 [&:nth-child(odd)]:border-r">
      <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
        {icon && <Gift className="size-3.5 text-v2-warning" aria-hidden />}
        {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold leading-8 tabular-nums text-v2-text">
        {value} {unit && <span className="text-v2-small font-normal text-v2-text-2">{unit}</span>}
      </div>
      <div className="mt-0.5 truncate text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

// ─────────────────────────── Taklif qiluvchilar ───────────────────────────

function ReferrersTab({ d, onOpen }: { d: Data; onOpen: (id: number) => void }) {
  const { t } = useT();
  const [kind, setKind] = useState<"all" | RefKind>("all");
  const [branch, setBranch] = useState("");
  const [q, setQ] = useState("");
  const rows = d.referrers
    .filter((r) => (kind === "all" || r.kind === kind) && (!branch || String(r.branchId) === branch) && matchQuery(q, r.name, r.phone, r.code, r.note))
    .sort((a, b) => b.balance - a.balance || b.invited - a.invited);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentPills
          items={[{ key: "all", label: t("Hammasi"), count: d.referrers.length }, ...REF_KINDS.map((x) => ({ key: x, label: t(REF_KIND_LABELS[x]), count: d.referrers.filter((r) => r.kind === x).length }))]}
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {d.branches.length > 1 && <V2Select variant="chip" label={t("Filial")} value={branch} onChange={setBranch} clearable options={d.branches.map((b) => ({ value: String(b.id), label: b.name }))} />}
          <SearchBox value={q} onChange={setQ} placeholder={t("Ism, telefon yoki kod")} />
        </div>
      </div>
      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("Taklif qiluvchi")}</th>
                <th className={TH}>{t("Filial")}</th>
                <th className={TH}>{t("Kod")}</th>
                <th className={`${TH} text-right`}>{t("Taklif qildi")}</th>
                <th className={`${TH} text-right`}>{t("To'lov qildi")}</th>
                <th className={`${TH} text-right`}>{t("Balans")}</th>
                <th className={`${TH} pr-5`}>{t("Keyingi sovg'a")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                    {d.referrers.length ? t("Mos taklif qiluvchi topilmadi") : t("Hali taklif qiluvchi yo'q — «Taklif qiluvchi qo'shish» bilan boshlang")}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const { can, next } = nextGift(r, d.gifts);
                return (
                  <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover">
                    <td className="py-2.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-v2-text">{r.name}</div>
                          <div className="flex items-center gap-1.5 truncate text-v2-small text-v2-text-2">
                            <KindBadge kind={r.kind} />
                            <span className="truncate">{r.note}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-v2-text">{r.branchName}</td>
                    <td className="px-3 py-2.5">
                      <code className="rounded-v2-sm border border-v2-border bg-v2-surface-2 px-2 py-0.5 text-v2-small font-semibold tracking-wide text-v2-text">{r.code}</code>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{r.invited}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{r.counted}</td>
                    <td className="px-3 py-2.5 text-right text-[16px] font-semibold tabular-nums text-v2-text">{r.balance}</td>
                    <td className="py-2.5 pl-3 pr-5">
                      {r.pending ? (
                        <>
                          <span className="inline-flex rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-small font-semibold text-v2-warning">{t("So'rov: {g}", { g: d.gifts.find((g) => g.id === r.pending!.giftId)?.name ?? "" })}</span>
                          <div className="text-v2-small text-v2-text-2">{t("tasdiq kutilmoqda · {a} → {b}", { a: r.balance, b: r.balance - r.pending.price })}</div>
                        </>
                      ) : next ? (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-v2-surface-2">
                              <div className="h-full bg-v2-brand" style={{ width: `${Math.min(100, (Math.max(0, r.balance) / next.price) * 100)}%` }} />
                            </div>
                            <span className="truncate text-v2-small text-v2-text-2">
                              {next.name} · {Math.max(0, r.balance)} / {next.price}
                            </span>
                          </div>
                          {can && <div className="text-v2-small font-semibold text-v2-success">{t("olishi mumkin: {g}", { g: can.name })}</div>}
                        </>
                      ) : can ? (
                        <span className="text-v2-small font-semibold text-v2-success">{t("olishi mumkin: {g}", { g: can.name })}</span>
                      ) : (
                        <span className="text-v2-small text-v2-text-3">{d.gifts.length ? "—" : t("do'konda sovg'a yo'q")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="flex items-start gap-2 text-v2-small text-v2-text-2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("Referal — taklif qilingan o'quvchi birinchi oyini to'liq to'laganda avtomatik yoziladi (kassadagi to'lovdan). Balans — hisoblangan referallar, sovg'a olinganda narxicha sarflanadi.")}
      </p>
    </>
  );
}

// ─────────────────────────── Taklif qilinganlar ───────────────────────────

type LinkSeg = "all" | "counted" | "waiting" | "rad";
function LinksTab({ d, onLink }: { d: Data; onLink: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [seg, setSeg] = useState<LinkSeg>("all");
  const [branch, setBranch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(12);
  const inSeg = (l: LinkRow, s: LinkSeg) => s === "all" || (s === "counted" ? l.state === "hisoblandi" : s === "rad" ? l.state === "rad" : l.state !== "hisoblandi" && l.state !== "rad");
  const rows = d.links.filter((l) => inSeg(l, seg) && (!branch || l.branchName === d.branches.find((b) => String(b.id) === branch)?.name) && matchQuery(q, l.name, l.phone, l.referrerName, l.cert));
  const shown = rows.slice((page - 1) * size, page * size);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentPills
          items={[
            { key: "all", label: t("Hammasi"), count: d.links.length },
            { key: "counted", label: t("Hisoblangan"), count: d.links.filter((l) => inSeg(l, "counted")).length },
            { key: "waiting", label: t("Kutilmoqda"), count: d.links.filter((l) => inSeg(l, "waiting")).length },
            { key: "rad", label: t("Rad etdi"), count: d.links.filter((l) => inSeg(l, "rad")).length },
          ]}
          value={seg}
          onChange={(v) => {
            setSeg(v as LinkSeg);
            setPage(1);
          }}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {d.branches.length > 1 && <V2Select variant="chip" label={t("Filial")} value={branch} onChange={setBranch} clearable options={d.branches.map((b) => ({ value: String(b.id), label: b.name }))} />}
          <SearchBox value={q} onChange={setQ} placeholder={t("O'quvchi yoki taklif qiluvchi")} />
          <button type="button" onClick={onLink} className={secondaryBtn}>
            <Link2 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qo'lda biriktirish")}
          </button>
        </div>
      </div>
      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("O'quvchi")}</th>
                <th className={TH}>{t("Filial")}</th>
                <th className={TH}>{t("Kim taklif qildi")}</th>
                <th className={TH}>{t("Qanday")}</th>
                <th className={TH}>{t("Holat")}</th>
                <th className={`${TH} pr-5`}>{t("Taklif sanasi")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                    {d.links.length ? t("Mos taklif topilmadi") : t("Hali taklif yo'q — kod/havola bilan kelgan lidlar o'zi tushadi yoki «Qo'lda biriktirish»")}
                  </td>
                </tr>
              )}
              {shown.map((l) => {
                const Icon = VIA_ICON[l.via];
                return (
                  <tr key={l.id} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.name || "?"} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-v2-text">{l.name || "—"}</div>
                          <div className="truncate text-v2-small text-v2-text-2">{l.groupLabel || t("guruh tanlanmagan")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-v2-text">{l.branchName}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-v2-text">{l.referrerName}</div>
                      <KindBadge kind={l.referrerKind} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-v2-text">
                        <Icon className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                        {l.via === "sertifikat" && l.cert ? l.cert : t(REF_VIA_LABELS[l.via])}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold ${STATE_PILL[l.state]}`}>
                        {l.state === "hisoblandi" && l.countedAt ? t("+1 · {d}", { d: fmt.dayMonth(l.countedAt) }) : t(REF_STATE_LABELS[l.state])}
                      </span>
                      <div className="text-v2-small text-v2-text-2">{t(l.stateSub)}</div>
                    </td>
                    <td className="py-2.5 pl-3 pr-5 tabular-nums text-v2-text">{fmt.dayMonth(l.createdAt.slice(0, 10))}</td>
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
          note={t("eng yangisi tepada")}
        />
      </section>
      <p className="flex items-start gap-2 text-v2-small text-v2-text-2">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("Holat o'zi yangilanadi: lid → birinchi dars → guruh → to'lov. Havola (so'rovnoma) bilan kelgan lid taklif qiluvchiga avtomatik yoziladi; kod yoki sertifikat aytilsa — «Qo'lda biriktirish».")}
      </p>
    </>
  );
}

// ─────────────────────────── Sovg'alar va so'rovlar ───────────────────────────

function GiftsTab({ d, onChange }: { d: Data; onChange: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [gift, setGift] = useState<Data["gifts"][number] | "new" | null>(null);
  const [reject, setReject] = useState<number | null>(null);
  const pending = d.requests.filter((q) => q.status === "pending");
  const given = d.requests.filter((q) => q.status === "approved");
  async function approve(id: number) {
    const r = await api({ action: "decide", id, approve: true });
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Sovg'a berildi"));
    onChange();
  }
  return (
    <>
      <NoticeBar>{t("Tasdiqlansa, sovg'a narxicha referal balansdan ayiriladi va qoldiq kamayadi. Olinmagan referallar yig'ilib boradi — balans oshgani sari kattaroq sovg'a ochiladi.")}</NoticeBar>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <h2 className="px-5 py-4 text-v2-section text-v2-text">
          {t("Yangi so'rovlar")} <span className="text-v2-small font-normal text-v2-text-3">{t("{n} ta", { n: pending.length })}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Kutilayotgan so'rov yo'q")}</p>
        ) : (
          <div className="overflow-x-auto border-t border-v2-border">
            <table className="w-full min-w-[820px] border-collapse text-v2-body">
              <thead>
                <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                  <th className={`${TH} pl-5`}>{t("Taklif qiluvchi")}</th>
                  <th className={TH}>{t("Sovg'a")}</th>
                  <th className={TH}>{t("Narx")}</th>
                  <th className={TH}>{t("Balans, referal")}</th>
                  <th className={TH}>{t("So'rov vaqti")}</th>
                  <th className={`${TH} pr-5`} />
                </tr>
              </thead>
              <tbody>
                {pending.map((q) => (
                  <tr key={q.id} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pl-5 pr-3">
                      <div className="font-semibold text-v2-text">{q.referrerName}</div>
                      <KindBadge kind={q.referrerKind} />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-v2-text">{q.giftName}</td>
                    <td className="px-3 py-2.5 text-v2-text">{t("{n} referal", { n: q.price })}</td>
                    <td className={`px-3 py-2.5 tabular-nums ${q.balance < q.price ? "text-v2-danger" : "text-v2-text"}`}>
                      {q.balance} → {q.balance - q.price}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-v2-text">{fmt.stamp(q.createdAt.slice(0, 10), q.createdAt.slice(11, 16))}</td>
                    <td className="py-2.5 pl-3 pr-5">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setReject(q.id)} className={`${secondaryBtn} h-9`}>
                          {t("Rad etish")}
                        </button>
                        <button type="button" onClick={() => void approve(q.id)} disabled={q.balance < q.price} className={`${primaryBtn} h-9 disabled:opacity-50`}>
                          <Check className="size-4" aria-hidden /> {t("Tasdiqlash")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-v2-section text-v2-text">
          {t("Referal do'koni")} <span className="text-v2-small font-normal text-v2-text-3">{t("{n} ta sovg'a · narxi referal sonida", { n: d.gifts.length })}</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {d.gifts.map((g) => (
            <div key={g.id} className={`flex flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${g.active ? "" : "opacity-60"}`}>
              <div className="relative grid h-24 place-items-center bg-v2-brand-bg">
                <span className="absolute left-3 top-3 rounded-full bg-v2-surface px-2 py-0.5 text-v2-caption font-semibold text-v2-text">{t("{n} referal", { n: g.price })}</span>
                <Gift className="size-9 text-v2-brand" strokeWidth={1.5} aria-hidden />
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="font-semibold text-v2-text">{g.name}</div>
                {g.desc && <div className="text-v2-small text-v2-text-2">{g.desc}</div>}
                <div className={`mt-1 text-v2-small ${g.stock ? "text-v2-text-2" : "text-v2-danger"}`}>{t("qoldiq {a} ta · berilgan {b}", { a: g.stock, b: g.given })}</div>
                <div className="text-v2-small text-v2-text-2">{t("{n} kishi hozir ola oladi", { n: g.canTake })}</div>
                <button type="button" onClick={() => setGift(g)} className={`${secondaryBtn} mt-3 h-9 w-fit`}>
                  {t("Tahrirlash")}
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setGift("new")} className="grid min-h-48 place-items-center rounded-v2-lg border border-dashed border-v2-border-strong p-4 text-center text-v2-text-2 hover:bg-v2-hover">
            <span>
              <Plus className="mx-auto size-6 text-v2-brand" aria-hidden />
              <span className="mt-1 block font-semibold text-v2-brand">{t("Sovg'a qo'shish")}</span>
              <span className="text-v2-small">{t("nomi, narxi (referal), qoldig'i")}</span>
            </span>
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <h2 className="px-5 py-4 text-v2-section text-v2-text">
          {t("Berilgan sovg'alar")} <span className="text-v2-small font-normal text-v2-text-3">{t("{n} ta", { n: given.length })}</span>
        </h2>
        {given.length === 0 ? (
          <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Hali sovg'a berilmagan")}</p>
        ) : (
          <div className="overflow-x-auto border-t border-v2-border">
            <table className="w-full min-w-[720px] border-collapse text-v2-body">
              <thead>
                <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                  <th className={`${TH} pl-5`}>{t("Taklif qiluvchi")}</th>
                  <th className={TH}>{t("Sovg'a")}</th>
                  <th className={TH}>{t("Narx")}</th>
                  <th className={TH}>{t("Topshirildi")}</th>
                  <th className={`${TH} pr-5`}>{t("Kim topshirdi")}</th>
                </tr>
              </thead>
              <tbody>
                {given.map((q) => (
                  <tr key={q.id} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pl-5 pr-3">
                      <div className="font-semibold text-v2-text">{q.referrerName}</div>
                      <KindBadge kind={q.referrerKind} />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-v2-text">{q.giftName}</td>
                    <td className="px-3 py-2.5 text-v2-text">{t("{n} referal sarflandi", { n: q.price })}</td>
                    <td className="px-3 py-2.5 tabular-nums text-v2-text">{q.decidedAt ? fmt.stamp(q.decidedAt.slice(0, 10), q.decidedAt.slice(11, 16)) : "—"}</td>
                    <td className="py-2.5 pl-3 pr-5 text-v2-text">{q.decidedBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {gift && <GiftDialog g={gift === "new" ? null : gift} onClose={() => setGift(null)} onDone={onChange} />}
      {reject !== null && <RejectDialog id={reject} onClose={() => setReject(null)} onDone={onChange} />}
    </>
  );
}

// ─────────────────────────── Taklif qiluvchi paneli ───────────────────────────

function ReferrerDrawer({ r, d, onClose, onChange }: { r: ReferrerRow; d: Data; onClose: () => void; onChange: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [qr, setQr] = useState("");
  const [reject, setReject] = useState(false);
  const link = refLink(r.code);
  const links = d.links.filter((l) => l.referrerId === r.id);
  const pendingGift = r.pending ? d.gifts.find((g) => g.id === r.pending!.giftId) : null;

  useEffect(() => {
    void QRCode.toDataURL(link, { margin: 1, width: 240 }).then(setQr).catch(() => {});
  }, [link]);

  async function run(body: Record<string, unknown>, ok: string) {
    const res = await api(body);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(ok);
    onChange();
  }
  const copy = (v: string) => {
    void navigator.clipboard?.writeText(v).then(() => showSuccess(t("Nusxalandi")));
  };

  return (
    <V2Dialog variant="right" width={560} title={r.name} subtitle={[t(REF_KIND_LABELS[r.kind]), r.note].filter(Boolean).join(" · ")} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-v2-small text-v2-text-2">{[r.phone, r.branchName].filter(Boolean).join(" · ")}</p>
        <div className="grid grid-cols-3 overflow-hidden rounded-v2-lg border border-v2-border">
          {[
            [t("Balans"), r.balance, t("referal · {n} tasi sarflangan", { n: r.spent })],
            [t("Taklif qildi"), r.invited, t("{n} tasi lid", { n: links.filter((l) => l.state === "lid").length })],
            [t("To'lov qildi"), r.counted, t("{n} taklifdan", { n: r.invited })],
          ].map(([a, b, c], i) => (
            <div key={i} className="border-v2-border p-3 [&:not(:last-child)]:border-r">
              <div className="text-v2-small text-v2-text-2">{a}</div>
              <div className="text-[22px] font-semibold tabular-nums text-v2-text">{b}</div>
              <div className="text-v2-caption text-v2-text-3">{c}</div>
            </div>
          ))}
        </div>

        {r.pending && pendingGift && (
          <div className="rounded-v2-lg border border-v2-warning bg-v2-warning-bg p-4">
            <div className="text-v2-small text-v2-warning">{t("Sovg'a so'radi · {d}", { d: fmt.stamp(r.pending.createdAt.slice(0, 10), r.pending.createdAt.slice(11, 16)) })}</div>
            <div className="font-semibold text-v2-text">{pendingGift.name}</div>
            <div className="text-v2-small text-v2-text-2">{t("{p} referal · balans {a} → {b} · qoldiq {s} ta", { p: r.pending.price, a: r.balance, b: r.balance - r.pending.price, s: pendingGift.stock })}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setReject(true)} className={`${secondaryBtn} justify-center`}>
                {t("Rad etish")}
              </button>
              <button type="button" onClick={() => void run({ action: "decide", id: r.pending!.id, approve: true }, t("Sovg'a berildi"))} disabled={r.balance < r.pending.price} className={`${primaryBtn} justify-center disabled:opacity-50`}>
                <Check className="size-4" aria-hidden /> {t("Tasdiqlash")}
              </button>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 font-semibold text-v2-text">{t("Sovg'alar")}</h3>
          {d.gifts.length === 0 && <p className="text-v2-small text-v2-text-3">{t("Do'konda sovg'a yo'q — «Sovg'alar va so'rovlar» tabida qo'shing")}</p>}
          <ul className="divide-y divide-v2-border rounded-v2-md border border-v2-border">
            {d.gifts
              .filter((g) => g.active)
              .map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Gift className="size-4 shrink-0 text-v2-text-2" aria-hidden />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-v2-text">{g.name}</div>
                      <div className="text-v2-small text-v2-text-2">{t("{n} referal", { n: g.price })}</div>
                    </div>
                  </div>
                  {r.pending?.giftId === g.id ? (
                    <span className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-small font-semibold text-v2-warning">{t("So'radi")}</span>
                  ) : r.balance >= g.price && g.stock > 0 && !r.pending ? (
                    <button type="button" onClick={() => void run({ action: "give", referrerId: r.id, giftId: g.id }, t("Sovg'a berildi"))} className={`${secondaryBtn} h-8`}>
                      {t("Berish")}
                    </button>
                  ) : (
                    <span className="text-v2-small text-v2-text-2">{g.stock ? t("yana {n} ta", { n: g.price - Math.max(0, r.balance) }) : t("qolmagan")}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-v2-text">{t("Kod va havola")}</h3>
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL (QR), optimallashtirish kerak emas */}
            {qr && <img src={qr} alt={t("QR kod")} className="size-28 shrink-0 rounded-v2-md border border-v2-border bg-white p-1" />}
            <div className="min-w-0 flex-1 space-y-2">
              <CopyRow label={t("Kod")} value={r.code} onCopy={copy} />
              <CopyRow label={t("Havola")} value={link} onCopy={copy} />
            </div>
          </div>
          <p className="mt-2 text-v2-small text-v2-text-2">{t("Havola ochiq so'rovnoma sahifasiga olib boradi — to'ldirilgan ariza taklif qiluvchiga o'zi yoziladi.")}</p>
        </div>

        <div>
          <h3 className="mb-2 flex items-center justify-between font-semibold text-v2-text">
            {t("Takliflari")} <span className="text-v2-small font-normal text-v2-text-3">{t("{n} ta", { n: links.length })}</span>
          </h3>
          {links.length === 0 && <p className="text-v2-small text-v2-text-3">{t("Hali taklif yo'q")}</p>}
          <ul className="divide-y divide-v2-border">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-v2-text">{l.name}</div>
                  <div className="truncate text-v2-small text-v2-text-2">
                    {[l.groupLabel || t("guruh yo'q"), t(REF_VIA_LABELS[l.via])].join(" · ")}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-v2-small font-semibold ${STATE_PILL[l.state]}`}>{l.state === "hisoblandi" ? "+1" : t(REF_STATE_LABELS[l.state])}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {reject && r.pending && <RejectDialog id={r.pending.id} onClose={() => setReject(false)} onDone={onChange} />}
    </V2Dialog>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div>
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="flex items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-semibold text-v2-text">{value}</span>
        <button type="button" onClick={() => onCopy(value)} aria-label={label} className="text-v2-text-2 hover:text-v2-text">
          <Copy className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Oynalar ───────────────────────────

function AddReferrerDialog({ d, onClose, onDone }: { d: Data; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const kinds = REF_KINDS.filter((k) => d.settings.kinds[k]);
  const [kind, setKind] = useState<RefKind>(kinds[0] ?? "ustoz");
  const [pupil, setPupil] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [branch, setBranch] = useState(String(d.branches[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  async function save(close: () => void) {
    setSaving(true);
    const r = await api({ action: "referrer", kind, pupilId: kind === "oquvchi" ? pupil?.id : null, name: kind === "oquvchi" ? (pupil?.name ?? "") : name, phone: kind === "oquvchi" ? (pupil?.phone ?? "") : phone, note, branchId: Number(branch) });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Qo'shildi · kod {c}", { c: r.referrer.code }));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Taklif qiluvchi qo'shish")}
      subtitle={t("kod avtomatik beriladi")}
      onClose={onClose}
      saving={saving}
      dirty={!!name || !!pupil}
      width={520}
      footer={(api2) => (
        <>
          <button type="button" onClick={api2.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api2.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Kim")}>
          <Segmented label={t("Kim")} value={kind} onChange={(v) => setKind(v as RefKind)} options={kinds.map((k) => ({ value: k, label: t(REF_KIND_LABELS[k]) }))} />
        </Field>
        {kind === "oquvchi" ? (
          <Field label={t("O'quvchi")}>
            {pupil ? (
              <div className="flex items-center justify-between rounded-v2-md border border-v2-border-strong px-3 py-2">
                <span className="truncate font-semibold text-v2-text">{pupil.name}</span>
                <button type="button" onClick={() => setPupil(null)} className="text-v2-small font-semibold text-v2-brand">
                  {t("O'zgartirish")}
                </button>
              </div>
            ) : (
              <StudentSearchField onPick={(s) => setPupil({ id: s.id, name: s.name, phone: s.phone })} placeholder={t("Ism yoki telefon")} />
            )}
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Ism familiya")}>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls()} />
            </Field>
            <Field label={t("Telefon")} optional>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={fieldCls()} />
            </Field>
          </div>
        )}
        <Field label={t("Izoh")} optional>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls()} placeholder={kind === "ustoz" ? t("Masalan: Chortoq, 7-maktab · ingliz tili") : ""} />
        </Field>
        {d.branches.length > 1 && (
          <Field label={t("Filial")}>
            <V2Select label={t("Filial")} value={branch} onChange={setBranch} options={d.branches.map((b) => ({ value: String(b.id), label: b.name }))} />
          </Field>
        )}
      </div>
    </V2Dialog>
  );
}

interface Person {
  key: string;
  leadId: number | null;
  pupilId: number | null;
  name: string;
  sub: string;
}

function LinkDialog({ d, onClose, onDone }: { d: Data; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; list: Person[] }>({ q: "", list: [] });
  const [person, setPerson] = useState<Person | null>(null);
  const [referrer, setReferrer] = useState("");
  const [via, setVia] = useState<RefVia>("tavsiya");
  const [cert, setCert] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = d.referrers.find((r) => String(r.id) === referrer);
  const ways: { v: RefVia; label: string; sub: string }[] = [
    { v: "tavsiya", label: t("Tavsiya qildi"), sub: t("kod aytilmagan") },
    { v: "kod", label: t("Kodni aytdi"), sub: t("arizada yo'q") },
    ...(d.settings.certificates ? [{ v: "sertifikat" as RefVia, label: t("Sertifikat"), sub: t("raqamini kiritasiz") }] : []),
  ];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const id = window.setTimeout(() => {
      void fetch(`/api/referrals?search=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!alive || !j?.ok) return;
          const list: Person[] = [
            ...(j.pupils as { id: number; name: string; phone: string; status: string }[]).map((p) => ({ key: `p${p.id}`, leadId: null, pupilId: p.id, name: p.name, sub: [t("o'quvchi"), p.status, p.phone].filter(Boolean).join(" · ") })),
            ...(j.leads as { id: number; name: string; phone: string; source: string; createdAt: string; pupilId: number | null }[])
              .filter((l) => !l.pupilId)
              .map((l) => ({ key: `l${l.id}`, leadId: l.id, pupilId: null, name: l.name, sub: [t("lid"), l.source, l.createdAt.split("|")[0].trim(), l.phone].filter(Boolean).join(" · ") })),
          ];
          setFound({ q: term, list });
        })
        .catch(() => {});
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [q, t]);
  const list = q.trim().length >= 2 && found.q === q.trim() ? found.list : [];

  async function save(close: () => void) {
    if (!person) return showError(t("O'quvchi yoki lidni tanlang"));
    setSaving(true);
    const r = await api({ action: "link", referrerId: Number(referrer), leadId: person.leadId, pupilId: person.pupilId, via, cert, note });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Biriktirildi"));
    close();
    onDone();
  }

  return (
    <V2Dialog
      title={t("Referal biriktirish")}
      subtitle={t("Kod yoki havolasiz kelgan, lekin kim tavsiya qilgani ma'lum bo'lsa")}
      onClose={onClose}
      saving={saving}
      dirty={!!person || !!referrer}
      width={560}
      footer={(api2) => (
        <>
          <button type="button" onClick={api2.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api2.close)} disabled={saving || !person || !referrer} className={`${primaryBtn} disabled:opacity-50`}>
            <Link2 className="size-4" aria-hidden /> {t("Biriktirish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("O'quvchi yoki lid")}>
          {person ? (
            <div className="flex items-center justify-between rounded-v2-md border border-v2-border-strong px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-semibold text-v2-text">{person.name}</div>
                <div className="truncate text-v2-small text-v2-text-2">{person.sub}</div>
              </div>
              <button type="button" onClick={() => setPerson(null)} className="text-v2-small font-semibold text-v2-brand">
                {t("O'zgartirish")}
              </button>
            </div>
          ) : (
            <div>
              <input value={q} onChange={(e) => setQ(e.target.value)} className={fieldCls()} placeholder={t("Ism yoki telefon")} />
              {list.length > 0 && (
                <ul className="mt-1 max-h-56 divide-y divide-v2-border overflow-auto rounded-v2-md border border-v2-border">
                  {list.map((p) => (
                    <li key={p.key}>
                      <button type="button" onClick={() => setPerson(p)} className="w-full px-3 py-2 text-left hover:bg-v2-hover">
                        <div className="font-semibold text-v2-text">{p.name}</div>
                        <div className="text-v2-small text-v2-text-2">{p.sub}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>
        <Field label={t("Kim taklif qildi")}>
          <V2Select
            label={t("Kim taklif qildi")}
            value={referrer}
            onChange={setReferrer}
            searchable="auto"
            placeholder={t("Tanlang")}
            options={d.referrers.map((r) => ({ value: String(r.id), label: `${r.name} · ${t(REF_KIND_LABELS[r.kind])} · ${r.code}` }))}
          />
        </Field>
        <Field label={t("Qanday")}>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
            {ways.map((w) => (
              <button
                key={w.v}
                type="button"
                role="radio"
                aria-checked={via === w.v}
                onClick={() => setVia(w.v)}
                className={`rounded-v2-md border px-3 py-2 text-left ${via === w.v ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border"}`}
              >
                <div className="font-semibold text-v2-text">{w.label}</div>
                <div className="text-v2-small text-v2-text-2">{w.sub}</div>
              </button>
            ))}
          </div>
        </Field>
        {via === "sertifikat" && (
          <Field label={t("Sertifikat raqami")}>
            <input value={cert} onChange={(e) => setCert(e.target.value)} className={fieldCls()} placeholder="RS-0138" />
          </Field>
        )}
        <Field label={t("Izoh")} optional>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
        {person && ref && (
          <p className="flex items-start gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
            <Info className="mt-0.5 size-4 shrink-0 text-v2-info" aria-hidden />
            {t("{p} birinchi oyini to'liq to'lashi bilan {r}ga +1 referal yoziladi.", { p: person.name, r: ref.name })}
          </p>
        )}
      </div>
    </V2Dialog>
  );
}

function GiftDialog({ g, onClose, onDone }: { g: Data["gifts"][number] | null; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(g?.name ?? "");
  const [desc, setDesc] = useState(g?.desc ?? "");
  const [price, setPrice] = useState(String(g?.price ?? 3));
  const [stock, setStock] = useState(String(g?.stock ?? 10));
  const [active, setActive] = useState(g?.active ?? true);
  const [saving, setSaving] = useState(false);
  const num = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  async function save(close: () => void) {
    setSaving(true);
    const r = await api({ action: "gift", id: g?.id, name, desc, price: Number(price), stock: Number(stock), active });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={g ? t("Sovg'ani tahrirlash") : t("Sovg'a qo'shish")}
      onClose={onClose}
      saving={saving}
      width={460}
      footer={(api2) => (
        <>
          <button type="button" onClick={api2.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api2.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls()} placeholder={t("Masalan: Akademiya sovg'a to'plami")} />
        </Field>
        <Field label={t("Tavsif")} optional>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className={fieldCls()} placeholder={t("futbolka, krujka va bloknot")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Narxi, referal")}>
            <input value={price} onChange={(e) => setPrice(num(e.target.value))} inputMode="numeric" className={fieldCls()} />
          </Field>
          <Field label={t("Qoldiq, dona")}>
            <input value={stock} onChange={(e) => setStock(num(e.target.value))} inputMode="numeric" className={fieldCls()} />
          </Field>
        </div>
        {g && (
          <Field label={t("Holat")}>
            <Segmented
              label={t("Holat")}
              value={active ? "on" : "off"}
              onChange={(v) => setActive(v === "on")}
              options={[
                { value: "on", label: t("Do'konda") },
                { value: "off", label: t("Yashirilgan") },
              ]}
            />
          </Field>
        )}
      </div>
    </V2Dialog>
  );
}

function RejectDialog({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(close: () => void) {
    setSaving(true);
    const r = await api({ action: "decide", id, approve: false, comment });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("So'rov rad etildi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("So'rovni rad etish")}
      onClose={onClose}
      saving={saving}
      dirty={!!comment}
      width={440}
      footer={(api2) => (
        <>
          <button type="button" onClick={api2.requestClose} className={secondaryBtn}>
            {t("Orqaga")}
          </button>
          <button type="button" onClick={() => void save(api2.close)} disabled={saving || !comment.trim()} className="inline-flex h-10 items-center rounded-v2-md bg-v2-danger px-4 font-semibold text-white disabled:opacity-50">
            {t("Rad etish")}
          </button>
        </>
      )}
    >
      <Field label={t("Sabab")}>
        <input value={comment} onChange={(e) => setComment(e.target.value)} className={fieldCls()} placeholder={t("Masalan: omborda qolmagan")} />
      </Field>
    </V2Dialog>
  );
}
