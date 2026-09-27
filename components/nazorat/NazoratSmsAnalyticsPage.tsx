"use client";

import { useEffect, useMemo, useState } from "react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import { smsPurposeLabel, type SmsMessage } from "@/lib/smsMessages";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// Nazorat → SMS analitikasi (/nazorat-sms-analytics).
//
// Manba: /api/sms-analytics (MongoDB `sms_messages`). Jurnalga
// lib/smsLog.ts yozadi — to'lov SMS i, xodim taklifi va parol tiklash,
// ya'ni tizimdan ketadigan HAMMA SMS.
//
// /sales-messages ("Xabarlar ro'yhati") bilan CHEGARA: u yerda yassi
// jurnal (kimga, qanday matn, qachon), bu yerda esa KESIMLAR —
// holat, maqsad, kassa va yetkazilmaganlar.

type Row = SmsMessage & { simulated?: boolean };

interface Payload {
  messages: Row[];
  total: number;
  truncated: boolean;
  stats: { accepted: number; failed: number; pending: number; simulated: number };
  byPurpose: { key: string | null; n: number }[];
  byCashbox: { name: string | null; n: number }[];
  config: { eskizConfigured: boolean; paymentSmsEnabled: boolean; paymentSmsVarSet: boolean };
}

function toIso(d: Date | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function StatCard({ label, value, hint, color }: { label: string; value: number | string; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums ${color || ""}`}>{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  );
}

export default function NazoratSmsAnalyticsPage() {
  const { t } = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");

  // Yuklanish holati HOSILA, alohida state emas: `applied` — natijasi
  // allaqachon kelgan filtr kaliti. Mos kelmasa, demak so'rov ketyapti.
  //
  // NEGA SHUNDAY: `setLoading(true)` ni effekt TANASIDA chaqirish
  // react-hooks/set-state-in-effect qoidasini buzadi (ketma-ket
  // renderlarga olib keladi). Hosila qiymatda bunday muammo yo'q.
  const [applied, setApplied] = useState<string | null>(null);
  const filterKey = `${toIso(dateRange.start)}|${toIso(dateRange.end)}`;
  const loading = applied !== filterKey;

  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams();
    if (dateRange.start) sp.set("from", toIso(dateRange.start));
    if (dateRange.end) sp.set("to", toIso(dateRange.end));
    // Manzil ALOHIDA o'zgaruvchida, oddiy satr sifatida — ATAYLAB.
    // scripts/gen-api-permissions.mjs sahifalardagi "/api/..." satrlarini
    // regex bilan qidiradi va `${...}` aralashgan shablon satrini
    // TANIMAYDI. O'shanda route hech qaysi sahifaga bog'lanmay,
    // "faqat sessiya kerak" ro'yxatiga tushib qolardi — ya'ni SMS
    // jurnalini tizimga kirgan HAR QANDAY xodim o'qiy olardi.
    const base = "/api/sms-analytics";
    const qs = sp.toString();
    const key = filterKey;
    fetch(qs ? `${base}?${qs}` : base)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setData(d as Payload); })
      .finally(() => { if (!cancelled) setApplied(key); });
    return () => { cancelled = true; };
    // `filterKey` — sana oralig'ining barqaror satr ko'rinishi; `dateRange`
    // obyekti har renderda yangi bo'lishi mumkin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Holat va maqsad filtrlari KLIENTDA — serverdan kelgan 500 qator
  // ustida ishlaydi, ya'ni qo'shimcha so'rov ketmaydi.
  const rows = useMemo(() => {
    let list = data?.messages ?? [];
    if (status) list = list.filter((m) => m.status === status);
    if (purpose) list = list.filter((m) => (m.purpose ?? "") === purpose);
    return list;
  }, [data, status, purpose]);

  const s = data?.stats;

  return (
    <div className="container mx-auto max-w-[1700px] p-4 md:p-5 space-y-4">
      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("Jami yuborilgan")} value={data?.total ?? 0} />
        <StatCard
          label={t("Eskiz qabul qildi")}
          value={s?.accepted ?? 0}
          color="text-emerald-600"
          hint={t("telefonga yetgani ALOHIDA masala")}
        />
        <StatCard label={t("Yuborilmadi")} value={s?.failed ?? 0} color="text-rose-600" hint={t("Eskiz rad etdi")} />
        <StatCard
          label={t("Simulyatsiya")}
          value={s?.simulated ?? 0}
          color="text-amber-600"
          hint={t("Eskiz sozlanmagan — SMS ketmagan")}
        />
      </div>

      {/* SOZLAMALAR HOLATI — sahifa bo'sh yoki hamma qator "Yuborilmadi"
          bo'lganda sababni SHU YERDA ko'rsatadi. Ilgari buni bilish uchun
          Vercel sozlamalarini ochib ko'rish kerak edi. */}
      {data && (
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
              data.config.paymentSmsEnabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {t("To'lov SMS i:")}{" "}<strong>{data.config.paymentSmsEnabled ? "yoqilgan" : "o'chiq"}</strong>
            {/* "O'chiq" ning IKKI xil sababi bor va ular boshqa-boshqa ish
                talab qiladi — sahifa qaysi biri ekanini aytadi. */}
            {!data.config.paymentSmsEnabled && (
              <span>
                {data.config.paymentSmsVarSet
                  ? t("(PAYMENT_SMS_ENABLED qiymati rost emas)")
                  : t("(PAYMENT_SMS_ENABLED Production'da yo'q)")}
              </span>
            )}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
              data.config.eskizConfigured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {t("Eskiz:")}{" "}<strong>{data.config.eskizConfigured ? "sozlangan" : "SOZLANMAGAN"}</strong>
            {!data.config.eskizConfigured && <span>(ESKIZ_EMAIL / ESKIZ_PASSWORD)</span>}
          </span>
        </div>
      )}

      {/* Eskiz sozlanmagan bo'lsa SMS UMUMAN ketmaydi — bu jimgina
          o'tib ketmasin. */}
      {data && !data.config.eskizConfigured && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px]">
          <strong>{t("Eskiz sozlanmagan.")}</strong> `ESKIZ_EMAIL` va `ESKIZ_PASSWORD` muhit
          o&apos;zgaruvchilari yo&apos;q, ya&apos;ni SMS <strong>{t("hech qayerga ketmayapti")}</strong>{" "}{t("— jurnaldagi qatorlar &laquo;simulyatsiya&raquo; bo'ladi. Ularni Vercel → Settings → Environment Variables ga qo'shing va qayta deploy qiling.")}
        </div>
      )}

      {/* HALOL OGOHLANTIRISH — bu ustunlar chalg'itmasligi uchun.
          "Qabul qilindi" = Eskiz so'rovni oldi, telefonga yetib borgani
          EMAS. Haqiqiy yetkazilishni bilish uchun Eskizdan alohida
          so'rash kerak va u hali qo'shilmagan. */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px]">
        <strong>{t("Diqqat:")}</strong> &laquo;Eskiz qabul qildi&raquo; degani xabar operatorga
        topshirildi — <strong>{t("telefonga yetib borgani emas")}</strong>. Haqiqiy yetkazilish
        holatini Eskizdan alohida so&apos;rash kerak, u hali ulanmagan. Shu sababli quyidagi
        jadvalda &laquo;Yetkazildi&raquo; ustuni yo&apos;q — bo&apos;lmagan ma&apos;lumotni
        ko&apos;rsatgandan ko&apos;ra yo&apos;qligini aytish to&apos;g&apos;ri.
      </div>

      {/* Filtrlar */}
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder={t("Sana oralig'i")} />
        <Select value={status} onChange={(v) => setStatus(v)} options={[{ value: "Qabul qilindi", label: t("Eskiz qabul qildi") }, { value: "Yuborilmadi", label: t("Yuborilmadi") }, { value: "Kutilmoqda", label: t("Kutilmoqda") }]} placeholder={t("Barcha holatlar")} clearable />
        <Select value={purpose} onChange={(v) => setPurpose(v)} options={[{ value: "payment", label: t("To'lov qabul qilindi") }, { value: "invite", label: t("Xodim taklifi") }, { value: "password-reset", label: t("Parol tiklash") }, { value: "manual", label: t("Qo'lda yuborilgan") }]} placeholder={t("Barcha maqsadlar")} clearable />
      </div>

      {/* Kesimlar */}
      {(data?.byCashbox?.length ?? 0) > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="text-[13px] font-semibold mb-2">{t("Kassa bo'yicha")}</div>
          <div className="flex flex-wrap gap-2">
            {data!.byCashbox.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-[12px]">
                {c.name || "Kassasiz"} <strong className="tabular-nums">{c.n}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Ko'rsatilmoqda:")}</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="table-box">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-4 py-3 text-left">{t("Sana")}</th>
                <th className="px-4 py-3 text-left">{t("Kimga")}</th>
                <th className="px-4 py-3 text-left">{t("Telefon")}</th>
                <th className="px-4 py-3 text-left">{t("Maqsad")}</th>
                <th className="px-4 py-3 text-left">{t("Kassa")}</th>
                <th className="px-4 py-3 text-left">{t("Holati")}</th>
                <th className="px-4 py-3 text-left">{t("Matn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((m, i) => (
                <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 tabular-nums text-[13px] whitespace-nowrap">{m.date} | {m.time}</td>
                  <td className="px-4 py-3 font-medium">{m.recipientName || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-[13px]">{m.phone ? `+${m.phone}` : "—"}</td>
                  <td className="px-4 py-3 text-[13px]">{smsPurposeLabel(m.purpose)}</td>
                  <td className="px-4 py-3 text-[13px]">{m.cashboxName || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium ${
                        m.status === "Qabul qilindi"
                          ? "bg-emerald-100 text-emerald-700"
                          : m.status === "Yuborilmadi"
                            ? "bg-rose-100 text-rose-600"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t(m.status)}
                    </span>
                    {m.simulated && (
                      <span className="ml-1 text-[11px] text-amber-600">{t("simulyatsiya")}</span>
                    )}
                    {/* NEGA yuborilmagani. Eng ko'p uchraydigan sabab —
                        Eskizda shablon hali tasdiqlanmagani yoki matn
                        tasdiqlangandan farq qilishi. Sababsiz uni topib
                        bo'lmasdi. */}
                    {m.providerError && (
                      <div
                        className="mt-1 text-[11px] text-rose-600 max-w-[220px] truncate"
                        title={m.providerError}
                      >
                        {m.providerError}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground max-w-[360px] truncate" title={m.text}>
                    {m.text || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
              <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
            </div>
            <h3 className="text-[15px] font-semibold mb-1">
              {loading ? <Spinner size={22} /> : "Hali SMS yuborilmagan"}
            </h3>
            {!loading && (
              <p className="text-[13px] text-muted-foreground max-w-md">
                {t("Jurnal bo'sh. To'lov SMS i")}{" "}<strong>PAYMENT_SMS_ENABLED=true</strong> bo&apos;lganda
                ishlaydi — o&apos;chiq bo&apos;lsa kassadagi kirimlarda xabar yuborilmaydi.
                {data && !data.config.paymentSmsEnabled && !data.config.paymentSmsVarSet && (
                  <>{" "}{t("Hozir bu o'zgaruvchi Production muhitida umuman yo'q: Vercel → Settings → Environment Variables da")}{" "}<strong>{t("Production")}</strong>{" "}{t("belgilangan bo'lishi va keyin qayta deploy qilinishi kerak.")}</>
                )}
              </p>
            )}
          </div>
        )}

        {data?.truncated && (
          <div className="border-t border-border px-5 py-2 text-[12px] text-muted-foreground">
            Oxirgi {data.messages.length} ta yozuv ko&apos;rsatilmoqda ({data.total} tadan) — sana
            oralig&apos;ini torroq tanlang.
          </div>
        )}
      </div>
    </div>
  );
}
