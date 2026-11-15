"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Check, CircleAlert, Clock, Contrast, Info, MapPin, Minus, Phone, ReceiptText } from "lucide-react";
import { useT } from "@/components/shared/Language";
import type { CabinetMonthCell, CabinetPayment, StudentCabinet } from "@/lib/studentCabinetTypes";
import { Empty, FanDot, Pill, fmtSom, useCabinetFmt, type CabinetTabProps } from "./bits";
import ReceiptDialogV2 from "./ReceiptDialogV2";

// O'QUVCHI KABINETI (v2) — «TO'LOVLAR» TABI (28-qism, rasmlar 57–58).
//
// Raqamlar serverda hisoblanadi (lib/studentCabinet.ts) va xodimlardagi
// «Qarzdorlar» hisobi bilan bir xil — bu yerda faqat ko'rsatiladi:
//   • 3 ko'rsatkich: Qarz (yoki oldindan to'langan), Keyingi oy, Jami to'langan;
//   • to'lov joyi — o'quvchi filiali (manzil, telefon);
//   • «Oylar bo'yicha» — guruh × oy katakchalari (to'langan / qisman / qarz / kelgusi);
//   • «To'lov tarixi» — har to'lovning cheki (ReceiptDialogV2).
// Dizayndagi «muddat N-sanagacha» va to'lov tarixidagi «Guruh» ustuni YO'Q:
// tizimda to'lov muddati ham, to'lovning guruhi ham yozilmaydi (SAVOLLAR).

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

/** To'lov turining rangli nuqtasi (Naqd — yashil, Plastik — binafsha, …). */
function typeDot(type: string): string {
  const s = type.toLowerCase();
  if (s.includes("naqd")) return "bg-v2-success";
  if (s.includes("plastik") || s.includes("karta")) return "bg-v2-violet";
  if (s.includes("terminal")) return "bg-v2-info";
  if (s.includes("click") || s.includes("payme") || s.includes("uzum") || s.includes("o'tkazma")) return "bg-v2-brand";
  return "bg-v2-text-3";
}

/** Telefon havolasi: 9 raqam bo'lsa +998 qo'shiladi. */
function telHref(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return null;
  return `tel:+${d.length === 9 ? `998${d}` : d}`;
}

/** Jadval/kartochka paneli (Card'dan farqi — ichki chekinishsiz, jadval chetma-chet). */
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm ${className}`}>{children}</section>;
}

const CHIP: Record<"danger" | "warning" | "outline", string> = {
  danger: "bg-v2-danger-bg text-v2-danger",
  warning: "bg-v2-warning-bg text-v2-warning",
  outline: "border border-v2-border-strong bg-v2-surface text-v2-text-2",
};

function Chip({ tone, icon: I, children }: { tone: keyof typeof CHIP; icon: Icon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-v2-full px-2 py-0.5 text-v2-small font-semibold tabular-nums ${CHIP[tone]}`}>
      <I className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

function MonthCell({ c }: { c: CabinetMonthCell }) {
  const { t } = useT();
  const sub = (s: string) => <div className="mt-1 whitespace-nowrap text-v2-caption font-normal text-v2-text-3">{s}</div>;
  switch (c.state) {
    case "paid":
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-v2-small tabular-nums text-v2-text-2">
          <Check className="size-3.5 shrink-0 text-v2-success" strokeWidth={2.25} aria-hidden />
          {fmtSom(c.covered || c.charge)}
        </span>
      );
    case "debt":
      return (
        <div>
          <Chip tone="danger" icon={CircleAlert}>
            {fmtSom(c.remaining)}
          </Chip>
          {sub(t("qarz"))}
        </div>
      );
    case "partial":
      return (
        <div>
          <Chip tone="warning" icon={Contrast}>
            {fmtSom(c.remaining)}
          </Chip>
          {sub(t("qoldi · {sum} dan", { sum: fmtSom(c.charge) }))}
        </div>
      );
    case "future":
      if (c.expected <= 0) return <span className="text-v2-text-3">—</span>;
      return (
        <div>
          <Chip tone="outline" icon={Clock}>
            {fmtSom(c.expected)}
          </Chip>
          {sub(t("kelgusi oy"))}
        </div>
      );
    default:
      return <span className="text-v2-text-3">—</span>;
  }
}

function LegendItem({ icon: I, cls, label }: { icon: Icon; cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-flex size-[18px] items-center justify-center rounded-v2-full ${cls}`}>
        <I className="size-3" strokeWidth={2.25} aria-hidden />
      </span>
      {label}
    </span>
  );
}

/** «470 000 so'm» */
function useSom() {
  const { t } = useT();
  return (n: number) => `${fmtSom(n)} ${t("so'm")}`;
}

/** «iyundan beri» (en: «since June»). */
function useSince() {
  const { t, lang } = useT();
  const f = useCabinetFmt();
  return (ym: string) => t("{m}dan beri", { m: lang === "en" ? f.monthName(ym) : f.monthLower(ym) });
}

// ── Ko'rsatkichlar ───────────────────────────────────────────────────────────

function Stat({ label, icon, value, valueCls = "text-v2-text", sub }: { label: ReactNode; icon?: ReactNode; value: ReactNode; valueCls?: string; sub: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:p-5">
      <div className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-v2-page ${valueCls}`}>{value}</div>
      <div className="mt-1 text-v2-caption font-normal text-v2-text-3">{sub}</div>
    </div>
  );
}

function Stats({ cab }: { cab: StudentCabinet }) {
  const { t } = useT();
  const f = useCabinetFmt();
  const som = useSom();
  const since = useSince();
  const { debt, nextMonth, paid, months } = cab;

  let debtStat: ReactNode;
  if (debt.total > 0) {
    const oldest = debt.parts.map((p) => p.since).filter((s): s is string => !!s).sort()[0] ?? null;
    const when = oldest && oldest < months.current ? since(oldest) : f.monthLower(months.current);
    const n = debt.parts.length;
    debtStat = (
      <Stat
        label={t("Qarz")}
        icon={<CircleAlert className="size-3.5 text-v2-danger" strokeWidth={2} aria-hidden />}
        value={som(debt.total)}
        valueCls="text-v2-danger"
        sub={n > 0 ? `${when} · ${t("{n} guruh bo'yicha", { n })}` : when}
      />
    );
  } else if (debt.advance > 0) {
    debtStat = (
      <Stat
        label={t("Oldindan to'langan")}
        icon={<Check className="size-3.5 text-v2-success" strokeWidth={2.25} aria-hidden />}
        value={som(debt.advance)}
        valueCls="text-v2-success"
        sub={t("Qarz yo'q · keyingi darslar hisobiga")}
      />
    );
  } else {
    debtStat = (
      <Stat
        label={t("Qarz")}
        icon={<Check className="size-3.5 text-v2-success" strokeWidth={2.25} aria-hidden />}
        value={som(0)}
        sub={t("Qarz yo'q")}
      />
    );
  }

  return (
    <Panel className="grid grid-cols-1 divide-y divide-v2-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {debtStat}
      <Stat
        label={`${t("Keyingi oy")} · ${f.monthLower(nextMonth.month)}`}
        value={nextMonth.groups > 0 ? som(nextMonth.expected) : "—"}
        sub={nextMonth.groups > 0 ? t("{n} guruh · to'liq oy darslari", { n: nextMonth.groups }) : t("Faol guruh yo'q")}
      />
      <Stat
        label={t("Jami to'langan")}
        value={som(paid.total)}
        sub={paid.since && paid.count > 0 ? `${since(paid.since.slice(0, 7))} · ${t("{n} ta to'lov", { n: paid.count })}` : t("Hali to'lov yo'q")}
      />
    </Panel>
  );
}

// ── To'lov joyi ──────────────────────────────────────────────────────────────

function PlaceBar({ cab }: { cab: StudentCabinet }) {
  const { t } = useT();
  const { name, address, phone } = cab.branch;
  if (!name && !address) return null;
  const place = [name, address].filter((x) => x && x.trim()).join(", ");
  const tel = phone ? telHref(phone) : null;
  return (
    <section className="flex flex-col gap-2 rounded-v2-lg border border-v2-border bg-v2-surface px-4 py-3 shadow-v2-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex min-w-0 items-start gap-2 text-v2-small text-v2-text-2">
        <MapPin className="mt-px size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <span>
          {t("To'lov filial kassasida qilinadi:")} <span className="font-semibold text-v2-text">{place}</span>
        </span>
      </p>
      {phone ? (
        tel ? (
          <a
            href={tel}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-v2-sm text-v2-body font-semibold tabular-nums text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus sm:self-auto"
          >
            <Phone className="size-4" strokeWidth={1.75} aria-hidden />
            {phone}
          </a>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-v2-body font-semibold tabular-nums text-v2-text">
            <Phone className="size-4" strokeWidth={1.75} aria-hidden />
            {phone}
          </span>
        )
      ) : null}
    </section>
  );
}

// ── Oylar bo'yicha ───────────────────────────────────────────────────────────

function MonthsMatrix({ cab }: { cab: StudentCabinet }) {
  const { t } = useT();
  const f = useCabinetFmt();
  const som = useSom();
  const { list, current, rows, remainingByMonth, olderRemaining } = cab.months;
  const thisYear = cab.today.slice(0, 4);
  const curCls = (m: string) => (m === current ? "bg-v2-surface-2" : "");
  // `-1px` — kasr pikselli ekranlarda aylangan katakchalar yopishqoq ustun chetidan
  // yarim piksel bo'lib ko'rinib qolmasin (chegaraga yopishib turadi).
  const stickyCls = "sticky -left-px z-[1] bg-v2-surface";
  // Telefonda jadval gorizontal aylanadi: ochilganda JORIY oy ko'rinsin (o'tgan
  // oylar chapda qoladi) — birinchi ustun yopishqoq, shuning uchun uning eni ayriladi.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || box.scrollWidth <= box.clientWidth) return;
    const cur = box.querySelector<HTMLElement>("th[data-current]");
    const first = box.querySelector<HTMLElement>("th");
    if (!cur || !first) return;
    box.scrollLeft = Math.max(0, cur.offsetLeft - first.offsetWidth - 8);
  }, [current, list.length]);

  return (
    <Panel>
      <div className="px-4 pb-3 pt-4 sm:px-5">
        <h2 className="text-v2-body font-semibold text-v2-text">{t("Oylar bo'yicha")}</h2>
        <p className="mt-0.5 text-v2-caption font-normal text-v2-text-3">{t("To'lov qaysi oy uchun qilingan bo'lsa, o'sha oyga yoziladi")}</p>
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-v2-border">
          <Empty>{t("Hozircha guruhga a'zo emassiz — oylik hisob yo'q.")}</Empty>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="overflow-x-auto border-t border-v2-border">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="whitespace-nowrap text-v2-caption text-v2-text-3 *:border-b *:border-v2-border">
                  <th scope="col" className={`${stickyCls} w-[30%] min-w-[176px] px-4 py-2.5 font-medium sm:px-5`}>
                    {t("Guruh")}
                  </th>
                  {list.map((m) => (
                    <th key={m} scope="col" data-current={m === current ? "" : undefined} className={`px-3 py-2.5 font-medium ${curCls(m)}`}>
                      <span className={`inline-flex items-center gap-1.5 ${m === current ? "font-semibold text-v2-text" : ""}`}>
                        {f.monthName(m)}
                        {m.slice(0, 4) !== thisYear ? <span className="font-normal text-v2-text-3">{m.slice(0, 4)}</span> : null}
                        {m === current ? <Pill tone="brand">{t("joriy")}</Pill> : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.groupId} className="align-top *:border-b *:border-v2-border">
                    <th scope="row" className={`${stickyCls} px-4 py-3 font-normal sm:px-5`}>
                      <div className="flex items-center gap-2">
                        <FanDot course={r.course} />
                        <span className="text-v2-small font-semibold text-v2-text">{r.title}</span>
                      </div>
                      <div className="mt-0.5 whitespace-nowrap pl-4 text-v2-caption font-normal text-v2-text-3">
                        {r.monthlyPrice != null ? t("{sum} so'm / oy", { sum: fmtSom(r.monthlyPrice) }) : t("Narxi belgilanmagan")}
                      </div>
                    </th>
                    {r.cells.map((c, i) => (
                      <td key={c.month || list[i]} className={`px-3 py-3 ${curCls(c.month || list[i])}`}>
                        <MonthCell c={c} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className={`${stickyCls} px-4 py-3 text-v2-small font-semibold text-v2-text sm:px-5`}>
                    {t("Oy bo'yicha qarz, so'm")}
                  </th>
                  {list.map((m, i) => {
                    const v = remainingByMonth[i] ?? 0;
                    const future = m > current;
                    return (
                      <td key={m} className={`px-3 py-3 text-v2-small tabular-nums ${curCls(m)} ${!future && v > 0 ? "font-semibold text-v2-danger" : "text-v2-text-2"}`}>
                        {future ? "—" : fmtSom(v)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          {olderRemaining > 0 ? (
            <p className="flex items-center gap-1.5 border-t border-v2-border px-4 py-2.5 text-v2-small text-v2-text-2 sm:px-5">
              <CircleAlert className="size-4 shrink-0 text-v2-danger" strokeWidth={1.75} aria-hidden />
              {t("Jadvaldagi oylardan oldingi qarz:")} <span className="font-semibold tabular-nums text-v2-danger">{som(olderRemaining)}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-v2-border px-4 py-3 text-v2-caption font-normal text-v2-text-2 sm:px-5">
            <LegendItem icon={Check} cls="bg-v2-success-bg text-v2-success" label={t("To'langan")} />
            <LegendItem icon={Contrast} cls="bg-v2-warning-bg text-v2-warning" label={t("Qisman")} />
            <LegendItem icon={CircleAlert} cls="bg-v2-danger-bg text-v2-danger" label={t("Qarz")} />
            <LegendItem icon={Clock} cls="border border-v2-border-strong text-v2-text-3" label={t("Kelgusi oy")} />
            <LegendItem icon={Minus} cls="text-v2-text-3" label={t("Guruhda emas")} />
          </div>
        </>
      )}
    </Panel>
  );
}

// ── To'lov tarixi ────────────────────────────────────────────────────────────

function ReceiptButton({ p, onOpen }: { p: CabinetPayment; onOpen: (p: CabinetPayment) => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => onOpen(p)}
      aria-label={t("Chek #{id}", { id: p.id })}
      title={t("Chekni ko'rish")}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
    >
      <ReceiptText className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

function TypeCell({ type }: { type: string }) {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${typeDot(type)}`} />
      {t(type) || "—"}
    </span>
  );
}

function PaymentFlags({ p }: { p: CabinetPayment }) {
  const { t } = useT();
  if (p.cancelled) return <Pill tone="neutral">{t("Bekor qilingan")}</Pill>;
  if (p.refund) return <Pill tone="warning">{t("Qaytarildi")}</Pill>;
  return null;
}

function amountCls(p: CabinetPayment): string {
  if (p.cancelled) return "text-v2-text-3 line-through";
  if (p.refund || p.amount < 0) return "text-v2-warning";
  return "text-v2-text";
}

function History({ cab, studentName }: { cab: StudentCabinet; studentName: string }) {
  const { t } = useT();
  const f = useCabinetFmt();
  const since = useSince();
  const [open, setOpen] = useState<CabinetPayment | null>(null);
  const { payments, paymentsTotal, paid } = cab;
  const thisYear = cab.today.slice(0, 4);
  const monthOf = (ym: string) => (ym.slice(0, 4) !== thisYear ? `${f.monthName(ym)} ${ym.slice(0, 4)}` : f.monthName(ym));
  const more = Math.max(0, paymentsTotal - payments.length);
  const totalNote = paid.since && paid.count > 0 ? `${since(paid.since.slice(0, 7))} · ${t("{n} ta to'lov", { n: paid.count })}` : "";
  const discountNote = (p: CabinetPayment) =>
    p.discount > 0 ? <div className="mt-0.5 text-v2-caption font-normal text-v2-text-3">{t("+ {sum} chegirma (tanga)", { sum: fmtSom(p.discount) })}</div> : null;

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-5">
        <h2 className="text-v2-body font-semibold text-v2-text">
          {t("To'lov tarixi")} <span className="ml-1 font-normal text-v2-text-3">{t("{n} ta", { n: paymentsTotal })}</span>
        </h2>
        {payments.length > 0 ? (
          <p className="hidden text-v2-caption font-normal text-v2-text-3 sm:block">{t("Chekni ko'rish va yuklab olish — birinchi ustundagi tugma")}</p>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <div className="border-t border-v2-border">
          <Empty>{t("Hali to'lov yo'q")}</Empty>
        </div>
      ) : (
        <>
          {/* Kompyuter / planshet — jadval */}
          <div className="hidden overflow-x-auto border-t border-v2-border sm:block">
            <table className="w-full min-w-[680px] border-collapse text-left text-v2-small">
              <thead>
                <tr className="whitespace-nowrap bg-v2-surface-2 text-v2-caption text-v2-text-3">
                  <th scope="col" className="w-14 px-4 py-2.5 font-medium sm:pl-5">
                    {t("Chek")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    {t("Sana")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    {t("Summa, so'm")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    {t("To'lov turi")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    {t("Qaysi oy uchun")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium sm:pr-5">
                    {t("Kassa")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={`border-t border-v2-border ${p.cancelled ? "text-v2-text-3" : "text-v2-text"}`}>
                    <td className="px-4 py-2 sm:pl-5">
                      <ReceiptButton p={p} onOpen={setOpen} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span>
                          <span className="font-medium">{f.dayMonth(p.date)}</span>
                          {p.time ? <span className="text-v2-text-3"> | {p.time}</span> : null}
                          {p.date.slice(0, 4) !== thisYear ? <span className="text-v2-text-3"> · {p.date.slice(0, 4)}</span> : null}
                        </span>
                        <PaymentFlags p={p} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <span className={`font-semibold tabular-nums ${amountCls(p)}`}>{fmtSom(p.amount)}</span>
                      {discountNote(p)}
                    </td>
                    <td className="px-3 py-2">
                      <TypeCell type={p.paymentType} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{monthOf(p.periodMonth)}</td>
                    <td className="px-3 py-2 text-v2-text-2 sm:pr-5">{p.cashbox || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-v2-border bg-v2-surface-2">
                  <td colSpan={2} className="px-4 py-2.5 font-semibold text-v2-text sm:pl-5">
                    {t("Jami")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{fmtSom(paid.total)}</td>
                  <td colSpan={3} className="px-3 py-2.5 text-v2-caption font-normal text-v2-text-3 sm:pr-5">
                    {totalNote}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Telefon — kartochkalar ro'yxati */}
          <ul className="divide-y divide-v2-border border-t border-v2-border sm:hidden">
            {payments.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <ReceiptButton p={p} onOpen={setOpen} />
                <div className="min-w-0 flex-1">
                  <div className={`text-v2-body ${p.cancelled ? "text-v2-text-3" : "text-v2-text"}`}>
                    <span className="font-medium">{f.dayMonth(p.date)}</span>
                    {p.time ? <span className="text-v2-text-3"> | {p.time}</span> : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-v2-caption font-normal text-v2-text-2">
                    <TypeCell type={p.paymentType} />
                    <span className="text-v2-text-3">·</span>
                    <span>{t("{m} uchun", { m: monthOf(p.periodMonth) })}</span>
                  </div>
                  {p.cashbox ? <div className="mt-0.5 truncate text-v2-caption font-normal text-v2-text-3">{p.cashbox}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-v2-body font-semibold tabular-nums ${amountCls(p)}`}>{fmtSom(p.amount)}</div>
                  {discountNote(p)}
                  <div className="mt-1 empty:hidden">
                    <PaymentFlags p={p} />
                  </div>
                </div>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 bg-v2-surface-2 px-4 py-3">
              <div>
                <div className="text-v2-body font-semibold text-v2-text">{t("Jami")}</div>
                {totalNote ? <div className="text-v2-caption font-normal text-v2-text-3">{totalNote}</div> : null}
              </div>
              <div className="text-v2-body font-semibold tabular-nums text-v2-text">{fmtSom(paid.total)}</div>
            </li>
          </ul>

          {more > 0 ? (
            <p className="flex items-center gap-1.5 border-t border-v2-border px-4 py-2.5 text-v2-caption font-normal text-v2-text-3 sm:px-5">
              <Info className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Yana {n} ta eski to'lov ko'rsatilmagan — to'liq ro'yxat markaz kassasida.", { n: more })}
            </p>
          ) : null}
        </>
      )}

      {open ? <ReceiptDialogV2 payment={open} cab={cab} studentName={studentName} onClose={() => setOpen(null)} /> : null}
    </Panel>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function TolovlarTab({ me, cab }: CabinetTabProps) {
  const { t } = useT();
  const som = useSom();
  const name = me.profile.fullName;
  const charged = cab.groups.filter((g) => g.status !== "gathering");
  const monthly = charged.reduce((s, g) => s + (g.monthlyPrice ?? 0), 0);
  const noPrice = charged.filter((g) => g.monthlyPrice == null).length;

  const subParts = [name];
  if (cab.groups.length === 0) subParts.push(t("guruhga a'zo emas"));
  else {
    subParts.push(t("{n} guruh", { n: cab.groups.length }));
    if (monthly > 0) subParts.push(t("oylik to'lov {sum}", { sum: som(monthly) }));
    if (noPrice > 0) subParts.push(t("{n} guruhda narx belgilanmagan", { n: noPrice }));
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-v2-page text-v2-text">{t("To'lovlar")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{subParts.filter(Boolean).join(" · ")}</p>
      </header>

      <Stats cab={cab} />

      {cab.debt.incomplete ? (
        <p className="flex items-start gap-2 rounded-v2-lg border border-v2-border bg-v2-warning-bg px-4 py-2.5 text-v2-small text-v2-warning">
          <Info className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Hisob to'liq emas: ba'zi guruhlarda narx yoki dars jadvali kiritilmagan. Aniq summani markaz kassasidan so'rang.")}
        </p>
      ) : null}

      <PlaceBar cab={cab} />
      <MonthsMatrix cab={cab} />
      <History cab={cab} studentName={name} />
    </div>
  );
}
