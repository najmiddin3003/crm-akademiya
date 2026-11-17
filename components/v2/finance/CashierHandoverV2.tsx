"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Clock, Loader2, Minus, Plus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { DENOMINATIONS, type HandoverCard } from "@/lib/dailyHandoverTypes";
import { daysBetween } from "@/lib/studentListsTypes";

// YANGI VERSIYA — KUNLIK TOPSHIRUV · KASSIR (32-qism, rasm «Kunlik topshiruv · kassir · Telefon»). Filial
// kassiri kun oxirida: kassadagi naqd va plastik, naqdni kupyuralar bo'yicha sanaydi («✓ mos» / farq), plastikni
// belgilaydi va «Topshirish». Pul rahbar tasdiqlaguncha kassada turadi. Server: /api/cashboxes/daily/send.
// Rahbar bo'lmagan xodim «Kunlik topshiruv»ni ochganda chiqadi (DailyHandoverV2 → `cashier`).

interface Mine {
  ok: true;
  today: string;
  primary: { id: number; name: string };
  card: HandoverCard;
}
const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");

export default function CashierHandoverV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [d, setD] = useState<Mine | null>(null);
  const [err, setErr] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [plastik, setPlastik] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(
    () =>
      fetch("/api/cashboxes/daily/send", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok) {
            setD(j);
            setErr("");
          } else setErr(String(j?.error || "Ma'lumot olinmadi"));
        })
        .catch(() => setErr("Tarmoq xatosi")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (err)
    return (
      <div data-ui="v2" className="min-h-full bg-v2-surface p-4 font-v2 sm:p-6">
        <NoticeBar>{t(err)}</NoticeBar>
      </div>
    );
  if (!d)
    return (
      <div
        data-ui="v2"
        className="flex min-h-full items-center gap-2 bg-v2-surface p-6 font-v2 text-v2-small text-v2-text-3"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
        {t("Yuklanmoqda…")}
      </div>
    );

  const c = d.card;
  const naqd = Number(c.methods.naqd ?? 0);
  const plast = Number(c.methods.plastik ?? 0);
  const counted = DENOMINATIONS.reduce((s, v) => s + v * (counts[v] ?? 0), 0);
  const diff = counted - naqd;
  const sendTotal = counted + (plastik ? plast : 0);
  const lastDays = c.last ? daysBetween(c.last.date, d.today) : null;
  const step = (v: number, by: number) =>
    setCounts((x) => ({ ...x, [v]: Math.max(0, (x[v] ?? 0) + by) }));

  async function send() {
    setSending(true);
    const r = await fetch("/api/cashboxes/daily/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naqd: counted, plastik, denominations: counts }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSending(false);
    if (!r?.ok) return showError(t(r?.error || "Yuborib bo'lmadi"));
    showSuccess(
      t("{s} so'm topshirildi — rahbar tasdiqlashi kutilmoqda", {
        s: nf(r.total),
      }),
    );
    setCounts({});
    emitMoneyChanged();
    void load();
  }

  return (
    <div
      data-ui="v2"
      className="min-h-full bg-v2-surface-2 font-v2 text-v2-text"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-4 pb-28 sm:p-6">
        <div>
          <h1 className="text-v2-page text-v2-text">{t("Kunlik topshiruv")}</h1>
          <p className="text-v2-small text-v2-text-2">
            {t("{name} kassasi", { name: c.name })}
          </p>
        </div>

        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <div className="flex items-start justify-between gap-2">
            <span className="text-v2-small text-v2-text-2">
              {t("Bugun kassada · {d}", { d: fmt.dayMonth(d.today) })}
            </span>
            {c.pending ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-v2-info-bg px-2 py-0.5 text-v2-small font-semibold text-v2-info">
                <Clock className="size-3.5" aria-hidden />{" "}
                {t("Tasdiq kutilmoqda")}
              </span>
            ) : lastDays === null || lastDays > 0 ? (
              <span className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-small font-semibold text-v2-warning">
                {lastDays === null
                  ? t("Hali topshirilmagan")
                  : t("{n} kun topshirilmagan", { n: lastDays })}
              </span>
            ) : (
              <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-small font-semibold text-v2-success">
                {t("Bugun topshirildi")}
              </span>
            )}
          </div>
          <div className="mt-1 text-[30px] font-semibold leading-9 tabular-nums text-v2-text">
            {nf(c.total)}{" "}
            <span className="text-v2-body font-normal text-v2-text-2">
              {"so'm"}
            </span>
          </div>
          <div className="mt-1 flex gap-4 text-v2-small text-v2-text-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-v2-success" />{" "}
              {t("Naqd")}{" "}
              <b className="tabular-nums text-v2-text">{nf(naqd)}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-v2-violet" />{" "}
              {t("Plastik")}{" "}
              <b className="tabular-nums text-v2-text">{nf(plast)}</b>
            </span>
          </div>
          {c.last && (
            <div className="mt-1 text-v2-small text-v2-warning">
              {t("Oxirgi topshiruv: {d}", {
                d: `${fmt.dayMonth(c.last.date)} | ${c.last.time}`,
              })}
            </div>
          )}
        </section>

        {c.pending ? (
          <NoticeBar icon={Clock}>
            {t(
              "{s} so'm {d} da {p}ga jo'natilgan — rahbar tasdiqlagach yangi topshiruv qilish mumkin.",
              {
                s: nf(c.pending.total),
                d: `${fmt.dayMonth(c.pending.date)} ${c.pending.time}`,
                p: d.primary.name,
              },
            )}
          </NoticeBar>
        ) : (
          <>
            <div className="flex items-baseline justify-between px-1">
              <span className="font-semibold text-v2-text">
                {t("Naqd pulni sanang")}
              </span>
              {counted > 0 &&
                (diff === 0 ? (
                  <span className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-success">
                    <Check className="size-4" /> {nf(counted)} · {t("mos")}
                  </span>
                ) : (
                  <span
                    className={`text-v2-small font-semibold ${diff > 0 ? "text-v2-danger" : "text-v2-warning"}`}
                  >
                    {nf(counted)} ·{" "}
                    {diff > 0
                      ? t("{n} ortiq", { n: nf(diff) })
                      : t("{n} kam", { n: nf(-diff) })}
                  </span>
                ))}
            </div>
            <section className="divide-y divide-v2-border overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              {DENOMINATIONS.map((v) => (
                <div key={v} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-20 font-semibold tabular-nums text-v2-text">
                    {nf(v)}
                  </span>
                  <div className="flex items-center rounded-v2-md border border-v2-border">
                    <button
                      type="button"
                      onClick={() => step(v, -1)}
                      aria-label={t("Kamaytirish")}
                      className="grid size-9 place-items-center text-v2-text-2"
                    >
                      <Minus className="size-4" />
                    </button>
                    <input
                      value={counts[v] ?? 0}
                      onChange={(e) =>
                        setCounts((x) => ({
                          ...x,
                          [v]: Math.max(
                            0,
                            Number(e.target.value.replace(/\D/g, "")) || 0,
                          ),
                        }))
                      }
                      inputMode="numeric"
                      aria-label={t("{v} so'mlik soni", { v: nf(v) })}
                      className="h-9 w-12 bg-transparent text-center font-semibold tabular-nums text-v2-text outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => step(v, 1)}
                      aria-label={t("Ko'paytirish")}
                      className="grid size-9 place-items-center text-v2-text-2"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="ml-auto tabular-nums text-v2-text-2">
                    {counts[v] ? nf(v * counts[v]) : "0"}
                  </span>
                </div>
              ))}
            </section>

            {plast > 0 && (
              <label className="flex items-start gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <V2Checkbox
                  checked={plastik}
                  onChange={setPlastik}
                  label={t("Plastik")}
                />
                <span>
                  <span className="block font-semibold text-v2-text">
                    {t("Plastik {s} so'm", { s: nf(plast) })}
                  </span>
                  <span className="text-v2-small text-v2-text-2">
                    {t("rahbar kartasiga o'tkazdim")}
                  </span>
                </span>
              </label>
            )}

            {counted > 0 && (
              <div
                className={`flex items-start gap-2 rounded-v2-md px-3 py-2.5 text-v2-small ${diff === 0 ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                {diff === 0
                  ? t("Farq yo'q. Rahbar tasdiqlagach kassangiz 0 bo'ladi.")
                  : diff > 0
                    ? t("Sanalgan pul kassadagidan ko'p — qayta sanang.")
                    : t(
                        "{n} so'm kam sanaldi — farq izohda qayd etiladi, qolgani kassangizda qoladi.",
                        { n: nf(-diff) },
                      )}
              </div>
            )}

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-v2-border bg-v2-surface p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || diff > 0 || sendTotal <= 0}
                className={`${primaryBtn} h-12 w-full justify-center text-[16px] disabled:opacity-50`}
              >
                <Check className="size-5" aria-hidden />
                {t("Topshirish · {s} so'm", { s: nf(sendTotal) })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
