"use client";

import { Coins } from "lucide-react";
import { useT } from "@/components/shared/Language";
import StudentGame from "@/components/gamification/student/StudentGame";
import { Card, CardHead, Pill, fmtSom, useCabinetFmt, type CabinetTabProps } from "./bits";
import { PageHead, Pieces, StatStrip } from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «TANGA» TABI. Dizayn rasmi yo'q.
//   tepada: `cab.coins` xulosasi (balans, shu oyda, eng yaxshi o'rin, istak) —
//   gamifikatsiya o'chiq bo'lsa (`coins: null`) xulosa chiqmaydi;
//   ostida mavjud StudentGame (tangalar, daraja, istaklar, do'kon, reyting) —
//   eski kabinetdagi «Coin» tabi bilan AYNAN bir xil: o'z API'si (/api/me/tg)
//   shu `initData` bilan. Modul o'chiq bo'lsa StudentGame `fallback`ni chizadi —
//   eski «Coin» kartasi (pupils.coin) v2 uslubida.

export default function TangaTab({ me, cab, initData }: CabinetTabProps) {
  const { t, lang } = useT();
  const fmt = useCabinetFmt();
  const coins = cab.coins;
  const ym = cab.today.slice(0, 7);
  // Gap o'rtasida: o'zbekchada kichik harf («oktabr oyida»), inglizchada bosh harf.
  const monthName = lang === "en" ? fmt.monthName(ym) : fmt.monthLower(ym);

  return (
    <div className="space-y-4">
      <PageHead title={t("Tanga")} sub={[me.profile.fullName, t("tangalar, daraja va do'kon")].join(" · ")} />

      {coins ? (
        <StatStrip
          items={[
            { key: "bal", label: t("Balans"), value: t("{n} tanga", { n: fmtSom(coins.balance) }), sub: t("hozir hisobingizda") },
            {
              key: "month",
              label: t("Shu oyda"),
              value: coins.monthEarned > 0 ? `+${fmtSom(coins.monthEarned)}` : fmtSom(coins.monthEarned),
              sub: t("{month} oyida olingan tanga", { month: monthName }),
            },
            {
              key: "rank",
              label: t("Eng yaxshi o'rin"),
              value: coins.bestRank ? t("{rank}-o'rin", { rank: coins.bestRank.rank }) : "—",
              sub: coins.bestRank ? <Pieces items={[coins.bestRank.title, t("{n} o'quvchidan", { n: coins.bestRank.total })]} /> : t("reyting hali yo'q"),
            },
            {
              key: "wish",
              label: t("Istak"),
              value: coins.wish ? coins.wish.title : "—",
              sub: coins.wish ? (
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="whitespace-nowrap">{t("{n} tanga", { n: fmtSom(coins.wish.price) })}</span>
                  {coins.wish.ready ? (
                    <Pill tone="success">{t("Tanga yetadi")}</Pill>
                  ) : (
                    <Pill tone="neutral">{t("yana {n} tanga", { n: fmtSom(Math.max(0, coins.wish.price - coins.balance)) })}</Pill>
                  )}
                </span>
              ) : (
                t("istaklar ro'yxati bo'sh")
              ),
            },
          ]}
        />
      ) : null}

      <StudentGame
        source={{ kind: "tg", initData }}
        pupilId={me.profile.id}
        embedded
        fallback={
          <Card>
            <CardHead title={t("Tangalar")} icon={<Coins className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />} />
            <div className="py-3 text-center">
              <div className="text-v2-number tabular-nums text-v2-brand-text">{fmtSom(me.profile.coin)}</div>
              <p className="mx-auto mt-2 max-w-sm text-v2-small text-v2-text-3">
                {t("Koinlar faollik va yutuqlar uchun beriladi. Sarflash tartibi haqida ustozingizdan so'rang.")}
              </p>
            </div>
          </Card>
        }
      />
    </div>
  );
}
