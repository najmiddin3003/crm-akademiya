"use client";

import { useState } from "react";
import { ExternalLink, LocateFixed, MapPin } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import type { TurnstileLocation } from "@/lib/turnstileIo";

// YANGI VERSIYA — «Ishga keldim» JOYLASHUVI katagi va oynasi (Turniket kirish-chiqish analitikasi, 28-qism).
// Mazmuni eski components/shared/AttendanceLocation.tsx (LocationChip + oyna) bilan bir xil: filialgacha masofa
// (radius ichida — yashil), manzil, aniqlik, koordinata, xarita (o'sha kalitsiz vidjet) va «Yandex xaritada
// ochish». Faqat ko'rinish yangi tokenlarda; oyna — V2Dialog (faqat ko'rish, pastki qatorsiz).

const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

function mapWidgetUrl(loc: TurnstileLocation): string {
  return `https://yandex.ru/map-widget/v1/?ll=${loc.lng}%2C${loc.lat}&z=17&pt=${loc.lng}%2C${loc.lat}`;
}

/** «Bu yerda nima?» rejimi — xarita nuqtaning manzil kartochkasi bilan ochiladi. */
function mapLink(loc: TurnstileLocation): string {
  const p = `${loc.lng}%2C${loc.lat}`;
  return `https://yandex.uz/maps/?ll=${p}&z=17&mode=whatshere&whatshere%5Bpoint%5D=${p}&whatshere%5Bzoom%5D=17`;
}

export function NazoratTurnstileLocationChip({ loc, person, when }: { loc: TurnstileLocation | null | undefined; person?: string; when?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!loc) return <span className="text-v2-text-3">—</span>;

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
        aria-label={`${t("Xarita")}: ${label}`}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-v2-md border px-2 py-1 text-left text-v2-small transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
          onSite ? "border-v2-success/30 bg-v2-success-bg text-v2-success hover:brightness-95" : "border-v2-border bg-v2-surface-2 text-v2-text-2 hover:bg-v2-hover"
        }`}
      >
        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {onSite && <span className="shrink-0 font-semibold tabular-nums">{fmtDistance(loc.distanceM as number)}</span>}
        <span className="min-w-0 truncate text-v2-text-2">{label}</span>
      </button>
      {open && <LocationDialog loc={loc} person={person} when={when} onClose={() => setOpen(false)} />}
    </>
  );
}

function LocationDialog({ loc, person, when, onClose }: { loc: TurnstileLocation; person?: string; when?: string; onClose: () => void }) {
  const { t } = useT();
  return (
    <V2Dialog title={t("Skanerlangan joy")} subtitle={[person, when].filter(Boolean).join(" · ") || undefined} onClose={onClose} width={720}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
            <MapPin className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-v2-text">{loc.address || t("Manzil aniqlanmadi")}</p>
            <p className="mt-0.5 text-v2-small tabular-nums text-v2-text-2">
              {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
              {/* Manzil OpenStreetMap'dan — ODbL litsenziyasi manbani ko'rsatishni talab qiladi. */}
              {loc.address && (
                <>
                  {" · "}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {t("Manzil: © OpenStreetMap hissadorlari")}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {loc.distanceM !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-v2-full bg-v2-success-bg px-3 py-1 text-v2-small font-medium text-v2-success">
              <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Filialdan {d}", { d: fmtDistance(loc.distanceM) })}
            </span>
          )}
          {loc.acc !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-v2-full bg-v2-surface-2 px-3 py-1 text-v2-small font-medium text-v2-text-2">
              <LocateFixed className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Aniqlik ±{m} m", { m: loc.acc })}
            </span>
          )}
          {loc.distanceM === null && (
            <span className="inline-flex items-center rounded-v2-full bg-v2-warning-bg px-3 py-1 text-v2-small font-medium text-v2-warning">
              {t("Filial koordinatasi kiritilmagan — filialgacha masofa o'lchanmadi")}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-v2-md border border-v2-border bg-v2-surface-2">
          <iframe title={t("Xarita")} src={mapWidgetUrl(loc)} className="block h-72 w-full" loading="lazy" referrerPolicy="no-referrer" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-v2-small text-v2-text-2">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("Xaritadagi belgi — xodim skanerlagan joy")}
          </span>
          <a href={mapLink(loc)} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
            <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Yandex xaritada ochish")}
          </a>
        </div>
      </div>
    </V2Dialog>
  );
}
