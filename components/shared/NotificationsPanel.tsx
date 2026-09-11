"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { SOURCE_LABELS } from "@/constants/notifications";
import { relativeUz, styleOf, type NotifKind } from "@/lib/notifications";
import { SpinnerBlock } from "@/components/ui/Spinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useNotifications } from "@/components/shared/NotificationsProvider";

// Qo'ng'iroq panelining GAVDASI (sarlavhasiz) — desktop ochiluvchi menyu ham,
// mobil chekma menyu ham shuni chizadi. Ikkalasi bitta daraxtdan foydalanadi,
// faqat zichligi farq qiladi.

const KINDS: NotifKind[] = ["payment", "order", "task"];

/**
 * Zichlik. 400px li ochiluvchi menyuning belgilari 375px li chekma menyuga
 * o'z holicha ko'chirilsa qatorlar uch barobar balandlashib, ichki
 * to'ldirishdan toshib ketardi.
 */
const DENSITY = {
  dropdown: {
    row: "px-4 py-3",
    icon: "h-9 w-9",
    title: "text-sm",
    body: "text-xs",
    meta: "text-[11px]",
    box: "max-h-[440px]",
    empty: "py-16 px-6",
  },
  drawer: {
    row: "px-3 py-2",
    icon: "h-7 w-7",
    title: "text-[12px]",
    body: "text-[11px]",
    meta: "text-[10px]",
    box: "max-h-[320px]",
    empty: "py-8 px-3",
  },
} as const;

export interface NotificationsPanelProps {
  variant: "dropdown" | "drawer";
  /** Panel shu sirtda ochiqmi — ro'yxatni muzlatish va o'qilgan belgisi uchun. */
  open: boolean;
  /** Qatorga bosilganda sirtni yopish. */
  onNavigate: () => void;
}

export default function NotificationsPanel({ variant, open, onNavigate }: NotificationsPanelProps) {
  const { items, sources, status, everLoaded, nowMs, reload, setPanelOpen, markSeen, markAllSeen } =
    useNotifications();
  const D = DENSITY[variant];

  /**
   * Ochilgan LAHZADAGI o'qilmaganlar to'plami.
   *
   * Nishon darhol so'nadi, lekin qaysi qatorlar yangi ekani panel yopilguncha
   * ko'rinib turishi kerak — aks holda foydalanuvchi nimani o'qiganini bilmay
   * qolardi.
   *
   * RENDER PAYTIDA hisoblanadi, effektda emas: "ochildi" — bu tashqi tizim
   * bilan sinxronizatsiya emas, `open` o'zgarishiga moslanadigan holat
   * (React'ning "adjusting state when a prop changes" naqshi). Effektda
   * qilinsa panel avval eskirgan to'plam bilan bir marta chizilib, keyin
   * qayta render bo'lardi.
   */
  const [snap, setSnap] = useState<{ open: boolean; ids: Set<string> }>({ open: false, ids: new Set() });
  if (open !== snap.open) {
    setSnap({ open, ids: open ? new Set(items.filter((it) => it.unread).map((it) => it.id)) : snap.ids });
  }
  const wasNew = snap.ids;

  useEffect(() => {
    if (!open) return;
    // Provider'ga xabar: panel ochiq ekan ro'yxat siljimasin va o'qilgan
    // kursori surilsin. Ikkalasi ham TASHQI holat — shu bois effektda.
    setPanelOpen(true);
    markSeen();
    return () => setPanelOpen(false);
    // `markSeen` ATAYIN bog'liqlikda emas: u `items` o'zgarganda qayta
    // yaratiladi va har so'rovdan keyin kursorni qayta surib yuborardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!everLoaded && status === "loading") {
    return <div className={D.box}><SpinnerBlock size={20} /></div>;
  }

  /**
   * Xato qatori.
   *
   * Chekma menyuda `ErrorBanner` ISHLATILMAYDI: u bir qatorli `flex` bo'lib,
   * matn va "Qayta urinish" tugmasini yonma-yon qo'yadi. 256px li menyuda
   * (ichki to'ldirishdan keyin 232px) tugma o'z ramkasidan ~25px tashqariga
   * chiqib, menyu chekkasidan oshib ketardi — o'lchandi. Shu bois tor
   * variantda matn va tugma ustma-ust turadi.
   */
  const errorRow = (message: string) =>
    variant === "drawer" ? (
      <div
        role="alert"
        className="m-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-600 dark:text-rose-400"
      >
        <div>{message}</div>
        <button
          type="button"
          onClick={reload}
          className="mt-1.5 w-full rounded-md border border-rose-500/30 px-2 py-1 text-[11px] font-medium hover:bg-rose-500/10"
        >
          Qayta urinish
        </button>
      </div>
    ) : (
      <div className="p-3">
        <ErrorBanner message={message} onRetry={reload} />
      </div>
    );

  if (!everLoaded && status === "error") {
    return errorRow("Bildirishnomalarni yuklab bo'lmadi");
  }

  // O'qilmagani EKRANDAGIDAN ko'p bo'lgan manbalar.
  //
  // Shart `capped` EMAS: `capped` faqat SKANERLASH chegarasida (100 qator)
  // yonadi, ro'yxatni esa KO'RSATISH chegarasi (manba boshiga 8) qisqartiradi.
  // O'lchangan holat: nishon 59 (24 to'lov + 35 buyurtma), ro'yxatda 16 qator,
  // va hech narsa farqni tushuntirmasdi. Bundan ham yomoni — panel ochilganda
  // o'sha 59 tasi ham o'qilgan bo'lib ketardi, ya'ni ko'rilmagan 43 yozuv
  // jimgina yutilardi. Tamg'a "eng yangi 8 tasini ko'rdim" degan gapni
  // ifodalay olmaydi, shuning uchun bunday manba faqat TUGMA bilan yopiladi.
  const hidden = sources
    ? KINDS.filter((k) => sources[k].state === "on" && sources[k].unread > sources[k].shown)
    : [];
  const onKinds = sources ? KINDS.filter((k) => sources[k].state === "on") : [];
  const noCashbox = sources?.payment.state === "no-cashbox";

  return (
    <div className={`${D.box} overflow-y-auto`}>
      {/* Xato bo'lsa ham oxirgi yaxshi ro'yxat QOLADI — banner uning ustida
          turadi. Ma'lumotni saqlab, keyin uni yashirish o'ziga zid bo'lardi. */}
      {status === "error" && errorRow("Bildirishnomalarni yangilab bo'lmadi")}

      {hidden.map((k) => (
        <div key={k} className="border-b border-border bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          Ko&apos;rilmagan {SOURCE_LABELS[k]} — {sources?.[k].unread}
          {sources?.[k].capped ? "+" : ""} ta, bu yerda faqat oxirgi {sources?.[k].shown} tasi.
          {/* FAQAT shu manba — tugma o'zi turgan banner nima haqida gapirsa,
              o'shani yopadi. Ilgari ikkala banner tugmasi ham hamma manbani
              tozalardi, ya'ni to'lov banneridagi tugma buyurtmalarni ham
              jimgina o'qilgan qilib qo'yardi. */}
          <button
            type="button"
            onClick={() => markAllSeen(k)}
            className="ml-1 font-medium underline underline-offset-2 hover:no-underline"
          >
            O&apos;qilgan deb belgilash
          </button>
        </div>
      ))}

      {items.length === 0 ? (
        <div className={`flex flex-col items-center justify-center text-center ${D.empty}`}>
          <div className="text-muted-foreground mb-2">
            <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <use href="#i-frown" />
            </svg>
          </div>
          {/* Bo'sh holat FAQAT so'ralgan manbalar haqida gapiradi. "Bildirishnoma
              yo'q" deyish ruxsati yo'q xodim uchun yolg'on bo'lardi — u yerda
              yozuv bo'lishi mumkin, biz qaramadik. */}
          {onKinds.length === 0 ? (
            <>
              <div className="text-base font-medium">Sizda bildirishnoma manbalari yo&apos;q</div>
              <div className="mt-1 text-xs text-muted-foreground">
                To&apos;lov, buyurtma va topshiriq bo&apos;limlariga ruxsatingiz yo&apos;q.
              </div>
            </>
          ) : (
            <>
              <div className="text-base font-medium">Hozircha bildirishnoma yo&apos;q</div>
              <div className="mt-1 text-xs text-muted-foreground">
                So&apos;nggi 7 kunda {onKinds.map((k) => SOURCE_LABELS[k]).join(", ")} yo&apos;q.
              </div>
            </>
          )}
          {noCashbox && (
            <div className="mt-1 text-xs text-muted-foreground">
              Sizga biriktirilgan kassa yo&apos;q.
            </div>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n) => {
            // QO'RIQCHILI qidiruv. Eski panel `NOTIF_STYLES[n.type].bg` ni
            // to'g'ridan-to'g'ri o'qirdi va serverdan kelgan bitta notanish
            // tur butun navbarni yiqitardi.
            const s = styleOf(n.kind);
            const isNew = wasNew.has(n.id);
            return (
              <li key={n.id} className={isNew ? "bg-primary/5" : ""}>
                <Link
                  href={n.href}
                  onClick={onNavigate}
                  className={`flex items-start gap-3 ${D.row} hover:bg-secondary`}
                >
                  <div className={`flex ${D.icon} shrink-0 items-center justify-center rounded-full ${s.bg} ${s.text}`}>
                    <svg className="icon icon-sm"><use href={`#${s.icon}`} /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`${D.title} font-medium truncate`}>{n.title}</div>
                      {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    </div>
                    <div className={`${D.body} text-muted-foreground line-clamp-2 mt-0.5`}>{n.body}</div>
                    {/* Topshiriqda muddat, qolganlarida nisbiy vaqt. */}
                    <div className={`${D.meta} text-muted-foreground mt-1`}>
                      {n.meta ?? relativeUz(n.at, nowMs)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
