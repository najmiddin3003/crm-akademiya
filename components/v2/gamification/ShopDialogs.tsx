"use client";

import { useEffect, useState } from "react";
import { Check, History, Loader2, Undo2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { gamApi } from "@/components/gamification/api";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, fieldCls } from "@/components/v2/form/fields";
import { fmtSum } from "@/components/v2/employees/employeeBits";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { EmptyBlock, SegTabs, ToneBadge, secondarySm, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { CoinValue, uzParts } from "./gamBits";
import type { HistoryRow, ReqRow } from "./shopTypes";

// YANGI VERSIYA — DO'KON OYNALARI (24.10.2026): so'rovni rad etish (sabab majburiy),
// chegirma so'rovini tasdiqlash (qaysi kurs to'loviga) va «Tarix» (o'ng tomondan).

const dangerBtn =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-v2-md bg-v2-danger px-4 text-v2-body font-semibold text-v2-on-danger transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-60";
const brandBtn =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-60";

/* ── Rad etish ─────────────────────────────────────────────────────── */

export function RejectDialog({ row, onClose, onDone }: { row: ReqRow; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const text = reason.trim();
    if (!text) {
      setErr(t("Rad etish sababini yozing"));
      return;
    }
    setSaving(true);
    const res = await gamApi<object>("/api/gamification/shop/requests/reject", { method: "POST", body: { pupilId: row.pupilId, itemId: row.itemId, reason: text } });
    setSaving(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone();
    modal.close();
  }

  return (
    <V2Dialog
      title={t("So'rovni rad etish")}
      subtitle={`${row.pupilName} · ${t(row.title)}`}
      onClose={onClose}
      controller={modal}
      dirty={!!reason.trim()}
      saving={saving}
      onSubmit={() => void submit()}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={dangerBtn}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {t("Rad etish")}
          </button>
        </>
      )}
    >
      <Field label={t("Sabab")} htmlFor="reject-reason" error={err || undefined} hint={t("O'quvchi sababni kabinetida ko'radi, tanga joyida qoladi.")}>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (err) setErr("");
          }}
          maxLength={300}
          rows={3}
          placeholder={t("Masalan: omborda qolmadi, keyingi oy keladi")}
          className={`${fieldCls(err ? "error" : "default")} h-auto! min-h-[5.5rem] resize-y py-2`}
        />
      </Field>
    </V2Dialog>
  );
}

/* ── Chegirma so'rovi: qaysi kurs to'loviga ─────────────────────────── */

interface DiscountOption {
  groupId: number;
  label: string;
  monthlyPrice: number;
  amount: number;
  error: string | null;
}

export function DiscountApproveDialog({ row, onClose, onDone }: { row: ReqRow; onClose: () => void; onDone: (res: { levelUp: { name: string } | null; badges: { name: string }[] }) => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const modal = useModalClose(onClose, "center");
  const [data, setData] = useState<{ month: string; options: DiscountOption[] } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [pick, setPick] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    gamApi<{ month: string; options: DiscountOption[] }>(`/api/gamification/shop/discount-options?pupilId=${row.pupilId}`).then((res) => {
      if (off) return;
      if (!res.ok) {
        setLoadErr(t(res.error));
        return;
      }
      setData({ month: res.month, options: res.options });
      const first = res.options.find((o) => !o.error);
      if (first) setPick(first.groupId);
    });
    return () => {
      off = true;
    };
  }, [row.pupilId, t]);

  async function submit() {
    if (pick === null) {
      setErr(t("Kursni tanlang"));
      return;
    }
    setSaving(true);
    const res = await gamApi<{ levelUp: { name: string } | null; badges: { name: string }[] }>("/api/gamification/shop/requests/approve", {
      method: "POST",
      body: { pupilId: row.pupilId, itemId: row.itemId, groupId: pick },
    });
    setSaving(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone(res);
    modal.close();
  }

  return (
    <V2Dialog
      title={t("Chegirmani tasdiqlash")}
      subtitle={`${row.pupilName} · ${t(row.title)}`}
      onClose={onClose}
      controller={modal}
      saving={saving}
      onSubmit={() => void submit()}
      width={500}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving || pick === null} className={brandBtn}>
            {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
            {t("Tasdiqlash")}
          </button>
        </>
      )}
    >
      {loadErr ? (
        <p className="text-v2-small text-v2-danger">{loadErr}</p>
      ) : !data ? (
        <div className="space-y-2" aria-busy>
          <div className="h-12 rounded-v2-md bg-v2-skeleton" />
          <div className="h-12 rounded-v2-md bg-v2-skeleton" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-v2-small text-v2-text-2">{t("Chegirma {month} oyi to'loviga qo'llanadi — kursni tanlang.", { month: fmt.monthLower(data.month) })}</p>
          <div role="radiogroup" aria-label={t("Kurs")} className="space-y-1.5">
            {data.options.map((o) => {
              const on = pick === o.groupId;
              return (
                <button
                  key={o.groupId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!!o.error}
                  title={o.error ? t(o.error) : undefined}
                  onClick={() => {
                    setPick(o.groupId);
                    setErr("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-v2-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border hover:bg-v2-surface-2"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-v2-small font-semibold text-v2-text">{o.label}</span>
                    <span className="block text-v2-caption text-v2-text-2">
                      {o.error ? t(o.error) : t("{price} so'm/oy · chegirma {amount} so'm", { price: fmtSum(o.monthlyPrice), amount: fmtSum(o.amount) })}
                    </span>
                  </span>
                  {on && <Check className="size-4 shrink-0 text-v2-brand-text" strokeWidth={2.25} aria-hidden />}
                </button>
              );
            })}
            {data.options.length === 0 && <p className="text-v2-small text-v2-text-2">{t("Faol kursi yo'q")}</p>}
          </div>
          {err && <p className="text-v2-caption text-v2-danger">{err}</p>}
        </div>
      )}
    </V2Dialog>
  );
}

/* ── Tarix ─────────────────────────────────────────────────────────── */

type HistFilter = "all" | "handed" | "rejected" | "returned";

const STATUS_TONE: Record<HistoryRow["status"], { label: string; badge: string; dot: string }> = {
  handed: { label: "Topshirildi", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  // Eski «Berish» — o'sha payt qo'lga berilgan, ya'ni ham topshirilgan.
  given: { label: "Topshirildi", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  rejected: { label: "Rad etildi", badge: "bg-v2-danger-bg text-v2-danger", dot: "bg-v2-danger" },
  returned: { label: "Qaytarildi", badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
};

export function HistoryDrawer({ onClose, onReturn, version }: { onClose: () => void; onReturn: (r: HistoryRow) => void; version: number }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<HistFilter>("all");

  useEffect(() => {
    let off = false;
    gamApi<{ rows: HistoryRow[] }>("/api/gamification/shop/requests/history?days=90").then((res) => {
      if (off) return;
      if (res.ok) setRows(res.rows);
      else setErr(t(res.error));
    });
    return () => {
      off = true;
    };
  }, [t, version]);

  const list = (rows ?? []).filter((r) => filter === "all" || (filter === "handed" ? r.status === "handed" || r.status === "given" : r.status === filter));
  const when = (s: string) => {
    const { iso, hm } = uzParts(s);
    return iso ? fmt.stamp(iso, hm || undefined) : "—";
  };

  return (
    <V2Dialog
      variant="right"
      title={t("Do'kon tarixi")}
      subtitle={t("Oxirgi 90 kun — topshirilgan, rad etilgan va qaytarilgan")}
      onClose={onClose}
      width={560}
      footerStart={<span />}
      footer={(api) => (
        <button type="button" onClick={api.close} className={secondaryBtn}>
          {t("Yopish")}
        </button>
      )}
    >
      <div className="mb-3">
        <SegTabs
          label={t("Holat")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("Hammasi") },
            { value: "handed", label: t("Topshirilgan") },
            { value: "rejected", label: t("Rad etilgan") },
            { value: "returned", label: t("Qaytarilgan") },
          ]}
        />
      </div>
      {err ? (
        <p className="text-v2-small text-v2-danger">{err}</p>
      ) : rows === null ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 rounded-v2-md bg-v2-skeleton" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyBlock icon={<History className="size-5" strokeWidth={1.75} />} title={t("Tarix bo'sh")} text={t("Bu davrda yozuv yo'q.")} />
      ) : (
        <ul className="divide-y divide-v2-border rounded-v2-lg border border-v2-border">
          {list.map((r) => {
            const tone = STATUS_TONE[r.status];
            return (
              <li key={r.key} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-v2-small font-semibold text-v2-text">{r.pupilName}</span>
                    <ToneBadge tone={tone}>{t(tone.label)}</ToneBadge>
                  </div>
                  <div className="mt-0.5 truncate text-v2-small text-v2-text-2">{t(r.title)}</div>
                  <div className="mt-0.5 text-v2-caption text-v2-text-3">
                    {when(r.at)}
                    {r.byName && ` · ${r.byName}`}
                    {r.branchName && ` · ${r.branchName}`}
                  </div>
                  {r.note && <div className="mt-1 text-v2-caption text-v2-text-2">{r.status === "rejected" ? t("Sabab: {note}", { note: r.note }) : t("Izoh: {note}", { note: t(r.note) })}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <CoinValue n={r.status === "rejected" ? r.price : `−${r.price}`} className={r.status === "returned" || r.status === "rejected" ? "opacity-60" : ""} />
                  {r.canReturn && (
                    <button type="button" onClick={() => onReturn(r)} className={`${secondarySm} h-7! px-2`}>
                      <Undo2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                      {t("Sovg'ani qaytarish")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </V2Dialog>
  );
}
