"use client";

import { CircleAlert, Copy, MessageSquare, MoreHorizontal, Pencil, Phone, Plus, TriangleAlert, Wallet } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import { fmtSum, initialsOf } from "@/components/v2/employees/employeeBits";
import { prefetchStudentPayment } from "@/components/v2/finance/StudentPaymentModalV2";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import type { PupilProfilePayload } from "@/lib/pupilProfile";
import type { Ledger } from "./profileLedger";
import { ageOf, borderIcon, linkBtn, phoneParts, pupilTone, toIso, ToneBadge, type ProfileFmt } from "./profileBits";

// YANGI VERSIYA — O'QUVCHI SAHIFASINING CHAP KARTOCHKASI (rasm «O'quvchi sahifasi ·
// Umumiy», 23.10.2026): avatar, ism, holat belgisi («Aktiv» / «Yangi o'quvchi» …),
// «N guruh»; Balans | Tanga; «To'lov qabul qilish», SMS, Qo'ng'iroq, «⋯»;
// Ma'lumotlar («Tahrirlash»; tug'ilgan sana yo'q — «Kiritilmagan · Qo'shish»);
// Ota-ona (yo'q — izoh va «+ Ota-ona qo'shish»).
//
// BALANS = to'langan − to'lanishi kerak (joriy oygacha, profileLedger.ts qoidasi):
// qarz bo'lsa manfiy va «Qarzdorlik». O'quvchilar ro'yxatidagi «Balans» ustuni esa
// to'lovlar yig'indisi (SAVOLLAR 149).

export default function StudentSideCardV2({
  data,
  ledger,
  fmt,
  canPay,
  menu,
  onPay,
  onSms,
  onEdit,
}: {
  data: PupilProfilePayload;
  ledger: Ledger;
  fmt: ProfileFmt;
  canPay: boolean;
  menu: ActionMenuEntry[];
  onPay: () => void;
  onSms: () => void;
  /** Tahrirlash oynasi; `focus` — ochilganda shu bo'limga. */
  onEdit: (focus?: "birth" | "parents") => void;
}) {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess } = useToast();
  const p = data.pupil;
  const name = `${p.firstName} ${p.lastName}`.trim() || t("Nomsiz o'quvchi");
  const phone = phoneParts(p.phone);
  const extra = phoneParts(p.extraPhone);
  const currentGroups = data.groups.filter((g) => g.current).length;
  const tone = pupilTone(p.status, ledger.paymentsCount === 0);
  const balance = ledger.credit - ledger.debt;
  const birthIso = toIso(p.birthDate);
  const age = ageOf(birthIso, data.asOf);
  const createdIso = toIso(p.createdAt);
  const branchName = p.branchId !== null ? (branch.branches.find((b) => b.id === p.branchId)?.name ?? "") : "";
  const parents = [
    { key: "father", name: p.fatherName.trim(), phone: phoneParts(p.fatherPhone), role: t("otasi") },
    { key: "mother", name: p.motherName.trim(), phone: phoneParts(p.motherPhone), role: t("onasi") },
  ].filter((x) => x.name || x.phone);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    showSuccess(t("Nusxa olindi"));
  };

  const dt = "text-v2-text-2";
  const dd = "min-w-0 font-medium text-v2-text";
  const none = <span className="font-normal text-v2-text-3">—</span>;

  return (
    <aside aria-label={name} className="min-w-0 rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="space-y-3.5 p-4">
        {/* Sarlavha */}
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand-bg text-v2-body font-semibold text-v2-brand-text" aria-hidden>
            {initialsOf(name) || "?"}
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-[18px] font-semibold leading-6 text-v2-text">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <ToneBadge tone={tone} title={p.statusReason ? `${t("Sabab")}: ${p.statusReason}` : undefined}>
                {t(tone.label)}
              </ToneBadge>
              <span className="text-v2-small text-v2-text-2">{currentGroups > 0 ? t("{n} guruh", { n: currentGroups }) : t("guruhsiz")}</span>
            </div>
          </div>
        </div>

        {/* Balans | Tanga */}
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] divide-x divide-v2-border rounded-v2-md border border-v2-border">
          <div className="min-w-0 px-3 py-2.5">
            <div className="text-v2-caption text-v2-text-2">{t("Balans")}</div>
            {ledger.incomplete && ledger.priced === 0 ? (
              <div className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text-3" title={t("Kurs narxi belgilanmagan — balansni hisoblab bo'lmaydi")}>
                —
              </div>
            ) : (
              <div className={`mt-0.5 truncate text-[20px] font-semibold leading-7 tabular-nums ${balance < 0 ? "text-v2-danger" : "text-v2-text"}`}>
                {fmtSum(balance)} <span className="text-v2-small font-medium">{t("so'm")}</span>
              </div>
            )}
            {ledger.incomplete ? (
              <div className="mt-0.5 flex items-center gap-1 text-v2-caption font-medium text-v2-warning" title={t("Kurs narxi yoki jadvali to'liq emas")}>
                <TriangleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {t("hisob to'liq emas")}
              </div>
            ) : ledger.debt > 0 ? (
              <div className="mt-0.5 flex items-center gap-1 text-v2-caption font-medium text-v2-danger">
                <CircleAlert className="size-3.5" strokeWidth={2} aria-hidden />
                {t("Qarzdorlik")}
              </div>
            ) : ledger.credit > 0 ? (
              <div className="mt-0.5 text-v2-caption text-v2-success">{t("oldindan to'langan")}</div>
            ) : (
              <div className="mt-0.5 text-v2-caption text-v2-text-3">{ledger.paymentsCount === 0 ? t("to'lov hali yo'q") : t("qarz yo'q")}</div>
            )}
          </div>
          <div className="min-w-0 px-3 py-2.5">
            <div className="text-v2-caption text-v2-text-2">{t("Tanga")}</div>
            <div className="mt-0.5 text-[20px] font-semibold leading-7 tabular-nums text-v2-text">{fmtSum(data.coins)}</div>
            <div className="mt-0.5 text-v2-caption text-v2-text-3">{t("gamifikatsiya")}</div>
          </div>
        </div>

        {/* Amallar */}
        <div className="space-y-2">
          {canPay && (
            <button
              type="button"
              onClick={onPay}
              onPointerEnter={prefetchStudentPayment}
              onFocus={prefetchStudentPayment}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-v2-md bg-v2-brand px-3 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <Wallet className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("To'lov qabul qilish")}
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSms}
              disabled={!phone}
              title={phone ? undefined : t("Telefon raqam yo'q")}
              className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              SMS
            </button>
            {phone ? (
              <a
                href={`tel:${phone.tel}`}
                className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                <Phone className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="truncate">{t("Qo'ng'iroq")}</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                title={t("Telefon raqam yo'q")}
                className="inline-flex h-8 min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2 text-v2-small font-medium text-v2-text opacity-50"
              >
                <Phone className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="truncate">{t("Qo'ng'iroq")}</span>
              </button>
            )}
            <ActionMenu items={menu} label={t("{name} — amallar", { name })} width={260}>
              {(trigger) => (
                <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={borderIcon}>
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </ActionMenu>
          </div>
        </div>
      </div>

      {/* Ma'lumotlar */}
      <section className="border-t border-v2-border px-4 py-3.5" aria-label={t("Ma'lumotlar")}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-v2-small font-semibold text-v2-text">{t("Ma'lumotlar")}</h2>
          <button type="button" onClick={() => onEdit()} className={linkBtn}>
            <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("Tahrirlash")}
          </button>
        </div>
        <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-v2-small">
          <dt className={dt}>{t("Telefon")}</dt>
          <dd className={`${dd} flex items-center gap-1 tabular-nums`}>
            {phone ? (
              <>
                <span className="truncate">{phone.show}</span>
                <button
                  type="button"
                  onClick={() => copy(phone.copy)}
                  title={t("Nusxa olish")}
                  aria-label={t("Nusxa olish")}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 transition-colors hover:bg-v2-surface-2 hover:text-v2-text"
                >
                  <Copy className="size-3.5" strokeWidth={1.75} />
                </button>
              </>
            ) : (
              none
            )}
          </dd>
          {extra && (
            <>
              <dt className={dt}>{t("Qo'shimcha telefon")}</dt>
              <dd className={`${dd} tabular-nums`}>
                <a href={`tel:${extra.tel}`} className="hover:underline underline-offset-2">
                  {extra.show}
                </a>
              </dd>
            </>
          )}
          <dt className={dt}>{t("Tug'ilgan sana")}</dt>
          <dd className={dd}>
            {birthIso ? (
              <span className="tabular-nums">
                {fmt.ddmmyyyy(birthIso)}
                {age !== null && <span className="font-normal text-v2-text-3"> · {t("{n} yosh", { n: age })}</span>}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="font-normal text-v2-text-2">{t("Kiritilmagan")}</span>
                <button type="button" onClick={() => onEdit("birth")} className={linkBtn}>
                  {t("Qo'shish")}
                </button>
              </span>
            )}
          </dd>
          {p.category && (
            <>
              <dt className={dt}>{t("Kategoriya")}</dt>
              <dd className={`${dd} truncate`}>{t(p.category)}</dd>
            </>
          )}
          <dt className={dt}>{t("Filial")}</dt>
          <dd className={`${dd} truncate`}>{branchName || none}</dd>
          <dt className={dt}>{t("Manba")}</dt>
          <dd className={`${dd} truncate`}>{p.source ? t(p.source) : none}</dd>
          <dt className={dt}>{t("Qo'shilgan")}</dt>
          <dd className={`${dd} tabular-nums`}>{createdIso ? fmt.ddmmyyyy(createdIso) : none}</dd>
        </dl>
      </section>

      {/* Ota-ona */}
      <section className="border-t border-v2-border px-4 py-3.5" aria-label={t("Ota-ona")}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-v2-small font-semibold text-v2-text">{t("Ota-ona")}</h2>
          {parents.length > 0 && parents.length < 2 && (
            <button type="button" onClick={() => onEdit("parents")} className={linkBtn}>
              {t("Qo'shish")}
            </button>
          )}
        </div>
        {parents.length === 0 ? (
          <div className="rounded-v2-md border border-v2-border px-3 py-3">
            <p className="text-v2-small text-v2-text-2">
              {t("Ota-ona ma'lumoti kiritilmagan. Qarzdorlik va davomat haqida kimga xabar berishni shu yerdan bilasiz.")}
            </p>
            <button
              type="button"
              onClick={() => onEdit("parents")}
              className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2.5 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <Plus className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Ota-ona qo'shish")}
            </button>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {parents.map((x) => (
              <li key={x.key} className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                  {initialsOf(x.name || x.role) || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-v2-small font-semibold text-v2-text">{x.name || (x.key === "father" ? t("Otasi") : t("Onasi"))}</div>
                  <div className="truncate text-v2-caption tabular-nums text-v2-text-2">{[x.role, x.phone?.show].filter(Boolean).join(" · ")}</div>
                </div>
                {x.phone && (
                  <a href={`tel:${x.phone.tel}`} title={t("Qo'ng'iroq qilish")} aria-label={`${t("Qo'ng'iroq qilish")}: ${x.name || x.role}`} className={borderIcon}>
                    <Phone className="size-4" strokeWidth={1.75} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
