"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Loader2, Plus, Printer, QrCode } from "lucide-react";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, TextInput } from "@/components/v2/form/fields";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import {
  NoticeBar,
  PageHead,
  PageShell,
  TH,
} from "@/components/v2/students/lists/listKit";
import {
  useBranchOptions,
  useReportData,
  useToday,
} from "@/components/v2/reports/reportHooks";
import { dateOfIso, isoOf } from "@/components/v2/reports/reportFormat";
import type {
  CampaignKind,
  CampaignReport,
  CampaignRow,
} from "@/lib/campaignLinks";

// YANGI VERSIYA — SOTUV VA MARKETING → «KAMPANIYA HAVOLALARI» (36-qism, rasm «Kampaniya havolalari»).
// Har reklama uchun qisqa havola `/s/KOD` va QR kod: ochilishlar, lidlar, o'quvchilar, konversiya; tanlangan havola
// paneli (QR · PNG, A6 chop etish, xarajat va bir o'quvchi narxi), «Havola yaratish» / «Tahrirlash» oynasi.
// Server: /api/campaign-links (lib/campaignLinks.ts); qisqa havola — app/s/[code]/route.ts.

const KINDS: { value: CampaignKind; label: string; dot: string }[] = [
  { value: "instagram", label: "Instagram", dot: "bg-v2-violet" },
  { value: "sayt", label: "Sayt", dot: "bg-v2-brand" },
  { value: "telegram", label: "Telegram", dot: "bg-v2-info" },
  { value: "flyer", label: "Flyer", dot: "bg-v2-warning" },
  { value: "banner", label: "Banner", dot: "bg-v2-series-2" },
  { value: "boshqa", label: "Boshqa", dot: "bg-v2-text-3" },
];
const kindOf = (k: string) =>
  KINDS.find((x) => x.value === k) ?? KINDS[KINDS.length - 1];
const shortLink = (code: string) =>
  typeof window === "undefined"
    ? `/s/${code}`
    : `${window.location.origin}/s/${code}`;
const shortLabel = (code: string) =>
  `${typeof window === "undefined" ? "" : window.location.host}/s/${code}`;
const money = (n: number) => `${n.toLocaleString("ru-RU")} so'm`;

export default function CampaignsV2() {
  const { t } = useT();
  const today = useToday();
  const branchOptions = useBranchOptions();
  const [range, setRange] = useState<DateRange>(() => ({
    start: dateOfIso(`${today.slice(0, 7)}-01`),
    end: dateOfIso(today),
  }));
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<CampaignRow | "new" | null>(null);

  const from = range.start ? isoOf(range.start) : `${today.slice(0, 7)}-01`;
  const to = range.start ? isoOf(range.end ?? range.start) : today;
  const qs = new URLSearchParams({
    from,
    to,
    ...(branch ? { branch } : {}),
    ...(kind ? { kind } : {}),
  }).toString();
  const {
    data: d,
    error,
    reload,
  } = useReportData<CampaignReport>(`/api/campaign-links?${qs}`);
  const cur =
    d?.rows.find((r) => r.id === sel) ?? d?.rows.find((r) => r.active) ?? null;
  const k = d?.kpi;
  const weekAgo = isoOf(new Date(dateOfIso(today).getTime() - 7 * 86_400_000));

  return (
    <PageShell flow>
      <PageHead
        title={t("Kampaniya havolalari")}
        subtitle={t(
          "Har reklama uchun alohida havola va QR kod — undan kelgan lidning manbasi o'zi yoziladi",
        )}
        actions={
          <button
            type="button"
            onClick={() => setEdit("new")}
            className={primaryBtn}
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />{" "}
            {t("Havola yaratish")}
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <V2DateRange
          value={range}
          onChange={setRange}
          allowAll={false}
          align="start"
        />
        {branchOptions.length > 1 && (
          <V2Select
            variant="chip"
            label={t("Filial")}
            emptyLabel="Barchasi"
            value={branch}
            onChange={setBranch}
            options={branchOptions}
            searchable={false}
          />
        )}
        <V2Select
          variant="chip"
          label={t("Turi")}
          emptyLabel="Hammasi"
          value={kind}
          onChange={setKind}
          options={KINDS.map((x) => ({ value: x.value, label: t(x.label) }))}
          searchable={false}
        />
        <span className="ml-auto hidden text-v2-small text-v2-text-2 lg:inline">
          {t("havola so'rovnoma sahifasini kampaniya kodi bilan ochadi")}
        </span>
      </div>
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
          {t("Yuklanmoqda…")}
        </div>
      )}
      {d && k && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label={t("Manbasi ma'lum lidlar")}
              value={`${k.withSource} / ${k.leads}`}
              badge={
                k.leads
                  ? `${Math.round((k.withSource / k.leads) * 100)}%`
                  : undefined
              }
              sub={
                k.withSource === k.leads
                  ? t("davrdagi har lidda manba bor")
                  : t("{n} ta lidda manba yo'q", { n: k.leads - k.withSource })
              }
            />
            <Kpi
              label={t("Havola orqali kelgan")}
              value={String(k.viaLink)}
              badge={
                k.leads
                  ? `${Math.round((k.viaLink / k.leads) * 100)}%`
                  : undefined
              }
              muted
              sub={t("qolgan {n} tasi — havolasiz", { n: k.leads - k.viaLink })}
            />
            <Kpi
              label={t("Havolalar ochildi")}
              value={k.opens.toLocaleString("ru-RU")}
              sub={
                k.opens
                  ? t("{p}% i ariza qoldirdi", {
                      p: Math.round((k.viaLink / k.opens) * 100),
                    })
                  : t("hali ochilmagan")
              }
            />
            <Kpi
              label={t("Natijasiz havola")}
              value={String(k.idle)}
              warn={k.idle > 0}
              sub={
                k.idle
                  ? t("{n} — o'quvchi yo'q", {
                      n: k.idleNames.slice(0, 2).join(" va "),
                    })
                  : t("hammasi natija bermoqda")
              }
            />
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-4`}>{t("Kampaniya")}</th>
                      <th className={TH}>{t("Kod")}</th>
                      <th className={`${TH} text-right`}>{t("Ochildi")}</th>
                      <th className={`${TH} text-right`}>{t("Lid")}</th>
                      <th className={`${TH} text-right`}>{t("O'quvchi")}</th>
                      <th className={TH}>{t("Konversiya")}</th>
                      <th className={`${TH} pr-4`}>
                        <span className="sr-only">QR</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => {
                      const on = cur?.id === r.id;
                      const p = r.leads
                        ? Math.round((r.students / r.leads) * 100)
                        : null;
                      const fresh =
                        !r.leads && r.createdAt.slice(0, 10) > weekAgo;
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSel(r.id)}
                          className={`cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover ${on ? "bg-v2-brand-bg" : ""} ${r.active ? "" : "opacity-60"}`}
                        >
                          <td className="py-2.5 pl-4 pr-3">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`mt-1.5 size-2 shrink-0 rounded-full ${kindOf(r.kind).dot}`}
                                aria-hidden
                              />
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-v2-text">
                                  {r.name}
                                </div>
                                <div className="truncate text-v2-small text-v2-text-2">
                                  {r.active
                                    ? r.place || t(kindOf(r.kind).label)
                                    : t("to'xtatilgan")}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-v2-sm bg-v2-surface-2 px-1.5 py-0.5 font-mono text-v2-small text-v2-text">
                              {r.code}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">
                            {r.opens}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">
                            {r.leads}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">
                            {r.students}
                          </td>
                          <td className="px-3 py-2.5">
                            {fresh || p === null ? (
                              <span className="rounded-full bg-v2-surface-2 px-2 py-0.5 text-v2-small font-semibold text-v2-text-2">
                                {fresh ? t("yangi") : "—"}
                              </span>
                            ) : (
                              <span
                                className={`rounded-full px-2 py-0.5 text-v2-small font-semibold ${p === 0 ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-success-bg text-v2-success"}`}
                              >
                                {p}%
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pl-3 pr-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSel(r.id)}
                              aria-label={t("{n} — QR kod", { n: r.name })}
                              className="inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border text-v2-text-2 hover:bg-v2-hover"
                            >
                              <QrCode className="size-4" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!d.rows.length && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-v2-small text-v2-text-3"
                        >
                          {t("Hali havola yo'q — «Havola yaratish»")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {d.noLink.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-v2-border bg-v2-surface-2 px-4 py-2.5 text-v2-small">
                  <span className="font-semibold text-v2-text">
                    {t("Havolasiz")}
                  </span>
                  {d.noLink.map((n, i) => (
                    <span key={n.source} className="text-v2-text-2">
                      {i > 0 && (
                        <span className="mr-3" aria-hidden>
                          ·
                        </span>
                      )}
                      {t("{s} — {l} lid, {o} o'quvchi", {
                        s: t(n.source),
                        l: n.leads,
                        o: n.students,
                      })}
                    </span>
                  ))}
                </div>
              )}
              <p className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
                {t(
                  "Ariza lid bo'lib tushadi va «Manba» kampaniyadan o'zi to'ladi — erkin matn yo'q, shuning uchun hisobotlarda manbasiz o'quvchi qolmaydi",
                )}
              </p>
            </section>
            {cur && (
              <LinkPanel
                r={cur}
                onEdit={() => setEdit(cur)}
                onChange={reload}
              />
            )}
          </div>
        </>
      )}
      {edit && d && (
        <EditDialog
          row={edit === "new" ? null : edit}
          sources={d.sources}
          branchOptions={branchOptions}
          onClose={() => setEdit(null)}
          onDone={(id) => (setSel(id), reload())}
        />
      )}
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  badge,
  sub,
  warn,
  muted,
}: {
  label: string;
  value: string;
  badge?: string;
  sub: string;
  warn?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div
        className={`mt-1 text-[24px] font-semibold leading-8 tabular-nums ${warn ? "text-v2-warning" : "text-v2-text"}`}
      >
        {value}{" "}
        {badge && (
          <span
            className={`text-v2-small font-semibold ${muted ? "text-v2-text-2" : "text-v2-success"}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="truncate text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function LinkPanel({
  r,
  onEdit,
  onChange,
}: {
  r: CampaignRow;
  onEdit: () => void;
  onChange: () => void;
}) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [qr, setQr] = useState("");
  const link = shortLink(r.code);
  useEffect(() => {
    void QRCode.toDataURL(link, { margin: 1, width: 480 })
      .then(setQr)
      .catch(() => {});
  }, [link]);
  const copy = () =>
    void navigator.clipboard
      ?.writeText(link)
      .then(() => showSuccess(t("Nusxalandi")));
  const png = () => {
    const a = document.createElement("a");
    a.href = qr;
    a.download = `qr-${r.code}.png`;
    a.click();
  };
  const print = () => {
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    const esc = (s: string) =>
      s.replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
      );
    w.document.write(
      `<!doctype html><title>${esc(r.code)}</title><style>@page{size:A6;margin:8mm}body{font-family:system-ui,sans-serif;text-align:center;margin:0}h1{font-size:18px;margin:4mm 0 2mm}p{font-size:12px;margin:0 0 4mm;color:#444}img{width:70mm;height:70mm}b{font-family:monospace;font-size:13px}</style><h1>${esc(t("Bepul sinov darsiga yoziling"))}</h1><p>${esc(t("QR kodni telefon kamerasi bilan skanerlang"))}</p><img src="${qr}" alt=""><p><b>${esc(shortLabel(r.code))}</b></p><script>onload=()=>{print();}</script>`,
    );
    w.document.close();
  };
  async function toggle() {
    const res = await fetch("/api/campaign-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    })
      .then((x) => x.json())
      .catch(() => null);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(r.active ? t("Havola to'xtatildi") : t("Havola qayta yoqildi"));
    onChange();
  }
  const perStudent = r.cost && r.students ? Math.round(r.cost / r.students) : 0;
  return (
    <aside
      aria-label={r.name}
      className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm"
    >
      <div className="p-4">
        <div className="text-v2-small text-v2-text-2">
          {t("Tanlangan havola")}
        </div>
        <div className="text-[17px] font-semibold text-v2-text">{r.name}</div>
        <div className="text-v2-small text-v2-text-2">
          {[
            t("{n} yaratdi", { n: r.createdBy || "—" }),
            fmt.dayMonth(r.createdAt.slice(0, 10)),
            t(r.branchName),
          ].join(" · ")}
        </div>
        <div className="mx-auto mt-4 flex size-44 items-center justify-center rounded-v2-md border border-v2-border bg-white p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL (QR), optimallashtirish kerak emas
            <img
              src={qr}
              alt={t("{n} — QR kod", { n: r.name })}
              className="size-full"
            />
          ) : (
            <Loader2 className="size-5 animate-spin text-v2-text-3" />
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-v2-md border border-v2-border-strong py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1 truncate font-mono text-v2-small text-v2-text">
            {shortLabel(r.code)}
          </span>
          <button
            type="button"
            onClick={copy}
            className={`${secondaryBtn} h-8 px-2.5`}
          >
            <Copy className="size-3.5" aria-hidden /> {t("Nusxa olish")}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={png}
            disabled={!qr}
            className={secondaryBtn}
          >
            <Download className="size-4" aria-hidden /> QR · PNG
          </button>
          <button
            type="button"
            onClick={print}
            disabled={!qr}
            className={secondaryBtn}
          >
            <Printer className="size-4" aria-hidden /> {t("Chop etish · A6")}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 border-y border-v2-border">
        {[
          [t("Ochildi"), r.opens],
          [t("Ariza"), r.leads],
          [t("O'quvchi"), r.students],
        ].map(([a, b], i) => (
          <div
            key={i}
            className="border-v2-border px-4 py-2.5 [&:not(:last-child)]:border-r"
          >
            <div className="text-v2-small text-v2-text-2">{a}</div>
            <div className="text-[18px] font-semibold tabular-nums text-v2-text">
              {b}
            </div>
          </div>
        ))}
      </div>
      <dl className="space-y-2 p-4 text-v2-small">
        <div className="flex justify-between gap-3">
          <dt className="text-v2-text-2">{t("Xarajat")}</dt>
          <dd className="font-semibold tabular-nums text-v2-text">
            {r.cost ? money(r.cost) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-v2-text-2">{t("Bir o'quvchi narxi")}</dt>
          <dd className="font-semibold tabular-nums text-v2-text">
            {perStudent ? money(perStudent) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-v2-text-2">{t("Manba")}</dt>
          <dd className="text-right text-v2-text">
            {r.source ? t(r.source) : "—"}
          </dd>
        </div>
        {r.place && (
          <div className="flex justify-between gap-3">
            <dt className="text-v2-text-2">{t("Qayerda")}</dt>
            <dd className="text-right text-v2-text">{r.place}</dd>
          </div>
        )}
      </dl>
      <div className="flex gap-2 border-t border-v2-border p-4">
        <button type="button" onClick={onEdit} className={secondaryBtn}>
          {t("Tahrirlash")}
        </button>
        <button
          type="button"
          onClick={() => void toggle()}
          className={`${secondaryBtn} border-transparent shadow-none ${r.active ? "text-v2-danger" : "text-v2-brand"}`}
        >
          {r.active ? t("To'xtatish") : t("Qayta yoqish")}
        </button>
      </div>
    </aside>
  );
}

function EditDialog({
  row,
  sources,
  branchOptions,
  onClose,
  onDone,
}: {
  row: CampaignRow | null;
  sources: string[];
  branchOptions: { value: string; label: string }[];
  onClose: () => void;
  onDone: (id: number) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(row?.name ?? "");
  const [place, setPlace] = useState(row?.place ?? "");
  const [kind, setKind] = useState<string>(row?.kind ?? "flyer");
  const [source, setSource] = useState(row?.source ?? "");
  const [branch, setBranch] = useState(
    row?.branchId ? String(row.branchId) : "",
  );
  const [cost, setCost] = useState(row?.cost ? String(row.cost) : "");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const srcOpts = useMemo(
    () => sources.map((s) => ({ value: s, label: t(s) })),
    [sources, t],
  );
  async function save(close: () => void) {
    if (!name.trim()) return setErr(t("Kampaniya nomini yozing"));
    setSaving(true);
    const res = await fetch("/api/campaign-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(row ? { id: row.id } : { code }),
        name,
        place,
        kind,
        source,
        branchId: branch ? Number(branch) : null,
        cost: Number(cost) || 0,
      }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(
      row
        ? t("Havola saqlandi")
        : t("Havola yaratildi: {c}", { c: res.link.code }),
    );
    close();
    onDone(res.link.id);
  }
  return (
    <V2Dialog
      title={row ? t("Havolani tahrirlash") : t("Havola yaratish")}
      subtitle={
        row ? row.code : t("Qisqa havola va QR kod — reklamaga qo'yish uchun")
      }
      onClose={onClose}
      saving={saving}
      width={520}
      footer={(api) => (
        <>
          <button
            type="button"
            onClick={api.requestClose}
            className={secondaryBtn}
          >
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void save(api.close)}
            disabled={saving}
            className={`${primaryBtn} disabled:opacity-50`}
          >
            {row ? t("Saqlash") : t("Yaratish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Kampaniya nomi")} error={err}>
          <TextInput
            value={name}
            onChange={(e) => (setName(e.target.value), setErr(""))}
            placeholder={t("Masalan: Flyer · 12-maktab")}
            maxLength={80}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Turi")}>
            <V2Select
              label={t("Turi")}
              value={kind}
              onChange={setKind}
              options={KINDS.map((x) => ({
                value: x.value,
                label: t(x.label),
              }))}
              searchable={false}
            />
          </Field>
          <Field label={t("Manba")} hint={t("lidga shu manba yoziladi")}>
            <V2Select
              label={t("Manba")}
              value={source}
              onChange={setSource}
              options={srcOpts}
              placeholder={t("Tanlang")}
            />
          </Field>
        </div>
        <Field label={t("Qayerda")} optional>
          <TextInput
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={t("Masalan: maktab darvozasi, 1 000 dona")}
            maxLength={160}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Filial")}>
            <V2Select
              label={t("Filial")}
              value={branch}
              onChange={setBranch}
              options={[
                { value: "", label: t("Barcha filiallar") },
                ...branchOptions,
              ]}
              searchable={false}
            />
          </Field>
          <Field label={t("Xarajat")} optional>
            <MoneyField value={cost} onChange={setCost} compact />
          </Field>
        </div>
        {!row && (
          <Field
            label={t("Kod")}
            optional
            hint={t("bo'sh qolsa o'zi tanlanadi, masalan FLY-12")}
          >
            <TextInput
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9-]/g, "")
                    .slice(0, 16),
                )
              }
              placeholder="FLY-12"
              className="font-mono"
            />
          </Field>
        )}
      </div>
    </V2Dialog>
  );
}
