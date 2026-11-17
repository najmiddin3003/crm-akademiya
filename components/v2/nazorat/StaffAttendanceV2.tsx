"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, MapPin, ScanFace, Send } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import type { StaffDayPayload, StaffDayRow } from "@/lib/staffAttendanceToday";

// YANGI VERSIYA — NAZORAT → «XODIMLAR DAVOMATI» (34-qism). Foydalanuvchi qarori (17.11.2026): QR'siz —
// xodim xodimlar botidagi «📷 Ishga keldim» bilan belgilaydi (joylashuv + Face ID, lib/attendanceCheck.ts).
// Tablar: Bugun (kutilgan xodimlar: vaqtida / kechikdi / kelmadi / kutilmoqda), Belgilash usuli (rasmdagi
// «QR kiosk» o'rnida — bot ko'rsatmasi va sozlamalar), Kirish-chiqish (kunning voqealari; turniket ulanmagan).
// Server: GET /api/staff-attendance (lib/staffAttendanceToday.ts); sozlamalar — PATCH /api/attendance-qr.

type Tab = "bugun" | "usul" | "voqealar";

const STATE: Record<StaffDayRow["state"], { label: string; cls: string }> = {
  ontime: { label: "vaqtida", cls: "text-v2-success" },
  late: { label: "kechikdi", cls: "text-v2-warning" },
  absent: { label: "kelmadi", cls: "text-v2-danger" },
  waiting: { label: "kutilmoqda", cls: "text-v2-text-3" },
  extra: { label: "jadvalsiz", cls: "text-v2-text-2" },
};

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StaffAttendanceV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("bugun");
  const [date, setDate] = useState(() => isoOf(new Date()));
  const [building, setBuilding] = useState("");
  const [d, setD] = useState<StaffDayPayload | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);

  const days = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const x = new Date(base);
      x.setDate(base.getDate() - i);
      const iso = isoOf(x);
      out.push({ value: iso, label: i === 0 ? `${t("Bugun")}, ${fmt.dayMonth(iso)}` : i === 1 ? `${t("Kecha")}, ${fmt.dayMonth(iso)}` : fmt.dayMonth(iso) });
    }
    return out;
  }, [fmt, t]);

  useEffect(() => {
    let off = false;
    void fetch(`/api/staff-attendance?date=${date}${building ? `&building=${building}` : ""}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setD(j);
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [date, building, ver]);

  async function patch(body: Record<string, boolean>) {
    const res = await fetch("/api/attendance-qr", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    setVer((v) => v + 1);
  }

  const rows = d?.rows ?? [];
  const n = (s: StaffDayRow["state"]) => rows.filter((r) => r.state === s).length;
  const expectedN = rows.filter((r) => r.state !== "extra").length;
  const came = n("ontime") + n("late") + n("extra");
  const absentToday = d && d.date === d.today ? n("absent") : 0;

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "bugun", label: d && d.date !== d.today ? fmt.dayMonth(d.date) : t("Bugun"), badge: absentToday || undefined },
    { key: "usul", label: t("Belgilash usuli") },
    { key: "voqealar", label: t("Kirish-chiqish") },
  ];

  return (
    <PageShell flow>
      <PageHead
        title={t("Xodimlar davomati")}
        subtitle={`${t("Xodim ishga kelganini xodimlar botida belgilaydi — joylashuv va Face ID")}${d ? ` · ${d.building.name}` : ""}`}
        actions={
          <>
            {(d?.buildings.length ?? 0) > 1 && (
              <div className="w-60">
                <V2Select variant="value" label={t("Filial")} value={building || String(d?.building.id ?? "")} onChange={setBuilding} options={(d?.buildings ?? []).map((b) => ({ value: String(b.id), label: b.name }))} />
              </div>
            )}
            <div className="w-56">
              <V2Select label={t("Kun")} icon={CalendarDays} value={date} onChange={setDate} options={days} />
            </div>
          </>
        }
      />

      <div role="tablist" aria-label={t("Xodimlar davomati")} className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--v2-border)]">
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(x.key)} className={`relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-v2-body ${on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"}`}>
              {x.label}
              {x.badge ? <span className="rounded-full bg-v2-danger-bg px-1.5 py-px text-v2-caption font-semibold text-v2-danger">{x.badge}</span> : null}
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!d && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {d && tab === "bugun" && (
        <>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-v2-h3 font-semibold text-v2-text">
                {d.date === d.today ? t("Bugun keldi") : t("Keldi")} {came} / {expectedN}
              </h2>
              <span className="text-v2-small text-v2-text-2">{t("ish vaqti — o'qituvchida birinchi darsi, boshqalarda o'z yoki filial ish vaqti")}</span>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-v2-surface-2">
              {[
                ["ontime", "bg-v2-success"],
                ["late", "bg-v2-warning"],
                ["absent", "bg-v2-danger"],
              ].map(([k, cls]) => {
                const c = n(k as StaffDayRow["state"]);
                return c ? <span key={k} className={cls} style={{ width: `${(c / Math.max(1, expectedN)) * 100}%` }} /> : null;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 text-v2-small text-v2-text-2">
              <span>
                {t("Vaqtida")} <b className="font-semibold text-v2-text">{n("ontime")}</b>
              </span>
              <span>
                {t("Kechikdi")} <b className="font-semibold text-v2-text">{n("late")}</b>
              </span>
              <span>
                {t("Kelmadi")} <b className="font-semibold text-v2-text">{n("absent")}</b>
              </span>
              {n("waiting") > 0 && (
                <span>
                  {t("Kutilmoqda")} <b className="font-semibold text-v2-text">{n("waiting")}</b>
                </span>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            {rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-v2-small text-v2-text-3">{t("Bu kunda kutilgan xodim yo'q")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-5`}>{t("Xodim")}</th>
                      <th className={TH}>{t("Belgilash")}</th>
                      <th className={`${TH} text-right`}>{t("Keldi")}</th>
                      <th className={`${TH} text-right`}>{t("Ketdi")}</th>
                      <th className={`${TH} pr-5 text-right`}>{t("Holat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.employeeId} className={`border-b border-v2-border last:border-b-0 ${r.state === "absent" ? "bg-v2-danger-bg" : ""}`}>
                        <td className="py-3 pl-5 pr-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-v2-text">{r.name}</div>
                              <div className="truncate text-v2-small text-v2-text-2">
                                {[t(r.role), r.expected ? t("{time} gacha", { time: r.expected }) : t("jadvali yo'q"), r.expectedWhy ? t(r.expectedWhy) : ""].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {r.enter ? (
                            <span className="inline-flex items-center gap-1.5 rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-small text-v2-text-2" title={r.location ?? undefined}>
                              {r.face ? <ScanFace className="size-3.5" strokeWidth={1.75} aria-hidden /> : <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />}
                              {r.face ? t("Bot · Face ID") : t("Bot · joylashuv")}
                            </span>
                          ) : (
                            <span className="text-v2-text-3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-text">{r.enter ?? "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{r.exit ?? "—"}</td>
                        <td className={`py-3 pl-3 pr-5 text-right text-v2-small font-semibold ${STATE[r.state].cls}`}>
                          {r.state === "late" ? t("kechikdi {n} daq.", { n: r.lateMinutes }) : t(STATE[r.state].label)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {d && tab === "usul" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-6 shadow-v2-sm">
            <h2 className="text-[22px] font-semibold text-v2-text">{t("Ishga keldingizmi? Botda belgilang")}</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-v2-body text-v2-text">
              <li>{t("Telegram'da xodimlar botini oching")}{d.bot ? ` (@${d.bot})` : ""}.</li>
              <li>
                {t("«📷 Ishga keldim» tugmasini bosing")} — {d.faceRequired ? t("yuz va joylashuv tekshiriladi.") : t("joylashuv tekshiriladi.")}
              </li>
              {d.checkoutEnabled && <li>{t("Ish tugagach «🏁 Ishdan ketdim» tugmasini bosing.")}</li>}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-v2-small font-semibold ${d.building.geoSet ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>
                <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
                {d.building.geoSet ? t("Joylashuv tekshiriladi") : t("Filial koordinatasi kiritilmagan — masofa tekshirilmaydi")}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-v2-small font-semibold ${d.faceRequired ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>
                <ScanFace className="size-3.5" strokeWidth={1.75} aria-hidden />
                {d.faceRequired ? t("Face ID yoqilgan") : t("Face ID o'chiq")}
              </span>
            </div>
            {d.bot && (
              <a href={`https://t.me/${d.bot}`} target="_blank" rel="noreferrer" className={`${secondaryBtn} mt-5`}>
                <Send className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Botni ochish")}
              </a>
            )}
          </section>
          <aside className="space-y-4">
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
              <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Sozlamalar")}</h2>
              {[
                { key: "faceRequired", label: t("Face ID — yuz tekshiruvi"), on: d.faceRequired },
                { key: "checkoutEnabled", label: t("«Ishdan ketdim» ham belgilansin"), on: d.checkoutEnabled },
              ].map((s) => (
                <div key={s.key} className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-v2-body text-v2-text">{s.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.on}
                    aria-label={s.label}
                    disabled={!d.canConfigure}
                    onClick={() => void patch({ [s.key]: !s.on })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.on ? "bg-v2-brand" : "bg-v2-border-strong"}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${s.on ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
              {!d.canConfigure && <p className="mt-3 text-v2-small text-v2-text-3">{t("Sozlamani faqat administrator o'zgartiradi")}</p>}
            </section>
            {d.missingGeo.length > 0 && (
              <section className="rounded-v2-lg border border-v2-border bg-v2-warning-bg p-5">
                <h2 className="font-semibold text-v2-text">{t("Koordinatasi kiritilmagan filiallar")}</h2>
                <p className="mt-1 text-v2-small text-v2-text-2">{d.missingGeo.map((x) => x.name).join(", ")}</p>
                <Link href="/management-filiallar" className="mt-2 inline-block text-v2-small font-semibold text-v2-brand hover:underline">
                  {t("Boshqaruv → Filiallar")} →
                </Link>
              </section>
            )}
          </aside>
        </div>
      )}

      {d && tab === "voqealar" && (
        <>
          <NoticeBar>{t("Turniket hali ulanmagan — voqealar xodimlar botidagi belgilashlardan. Turniket Sozlamalar → Integratsiyalar orqali ulanadi (taklif).")}</NoticeBar>
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            {d.events.length === 0 ? (
              <p className="px-5 py-10 text-center text-v2-small text-v2-text-3">{t("Bu kunda voqea yo'q")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-5`}>{t("Vaqt")}</th>
                      <th className={TH}>{t("Kim")}</th>
                      <th className={TH}>{t("Voqea")}</th>
                      <th className={TH}>{t("Reja")}</th>
                      <th className={TH}>{t("Natija")}</th>
                      <th className={`${TH} pr-5`}>{t("Joylashuv")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.events.map((e, i) => (
                      <tr key={`${e.time}${e.name}${i}`} className="border-b border-v2-border last:border-b-0">
                        <td className="py-3 pl-5 pr-3 font-semibold tabular-nums text-v2-text">{e.time}</td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-v2-text">{e.name}</div>
                          <div className="text-v2-small text-v2-text-2">{t(e.role)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${e.kind === "in" ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>{e.kind === "in" ? t("Kirish") : t("Chiqish")}</span>
                        </td>
                        <td className="px-3 py-3 text-v2-text-2">{e.expected ? t("{time} gacha", { time: e.expected }) : "—"}</td>
                        <td className={`px-3 py-3 font-semibold ${e.kind === "out" ? "text-v2-text-3" : e.lateMinutes > 0 ? "text-v2-warning" : "text-v2-success"}`}>
                          {e.kind === "out" ? "—" : e.lateMinutes > 0 ? t("kechikdi {n} daq.", { n: e.lateMinutes }) : t("vaqtida")}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-v2-small text-v2-text-2">{e.location ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
