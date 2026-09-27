"use client";

import "../gamification.css";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLang, useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { MONTHS } from "@/lib/i18n";
import { Chip, fmtDate, signed, useGamToast } from "../ui";

// O'QUVCHI SAHIFASI (TZ 5.8; prototipdagi «Mening sahifam» va o'quvchi
// «Do'kon»i) — shaxsiy havola (`/me/{token}`), Telegram Mini App (`/me/tg`)
// va o'quvchilar kabinetidagi «Coin» tabi uchun BITTA komponent. Kim
// ekanini server aniqlaydi (token yoki `initData`); bu yerda faqat
// ko'rsatish va istak qo'shish/olib tashlash.

export type StudentGameSource = { kind: "token"; token: string } | { kind: "tg"; initData: string };

interface Level {
  position: number;
  name: string;
  minEarned: number;
}
interface HistRow {
  id: number;
  date: string;
  label: string;
  note: string;
  groupLabel: string | null;
  amount: number;
  status: "active" | "cancelled";
  cancelNote: string | null;
  createdByName: string;
}
interface PageData {
  enabled: boolean;
  /** Joriy oy ("YYYY-MM", Toshkent vaqti) — reyting va tarix filtri uchun. */
  month?: string;
  pupil: { id: number; name: string; firstName: string; center: string; grade?: number | null; toifa?: "kids" | "older"; frozen?: boolean };
  wallet?: { balance: number; earnedTotal: number };
  levels?: Level[];
  levelIndex?: number;
  streakOn?: boolean;
  streakBonus?: number;
  bestStreak?: { run: number; next: number; group: string } | null;
  groupsCount?: number;
  discounts?: { month: string; percent: number; amountSom: number; groupLabel: string }[];
  wishlistMax?: number;
  wishes?: { itemId: number; title: string; imageUrl: string | null; emoji: string; price: number; addedAt: string; ready: boolean; noStock: boolean }[];
  orders?: { id: number; itemName: string; priceCoins: number; givenDate: string; status: "given" | "returned"; returnNote: string | null; returnedAt: string | null }[];
  spentTotal?: number;
  shop?: { id: number; title: string; kind: "item" | "service" | "discount"; percent: number | null; imageUrl: string | null; emoji: string; price: number; wished: boolean; need: number }[];
  rankings?: { groupId: number; label: string; total: number; top: { rank: number; name: string; points: number; me: boolean }[]; me: { rank: number; points: number } | null; needForTop5: number }[];
  badges?: { code: string; emoji: string; name: string; desc: string; earned: boolean; times: number }[];
  history?: { rows: HistRow[]; total: number };
  students?: { id: number; name: string; center: string }[];
  telegramUrl?: string | null;
}
type Filter = "all" | "month" | "plus" | "minus" | "shop" | "cancelled";

// Medal faqat tangasi 0 dan katta bo'lsa — Reyting sahifasidagi `medalOf` bilan bir xil.
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const card = "rounded-2xl border border-border bg-card p-4";
const pill = "gm-tap inline-flex items-center justify-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold";
const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function Thumb({ imageUrl, emoji, size }: { imageUrl: string | null; emoji: string; size: number }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-xl bg-secondary" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {emoji || "🎁"}
    </div>
  );
}

function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export default function StudentGame({
  source,
  pupilId: initialPupil = null,
  fallback,
  embedded = false,
}: {
  source: StudentGameSource;
  /** Mini App/kabinet: qaysi farzand (bo'lmasa server birinchisini oladi). */
  pupilId?: number | null;
  /** Modul yoqilmagan bo'lsa ko'rsatiladigan narsa (kabinetdagi eski «Coin»). */
  fallback?: ReactNode;
  /** Boshqa sahifa ichida (kabinet tabi) — tashqi chekinishsiz. */
  embedded?: boolean;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const [toastNode, toast] = useGamToast();
  const [pupilId, setPupilId] = useState<number | null>(initialPupil);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"me" | "shop">("me");
  const [filter, setFilter] = useState<Filter>("all");
  const [hist, setHist] = useState<{ rows: HistRow[]; total: number } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const monthName = (m: string) => (MONTHS[lang] ?? MONTHS.uz)[Number(m.slice(5, 7)) - 1] ?? m;

  // So'rov manzili va sarlavhalari — manbaga qarab (token yoki initData).
  // Bog'liqlik satrlarda (obyektda emas): ota komponent har chizganda yangi
  // `source` obyekti bersa ham qayta yuklash sikli bo'lmaydi.
  const kind = source.kind;
  const secret = source.kind === "token" ? source.token : source.initData;
  const call = useCallback(
    async (path: string, init?: { method?: string; query?: Record<string, string> }) => {
      const base = kind === "token" ? `/api/me/${secret}` : "/api/me/tg";
      const q = new URLSearchParams(init?.query ?? {});
      if (kind === "tg" && pupilId !== null) q.set("pupilId", String(pupilId));
      const qs = q.toString();
      const res = await fetch(`${base}${path}${qs ? `?${qs}` : ""}`, {
        method: init?.method ?? "GET",
        headers: kind === "tg" ? { "X-Telegram-Init-Data": secret } : undefined,
      });
      const json = await res.json().catch(() => ({ ok: false, error: "Aloqa uzildi — internetni tekshiring" }));
      return json as { ok: boolean; error?: string } & Record<string, unknown>;
    },
    [kind, secret, pupilId],
  );

  const load = useCallback(
    () =>
      call("").then((res) => {
        if (!res.ok) {
          setError(String(res.error || "Ma'lumot olinmadi"));
          return;
        }
        setError("");
        setData(res as unknown as PageData);
        setHist((res as unknown as PageData).history ?? null);
        setFilter("all");
      }),
    [call],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = (f: Filter, offset: number) =>
    call("", { query: { part: "history", filter: f, offset: String(offset) } }).then((res) => {
      if (!res.ok) return;
      const h = res.history as { rows: HistRow[]; total: number };
      setHist((cur) => (offset > 0 && cur ? { rows: [...cur.rows, ...h.rows], total: h.total } : h));
    });

  async function toggleWish(itemId: number, on: boolean, title: string) {
    if (busy !== null) return;
    setBusy(itemId);
    const res = await call(`/wishlist/${itemId}`, { method: on ? "POST" : "DELETE" });
    setBusy(null);
    if (!res.ok) {
      toast(t(String(res.error)), { error: true });
      return;
    }
    toast(on ? t("♥ «{title}» istaklarga qo'shildi", { title: t(title) }) : t("«{title}» istaklardan olib tashlandi", { title: t(title) }));
    void load();
  }

  const wrap = embedded ? "gm-page space-y-3" : "gm-page mx-auto max-w-2xl space-y-3 p-4";
  if (error && !data) {
    return (
      <div className={embedded ? "" : "mx-auto max-w-2xl p-4"}>
        <div className={`${card} text-center text-sm font-semibold`}>{t(error)}</div>
      </div>
    );
  }
  if (!data) return <SpinnerBlock />;

  const students = data.students ?? [];
  const selector =
    students.length > 1 ? (
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("Farzandni tanlang")}>
        {students.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === data.pupil.id}
            onClick={() => setPupilId(s.id)}
            className={`${pill} ${s.id === data.pupil.id ? "border-primary bg-primary text-white" : "border-border bg-card"}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    ) : null;

  if (!data.enabled) {
    return (
      <div className={wrap}>
        {selector}
        {fallback ?? (
          <div className={`${card} text-center`}>
            <div className="text-3xl">🪙</div>
            <p className="mt-2 text-sm font-semibold">{t("Tangalar tizimi hali ishga tushirilmagan")}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("Markaz uni yoqqach, shu yerda tangalaring, darajang va istaklaring ko'rinadi.")}</p>
          </div>
        )}
      </div>
    );
  }

  const balance = data.wallet?.balance ?? 0;
  const earned = data.wallet?.earnedTotal ?? 0;
  const L = data.levels ?? [];
  const li = data.levelIndex ?? 0;
  const nx = L[li + 1];
  const pct = nx ? Math.max(0, Math.min(100, Math.round(((earned - L[li].minEarned) / (nx.minEarned - L[li].minEarned)) * 100))) : 100;
  const frozen = !!data.pupil.frozen;
  const wishes = data.wishes ?? [];
  const max = data.wishlistMax ?? 5;
  const full = wishes.length >= max;
  const curMonth = data.month ?? "";
  const filters: [Filter, string][] = [
    ["all", t("Hammasi")],
    ["month", curMonth ? monthName(curMonth) : t("Shu oy")],
    ["plus", t("Berilgan")],
    ["minus", t("Ayirilgan")],
    ["shop", t("Do'kon")],
    ["cancelled", t("Bekor qilingan")],
  ];

  return (
    <div className={wrap}>
      {toastNode}
      {selector}
      <div>
        <h1 className="text-[22px] font-extrabold leading-tight">{t("Salom, {name}!", { name: data.pupil.firstName })}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t("Tangalaring, darajang, istaklaring va guruhdagi o'rning shu yerda.")}
          {data.pupil.center && <span className="ml-1 whitespace-nowrap">· {data.pupil.center}</span>}
        </p>
      </div>
      {frozen && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[13px] font-medium">
          ❄️ {t("Hamyoning muzlatilgan — markazga qaytsang tangalaring tiklanadi")}
        </div>
      )}

      <div className="flex gap-1.5" role="tablist">
        {(["me", "shop"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`${pill} flex-1 ${tab === k ? "border-primary bg-primary text-white" : "border-border bg-card"}`}
          >
            {k === "me" ? t("Mening sahifam") : t("Do'kon")}
          </button>
        ))}
      </div>

      {tab === "me" ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={card}>
              <div className="text-[12px] font-semibold text-muted-foreground">{t("Tangalaring")}</div>
              <div className="gm-coin mt-1 text-[26px]">{balance}</div>
            </div>
            <div className={card}>
              <div className="text-[12px] font-semibold text-muted-foreground">{t("Daraja · {n}/{total}", { n: li + 1, total: L.length })}</div>
              <b className="text-[16px]">{t(L[li]?.name ?? "")}</b>
              <div className="mt-2 flex gap-1" aria-hidden>
                {L.map((l, k) => (
                  <i key={l.position} className={`h-1.5 flex-1 rounded-full ${k <= li ? "bg-primary" : "bg-secondary"}`} />
                ))}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <i className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                {nx ? t("«{level}» darajasigacha {n} tanga", { level: t(nx.name), n: nx.minEarned - earned }) : t("Eng yuqori daraja")} ·{" "}
                {t("jami topilgan {n}", { n: earned })}
              </div>
            </div>
            <div className={card}>
              <div className="text-[12px] font-semibold text-muted-foreground">
                {t("Uzluksiz davomat")}
                {(data.groupsCount ?? 0) > 1 && data.bestStreak ? ` · ${data.bestStreak.group}` : ""}
              </div>
              <b className="text-[16px]">🔥 {t("{n} dars", { n: data.bestStreak?.run ?? 0 })}</b>
              {data.streakOn && data.bestStreak && (
                <div className="mt-1 text-[12px] text-muted-foreground">{t("yana {n} dars kelsang +{bonus}", { n: data.bestStreak.next, bonus: data.streakBonus ?? 0 })}</div>
              )}
            </div>
          </div>

          {(data.discounts ?? []).map((d) => (
            <div key={d.month + d.groupLabel} className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-[13px]">
              🏷️ {t("{month} oyi to'lovingga {pct}% chegirma qo'llanadi", { month: monthName(d.month), pct: d.percent })} — {d.groupLabel} (−{nf(d.amountSom)} {t("so'm")}).
            </div>
          ))}

          <Section
            title={<>♥ {t("Istaklarim")} <span className="ml-1 text-[12.5px] font-semibold text-muted-foreground">{wishes.length}/{max}</span></>}
            right={
              <button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setTab("shop")}>
                {t("Do'konga →")}
              </button>
            }
          >
            {wishes.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("Hali istak yo'q. Do'konga o'tib, yoqqan sovg'a ostidagi ♡ tugmasini bos.")}</p>
            ) : (
              <div className="space-y-2">
                {wishes.map((w) => {
                  const p = Math.min(100, Math.round((balance / Math.max(1, w.price)) * 100));
                  return (
                    <div key={w.itemId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                      <Thumb imageUrl={w.imageUrl} emoji={w.emoji} size={44} />
                      <div className="min-w-0 flex-1">
                        <b className="text-[13.5px]">{t(w.title)}</b>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                          <span className="gm-coin">
                            {balance} / {w.price}
                          </span>
                          {w.ready ? (
                            <span className="gm-pos">✓ {t("Tanga yetadi — filial adminiga murojaat qil")}</span>
                          ) : (
                            <span className="text-muted-foreground">{t("yana {n} tanga kerak", { n: w.price - balance })}</span>
                          )}
                          {w.noStock && <Chip tone="r">{t("omborda yo'q")}</Chip>}
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <i className={`block h-full rounded-full ${w.ready ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${p}%` }} />
                        </div>
                        {w.addedAt && <div className="mt-1 text-[11.5px] text-muted-foreground">{t("{date} da qo'shilgan", { date: fmtDate(w.addedAt) })}</div>}
                      </div>
                      {!frozen && (
                        <button
                          type="button"
                          className="gm-tap inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                          title={t("Istaklardan olib tashlash")}
                          aria-label={t("Istaklardan olib tashlash")}
                          disabled={busy !== null}
                          onClick={() => void toggleWish(w.itemId, false, w.title)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            title={<>🛍️ {t("Sotib olganlarim")} <span className="ml-1 text-[12.5px] font-semibold text-muted-foreground">{(data.orders ?? []).length}</span></>}
            right={
              (data.orders ?? []).length > 0 ? (
                <span className="text-[12px] text-muted-foreground">
                  {t("jami sarflangan:")} <b className="gm-coin">{data.spentTotal ?? 0}</b>
                </span>
              ) : undefined
            }
          >
            {(data.orders ?? []).length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("Hali do'kondan hech narsa olmading.")}</p>
            ) : (
              <div className="divide-y divide-border/60">
                {(data.orders ?? []).map((o) => (
                  <div key={o.id} className={`flex items-start gap-3 py-2 text-[13px] ${o.status === "returned" ? "opacity-70" : ""}`}>
                    <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{fmtDate(o.givenDate)}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{t(o.itemName)}</span>
                      {o.status === "returned" && (
                        <div className="gm-neg text-[12px]">{t("Qaytarildi: {note} · {date}", { note: t(o.returnNote ?? ""), date: o.returnedAt ? fmtDate(o.returnedAt) : "" })}</div>
                      )}
                    </div>
                    {o.status === "returned" ? <span className="gm-strike">−{o.priceCoins}</span> : <span className="gm-neg">−{o.priceCoins}</span>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {(data.rankings ?? []).map((g) => (
            <Section
              key={g.groupId}
              title={curMonth ? `${g.label} · ${monthName(curMonth).toLowerCase()}` : g.label}
              right={g.me ? <Chip tone="b">{t("{rank}-o'rin · {n} tadan", { rank: g.me.rank, n: g.total })}</Chip> : undefined}
            >
              <div className="divide-y divide-border/60">
                {g.top.map((r) => (
                  <div key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 py-2 text-[13.5px] ${r.me ? "rounded-lg bg-primary/10 px-2 font-bold" : ""}`}>
                    <span className="w-8 text-center">{(r.points > 0 && MEDAL[r.rank]) || r.rank}</span>
                    <span className="min-w-0 flex-1 truncate">{r.me ? t("Sen") : r.name}</span>
                    <span className="gm-coin">{r.points}</span>
                  </div>
                ))}
                {g.me && g.me.rank > 5 && (
                  <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-2 py-2 text-[13.5px] font-bold">
                    <span className="w-8 text-center">{g.me.rank}</span>
                    <span className="min-w-0 flex-1">{t("Sen")}</span>
                    <span className="gm-coin">{g.me.points}</span>
                  </div>
                )}
              </div>
              {g.me && g.me.rank > 5 && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {t("Top-5 ga chiqish uchun yana {n} tanga kerak. Sendan pastdagilar ko'rsatilmaydi.", { n: g.needForTop5 })}
                </p>
              )}
            </Section>
          ))}

          <Section title={t("Nishonlaring")}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(data.badges ?? []).map((b) => (
                <div
                  key={b.code}
                  title={b.earned ? t("Olingan") : t("Hali olinmagan")}
                  className={`rounded-xl border px-3 py-2.5 text-center ${b.earned ? "border-amber-400/50 bg-amber-400/10" : "border-border opacity-45 grayscale"}`}
                >
                  <div className="text-[24px] leading-none">{b.emoji}</div>
                  <div className="mt-1 text-[12.5px] font-semibold">
                    {t(b.name)}
                    {b.times > 1 && <span className="ml-1 text-[11px] text-muted-foreground">×{b.times}</span>}
                  </div>
                  <div className="text-[11.5px] leading-snug text-muted-foreground">{t(b.desc)}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t("Tanga tarixi")}>
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t("Tarix filtri")}>
              {filters.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setFilter(k);
                    void loadHistory(k, 0);
                  }}
                  className={`gm-tap rounded-full border px-3 py-1 text-[12.5px] font-medium ${filter === k ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-secondary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!hist || hist.rows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{t("Bu filtr bo'yicha yozuv yo'q.")}</p>
            ) : (
              <div className="divide-y divide-border/60">
                {hist.rows.map((r) => {
                  const cx = r.status === "cancelled";
                  return (
                    <div key={r.id} className="flex items-start gap-3 py-2 text-[13px]">
                      <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{fmtDate(r.date)}</span>
                      <div className="min-w-0 flex-1">
                        <span className={`font-medium ${cx ? "gm-strike" : ""}`}>{t(r.label)}</span>
                        {r.note && <div className="text-[12px] text-muted-foreground">{t(r.note)}</div>}
                        {r.groupLabel && <div className="text-[12px] text-muted-foreground">{r.groupLabel}</div>}
                        {cx && <div className="gm-neg text-[12px]">{t("Bekor qilindi: {note}", { note: t(r.cancelNote ?? "") })}</div>}
                      </div>
                      {cx ? <span className="gm-strike tabular-nums">{signed(r.amount)}</span> : <span className={`tabular-nums ${r.amount < 0 ? "gm-neg" : "gm-pos"}`}>{signed(r.amount)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {hist && hist.total > hist.rows.length && (
              <div className="mt-2 text-center">
                <button type="button" className="gm-tap rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-secondary" onClick={() => void loadHistory(filter, hist.rows.length)}>
                  {t("Yana ko'rsatish ({n} ta qoldi)", { n: hist.total - hist.rows.length })}
                </button>
              </div>
            )}
          </Section>
        </>
      ) : (
        <>
          <p className="text-[13px] text-muted-foreground">
            {t("Tangalaringni sovg'aga almashtir: yoqqan sovg'ani ♡ bilan istaklaringga qo'sh, tanga yetganda filial adminiga murojaat qil.")}
          </p>
          <div className="rounded-xl bg-secondary/60 px-3.5 py-2.5 text-[13px]">
            {t("Balansing:")} <b className="gm-coin">{balance}</b> · {t("istaklaring:")}{" "}
            <b>
              {wishes.length}/{max}
            </b>
            {full && <> — {t("ro'yxat to'ldi")}</>} ·{" "}
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setTab("me")}>
              {t("Istaklarim →")}
            </button>
          </div>
          {(data.shop ?? []).length === 0 ? (
            <div className={`${card} text-sm text-muted-foreground`}>{t("Bu toifada sovg'a yo'q.")}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(data.shop ?? []).map((i) => {
                const title = i.kind === "discount" ? t("Keyingi oy to'loviga {n}% chegirma", { n: i.percent ?? 5 }) : t(i.title);
                return (
                  <div key={i.id} className={`${card} flex flex-col gap-2`}>
                    <div className="flex items-start gap-3">
                      <Thumb imageUrl={i.imageUrl} emoji={i.emoji} size={60} />
                      <div className="min-w-0 flex-1">
                        <b className="block text-[14px] leading-snug">{title}</b>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.kind === "discount" ? <Chip tone="g">{t("Oyiga 1 marta")}</Chip> : i.kind === "service" ? <Chip tone="m">{t("Xizmat")}</Chip> : null}
                        </div>
                      </div>
                    </div>
                    {i.need > 0 ? (
                      <span className="text-[12.5px] text-muted-foreground">{t("yana {n} tanga kerak", { n: i.need })}</span>
                    ) : (
                      <span className="gm-pos text-[12.5px]">✓ {t("Tangang yetadi")}</span>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <span className="gm-coin text-[16px]">{i.price}</span>
                      {!frozen && (
                        <button
                          type="button"
                          className={`gm-tap rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${i.wished ? "border-rose-400/60 bg-rose-500/10 text-rose-600 dark:text-rose-300" : "border-border hover:bg-secondary"} disabled:opacity-40`}
                          disabled={busy !== null || (!i.wished && full)}
                          title={!i.wished && full ? t("Istaklar to'ldi ({n}/{n})", { n: max }) : undefined}
                          onClick={() => void toggleWish(i.id, !i.wished, i.kind === "discount" ? `Keyingi oy to'loviga ${i.percent ?? 5}% chegirma` : i.title)}
                        >
                          {i.wished ? `♥ ${t("Istakda")}` : `♡ ${t("Istakka")}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {data.telegramUrl && (
        <a
          href={data.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="gm-tap flex items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-4 py-3 text-[14px] font-bold text-white hover:opacity-90"
        >
          ✈️ {t("Telegramda ochish")}
        </a>
      )}
    </div>
  );
}
