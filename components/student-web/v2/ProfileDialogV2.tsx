"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import type { StudentMe } from "@/components/student-web/types";
import { fmtSom, initials } from "./bits";

// «MENING MA'LUMOTLARIM» — eski kabinetdagi «Profil» va «Manzil» tablari
// o'rniga (yangi kabinetda alohida tab yo'q, ism menyusidan ochiladi).
// FAQAT KO'RISH: o'quvchi kabinetida birorta ham yozish so'rovi yo'q.

/** «901234567» → «+998 90 123 45 67»; tanish shaklda bo'lmasa — o'zi. */
export function fmtPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d.length === 9 ? d : "";
  if (!local) return raw || "";
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/** «2012-04-18» → «18.04.2012». */
function dmy(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  return y && m && d ? `${d.slice(0, 2)}.${m}.${y}` : iso;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-v2-border py-2.5 last:border-0">
      <span className="shrink-0 text-v2-small text-v2-text-2">{label}</span>
      <span className="min-w-0 break-words text-right text-v2-body font-medium text-v2-text">{value}</span>
    </div>
  );
}

export default function ProfileDialogV2({ me, paidTotal, onClose }: { me: StudentMe; paidTotal: number; onClose: () => void }) {
  const { t } = useT();
  const p = me.profile;
  const roleLabel = p.role === "parent" ? t("Ota-ona sifatida") : t("O'quvchi");

  return (
    <V2Dialog
      title={t("Mening ma'lumotlarim")}
      subtitle={t("Faqat ko'rish uchun — o'zgartirish kerak bo'lsa o'quv markaziga murojaat qiling")}
      onClose={onClose}
      width={480}
      footerStart={<span />}
      footer={(api) => (
        <button type="button" onClick={api.close} className={`${secondaryBtn} justify-center`}>
          {t("Yopish")}
        </button>
      )}
    >
      <div className="flex items-center gap-3 rounded-v2-md bg-v2-surface-2 p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand text-v2-body font-semibold text-v2-on-brand">
          {initials(p.fullName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-v2-section text-v2-text">{p.fullName}</span>
          <span className="block truncate text-v2-small text-v2-text-2">{[roleLabel, p.branch].filter(Boolean).join(" · ")}</span>
        </span>
      </div>

      <div className="mt-3">
        <Row label={t("F.I.O.")} value={p.fullName} />
        <Row label={t("Filial")} value={p.branch || "—"} />
        <Row label={t("Holat")} value={p.status ? t(p.status) : "—"} />
        {p.category ? <Row label={t("Kategoriya")} value={t(p.category)} /> : null}
        {p.birthDate ? <Row label={t("Tug'ilgan sana")} value={dmy(p.birthDate)} /> : null}
        <Row
          label={t("Telefon")}
          value={
            p.phone ? (
              <span className="tabular-nums">{fmtPhone(p.phone)}</span>
            ) : (
              "—"
            )
          }
        />
        <Row label={t("Jami to'lov")} value={<span className="tabular-nums">{`${fmtSom(paidTotal)} ${t("so'm")}`}</span>} />
        {me.groups.length > 0 ? <Row label={t("Guruhlar")} value={String(me.groups.length)} /> : null}
      </div>

      <h3 className="mb-2 mt-4 text-v2-small font-semibold text-v2-text">{t("Manzillar")}</h3>
      {me.addresses.length === 0 ? (
        <p className="rounded-v2-md bg-v2-surface-2 px-3 py-2.5 text-v2-small text-v2-text-3">{t("Manzil kiritilmagan.")}</p>
      ) : (
        <ul className="space-y-1.5">
          {me.addresses.map((a) => (
            <li key={a.id} className="flex items-start gap-2.5 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className="block break-words text-v2-body text-v2-text">{a.name}</span>
                {a.type ? <span className="block text-v2-caption text-v2-text-3">{t(a.type)}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </V2Dialog>
  );
}
