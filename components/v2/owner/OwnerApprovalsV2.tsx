"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronRight, Clock, History, Info, Wallet, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { fieldCls } from "@/components/v2/form/fields";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card } from "@/components/v2/teacher/teacherBits";
import { ApprovalIcon, Crumbs, nf, ownerPost, Pill, type Tone } from "./ownerBits";

// YANGI VERSIYA — RAHBAR PANELI · TASDIQLAR (48-qism, rasmlar «Rahbar paneli · tasdiqlar: avans so'rovi», telefon).
// Barcha filiallardan bitta ro'yxat: avans so'rovlari (admin yozadi, lib/advanceRequests.ts) va admin chegarasidan
// katta narx/chegirma (price_exceptions). O'ngda panel: avans — oylik holati (shu kungacha hisoblangan, jarima,
// olingan, olishi mumkin), ko'p bo'lsa ogohlantirish va «X qilib tasdiqlash»; narx — tafsilot. Server — /api/owner.

interface Salary {
  configured: boolean;
  typeLabel: string;
  earned: number;
  bonus: number;
  fine: number;
  taken: number;
  canTake: number;
  day: number;
}
interface Item {
  key: string;
  kind: "avans" | "narx";
  id: number;
  title: string;
  sub: string;
  amount: number;
  percent?: number | null;
  badge: { tone: string; text: string } | null;
  at: string;
  detail: Record<string, unknown>;
}
interface Data {
  ok: true;
  today: string;
  now: string;
  items: Item[];
  counts: { all: number; avans: number; narx: number };
  resolved: { kind: string; title: string; sub: string; result: string; at: string }[];
}

export default function OwnerApprovalsV2({ openKey }: { openKey?: string }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [filter, setFilter] = useState<"all" | "avans" | "narx">("all");
  const [sel, setSel] = useState<string | null>(openKey ?? null);
  const { data, error, reload } = useReportData<Data>("/api/owner?view=approvals");

  if (error) return <NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar>;
  if (!data) return <div className="h-96 animate-pulse rounded-v2-lg bg-v2-skeleton" />;
  const d = data;
  const list = d.items.filter((i) => filter === "all" || i.kind === filter);
  const cur = d.items.find((i) => i.key === sel) ?? null;
  const groups: { kind: "avans" | "narx"; title: string; note: string }[] = [
    { kind: "avans", title: t("Avans so'rovlari"), note: t("admin yozadi · tasdiqlangach o'z kassasidan beradi") },
    { kind: "narx", title: t("Narx va chegirma"), note: t("admin chegarasidan katta") },
  ];
  const TABS = [
    { k: "all" as const, label: t("Hammasi"), n: d.counts.all },
    { k: "avans" as const, label: t("Avans"), n: d.counts.avans },
    { k: "narx" as const, label: t("Narx va chegirma"), n: d.counts.narx },
  ];
  const RESULT_TONE: Record<string, Tone> = { berildi: "success", tasdiqlandi: "success", "rad etildi": "neutral" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Crumbs here="Tasdiqlar" />
          <h1 className="text-v2-page text-v2-text">{t("Tasdiqlar")}</h1>
          <p className="text-v2-small text-v2-text-2">
            {t("Barcha filiallardan · admin va menejer chegarasidan oshgan so'rovlar")} · {fmt.dayMonth(d.today)} | {d.now}
          </p>
        </div>
        <Link href="/amallar-jurnali" className={secondaryBtn}>
          <History className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Tarix")}
        </Link>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-v2-md bg-v2-surface-2 p-1" role="tablist">
        {TABS.map((x) => (
          <button key={x.k} type="button" role="tab" aria-selected={filter === x.k} onClick={() => setFilter(x.k)} className={`h-8 shrink-0 rounded-v2-sm px-3 text-v2-small ${filter === x.k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
            {x.label} <span className="text-v2-text-3">{x.n}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_29rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            {list.length === 0 ? <p className="px-5 py-8 text-center text-v2-small text-v2-success">{t("Tasdiq kutayotgan narsa yo'q.")}</p> : null}
            {groups.map((g) => {
              const rows = list.filter((i) => i.kind === g.kind);
              if (!rows.length) return null;
              return (
                <div key={g.kind}>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-v2-border bg-v2-surface-2 px-4 py-2 text-v2-caption sm:px-5">
                    <span className="font-semibold text-v2-text-2">{g.title} · {rows.length}</span>
                    <span className="text-v2-text-3">{g.note}</span>
                  </div>
                  {rows.map((a) => {
                    const on = cur?.key === a.key;
                    return (
                      <button key={a.key} type="button" onClick={() => setSel(a.key)} className={`flex w-full items-center gap-3 border-b border-l-[3px] border-b-v2-border px-4 py-3 text-left sm:px-5 ${on ? "border-l-v2-brand bg-v2-brand-bg" : "border-l-transparent hover:bg-v2-surface-2"}`}>
                        <ApprovalIcon kind={a.kind} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-v2-body font-semibold text-v2-text">{a.title}</span>
                          <span className="block truncate text-v2-caption text-v2-text-3">{a.sub}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <b className="tabular-nums text-v2-text">{a.kind === "narx" && a.percent ? `${a.percent}%` : nf(a.amount)}</b>
                          {a.badge ? <Pill tone={a.badge.tone as Tone}>{t(a.badge.text)}</Pill> : null}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-v2-text-3" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </Card>

          <Card className="!p-0 sm:!p-0">
            <div className="flex items-start justify-between gap-2 p-4 sm:p-5">
              <div>
                <h2 className="text-v2-section text-v2-text">{t("Bugun hal qilingan · {n}", { n: d.resolved.length })}</h2>
                <p className="text-v2-small text-v2-text-3">{t("har biri Amallar jurnaliga yozilgan")}</p>
              </div>
              <Link href="/amallar-jurnali" className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                {t("Tarix")}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            {d.resolved.length === 0 ? <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Bugun hali hal qilinmagan.")}</p> : null}
            {d.resolved.map((r, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-v2-border px-4 py-2.5 sm:px-5">
                <ApprovalIcon kind={r.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-small font-semibold text-v2-text">{r.title}</span>
                  <span className="block truncate text-v2-caption text-v2-text-3">{r.sub}</span>
                </span>
                <Pill tone={RESULT_TONE[r.result] ?? "neutral"}>{t(r.result)}</Pill>
              </div>
            ))}
          </Card>
        </div>

        {cur ? (
          <div className="order-first lg:order-none">
            <Detail key={cur.key} item={cur} onClose={() => setSel(null)} onDone={() => { setSel(null); reload(); }} />
          </div>
        ) : (
          <Card className="hidden lg:block">
            <p className="py-10 text-center text-v2-small text-v2-text-3">{t("Chapdan so'rovni tanlang.")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Detail({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const det = item.detail;
  const s = (det.salary ?? null) as Salary | null;
  const over = Number(det.over) || 0;
  const box = (det.cashbox ?? null) as { name: string; owner: string; naqd: number } | null;

  async function decide(approve: boolean, amount?: number) {
    if (!approve && !note.trim()) {
      setRejecting(true);
      return showError(t("Rad etish sababini yozing"));
    }
    setSaving(true);
    const r = await ownerPost({ action: item.kind === "avans" ? "advance-decide" : "price-decide", id: item.id, approve, note, ...(amount ? { amount } : {}) });
    setSaving(false);
    if (!r.ok) return showError(t(r.error || "Saqlab bo'lmadi"));
    showSuccess(approve ? t("Tasdiqlandi") : t("Rad etildi"));
    onDone();
  }

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2 border-b border-v2-border px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2">
          <span className="text-v2-section text-v2-text">{item.kind === "avans" ? t("Avans so'rovi") : t("Narx va chegirma")}</span>
          <Pill tone="warning">
            <Clock className="size-3" aria-hidden />
            {t("Kutilmoqda")}
          </Pill>
        </span>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2" aria-label={t("Yopish")}>
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {item.kind === "avans" ? (
          <>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-v2-info-bg text-v2-small font-semibold text-v2-info">{initialsOf(String(det.employee))}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-v2-body font-semibold text-v2-text">{String(det.employee)}</span>
                <span className="text-v2-caption text-v2-text-3">{[String(det.role ?? ""), String(det.branch ?? "")].filter(Boolean).join(" · ")}</span>
              </span>
            </div>
            <div className="rounded-v2-md bg-v2-warning-bg px-4 py-3">
              <div className="text-v2-small font-medium text-v2-warning">{t("So'ralgan avans")}</div>
              <div className="text-[2rem] font-semibold leading-10 tabular-nums text-v2-text">
                {nf(item.amount)} <span className="text-v2-body font-normal text-v2-text-2">so&apos;m</span>
              </div>
              <p className="text-v2-caption text-v2-text-2">
                {t("{who} yozdi · {d} | {t}", { who: String(det.createdBy), d: fmt.dayMonth(String(det.date)), t: String(det.time) })} · «{String(det.note)}»
              </p>
            </div>
            {s ? (
              <div>
                <div className="mb-1.5 text-v2-small font-semibold text-v2-text">
                  {t("Oylik holati")} <span className="font-normal text-v2-text-3">· {t("{d} holatiga", { d: fmt.dayMonth(String(det.date)) })}</span>
                </div>
                <div className="overflow-hidden rounded-v2-md border border-v2-border text-v2-small">
                  <Line k={t("Hisoblangan · 1–{d} · {type}", { d: s.day, type: s.typeLabel })} v={nf(s.earned + s.bonus)} />
                  <Line k={t("Jarima")} v={s.fine ? `−${nf(s.fine)}` : "0"} tone={s.fine ? "text-v2-danger" : undefined} />
                  <Line k={t("Avans olingan · shu oyda")} v={nf(s.taken)} />
                  <Line k={t("Shu kungacha olishi mumkin")} v={nf(s.canTake)} strong />
                </div>
                {!s.configured ? <p className="mt-1 text-v2-caption text-v2-warning">{t("Xodimning oyligi sozlanmagan — hisob taxminiy")}</p> : null}
              </div>
            ) : null}
            {over > 0 ? (
              <p className="flex gap-2 rounded-v2-md bg-v2-danger-bg px-3 py-2.5 text-v2-small text-v2-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-danger" aria-hidden />
                <span>
                  <b>{t("So'rov shu kungacha hisoblangan oylikdan {n} so'm ko'p.", { n: nf(over) })}</b> {t("Kassa chiqimi oylik chegarasidan oshmaydi — «Berdim» bosilganda server rad etishi mumkin.")}
                </span>
              </p>
            ) : null}
            {box ? (
              <div className="flex items-center gap-3 rounded-v2-md border border-v2-border px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
                  <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-v2-small font-semibold text-v2-text">{t("{name} kassasidan", { name: box.name })}</span>
                  <span className="text-v2-caption text-v2-text-3">{t("pulni {who} beradi", { who: box.owner || t("kassa egasi") })}</span>
                </span>
                <span className="text-right text-v2-small">
                  <span className="block text-v2-caption text-v2-text-3">{t("kassada")}</span>
                  <b className="tabular-nums text-v2-text">{nf(box.naqd)} → {nf(box.naqd - item.amount)}</b>
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="overflow-hidden rounded-v2-md border border-v2-border text-v2-small">
            <Line k={t("O'quvchi")} v={String(det.pupil ?? "")} />
            <Line k={t("Guruh")} v={String(det.group ?? "—")} />
            <Line k={t("Filial")} v={String(det.branch ?? "")} />
            {det.basePrice ? <Line k={t("Guruh narxi")} v={nf(Number(det.basePrice))} /> : null}
            <Line k={t("Imtiyoz")} v={`${nf(Number(det.amount))}${item.percent ? ` · ${item.percent}%` : ""}`} strong />
            <Line k={t("Sabab")} v={String(det.reason ?? "—")} />
            {det.note ? <Line k={t("Izoh")} v={String(det.note)} /> : null}
            <Line k={t("Kuchga kiradi")} v={`${String(det.from ?? "")}${det.to ? ` → ${String(det.to)}` : ""}`} />
            <Line k={t("So'radi")} v={String(det.createdBy ?? "")} />
          </div>
        )}

        {rejecting ? (
          <div>
            <label className="mb-1 block text-v2-small font-medium text-v2-text">{t("Rad etish sababi")}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldCls("default", "h-auto py-2")} autoFocus />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={saving} onClick={() => (rejecting ? void decide(false) : setRejecting(true))} className={`${secondaryBtn} justify-center text-v2-danger`}>
            <X className="size-4" aria-hidden />
            {t("Rad etish")}
          </button>
          {item.kind === "avans" && over > 0 && s && s.canTake > 0 ? (
            <button type="button" disabled={saving} onClick={() => void decide(true, s.canTake)} className={`${secondaryBtn} justify-center`}>
              {t("{n} qilib tasdiqlash", { n: nf(s.canTake) })}
            </button>
          ) : <span />}
        </div>
        <button type="button" disabled={saving} onClick={() => void decide(true)} className={`${primaryBtn} h-11 w-full justify-center`}>
          <Check className="size-4" strokeWidth={2} aria-hidden />
          {t("Tasdiqlash")}{item.kind === "avans" ? ` · ${nf(item.amount)}` : ""}
        </button>
        <p className="flex gap-2 text-v2-caption text-v2-text-3">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {item.kind === "avans"
            ? t("Tasdiqlangach {who}ga xabar boradi: u pulni beradi va «Berdim»ni bosadi — chiqim o'zi yoziladi, avans xodimning «Oyligim» sahifasida ko'rinadi. Rad etilsa, sababi so'raladi.", { who: box?.owner || t("kassa egasi") })
            : t("Tasdiqlansa imtiyoz o'quvchi hisobiga yoziladi; rad etilsa, sababi so'rov yozgan adminga ko'rinadi.")}
        </p>
      </div>
    </section>
  );
}

function Line({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-v2-border px-3 py-2 last:border-b-0 ${strong ? "bg-v2-surface-2" : ""}`}>
      <span className="text-v2-text-2">{k}</span>
      <span className={`text-right tabular-nums ${strong ? "font-semibold" : ""} ${tone ?? "text-v2-text"}`}>{v}</span>
    </div>
  );
}
