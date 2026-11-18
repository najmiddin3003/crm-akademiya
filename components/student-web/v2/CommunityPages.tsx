"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, ChevronRight, Copy, Gift, Info, Loader2, Send, Share2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { NEWS_ICON_VIEW } from "@/components/v2/sales/newsIcons";
import type { RefState } from "@/lib/referralTypes";
import type { StudentCabinet } from "@/lib/studentCabinetTypes";
import type { StudentMe } from "@/components/student-web/types";
import { Card, Empty, initials, useCabinetFmt, type CabinetTab } from "./bits";
import { extras } from "./CabinetPages";
import { StoriesStrip } from "./CabinetFeed";
import { PageHead } from "./lessonParts";

// O'QUVCHI KABINETI — 44-qism ichki sahifalari (Asosiy'dan ochiladi, «← Asosiy» bilan qaytiladi):
//   «TAKLIF QILISH» (rasm «Kabinet · Taklif qilish») — Sotuv → Referallar (29-qism) ma'lumoti: kodim, havolam
//   (ochiq so'rovnoma `/sorovnoma?ref=KOD`) va QR, takliflarim (ism — birinchi harf bilan), referal sovg'alari
//   («So'rash» — rahbar tasdiqlaydi). Hali taklif qiluvchi bo'lmasa — «Kodimni olish».
//   «YANGILIKLAR» (rasm «Kabinet · Yangiliklar») — hikoyalar, e'lonlar lentasi (36-qism) va «Chorak bahosi keldi».

function Crumb({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1.5 text-v2-small text-v2-text-2 hover:text-v2-text">
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

interface RefData {
  joined: boolean;
  canJoin?: boolean;
  code?: string;
  invited?: number;
  paid?: number;
  counted?: number;
  balance?: number;
  pending?: { giftId: number; createdAt: string } | null;
  links?: { id: number; name: string; group: string; state: RefState; stateLabel: string; stateSub: string; date: string }[];
  gifts?: { id: number; name: string; desc: string; price: number; stock: number }[];
  requests?: { id: number; giftName: string; price: number; status: string; createdAt: string; comment: string }[];
}

const STATE_TONE: Record<RefState, string> = {
  lid: "bg-v2-surface-2 text-v2-text-2",
  sinov: "bg-v2-info-bg text-v2-info",
  guruh: "bg-v2-warning-bg text-v2-warning",
  qisman: "bg-v2-warning-bg text-v2-warning",
  hisoblandi: "bg-v2-success-bg text-v2-success",
  rad: "bg-v2-danger-bg text-v2-danger",
};

export function TaklifPage({ me, initData, onBack }: { me: StudentMe; initData: string; onBack: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [d, setD] = useState<RefData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    void extras<RefData>(initData, { action: "referral" }).then((j) => (j?.ok ? setD(j as RefData) : setErr(String(j?.error ?? t("Yuklanmadi")))));
  }, [initData, t]);

  const link = d?.code ? `${typeof window === "undefined" ? "" : window.location.origin}/sorovnoma?ref=${d.code}` : "";
  useEffect(() => {
    if (!link) return;
    void QRCode.toDataURL(link, { margin: 0, width: 240 }).then(setQr).catch(() => setQr(""));
  }, [link]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr("");
    const j = await extras<RefData>(initData, body);
    setBusy(false);
    if (j?.ok) setD(j as RefData);
    else setErr(String(j?.error ?? t("Saqlanmadi")));
  };
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(""), 1600);
    });
  };
  const share = () => {
    const text = t("Men shu o'quv markazida o'qiyman — ariza qoldiring, kodim: {code}", { code: d?.code ?? "" });
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else if (navigator.share) void navigator.share({ url: link, text }).catch(() => {});
    else copy(link, "link");
  };

  const gifts = d?.gifts ?? [];
  const nextGift = gifts.find((g) => g.price > (d?.balance ?? 0)) ?? null;
  const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-v2-md px-4 text-v2-small font-semibold disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div>
        <Crumb label={t("Asosiy")} onBack={onBack} />
        <PageHead title={t("Taklif qilish")} sub={t("Do'stingiz kelib, birinchi oyini to'liq to'lasa — +1 referal")} />
      </div>
      {err ? <p className="text-v2-small text-v2-danger">{err}</p> : null}
      {!d ? (
        <div className="h-48 animate-pulse rounded-v2-lg bg-v2-skeleton" />
      ) : !d.joined ? (
        <Card>
          <div className="mx-auto max-w-md py-6 text-center">
            <Gift className="mx-auto size-10 text-v2-brand-text" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-v2-section text-v2-text">{t("Do'stlaringizni taklif qiling")}</h2>
            <p className="mt-1 text-v2-small text-v2-text-2">{t("Shaxsiy kodingiz va havolangizni oling. Do'stingiz shu kod bilan ariza qoldirib, birinchi oyini to'lasa — sizga +1 referal, referallar sovg'aga almashtiriladi.")}</p>
            {d.canJoin ? (
              <button type="button" disabled={busy} onClick={() => void act({ action: "referral-join" })} className={`${btn} mt-4 bg-v2-brand text-v2-on-brand`}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("Kodimni olish")}
              </button>
            ) : (
              <p className="mt-4 text-v2-small text-v2-text-3">{t("Referal dasturi hozircha yoqilmagan — o'quv markazidan so'rang.")}</p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <div className="grid grid-cols-3 gap-3">
                {[
                  [t("Referallarim"), d.balance ?? 0, t("referal")],
                  [t("Takliflarim"), d.invited ?? 0, t("kishi")],
                  [t("To'lov qildi"), d.paid ?? 0, t("kishi")],
                ].map(([a, n, u]) => (
                  <div key={String(a)}>
                    <div className="text-v2-small text-v2-text-2">{a}</div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <b className="text-[1.75rem] font-semibold leading-none tabular-nums text-v2-text">{n}</b>
                      <span className="text-v2-small text-v2-text-2">{u}</span>
                    </div>
                  </div>
                ))}
              </div>
              {nextGift ? (
                <div className="mt-4 border-t border-v2-border pt-3">
                  <div className="flex items-baseline justify-between gap-2 text-v2-small">
                    <span className="font-semibold text-v2-text">{t("Keyingi sovg'a — {name}", { name: nextGift.name })}</span>
                    <b className="tabular-nums text-v2-text">
                      {d.balance} / {nextGift.price}
                    </b>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-v2-full bg-v2-track">
                    <div className="h-full rounded-v2-full bg-v2-brand" style={{ width: `${Math.min(100, ((d.balance ?? 0) / nextGift.price) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("yana {n} ta to'lov qilgan taklif kerak", { n: nextGift.price - (d.balance ?? 0) })}</p>
                </div>
              ) : null}
            </Card>

            <Card>
              <h2 className="text-v2-section text-v2-text">{t("Sizning kodingiz")}</h2>
              <p className="mb-3 text-v2-small text-v2-text-3">{t("do'stingiz arizada shu kodni aytadi yoki havolani ochadi")}</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- QR data URL (mahalliy)
                  <img src={qr} alt={t("QR kod")} className="size-32 shrink-0 self-center rounded-v2-sm bg-white p-1.5" />
                ) : (
                  <div className="size-32 shrink-0 self-center rounded-v2-sm bg-v2-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[1.75rem] font-semibold tracking-wider text-v2-text">{d.code}</div>
                  <div className="mt-2 flex items-center gap-2 rounded-v2-md border border-v2-border-strong px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-v2-small text-v2-text-2">{link.replace(/^https?:\/\//, "")}</span>
                    <button type="button" onClick={() => copy(link, "link")} aria-label={t("Havolani nusxalash")} className="shrink-0 text-v2-text-2 hover:text-v2-text">
                      <Copy className="size-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={share} className={`${btn} bg-v2-brand text-v2-on-brand`}>
                      <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
                      {t("Ulashish")}
                    </button>
                    <button type="button" onClick={() => copy(d.code ?? "", "code")} className={`${btn} border border-v2-border-strong text-v2-text`}>
                      <Copy className="size-4" strokeWidth={1.75} aria-hidden />
                      {copied ? t("Nusxalandi") : t("Kodni nusxalash")}
                    </button>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-v2-caption text-v2-text-3">
                    <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
                    {t("Havola ariza sahifasini ochadi — arizada kodingiz o'zi yoziladi.")}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-v2-section text-v2-text">{t("Takliflarim")}</h2>
              <p className="mb-2 text-v2-small text-v2-text-3">{t("{n} ta · ism faqat birinchi harfi bilan", { n: d.links?.length ?? 0 })}</p>
              {(d.links ?? []).length === 0 ? (
                <Empty>{t("Hali taklif yo'q. Kodingizni do'stlaringizga yuboring.")}</Empty>
              ) : (
                <ul className="divide-y divide-v2-border">
                  {d.links!.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 py-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{initials(l.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-v2-body font-medium text-v2-text">{l.name}</div>
                        <div className="truncate text-v2-caption text-v2-text-3">{l.group || "—"}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${STATE_TONE[l.state]}`}>{l.state === "hisoblandi" ? t("+1 referal") : t(l.stateLabel)}</span>
                        <div className="mt-1 text-v2-caption text-v2-text-3">{fmt.dayMonth(l.date)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <h2 className="mb-3 text-v2-section text-v2-text">{t("Qanday ishlaydi")}</h2>
              <ol className="space-y-3">
                {[
                  [t("Kod yoki havolani yuboring"), t("do'stingizga, sinfdoshingizga yoki tanishingizga")],
                  [t("U ariza qoldiradi"), t("havola orqali yoki kodni aytib — taklif sizga yoziladi")],
                  [t("Birinchi oyini to'liq to'lasa — +1 referal"), t("referallar yig'iladi va sovg'aga almashtiriladi")],
                ].map(([a, b], i) => (
                  <li key={a} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-v2-brand-bg text-v2-caption font-semibold text-v2-brand-text">{i + 1}</span>
                    <span>
                      <span className="block text-v2-body font-medium text-v2-text">{a}</span>
                      <span className="block text-v2-small text-v2-text-3">{b}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card>
              <h2 className="text-v2-section text-v2-text">{t("Sovg'alar")}</h2>
              <p className="mb-2 text-v2-small text-v2-text-3">{t("referal do'koni · {n} ta", { n: gifts.length })}</p>
              {gifts.length === 0 ? (
                <Empty>{t("Sovg'alar hali qo'shilmagan.")}</Empty>
              ) : (
                <ul className="divide-y divide-v2-border">
                  {gifts.map((g) => {
                    const can = (d.balance ?? 0) >= g.price && g.stock > 0;
                    const waiting = d.pending?.giftId === g.id;
                    return (
                      <li key={g.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid size-8 shrink-0 place-items-center rounded-v2-md ${can ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>
                            <Gift className="size-4" strokeWidth={1.75} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-v2-body font-medium text-v2-text">{g.name}</div>
                            <div className="text-v2-caption text-v2-text-3">
                              {[t("{n} referal", { n: g.price }), g.desc, !can && g.price > (d.balance ?? 0) ? t("yana {n} ta kerak", { n: g.price - (d.balance ?? 0) }) : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          {waiting ? (
                            <span className="rounded-v2-sm bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-medium text-v2-warning">{t("Kutilmoqda")}</span>
                          ) : can ? (
                            <button type="button" disabled={busy || !!d.pending} onClick={() => void act({ action: "referral-gift", giftId: g.id })} className={`${btn} h-8 bg-v2-brand px-3 text-v2-on-brand`}>
                              {t("So'rash")}
                            </button>
                          ) : (
                            <b className="shrink-0 tabular-nums text-v2-text">
                              {d.balance} / {g.price}
                            </b>
                          )}
                        </div>
                        {!can && !waiting ? (
                          <div className="mt-2 h-1 overflow-hidden rounded-v2-full bg-v2-track">
                            <div className="h-full rounded-v2-full bg-v2-border-strong" style={{ width: `${Math.min(100, ((d.balance ?? 0) / g.price) * 100)}%` }} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 flex items-start gap-2 text-v2-small text-v2-text-3">
                <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("Sovg'a olmasangiz, referallar yig'ilib boradi. So'rovni admin tasdiqlagach, sovg'ani {branch} filialidan olasiz.", { branch: me.cabinet?.branch.name || me.profile.branch || t("o'z") })}
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export function NewsPage({ me, cab, initData, go, onBack }: { me: StudentMe; cab: StudentCabinet; initData: string; go: (t: CabinetTab) => void; onBack: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const feed = me.feed;
  const news = feed?.news ?? [];
  const stories = feed?.stories ?? [];
  const season = me.season ?? [];
  const when = (iso: string) => {
    const d = new Date(Date.parse(iso) + 5 * 3600_000).toISOString();
    return d.slice(0, 10) === cab.today ? `${t("Bugun")}, ${d.slice(11, 16)}` : fmt.dayMonth(d.slice(0, 10));
  };
  useEffect(() => {
    const ids = (feed?.news ?? []).map((n) => n.id);
    if (!ids.length) return;
    void fetch("/api/student-web/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, ids }) }).catch(() => {});
  }, [initData, feed]);

  return (
    <div className="space-y-4">
      <div>
        <Crumb label={t("Asosiy")} onBack={onBack} />
        <PageHead title={t("Yangiliklar")} sub={[cab.branch.name || me.profile.branch, t("e'lonlar, hikoyalar va chorak baholari")].filter(Boolean).join(" · ")} />
      </div>
      {stories.length ? (
        <Card>
          <h2 className="text-v2-section text-v2-text">{t("Hikoyalar")}</h2>
          <p className="mb-3 text-v2-small text-v2-text-3">{t("24 soat ko'rinadi · ko'rilmaganlari rangli halqada")}</p>
          <StoriesStrip items={stories} initData={initData} />
        </Card>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {news.length === 0 ? (
            <Card>
              <Empty>{t("Hozircha yangilik yo'q.")}</Empty>
            </Card>
          ) : (
            news.map((n) => {
              const v = NEWS_ICON_VIEW[n.icon];
              return (
                <Card key={n.id} className="overflow-hidden !p-0 sm:!p-0">
                  <div className="flex flex-col sm:flex-row">
                    {n.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary)
                      <img src={n.image} alt="" className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:w-52" />
                    ) : (
                      <div className={`flex h-20 shrink-0 items-end px-4 pb-3 sm:h-auto sm:w-52 ${v.bg}`}>
                        <span className={`text-v2-caption font-bold uppercase tracking-wide ${v.tx}`}>{t(v.label)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 p-4 sm:p-5">
                      <div className="text-v2-caption text-v2-text-3">{when(n.publishAt)}</div>
                      <div className="mt-1 text-v2-section text-v2-text">{n.title}</div>
                      {n.body ? <p className="mt-1 whitespace-pre-line text-v2-small text-v2-text-2">{n.body}</p> : null}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {season.map((s) => (
            <Card key={`${s.season}:${s.group}`}>
              <div className="text-v2-caption font-semibold text-v2-brand-text">{t("Chorak bahosi keldi · {s}", { s: s.label.split(",")[0] })}</div>
              <div className="mt-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-v2-body font-semibold text-v2-text">{s.group}</div>
                  <div className="text-v2-caption text-v2-text-3">{[s.teacher, s.sentAt ? fmt.dayMonth(s.sentAt.slice(0, 10)) : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="text-[1.75rem] font-semibold leading-none tabular-nums text-v2-success">{s.avg === null ? "—" : String(s.avg).replace(".", ",")}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {s.criteria.map((c) => (
                  <div key={c.name} className="flex items-center justify-between rounded-v2-md border border-v2-border px-2.5 py-1.5 text-v2-small">
                    <span className="truncate text-v2-text">{t(c.name)}</span>
                    <b className={c.score >= 5 ? "text-v2-success" : "text-v2-text"}>{c.score || "—"}</b>
                  </div>
                ))}
              </div>
              {s.note ? <p className="mt-2 text-v2-small text-v2-text-2">«{s.note}»</p> : null}
              <button type="button" onClick={() => go("natijalar")} className="mt-2 inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
                {t("Natijalar")}
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
