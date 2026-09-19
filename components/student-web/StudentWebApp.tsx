"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudentMe } from "@/components/student-web/types";
import { useT } from "@/components/shared/Language";

// O'QUVCHI WEB SAHIFASI — botdagi tugma orqali Telegram ichida ochiladi.
//
// FAQAT KO'RSATADI. Bu yerda birorta ham yozish so'rovi yo'q va
// bo'lmasligi kelishilgan: CRM ma'lumoti xodim orqali o'zgaradi. Shu
// sabab hech qaysi maydon `input` emas — ko'rinishning o'zi "bu yerda
// tahrirlanmaydi" deb turadi.
//
// KIM EKANI SHU YERDA ANIQLANMAYDI. Sahifa Telegramdan `initData`
// satrini oladi va uni serverga UZATADI, xolos. Butun ishonch
// /api/student-web/me da, imzo tekshiruvidan keyin quriladi. Shu bois
// bu fayldagi hech narsani o'zgartirib boshqa o'quvchining ma'lumotini
// ochib bo'lmaydi — so'rovda o'quvchi id'si umuman yo'q.

const TG_SDK = "https://telegram.org/js/telegram-web-app.js";

interface TelegramWebApp {
  initData: string;
  colorScheme?: string;
  ready: () => void;
  expand: () => void;
}

function tgApp(): TelegramWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return w.Telegram?.WebApp ?? null;
}

/** "1 250 000" — ICU sozlamalariga bog'liq bo'lmagan guruhlash. */
function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return `${sign}${out}`;
}

/** "2026-09-03" -> "03.09.2026". */
function dmy(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso || "—";
}

function monthLabel(month: string, months: string[]): string {
  const [y, m] = (month || "").split("-");
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${months[i]} ${y}` : month;
}

const MARK_LABEL: Record<string, string> = {
  keldi: "Keldi",
  birinchi: "Birinchi dars",
  sababli: "Sababli",
  sababsiz: "Sababsiz",
};

const MARK_TONE: Record<string, string> = {
  keldi: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  birinchi: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sababli: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  sababsiz: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const TABS = [
  { key: "profil", label: "Profil" },
  { key: "guruh", label: "Guruh" },
  { key: "davomat", label: "Davomat" },
  { key: "tolovlar", label: "To'lovlar" },
  { key: "vazifa", label: "Vazifa" },
  { key: "imtihon", label: "Imtihonlar" },
  { key: "coin", label: "Coin" },
  { key: "manzil", label: "Manzil" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Kichik qurilmalar ──────────────────────────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      {title ? <h2 className="mb-3 text-[15px] font-bold">{title}</h2> : null}
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="break-words text-right text-[13px] font-semibold">{value}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card-dim px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[15px] font-extrabold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

// ── Asosiy komponent ───────────────────────────────────────────────

export default function StudentWebApp() {
  const { t, months } = useT();
  const [data, setData] = useState<StudentMe | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("profil");
  const [month, setMonth] = useState("");

  const load = useCallback(async (initData: string) => {
    try {
      const res = await fetch("/api/student-web/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const json = (await res.json()) as StudentMe | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : "Ma'lumot olinmadi");
        return;
      }
      setData(json);
      const ms = json.attendance.months;
      setMonth(ms.length > 0 ? ms[ms.length - 1] : "");
    } catch {
      setError(t("Aloqa uzildi — internetni tekshiring"));
    }
  }, [t]);

  useEffect(() => {
    // Telegram SDK sahifada bo'lmasligi mumkin (oddiy brauzerda ochilgan).
    // Shu bois u DINAMIK yuklanadi va topilmasa aniq xato beriladi — bo'sh
    // oq ekrandan ko'ra "botdan oching" degan gap tushunarli.
    const start = () => {
      const app = tgApp();
      if (!app || !app.initData) {
        setError(t("Bu sahifa Telegram boti orqali ochiladi"));
        return;
      }
      app.ready();
      app.expand();
      // Telegram mavzusiga moslashamiz — sahifa ilova ichida ochilgani
      // uchun yorug'/tungi rejim o'sha yerdagidek bo'lishi tabiiy.
      if (app.colorScheme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      void load(app.initData);
    };

    if (tgApp()) {
      start();
      return;
    }
    const s = document.createElement("script");
    s.src = TG_SDK;
    s.onload = start;
    s.onerror = () => setError(t("Telegram bilan aloqa o'rnatilmadi"));
    document.head.appendChild(s);
  }, [load, t]);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-5">
        <Card>
          <p className="text-center text-sm font-semibold">{error}</p>
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            {"Botga qayting va “Shaxsiy kabinet” tugmasini bosing."}
          </p>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-md p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-28 rounded-2xl bg-card" />
          <div className="h-12 rounded-2xl bg-card" />
          <div className="h-56 rounded-2xl bg-card" />
        </div>
      </main>
    );
  }

  const p = data.profile;
  const marks = month
    ? data.attendance.marks.filter((m) => m.date.startsWith(month))
    : data.attendance.marks;

  return (
    <main className="mx-auto w-full max-w-[1100px] p-3 sm:p-5">
      <header className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-white sm:size-16 sm:text-xl">
            {initials(p.fullName)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-extrabold sm:text-xl">{p.fullName}</h1>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {[p.role === "parent" ? t("Ota-ona sifatida") : t("O'quvchi"), p.branch]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.status !== "Aktiv" ? (
              <span className="mt-1.5 inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {t(p.status)}
              </span>
            ) : null}
          </div>
        </div>

        {/* "Balans" YO'Q: `pupils.balance` ni hech bir API yangilamaydi,
            ya'ni u har doim 0 chiqib "to'lovim yo'qolibdi" degan savol
            tug'dirardi. Qarzdorlik ham tizimda yuritilmaydi. */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Stat label={t("Jami to'lov")} value={`${fmtUZS(p.paid)} so'm`} />
          <Stat label={t("Coin")} value={fmtUZS(p.coin)} />
        </div>
      </header>

      {/* TO'LOV ESLATMASI — joriy oy uchun yozuv bo'lmasa.
          Summa YO'Q va "qarzdorsiz" DEYILMAYDI: tizimda kurs narxi ham,
          qarz qoldig'i ham yuritilmaydi (lib/studentBot/dues.ts). */}
      {data.due.unpaid ? (
        <div className="mt-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4">
          <p className="text-[14px] font-bold text-amber-700 dark:text-amber-400">
            {t("{month} oyi uchun to'lov hali qayd etilmagan", { month: monthLabel(data.due.month, months) })}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {"To'lovni o'quv markazida amalga oshirishingiz mumkin. Allaqachon to'lagan bo'lsangiz — kassada yozilgach eslatma yo'qoladi."}
          </p>
        </div>
      ) : null}

      {/* Tab paneli — mobilda gorizontal siljiydi, keng ekranda o'raladi. */}
      <nav className="mt-3 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2.5 sm:flex-wrap sm:overflow-visible">
        {TABS.map((tv) => (
          <button
            key={tv.key}
            type="button"
            onClick={() => setTab(tv.key)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-bold transition ${
              tab === tv.key
                ? "bg-primary text-white"
                : "bg-card-dim text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tv.label)}
          </button>
        ))}
      </nav>

      <div className="mt-3 space-y-3">
        {tab === "profil" && (
          <Card title={t("Shaxsiy ma'lumotlar")}>
            <Row label={t("F.I.O.")} value={p.fullName} />
            <Row label={t("Filial")} value={p.branch || "—"} />
            <Row label={t("Holat")} value={p.status} />
            {p.category ? <Row label={t("Kategoriya")} value={p.category} /> : null}
            {p.birthDate ? <Row label={t("Tug'ilgan sana")} value={p.birthDate} /> : null}
            <Row label={t("Telefon")} value={p.phone || "—"} />
            <Row label={t("Jami to'lov")} value={`${fmtUZS(p.paid)} so'm`} />
          </Card>
        )}

        {tab === "guruh" && (
          <>
            {data.nextLesson ? (
              <Card title={t("Keyingi dars")}>
                <p className="text-[13px]">
                  <b>{data.nextLesson.groupName}</b>
                  {` · ${dmy(data.nextLesson.iso)}`}
                  {data.nextLesson.time ? ` · ${data.nextLesson.time}` : ""}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {"Jadval bo'yicha. Bayram yoki ko'chirilgan dars bu hisobda ko'rinmaydi."}
                </p>
              </Card>
            ) : null}
            <Card title={t("Guruhlar")}>
              {data.groups.length === 0 ? (
                <Empty text="Guruhga qo'shilmagansiz." />
              ) : (
                <div className="space-y-3">
                  {data.groups.map((g) => (
                    <div key={g.id} className="rounded-xl border border-border bg-card-dim p-3.5">
                      <div className="font-bold">{g.name}</div>
                      <div className="mt-1.5 grid gap-1 text-[13px] text-muted-foreground sm:grid-cols-2">
                        {g.level ? <span>{`Bosqich: ${g.level}`}</span> : null}
                        {g.day ? <span>{`Kunlar: ${g.day}`}</span> : null}
                        {g.time ? <span>{`Vaqt: ${g.time}`}</span> : null}
                        {g.teacher ? <span>{t("O'qituvchi: {teacher}", { teacher: g.teacher })}</span> : null}
                        {g.room ? <span>{`Xona: ${g.room}`}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "davomat" && (
          <Card title={t("Davomat")}>
            {data.attendance.months.length > 1 ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {data.attendance.months.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonth(m)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                      month === m ? "bg-primary text-white" : "bg-card-dim text-muted-foreground"
                    }`}
                  >
                    {monthLabel(m, months)}
                  </button>
                ))}
              </div>
            ) : null}
            {marks.length === 0 ? (
              <Empty text="Bu oyda davomat belgilanmagan." />
            ) : (
              <div className="space-y-1.5">
                {marks.map((m, i) => (
                  <div
                    key={`${m.date}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-card-dim px-3 py-2"
                  >
                    <span className="text-[13px] font-semibold">{dmy(m.date)}</span>
                    <div className="flex items-center gap-2">
                      {typeof m.grade === "number" && m.grade > 0 ? (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-bold text-primary">
                          {m.grade}
                        </span>
                      ) : null}
                      <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${MARK_TONE[m.status] ?? ""}`}>
                        {MARK_LABEL[m.status] ?? m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "tolovlar" && (
          <Card title={t("To'lovlar tarixi")}>
            {data.payments.rows.length === 0 ? (
              <Empty text="To'lov yozuvi yo'q." />
            ) : (
              <>
                <div className="space-y-1.5">
                  {data.payments.rows.map((r, i) => (
                    <div
                      key={`${r.date}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-card-dim px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{dmy(r.date)}</div>
                        <div className="truncate text-[12px] text-muted-foreground">
                          {t(r.method)}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[13px] font-extrabold ${
                          r.cancelled ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {`${fmtUZS(r.amount)} so'm`}
                      </span>
                    </div>
                  ))}
                </div>
                {data.payments.totalCount > data.payments.rows.length ? (
                  <p className="mt-3 text-center text-[12px] text-muted-foreground">
                    {t("Jami {totalCount} ta yozuv, oxirgi {rows} tasi ko'rsatildi.", { totalCount: data.payments.totalCount, rows: data.payments.rows.length })}
                  </p>
                ) : null}
              </>
            )}
          </Card>
        )}

        {tab === "vazifa" && (
          <Card title={t("Topshiriqlar")}>
            {data.tasks.length === 0 ? (
              <Empty text="Hozircha topshiriq yo'q." />
            ) : (
              <div className="space-y-3">
                {data.tasks.map((tv) => (
                  <div key={tv.id} className="rounded-xl border border-border bg-card-dim p-3.5">
                    <div className="font-bold">{tv.name}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                      {tv.type ? <span>{t(tv.type)}</span> : null}
                      {tv.deadline ? <span>{`Muddat: ${tv.deadline}`}</span> : null}
                      {tv.maxScore ? <span>{t("Maks. ball: {maxScore}", { maxScore: tv.maxScore })}</span> : null}
                      {tv.groupName ? <span>{tv.groupName}</span> : null}
                    </div>
                    {tv.note ? <p className="mt-1.5 text-[13px]">{tv.note}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "imtihon" && (
          <>
            <Card title={t("Oylik imtihonlar")}>
              {data.exams.monthly.length === 0 ? (
                <Empty text="Natija yo'q." />
              ) : (
                <div className="space-y-1.5">
                  {data.exams.monthly.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-card-dim px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{e.subject}</div>
                        <div className="text-[12px] text-muted-foreground">{monthLabel(e.month, months)}</div>
                      </div>
                      <span className="shrink-0 text-[13px] font-extrabold">{`${e.correct}/${e.total}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title={t("UZBMB")}>
              {data.exams.uzbmb.length === 0 ? (
                <Empty text="Natija yo'q." />
              ) : (
                <div className="space-y-1.5">
                  {data.exams.uzbmb.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-card-dim px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{monthLabel(e.month, months)}</div>
                        <div className="truncate text-[12px] text-muted-foreground">
                          {[
                            e.b1s ? `${e.b1s} ${e.b1}` : "",
                            e.b2s ? `${e.b2s} ${e.b2}` : "",
                            `majburiy ${e.maj}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] font-extrabold">{e.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "coin" && (
          <Card title={t("Coin")}>
            <div className="py-4 text-center">
              <div className="text-4xl font-extrabold text-primary">{fmtUZS(p.coin)}</div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {"Koinlar faollik va yutuqlar uchun beriladi. Sarflash tartibi haqida ustozingizdan so'rang."}
              </p>
            </div>
          </Card>
        )}

        {tab === "manzil" && (
          <Card title={t("Manzillar")}>
            {data.addresses.length === 0 ? (
              <Empty text="Manzil kiritilmagan." />
            ) : (
              <div className="space-y-1.5">
                {data.addresses.map((a) => (
                  <div key={a.id} className="rounded-lg bg-card-dim px-3 py-2">
                    <div className="text-[13px] font-semibold">{a.name}</div>
                    {a.type ? <div className="text-[12px] text-muted-foreground">{t(a.type)}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <p className="mt-4 pb-4 text-center text-[11px] text-muted-foreground">
        {"Ma'lumotlar faqat ko'rish uchun. O'zgartirish kerak bo'lsa o'quv markaziga murojaat qiling."}
      </p>
    </main>
  );
}
