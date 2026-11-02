"use client";

import { useState } from "react";
import { ChevronDown, CircleHelp, ExternalLink, Keyboard, LifeBuoy, Megaphone, PlayCircle } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { HELP_TOPICS, SUPPORT_URL } from "@/constants/helpTopics";
import { useAnnouncementsUnseen } from "@/lib/announcementsV2";
import { emitOpenAnnouncements } from "./v2Events";
import { usePopover } from "./usePopover";

// YORDAM MENYUSI (21-qism · Yuqori panel, 02.11.2026).
//
// Rasmdagi tartib: video qo'llanmalar, «Yangiliklar» (bildirishnomalarning
// «E'lonlar» varag'ini ochadi), «Texnik yordamga yozish», pastda klaviatura
// tugmalari. FARQLAR (design/v2/SAVOLLAR.md, 21-qism):
//  • «Shu sahifa bo'yicha» video kartasi yo'q — videolarning havolasi hali
//    yo'q (constants/helpTopics.js, hammasida `url` bo'sh); havolasi bor
//    mavzu bo'lsa ro'yxatda bosiladigan bo'ladi;
//  • «Texnik yordamga yozish» — SUPPORT_URL bo'sh ekan ko'rinmaydi.

const PANEL =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto";
const ROW =
  "flex w-full items-center gap-3 rounded-v2-md px-2.5 py-2 text-left text-v2-body text-v2-text transition-colors hover:bg-v2-hover focus-visible:bg-v2-hover focus-visible:outline-none";
/** Video havolasi — ixchamroq qator (ROW ga qo'shimcha sinf emas: ikki `py-*`/`text-*` to'qnashadi). */
const VIDEO_ROW =
  "flex w-full items-start gap-3 rounded-v2-md px-2.5 py-1.5 text-left text-v2-small text-v2-text transition-colors hover:bg-v2-hover focus-visible:bg-v2-hover focus-visible:outline-none";
const KBD =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 font-v2 text-[11px] font-medium leading-none text-v2-text-3";

const SHORTCUTS: { label: string; keys: string }[] = [
  { label: "Qidiruv", keys: "Ctrl K" },
  { label: "Yangi", keys: "N" },
  { label: "«Yangi»da tanlash", keys: "1–8" },
  { label: "Yopish", keys: "Esc" },
];

export default function HelpMenuV2() {
  const { t } = useT();
  const { open, ref, toggle, close } = usePopover();
  const [videosOpen, setVideosOpen] = useState(false);
  const unseen = useAnnouncementsUnseen();
  const ready = HELP_TOPICS.filter((x) => x.url).length;

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t("Yordam")}
        aria-label={t("Yordam")}
        className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text ${
          open ? "bg-v2-surface-2 text-v2-text" : ""
        }`}
      >
        <CircleHelp className="size-5" strokeWidth={1.75} />
        {unseen > 0 && <span className="pointer-events-none absolute right-1.5 top-1.5 size-2 rounded-v2-full bg-v2-brand ring-2 ring-v2-surface" aria-hidden />}
      </button>

      {open && (
        <div role="menu" aria-label={t("Yordam")} className={`${PANEL} w-[320px]`}>
          <div className="px-4 pb-1 pt-3 text-v2-section text-v2-text">{t("Yordam")}</div>
          <div className="max-h-[min(70vh,520px)] overflow-y-auto p-1.5">
            <button type="button" onClick={() => setVideosOpen((v) => !v)} aria-expanded={videosOpen} className={ROW}>
              <PlayCircle className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{t("Video qo'llanmalar")}</span>
              <span className="text-v2-caption tabular-nums text-v2-text-3">{HELP_TOPICS.length}</span>
              <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${videosOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
            </button>
            {videosOpen && (
              <ul className="mb-1 ml-7 border-l border-v2-border pl-2">
                {HELP_TOPICS.map((topic, i) => (
                  <li key={i}>
                    {topic.url ? (
                      <a href={topic.url} target="_blank" rel="noopener noreferrer" onClick={close} className={VIDEO_ROW}>
                        <span className="min-w-0 flex-1">{t(topic.title)}</span>
                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} />
                      </a>
                    ) : (
                      // Havola hali yo'q — bosilmaydigan qator (eski paneldagi kabi).
                      <div className="flex items-start gap-2 px-2.5 py-1.5 text-v2-small text-v2-text-2">
                        <span className="min-w-0 flex-1">{t(topic.title)}</span>
                      </div>
                    )}
                  </li>
                ))}
                {ready === 0 && <li className="px-2.5 pb-1.5 text-v2-caption text-v2-text-3">{t("Videolar tez orada qo'shiladi")}</li>}
              </ul>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                emitOpenAnnouncements();
              }}
              className={ROW}
            >
              <Megaphone className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">{t("Yangiliklar")}</span>
              {unseen > 0 && (
                <span className="rounded-v2-full bg-v2-brand-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-brand-text">
                  {t("{n} ta yangi", { n: unseen })}
                </span>
              )}
            </button>

            {SUPPORT_URL && (
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={close} className={ROW}>
                <LifeBuoy className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{t("Texnik yordamga yozish")}</span>
              </a>
            )}
          </div>

          <div className="border-t border-v2-border px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-v2-caption text-v2-text-3">
              <Keyboard className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Klaviatura")}
            </div>
            <dl className="space-y-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-3 text-v2-small text-v2-text-2">
                  <dt>{t(s.label)}</dt>
                  <dd>
                    <kbd className={KBD}>{s.keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
