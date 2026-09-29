"use client";

import { useState } from "react";
import { ExternalLink, LocateFixed, MapPin } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import type { TurnstileLocation } from "@/lib/turnstileIo";

// «Ishga keldim» (QR) JOYLASHUVI — CRM'dagi ko'rinishi (29.09.2026).
//
// Jadval katagida ixcham belgi: filialgacha masofa (yashil — radius ichida,
// ya'ni qabul qilingan) va manzil. Bosilsa — oyna: to'liq manzil, aniqlik,
// koordinata va xarita. Xarita — Yandex vidjeti (kalitsiz iframe), manzil —
// OpenStreetMap'dan (lib/geo.ts, 29.09.2026; oynada manba ko'rsatiladi).
//
// Xaritada FAQAT skanerlangan nuqta: vidjet belgi rangini (`pm2rdl` …)
// qabul qilmaydi — ikki nuqta bir xil ko'k chiqib, qaysi biri filial
// ekanini ajratib bo'lmasdi (29.09.2026 da brauzerda ko'rildi). Filialgacha
// masofa yuqoridagi belgida yoziladi.

const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

function mapWidgetUrl(loc: TurnstileLocation): string {
  return `https://yandex.ru/map-widget/v1/?ll=${loc.lng}%2C${loc.lat}&z=17&pt=${loc.lng}%2C${loc.lat}`;
}

function mapLink(loc: TurnstileLocation): string {
  return `https://yandex.uz/maps/?pt=${loc.lng},${loc.lat}&z=17&l=map`;
}

/** Jadval katagi / ro'yxat qatori uchun ixcham belgi. */
export function LocationChip({
  loc,
  person,
  when,
  compact = false,
}: {
  loc: TurnstileLocation | null | undefined;
  /** Oyna sarlavhasi uchun: kim. */
  person?: string;
  /** Oyna sarlavhasi uchun: qachon ("28.09.2026 · 08:52"). */
  when?: string;
  /** Faqat masofa (tor joylar — QR ekrani ro'yxati). */
  compact?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!loc) return <span className="text-muted-foreground">—</span>;

  const onSite = loc.distanceM !== null;
  const label = loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={loc.text}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[12px] transition-colors ${
          onSite
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200"
            : "border-border bg-secondary/40 text-foreground/80 hover:bg-secondary"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        {onSite && <span className="shrink-0 font-semibold tabular-nums">{fmtDistance(loc.distanceM as number)}</span>}
        {!compact && <span className="min-w-0 truncate text-foreground/70">{label}</span>}
        {compact && !onSite && <span className="shrink-0">{t("Xarita")}</span>}
      </button>
      {open && <LocationModal loc={loc} person={person} when={when} onClose={() => setOpen(false)} />}
    </>
  );
}

function LocationModal({
  loc,
  person,
  when,
  onClose,
}: {
  loc: TurnstileLocation;
  person?: string;
  when?: string;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal
      onClose={onClose}
      title={t("Skanerlangan joy")}
      subtitle={[person, when].filter(Boolean).join(" · ") || undefined}
      size="2xl"
      bodyClassName="p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">
            {loc.address || t("Manzil aniqlanmadi")}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
            {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
            {/* Manzil OpenStreetMap'dan — ODbL litsenziyasi manbani ko'rsatishni talab qiladi. */}
            {loc.address && (
              <>
                {" · "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {t("Manzil: © OpenStreetMap hissadorlari")}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {loc.distanceM !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
            <MapPin className="h-3.5 w-3.5" />
            {t("Filialdan {d}", { d: fmtDistance(loc.distanceM) })}
          </span>
        )}
        {loc.acc !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[12px] font-medium text-foreground/80">
            <LocateFixed className="h-3.5 w-3.5" />
            {t("Aniqlik ±{m} m", { m: loc.acc })}
          </span>
        )}
        {loc.distanceM === null && (
          <span className="inline-flex items-center rounded-full bg-amber-500/12 px-3 py-1 text-[12px] font-medium text-amber-700 dark:text-amber-300">
            {t("Filial joylashuvi kiritilmagan — masofa o'lchanmagan")}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
        <iframe
          title={t("Xarita")}
          src={mapWidgetUrl(loc)}
          className="block h-72 w-full"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {t("Xaritadagi belgi — xodim skanerlagan joy")}
        </span>
        <a
          href={mapLink(loc)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-secondary"
        >
          <ExternalLink className="h-4 w-4" />
          {t("Yandex xaritada ochish")}
        </a>
      </div>
    </Modal>
  );
}
