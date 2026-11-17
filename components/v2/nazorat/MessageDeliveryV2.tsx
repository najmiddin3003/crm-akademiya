"use client";

import Link from "@/components/ui/Link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Settings } from "lucide-react";
import { useT } from "@/components/shared/Language";
import type { DateRange } from "@/components/ui/DateRangePicker";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, SegmentPills, SimplePager, TH } from "@/components/v2/students/lists/listKit";
import { DELIVERY_LABELS, PURPOSE_LABELS, type DeliveryPayload, type DeliveryState, type PurposeRow } from "@/lib/messageDeliveryTypes";

// YANGI VERSIYA — NAZORAT → «XABARLAR YETKAZILISHI» (34-qism, rasm «Xabarlar yetkazilishi»). Tizim yuborgan
// xabarlar — Telegram bot va SMS: jami, Telegram'da yetkazildi, SMS operatorga, yetmadi; yetmaganlar
// banneri (sabablari bilan), maqsad bo'yicha chiziqlar, kanallar holati va oxirgi xabarlar jadvali.
// Server: /api/message-delivery (lib/messageDelivery.ts), manba — `sms_messages` jurnali.

const PAD = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
const nf = (n: number) => n.toLocaleString("ru-RU");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const STATE_PILL: Record<DeliveryState, string> = {
  delivered: "bg-v2-success-bg text-v2-success",
  operator: "bg-v2-info-bg text-v2-info",
  simulated: "bg-v2-surface-2 text-v2-text-2",
  failed: "text-v2-danger",
  pending: "bg-v2-surface-2 text-v2-text-2",
};
type Seg = "all" | "failed" | "sms";

export default function MessageDeliveryV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [range, setRange] = useState<DateRange>(() => {
    const n = new Date();
    return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: n };
  });
  const [data, setData] = useState<DeliveryPayload | null>(null);
  const [err, setErr] = useState("");
  const [seg, setSeg] = useState<Seg>("all");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  useEffect(() => {
    let off = false;
    const s = range.start ?? new Date();
    void fetch(`/api/message-delivery?${new URLSearchParams({ from: isoOf(s), to: isoOf(range.end ?? s) })}`, { cache: "no-store" })
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
  }, [range]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => seg === "all" || (seg === "failed" ? r.state === "failed" : r.channel === "sms")), [data, seg]);
  const shown = rows.slice((page - 1) * size, page * size);
  const k = data?.kpi;
  const ch = data?.channels;
  const purposeLabel = (p: string) => t(PURPOSE_LABELS[p] ?? PURPOSE_LABELS.other);

  return (
    <PageShell flow>
      <PageHead
        title={t("Xabarlar yetkazilishi")}
        subtitle={t("Tizim yuborgan xabarlar — Telegram bot va SMS · barcha filiallar")}
        actions={
          <>
            <V2DateRange
              value={range}
              onChange={(r) => {
                setRange(r);
                setPage(1);
              }}
              allowAll={false}
            />
            <Link href="/settings-integrations" className={secondaryBtn}>
              <Settings className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Kanal sozlamalari")}
            </Link>
          </>
        }
      />
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!data && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {data && k && ch && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi dot="bg-v2-text-3" label={t("Jami yuborilgan")} value={nf(k.total)} sub={t("{n} xil maqsadda", { n: k.purposes })} />
            <Kpi dot="bg-v2-success" label={t("Telegram'da yetkazildi")} value={nf(k.telegram)} share={pct(k.telegram, k.total)} sub={t("bot yuborgani egasining chatiga tushdi")} />
            <Kpi
              dot="bg-v2-info"
              label={t("SMS · operatorga")}
              value={nf(k.sms)}
              share={pct(k.sms, k.total)}
              sub={[t("Eskiz qabul qildi"), k.smsPending ? t("{n} tasi navbatda", { n: k.smsPending }) : "", k.simulated ? t("{n} tasi sinov", { n: k.simulated }) : ""].filter(Boolean).join(" · ")}
            />
            <Kpi dot="bg-v2-danger" danger label={t("Yetmadi")} value={nf(k.failed)} share={pct(k.failed, k.total)} sub={t("bot ulanmagan yoki raqam xato")} />
          </section>

          {k.failed > 0 && (
            <section className="flex flex-wrap items-start gap-3 rounded-v2-lg border border-v2-danger bg-v2-danger-bg px-5 py-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-v2-danger" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">{t("{n} ta xabar egasiga yetmadi", { n: nf(k.failed) })}</div>
                <ul className="mt-1 space-y-0.5 text-v2-small text-v2-text-2">
                  {data.failReasons.map((r) => (
                    <li key={`${r.purpose}|${r.reason}`}>
                      <span className="font-semibold tabular-nums text-v2-text">{nf(r.n)}</span> — {purposeLabel(r.purpose)}: {t(r.reason)}
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" onClick={() => {
                  setSeg("failed");
                  setPage(1);
                }} className={secondaryBtn}>
                {t("Yetmaganlarni ko'rish")}
              </button>
            </section>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-v2-border px-5 py-4">
                <h2 className="text-v2-section text-v2-text">{t("Maqsad bo'yicha")}</h2>
                <div className="flex flex-wrap gap-3 text-v2-small text-v2-text-2">
                  {[
                    ["bg-v2-success", "Telegram"],
                    ["bg-v2-info", "SMS"],
                    ["bg-v2-danger", t("Yetmadi")],
                    ["bg-v2-text-3", t("Kutilmoqda")],
                  ].map(([c, l]) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <span className={`size-2 rounded-[2px] ${c}`} aria-hidden />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              {data.purposes.length === 0 && <p className="px-5 py-8 text-center text-v2-small text-v2-text-3">{t("Bu oraliqda xabar yo'q")}</p>}
              <ul className="divide-y divide-v2-border">
                {data.purposes.map((p) => (
                  <PurposeLine key={p.key} p={p} label={purposeLabel(p.key)} />
                ))}
              </ul>
            </section>

            <aside className="h-fit rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <h2 className="border-b border-v2-border px-5 py-4 text-v2-section text-v2-text">{t("Kanallar")}</h2>
              <ul className="divide-y divide-v2-border">
                <Channel
                  title={t("Telegram · o'quvchi boti")}
                  on={ch.botEnabled}
                  sub={t("aktiv o'quvchilarning {p}% i ulangan — {a} / {b}", { p: pct(ch.botLinked, ch.activePupils), a: ch.botLinked, b: ch.activePupils })}
                />
                <Channel title={t("SMS · Eskiz")} on={ch.eskiz} sub={ch.paymentSms ? t("to'lov SMS i yoqilgan") : t("to'lov SMS i o'chiq · taklif va parol SMS i ishlaydi")} />
                <Channel title={t("SMS yetkazilish hisoboti")} on={false} sub={t("telefonga yetganini bilish uchun Eskiz hisobotini ulash kerak")} />
              </ul>
            </aside>
          </div>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-v2-border px-5 py-4">
              <h2 className="text-v2-section text-v2-text">{t("Oxirgi xabarlar")}</h2>
              <SegmentPills
                items={[
                  { key: "all", label: t("Hammasi"), count: data.rows.length },
                  { key: "failed", label: t("Yetmadi"), count: data.rows.filter((r) => r.state === "failed").length },
                  { key: "sms", label: "SMS", count: data.rows.filter((r) => r.channel === "sms").length },
                ]}
                value={seg}
                onChange={(v) => {
                  setSeg(v as Seg);
                  setPage(1);
                }}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} pl-5`}>{t("Vaqt")}</th>
                    <th className={TH}>{t("Kimga")}</th>
                    <th className={TH}>{t("Maqsad")}</th>
                    <th className={TH}>{t("Kanal · holat")}</th>
                    <th className={`${TH} pr-5`}>{t("Matn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                        {t("Xabar topilmadi")}
                      </td>
                    </tr>
                  )}
                  {shown.map((r) => {
                    const bad = r.state === "failed";
                    return (
                      <tr key={r.id} className={`border-b border-v2-border last:border-b-0 ${bad ? "bg-v2-danger-bg" : ""}`}>
                        <td className="whitespace-nowrap py-3 pl-5 pr-3 tabular-nums text-v2-text">
                          {fmt.dayMonth(r.date)} | {r.time}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-v2-text">{r.recipientName || "—"}</div>
                          {r.moderator && <div className="text-v2-small text-v2-text-2">{r.moderator}</div>}
                        </td>
                        <td className="px-3 py-3 text-v2-text">{purposeLabel(r.purpose)}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="mr-2 text-v2-text-2">{r.channel === "telegram" ? "Telegram" : "SMS"}</span>
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${STATE_PILL[r.state]}`}>{t(DELIVERY_LABELS[r.state])}</span>
                        </td>
                        <td className={`max-w-[28rem] py-3 pl-3 pr-5 ${bad ? "text-v2-danger" : "text-v2-text"}`}>
                          <div className="line-clamp-2">{bad && r.error ? t(r.error) : r.text}</div>
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
              note={data.truncated ? t("oxirgi 300 ta xabar") : t("SMS «Operatorga topshirildi» — Eskiz qabul qildi, telefonga yetgani emas")}
            />
          </section>
        </>
      )}
    </PageShell>
  );
}

function Kpi({ dot, label, value, share, sub, danger }: { dot: string; label: string; value: string; share?: number; sub: string; danger?: boolean }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="flex items-center gap-2 text-v2-small text-v2-text-2">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </div>
      <div className={`mt-1 text-[26px] font-semibold leading-8 tabular-nums ${danger ? "text-v2-danger" : "text-v2-text"}`}>
        {value}
        {share !== undefined && <span className="ml-1.5 text-v2-small font-semibold text-v2-text-2">{share}%</span>}
      </div>
      <div className="mt-1 text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function PurposeLine({ p, label }: { p: PurposeRow; label: string }) {
  const { t } = useT();
  const seg = (n: number, c: string) => (n ? <span className={c} style={{ width: `${(n / p.total) * 100}%` }} /> : null);
  const via = p.channels.length === 2 ? t("Telegram, yetmasa SMS") : p.channels[0] === "telegram" ? t("faqat Telegram") : t("faqat SMS");
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[200px_minmax(0,1fr)_56px_110px]">
      <div className="min-w-0">
        <div className="truncate font-semibold text-v2-text">{label}</div>
        <div className="text-v2-small text-v2-text-2">{via}</div>
      </div>
      <div className="col-span-2 row-start-2 flex h-2.5 overflow-hidden rounded-full bg-v2-surface-2 sm:col-span-1 sm:row-start-auto">
        {seg(p.telegram, "bg-v2-success")}
        {seg(p.sms, "bg-v2-info")}
        {seg(p.failed, "bg-v2-danger")}
        {seg(p.pending, "bg-v2-text-3")}
      </div>
      <span className="text-right font-semibold tabular-nums text-v2-text sm:row-start-auto">{nf(p.total)}</span>
      <span className={`hidden text-right text-v2-small font-semibold sm:block ${p.failed ? "text-v2-danger" : "text-v2-success"}`}>{p.failed ? t("{n} yetmadi", { n: nf(p.failed) }) : t("yetmagani yo'q")}</span>
    </li>
  );
}

function Channel({ title, on, sub }: { title: string; on: boolean; sub: string }) {
  const { t } = useT();
  return (
    <li className="px-5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-v2-text">{title}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${on ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>{on ? t("Ulangan") : t("Ulanmagan")}</span>
      </div>
      <div className="mt-0.5 text-v2-small text-v2-text-2">{sub}</div>
    </li>
  );
}
