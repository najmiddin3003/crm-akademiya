"use client";

import { useState } from "react";
import { Check, ChevronRight, Eye, Info, Loader2, Lock, Package, RefreshCw, Send, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { fieldCls } from "@/components/v2/form/fields";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { Card, fmtSum } from "@/components/v2/teacher/teacherBits";
import { KIND_META, KindIcon, deskQs, giftDecision, shortWhen, taskAction, type ApprovalItem } from "./deskBits";

// YANGI VERSIYA — MENEJER · TASDIQ KUTMOQDA (47-qism, rasmlar «tasdiq kutmoqda: profil so'rovi», «topshiriqni qaytarish»,
// telefonda «sovg'a so'rovini tasdiqlash»). Chapda ro'yxat (tur bo'yicha segment), o'ngda tafsilot va qaror:
// topshiriq — Tasdiqlash yoki Qaytarish (izoh + yangi muddat majburiy), sovg'a — Tasdiqlash yoki Rad etish (sabab),
// rahbarda — faqat ko'rish. Pastda «Bugun hal qilingan». Server — /api/staff-desk?view=approvals.

interface Data {
  ok: true;
  today: string;
  now: string;
  who: { name: string; preview: boolean };
  branch: string;
  items: ApprovalItem[];
  counts: { all: number; topshiriq: number; sovga: number; rahbarda: number };
  resolved: { kind: string; time: string; title: string; sub: string; result: string }[];
}
type Filter = "all" | ApprovalItem["kind"];

export default function ApprovalsV2({ as, openKey }: { as?: string; openKey?: string }) {
  const { t } = useT();
  const { data: d, error, reload } = useReportData<Data>(`/api/staff-desk?view=approvals${deskQs(as, "manager")}`);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(openKey ?? null);
  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Ma'lumot yuklanmadi")}</NoticeBar>
      </div>
    );
  if (!d)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const list = d.items.filter((i) => filter === "all" || i.kind === filter);
  const cur = d.items.find((i) => i.key === sel) ?? null;
  const mine = d.counts.topshiriq + d.counts.sovga;

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name}", { name: d.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-v2-small text-v2-text-3">
            <Link href={`/home${as ? `?desk=${encodeURIComponent(as)}&mode=manager` : ""}`} className="hover:underline">
              {t("Bosh sahifa")}
            </Link>{" "}
            ›
          </div>
          <h1 className="text-v2-page text-v2-text">{t("Tasdiq kutmoqda")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[d.branch, t("{a} tasini siz tasdiqlaysiz, {b} tasi rahbarda", { a: mine, b: d.counts.rahbarda }), t("{time} holatiga", { time: d.now })].filter(Boolean).join(" · ")}</p>
        </div>
        <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {(
            [
              ["all", t("Hammasi · {n}", { n: d.counts.all })],
              ["topshiriq", t("Topshiriq · {n}", { n: d.counts.topshiriq })],
              ["sovga", t("Sovg'a · {n}", { n: d.counts.sovga })],
              ["rahbarda", t("Rahbarda · {n}", { n: d.counts.rahbarda })],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`h-8 shrink-0 rounded-v2-sm px-3 text-v2-small ${filter === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <h2 className="text-v2-section text-v2-text">{filter === "all" ? t("Hammasi · {n}", { n: list.length }) : `${t(KIND_META[filter].label)} · ${list.length}`}</h2>
              <p className="text-v2-small text-v2-text-3">{t("eng yangisi tepada · qatorni bossangiz o'ngda ochiladi")}</p>
            </div>
            {list.length === 0 ? <p className="border-t border-v2-border px-5 py-6 text-center text-v2-small text-v2-success">{t("Tasdiq kutayotgan narsa yo'q.")}</p> : null}
            {list.map((a) => {
              const m = KIND_META[a.kind];
              const on = cur?.key === a.key;
              return (
                <button key={a.key} type="button" onClick={() => setSel(a.key)} className={`flex w-full items-center gap-3 border-l-[3px] border-t border-t-v2-border px-4 py-3 text-left sm:px-5 ${on ? "border-l-v2-brand bg-v2-brand-bg" : "border-l-transparent hover:bg-v2-surface-2"}`}>
                  <KindIcon kind={a.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-v2-body font-semibold text-v2-text">{a.title}</span>
                      <span className={`inline-flex items-center gap-1 rounded-v2-sm px-1.5 py-0.5 text-v2-caption ${m.tone}`}>
                        <m.Icon className="size-3" strokeWidth={1.75} aria-hidden />
                        {t(m.label)}
                      </span>
                    </span>
                    <span className="block truncate text-v2-caption text-v2-text-3">{a.sub}</span>
                  </span>
                  <span className="shrink-0 text-v2-small tabular-nums text-v2-text-2">{a.time}</span>
                  <ChevronRight className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                </button>
              );
            })}
          </Card>
          <Card className="!p-0 sm:!p-0">
            <div className="p-4 sm:p-5">
              <h2 className="text-v2-section text-v2-text">{t("Bugun hal qilingan · {n}", { n: d.resolved.length })}</h2>
              <p className="text-v2-small text-v2-text-3">{d.branch}</p>
            </div>
            {d.resolved.length === 0 ? <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Bugun hali hal qilinmagan.")}</p> : null}
            {d.resolved.map((r, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-v2-border px-4 py-2.5 sm:px-5">
                <span className="w-11 shrink-0 text-v2-small font-semibold tabular-nums">{r.time}</span>
                <span className={`shrink-0 rounded-v2-sm px-1.5 py-0.5 text-v2-caption ${r.kind === "sovga" ? KIND_META.sovga.tone : KIND_META.topshiriq.tone}`}>{r.kind === "sovga" ? t("Sovg'a") : t("Topshiriq")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-small font-semibold text-v2-text">{r.title}</span>
                  <span className="block truncate text-v2-caption text-v2-text-3">{r.sub}</span>
                </span>
                <span className={`shrink-0 rounded-v2-sm px-2 py-0.5 text-v2-caption ${r.result === "Tasdiqlandi" ? "bg-v2-success-bg text-v2-success" : r.result === "Qaytarildi" ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-danger-bg text-v2-danger"}`}>{t(r.result)}</span>
              </div>
            ))}
          </Card>
        </div>

        {cur ? (
          <div className="order-first lg:order-none">
            <Detail key={cur.key} item={cur} today={d.today} as={as} onClose={() => setSel(null)} onDone={() => { setSel(null); reload(); }} />
          </div>
        ) : (
          <Card className="hidden lg:block">
            <p className="py-10 text-center text-v2-small text-v2-text-3">{t("Chapdan so'rovni tanlang.")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Detail({ item, today, as, onClose, onDone }: { item: ApprovalItem; today: string; as?: string; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showError, showSuccess } = useToast();
  const [choice, setChoice] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(Date.parse(`${today}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
    return `${d}T12:00`;
  });
  const [saving, setSaving] = useState(false);
  const x = item.detail;
  const isTask = item.kind === "topshiriq";
  const isGift = item.kind === "sovga";

  const submit = async (decision: "approve" | "reject") => {
    if (decision === "reject" && !note.trim()) return showError(isTask ? t("Izohni yozing") : t("Rad etish sababini yozing"));
    setSaving(true);
    let r: { ok: boolean; error?: string };
    if (isTask) {
      r = decision === "approve" ? await taskAction(item.id, { action: "approve" }) : await taskAction(item.id, { action: "return", note, deadline: new Date(`${deadline}:00+05:00`).toISOString() });
    } else r = await giftDecision(item.id, decision === "approve", note, as);
    setSaving(false);
    if (!r.ok) return showError(r.error ?? t("Saqlanmadi"));
    showSuccess(decision === "approve" ? t("Tasdiqlandi") : isTask ? t("Qaytarildi") : t("Rad etildi"));
    onDone();
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-1.5 text-v2-small">
      <span className="text-v2-text-2">{label}</span>
      <span className="text-v2-text">{value}</span>
    </div>
  );

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5 lg:sticky lg:top-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <KindIcon kind={item.kind} />
          <div className="min-w-0">
            <div className="text-v2-section text-v2-text">{item.title}</div>
            <div className="text-v2-caption text-v2-text-3">{isTask ? t("Topshiriq · {by}", { by: String(x.createdBy || "") }) : isGift ? t("Referal do'koni · {time}", { time: item.time }) : t("Alohida narx · direktor tasdiqlaydi")}</div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={t("Yopish")} className="grid size-8 place-items-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2">
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="mt-4">
        {isTask ? (
          <>
            {row(t("Holat"), <span className="rounded-v2-sm bg-v2-info-bg px-2 py-0.5 text-v2-caption text-v2-info">{t("Bajardim · {t}", { t: item.time })}</span>)}
            {row(
              t("Bajaruvchi"),
              <span className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-v2-warning-bg text-[0.625rem] font-semibold text-v2-warning">{initialsOf(String(x.employee))}</span>
                {String(x.employee)}
              </span>,
            )}
            {row(t("Muddat"), `${shortWhen(String(x.deadline), today)}${x.isLate ? ` · ${t("kechikib bajarildi")}` : ` · ${t("o'z vaqtida bajarildi")}`}`)}
            {row(t("Muhimlik"), `${x.priority}${Number(x.fine) ? ` · ${t("bajarilmasa {sum} so'm jarima", { sum: fmtSum(Number(x.fine)) })}` : ""}`)}
            {x.desc ? <p className="mt-2 text-v2-small text-v2-text-2">{String(x.desc)}</p> : null}
            {x.doneNote ? (
              <div className="mt-3 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
                <div className="text-v2-caption text-v2-text-3">{t("{n}ning izohi", { n: String(x.employee).split(" ")[0] })}</div>
                <p className="mt-1 text-v2-small text-v2-text">{String(x.doneNote)}</p>
              </div>
            ) : null}
            {x.resultLink ? (
              <a href={String(x.resultLink)} target="_blank" rel="noreferrer" className="mt-2 block text-v2-small text-v2-brand-text">
                {t("Natija havolasi")}
              </a>
            ) : null}
          </>
        ) : isGift ? (
          <>
            <div className="flex items-center gap-3 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-v2-surface text-v2-caption font-semibold">{initialsOf(String(x.referrer))}</span>
              <div>
                <div className="text-v2-small font-semibold">{String(x.referrer)}</div>
                <div className="text-v2-caption text-v2-text-3">{[String(x.kind), String(x.note || "")].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div className="mt-3 rounded-v2-md bg-v2-warning-bg px-3 py-2.5">
              <div className="flex items-center gap-2 text-v2-body font-semibold text-v2-text">
                <Package className="size-4 text-v2-warning" strokeWidth={1.75} aria-hidden />
                {item.title}
              </div>
              <div className="text-v2-caption text-v2-text-2">{t("{p} referal · omborda {s} ta", { p: Number(x.price), s: Number(x.stock) })}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                [t("Balans"), `${x.balance} → ${Number(x.balance) - Number(x.price)}`, t("referal")],
                [t("Taklif qildi"), String(x.invited), t("kishi")],
                [t("Hisoblandi"), String(x.counted), t("kishi")],
              ].map(([a, b, c]) => (
                <div key={a} className="rounded-v2-md border border-v2-border px-2.5 py-2">
                  <div className="text-v2-caption text-v2-text-3">{a}</div>
                  <div className="text-v2-body font-semibold tabular-nums">{b}</div>
                  <div className="text-v2-caption text-v2-text-3">{c}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-v2-md border border-v2-border px-3 py-2.5">
              <div className="mb-1 text-v2-caption text-v2-text-3">{t("Tasdiqlansa")}</div>
              {[t("Balansdan {p} referal yechiladi", { p: Number(x.price) }), t("Ombor qoldig'i {a} → {b}", { a: Number(x.stock), b: Number(x.stock) - 1 }), t("So'rov «Tasdiqlandi» bo'ladi — sovg'ani filialda berasiz")].map((s) => (
                <div key={s} className="flex items-center gap-2 py-1 text-v2-small text-v2-text">
                  <Check className="size-3.5 text-v2-success" strokeWidth={2} aria-hidden />
                  {s}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {row(t("O'quvchi"), String(x.pupil))}
            {row(t("Guruh"), String(x.group))}
            {row(t("Narx"), `${fmtSum(Number(x.basePrice))} → ${fmtSum(Number(x.basePrice) - Number(x.amount))}${x.percent ? ` (${x.percent}%)` : ""}`)}
            {row(t("Davr"), `${x.from}${x.to && x.to !== x.from ? ` – ${x.to}` : ""}`)}
            {row(t("Sabab"), [String(x.reason ?? ""), String(x.note ?? "")].filter(Boolean).join(" · "))}
            {row(t("So'radi"), String(x.createdBy))}
            <p className="mt-3 flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small text-v2-text-2">
              <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Admin chegarasidan katta imtiyoz — direktor tasdiqlaydi. Siz faqat ko'rasiz.")}
            </p>
          </>
        )}
      </div>

      {item.kind !== "rahbarda" ? (
        <>
          <div className="mt-4 text-v2-small font-semibold text-v2-text">{t("Qaror")}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setChoice("approve")} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border text-v2-small font-medium ${choice === "approve" ? "border-v2-success bg-v2-success-bg text-v2-success" : "border-v2-border-strong text-v2-text"}`}>
              <Check className="size-4" strokeWidth={2} aria-hidden />
              {t("Tasdiqlash")}
            </button>
            <button type="button" onClick={() => setChoice("reject")} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border text-v2-small font-medium ${choice === "reject" ? "border-v2-warning bg-v2-warning-bg text-v2-warning" : "border-v2-border-strong text-v2-text"}`}>
              {isTask ? <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden /> : <X className="size-4" strokeWidth={2} aria-hidden />}
              {isTask ? t("Qaytarish") : t("Rad etish")}
            </button>
          </div>
          {choice === "reject" ? (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-v2-small font-semibold text-v2-text">
                  {isTask ? t("Izoh") : t("Rad etish sababi")} <span className="font-normal text-v2-text-3">· {t("majburiy")}</span>
                </span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={fieldCls(undefined, "h-auto py-2")} />
              </label>
              {isTask ? (
                <label className="block">
                  <span className="mb-1 block text-v2-small font-semibold text-v2-text">
                    {t("Yangi muddat")} <span className="font-normal text-v2-text-3">· {t("majburiy")}</span>
                  </span>
                  <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={fieldCls()} />
                  <span className="mt-1 block text-v2-caption text-v2-text-3">{t("Hisob yangi muddatdan boshlanadi: o'tsa — qayta muddat, u ham o'tsa — jarima.")}</span>
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            {choice === "reject" ? (
              <>
                <button type="button" onClick={() => setChoice(null)} className={secondaryBtn}>
                  {t("Bekor qilish")}
                </button>
                <button type="button" disabled={saving} onClick={() => void submit("reject")} className={`${primaryBtn} flex-1 justify-center disabled:opacity-50`}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : isTask ? <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden /> : <X className="size-4" strokeWidth={2} aria-hidden />}
                  {isTask ? t("Qaytarish · {d}", { d: `${fmt.dayMonth(deadline.slice(0, 10))} ${deadline.slice(11, 16)}` }) : t("Rad etish")}
                </button>
              </>
            ) : (
              <button type="button" disabled={saving} onClick={() => void submit("approve")} className={`${primaryBtn} flex-1 justify-center disabled:opacity-50`}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                {t("Tasdiqlash")}
              </button>
            )}
          </div>
          <p className="mt-2 flex items-start gap-2 text-v2-caption text-v2-text-3">
            {isTask ? <Send className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> : <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
            {isTask ? t("Qaror xodimga botda boradi va topshiriq tarixiga yoziladi.") : t("Rad etsangiz, sababi taklif qiluvchi kabinetida ko'rinadi.")}
          </p>
        </>
      ) : null}
    </section>
  );
}
