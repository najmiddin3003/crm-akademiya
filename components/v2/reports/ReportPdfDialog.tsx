"use client";

import { useMemo, useState } from "react";
import { Download, Filter, Printer, X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { Segmented } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { buildPrintHtml, estimatePages, printHtml, type ExportDoc, type PrintOptions } from "./reportExport";

// YANGI VERSIYA — «PDF'GA CHIQARISH» OYNASI (rasm «Qarzdorlar → PDF», yorug'/qorong'i,
// 25.10.2026): chapda sahifaning o'zi (birinchi varaq, kichraytirilgan — chop etiladigan
// HTML'ning aynan o'zi), o'ngda: «PDF'ga chiqarish» · «Qarzdorlar · 1 sahifa» · ×;
// «Sahifa» — A4 · tik / A4 · yotiq; galochkalar — «Markaz nomi va filial», «Sana va kim
// tayyorlagani» va hisobotning o'zinikilari («Ota-ona telefonlari»); «Joriy filtrlar
// bilan» qutisi; pastda «PDF yuklab olish» va «Chop etish». Ikkalasi ham brauzerning chop
// etish oynasini ochadi (loyihada PDF kutubxonasi yo'q — SAVOLLAR 109): birinchisida
// «PDF sifatida saqlash» tanlanadi, fayl nomi hisobot nomidan.

/** A4, 96 dpi. */
const PAGE = { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } } as const;

export interface PdfToggle {
  /** `ExportColumn.key`. */
  key: string;
  label: string;
}

export default function ReportPdfDialog({
  doc,
  reportTitle,
  toggles = [],
  onClose,
}: {
  doc: ExportDoc;
  /** Oyna izohidagi nom («Qarzdorlar»). */
  reportTitle: string;
  toggles?: PdfToggle[];
  onClose: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [orientation, setOrientation] = useState<PrintOptions["orientation"]>("portrait");
  const [showHeader, setShowHeader] = useState(true);
  const [showMeta, setShowMeta] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const opts: PrintOptions = useMemo(() => ({ orientation, showHeader, showMeta, hidden }), [orientation, showHeader, showMeta, hidden]);
  const html = useMemo(() => buildPrintHtml(doc, opts), [doc, opts]);
  const pages = estimatePages(doc, opts);
  // Oldindan ko'rish: chop etish HTML'i + ekran uchun sahifa chekkalari va pastki yozuv.
  const previewHtml = useMemo(
    () =>
      html.replace(
        "</style>",
        `@media screen{html,body{overflow:hidden}body{padding:14mm 14mm 16mm}.pfoot{position:fixed;left:14mm;right:14mm;bottom:7mm;display:flex;justify-content:space-between;color:#888;font-size:9px}}@media print{.pfoot{display:none}}</style>`,
      ).replace("</body>", `<div class="pfoot"><span>${doc.footer.replace(/</g, "")}</span><span>1 / ${pages}</span></div></body>`),
    [html, doc.footer, pages],
  );

  const size = PAGE[orientation];
  const boxW = orientation === "portrait" ? 300 : 400;
  const scale = boxW / size.w;

  const toggle = (key: string, on: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });

  const run = () => printHtml(html);

  return (
    <Modal
      onClose={onClose}
      controller={modal}
      bare
      variant="center"
      size="7xl"
      zIndex={110}
      containerClassName="max-sm:items-end max-sm:p-0"
      panelStyle={{ maxWidth: 820 }}
      panelClassName="bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden max-sm:max-w-none! max-sm:max-h-[92dvh]!"
    >
      <div
        data-ui="v2"
        role="document"
        className="flex max-h-[90vh] min-h-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md max-sm:max-h-[92dvh] max-sm:flex-col max-sm:rounded-b-none"
      >
        {/* Oldindan ko'rish */}
        <div className="hidden min-w-0 flex-1 items-center justify-center overflow-auto bg-v2-bg p-6 sm:flex">
          <div className="relative shrink-0 overflow-hidden bg-white shadow-v2-md" style={{ width: size.w * scale, height: size.h * scale }}>
            <iframe
              title={t("PDF ko'rinishi")}
              srcDoc={previewHtml}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
              style={{ width: size.w, height: size.h, transform: `scale(${scale})` }}
            />
          </div>
        </div>

        {/* Sozlamalar */}
        <div className="flex w-full shrink-0 flex-col border-v2-border p-5 sm:w-[288px] sm:border-l">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-v2-section text-v2-text">{t("PDF'ga chiqarish")}</h2>
              <p className="mt-0.5 text-v2-small text-v2-text-2">
                {reportTitle} · {t("{n} sahifa", { n: pages })}
              </p>
            </div>
            <button
              type="button"
              onClick={modal.close}
              aria-label={t("Yopish")}
              className="-mr-1.5 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 text-v2-small font-medium text-v2-text">{t("Sahifa")}</div>
            <Segmented
              value={orientation}
              onChange={(v) => setOrientation(v as PrintOptions["orientation"])}
              label={t("Sahifa")}
              options={[
                { value: "portrait", label: t("A4 · tik") },
                { value: "landscape", label: t("A4 · yotiq") },
              ]}
            />
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              { key: "__header", label: t("Markaz nomi va filial"), on: showHeader, set: setShowHeader },
              { key: "__meta", label: t("Sana va kim tayyorlagani"), on: showMeta, set: setShowMeta },
            ].map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2.5 text-v2-body text-v2-text">
                <V2Checkbox checked={o.on} onChange={o.set} label={o.label} />
                <span>{o.label}</span>
              </label>
            ))}
            {toggles.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2.5 text-v2-body text-v2-text">
                <V2Checkbox checked={!hidden.has(o.key)} onChange={(on) => toggle(o.key, on)} label={t(o.label)} />
                <span>{t(o.label)}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-v2-small font-medium text-v2-text">
              <Filter className="size-3.5 text-v2-text-2" strokeWidth={1.75} aria-hidden />
              {t("Joriy filtrlar bilan")}
            </div>
            <p className="mt-1 text-v2-caption font-normal leading-[18px] text-v2-text-2">{doc.filters}</p>
          </div>

          <div className="mt-auto space-y-2 pt-6">
            <button type="button" onClick={run} className={`${primaryBtn} h-10 w-full justify-center`}>
              <Download className="size-4" strokeWidth={2} aria-hidden />
              {t("PDF yuklab olish")}
            </button>
            <button type="button" onClick={run} className={`${secondaryBtn} h-10 w-full justify-center`}>
              <Printer className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Chop etish")}
            </button>
            <p className="text-center text-v2-caption font-normal text-v2-text-3">{t("Ochilgan oynada «PDF sifatida saqlash»ni tanlang")}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
