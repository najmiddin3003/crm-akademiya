"use client";

import { ArrowRight, Check, Gift, Info, Inbox, Loader2, MoreHorizontal, PackageCheck, Undo2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import { EmptyBlock, secondarySm, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { CoinValue, GiftThumb, uzParts } from "./gamBits";
import type { AwaitRow, ReqRow, ReqView } from "./shopTypes";

// YANGI VERSIYA — DO'KON · SO'ROVLAR (rasm «Do'kon · So'rovlar», yorug'/qorong'i,
// 24.10.2026): izoh qatori; «Yangi so'rovlar» (o'quvchi · sovg'a · narx · balans → keyin ·
// so'rov vaqti · Rad etish / ✓ Tasdiqlash); «Topshirish kutilmoqda» (… · tasdiqlangan ·
// 🎁 Topshirildi); «Tarix: topshirilgan va rad etilganlar →». Amallar — ShopV2 da.

const th = "whitespace-nowrap bg-v2-surface-2 px-3 py-2.5 text-left text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

function Pupil({ name, group }: { name: string; group: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-v2-small font-semibold text-v2-text">{name}</span>
        {group && <span className="block truncate text-v2-caption text-v2-text-2">{group}</span>}
      </span>
    </span>
  );
}

function GiftCell({ title, name, kind, imageUrl, stockLeft }: { title: string; name: string; kind: string; imageUrl: string | null; stockLeft: number | null }) {
  const { t } = useT();
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <GiftThumb name={name} kind={kind} imageUrl={imageUrl} />
      <span className="min-w-0">
        <span className="block truncate text-v2-small font-semibold text-v2-text">{t(title)}</span>
        {stockLeft !== null && (
          <span className={`block text-v2-caption ${stockLeft > 0 ? "text-v2-text-2" : "text-v2-danger"}`}>{stockLeft > 0 ? t("qoldiq {n} ta", { n: stockLeft }) : t("omborda qolmagan")}</span>
        )}
      </span>
    </span>
  );
}

export default function ShopRequestsTab({
  req,
  busy,
  onApprove,
  onReject,
  onHandover,
  onReturn,
  onHistory,
}: {
  req: ReqView;
  busy: string | null;
  onApprove: (r: ReqRow) => void;
  onReject: (r: ReqRow) => void;
  onHandover: (o: AwaitRow) => void;
  onReturn: (o: AwaitRow) => void;
  onHistory: () => void;
}) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const when = (s: string) => {
    const { iso, hm } = uzParts(s);
    return iso ? fmt.stamp(iso, hm || undefined) : "—";
  };

  if (!req.canManage) {
    return (
      <div className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <EmptyBlock icon={<Inbox className="size-5" strokeWidth={1.75} />} title={t("So'rovlarni filial admini va direktor ko'rib chiqadi")} text={t("Sovg'alar ro'yxati «Sovg'alar» tabida.")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="note" className="flex items-start gap-2 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
        <Info className="mt-px size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
        <span>
          {t("Tasdiqlasangiz, tanga o'quvchi balansidan ayiriladi va sovg'a qoldig'i kamayadi. Rad etsangiz, sababini yozasiz — o'quvchi uni kabinetida ko'radi, tanga joyida qoladi.")}
        </span>
      </div>

      {/* ── Yangi so'rovlar ── */}
      <section aria-labelledby="req-new" className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
          <h2 id="req-new" className="flex items-baseline gap-2 text-v2-section text-v2-text">
            {t("Yangi so'rovlar")}
            <span className="text-v2-small font-normal text-v2-text-3">
              {req.requests.length > 0 ? t("{n} ta · eng eskisi pastda", { n: req.requests.length }) : t("{n} ta", { n: 0 })}
            </span>
          </h2>
          {req.waiting > 0 && <span className="text-v2-caption text-v2-text-2">{t("Yana {n} ta istak — tanga yetguncha kutadi", { n: req.waiting })}</span>}
        </div>
        {req.requests.length === 0 ? (
          <div className="border-t border-v2-border">
            <EmptyBlock
              icon={<Inbox className="size-5" strokeWidth={1.75} />}
              title={t("Yangi so'rov yo'q")}
              text={t("O'quvchi kabinetida sovg'aga ♡ bossa va tangasi yetsa, so'rov shu yerda chiqadi.")}
            />
          </div>
        ) : (
          <div className="relative overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[56rem] border-collapse text-v2-small">
              <thead>
                <tr>
                  <th className={`${th} pl-4`}>{t("O'quvchi")}</th>
                  <th className={th}>{t("Sovg'a")}</th>
                  <th className={th}>{t("Narx")}</th>
                  <th className={th}>{t("Balans, tanga")}</th>
                  <th className={th}>{t("So'rov vaqti")}</th>
                  <th className={`${th} sticky right-0 z-[1] pr-4`}>
                    <span className="sr-only">{t("Amallar")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {req.requests.map((r) => {
                  const rowBusy = busy === r.key;
                  return (
                    <tr key={r.key} className="border-b border-v2-border last:border-b-0">
                      <td className="py-2.5 pl-4 pr-3">
                        <Pupil name={r.pupilName} group={r.groupLabel} />
                      </td>
                      <td className="px-3 py-2.5">
                        <GiftCell title={r.title} name={r.name} kind={r.kind} imageUrl={r.imageUrl} stockLeft={r.stockLeft} />
                      </td>
                      <td className="px-3 py-2.5">
                        <CoinValue n={r.price} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                        <span className="inline-flex items-center gap-1.5 text-v2-text-2">
                          {r.balance}
                          <ArrowRight className="size-3.5 text-v2-text-3" strokeWidth={2} aria-hidden />
                          <b className="font-semibold text-v2-text">{r.after}</b>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-v2-text-2">{when(r.requestedAt)}</td>
                      <td className="sticky right-0 z-[1] bg-v2-surface py-2.5 pl-3 pr-4 max-[56rem]:shadow-[inset_1px_0_0_var(--v2-border)]">
                        <span className="flex items-center justify-end gap-2">
                          <button type="button" disabled={busy !== null} onClick={() => onReject(r)} className={secondarySm}>
                            {t("Rad etish")}
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null || !!r.error}
                            title={r.error ? t(r.error) : undefined}
                            onClick={() => onApprove(r)}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand px-3 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {rowBusy ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
                            {t("Tasdiqlash")}
                          </button>
                        </span>
                        {r.error && <span className="mt-1 block text-right text-v2-caption text-v2-danger">{t(r.error)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Topshirish kutilmoqda ── */}
      <section aria-labelledby="req-await" className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
          <h2 id="req-await" className="flex items-baseline gap-2 text-v2-section text-v2-text">
            {t("Topshirish kutilmoqda")}
            <span className="text-v2-small font-normal text-v2-text-3">
              {req.awaiting.length > 0 ? t("{n} ta · tanga ayirilgan", { n: req.awaiting.length }) : t("{n} ta", { n: 0 })}
            </span>
          </h2>
          <button type="button" onClick={onHistory} className="inline-flex items-center gap-1 text-v2-small text-v2-text-2 hover:text-v2-text">
            {t("Tarix:")} <span className="font-semibold text-v2-brand-text">{t("topshirilgan va rad etilganlar")}</span>
            <ArrowRight className="size-3.5 text-v2-brand-text" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {req.awaiting.length === 0 ? (
          <div className="border-t border-v2-border">
            <EmptyBlock icon={<PackageCheck className="size-5" strokeWidth={1.75} />} title={t("Topshirilishi kutilayotgan sovg'a yo'q")} text={t("Tasdiqlangan sovg'a o'quvchiga berilgach, «Topshirildi» bosiladi.")} />
          </div>
        ) : (
          <div className="relative overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[48rem] border-collapse text-v2-small">
              <thead>
                <tr>
                  <th className={`${th} pl-4`}>{t("O'quvchi")}</th>
                  <th className={th}>{t("Sovg'a")}</th>
                  <th className={th}>{t("Narx")}</th>
                  <th className={th}>{t("Tasdiqlangan")}</th>
                  <th className={`${th} sticky right-0 z-[1] pr-4`}>
                    <span className="sr-only">{t("Amallar")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {req.awaiting.map((o) => {
                  const rowBusy = busy === `o${o.orderId}`;
                  return (
                    <tr key={o.orderId} className="border-b border-v2-border last:border-b-0">
                      <td className="py-2.5 pl-4 pr-3">
                        <Pupil name={o.pupilName} group={o.groupLabel} />
                      </td>
                      <td className="px-3 py-2.5">
                        <GiftCell title={o.title} name={o.name} kind={o.kind} imageUrl={o.imageUrl} stockLeft={o.stockLeft} />
                      </td>
                      <td className="px-3 py-2.5">
                        <CoinValue n={o.price} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-v2-text-2" title={o.approvedByName ? t("Tasdiqladi: {name}", { name: o.approvedByName }) : undefined}>
                        {when(o.approvedAt)}
                      </td>
                      <td className="sticky right-0 z-[1] bg-v2-surface py-2.5 pl-3 pr-4 max-[56rem]:shadow-[inset_1px_0_0_var(--v2-border)]">
                        <span className="flex items-center justify-end gap-1.5">
                          <button type="button" disabled={busy !== null} onClick={() => onHandover(o)} className={secondarySm}>
                            {rowBusy ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Gift className="size-4" strokeWidth={1.75} aria-hidden />}
                            {t("Topshirildi")}
                          </button>
                          {o.canReturn && (
                            <ActionMenu
                              label={t("{name} — amallar", { name: o.pupilName })}
                              width={248}
                              items={[{ key: "ret", label: t("Bekor qilish — tanga qaytadi"), icon: Undo2, danger: true, onSelect: () => onReturn(o) }]}
                            >
                              {(trigger, open) => (
                                <button
                                  type="button"
                                  {...trigger}
                                  title={t("Amallar")}
                                  aria-label={t("Amallar")}
                                  className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2" : ""}`}
                                >
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                            </ActionMenu>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
