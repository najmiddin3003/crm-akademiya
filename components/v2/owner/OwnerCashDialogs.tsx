"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowRight, HandCoins, Info, Lock, PiggyBank, Send, TriangleAlert } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, Segmented, fieldCls, methodDot } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import { invalidateTransactions } from "@/lib/cacheKeys";
import { BranchDot, nf, Pill } from "./ownerBits";

// RAHBAR KASSASI OYNALARI (48-qism, rasmlar «almashtirish oynasi», «filialga pul berish», «dividend olish»).
// Pul yo'li — mavjud API: almashtirish — /api/cashboxes/:id/transfer (bir kassa ichida turdan turga, jami
// o'zgarmaydi); filialga — /api/cashboxes/:id/transfer-to (admin «Oldim»ni bosguncha «yo'lda», pul Rahbar
// kassasida turadi); dividend / sarmoya — /api/cashboxes/:id/adjust (chiqim «Divident» / kirim «Sarmoya»).

export interface CashCtx {
  primaryId: number;
  methods: Record<string, number>;
  methodNames: Record<string, string>;
  branches: { cashboxId: number; name: string; owner: string; total: number; pending: number; days: number | null }[];
}

const MAIN = ["naqd", "plastik", "terminal", "inkassa"];
const label = (c: CashCtx, k: string) => c.methodNames[k] ?? k;
async function postJson(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Serverga ulanib bo'lmadi" }));
}
function DialogHead({ icon, tone }: { icon: React.ReactNode; tone: string }) {
  return <span className={`grid size-10 shrink-0 place-items-center rounded-v2-md ${tone}`}>{icon}</span>;
}

/* ───────────── Almashtirish ───────────── */
export function SwapDialog({ ctx, onClose, onDone }: { ctx: CashCtx; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const keys = [...new Set([...MAIN, ...Object.keys(ctx.methods)])].filter((k) => ctx.methodNames[k] || MAIN.includes(k));
  const [from, setFrom] = useState("naqd");
  const [to, setTo] = useState("inkassa");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("bank");
  const [saving, setSaving] = useState(false);
  const sum = Number(amount) || 0;
  const have = Number(ctx.methods[from]) || 0;
  const total = Object.values(ctx.methods).reduce((a, v) => a + (Number(v) || 0), 0);
  const opts = keys.map((k) => ({ value: k, label: `${label(ctx, k)} · ${nf(Number(ctx.methods[k]) || 0)}` }));

  async function save(close: () => void) {
    if (from === to) return showError(t("Ikki xil to'lov turini tanlang"));
    if (sum <= 0) return showError(t("Summani kiriting"));
    if (sum > have) return showError(t("Mablag' yetarli emas"));
    setSaving(true);
    const r = await postJson(`/api/cashboxes/${ctx.primaryId}/transfer`, { from, to, amount: sum });
    setSaving(false);
    invalidateTransactions();
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    emitMoneyChanged();
    showSuccess(t("Almashtirildi: {a} → {b} · {sum}", { a: label(ctx, from), b: label(ctx, to), sum: nf(sum) }));
    onDone();
    close();
  }

  return (
    <V2Dialog
      title={
        <span className="flex items-center gap-3">
          <DialogHead icon={<ArrowLeftRight className="size-5" strokeWidth={1.75} />} tone="bg-v2-violet-bg text-v2-violet" />
          {t("Almashtirish")}
        </span>
      }
      subtitle={t("Rahbar kassasi ichida · bir to'lov turidan boshqasiga")}
      onClose={onClose}
      saving={saving}
      dirty={sum > 0}
      width={540}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={primaryBtn}>
            <ArrowLeftRight className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Almashtirish")}{sum ? ` · ${nf(sum)}` : ""}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
          <Field label={t("Qayerdan")}>
            <V2Select label={t("Qayerdan")} value={from} options={opts} onChange={(v) => v && setFrom(v)} clearable={false} />
          </Field>
          <button type="button" onClick={() => { setFrom(to); setTo(from); }} className="mb-1 grid size-9 place-items-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2" aria-label={t("Almashtirish")}>
            <ArrowLeftRight className="size-4" strokeWidth={1.75} />
          </button>
          <Field label={t("Qayerga")}>
            <V2Select label={t("Qayerga")} value={to} options={opts} onChange={(v) => v && setTo(v)} clearable={false} />
          </Field>
        </div>
        <Field label={t("Summa")}>
          <MoneyField value={amount} onChange={setAmount} autoFocus state={sum > have ? "error" : "default"} />
        </Field>
        <Field label={t("Sabab")}>
          <Segmented label={t("Sabab")} value={reason} onChange={setReason} options={[{ value: "bank", label: t("Bankka topshirish") }, { value: "karta", label: t("Kartaga qo'yish") }, { value: "boshqa", label: t("Boshqa") }]} />
        </Field>
        <div className="overflow-hidden rounded-v2-md border border-v2-border text-v2-small">
          {[from, to].map((k, i) => {
            const before = Number(ctx.methods[k]) || 0;
            const after = before + (i === 0 ? -sum : sum);
            return (
              <div key={k + i} className="flex items-center justify-between gap-2 border-b border-v2-border px-3 py-2">
                <span className="text-v2-text-2">{label(ctx, k)}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="text-v2-text-3">{nf(before)}</span>
                  <ArrowRight className="size-3.5 text-v2-text-3" aria-hidden />
                  <b className={after < 0 ? "text-v2-danger" : "text-v2-text"}>{nf(after)}</b>
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-v2-text-2">{t("Jami Rahbar kassasi")}</span>
            <span className="flex items-center gap-2 tabular-nums">
              <b className="text-v2-text">{nf(total)}</b>
              <Pill tone="success">{t("o'zgarmaydi")}</Pill>
            </span>
          </div>
        </div>
        <p className="flex gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
          <Info className="mt-0.5 size-4 shrink-0 text-v2-info" aria-hidden />
          {t("Bu tushum ham, xarajat ham emas: Foyda-zarar va tushum hisobotlari o'zgarmaydi. Amal Amallar jurnaliga yoziladi.")}
        </p>
      </div>
    </V2Dialog>
  );
}

/* ───────────── Filialga pul berish ───────────── */
export function ToBranchDialog({ ctx, onClose, onDone }: { ctx: CashCtx; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [to, setTo] = useState<number | null>(ctx.branches[0]?.cashboxId ?? null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("naqd");
  const [purpose, setPurpose] = useState("qaytim");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const sum = Number(amount) || 0;
  const dest = ctx.branches.find((b) => b.cashboxId === to) ?? null;
  const PURPOSES: Record<string, string> = { qaytim: "Qaytim uchun mayda pul", xarajat: "Filial xarajati uchun", boshqa: "Boshqa" };

  async function save(close: () => void) {
    if (!to) return showError(t("Filialni tanlang"));
    if (sum <= 0) return showError(t("Summani kiriting"));
    if (purpose === "boshqa" && !note.trim()) return showError(t("Izoh yozing"));
    setSaving(true);
    const r = await postJson(`/api/cashboxes/${ctx.primaryId}/transfer-to`, { toCashboxId: to, method, amount: sum, note: [t(PURPOSES[purpose]), note.trim()].filter(Boolean).join(" · ") });
    setSaving(false);
    invalidateTransactions();
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    emitMoneyChanged();
    showSuccess(t("{sum} so'm {name}ga jo'natildi — «Oldim» bosilguncha yo'lda", { sum: nf(sum), name: dest?.name ?? "" }));
    onDone();
    close();
  }

  return (
    <V2Dialog
      title={
        <span className="flex items-center gap-3">
          <DialogHead icon={<Send className="size-5" strokeWidth={1.75} />} tone="bg-v2-info-bg text-v2-info" />
          {t("Filialga pul berish")}
        </span>
      }
      subtitle={t("Rahbar kassasidan filial kassasiga · tushum ham, xarajat ham emas")}
      onClose={onClose}
      saving={saving}
      dirty={sum > 0}
      width={580}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={primaryBtn}>
            <Send className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Berish")}{sum ? ` · ${nf(sum)}` : ""}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-v2-small font-medium text-v2-text">{t("Qaysi filialga")}</div>
          <div className="space-y-2" role="radiogroup">
            {ctx.branches.map((b, i) => {
              const on = b.cashboxId === to;
              return (
                <button
                  key={b.cashboxId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTo(b.cashboxId)}
                  className={`flex w-full items-center gap-3 rounded-v2-md border px-3 py-2.5 text-left ${on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border hover:bg-v2-surface-2"}`}
                >
                  <span className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${on ? "border-v2-brand" : "border-v2-border-strong"}`}>{on ? <span className="size-2 rounded-full bg-v2-brand" /> : null}</span>
                  <BranchDot n={i + 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-v2-body font-semibold text-v2-text">{b.name}</span>
                    <span className="text-v2-caption text-v2-text-3">{b.owner || "—"}</span>
                  </span>
                  {b.pending ? <Pill tone="info">{t("kassa yo'lda")}</Pill> : <span className="text-v2-caption text-v2-text-3">{t("kassada")} <b className="text-v2-text">{nf(b.total)}</b></span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <Field label={t("Summa")}>
            <MoneyField value={amount} onChange={setAmount} compact />
          </Field>
          <Field label={t("To'lov turi")}>
            <Segmented label={t("To'lov turi")} value={method} onChange={setMethod} options={["naqd", "plastik"].map((k) => ({ value: k, label: label(ctx, k), dot: methodDot(k) }))} />
          </Field>
        </div>
        <Field label={t("Maqsad")}>
          <Segmented label={t("Maqsad")} value={purpose} onChange={setPurpose} options={Object.entries(PURPOSES).map(([value, l]) => ({ value, label: t(l) }))} />
        </Field>
        <Field label={t("Izoh")} optional={purpose !== "boshqa"}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls()} placeholder={t("masalan: ta'mir — eshik qulfi")} />
        </Field>
        <ol className="list-decimal space-y-1 rounded-v2-md bg-v2-surface-2 px-8 py-3 text-v2-small text-v2-text-2">
          <li>{t("Rahbar kassasidan {sum} chiqadi va «Yo'lda» bo'ladi — hech qaysi kassada hisoblanmaydi.", { sum: nf(sum) })}</li>
          <li>{t("{who} sanab «Oldim»ni bosadi — pul {name} kassasiga o'tadi.", { who: dest?.owner || t("Kassa egasi"), name: dest?.name ?? "" })}</li>
          <li>{t("Farq bo'lsa, u izoh yozadi va sizga bildirishnoma keladi.")}</li>
        </ol>
      </div>
    </V2Dialog>
  );
}

/* ───────────── Dividend olish / Sarmoya kiritish ───────────── */
export function DividendDialog({ ctx, initial = "dividend", onClose, onDone }: { ctx: CashCtx; initial?: "dividend" | "sarmoya"; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [kind, setKind] = useState<string>(initial);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("naqd");
  const [note, setNote] = useState("");
  const months = (() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  })();
  const [month, setMonth] = useState(months[0]);
  const [room, setRoom] = useState<{ month: string; profit: number; taken: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const sum = Number(amount) || 0;
  const have = Number(ctx.methods[method]) || 0;
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const mName = (m: string) => `${t(MONTHS[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;

  useEffect(() => {
    let off = false;
    fetch(`/api/owner?view=dividend&month=${month}`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then((j) => {
        if (!off && j?.ok) setRoom({ month: j.month, profit: j.profit, taken: j.taken });
      });
    return () => {
      off = true;
    };
  }, [month]);

  async function save(close: () => void) {
    if (sum <= 0) return showError(t("Summani kiriting"));
    if (kind === "dividend" && sum > have) return showError(t("Mablag' yetarli emas"));
    setSaving(true);
    const r = await postJson(`/api/cashboxes/${ctx.primaryId}/adjust`, kind === "dividend" ? { mode: "chiqim", method, amount: sum, category: "Divident", note: `[${month}] ${note}`.trim() } : { mode: "kirim", method, amount: sum, category: "Sarmoya", note });
    setSaving(false);
    invalidateTransactions();
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    emitMoneyChanged();
    showSuccess(kind === "dividend" ? t("Dividend olindi · {sum}", { sum: nf(sum) }) : t("Sarmoya kiritildi · {sum}", { sum: nf(sum) }));
    onDone();
    close();
  }

  const left = room ? room.profit - room.taken - (kind === "dividend" ? sum : 0) : null;
  return (
    <V2Dialog
      title={
        <span className="flex items-center gap-3">
          <DialogHead icon={kind === "dividend" ? <HandCoins className="size-5" strokeWidth={1.75} /> : <PiggyBank className="size-5" strokeWidth={1.75} />} tone={kind === "dividend" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-success-bg text-v2-success"} />
          {kind === "dividend" ? t("Dividend olish") : t("Sarmoya kiritish")}
        </span>
      }
      subtitle={t("Faqat Rahbar · faqat Rahbar kassasidan")}
      onClose={onClose}
      saving={saving}
      dirty={sum > 0}
      width={540}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={primaryBtn}>
            {kind === "dividend" ? <HandCoins className="size-4" strokeWidth={1.75} aria-hidden /> : <PiggyBank className="size-4" strokeWidth={1.75} aria-hidden />}
            {kind === "dividend" ? t("Dividend olish") : t("Sarmoya kiritish")}{sum ? ` · ${nf(sum)}` : ""}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <Segmented label={t("Amal")} value={kind} onChange={setKind} options={[{ value: "dividend", label: t("Dividend olish") }, { value: "sarmoya", label: t("Sarmoya kiritish") }]} />
          <p className="mt-1 text-v2-caption text-v2-text-3">{t("Sarmoya — kassaga o'z pulingizni qo'yish: tushum hisoblanmaydi")}</p>
        </div>
        <Field label={t("Summa")}>
          <MoneyField value={amount} onChange={setAmount} autoFocus state={kind === "dividend" && sum > have ? "error" : "default"} />
        </Field>
        <Field label={kind === "dividend" ? t("Qaysi turdan") : t("Qaysi turga")}>
          <Segmented
            label={kind === "dividend" ? t("Qaysi turdan") : t("Qaysi turga")}
            value={method}
            onChange={setMethod}
            options={["naqd", "plastik", "inkassa"].map((k) => ({ value: k, label: `${label(ctx, k)} · ${nf(Number(ctx.methods[k]) || 0)}`, dot: methodDot(k) }))}
          />
        </Field>
        {kind === "dividend" ? (
          <>
            <Field label={t("Qaysi davr foydasidan")}>
              <V2Select label={t("Qaysi davr foydasidan")} value={month} options={months.map((m) => ({ value: m, label: mName(m), hint: t("yopilgan oy") }))} onChange={(v) => v && setMonth(v)} clearable={false} />
            </Field>
            <div className="overflow-hidden rounded-v2-md border border-v2-border text-v2-small">
              <Row k={t("{m} sof foydasi", { m: mName(month) })} v={room ? nf(room.profit) : "…"} />
              <Row k={t("Avval olingan dividend")} v={room ? `−${nf(room.taken)}` : "…"} />
              <Row k={t("Shu dividend")} v={`−${nf(sum)}`} />
              <Row k={t("{m} foydasidan qoladi", { m: mName(month) })} v={left === null ? "…" : nf(left)} strong tone={left !== null && left < 0 ? "text-v2-danger" : "text-v2-success"} />
            </div>
          </>
        ) : null}
        <Field label={t("Izoh")} optional>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls()} placeholder={kind === "dividend" ? t("Ta'sischi ulushi") : t("masalan: yangi filial jihozlari uchun")} />
        </Field>
        <p className="flex gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
          {kind === "dividend" ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-v2-warning" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0 text-v2-warning" aria-hidden />}
          {kind === "dividend"
            ? t("Dividend xarajat emas: oy foydasi o'zgarmaydi, Foyda-zararda «Dividend» alohida qatorda ko'rinadi. {m} qoldig'i: {a} → {b}.", { m: label(ctx, method), a: nf(have), b: nf(have - sum) })
            : t("Sarmoya tushum emas: Foyda-zararda «Sarmoya» alohida qatorda ko'rinadi. {m} qoldig'i: {a} → {b}.", { m: label(ctx, method), a: nf(have), b: nf(have + sum) })}
        </p>
      </div>
    </V2Dialog>
  );
}

function Row({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-v2-border px-3 py-2 last:border-b-0">
      <span className="text-v2-text-2">{k}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${tone ?? "text-v2-text"}`}>{v}</span>
    </div>
  );
}
