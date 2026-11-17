"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCircle2, Clock, Download, Info, Minus, Plus, TriangleAlert, Wallet } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, fieldCls, methodDot } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import { Avatar, Badge, NoticeBar, PageHead, PageShell, TH, dayMonth, downloadCsv, fmtNum, monthName } from "@/components/v2/students/lists/listKit";
import { DENOMINATIONS, type DailyHandoverPayload, type HandoverCard } from "@/lib/dailyHandoverTypes";
import { daysBetween } from "@/lib/studentListsTypes";
import CashierHandoverV2 from "./CashierHandoverV2";

// YANGI VERSIYA — MOLIYA → KUNLIK TOPSHIRUV (32-qism, rasmlar «Kunlik topshiruv», «Topshiruvni qabul qilish»,
// yorug'/qorong'i). Rahbar (bosh kassa egasi yoki admin) uchun: filial kassalari kartalari — kassadagi pul,
// to'lov turlari, oxirgi topshiruv; «Qabul qilish» (kupyuralar bo'yicha sanash + plastik), «Tasdiqlash» /
// «Qaytarish» (kassir o'zi jo'natgan bo'lsa), «Eslatish» (xodimlar boti). Pastda oy tarixi. Pul yo'li —
// mavjud kassalararo ko'chirma (lib/dailyHandover.ts): kirim emas, pul joyi o'zgaradi.

type Payload = DailyHandoverPayload;


const METHOD_ORDER = ["naqd", "plastik"];
function sortMethods(m: Record<string, number>): [string, number][] {
  const rank = (k: string) => { const i = METHOD_ORDER.indexOf(k); return i < 0 ? METHOD_ORDER.length : i; };
  return Object.entries(m).sort((a, b) => rank(a[0]) - rank(b[0]));
}

function shiftMonth(ym: string, d: number): string {
  const [y, m] = ym.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function DailyHandoverV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [cashier, setCashier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boxFilter, setBoxFilter] = useState("");
  const [acceptFor, setAcceptFor] = useState<HandoverCard | null>(null);
  const [returnFor, setReturnFor] = useState<HandoverCard | null>(null);

  const apply = useCallback((j: (Payload & { ok: true }) | { ok: false; error?: string; cashier?: boolean } | null) => {
    if (j?.ok) {
      setData(j);
      setError("");
    } else if (j && "cashier" in j && j.cashier) setCashier(true);
    else setError(j?.error || "Ma'lumotni yuklab bo'lmadi");
    setLoading(false);
  }, []);
  const load = useCallback(
    (m: string) =>
      fetch(`/api/cashboxes/daily${m ? `?month=${m}` : ""}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)
        .then(apply),
    [apply],
  );
  useEffect(() => {
    fetch(`/api/cashboxes/daily${month ? `?month=${month}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then(apply);
  }, [month, apply]);

  const curMonth = data?.month ?? month;
  const today = data?.today ?? "";
  const cards = useMemo(() => data?.cards ?? [], [data]);
  const due = cards.filter((c) => c.pending || c.total > 0);
  const dueTotal = due.reduce((s, c) => s + (c.pending ? c.pending.total : c.total), 0);
  const records = useMemo(() => (data?.records ?? []).filter((r) => !boxFilter || String(r.cashboxId) === boxFilter), [data, boxFilter]);
  const sums = records.reduce((a, r) => ({ naqd: a.naqd + r.naqd, plastik: a.plastik + r.plastik, total: a.total + r.total, diff: a.diff + r.diff }), { naqd: 0, plastik: 0, total: 0, diff: 0 });
  const nameOf = (k: string) => data?.methodNames[k] ?? k;

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch("/api/cashboxes/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) {
      showError(t(res?.error || "Saqlab bo'lmadi"));
      return null;
    }
    return res;
  }

  async function remind(c: HandoverCard) {
    const res = await post({ action: "remind", cashboxId: c.cashboxId });
    if (!res) return;
    if (Number(res.sent) > 0) showSuccess(t("{name} ga eslatma yuborildi", { name: c.moderator || c.name }));
    else showError(t("Eslatma ketmadi — kassa egasi xodimlar botiga ulanmagan"));
  }

  function exportCsv() {
    downloadCsv(
      `kunlik-topshiruv-${curMonth}.csv`,
      ["Sana", "Vaqt", "Kassa", "Mas'ul", "Naqd", "Plastik", "Boshqa", "Jami", "Farq", "Qabul qildi", "Izoh"],
      records.map((r) => [r.date, r.time, r.cashboxName, r.moderator, r.naqd, r.plastik, r.other, r.total, r.diff, r.acceptedBy, r.note]),
    );
  }

  function card(c: HandoverCard) {
    const p = c.pending;
    const lastDays = c.last ? daysBetween(c.last.date, today) : null;
    const amount = p ? p.total : c.total;
    const methods = p ? p.methods : c.methods;
    const status = p
      ? <Badge tone="info">{t("Tasdiq kutilmoqda")}</Badge>
      : c.total <= 0
        ? <Badge tone="success">{t("Topshirilgan")}</Badge>
        : lastDays === 0
          ? <Badge tone="neutral">{t("Bugun topshirgan")}</Badge>
          : <Badge tone="warning">{lastDays === null ? t("Hali topshirmagan") : t("{n} kun topshirilmagan", { n: lastDays })}</Badge>;
    const lastLine = p
      ? t("{when} da topshirdi", { when: p.date === today ? `${t("Bugun")} ${p.time}` : `${dayMonth(p.date)} | ${p.time}` })
      : c.last
        ? `${t("Oxirgi topshiruv")}: ${dayMonth(c.last.date)} | ${c.last.time}${c.last.diff ? ` · ${t("farq")} ${c.last.diff > 0 ? "+" : ""}${fmtNum(c.last.diff)}` : ""}`
        : t("Hali topshiruv bo'lmagan");
    return (
      <article key={c.cashboxId} className={`flex flex-col gap-3 rounded-v2-lg border bg-v2-surface p-4 shadow-v2-sm ${p ? "border-v2-brand" : "border-v2-border"}`}>
        <div className="flex items-center gap-3">
          <Avatar name={c.moderator || c.name} />
          <div className="min-w-0">
            <b className="block truncate font-semibold text-v2-text">{c.name}</b>
            <span className="block truncate text-v2-small text-v2-text-3">{c.moderator || t("mas'ul belgilanmagan")}</span>
          </div>
        </div>
        <div>{status}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-v2-number tabular-nums text-v2-text">{fmtNum(amount)}</span>
          <span className="text-v2-small text-v2-text-2">{p ? t("so'm topshirildi") : t("so'm kassada")}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-v2-small">
          {sortMethods(methods).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[3px] ${methodDot(k)}`} aria-hidden />
              <span className="text-v2-text-2">{t(nameOf(k))}</span>
              <b className="font-semibold tabular-nums text-v2-text">{fmtNum(v)}</b>
            </span>
          ))}
          {Object.values(methods).every((v) => !(v > 0)) && <span className="text-v2-text-3">—</span>}
        </div>
        <p className={`border-b border-v2-border pb-3 text-v2-small ${!p && lastDays !== null && lastDays > 0 && c.total > 0 ? "text-v2-warning" : "text-v2-text-2"}`}>{lastLine}</p>
        <div className="mt-auto flex gap-2">
          {p ? (
            <>
              <button type="button" onClick={() => setAcceptFor(c)} className={`${primaryBtn} flex-1 justify-center`}>
                <Check className="size-4" strokeWidth={2} aria-hidden />
                {t("Tasdiqlash")}
              </button>
              <button type="button" onClick={() => setReturnFor(c)} className={secondaryBtn}>{t("Qaytarish")}</button>
            </>
          ) : (
            <>
              <button type="button" disabled={c.total <= 0} onClick={() => setAcceptFor(c)} className={`${primaryBtn} flex-1 justify-center disabled:opacity-50`}>
                {t("Qabul qilish")}
              </button>
              <button type="button" disabled={c.total <= 0} onClick={() => void remind(c)} className={`${secondaryBtn} disabled:opacity-50`}>
                <Bell className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Eslatish")}
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  const months = useMemo(() => {
    const base = curMonth || today.slice(0, 7);
    return base ? Array.from({ length: 12 }, (_, i) => shiftMonth(base.slice(0, 7) === today.slice(0, 7) ? base : today.slice(0, 7), -i)) : [];
  }, [curMonth, today]);

  if (cashier) return <CashierHandoverV2 />;
  return (
    <PageShell flow>
      <PageHead
        title={t("Kunlik topshiruv")}
        subtitle={[t("Filial kassalari kun oxirida pulni bosh kassaga topshiradi"), today ? `${t("bugun")}, ${dayMonth(today)} | ${data?.now ?? ""}` : ""].filter(Boolean).join(" · ")}
        actions={
          <button type="button" onClick={exportCsv} disabled={!records.length} className={`${secondaryBtn} disabled:opacity-50`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Hisobot")}
          </button>
        }
      />

      <NoticeBar icon={Info}>
        {t("Rahbar qabul qilgach pul {primary}ga ko'chirma bo'lib o'tadi — kirim hisoblanmaydi, faqat joyi o'zgaradi. Farq bo'lsa izoh yozish majburiy.", { primary: data?.primary.name ?? t("Rahbar kassasi") })}
      </NoticeBar>

      {error && <div className="rounded-v2-md bg-v2-danger-bg px-3 py-2 text-v2-small text-v2-danger">{t(error)}</div>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-v2-section text-v2-text">{t("Bugun topshirilishi kerak")}</h2>
          <span className="text-v2-small text-v2-text-2">
            {t("{n} kassa", { n: due.length })} · <b className="font-semibold tabular-nums text-v2-text">{fmtNum(dueTotal)} {t("so'm")}</b>
          </span>
        </div>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-60 rounded-v2-lg bg-v2-skeleton" />)}
          </div>
        ) : cards.length === 0 ? (
          <p className="rounded-v2-lg bg-v2-surface-2 px-4 py-8 text-center text-v2-small text-v2-text-2">{t("Filial kassalari yo'q — Moliya → Kassalar.")}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards.map(card)}</div>
        )}
      </section>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-v2-section text-v2-text">{t("{month}dagi topshiruvlar", { month: curMonth ? monthName(curMonth).charAt(0).toUpperCase() + monthName(curMonth).slice(1) : "" })}</h2>
            <p className="text-v2-small text-v2-text-2">
              {t("{n} ta", { n: records.length })} · {t("naqd")} {fmtNum(sums.naqd)} · {t("plastik")} {fmtNum(sums.plastik)} {t("so'm")}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <V2Select variant="value" label={t("Kassa")} emptyLabel={t("Hammasi")} value={boxFilter} onChange={setBoxFilter} searchable={false} options={cards.map((c) => ({ value: String(c.cashboxId), label: c.name }))} />
            <V2Select
              variant="value"
              label={t("Oy")}
              value={curMonth}
              clearable={false}
              searchable={false}
              onChange={(v) => {
                if (!v) return;
                setLoading(true);
                setMonth(v);
              }}
              options={months.map((m) => ({ value: m, label: `${monthName(m).charAt(0).toUpperCase()}${monthName(m).slice(1)} ${m.slice(0, 4)}` }))}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} pl-4`}>{t("Sana")}</th>
                <th className={TH}>{t("Kassa")}</th>
                <th className={`${TH} text-right`}>{t("Naqd")}</th>
                <th className={`${TH} text-right`}>{t("Plastik")}</th>
                <th className={`${TH} text-right font-semibold text-v2-text!`}>{t("Jami, so'm")}</th>
                <th className={`${TH} text-right`}>{t("Farq")}</th>
                <th className={TH}>{t("Qabul qildi")}</th>
                <th className={TH}>{t("Holat")}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-v2-small text-v2-text-2">{t("Bu oyda topshiruv bo'lmagan")}</td>
                </tr>
              )}
              {records.map((r) => (
                <tr key={r.id} className="border-b border-v2-border hover:bg-v2-hover">
                  <td className="whitespace-nowrap py-2.5 pl-4 pr-2.5 tabular-nums text-v2-text">{dayMonth(r.date)} | {r.time}</td>
                  <td className="px-2.5 py-2.5">
                    <b className="block font-semibold text-v2-text">{r.cashboxName}</b>
                    <span className="block text-v2-small text-v2-text-3">{r.moderator}</span>
                  </td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums">{r.naqd ? fmtNum(r.naqd) : <span className="text-v2-text-3">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-right tabular-nums">{r.plastik ? fmtNum(r.plastik) : <span className="text-v2-text-3">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-v2-text">{fmtNum(r.total)}</td>
                  <td className={`px-2.5 py-2.5 text-right tabular-nums ${r.diff < 0 ? "font-semibold text-v2-danger" : r.diff > 0 ? "font-semibold text-v2-success" : "text-v2-text-2"}`}>
                    {r.diff > 0 ? "+" : ""}
                    {fmtNum(r.diff)}
                  </td>
                  <td className="px-2.5 py-2.5 text-v2-text">{r.acceptedBy || <span className="text-v2-text-3">—</span>}</td>
                  <td className="px-2.5 py-2.5">
                    {r.diff ? <Badge tone="warning">{t("Farq bilan qabul qilindi")}</Badge> : <Badge tone="success">{t("Qabul qilindi")}</Badge>}
                    {r.note && <span className="mt-0.5 block max-w-[220px] truncate text-v2-small text-v2-text-3" title={r.note}>{r.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr className="bg-v2-surface-2">
                  <td colSpan={2} className="py-2.5 pl-4 font-semibold text-v2-text">{t("Jami · {n} ta topshiruv", { n: records.length })}</td>
                  <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums">{fmtNum(sums.naqd)}</td>
                  <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums">{fmtNum(sums.plastik)}</td>
                  <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-v2-brand-text">{fmtNum(sums.total)}</td>
                  <td className={`px-2.5 py-2.5 text-right font-semibold tabular-nums ${sums.diff < 0 ? "text-v2-danger" : ""}`}>{fmtNum(sums.diff)}</td>
                  <td colSpan={2} className="px-2.5 py-2.5 text-v2-small text-v2-text-2">{t("Kassalar → {primary} ko'chirmalari bilan bir xil", { primary: data?.primary.name ?? "" })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <div className="grid gap-3 text-v2-small text-v2-text-2 md:grid-cols-3">
        <p className="flex gap-2"><Bell className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />{t("«Eslatish» — kassa egasiga xodimlar botida xabar ketadi.")}</p>
        <p className="flex gap-2"><Wallet className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />{t("Naqd pul kupyuralar bo'yicha sanaladi, plastik — rahbar kartasiga o'tkaziladi.")}</p>
        <p className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />{t("Kamomadni rahbar mas'ul xodimga jarima qilib yozishi mumkin (Moliya → Jarima).")}</p>
      </div>

      {acceptFor && data && (
        <AcceptDialog
          card={acceptFor}
          data={data}
          onClose={() => setAcceptFor(null)}
          onDone={() => {
            emitMoneyChanged();
            void load(month);
          }}
        />
      )}
      {returnFor && (
        <ReturnDialog
          card={returnFor}
          onClose={() => setReturnFor(null)}
          onSubmit={async (comment) => {
            const res = await post({ action: "return", cashboxId: returnFor.cashboxId, comment });
            if (!res) return false;
            showSuccess(t("Topshiruv qaytarildi — pul kassirda qoldi"));
            void load(month);
            return true;
          }}
        />
      )}
    </PageShell>
  );
}

function AcceptDialog({ card, data, onClose, onDone }: { card: HandoverCard; data: Payload; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const sys = card.pending ? card.pending.methods : card.methods;
  const sysNaqd = Number(sys.naqd) || 0;
  const sysPlastik = Number(sys.plastik) || 0;
  const other = Object.entries(sys).filter(([k, v]) => k !== "naqd" && k !== "plastik" && v > 0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [plastik, setPlastik] = useState(String(sysPlastik || ""));
  const [checked, setChecked] = useState(sysPlastik === 0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const naqd = DENOMINATIONS.reduce((s, d) => s + d * (counts[d] ?? 0), 0);
  const plast = Number(plastik.replace(/\D/g, "")) || 0;
  const total = naqd + plast;
  const diffNaqd = naqd - sysNaqd;
  const diffPlast = plast - sysPlastik;
  const diff = diffNaqd + diffPlast;
  // Kassir jo'natmagan bo'lsa ko'chirma kassadagi puldan oshmaydi (server ham rad etadi).
  const over = card.pending ? null : diffNaqd > 0 ? t("Sanalgan naqd kassadagidan ko'p — kassada bunday pul yo'q") : diffPlast > 0 ? t("Plastik summasi kassadagidan ko'p") : null;
  const step = (d: number, by: number) => setCounts((c) => ({ ...c, [d]: Math.max(0, (c[d] ?? 0) + by) }));

  async function save(close: () => void) {
    if (over) return showError(over);
    if (sysPlastik > 0 && plast > 0 && !checked) return showError(t("Plastik kartangizga tushganini tekshiring"));
    if (diff !== 0 && !note.trim()) return showError(t("Farq bor — sababini izohga yozing"));
    if (total <= 0) return showError(t("Topshiriladigan summa yo'q"));
    setSaving(true);
    const res = await fetch("/api/cashboxes/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", cashboxId: card.cashboxId, naqd, plastik: plast, denominations: counts, note }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Qabul qilindi — {sum} so'm {primary}ga o'tdi", { sum: fmtNum(total), primary: data.primary.name }));
    onDone();
    close();
  }

  const nowLabel = `${dayMonth(data.today)} | ${data.now}`;
  return (
    <V2Dialog
      title={card.pending ? t("Topshiruvni tasdiqlash") : t("Topshiruvni qabul qilish")}
      subtitle={[`${card.name} ${t("kassasi")}`, card.moderator, nowLabel].filter(Boolean).join(" · ")}
      onClose={onClose}
      saving={saving}
      dirty={naqd > 0 || Boolean(note)}
      width={600}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving || Boolean(over)} className={`${primaryBtn} disabled:opacity-50`}>
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {card.pending ? t("Tasdiqlash · {sum} so'm", { sum: fmtNum(card.pending.total) }) : t("Qabul qilish · {sum} so'm", { sum: fmtNum(total) })}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-v2-md bg-v2-brand-bg px-4 py-3">
          <div>
            <span className="block text-v2-small text-v2-brand-text">{card.pending ? t("Kassir topshirdi") : t("Tizim bo'yicha kassada")}</span>
            <span className="text-[32px] font-semibold leading-tight tabular-nums text-v2-text">{fmtNum(sysNaqd + sysPlastik)}</span> <span className="text-v2-body text-v2-text-2">{t("so'm")}</span>
          </div>
          <div className="text-v2-small">
            {[["naqd", sysNaqd], ["plastik", sysPlastik]].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-end gap-2">
                <span className={`size-2.5 rounded-[3px] ${methodDot(String(k))}`} aria-hidden />
                <span className="text-v2-text-2">{t(data.methodNames[String(k)] ?? String(k))}</span>
                <b className="font-semibold tabular-nums">{fmtNum(Number(v))}</b>
              </div>
            ))}
          </div>
        </div>
        {other.length > 0 && (
          <p className="text-v2-small text-v2-text-3">
            {t("Boshqa to'lov turlari ({list}) bu topshiruvga kirmaydi — kassada qoladi.", { list: other.map(([k, v]) => `${data.methodNames[k] ?? k} ${fmtNum(v)}`).join(", ") })}
          </p>
        )}

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-v2-small font-semibold text-v2-text">{t("Naqd pulni sanash")}</span>
            <span className="text-v2-small text-v2-text-2">
              {t("Sanaldi")}: <b className={`font-semibold tabular-nums ${diffNaqd === 0 ? "text-v2-text" : over && diffNaqd > 0 ? "text-v2-danger" : "text-v2-warning"}`}>{fmtNum(naqd)} {t("so'm")}</b>
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {DENOMINATIONS.map((d) => {
              const n = counts[d] ?? 0;
              return (
                <div key={d} className="flex items-center gap-2 rounded-v2-md border border-v2-border px-3 py-1.5">
                  <b className="w-16 font-semibold tabular-nums text-v2-text">{fmtNum(d)}</b>
                  <div className="inline-flex items-center rounded-v2-md border border-v2-border-strong">
                    <button type="button" onClick={() => step(d, -1)} aria-label={t("{d} — kamaytirish", { d: fmtNum(d) })} className="inline-flex size-7 items-center justify-center text-v2-text-2 hover:text-v2-text"><Minus className="size-3.5" /></button>
                    <input
                      value={n}
                      inputMode="numeric"
                      onChange={(e) => setCounts((c) => ({ ...c, [d]: Math.min(9999, Number(e.target.value.replace(/\D/g, "")) || 0) }))}
                      aria-label={t("{d} so'mlik kupyuralar soni", { d: fmtNum(d) })}
                      className="w-9 bg-transparent text-center text-v2-body tabular-nums text-v2-text outline-none"
                    />
                    <button type="button" onClick={() => step(d, 1)} aria-label={t("{d} — ko'paytirish", { d: fmtNum(d) })} className="inline-flex size-7 items-center justify-center text-v2-text-2 hover:text-v2-text"><Plus className="size-3.5" /></button>
                  </div>
                  <span className={`ml-auto tabular-nums ${n ? "text-v2-text" : "text-v2-text-3"}`}>{fmtNum(d * n)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid items-end gap-3 sm:grid-cols-2">
          <Field label={t("Plastik — rahbar kartasiga o'tkazildi")}>
            <div className="relative">
              <input value={plastik ? fmtNum(plast) : ""} onChange={(e) => setPlastik(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" className={fieldCls("default", "pr-12 tabular-nums")} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">{t("so'm")}</span>
            </div>
          </Field>
          <label className="flex h-10 items-center gap-2 text-v2-small text-v2-text">
            <V2Checkbox checked={checked} onChange={setChecked} label={t("Kartamga tushganini tekshirdim")} />
            {t("Kartamga tushganini tekshirdim")}
          </label>
        </div>

        {over ? (
          <div className="flex items-center gap-2 rounded-v2-md bg-v2-danger-bg px-3 py-2 text-v2-small text-v2-text">
            <TriangleAlert className="size-4 text-v2-danger" strokeWidth={1.75} aria-hidden />
            <b className="font-semibold">{over}</b>
          </div>
        ) : diff === 0 ? (
          <div className="flex items-center gap-2 rounded-v2-md bg-v2-success-bg px-3 py-2 text-v2-small text-v2-text">
            <CheckCircle2 className="size-4 text-v2-success" strokeWidth={1.75} aria-hidden />
            <b className="font-semibold">{t("Farq yo'q.")}</b> {t("Naqd ham, plastik ham tizim bilan mos.")}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
            <TriangleAlert className="size-4 text-v2-warning" strokeWidth={1.75} aria-hidden />
            <b className="font-semibold">{t("Farq {sum} so'm.", { sum: `${diff > 0 ? "+" : ""}${fmtNum(diff)}` })}</b>
            {[diffNaqd ? `${t("naqd")} ${diffNaqd > 0 ? "+" : ""}${fmtNum(diffNaqd)}` : "", diffPlast ? `${t("plastik")} ${diffPlast > 0 ? "+" : ""}${fmtNum(diffPlast)}` : ""].filter(Boolean).join(", ")} — {t("izoh majburiy")}
          </div>
        )}

        <Field label={t("Izoh")} optional={diff === 0}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("Farq bo'lsa — sababini yozing")} className={fieldCls(diff !== 0 && !note.trim() ? "warning" : "default", "h-auto! py-2 leading-5")} />
        </Field>

        <div className="flex gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
          <span>
            {card.pending
              ? t("Tasdiqlangach kassir jo'natgan {sum} so'm {primary}ga o'tadi. Farq — tarixda qayd etiladi.", { sum: fmtNum(card.pending.total), primary: data.primary.name })
              : t("Qabul qilingach {primary}ga {sum} so'm ko'chirma yoziladi: naqd naqdga, plastik plastikka. {box} kassasida {left} so'm qoladi.", {
                  primary: data.primary.name,
                  sum: fmtNum(total),
                  box: card.name,
                  left: fmtNum(Math.max(0, card.total - total)),
                })}
          </span>
        </div>
      </div>
    </V2Dialog>
  );
}

function ReturnDialog({ card, onClose, onSubmit }: { card: HandoverCard; onClose: () => void; onSubmit: (comment: string) => Promise<boolean> }) {
  const { t } = useT();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <V2Dialog
      title={t("Topshiruvni qaytarish")}
      subtitle={`${card.name} · ${fmtNum(card.pending?.total ?? 0)} ${t("so'm")}`}
      onClose={onClose}
      saving={saving}
      dirty={Boolean(comment)}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button
            type="button"
            disabled={saving || !comment.trim()}
            onClick={async () => {
              setSaving(true);
              const ok = await onSubmit(comment);
              setSaving(false);
              if (ok) api.close();
            }}
            className={`${primaryBtn} disabled:opacity-50`}
          >
            {t("Qaytarish")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <p className="flex gap-2 text-v2-small text-v2-text-2">
          <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Pul kassir kassasida qoladi, kassirga sabab bilan xabar ketadi.")}
        </p>
        <Field label={t("Sabab")}>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className={fieldCls("default", "h-auto! py-2 leading-5")} placeholder={t("Masalan: summa noto'g'ri, qayta sanang")} />
        </Field>
      </div>
    </V2Dialog>
  );
}
